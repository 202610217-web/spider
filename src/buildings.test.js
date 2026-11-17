import assert from 'node:assert';
import { buildingGeometries } from './buildings.js';

const sq = (x) => [[x, 0], [x + 12, 0], [x + 12, 9], [x, 9], [x, 0]];
const { walls, roof } = buildingGeometries([{ h: 30, s: 1, ring: sq(0) }, { h: 9, s: 0, ring: sq(50) }, { h: 20, ring: sq(100) }], () => 5, 8);
const used = walls.map((g, k) => g && [k, g.attributes.position.count]).filter(Boolean);
assert.equal(used.reduce((a, [, n]) => a + n, 0), 72, '건물 3개 × 벽 4면 × 삼각형 2개');
for (const [k] of used) assert.ok(walls[k].attributes.uv.count === walls[k].attributes.position.count);
assert.equal(roof.attributes.position.count, 36, '건물 3개의 위아래 뚜껑');
const tall = used.find(([k]) => { walls[k].computeBoundingBox(); return walls[k].boundingBox.max.y === 35; });
assert.ok(tall && walls[tall[0]].boundingBox.min.y === -3, '바닥 5 - sink 8, 꼭대기 5 + 30');
const small = used.find(([k]) => walls[k].boundingBox.max.y === 14)[0];
const uv = walls[small].attributes.uv; let vmin = Infinity, vmax = -Infinity;
for (let i = 0; i < uv.count; i++) { vmin = Math.min(vmin, uv.getY(i)); vmax = Math.max(vmax, uv.getY(i)); }
assert.ok(Math.abs(vmax - vmin - (9 + 8) / 3) < 1e-4, `창 무늬가 3m마다 반복: ${vmax - vmin}`);

// 경사 지붕: 전통 건물(5)·공장(4)의 사각형 바닥 → 용마루가 h, 벽은 처마까지
const g = buildingGeometries([{ h: 6, s: 5, ring: sq(0) }, { h: 8, s: 4, ring: sq(50) }, { h: 6, s: 5, ring: [[0, 0], [9, 0], [9, 9], [4, 12], [0, 9], [0, 0]] }], () => 0, 8);
assert.equal(g.pitched[0].attributes.position.count, 18, '사각형 전통 건물 하나만 기와지붕 (경사면 4 + 박공 2 삼각형)');
assert.equal(g.pitched[1].attributes.position.count, 18);
g.pitched[0].computeBoundingBox();
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

// 유형마다 디자인 3가지가 고르게 나오고, 같은 건물은 늘 같은 디자인
const kinds = (b) => buildingGeometries(b, () => 0, 8).walls.map((g, k) => g && k).filter((k) => k !== undefined);
for (let t = 0; t < 6; t++) {
  const seen = new Set();
  for (let i = 0; i < 60; i++) seen.add(kinds([{ h: 12, s: t, ring: sq(i * 37.3) }]).join());
  assert.equal(seen.size, 3, `유형 ${t}의 디자인 수: ${[...seen]}`);
}
assert.deepEqual(kinds([{ h: 12, s: 1, ring: sq(123) }]), kinds([{ h: 12, s: 1, ring: sq(123) }]));
// 건물 부분: 바닥이 m만큼 떠 있고(min_height), 피라미드·돔 지붕은 꼭대기가 h, 아무 바닥 모양에도 생김
const hex = [[10, 0], [5, 8.7], [-5, 8.7], [-10, 0], [-5, -8.7], [5, -8.7], [10, 0]];
const tower = buildingGeometries([{ h: 120, s: 3, ring: hex, m: 80, p: 3 }, { h: 20, s: 2, ring: sq(50), p: 2 }], () => 5, 8);
tower.walls.forEach((g) => g && g.computeBoundingBox());
const wallsBox = tower.walls.find((g) => g && g.boundingBox.min.y > 50).boundingBox;
assert.ok(Math.abs(wallsBox.min.y - 85) < 1e-6, `떠 있는 부분의 벽은 땅 + 80m에서 시작 ${wallsBox.min.y}`);
tower.pitched[1].computeBoundingBox();
assert.ok(Math.abs(tower.pitched[1].boundingBox.max.y - 125) < 1e-6, `돔·피라미드 꼭대기 = 땅 + h ${tower.pitched[1].boundingBox.max.y}`);
assert.equal(tower.pitched[1].attributes.position.count, (6 * 4 + 4 * 1) * 6, '돔은 변마다 네 띠, 피라미드는 한 띠 (띠마다 삼각형 2개)');
console.log('buildings ok');
