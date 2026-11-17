import assert from 'node:assert';
import * as THREE from 'three';
import { createHero, heroState } from './hero.js';

const P = (o) => ({ vel: new THREE.Vector3(), pos: new THREE.Vector3(), anchor: null, zipping: false, climbing: false, onGround: false, ...o });
const v = (x, y, z) => new THREE.Vector3(x, y, z);

assert.equal(heroState(P({ onGround: true })), 'idle');
assert.equal(heroState(P({ onGround: true, vel: v(5, 0, 0) })), 'run');
assert.equal(heroState(P({ anchor: v(0, 30, 0) })), 'swing');
assert.equal(heroState(P({ anchor: v(0, 30, 0), zipping: true })), 'zip');
assert.equal(heroState(P({ climbing: true })), 'climb');
assert.equal(heroState(P({ climbing: true, vel: v(7, 1, 0) })), 'wallrun');
assert.equal(heroState(P({ vel: v(0, -5, 0) }), true), 'glide');
assert.equal(heroState(P({ vel: v(0, -5, 0) }), false), 'air');

// 모든 상태에서 자세 값이 유한하고, 발이 충돌 구 바닥(-0.5) 근처, 머리가 1.3 근처(키 1.8m)
const hero = createHero();
const box = new THREE.Box3().setFromObject(hero);
assert.ok(Math.abs(box.min.y + 0.5) < 0.1 && Math.abs(box.max.y - 1.3) < 0.1, `키 ${box.min.y} ~ ${box.max.y}`);
const hand = v();
for (const p of [P({ onGround: true, vel: v(0, 0, 11) }), P({ climbing: true, vel: v(0, 7, 0) }), P({ climbing: true, wall: v(1, 0, 0), vel: v(0, 0, 7) }), P({ vel: v(0, 8, 5) }), P({ vel: v(0, -30, 20) }), P({ anchor: v(0, 30, 40), zipping: true }), P({ anchor: v(3, 30, 10), vel: v(0, -10, 30) })]) {
  for (let i = 0; i < 120; i++) hero.animate(p, 1 / 60, true);
  hero.traverse((o) => assert.ok([o.rotation.x, o.rotation.z, o.position.y].every(Number.isFinite)));
}
// 놓기 묘기 3종과 착지 구르기 도중에도 값이 유한
for (let t = 0; t < 3; t++) for (const p of [P({ anchor: v(0, 30, 10), vel: v(0, 0, 30) }), P({ vel: v(0, -20, 30) }), P({ onGround: true, vel: v(0, 0, 11) })]) {
  for (let i = 0; i < 5; i++) hero.animate(p, 1 / 60, false);
  hero.traverse((o) => assert.ok(o.rotation.toArray().slice(0, 3).every(Number.isFinite)));
}
for (let i = 0; i < 120; i++) hero.animate(P({ anchor: v(3, 30, 10), vel: v(0, -10, 30) }), 1 / 60, true);
// 스윙: 쥔 손이 머리 위로, 걸린 곳 쪽(앞)으로 뻗음
hero.hand.getWorldPosition(hand);
assert.ok(hand.y > 0.9 && hand.z > 0, `스윙 손 위치 ${hand.toArray()}`);
console.log('hero ok');
