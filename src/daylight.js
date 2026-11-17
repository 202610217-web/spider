// 시간에 따른 자연광: 해의 실제 위치(위도·날짜·시각)와, 해 높이에 따른 빛·하늘·안개 색
// 좌표는 게임과 같음: x 동쪽, y 위, z 남쪽
export const HOURS_PER_MINUTE = 1; // 실제 1분 = 게임 1시간 → 24분에 하루

const rad = Math.PI / 180;
// 해 방향(단위 벡터). hour: 현지 시각(0~24), day: 1월 1일부터 날수, lat: 위도(도)
// 한국 표준시는 동경 135° 기준이라 서울(약 127°)의 태양 남중은 12시 30분쯤 → 시각에서 0.5시간을 뺌
export function sunDirection(hour, day, lat = 37.5) {
  const dec = 23.44 * Math.sin((2 * Math.PI * (284 + day)) / 365) * rad; // 적위: 하지 +23.4°, 동지 -23.4°
  const h = (hour - 12.5) * 15 * rad, p = lat * rad;
  const east = -Math.cos(dec) * Math.sin(h), north = Math.cos(p) * Math.sin(dec) - Math.sin(p) * Math.cos(dec) * Math.cos(h);
  const up = Math.sin(p) * Math.sin(dec) + Math.cos(p) * Math.cos(dec) * Math.cos(h);
  return [east, up, -north];
}

// 해 높이(도)별 색·세기. 사이는 선형으로 섞음. moon: 이 높이에서는 해 대신 달빛(반대쪽 하늘)으로 비춤
const KEYS = [
  //  높이  안개·하늘 밑   하늘빛(반구)  땅 반사빛   반구 세기  햇빛 색     햇빛 세기  밤(창문 불빛) 노출
  [-14, 0x0b1426, 0x3a4f80, 0x141a2c, 1.8, 0xa9bcff, 0.9, 1, 1.2], // 밤: 놀이가 되도록 달빛·하늘빛을 조금 밝게
  [-5, 0x343a63, 0x5a5f92, 0x232537, 1.4, 0xff8a5a, 0.0, 0.85, 0.9],
  [1, 0xe9a882, 0xffc8a0, 0x5a4c44, 1.5, 0xffa25a, 1.6, 0.3, 0.65],
  [8, 0xe7d3bd, 0xffe5c8, 0x667055, 2.0, 0xffd2a0, 2.6, 0, 0.55],
  [25, 0xbfd6ea, 0xeef4fb, 0x667755, 2.4, 0xfff4e6, 3.2, 0, 0.5],
];
const mix = (a, b, t) => {
  const c = (v, s) => (v >> s) & 255;
  return [16, 8, 0].reduce((o, s) => o | (Math.round(c(a, s) + (c(b, s) - c(a, s)) * t) << s), 0);
};
export function daylight(elevation) {
  let i = 0;
  while (i < KEYS.length - 2 && elevation > KEYS[i + 1][0]) i++;
  const [a, b] = [KEYS[i], KEYS[i + 1]], t = Math.min(1, Math.max(0, (elevation - a[0]) / (b[0] - a[0])));
  const num = (k) => a[k] + (b[k] - a[k]) * t;
  return { fog: mix(a[1], b[1], t), sky: mix(a[2], b[2], t), ground: mix(a[3], b[3], t), hemi: num(4), sun: mix(a[5], b[5], t), sunIntensity: num(6), night: num(7), exposure: num(8), moon: elevation < -5 };
}
