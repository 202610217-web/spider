import assert from 'node:assert';
import { street, nearestRoad, along } from './street.js';
import { clipRing } from './clip.js';
import { offset } from './roads.js';

const roads = [{ w: 14, line: [[0, 0], [100, 0]] }, { w: 6, line: [[50, -50], [50, 50]] }];
assert.deepEqual(offset([[0, 0], [10, 0]], 2), [[0, 2], [10, 2]], '동쪽으로 가는 길의 왼쪽은 북쪽');
const n = nearestRoad(roads, 30, 3);
assert.ok(n.d === 3 && n.w === 14 && n.ang === 0);
assert.equal(nearestRoad([], 0, 0).d, Infinity);

const s = street(roads, [[30, 0, 0, 14]], () => 10);
assert.equal(s.trees.length, (Math.ceil(100 / 24) + 1) * 2, '넓은 길만 양쪽에 가로수');
assert.ok(s.trees.every(([, y]) => Math.abs(Math.abs(y) - 8.6) < 1e-9), '가로수는 길 가장자리에서 1.6m 밖');
assert.ok(s.walk.idx.length && s.yellow.idx.length && s.white.idx.length);
for (const g of [s.walk, s.white, s.yellow]) assert.ok(Math.max(...g.idx) < g.pos.length / 3 && g.pos.every(Number.isFinite));
const whiteNoCross = street(roads, [], () => 10).white.pos.length;
assert.equal((s.white.pos.length - whiteNoCross) / 18, 14, '폭 14m → 횡단보도 줄 14개');

// 다리: 상판 높이 함수를 가진 도로는 인도·차선이 그 높이를 따르고 가로수가 없음
const br = street([{ w: 14, line: [[0, 0], [100, 0]], y: () => 30 }], [], () => 10);
assert.ok(br.trees.length === 0 && Math.abs(br.walk.pos[1] - 30.2) < 1e-9 && Math.abs(br.yellow.pos[1] - 30.36) < 1e-9);
const a = along([[0, 0], [10, 0], [20, 0]], [0, 10, 10], 5, 3);
assert.ok(a.d === 3 && a.y === 5);

// 타일로 자르기
const sq = [[-1, -1], [2, -1], [2, 2], [-1, 2]];
const c = clipRing(sq, 0, 0, 1, 1);
const area = (r) => Math.abs(r.reduce((a, [x, y], i) => { const [px, py] = r[(i + r.length - 1) % r.length]; return a + px * y - x * py; }, 0)) / 2;
assert.ok(Math.abs(area(c) - 1) < 1e-9, '사각형을 덮는 링 → 사각형 전체');
assert.equal(clipRing(sq, 5, 5, 6, 6).length, 0, '겹치지 않으면 빈 링');
assert.ok(Math.abs(area(clipRing([[0.5, 0.5], [3, 0.5], [3, 0.75], [0.5, 0.75]], 0, 0, 1, 1)) - 0.125) < 1e-9);
console.log('street ok');
