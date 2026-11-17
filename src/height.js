// 건물 높이 추정 규칙 (프로젝트 전체에서 이것만 사용): height → building:levels × 3m → 건물 종류별 기본값 → 20m
// 태그가 전혀 없는 건물(위성 AI 윤곽, Overture)은 바닥 넓이(m²)로 추정: 작은 집은 낮게, 큰 건물은 조금 높게
const num = (v) => { const n = parseFloat(v); return n > 0 ? n : null; };
const BY_TYPE = { // 높이 정보가 없을 때 건물 종류(building=*)별 기본 높이(m)
  apartments: 45, hotel: 30, office: 24, commercial: 15, retail: 9, hospital: 18, university: 15, school: 12, college: 12,
  dormitory: 15, residential: 12, industrial: 9, warehouse: 9, church: 12, temple: 8,
  house: 6, detached: 6, semidetached_house: 6, terrace: 6, hut: 3, shed: 3, garage: 3, garages: 3, greenhouse: 3, roof: 4, kiosk: 3,
};
const BY_AREA = [[50, 3], [150, 6], [500, 9], [2000, 12]]; // [넓이 미만, 높이] — 1층 창고, 2층 주택, 3층 상가·빌라, 4층, 그 이상 15m
export const buildingHeight = (tags = {}, area) =>
  num(tags.height) ?? (num(tags['building:levels']) ? num(tags['building:levels']) * 3 : null) ?? BY_TYPE[tags.building] ??
  (!tags.building && area > 0 ? (BY_AREA.find(([a]) => area < a)?.[1] ?? 15) : 20);
