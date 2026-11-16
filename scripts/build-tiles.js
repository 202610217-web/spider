// OSM 추출본(.osm.pbf) → 타일별 건물·도로 JSON (public/data/tiles/15/x/y.json)
// 사용: node scripts/build-tiles.js [입력.osm.pbf]   (osmium-tool 필요)
// 좌표는 타일 북서쪽 모서리 기준 미터: [동쪽, 북쪽(음수)]
import { spawn, execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { buildingHeight } from '../src/height.js';
import { Z, S, lonLatToTile } from '../src/tile.js';
import { ROAD_WIDTH } from '../src/roads.js';

const SRC = process.argv[2] ?? 'data/south-korea-latest.osm.pbf';
const OUT = 'public/data/tiles';
mkdirSync('data', { recursive: true });
if (!existsSync(SRC)) {
  if (process.argv[2]) throw new Error(`${SRC} 없음`);
  console.log('한국 추출본 다운로드 중…');
  execFileSync('curl', ['-fL', '-o', SRC, 'https://download.geofabrik.de/asia/south-korea-latest.osm.pbf'], { stdio: 'inherit' });
}

// 건물(멀티폴리곤 포함)과 도로만 추린 뒤 한 줄에 하나씩 GeoJSON으로 내보냄
execFileSync('osmium', ['tags-filter', SRC, 'a/building', 'w/highway', '-o', 'data/buildings.osm.pbf', '--overwrite'], { stdio: 'inherit' });
const osmium = spawn('osmium', ['export', 'data/buildings.osm.pbf', '-f', 'geojsonseq', '-x', 'print_record_separator=false', '--geometry-types=polygon,linestring', '-o', '-'],
  { stdio: ['ignore', 'pipe', 'inherit'] });
const exit = new Promise((r) => osmium.on('close', r));

const tiles = new Map(); // "x/y" → { buildings: JSON 문자열[], roads: JSON 문자열[] }
const count = { buildings: 0, roads: 0 };
let skipped = 0;
// 타일 기준 좌표로 바꿔 첫 꼭짓점이 속한 타일에 넣음
// shortcut: 타일 경계를 넘는 긴 도로는 자르지 않음 — 로드 범위 가장자리에서 끊겨 보이면 타일 경계에서 분할
function put(kind, coords, props) {
  const pts = coords.map(([lon, lat]) => lonLatToTile(lon, lat));
  const tx = Math.floor(pts[0][0]), ty = Math.floor(pts[0][1]);
  const xy = pts.map(([fx, fy]) => [+((fx - tx) * S).toFixed(1), +(-(fy - ty) * S).toFixed(1)]);
  const key = `${tx}/${ty}`;
  if (!tiles.has(key)) tiles.set(key, { buildings: [], roads: [] });
  tiles.get(key)[kind].push(JSON.stringify(props(xy)));
  count[kind]++;
}
for await (const line of createInterface({ input: osmium.stdout })) {
  if (!line) continue;
  const { properties: t, geometry: g } = JSON.parse(line);
  // shortcut: 태그 기준으로만 제외, 군 부지(landuse=military) 안의 태그 없는 건물은 남음 — 공개 전 부지 폴리곤 포함 검사 추가
  if (t.military || t.building === 'military' || t.landuse === 'military') { skipped++; continue; }
  if (g.type === 'LineString') {
    const w = ROAD_WIDTH[t.highway];
    if (w && !t.tunnel) put('roads', g.coordinates, (line) => ({ w, line })); // 터널(지하)은 제외
  } else if (t.building) {
    const h = buildingHeight(t);
    for (const poly of g.type === 'Polygon' ? [g.coordinates] : g.coordinates) put('buildings', poly[0], (ring) => ({ h, ring })); // 바깥 링만
  }
}
if (await exit) throw new Error('osmium export 실패');

rmSync(OUT, { recursive: true, force: true });
for (const [key, t] of tiles) {
  mkdirSync(`${OUT}/${Z}/${key.split('/')[0]}`, { recursive: true });
  writeFileSync(`${OUT}/${Z}/${key}.json`, `{"buildings":[${t.buildings.join(',')}],"roads":[${t.roads.join(',')}]}`);
}
console.log(`건물 ${count.buildings}개, 도로 ${count.roads}개 → 타일 ${tiles.size}개 (military 제외 ${skipped}개)`);
