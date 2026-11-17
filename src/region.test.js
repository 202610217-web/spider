import assert from 'node:assert';
import { regionName, watchRegion } from './region.js';

assert.equal(regionName({ quarter: '사직동', borough: '종로구', city: '서울특별시', country: '대한민국' }), '서울특별시 종로구');
assert.equal(regionName({ borough: '분당구', city: '성남시', province: '경기도' }), '경기도 성남시 분당구');
assert.equal(regionName({ village: '양서면', county: '양평군', province: '경기도' }), '경기도 양평군');
assert.equal(regionName({ city: '세종특별자치시' }), '세종특별자치시');
assert.equal(regionName(undefined), '');

// 300m 이상 움직이고 10초가 지나야 다시 물어봄
const shown = [], asked = [];
const update = watchRegion((n) => shown.push(n), async (lat, lon) => { asked.push([lat, lon]); return { address: { city: '서울특별시', borough: asked.length === 1 ? '종로구' : '중구' } }; });
update(0, 0, 37.5, 127, 0);
update(500, 0, 37.5, 127.005, 1000);   // 너무 빨리
update(100, 0, 37.5, 127.001, 20000);  // 너무 가까이
await null; await null;
assert.equal(asked.length, 1);
update(500, 0, 37.5, 127.005, 20000);
await null; await null; await null;
assert.deepEqual([asked.length, shown], [2, ['서울특별시 종로구', '서울특별시 중구']]);
// 실패해도 조용히 넘어감
const quiet = watchRegion(() => assert.fail(), async () => { throw new Error('offline'); });
quiet(0, 0, 37, 127, 0);
await new Promise((r) => setTimeout(r, 5));
console.log('region ok');
