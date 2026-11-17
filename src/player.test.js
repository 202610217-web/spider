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

// 벽으로 달리면 뚫지 못하고 벽을 타고 올라 옥상에 섬
p = new Player([box]); p.pos.set(-3, R, -5);
for (let i = 0; i < 120; i++) { p.step(1 / 120, new THREE.Vector3(1, 0, 0), false); assert.ok(p.pos.x <= -R + 0.01 || p.pos.y > 30, `wall ${p.pos.x}`); }
assert.ok(p.wall && p.pos.y > 3, `climbing ${p.pos.y}`);
for (let i = 0; i < 900 && p.pos.x < 2; i++) p.step(1 / 120, new THREE.Vector3(1, 0, 0), false); // 옥상 위로 넘어갈 때까지
for (let i = 0; i < 300; i++) p.step(1 / 120, still, false);
assert.ok(p.pos.x > 0 && Math.abs(p.pos.y - (30 + R)) < 0.01 && p.onGround, `on the roof ${p.pos.x} ${p.pos.y}`);
// 벽에서 점프하면 벽 반대쪽으로 튕겨 나옴
p = new Player([box]); p.pos.set(-R, 10, -5); p.wall = new THREE.Vector3(-1, 0, 0);
p.step(1 / 120, new THREE.Vector3(1, 0, 0), true);
assert.ok(p.vel.x < -5 && p.vel.y > 5);

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

// 벽타기: 벽 반대로 당기면 붙은 채 내려가고, 가만히 있으면 매달림
p = new Player([box]); p.pos.set(-R, 15, -5); p.wall = new THREE.Vector3(-1, 0, 0); p.climbing = true;
for (let i = 0; i < 60; i++) p.step(1 / 120, new THREE.Vector3(-1, 0, 0), false);
assert.ok(p.climbing && Math.abs(p.pos.y - 11.5) < 0.1, `climbs down ${p.pos.y}`);
for (let i = 0; i < 60; i++) p.step(1 / 120, still, false);
assert.ok(p.climbing && Math.abs(p.pos.y - 11.5) < 0.1, `hangs ${p.pos.y}`);

// 달리기는 걷기보다 빠름
p = new Player([]); p.pos.set(0, R, 0); p.onGround = true;
p.step(1 / 120, new THREE.Vector3(1, 0, 0), false, { run: true });
assert.ok(p.vel.x > 10);

// 잡아당기기: 걸린 곳으로 빠르게 날아가 도착하면 속도를 유지한 채 놓음
p = new Player([]); p.pos.set(0, 20, 0);
p.zip(new THREE.Vector3(60, 40, 0));
let steps = 0;
while (p.anchor && steps++ < 600) p.step(1 / 120, still, false);
assert.ok(!p.anchor && !p.zipping && steps < 360 && p.vel.length() > 30 && p.pos.x > 50, `zip ${steps} ${p.vel.length()}`);

// 활공: 떨어지는 속도가 제한됨
p = new Player([]); p.pos.set(0, 500, 0);
for (let i = 0; i < 240; i++) p.step(1 / 120, still, false, { glide: true });
assert.ok(p.vel.y >= -4.001 && p.vel.y < -3, `glide ${p.vel.y}`);
console.log('player ok');
