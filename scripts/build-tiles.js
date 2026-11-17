// OSM 추출본(.osm.pbf) → 타일별 건물·도로·물·횡단보도·신호등 JSON (public/data/tiles/15/x/y.json)
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
import { clipRing } from '../src/clip.js';
import { nearestRoad } from '../src/street.js';

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

// 건물(멀티폴리곤 포함)·도로·물(강·호수)·횡단보도만 추린 뒤 한 줄에 하나씩 GeoJSON으로 내보냄
execFileSync('osmium', ['tags-filter', SRC, 'a/building', 'w/highway', 'a/natural=water', 'n/highway=crossing', 'n/highway=traffic_signals', '-o', 'data/buildings.osm.pbf', '--overwrite'], { stdio: 'inherit' });
const osmium = spawn('osmium', ['export', 'data/buildings.osm.pbf', ...EXPORT, '--geometry-types=polygon,linestring,point', '-o', '-'],
  { stdio: ['ignore', 'pipe', 'inherit'] });
const exit = new Promise((r) => osmium.on('close', r));

const tiles = new Map(); // "x/y" → { buildings, roads, water: JSON 문자열[], cross·lights: 횡단보도·신호등 [동, 북][] }
const tile = (key) => tiles.get(key) ?? tiles.set(key, { buildings: [], roads: [], water: [], cross: [], lights: [] }).get(key);
const meters = (tx, ty) => ([fx, fy]) => [+((fx - tx) * S).toFixed(1), +(-(fy - ty) * S).toFixed(1)];
const count = { buildings: 0, roads: 0, water: 0, cross: 0, lights: 0, bridges: 0 };
let skipped = 0;
// pts(전역 타일 좌표)를 첫 점이 속한 타일 기준 미터로 바꿔 그 타일에 넣음
function put(kind, pts, props) {
  const tx = Math.floor(pts[0][0]), ty = Math.floor(pts[0][1]);
  tile(`${tx}/${ty}`)[kind].push(JSON.stringify(props(pts.map(meters(tx, ty)))));
  count[kind]++;
}
// 도로는 40m 이하 구간으로 쪼갠 뒤 타일이 바뀌는 점에서 잘라 각 타일에 나눠 넣음 (조각은 끝점을 공유해 이어짐). 군 부지 안의 점은 뺌
function putRoad(coords, w, b) {
  let run = [];
  const flush = () => { if (run.length > 1) put('roads', run, (line) => (b ? { w, line, b: 1 } : { w, line })); run = []; };
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
  if (g.type === 'Point') { // 횡단보도·신호등 위치만 모아 두고, 방향은 도로를 다 읽은 뒤에 정함
    const p = lonLatToTile(...g.coordinates), tx = Math.floor(p[0]), ty = Math.floor(p[1]);
    const kind = { crossing: 'cross', traffic_signals: 'lights' }[t.highway];
    if (kind && !inMilitary(p)) tile(`${tx}/${ty}`)[kind].push(meters(tx, ty)(p));
  } else if (g.type === 'LineString') {
    const w = ROAD_WIDTH[t.highway];
    const b = !!t.bridge && t.bridge !== 'no'; // 다리·고가: 게임에서 상판을 띄움
    if (w && !t.tunnel) { putRoad(g.coordinates, w, b); if (b) count.bridges++; } // 터널(지하)은 제외
  } else if (t.building) {
    for (const poly of g.type === 'Polygon' ? [g.coordinates] : g.coordinates) {
      const pts = poly[0].map(([lon, lat]) => lonLatToTile(lon, lat)); // 바깥 링만
      if (pts.some(inMilitary)) skipped++; // 꼭짓점 하나라도 군 부지 안이면 제외
      else put('buildings', pts, (ring) => { const a = area(ring), h = buildingHeight(t, a); return { h, s: buildingStyle(t, h, a), ring }; });
    }
  } else if (t.natural === 'water') { // 강·호수: 걸치는 타일마다 그 타일 안쪽만 잘라 넣음 (구멍 = 섬)
    for (const poly of g.type === 'Polygon' ? [g.coordinates] : g.coordinates) {
      const closed = poly.map((r) => r.map(([lon, lat]) => lonLatToTile(lon, lat)));
      if (area(closed[0]) * S * S < 100) continue; // 아주 작은 물(분수 등)은 뺌
      const rings = closed.map((r) => r.slice(0, -1)); // 자를 때는 닫는 점을 뺌
      const xs = rings[0].map((p) => Math.floor(p[0])), ys = rings[0].map((p) => Math.floor(p[1]));
      for (let tx = Math.min(...xs); tx <= Math.max(...xs); tx++) for (let ty = Math.min(...ys); ty <= Math.max(...ys); ty++) {
        const [outer, ...holes] = rings.map((r) => clipRing(r, tx, ty, tx + 1, ty + 1).map(meters(tx, ty)));
        if (!outer.length) continue;
        tile(`${tx}/${ty}`).water.push(JSON.stringify([outer, ...holes.filter((h) => h.length)]));
        count.water++;
      }
    }
  }
}
if (await exit) throw new Error('osmium export 실패');

rmSync(OUT, { recursive: true, force: true });
for (const [key, t] of tiles) {
  mkdirSync(`${OUT}/${Z}/${key.split('/')[0]}`, { recursive: true });
  // 횡단보도·신호등: 3m 안의 가장 가까운 도로에 맞춰 [동, 북, 도로 방향, 도로 폭]으로 (도로에서 먼 것은 버림)
  const roads = t.cross.length + t.lights.length ? JSON.parse(`[${t.roads.join(',')}]`) : [];
  const snap = (pts) => pts.map(([x, y]) => [x, y, nearestRoad(roads, x, y)]).filter(([, , n]) => n.d <= 3).map(([x, y, n]) => [x, y, +n.ang.toFixed(2), n.w]);
  const cross = snap(t.cross), lights = snap(t.lights);
  count.cross += cross.length; count.lights += lights.length;
  writeFileSync(`${OUT}/${Z}/${key}.json`, `{"buildings":[${t.buildings.join(',')}],"roads":[${t.roads.join(',')}],"water":[${t.water.join(',')}],"cross":${JSON.stringify(cross)},"lights":${JSON.stringify(lights)}}`);
}
console.log(`건물 ${count.buildings}개, 도로 ${count.roads}개, 물 ${count.water}조각, 횡단보도 ${count.cross}개, 신호등 ${count.lights}개, 다리 ${count.bridges}개 → 타일 ${tiles.size}개 (military 제외: 건물·도로 점 ${skipped}개, 군 부지 타일 ${military.size}개)`);
