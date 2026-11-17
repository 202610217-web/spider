import assert from 'node:assert';
import * as THREE from 'three';
import { findAnchor } from './web.js';
import { makeCollider } from './collide.js';

const tower = makeCollider([[-5, -20], [5, -20], [5, -30], [-5, -30], [-5, -20]], new THREE.Vector3(), 0, 80); // +z 방향 20m 앞
const pos = new THREE.Vector3(0, 1, 0);
const a = findAnchor(pos, 0, [tower], 150);
assert.ok(a && Math.abs(a.z - 20) < 1e-6 && a.y > 10, 'hits the facing wall above the player');
// 건물이 없거나 사거리 밖이면 진행 방향 앞쪽 위 허공에 걸림
const sky = findAnchor(pos, Math.PI, [tower], 150);
assert.ok(sky.z < -20 && sky.y > 25 && Math.abs(sky.distanceTo(pos) - 40) < 1e-6, 'sky anchor ahead and above');
assert.ok(findAnchor(pos, 0, [tower], 10).z > 21, 'out of range → sky, not the wall');
const slope = (x, z) => Math.max(0, z - 20) * 2; // 20m 앞부터 가파르게 솟는 비탈
const g = findAnchor(pos, 0, [], 80, slope);
assert.ok(g && g.z > 20 && g.y > 1 && g.y <= slope(g.x, g.z), 'attaches to the hillside');
console.log('web ok');
