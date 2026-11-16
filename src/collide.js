import * as THREE from 'three';

// 건물 충돌체: 바닥 모양(다각형) 그대로 세운 기둥. 외곽 상자는 빠른 걸러내기에만 사용
// ring: 타일 기준 [동, 북] 닫힌 링, off: 타일의 월드 위치, y0~y1: 바닥~옥상 높이
export function makeCollider(ring, off, y0, y1) {
  const pts = ring.map(([x, y]) => [off.x + x, off.z - y]); // 월드 [x, z]
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  return { pts, y0, y1, box: new THREE.Box3(new THREE.Vector3(Math.min(...xs), y0, Math.min(...zs)), new THREE.Vector3(Math.max(...xs), y1, Math.max(...zs))) };
}

// 점 (x, z)가 다각형 pts 안에 있는지
export function inside(pts, x, z) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

const q = [0, 0];
// 둘레에서 (x, z)에 가장 가까운 점을 q에 넣고 거리를 돌려줌
function nearestOnEdge(pts, x, z) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], dx = bx - ax, dz = bz - az;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    const px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz);
    if (d < best) { best = d; q[0] = px; q[1] = pz; }
  }
  return best;
}

const n = new THREE.Vector3();
// 반지름 r인 구(pos)를 기둥 밖으로 밀어냄. 닿았으면 밀어낸 방향(단위 벡터), 아니면 null
export function pushOut(c, pos, r) {
  const b = c.box;
  if (pos.x < b.min.x - r || pos.x > b.max.x + r || pos.y > b.max.y + r || pos.y < b.min.y - r || pos.z < b.min.z - r || pos.z > b.max.z + r) return null;
  const isIn = inside(c.pts, pos.x, pos.z), edge = nearestOnEdge(c.pts, pos.x, pos.z);
  let d;
  if (isIn && pos.y < c.y1) {    // 중심이 건물 안: 옥상과 벽 중 가까운 쪽으로
    if (c.y1 - pos.y < edge) { n.set(0, 1, 0); d = pos.y - c.y1; }
    else { n.set(q[0] - pos.x, 0, q[1] - pos.z); if (edge > 0) n.divideScalar(edge); else n.set(1, 0, 0); d = -edge; }
  } else {                       // 밖: 기둥에서 가장 가까운 점과의 거리
    n.set(isIn ? 0 : pos.x - q[0], pos.y - Math.min(pos.y, c.y1), isIn ? 0 : pos.z - q[1]);
    d = n.length();
    if (d >= r || d === 0) return null;
    n.divideScalar(d);
  }
  pos.addScaledVector(n, r - d);
  return n;
}

// 광선(o에서 dir 방향, dir은 단위 벡터)이 기둥의 벽이나 옥상에 처음 닿는 거리. 없으면 Infinity
export function rayHit(c, ray) {
  if (!ray.intersectsBox(c.box)) return Infinity;
  const o = ray.origin, d = ray.direction;
  let best = Infinity;
  for (let i = 1; i < c.pts.length; i++) {
    const [ax, az] = c.pts[i - 1], ex = c.pts[i][0] - ax, ez = c.pts[i][1] - az;
    const den = d.x * ez - d.z * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((ax - o.x) * ez - (az - o.z) * ex) / den, s = ((ax - o.x) * d.z - (az - o.z) * d.x) / den;
    const y = o.y + d.y * t;
    if (t > 0 && t < best && s >= 0 && s <= 1 && y >= c.y0 && y <= c.y1) best = t;
  }
  if (d.y < 0 && o.y > c.y1) {   // 위에서 내려오는 광선은 옥상에도 닿음
    const t = (c.y1 - o.y) / d.y;
    if (t < best && inside(c.pts, o.x + d.x * t, o.z + d.z * t)) best = t;
  }
  return best;
}
