import * as THREE from 'three';
import { pushOut } from './collide.js';

export const R = 0.5;            // 충돌 구 반지름(m)
const G = -25, WALK = 10, JUMP = 10, AIR = 8, SWING = 14, MAX_SWING = 45, MIN_ROPE = 5;
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
    const g = this.groundAt(this.pos.x, this.pos.z) + R;
    if (this.pos.y < g) { this.pos.y = g; if (v.y < 0) v.y = 0; this.onGround = true; }
    for (const c of this.colliders) {
      const hit = pushOut(c, this.pos, R);
      if (!hit) continue;
      const into = v.dot(hit);
      if (into < 0) v.addScaledVector(hit, -into);
      if (hit.y > 0.7) this.onGround = true;
    }
  }
}
