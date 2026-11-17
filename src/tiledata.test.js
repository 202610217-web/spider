import assert from 'node:assert';
import { gzipSync } from 'node:zlib';
import { readTile } from './tiledata.js';

const tile = { buildings: [{ h: 9, s: 0, ring: [[0, 0], [1, 0], [1, 1], [0, 0]] }], roads: [] };
assert.deepEqual(await readTile(new Response(gzipSync(JSON.stringify(tile)))), tile, 'gzip 파일은 직접 풂');
assert.deepEqual(await readTile(new Response(JSON.stringify(tile))), tile, '서버가 이미 풀어 보낸 것도 읽음');
assert.deepEqual(await readTile(new Response('', { status: 404 })), {}, '없는 타일은 빈 타일');
console.log('tiledata ok');
