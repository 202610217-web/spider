import assert from 'node:assert';
import { createGovernor } from './perf.js';

const run = (g, fps, sec) => { let s = null; for (let i = 0; i < fps * sec; i++) s = g(1 / fps) ?? s; return s; };
const g = createGovernor(2, 0.5);
assert.equal(run(g, 60, 5), null);                 // 60fps면 그대로
assert.equal(run(g, 30, 30), 0.5);                 // 계속 느리면 하한까지 내림
assert.equal(run(g, 60, 600), 2);                  // 여유가 이어지면 원래대로
const h = createGovernor(2);
let s = null;
for (let i = 0; i < 600; i++) s = h(i % 60 === 0 ? 0.1 : 1 / 60) ?? s; // 1초에 한 번 끊김(타일 로딩)은 무시
assert.equal(s, null);
console.log('perf ok');
