import assert from 'node:assert';
import * as THREE from 'three';
import { findAnchor } from './web.js';
import { makeCollider } from './collide.js';

const tower = makeCollider([[-5, -20], [5, -20], [5, -30], [-5, -30], [-5, -20]], new THREE.Vector3(), 0, 80); // +z 방향 20m 앞
const pos = new THREE.Vector3(0, 1, 0);
const a = findAnchor(pos, 0, [tower], 150);
assert.ok(a && Math.abs(a.z - 20) < 1e-6 && a.y > 10, 'hits the facing wall above the player');
assert.equal(findAnchor(pos, Math.PI, [tower], 150), null, 'nothing behind');
assert.equal(findAnchor(pos, 0, [tower], 10), null, 'out of range');
console.log('web ok');
