import * as THREE from 'three';
import { pushOut } from './collide.js';

export const R = 0.5;            // 충돌 구 반지름(m)
const G = -25, WALK = 5, RUN = 11, JUMP = 10, AIR = 8, SWING = 14, MAX_SWING = 45, MIN_ROPE = 5, CLIMB = 7;
const ZIP = 50, ZIP_ACC = 90, ZIP_END = 4;
const SINK = 10, DIVE = 12, FLARE = 5, GLIDE_RATIO = 1.5, DRAG = 3, STEER = 1.2; // 활공: 기본 하강 10m/s, 앞으로 밀면 +12, 당기면 -5
const n = new THREE.Vector3();

export class Player {
  constructor(colliders) {
    this.colliders = colliders;  // 건물 충돌체 (collide.js)
    this.groundAt = () => 0;     // (x, z, 내 높이) → 땅 높이
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
    this.zipping = false;
  }

  // move: 월드 xz 방향(길이 ≤1), jump: 이번 스텝 점프 여부, run: 달리기, glide: 활공(공중에서 느리게 떨어지며 조종)
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
      // 줄에 매달려 내려가는 아래쪽 구간에서만 힘을 보탬(그네를 구르듯). 위쪽에서는 중력만 받아 끝없이 떠오르지 않음
      if (hv < MAX_SWING && this.pos.y < this.anchor.y - this.ropeLen * 0.5) { v.x += dx * SWING * dt; v.z += dz * SWING * dt; }
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
    if (glide && !this.anchor && !this.onGround && !this.climbing && v.y < 0) {
      // 활공(스카이다이빙): 공기 저항으로 하강 속도가 줄고 그만큼 앞으로 나아감. 스틱으로 방향을 조금씩 틀고, 진행 방향으로 밀면 급강하·당기면 버팀
      const hv = Math.hypot(v.x, v.z), f = hv > 1 ? (move.x * v.x + move.z * v.z) / hv : 0;
      const sink = SINK + f * (f > 0 ? DIVE : FLARE);
      if (v.y < -sink) v.y += (-sink - v.y) * Math.min(1, DRAG * dt) - G * dt; // 목표 속도보다 빠르면 저항이 중력을 이기고 남는 속도를 줄임
      let dx = move.x, dz = move.z;
      if (dx * dx + dz * dz < 0.01 && hv > 1) { dx = v.x / hv; dz = v.z / hv; } // 안 밀면 가던 방향 그대로
      const k = Math.min(1, STEER * dt), s = sink * GLIDE_RATIO;
      v.x += (dx * s - v.x) * k; v.z += (dz * s - v.z) * k;
    }
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
    const g = this.groundAt(this.pos.x, this.pos.z, this.pos.y) + R; // 높이도 넘김: 다리 위에 있을 때만 다리 상판을 땅으로 봄
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
