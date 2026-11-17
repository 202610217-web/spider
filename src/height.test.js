import assert from 'node:assert';
import { buildingHeight as h } from './height.js';
assert.equal(h({ height: '25 m', 'building:levels': '3' }), 25);
assert.equal(h({ 'building:levels': '4' }), 12);
assert.equal(h({ height: 'abc' }), 20);
assert.equal(h({}), 20);
assert.equal(h({ building: 'apartments' }), 45);
assert.equal(h({ building: 'apartments', 'building:levels': '5' }), 15);
assert.equal(h({ building: 'yes' }), 20);
// 넓이를 넘기면(Overture 건물) 바닥 넓이로
assert.equal(h({ building: 'yes' }, 119), 6);
assert.equal(h({ building: 'yes' }, 120), 12);
assert.equal(h({ building: 'yes' }, 499), 12);
assert.equal(h({ building: 'yes' }, 500), 20);
assert.equal(h({ building: 'apartments' }, 80), 45, '종류가 있으면 넓이보다 종류');
assert.equal(h({ building: 'yes', 'building:levels': '2' }, 900), 6, '층수가 있으면 층수');
console.log('height ok');
