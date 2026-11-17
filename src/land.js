// 땅 덮개(숲·풀밭·논밭) 격자: 타일 하나를 LAND×LAND 칸으로 나눠 칸마다 종류 하나 (0 없음, 1 논밭, 2 풀밭·공원, 3 숲)
// 타일 JSON에는 [종류, 칸 수, 종류, 칸 수, ...] 로 줄여 넣음 (북서쪽 칸부터 동쪽으로, 줄은 남쪽으로)
export const LAND = 64;

// OSM 태그 → 종류 (해당 없으면 0)
export function landKind(t) {
  if (t.landuse === 'forest' || t.natural === 'wood' || t.natural === 'scrub' || t.natural === 'heath') return 3;
  if (['grass', 'meadow', 'village_green', 'recreation_ground', 'cemetery'].includes(t.landuse) || t.natural === 'grassland' || ['park', 'golf_course', 'pitch', 'garden'].includes(t.leisure)) return 2;
  if (['farmland', 'orchard', 'vineyard', 'plant_nursery'].includes(t.landuse)) return 1;
  return 0;
}

// 다각형(링 목록, 전역 타일 좌표 [fx, fy], 구멍 포함)을 칸 가운데 기준으로 칠함. 겹치면 큰 종류가 이김
// grid(key): "x/y" 타일의 Uint8Array(LAND²)를 돌려주는 함수
export function rasterize(rings, kind, grid) {
  let y0 = Infinity, y1 = -Infinity;
  for (const r of rings) for (const p of r) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const xs = [];
  for (let row = Math.ceil(y0 * LAND - 0.5); row <= Math.floor(y1 * LAND - 0.5); row++) {
    const y = (row + 0.5) / LAND;
    xs.length = 0;
    for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) { // 이 줄을 가로지르는 변의 x (짝홀 규칙 → 구멍도 처리)
      const [ax, ay] = r[j], [bx, by] = r[i];
      if (ay > y !== by > y) xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
    }
    xs.sort((a, b) => a - b);
    const ty = Math.floor(row / LAND), j = row - ty * LAND;
    for (let k = 0; k + 1 < xs.length; k += 2) for (let col = Math.ceil(xs[k] * LAND - 0.5); col <= Math.floor(xs[k + 1] * LAND - 0.5); col++) {
      const tx = Math.floor(col / LAND), cell = grid(`${tx}/${ty}`), i = j * LAND + col - tx * LAND;
      if (cell[i] < kind) cell[i] = kind;
    }
  }
}

export function encode(cells) {
  const out = [];
  for (let i = 0; i < cells.length; ) { let n = 1; while (i + n < cells.length && cells[i + n] === cells[i]) n++; out.push(cells[i], n); i += n; }
  return out;
}
export function decode(runs) {
  const cells = new Uint8Array(LAND * LAND);
  for (let k = 0, i = 0; k < runs.length; k += 2) { cells.fill(runs[k], i, i + runs[k + 1]); i += runs[k + 1]; }
  return cells;
}
