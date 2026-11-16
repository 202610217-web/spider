import assert from 'node:assert';
import { buildingHeight as h } from './height.js';
assert.equal(h({ height: '25 m', 'building:levels': '3' }), 25);
assert.equal(h({ 'building:levels': '4' }), 12);
assert.equal(h({ height: 'abc' }), 10);
assert.equal(h({}), 10);
console.log('height ok');
