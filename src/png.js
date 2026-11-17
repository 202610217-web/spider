// 8비트 RGB·RGBA PNG를 직접 풂 → { width, height, ch(채널 수), data(Uint8Array) }
// 캔버스로 읽지 않는 이유: Safari·Brave 등은 지문 추적 방지로 캔버스에서 읽은 픽셀에 잡음을 섞는데,
// 고도 이미지(Terrarium)는 빨강 1단계가 256m라 잡음 하나가 수백 m짜리 뾰족한 산이 됨
export async function decodePng(buf) {
  const b = new Uint8Array(buf), v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (v.getUint32(0) !== 0x89504e47) throw new Error('PNG 아님');
  let width, height, ch;
  const idat = [];
  for (let o = 8; o < b.length;) {
    const len = v.getUint32(o), type = String.fromCharCode(...b.subarray(o + 4, o + 8)), body = b.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') {
      width = v.getUint32(o + 8); height = v.getUint32(o + 12);
      const depth = body[8], color = body[9], interlace = body[12];
      ch = { 2: 3, 6: 4 }[color];
      if (depth !== 8 || !ch || interlace) throw new Error(`지원하지 않는 PNG (깊이 ${depth}, 색 ${color}, 인터레이스 ${interlace})`);
    } else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    o += 12 + len;
  }
  const raw = new Uint8Array(await new Response(new Blob(idat).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
  const row = width * ch, data = new Uint8Array(row * height);
  for (let y = 0; y < height; y++) { // 줄마다 앞의 필터 번호에 따라 되돌림
    const f = raw[y * (row + 1)], src = y * (row + 1) + 1, dst = y * row;
    for (let i = 0; i < row; i++) {
      const a = i >= ch ? data[dst + i - ch] : 0, up = y ? data[dst - row + i] : 0, c = i >= ch && y ? data[dst - row + i - ch] : 0;
      let p = 0;
      if (f === 1) p = a;
      else if (f === 2) p = up;
      else if (f === 3) p = (a + up) >> 1;
      else if (f === 4) { const pa = Math.abs(up - c), pb = Math.abs(a - c), pc = Math.abs(a + up - 2 * c); p = pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      data[dst + i] = (raw[src + i] + p) & 255;
    }
  }
  return { width, height, ch, data };
}
