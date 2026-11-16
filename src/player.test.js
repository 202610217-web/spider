import assert from 'node:assert';
import * as THREE from 'three';
import { Player, ringToBox, R } from './player.js';

const box = ringToBox([[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], 30);
assert.deepEqual([box.min.toArray(), box.max.toArray()], [[0, 0, -10], [10, 30, 0]]);

const still = new THREE.Vector3();
// 지붕 위로 떨어지면 지붕에 착지
let p = new Player([box]); p.pos.set(5, 40, -5);
for (let i = 0; i < 600; i++) p.step(1 / 120, still, false);
assert.ok(Math.abs(p.pos.y - (30 + R)) < 0.01 && p.onGround, `roof ${p.pos.y}`);

// 벽으로 달려도 뚫지 못함
p = new Player([box]); p.pos.set(-3, R, -5);
for (let i = 0; i < 600; i++) p.step(1 / 120, new THREE.Vector3(1, 0, 0), false);
assert.ok(p.pos.x <= -R + 0.01, `wall ${p.pos.x}`);

// 로프 길이를 넘지 않음
p = new Player([]); p.pos.set(20, 30, 0); p.attach(new THREE.Vector3(0, 50, 0));
for (let i = 0; i < 240; i++) { p.step(1 / 120, still, false); assert.ok(p.pos.distanceTo(p.anchor) <= p.ropeLen + 1e-6); }
assert.ok(p.pos.x < 20, 'swings toward center');
console.log('player ok');
