import * as THREE from 'three';
import { rayHit } from './collide.js';

const ray = new THREE.Ray(), dir = new THREE.Vector3();
const MIN = 6; // 이보다 가까운 벽은 스윙이 안 되므로 건너뜀

// 거미줄을 걸 지점 찾기: heading(진행 방향, atan2(x, z)) 앞쪽 위로 정면부터 좌우·각도를 넓혀가며 처음 닿는 건물 벽
// 충돌체에 붙으므로 충돌과 일치하고 메시 레이캐스트보다 빠름. 건물이 없으면 앞쪽에 솟은 지형(산비탈)에 붙음
export function findAnchor(pos, heading, colliders, range, groundAt) {
  for (const side of [0, 0.35, -0.35, 0.7, -0.7]) for (const up of [0.8, 1.6, 3]) {
    ray.set(pos, dir.set(Math.sin(heading + side), up, Math.cos(heading + side)).normalize());
    let t = range;
    for (const c of colliders) t = Math.min(t, rayHit(c, ray));
    if (t < range && t >= MIN) return ray.at(t, new THREE.Vector3());
  }
  if (groundAt) for (const up of [0.8, 0.4, 0.15]) { // 지형: 3m씩 나아가며 땅속으로 들어가는 첫 지점
    ray.set(pos, dir.set(Math.sin(heading), up, Math.cos(heading)).normalize());
    for (let t = MIN; t < range; t += 3) {
      const p = ray.at(t, new THREE.Vector3());
      if (p.y < groundAt(p.x, p.z)) return p;
    }
  }
  return null;
}
