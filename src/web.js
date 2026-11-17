import * as THREE from 'three';
import { rayHit } from './collide.js';

const ray = new THREE.Ray(), dir = new THREE.Vector3();
const MIN = 6; // 이보다 가까운 벽은 스윙이 안 되므로 건너뜀
const SKY_UP = 1.2, SKY_DIST = 40, SKY_CLEAR = 12; // 허공에 걸 때: 앞쪽 위 약 50° 방향 40m, 땅에서 최소 12m 위

// 거미줄을 걸 지점 찾기: heading(진행 방향, atan2(x, z)) 앞쪽 위로 정면부터 좌우·각도를 넓혀가며 처음 닿는 건물 벽
// 충돌체에 붙으므로 충돌과 일치하고 메시 레이캐스트보다 빠름. 건물이 없으면 앞쪽에 솟은 지형(산비탈)에,
// 그것도 없으면 앞쪽 위 허공의 한 점에 걸어 어디서든 스윙할 수 있게 함 (항상 지점을 돌려줌)
export function findAnchor(pos, heading, colliders, range, groundAt = () => 0) {
  for (const side of [0, 0.35, -0.35, 0.7, -0.7]) for (const up of [0.8, 1.6, 3]) {
    ray.set(pos, dir.set(Math.sin(heading + side), up, Math.cos(heading + side)).normalize());
    let t = range;
    for (const c of colliders) t = Math.min(t, rayHit(c, ray));
    if (t < range && t >= MIN) return ray.at(t, new THREE.Vector3());
  }
  for (const up of [0.8, 0.4, 0.15]) { // 지형: 3m씩 나아가며 땅속으로 들어가는 첫 지점
    ray.set(pos, dir.set(Math.sin(heading), up, Math.cos(heading)).normalize());
    for (let t = MIN; t < range; t += 3) {
      const p = ray.at(t, new THREE.Vector3());
      if (p.y < groundAt(p.x, p.z)) return p;
    }
  }
  const p = ray.set(pos, dir.set(Math.sin(heading), SKY_UP, Math.cos(heading)).normalize()).at(SKY_DIST, new THREE.Vector3());
  p.y = Math.max(p.y, groundAt(p.x, p.z) + SKY_CLEAR); // 오르막 앞에서도 줄이 땅에 묻히지 않게
  return p;
}
