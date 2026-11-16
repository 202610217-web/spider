import * as THREE from 'three';

const ray = new THREE.Ray(), dir = new THREE.Vector3(), hit = new THREE.Vector3();
const MIN = 6; // 이보다 가까운 벽은 스윙이 안 되므로 건너뜀

// 거미줄을 걸 지점 찾기: heading(진행 방향, atan2(x, z)) 앞쪽 위로 정면부터 좌우·각도를 넓혀가며 첫 건물 박스
// 충돌 박스에 붙으므로 충돌과 일치하고 메시 레이캐스트보다 빠름. 땅에는 붙지 않음
export function findAnchor(pos, heading, boxes, range) {
  for (const side of [0, 0.35, -0.35, 0.7, -0.7]) for (const up of [0.8, 1.6, 3]) {
    ray.set(pos, dir.set(Math.sin(heading + side), up, Math.cos(heading + side)).normalize());
    let best = null, bd = range;
    for (const b of boxes) {
      if (!ray.intersectBox(b, hit)) continue;
      const d = hit.distanceTo(pos);
      if (d < bd) { bd = d; best = best ?? new THREE.Vector3(); best.copy(hit); }
    }
    if (best && bd >= MIN) return best;
  }
  return null;
}
