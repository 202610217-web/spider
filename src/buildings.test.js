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
console.log('buildings ok');
