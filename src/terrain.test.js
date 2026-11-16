import assert from 'node:assert';
import { N, heightAt } from './terrain.js';
import { S } from './tile.js';
const h = new Float32Array((N + 1) ** 2);
for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) h[j * (N + 1) + i] = i * 2 + j * 10; // 동쪽 +2/칸, 남쪽 +10/칸
const c = S / N;
assert.ok(Math.abs(heightAt(h, 0, 0)) < 1e-6);
assert.ok(Math.abs(heightAt(h, c * 1.5, c * 2.25) - (3 + 22.5)) < 1e-3);
assert.ok(Math.abs(heightAt(h, S, S) - (64 + 320)) < 1e-3);
assert.ok(Math.abs(heightAt(h, -50, S + 50) - 320) < 1e-3, 'clamps outside the tile');
console.log('terrain ok');
