import assert from 'node:assert';
import { addRibbon } from './roads.js';
const pos = [], idx = [];
addRibbon(pos, idx, [[0, 0], [10, 0]], 4); // 동쪽으로 뻗은 폭 4m 도로
assert.deepEqual(pos.map((v) => v + 0), [0, 0, -2, 0, 0, 2, 10, 0, -2, 10, 0, 2]);
assert.deepEqual(idx, [0, 1, 2, 1, 3, 2]);
addRibbon(pos, idx, [[0, 0], [0, 5], [5, 5]], 2);
assert.equal(pos.length, 30); assert.equal(idx.length, 18); assert.equal(Math.max(...idx), 9);
console.log('roads ok');
