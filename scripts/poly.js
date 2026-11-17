// Geofabrik .poly 파일(나라 경계) 읽기와 포함 검사
import { inside } from '../src/collide.js';

// 글 → 바깥 링[] ([경도, 위도][]). "!"로 시작하는 구멍 구역은 무시(경계 안쪽을 넓게 봄)
export function parsePoly(text) {
  const rings = [];
  let ring = null, hole = false;
  for (const line of text.split('\n').slice(1).map((l) => l.trim()).filter(Boolean)) {
    if (line === 'END') { if (ring && !hole) rings.push(ring); if (!ring) break; ring = null; }
    else if (!ring) { ring = []; hole = line.startsWith('!'); }
    else ring.push(line.split(/\s+/).map(Number));
  }
  return rings;
}

export const inPoly = (rings, lon, lat) => rings.some((r) => inside(r, lon, lat));
