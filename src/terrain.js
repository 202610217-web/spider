import { S } from './tile.js';

// 지형: AWS Terrain Tiles(Terrarium) z12. z12 픽셀 하나 = z15 타일의 1/32 (약 30m)
export const N = 32; // 타일 한 변의 격자 칸 수
const URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/12';
// shortcut: 받은 고도 이미지는 계속 보관(장당 256KB), 장거리 이동으로 메모리가 문제되면 오래된 것부터 해제
const cache = new Map(); // "X/Y" → Promise<Float32Array(256×256)>

function dem(X, Y) {
  const key = `${X}/${Y}`;
  if (!cache.has(key)) cache.set(key, (async () => {
    const h = new Float32Array(65536); // 실패하면 평지(0m)
    try {
      const res = await fetch(`${URL}/${key}.png`);
      if (!res.ok) throw new Error(res.status);
      const bmp = await createImageBitmap(await res.blob(), { colorSpaceConversion: 'none' }); // 색 보정이 고도 값을 바꾸지 않게
      const ctx = Object.assign(document.createElement('canvas'), { width: 256, height: 256 }).getContext('2d');
      ctx.drawImage(bmp, 0, 0);
      const d = ctx.getImageData(0, 0, 256, 256).data;
      for (let i = 0; i < 65536; i++) h[i] = Math.max(0, d[i * 4] * 256 + d[i * 4 + 1] + d[i * 4 + 2] / 256 - 32768); // 바다 밑은 0m
    } catch (e) { console.warn('지형 타일 실패', key, e); }
    return h;
  })());
  return cache.get(key);
}

// 타일 (tx, ty)의 (N+1)×(N+1) 고도 격자. 가장자리는 이웃 타일과 같은 픽셀을 읽어 이음매가 맞음
export async function tileHeights(tx, ty) {
  const gx0 = tx * N, gy0 = ty * N; // z12 전역 픽셀 좌표
  const imgs = {};
  await Promise.all([gx0 >> 8, (gx0 + N) >> 8].flatMap((X) => [gy0 >> 8, (gy0 + N) >> 8].map(async (Y) => { imgs[`${X}/${Y}`] = await dem(X, Y); })));
  const h = new Float32Array((N + 1) ** 2);
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const gx = gx0 + i, gy = gy0 + j;
    h[j * (N + 1) + i] = imgs[`${gx >> 8}/${gy >> 8}`][(gy & 255) * 256 + (gx & 255)];
  }
  return h;
}

// 격자에서 타일 기준 (x 동쪽, z 남쪽) 위치의 고도. 타일 밖은 가장자리 값
// 땅 메시(PlaneGeometry)와 같은 삼각형으로 보간해서 메시 표면과 정확히 일치
export function heightAt(h, x, z) {
  const u = Math.min(Math.max((x / S) * N, 0), N), v = Math.min(Math.max((z / S) * N, 0), N);
  const i = Math.min(Math.floor(u), N - 1), j = Math.min(Math.floor(v), N - 1), fu = u - i, fv = v - j, k = j * (N + 1) + i;
  const a = h[k], d = h[k + 1], b = h[k + N + 1], c = h[k + N + 2]; // a 북서, d 북동, b 남서, c 남동. 대각선은 b–d
  return fu + fv <= 1 ? a + (d - a) * fu + (b - a) * fv : c + (b - c) * (1 - fu) + (d - c) * (1 - fv);
}
