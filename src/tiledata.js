// 타일 응답 → 객체. gzip 파일이면(앞 두 바이트 1f 8b) 직접 풀고, 서버가 이미 풀어 보냈으면 그대로 읽음
export async function readTile(res) {
  if (!res.ok) return {};
  const bytes = new Uint8Array(await res.arrayBuffer());
  const text = bytes[0] === 0x1f && bytes[1] === 0x8b ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text() : new TextDecoder().decode(bytes);
  return JSON.parse(text);
}
