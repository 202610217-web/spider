import assert from 'node:assert';
import * as THREE from 'three';
import { Player, R } from './player.js';
import { makeCollider } from './collide.js';

const box = makeCollider([[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], new THREE.Vector3(), 0, 30); // x 0~10, z -10~0
const still = new THREE.Vector3();
// 지붕 위로 떨어지면 지붕에 착지
let p = new Player([box]); p.pos.set(5, 40, -5);
for (let i = 0; i < 600; i++) p.step(1 / 120, still, false);
assert.ok(Math.abs(p.pos.y - (30 + R)) < 0.01 && p.onGround, `roof ${p.pos.y}`);

// 벽으로 달려도 뚫지 못함
p = new Player([box]); p.pos.set(-3, R, -5);
for (let i = 0; i < 600; i++) p.step(1 / 120, new THREE.Vector3(1, 0, 0), false);
assert.ok(p.pos.x <= -R + 0.01, `wall ${p.pos.x}`);

// 땅 높이를 따름
p = new Player([]); p.groundAt = () => 20; p.pos.set(0, 5, 0);
p.step(1 / 120, still, false);
assert.ok(Math.abs(p.pos.y - (20 + R)) < 1e-9 && p.onGround);

// 스윙: 줄 길이를 넘지 않고, 걸린 곳(앞쪽 위)을 지나 앞으로 나아가며 땅에서 떠오름
p = new Player([]); p.pos.set(0, R, 0); p.onGround = true;
p.attach(new THREE.Vector3(30, 40, 0));
let maxY = 0;
for (let i = 0; i < 600; i++) {
  p.step(1 / 120, new THREE.Vector3(1, 0, 0), false);
  assert.ok(p.pos.distanceTo(p.anchor) <= p.ropeLen + 1e-6);
  maxY = Math.max(maxY, p.pos.y);
}
assert.ok(p.pos.x > 40, `went past the anchor: ${p.pos.x}`);
assert.ok(maxY > 8, `lifted off: ${maxY}`);
console.log('player ok');
