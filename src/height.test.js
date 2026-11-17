import assert from 'node:assert';
import { buildingHeight as h } from './height.js';
assert.equal(h({ height: '25 m', 'building:levels': '3' }), 25);
assert.equal(h({ 'building:levels': '4' }), 12);
assert.equal(h({ building: 'apartments' }), 45);
assert.equal(h({ building: 'apartments', 'building:levels': '5' }), 15);
// 정보가 없는 건물: 자리마다 15~20m의 정수, 같은 자리는 늘 같음, 자리가 다르면 고르게 섞임
const seen = new Map();
for (let i = 0; i < 3000; i++) {
  const p = [27940 + i * 0.0137, 12688 + i * 0.0071], v = h({ building: 'yes' }, undefined, p);
  assert.ok(Number.isInteger(v) && v >= 15 && v <= 20, `${v}`);
  assert.equal(h({ building: 'yes' }, undefined, [...p]), v);
  seen.set(v, (seen.get(v) ?? 0) + 1);
}
assert.equal(seen.size, 6); for (const n of seen.values()) assert.ok(n > 300, `고르게: ${[...seen]}`);
assert.ok([15, 16, 17, 18, 19, 20].includes(h({ height: 'abc' })));
// 넓이를 넘기면(Overture 건물) 바닥 넓이로
assert.equal(h({ building: 'yes' }, 119), 6);
assert.equal(h({ building: 'yes' }, 120), 12);
assert.equal(h({ building: 'yes' }, 499), 12);
assert.equal(h({ building: 'yes' }, 500), 20);
assert.equal(h({ building: 'apartments' }, 80), 45, '종류가 있으면 넓이보다 종류');
assert.equal(h({ building: 'yes', 'building:levels': '2' }, 900), 6, '층수가 있으면 층수');
console.log('height ok');
