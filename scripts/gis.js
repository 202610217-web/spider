// 국토교통부 GIS건물통합정보(브이월드, 공공누리 제1유형) → data/gis.ndjson
// 사용: ogr2ogr -f GeoJSONSeq -t_srs EPSG:4326 /vsistdout/ AL_xx_D010_*.shp | node scripts/gis.js >> data/gis.ndjson  (scripts/fetch-gis.sh가 부름)
// 내보내는 줄: {"c":[[경도,위도],...],"t":{OSM식 태그}} (바깥 링만)
// 필드 이름은 A0~A28 번호뿐이라, 2026년 배포본을 쓴 공개 사례 두 곳에서 같은 뜻으로 확인한 것만 씀:
//   A9 용도명, A13 사용승인일자, A16 높이(m, 없으면 0), A26 지상층수.  구조명은 값에 '구조'가 들어가는 칸을 찾아 씀
// 2026-11-13 변동분(CH_D010_00_20261113, 사용자가 받은 실제 파일)으로 확인: A9 단독주택, A11 벽돌구조, A13 1983-08-27, A16 14.4, A24 건물명, A26 5, A29 변동구분(I 신규·U 수정·D 삭제), EUC-KR, EPSG:5186
// 배포본마다 번호가 바뀔 수 있으므로 처음 3000개로 값이 그럴듯한지 검사하고, 아니면 실제 필드를 보여 주고 멈춤
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

export const FIELDS = { use: 'A9', approved: 'A13', height: 'A16', floors: 'A26' };
const num = (v) => { const n = parseFloat(v); return n > 0 && n < 1000 ? n : null; };

// 용도명(건축물대장 주용도) → OSM building 값. style.js·height.js가 그대로 씀
export function useToBuilding(use = '', floors) {
  if (/아파트/.test(use) || (/공동주택/.test(use) && floors >= 6)) return 'apartments';
  if (/공동주택|다세대|연립|다가구/.test(use)) return 'residential';
  if (/단독주택/.test(use)) return 'house';
  if (/근린생활|판매/.test(use)) return 'commercial';
  if (/업무/.test(use)) return 'office';
  if (/숙박/.test(use)) return 'hotel';
  if (/공장/.test(use)) return 'industrial';
  if (/창고|동물|식물|자동차|위험물|자원순환|분뇨/.test(use)) return 'warehouse';
  if (/교육|연구/.test(use)) return 'school';
  if (/의료/.test(use)) return 'hospital';
  if (/종교/.test(use)) return 'religious';
  if (/문화|집회|운동|노유자|공공|교정|방송|발전|관광|장례|묘지|수련/.test(use)) return 'public';
  return 'yes';
}

// 레코드 한 줄의 속성 → OSM식 태그 (structureField: 구조명 칸 이름, 없으면 null)
export function gisTags(p, structureField) {
  const floors = num(p[FIELDS.floors]), use = String(p[FIELDS.use] ?? ''), structure = structureField ? String(p[structureField] ?? '') : '';
  const year = parseInt(String(p[FIELDS.approved] ?? '').slice(0, 4), 10);
  const t = { building: useToBuilding(use, floors) };
  if (num(p[FIELDS.height])) t.height = num(p[FIELDS.height]);
  if (floors) t['building:levels'] = floors;
  if (year > 1800 && year < 2100) t.start_date = String(year);
  if (/목구조/.test(structure) && t.building === 'house') t['building:architecture'] = 'traditional'; // 목조 단독주택 → 한옥 모양
  if (/벽돌|조적/.test(structure)) t['building:material'] = 'brick';
  return t;
}

// 처음 몇천 개로 필드 번호가 맞는지 검사. 맞으면 구조명 칸 이름(없으면 null), 틀리면 오류
export function checkFields(rows) {
  const share = (f) => rows.filter(f).length / rows.length;
  const useOk = share((p) => /주택|시설|공장|창고|기타/.test(String(p[FIELDS.use] ?? ''))) > 0.5;
  const floorsOk = share((p) => /^\d{1,3}(\.0+)?$/.test(String(p[FIELDS.floors] ?? '').trim())) > 0.5;
  if (!useOk || !floorsOk) throw new Error(`GIS건물통합정보 필드 번호가 예상과 다름 (용도 ${FIELDS.use}: ${useOk}, 지상층수 ${FIELDS.floors}: ${floorsOk}). scripts/gis.js의 FIELDS를 고쳐야 함. 첫 레코드: ${JSON.stringify(rows[0])}`);
  const keys = Object.keys(rows[0] ?? {});
  return keys.find((k) => share((p) => /구조/.test(String(p[k] ?? ''))) > 0.5) ?? null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let buf = [], structure, n = 0;
  const out = ({ properties: p, geometry: g }) => {
    if (p.A29 === 'D') return; // 변동분 파일의 삭제 건
    for (const poly of g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : []) {
      process.stdout.write(JSON.stringify({ c: poly[0].map(([x, y]) => [+x.toFixed(6), +y.toFixed(6)]), t: gisTags(p, structure) }) + '\n');
      n++;
    }
  };
  for await (let line of createInterface({ input: process.stdin })) {
    if (line.charCodeAt(0) === 0x1e) line = line.slice(1);
    if (!line.trim()) continue;
    const f = JSON.parse(line);
    if (structure === undefined) {
      buf.push(f);
      if (buf.length < 3000) continue;
      structure = checkFields(buf.map((x) => x.properties)); buf.forEach(out); buf = [];
      console.error(`구조명 칸: ${structure ?? '못 찾음'}`);
    } else out(f);
  }
  if (structure === undefined && buf.length) { structure = checkFields(buf.map((x) => x.properties)); buf.forEach(out); }
  console.error(`GIS 건물 ${n}개`);
}
