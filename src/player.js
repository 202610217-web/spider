import * as THREE from 'three';
import { pushOut } from './collide.js';

export const R = 0.5;            // 충돌 구 반지름(m)
const G = -25, WALK = 5, RUN = 11, JUMP = 10, AIR = 8, SWING = 14, MAX_SWING = 45, MIN_ROPE = 5, CLIMB = 7;
const ZIP = 50, ZIP_ACC = 90, ZIP_END = 4, GLIDE = 4;
const n = new THREE.Vector3();

export class Player {
  constructor(colliders) {
    this.colliders = colliders;  // 건물 충돌체 (collide.js)
    this.groundAt = () => 0;     // (x, z) → 땅 높이
    this.pos = new THREE.Vector3(0, 50, 0);
    this.vel = new THREE.Vector3();
    this.anchor = null;
    this.ropeLen = 0;
    this.zipping = false;        // 잡아당기기 중
    this.onGround = false;
    this.wall = null;            // 지금 닿아 있는 벽의 바깥 방향(수평 단위 벡터)
    this.climbing = false;
  }
  attach(p) {
    this.anchor = p.clone();
    this.ropeLen = this.pos.distanceTo(p);
    this.zipping = false;
    if (this.onGround) this.vel.y = JUMP; // 땅에서 걸면 살짝 뛰어오름
  }
  // 잡아당기기: p에 걸고(이미 걸려 있으면 p 없이) 그쪽으로 빠르게 날아감
  zip(p) {
    if (p) this.attach(p);
    this.zipping = !!this.anchor;
  }
  release() {
    if (!this.anchor) return;
    this.anchor = null;
    if (!this.zipping) { this.vel.multiplyScalar(1.08); this.vel.y += 3; } // 놓는 순간 살짝 튕겨 다음 스윙으로 잇기 쉽게
    this.zipping = false;
  }

  // move: 월드 xz 방향(길이 ≤1), jump: 이번 스텝 점프 여부, run: 달리기, glide: 활공(공중에서 천천히 하강)
  step(dt, move, jump, { run = false, glide = false } = {}) {
    const v = this.vel;
    let gravity = G;
    if (this.zipping && this.pos.distanceTo(this.anchor) < ZIP_END) this.release(); // 다 왔으면 속도를 유지한 채 놓음
    const into = this.wall ? move.dot(this.wall) : 0; // 벽 쪽으로 밀면 음수
    if (this.zipping) {
      n.subVectors(this.anchor, this.pos).normalize();
      v.addScaledVector(n, ZIP_ACC * dt).clampLength(0, ZIP);
      gravity = 0;
    } else if (this.anchor) {    // 스윙: 줄 쪽으로 끌려가지 않고, 스틱 방향(안 밀면 지금 날아가는 방향)으로 계속 나아감
      let dx = move.x, dz = move.z;
      const hv = Math.hypot(v.x, v.z);
      if (dx * dx + dz * dz < 0.01 && hv > 1) { dx = v.x / hv; dz = v.z / hv; }
      if (hv < MAX_SWING) { v.x += dx * SWING * dt; v.z += dz * SWING * dt; }
    } else if ((this.climbing = !!this.wall && (this.climbing || into < -0.3) && !(this.onGround && into > -0.3))) { // 땅에서는 벽 쪽으로 밀 때만 매달림
      // 벽타기: 벽 쪽으로 밀면 오르고 반대로 당기면 내려감, 나란한 입력은 옆으로, 가만히 있으면 매달림. 점프는 벽을 차고 뛰어내림
      const w = this.wall;
      if (jump) { v.set(w.x * 8, JUMP, w.z * 8); this.climbing = false; }
      else { v.set((move.x - w.x * into) * CLIMB - w.x * 2, -into * CLIMB, (move.z - w.z * into) * CLIMB - w.z * 2); gravity = 0; } // -w*2: 벽에 붙어 있게 살짝 누름
    } else if (this.onGround) {
      const s = run ? RUN : WALK;
      v.x = move.x * s; v.z = move.z * s;
      if (jump) v.y = JUMP;
    } else {
      v.x += move.x * AIR * dt; v.z += move.z * AIR * dt;
    }
    v.y += gravity * dt;
    if (glide && !this.anchor && !this.onGround && !this.climbing && v.y < -GLIDE) v.y = -GLIDE;
    this.pos.addScaledVector(v, dt);

    if (this.anchor && !this.zipping) {
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
      const d = v.dot(hit);
      if (d < 0) v.addScaledVector(hit, -d);
      if (hit.y > 0.7) this.onGround = true;
      else if (Math.abs(hit.y) < 0.3) this.wall = (this.wall ?? new THREE.Vector3()).set(hit.x, 0, hit.z).normalize();
    }
  }
}
