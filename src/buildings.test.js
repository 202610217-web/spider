import assert from 'node:assert';
import { buildingGeometries } from './buildings.js';

const sq = (x) => [[x, 0], [x + 12, 0], [x + 12, 9], [x, 9], [x, 0]];
const { walls, roof } = buildingGeometries([{ h: 30, s: 1, ring: sq(0) }, { h: 9, s: 0, ring: sq(50) }, { h: 20, ring: sq(100) }], () => 5, 8);
assert.ok(walls[0] && walls[1] && !walls[2] && !walls[3], 'villa → 작은 창, apartment와 종류 없음 → 띠창');
assert.equal(walls[0].attributes.position.count, 24, '벽 4면 × 삼각형 2개');
assert.equal(walls[1].attributes.position.count, 48);
assert.equal(roof.attributes.position.count, 36, '건물 3개의 위아래 뚜껑');
assert.equal(walls[1].attributes.uv.count, 48);
walls[1].computeBoundingBox();
assert.deepEqual([walls[1].boundingBox.min.y, walls[1].boundingBox.max.y], [-3, 35], '바닥 5 - sink 8, 꼭대기 5 + 30');
const uv = walls[0].attributes.uv; let vmin = Infinity, vmax = -Infinity;
for (let i = 0; i < uv.count; i++) { vmin = Math.min(vmin, uv.getY(i)); vmax = Math.max(vmax, uv.getY(i)); }
assert.ok(Math.abs(vmax - vmin - (9 + 8) / 3) < 1e-4, `창 무늬가 3m마다 반복: ${vmax - vmin}`);

// 경사 지붕: 전통 건물(5)·공장(4)의 사각형 바닥 → 용마루가 h, 벽은 처마까지
const g = buildingGeometries([{ h: 6, s: 5, ring: sq(0) }, { h: 8, s: 4, ring: sq(50) }, { h: 6, s: 5, ring: [[0, 0], [9, 0], [9, 9], [4, 12], [0, 9], [0, 0]] }], () => 0, 8);
assert.equal(g.pitched[0].attributes.position.count, 18, '사각형 전통 건물 하나만 기와지붕 (경사면 4 + 박공 2 삼각형)');
assert.equal(g.pitched[1].attributes.position.count, 18);
g.pitched[0].computeBoundingBox(); g.walls[3].computeBoundingBox();
assert.equal(g.pitched[0].boundingBox.max.y, 6, '용마루 = 건물 높이');
assert.ok(Math.abs(g.pitched[0].boundingBox.min.y - (6 - 2.4)) < 1e-6, '처마 = h - min(9 × 0.35, 3, h × 0.4)');
const nor = g.pitched[0].attributes.normal;
for (let i = 0; i < nor.count; i++) assert.ok(nor.getY(i) >= -1e-9, '지붕 면은 위를 봄');
assert.ok(!walls.signs && !g.signs);

// 간판: 상가(2)의 긴 벽에만, 2·3층 창 사이(바닥 + 4m, + 7m)에
const shop = buildingGeometries([{ h: 12, s: 2, ring: [[0, 0], [40, 0], [40, 20], [0, 20], [0, 0]] }, { h: 12, s: 2, ring: [[100, 0], [100, 20], [140, 20], [140, 0], [100, 0]] }], () => 5, 8).signs;
assert.ok(shop && shop.attributes.position.count % 6 === 0 && shop.attributes.position.count === shop.attributes.uv.count);
shop.computeBoundingBox();
const bb = shop.boundingBox;
assert.ok(Math.abs(bb.min.y - (5 + 4 - 0.55)) < 1e-6 && Math.abs(bb.max.y - (5 + 7 + 0.55)) < 1e-6, `간판 높이 ${bb.min.y} ~ ${bb.max.y}`);
assert.ok(bb.min.x < -0.1 && bb.max.x > 140.1, '간판은 벽 바깥쪽');
assert.ok(bb.min.x >= -0.13 && bb.max.x <= 140.13 && bb.min.z >= -20.13 && bb.max.z <= 0.13, '벽에서 12cm만 나옴 (시계·반시계 방향 링 모두 바깥쪽)');
console.log('buildings ok');
