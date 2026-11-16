import * as THREE from 'three';

export const R = 0.5;            // 충돌 구 반지름(m)
const G = -25, WALK = 10, JUMP = 10, AIR = 8, REEL = 6, MIN_ROPE = 5;
const tmp = new THREE.Vector3(), n = new THREE.Vector3();

export class Player {
  constructor(boxes) {
    this.boxes = boxes;          // THREE.Box3[] — 건물 박스 충돌
    this.pos = new THREE.Vector3(0, 50, 0);
    this.vel = new THREE.Vector3();
    this.anchor = null;
    this.ropeLen = 0;
    this.onGround = false;
  }
  attach(p) { this.anchor = p.clone(); this.ropeLen = this.pos.distanceTo(p); }
  release() { this.anchor = null; }

  // move: 월드 xz 방향(길이 ≤1), jump: 이번 스텝 점프 여부
  step(dt, move, jump) {
    const v = this.vel;
    if (this.onGround && !this.anchor) {
      v.x = move.x * WALK; v.z = move.z * WALK;
      if (jump) v.y = JUMP;
    } else {
      v.x += move.x * AIR * dt; v.z += move.z * AIR * dt;
    }
    v.y += G * dt;
    this.pos.addScaledVector(v, dt);

    if (this.anchor) {           // 로프: 길이 이상 멀어지지 않게, 바깥 방향 속도 제거
      this.ropeLen = Math.max(MIN_ROPE, this.ropeLen - REEL * dt);
      n.subVectors(this.pos, this.anchor);
      const L = n.length();
      if (L > this.ropeLen) {
        n.divideScalar(L);
        this.pos.copy(this.anchor).addScaledVector(n, this.ropeLen);
        const out = v.dot(n);
        if (out > 0) v.addScaledVector(n, -out);
      }
    }

    this.onGround = false;
    if (this.pos.y < R) { this.pos.y = R; if (v.y < 0) v.y = 0; this.onGround = true; }
    for (const b of this.boxes) this.collide(b);
  }

  collide(b) {
    const p = this.pos;
    if (p.x < b.min.x - R || p.x > b.max.x + R || p.y < b.min.y - R || p.y > b.max.y + R || p.z < b.min.z - R || p.z > b.max.z + R) return;
    b.clampPoint(p, tmp);
    n.subVectors(p, tmp);
    let d = n.length();
    if (d >= R) return;
    if (d === 0) {               // 중심이 박스 안: 가장 얕은 면으로 밀어냄
      const pen = [p.x - b.min.x, b.max.x - p.x, p.y - b.min.y, b.max.y - p.y, p.z - b.min.z, b.max.z - p.z];
      const i = pen.indexOf(Math.min(...pen));
      n.set(0, 0, 0).setComponent(i >> 1, i & 1 ? 1 : -1);
      d = -pen[i];
    } else n.divideScalar(d);
    p.addScaledVector(n, R - d);
    const into = this.vel.dot(n);
    if (into < 0) this.vel.addScaledVector(n, -into);
    if (n.y > 0.7) this.onGround = true;
  }
}

// 건물 바닥 링(원점 기준 x, 북쪽 y) + 높이 → 박스 충돌체
// shortcut: ㄱ자·중정형 건물도 외곽 AABB 하나로 처리, 빈 공간 충돌이 거슬리면 볼록 분할로 교체
export function ringToBox(ring, h) {
  const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
  return new THREE.Box3(
    new THREE.Vector3(Math.min(...xs), 0, -Math.max(...ys)),
    new THREE.Vector3(Math.max(...xs), h, -Math.min(...ys)),
  );
}
