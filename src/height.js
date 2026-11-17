// 건물 높이 추정 규칙 (프로젝트 전체에서 이것만 사용): height → building:levels × 3m → 건물 종류별 기본값 → 바닥 넓이별 기본값
const num = (v) => { const n = parseFloat(v); return n > 0 ? n : null; };
const BY_TYPE = { // 높이 정보가 없을 때 건물 종류(building=*)별 기본 높이(m)
  apartments: 45, hotel: 30, office: 24, commercial: 15, retail: 9, hospital: 18, university: 15, school: 12, college: 12,
  dormitory: 15, residential: 12, industrial: 9, warehouse: 9, church: 12, temple: 8,
  house: 6, detached: 6, semidetached_house: 6, terrace: 6, hut: 3, shed: 3, garage: 3, garages: 3, greenhouse: 3, roof: 4, kiosk: 3,
};
// 종류도 없을 때: 바닥 넓이(m²)로 추정 — 120 미만은 주택 6m, 500 미만은 빌라·상가 12m, 그 이상은 20m
const byArea = (area) => (area < 120 ? 6 : area < 500 ? 12 : 20);
// tags: OSM 태그, area: 바닥 넓이(m²)
export const buildingHeight = (tags = {}, area = Infinity) =>
  num(tags.height) ?? (num(tags['building:levels']) ? num(tags['building:levels']) * 3 : null) ?? BY_TYPE[tags.building] ?? byArea(area);
