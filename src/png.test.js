import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { decodePng } from './png.js';

// 실제 Terrarium 고도 타일(부산, 필터 1·2·4 사용) — 정답 해시는 Python Pillow로 푼 RGB 바이트
const png = await decodePng(readFileSync(new URL('./fixtures/terrarium-13-7030-3241.png', import.meta.url)));
assert.deepEqual([png.width, png.height, png.ch], [256, 256, 3]);
assert.equal(createHash('sha256').update(png.data).digest('hex'), '8c4e68397697a08aa2ac547895f4f078a358519f7e228cbd7d4aa08c9a51bd0e');
const h = (i) => png.data[i * 3] * 256 + png.data[i * 3 + 1] + png.data[i * 3 + 2] / 256 - 32768;
assert.equal(h(0), 2); assert.equal(h(65535), 29);

// 필터 0·3이 섞인 2×2 RGBA
const px = [[10, 20, 30, 255, 40, 50, 60, 255], [70, 80, 90, 255, 200, 210, 220, 255]];
const avg = (x, a, up) => (x - ((a + up) >> 1)) & 255;
const row1 = px[1].map((x, i) => avg(x, i >= 4 ? px[1][i - 4] : 0, px[0][i]));
const chunk = (type, body) => { const b = Buffer.alloc(12 + body.length); b.writeUInt32BE(body.length); b.write(type, 4); body.copy(b, 8); return b; };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2); ihdr.writeUInt32BE(2, 4); ihdr[8] = 8; ihdr[9] = 6;
const file = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.from([0, ...px[0], 3, ...row1]))), chunk('IEND', Buffer.alloc(0))]);
const small = await decodePng(file);
assert.deepEqual([...small.data], [...px[0], ...px[1]]);
await assert.rejects(decodePng(new Uint8Array(16)), /PNG 아님/);
console.log('png ok');
