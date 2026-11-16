import assert from 'node:assert';
import { addRibbon, densify } from './roads.js';
const pos = [], idx = [];
addRibbon(pos, idx, [[0, 0], [10, 0]], 4); // 동쪽으로 뻗은 폭 4m 도로
assert.deepEqual(pos.map((v) => v + 0), [0, 0, -2, 0, 0, 0, 0, 0, 2, 10, 0, -2, 10, 0, 0, 10, 0, 2]);
assert.deepEqual(idx, [0, 1, 3, 1, 4, 3, 1, 2, 4, 2, 5, 4]);
addRibbon(pos, idx, [[0, 0], [0, 5], [5, 5]], 2);
assert.equal(pos.length, 45); assert.equal(idx.length, 36); assert.equal(Math.max(...idx), 14);
assert.deepEqual(densify([[0, 0], [10, 0], [10, 3]], 4), [[0, 0], [10 / 3, 0], [20 / 3, 0], [10, 0], [10, 3]]);
console.log('roads ok');
