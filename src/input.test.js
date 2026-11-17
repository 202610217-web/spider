import assert from 'node:assert';
import { stickAxes, STICK } from './input.js';

assert.deepEqual(stickAxes(3, -3), { mx: 0, my: 0, run: false }, '손떨림은 무시');
const half = stickAxes(STICK / 2, 0);
assert.ok(Math.abs(half.mx - 0.5) < 1e-9 && Math.abs(half.my) < 1e-9, '반만 밀면 절반 속도');
const up = stickAxes(0, -STICK * 3);
assert.ok(Math.abs(up.my - 1) < 1e-9 && up.mx === 0 && up.run, '위로 멀리 밀면 앞으로 달리기(길이는 1로 묶임)');
const diag = stickAxes(STICK, STICK);
assert.ok(Math.abs(Math.hypot(diag.mx, diag.my) - 1) < 1e-9 && diag.my < 0 && !diag.run, '대각선도 길이 1 이하');
console.log('input ok');
