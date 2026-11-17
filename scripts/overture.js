// Overture Maps 건물(GeoJSON, 한 줄에 하나)을 stdin으로 받아, OSM에 없고 한국 경계 안에 있는 건물만 stdout으로 내보냄
// 사용: overturemaps download ... -f geojsonseq --type=building | node scripts/overture.js data/south-korea.poly > data/overture.ndjson
// 내보내는 줄: {"h":높이(m)|null,"f":층수|null,"c":[[경도,위도],...]} (바깥 링만)
import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import { parsePoly, inPoly } from './poly.js';

const korea = parsePoly(readFileSync(process.argv[2], 'utf8'));
const num = (v) => (v > 0 ? +(+v).toFixed(1) : null);
const by = {}; // 출처별 건물 수
let kept = 0, outside = 0, sample;
for await (let line of createInterface({ input: process.stdin })) {
  if (line.charCodeAt(0) === 0x1e) line = line.slice(1); // GeoJSON 줄 구분 문자
  if (!line.trim()) continue;
  const { properties: p = {}, geometry: g } = JSON.parse(line);
  let src = p.sources;
  if (typeof src === 'string') try { src = JSON.parse(src); } catch { src = []; }
  const dataset = src?.[0]?.dataset ?? '출처 없음';
  by[dataset] = (by[dataset] ?? 0) + 1;
  if (dataset === 'OpenStreetMap' || p.is_underground || !g) continue; // OSM 건물은 OSM 추출본에서 이미 받음
  for (const poly of g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []) {
    const ring = poly[0];
    if (!inPoly(korea, ring[0][0], ring[0][1])) { outside++; continue; }
    sample ??= JSON.stringify(p).slice(0, 400);
    process.stdout.write(JSON.stringify({ h: num(p.height), f: num(p.num_floors), c: ring.map(([lon, lat]) => [+lon.toFixed(6), +lat.toFixed(6)]) }) + '\n');
    kept++;
  }
}
console.error(`Overture 출처별 건물 수: ${JSON.stringify(by)}\n추가할 건물 ${kept}개 (한국 밖 ${outside}개 제외)\n예: ${sample}`);
