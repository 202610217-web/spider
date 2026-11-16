import * as THREE from 'three';
import { pushOut } from './collide.js';

export const R = 0.5;            // 충돌 구 반지름(m)
const G = -25, WALK = 10, JUMP = 10, AIR = 8, SWING = 14, MAX_SWING = 45, MIN_ROPE = 5, CLIMB = 7;
const n = new THREE.Vector3();

export class Player {
  constructor(colliders) {
    this.colliders = colliders;  // 건물 충돌체 (collide.js)
    this.groundAt = () => 0;     // (x, z) → 땅 높이
    this.pos = new THREE.Vector3(0, 50, 0);
    this.vel = new THREE.Vector3();
    this.anchor = null;
    this.ropeLen = 0;
    this.onGround = false;
    this.wall = null;            // 지금 닿아 있는 벽의 바깥 방향(수평 단위 벡터)
  }
  attach(p) {
    this.anchor = p.clone();
    this.ropeLen = this.pos.distanceTo(p);
    if (this.onGround) this.vel.y = JUMP; // 땅에서 걸면 살짝 뛰어오름
  }
  release() {
    if (!this.anchor) return;
    this.anchor = null;
    this.vel.multiplyScalar(1.08); this.vel.y += 3; // 놓는 순간 살짝 튕겨 다음 스윙으로 잇기 쉽게
  }

  // move: 월드 xz 방향(길이 ≤1), jump: 이번 스텝 점프 여부
  step(dt, move, jump) {
    const v = this.vel;
    if (this.anchor) {           // 스윙: 줄 쪽으로 끌려가지 않고, 스틱 방향(안 밀면 지금 날아가는 방향)으로 계속 나아감
      let dx = move.x, dz = move.z;
      const hv = Math.hypot(v.x, v.z);
      if (dx * dx + dz * dz < 0.01 && hv > 1) { dx = v.x / hv; dz = v.z / hv; }
      if (hv < MAX_SWING) { v.x += dx * SWING * dt; v.z += dz * SWING * dt; }
    } else if (this.wall && move.dot(this.wall) < -0.3) {
      // 벽타기: 벽 쪽으로 밀면 중력 없이 오름. 벽과 나란한 방향 입력은 옆으로 이동, 점프는 벽을 차고 뛰어내림
      const w = this.wall, into = move.dot(w);
      if (jump) v.set(w.x * 8, JUMP, w.z * 8);
      else v.set((move.x - w.x * into) * CLIMB - w.x * 2, CLIMB - G * dt, (move.z - w.z * into) * CLIMB - w.z * 2); // -G*dt: 아래에서 더해지는 중력 상쇄, -w*2: 벽에 붙어 있게 살짝 누름
    } else if (this.onGround) {
      v.x = move.x * WALK; v.z = move.z * WALK;
      if (jump) v.y = JUMP;
    } else {
      v.x += move.x * AIR * dt; v.z += move.z * AIR * dt;
    }
    v.y += G * dt;
    this.pos.addScaledVector(v, dt);

    if (this.anchor) {
      n.subVectors(this.pos, this.anchor);
      const L = n.length();
      // 가까워지면 늘어진 줄만 감음(다시 늘어나지 않음) → 걸린 곳 밑을 지나치면 진자처럼 앞쪽 위로 떠오름
      this.ropeLen = Math.max(MIN_ROPE, Math.min(this.ropeLen, L));
      if (L > this.ropeLen) {    // 줄 길이 이상 멀어지지 않게, 바깥 방향 속도 제거
        n.divideScalar(L);
        this.pos.copy(this.anchor).addScaledVector(n, this.ropeLen);
        const out = v.dot(n);
        if (out > 0) v.addScaledVector(n, -out);
      }
    }

    this.onGround = false;
    this.wall = null;
    const g = this.groundAt(this.pos.x, this.pos.z) + R;
    if (this.pos.y < g) { this.pos.y = g; if (v.y < 0) v.y = 0; this.onGround = true; }
    for (const c of this.colliders) {
      const hit = pushOut(c, this.pos, R);
      if (!hit) continue;
      const into = v.dot(hit);
      if (into < 0) v.addScaledVector(hit, -into);
      if (hit.y > 0.7) this.onGround = true;
      else if (Math.abs(hit.y) < 0.3) this.wall = (this.wall ?? new THREE.Vector3()).set(hit.x, 0, hit.z).normalize();
    }
  }
}
