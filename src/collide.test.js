import assert from 'node:assert';
import * as THREE from 'three';
import { makeCollider, pushOut, rayHit } from './collide.js';

// 45° 돌아간 마름모 건물(꼭짓점이 동서남북 10m), 높이 30m. 외곽 상자는 20×20이지만 모서리 쪽은 비어 있음
const c = makeCollider([[10, 0], [0, 10], [-10, 0], [0, -10], [10, 0]], new THREE.Vector3(), 0, 30);
const P = (x, y, z) => new THREE.Vector3(x, y, z);

assert.equal(pushOut(c, P(8, 5, 8), 0.5), null, 'empty corner of the bounding box is passable');
let p = P(4.9, 5, -4.9);        // 벽 바로 안쪽(북동 변) → 바깥으로
assert.ok(pushOut(c, p, 0.5) && Math.abs((p.x - p.z) / Math.SQRT2 - (10 / Math.SQRT2 + 0.5)) < 1e-6, 'pushed 0.5 outside the wall');
p = P(0, 30.2, 0);              // 옥상에 살짝 박힘 → 위로
assert.ok(pushOut(c, p, 0.5).y === 1 && Math.abs(p.y - 30.5) < 1e-9, 'stands on the roof');
assert.equal(pushOut(c, P(0, 31, 0), 0.5), null);

const ray = new THREE.Ray(P(20, 5, 0), P(-1, 0, 0));
assert.ok(Math.abs(rayHit(c, ray) - 10) < 1e-9, 'hits the east corner');
ray.set(P(8, 5, 20), P(0, 0, -1));
assert.ok(Math.abs(rayHit(c, ray) - 18) < 1e-9, 'hits the slanted wall, not the bounding box');
ray.set(P(9, 20, 20), P(0, 1, -1).normalize());
assert.equal(rayHit(c, ray), Infinity, 'passes over the roof');
ray.set(P(0, 50, 0), P(0, -1, 0));
assert.ok(Math.abs(rayHit(c, ray) - 20) < 1e-9, 'roof from above');
console.log('collide ok');
