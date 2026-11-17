import assert from 'node:assert';
import { LAND, landKind, rasterize, encode, decode } from './land.js';

assert.equal(landKind({ landuse: 'forest' }), 3);
assert.equal(landKind({ leisure: 'park' }), 2);
assert.equal(landKind({ landuse: 'farmland' }), 1);
assert.equal(landKind({ building: 'yes' }), 0);

const grids = new Map(), grid = (k) => grids.get(k) ?? grids.set(k, new Uint8Array(LAND * LAND)).get(k);
// 타일 10/20의 서쪽 절반을 덮는 숲, 그 안의 구멍(가운데 1/4 크기), 그리고 경계를 넘어 동쪽 타일까지 걸친 풀밭 띠
rasterize([[[10, 20], [10.5, 20], [10.5, 21], [10, 21]], [[10.125, 20.375], [10.375, 20.375], [10.375, 20.625], [10.125, 20.625]]], 3, grid);
rasterize([[[10.75, 20], [11.25, 20], [11.25, 20.25], [10.75, 20.25]]], 2, grid);
const a = grids.get('10/20'), b = grids.get('11/20');
const count = (g, k) => g.reduce((n, v) => n + (v === k), 0);
assert.equal(count(a, 3), (LAND / 2) * LAND - (LAND / 4) ** 2, '숲에서 구멍만 빠짐');
assert.equal(count(a, 2), (LAND / 4) * (LAND / 4), '풀밭: 이 타일의 동쪽 1/4 × 북쪽 1/4');
assert.equal(count(b, 2), (LAND / 4) * (LAND / 4), '이웃 타일에도 이어서 칠함');
assert.equal(a[0], 3); assert.equal(a[LAND - 1], 2); assert.equal(a[LAND * LAND - 1], 0);
rasterize([[[10, 20], [11, 20], [11, 21], [10, 21]]], 1, grid);
assert.equal(count(a, 1), LAND * LAND - count(a, 3) - count(a, 2), '논밭은 빈 칸만 채움(숲·풀밭을 덮지 않음)');
assert.deepEqual(decode(encode(a)), a, '줄인 형식을 다시 풀면 같음');
assert.ok(encode(a).length < 400);
console.log('land ok');
