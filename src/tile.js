// 타일 좌표 (스크립트·게임 공용). z15 슬리피 타일, 타일 하나가 약 1km
export const Z = 15;
// 전국 공통 축척(위도 36.5° 기준) — 타일 경계가 정확히 맞물리게 하려고 타일별 cos 대신 상수 사용 (남북 끝 크기 오차 ±2%)
export const S = (40075016.686 / 2 ** Z) * Math.cos((36.5 * Math.PI) / 180); // 타일 한 변(m)
export const lonLatToTile = (lon, lat) => {
  const r = (lat * Math.PI) / 180;
  return [((lon + 180) / 360) * 2 ** Z, ((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2) * 2 ** Z];
};
