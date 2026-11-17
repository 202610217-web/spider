// OSM 추출본(.osm.pbf) → 타일별 건물·도로·물·횡단보도·신호등 JSON (public/data/tiles/15/x/y.json)
// data/gis.ndjson이 있으면(scripts/fetch-gis.sh, 국토교통부 GIS건물통합정보) 그 건물을 먼저 넣고, OSM·Overture는 겹치지 않는 것만 더함
// data/overture.ndjson이 있으면(scripts/fetch-overture.sh) OSM에 없는 건물을 더함
// 사용: node scripts/build-tiles.js [입력.osm.pbf]   (osmium-tool 필요)
// 좌표는 타일 북서쪽 모서리 기준 미터: [동쪽, 북쪽(음수)]
import { spawn, execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync, createReadStream } from 'node:fs';
import { buildingHeight } from '../src/height.js';
import { buildingStyle, designOf, colourOf } from '../src/style.js';
import { gzipSync } from 'node:zlib';
import { Z, S, lonLatToTile } from '../src/tile.js';
import { ROAD_WIDTH, densify } from '../src/roads.js';
import { inside } from '../src/collide.js';
import { clipRing } from '../src/clip.js';
import { nearestRoad } from '../src/street.js';
import { LAND, landKind, rasterize, encode } from '../src/land.js';

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
execFileSync('osmium', ['tags-filter', SRC, 'a/building', 'a/building:part', 'w/highway', 'a/natural=water', 'n/highway=crossing', 'n/highway=traffic_signals',
  'a/landuse=forest,grass,meadow,village_green,recreation_ground,cemetery,farmland,orchard,vineyard,plant_nursery', 'a/natural=wood,scrub,heath,grassland', 'a/leisure=park,golf_course,pitch,garden', '-o', 'data/buildings.osm.pbf', '--overwrite'], { stdio: 'inherit' });
const osmium = spawn('osmium', ['export', 'data/buildings.osm.pbf', ...EXPORT, '--geometry-types=polygon,linestring,point', '-o', '-'],
  { stdio: ['ignore', 'pipe', 'inherit'] });
const exit = new Promise((r) => osmium.on('close', r));

const tiles = new Map(); // "x/y" → { buildings, roads, water: JSON 문자열[], cross·lights: 횡단보도·신호등 [동, 북][] }
const tile = (key) => tiles.get(key) ?? tiles.set(key, { buildings: [], roads: [], water: [], cross: [], lights: [], box: [], parts: [] }).get(key); // box: 건물 외곽 상자(겹침 검사용), parts: 건물 부분의 중심 [x, y, …]
const meters = (tx, ty) => ([fx, fy]) => [+((fx - tx) * S).toFixed(1), +(-(fy - ty) * S).toFixed(1)];
const count = { gis: 0, hidden: 0, buildings: 0, roads: 0, water: 0, cross: 0, lights: 0, bridges: 0 };
const parts = []; // OSM 건물 부분 [전역 타일 좌표 꼭짓점, 태그] — 다른 건물을 다 넣은 뒤에 넣음
const lands = new Map(); // "x/y" → 땅 덮개 칸 Uint8Array(LAND²)
const landGrid = (key) => lands.get(key) ?? lands.set(key, new Uint8Array(LAND * LAND)).get(key);
let skipped = 0;
// pts(전역 타일 좌표)를 첫 점이 속한 타일 기준 미터로 바꿔 그 타일에 넣음
function put(kind, pts, props) {
  const tx = Math.floor(pts[0][0]), ty = Math.floor(pts[0][1]);
  tile(`${tx}/${ty}`)[kind].push(JSON.stringify(props(pts.map(meters(tx, ty)))));
  count[kind]++;
}
// 건물을 첫 점이 속한 타일에 넣음. mode: 'gis'(공식, 가장 먼저) · 'osm' · 'overture' · 'part'(OSM building:part, 맨 마지막)
// 먼저 들어간 건물과 겹치면 뺌(Overture는 늘, OSM은 공식 데이터가 있을 때), Overture는 높이 정보가 없으면 바닥 넓이로 추정
// shortcut: 겹침은 같은 타일 안에서 "중심이 다른 건물의 외곽 상자 안"으로만 봄 — 비스듬한 건물 옆 건물이 가끔 빠짐, 눈에 띄면 다각형 검사로
// 지붕 모양 태그 → p: 1 박공·모임(사각형 바닥만), 2 피라미드, 3 돔, 0 평지붕(그 밖의 모양도)
const ROOF = { gabled: 1, hipped: 1, 'half-hipped': 1, gambrel: 1, mansard: 1, saltbox: 1, pyramidal: 2, dome: 3, onion: 3 };
const num = (v) => { const n = parseFloat(v); return n > 0 ? n : null; };
function putBuilding(pts, tags, mode = 'osm') {
  const tx = Math.floor(pts[0][0]), ty = Math.floor(pts[0][1]), t = tile(`${tx}/${ty}`), ring = pts.map(meters(tx, ty));
  const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), a = area(ring);
  if (mode === 'overture' && a < 20) return false; // 자동 추출 잡음
  if (mode === 'overture' || (mode === 'osm' && count.gis > 0)) {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    for (let i = 0; i < t.box.length; i += 4) if (cx >= t.box[i] && cx <= t.box[i + 2] && cy >= t.box[i + 1] && cy <= t.box[i + 3]) return false;
  }
  if (mode !== 'part') t.box.push(x0, y0, x1, y1);
  const h = buildingHeight(tags, mode === 'overture' ? a : undefined, pts[0]), s = buildingStyle(tags, h, a);
  // 건물마다 다른 모습: 사용승인 연도·재료로 디자인, OSM 색 태그로 벽·지붕 색, 지붕 모양 태그로 경사 지붕 여부
  const b = { h, s, ring }, d = designOf(tags, s, h), c = colourOf(tags['building:colour']), rc = colourOf(tags['roof:colour']), shape = tags['roof:shape'];
  if (d !== undefined) b.d = d;
  if (c !== undefined) b.c = c;
  if (rc !== undefined) b.rc = rc;
  if (shape) b.p = ROOF[shape] ?? 0;
  if (num(tags['roof:height'])) b.r = num(tags['roof:height']);
  if (mode === 'part') { // 부분: 바닥이 땅에서 m만큼 떠 있음(min_height, 없으면 building:min_level × 3m). 그 부분이 덮는 바깥 건물은 쓰기 전에 뺌
    b.m = num(tags.min_height) ?? (num(tags['building:min_level']) ?? 0) * 3;
    t.parts.push(xs.reduce((u, v) => u + v, 0) / xs.length, ys.reduce((u, v) => u + v, 0) / ys.length);
  }
  t.buildings.push(JSON.stringify(b));
  count.buildings++;
  return true;
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
// 공식 건물(국토교통부 GIS건물통합정보)을 OSM보다 먼저 넣음 → OSM·Overture는 그와 겹치지 않는 것만 들어감
if (existsSync('data/gis.ndjson')) for await (const line of createInterface({ input: createReadStream('data/gis.ndjson') })) {
  if (!line) continue;
  const { c, t } = JSON.parse(line), pts = c.map(([lon, lat]) => lonLatToTile(lon, lat));
  if (pts.length < 4 || pts.some(inMilitary)) { skipped++; continue; }
  if (putBuilding(pts, t, 'gis')) count.gis++;
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
  } else if (t['building:part'] && t['building:part'] !== 'no') { // 건물 부분(Simple 3D Buildings): 바깥 건물을 다 넣은 뒤에 넣음
    for (const poly of g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []) {
      const pts = poly[0].map(([lon, lat]) => lonLatToTile(lon, lat));
      if (pts.some(inMilitary)) skipped++; else parts.push([pts, { ...t, building: t.building ?? t['building:part'] }]);
    }
  } else if (t.building) {
    for (const poly of g.type === 'Polygon' ? [g.coordinates] : g.coordinates) {
      const pts = poly[0].map(([lon, lat]) => lonLatToTile(lon, lat)); // 바깥 링만
      if (pts.some(inMilitary)) skipped++; // 꼭짓점 하나라도 군 부지 안이면 제외
      else putBuilding(pts, t);
    }
  } else if (landKind(t) && !t.building) { // 숲·풀밭·논밭: 타일마다 64×64 칸에 칠함
    for (const poly of g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [])
      rasterize(poly.map((r) => r.map(([lon, lat]) => lonLatToTile(lon, lat))), landKind(t), landGrid);
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

// Overture에서 받아 둔, OSM에 없는 건물(위성사진 자동 추출 등)
const EXTRA = 'data/overture.ndjson';
let added = 0, dup = 0;
if (existsSync(EXTRA)) for await (const line of createInterface({ input: createReadStream(EXTRA) })) {
  if (!line) continue;
  const { h, f, c } = JSON.parse(line);
  const pts = c.map(([lon, lat]) => lonLatToTile(lon, lat));
  if (pts.length < 4 || pts.some(inMilitary)) { skipped++; continue; }
  if (putBuilding(pts, { height: h, 'building:levels': f }, 'overture')) added++; else dup++;
}

// 건물 부분: 공식·OSM·Overture를 다 넣은 뒤에. 바깥 건물(같은 자리의 덩어리 하나)은 타일을 쓸 때 뺌
for (const [pts, t] of parts) putBuilding(pts, t, 'part');

rmSync(OUT, { recursive: true, force: true });
for (const key of lands.keys()) tile(key); // 숲만 있는 산 타일도 파일을 만듦
for (const [key, t] of tiles) {
  mkdirSync(`${OUT}/${Z}/${key.split('/')[0]}`, { recursive: true });
  // 건물 부분이 있는 타일: 부분의 중심이 안에 드는 바깥 건물(부분이 아닌 것)을 뺌 → 부분들만 보임
  // shortcut: 바깥 건물과 부분이 다른 타일(첫 꼭짓점 기준)에 들어가면 둘 다 보임, 타일 경계의 랜드마크에서 눈에 띄면 이웃 타일까지 검사
  if (t.parts.length) t.buildings = t.buildings.filter((str) => {
    const b = JSON.parse(str);
    if ('m' in b) return true;
    for (let i = 0; i < t.parts.length; i += 2) if (inside(b.ring, t.parts[i], t.parts[i + 1])) { count.hidden++; return false; }
    return true;
  });
  // 횡단보도·신호등: 3m 안의 가장 가까운 도로에 맞춰 [동, 북, 도로 방향, 도로 폭]으로 (도로에서 먼 것은 버림)
  const roads = t.cross.length + t.lights.length ? JSON.parse(`[${t.roads.join(',')}]`) : [];
  const snap = (pts) => pts.map(([x, y]) => [x, y, nearestRoad(roads, x, y)]).filter(([, , n]) => n.d <= 3).map(([x, y, n]) => [x, y, +n.ang.toFixed(2), n.w]);
  const cross = snap(t.cross), lights = snap(t.lights);
  count.cross += cross.length; count.lights += lights.length;
  // gzip으로 줄여 저장(배포 용량 한도 1GB) — 게임이 받아서 풂(src/tiles.js). R2에는 이름만 .json으로 바꿔 올림(scripts/upload-r2.sh)
  writeFileSync(`${OUT}/${Z}/${key}.json.gz`, gzipSync(`{"buildings":[${t.buildings.join(',')}],"roads":[${t.roads.join(',')}],"water":[${t.water.join(',')}],"cross":${JSON.stringify(cross)},"lights":${JSON.stringify(lights)}${lands.has(key) ? `,"land":${JSON.stringify(encode(lands.get(key)))}` : ''}}`, { level: 9 }));
}
console.log(`땅 덮개 타일 ${lands.size}개, 건물 ${count.buildings}개(그중 공식 GIS ${count.gis}개, 건물 부분 ${parts.length}개 — 부분에 덮여 뺀 바깥 건물 ${count.hidden}개)(그중 Overture 추가 ${added}개, 겹치거나 너무 작아 뺀 것 ${dup}개), 도로 ${count.roads}개, 물 ${count.water}조각, 횡단보도 ${count.cross}개, 신호등 ${count.lights}개, 다리 ${count.bridges}개 → 타일 ${tiles.size}개 (military 제외: 건물·도로 점 ${skipped}개, 군 부지 타일 ${military.size}개)`);
