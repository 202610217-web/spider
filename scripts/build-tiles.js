// OSM 추출본(.osm.pbf) → 타일별 건물·도로 JSON (public/data/tiles/15/x/y.json)
// 사용: node scripts/build-tiles.js [입력.osm.pbf]   (osmium-tool 필요)
// 좌표는 타일 북서쪽 모서리 기준 미터: [동쪽, 북쪽(음수)]
import { spawn, execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { buildingHeight } from '../src/height.js';
import { buildingStyle } from '../src/style.js';
import { Z, S, lonLatToTile } from '../src/tile.js';
import { ROAD_WIDTH, densify } from '../src/roads.js';
import { inside } from '../src/collide.js';

const SRC = process.argv[2] ?? 'data/south-korea-latest.osm.pbf';
const OUT = 'public/data/tiles';
mkdirSync('data', { recursive: true });
if (!existsSync(SRC)) {
  if (process.argv[2]) throw new Error(`${SRC} 없음`);
  console.log('한국 추출본 다운로드 중…');
  execFileSync('curl', ['-fL', '-o', SRC, 'https://download.geofabrik.de/asia/south-korea-latest.osm.pbf'], { stdio: 'inherit' });
}

const EXPORT = ['-f', 'geojsonseq', '-x', 'print_record_separator=false', '--overwrite'];
// 닫힌 링의 넓이(m²)
const area = (r) => Math.abs(r.reduce((a, [x, y], i) => a + (i ? r[i - 1][0] * y - x * r[i - 1][1] : 0), 0)) / 2;
const tileOf = ([fx, fy]) => `${Math.floor(fx)}/${Math.floor(fy)}`;

// 군 부지(landuse=military, military=*) 다각형을 먼저 모음 → 그 안의 건물·도로는 태그가 없어도 제외
execFileSync('osmium', ['tags-filter', SRC, 'a/landuse=military', 'a/military', '-o', 'data/military.osm.pbf', '--overwrite'], { stdio: 'inherit' });
execFileSync('osmium', ['export', 'data/military.osm.pbf', ...EXPORT, '--geometry-types=polygon', '-o', 'data/military.geojsonseq'], { stdio: 'inherit' });
const military = new Map(); // "x/y" → 그 타일에 걸치는 군 부지 바깥 링[] (전역 타일 좌표, 구멍은 무시해 넓게 제외)
for (const line of readFileSync('data/military.geojsonseq', 'utf8').split('\n')) {
  if (!line) continue;
  const g = JSON.parse(line).geometry;
  for (const poly of g.type === 'Polygon' ? [g.coordinates] : g.coordinates) {
    const ring = poly[0].map(([lon, lat]) => lonLatToTile(lon, lat));
    const xs = ring.map((p) => Math.floor(p[0])), ys = ring.map((p) => Math.floor(p[1]));
    for (let x = Math.min(...xs); x <= Math.max(...xs); x++) for (let y = Math.min(...ys); y <= Math.max(...ys); y++) {
      const key = `${x}/${y}`;
      if (!military.has(key)) military.set(key, []);
      military.get(key).push(ring);
    }
  }
}
const inMilitary = (p) => military.get(tileOf(p))?.some((ring) => inside(ring, p[0], p[1])) ?? false;

// 건물(멀티폴리곤 포함)과 도로만 추린 뒤 한 줄에 하나씩 GeoJSON으로 내보냄
execFileSync('osmium', ['tags-filter', SRC, 'a/building', 'w/highway', '-o', 'data/buildings.osm.pbf', '--overwrite'], { stdio: 'inherit' });
const osmium = spawn('osmium', ['export', 'data/buildings.osm.pbf', ...EXPORT, '--geometry-types=polygon,linestring', '-o', '-'],
  { stdio: ['ignore', 'pipe', 'inherit'] });
const exit = new Promise((r) => osmium.on('close', r));

const tiles = new Map(); // "x/y" → { buildings: JSON 문자열[], roads: JSON 문자열[] }
const count = { buildings: 0, roads: 0 };
let skipped = 0;
// pts(전역 타일 좌표)를 첫 점이 속한 타일 기준 미터로 바꿔 그 타일에 넣음
function put(kind, pts, props) {
  const tx = Math.floor(pts[0][0]), ty = Math.floor(pts[0][1]);
  const xy = pts.map(([fx, fy]) => [+((fx - tx) * S).toFixed(1), +(-(fy - ty) * S).toFixed(1)]);
  const key = `${tx}/${ty}`;
  if (!tiles.has(key)) tiles.set(key, { buildings: [], roads: [] });
  tiles.get(key)[kind].push(JSON.stringify(props(xy)));
  count[kind]++;
}
// 도로는 40m 이하 구간으로 쪼갠 뒤 타일이 바뀌는 점에서 잘라 각 타일에 나눠 넣음 (조각은 끝점을 공유해 이어짐). 군 부지 안의 점은 뺌
function putRoad(coords, w) {
  let run = [];
  const flush = () => { if (run.length > 1) put('roads', run, (line) => ({ w, line })); run = []; };
  for (const p of densify(coords.map(([lon, lat]) => lonLatToTile(lon, lat)), 40 / S)) {
    if (inMilitary(p)) { skipped++; flush(); continue; }
    if (run.length && tileOf(p) !== tileOf(run[0])) { run.push(p); flush(); }
    run.push(p);
  }
  flush();
}
for await (const line of createInterface({ input: osmium.stdout })) {
  if (!line) continue;
  const { properties: t, geometry: g } = JSON.parse(line);
  if (t.military || t.building === 'military' || t.landuse === 'military') { skipped++; continue; }
  if (g.type === 'LineString') {
    const w = ROAD_WIDTH[t.highway];
    if (w && !t.tunnel) putRoad(g.coordinates, w); // 터널(지하)은 제외
  } else if (t.building) {
    const h = buildingHeight(t);
    for (const poly of g.type === 'Polygon' ? [g.coordinates] : g.coordinates) {
      const pts = poly[0].map(([lon, lat]) => lonLatToTile(lon, lat)); // 바깥 링만
      if (pts.some(inMilitary)) skipped++; // 꼭짓점 하나라도 군 부지 안이면 제외
      else put('buildings', pts, (ring) => ({ h, s: buildingStyle(t, h, area(ring)), ring }));
    }
  }
}
if (await exit) throw new Error('osmium export 실패');

rmSync(OUT, { recursive: true, force: true });
for (const [key, t] of tiles) {
  mkdirSync(`${OUT}/${Z}/${key.split('/')[0]}`, { recursive: true });
  writeFileSync(`${OUT}/${Z}/${key}.json`, `{"buildings":[${t.buildings.join(',')}],"roads":[${t.roads.join(',')}]}`);
}
console.log(`건물 ${count.buildings}개, 도로 ${count.roads}개 → 타일 ${tiles.size}개 (military 제외: 건물·도로 점 ${skipped}개, 군 부지 타일 ${military.size}개)`);
