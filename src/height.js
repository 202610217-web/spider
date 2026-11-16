// 건물 높이 추정 규칙 (프로젝트 전체에서 이것만 사용): height → building:levels × 3m → 건물 종류별 기본값 → 10m
const num = (v) => { const n = parseFloat(v); return n > 0 ? n : null; };
const BY_TYPE = { // 높이 정보가 없을 때 건물 종류(building=*)별 기본 높이(m)
  apartments: 45, hotel: 30, office: 24, commercial: 15, retail: 9, hospital: 18, university: 15, school: 12, college: 12,
  dormitory: 15, residential: 12, industrial: 9, warehouse: 9, church: 12, temple: 8,
  house: 6, detached: 6, semidetached_house: 6, terrace: 6, hut: 3, shed: 3, garage: 3, garages: 3, greenhouse: 3, roof: 4, kiosk: 3,
};
export const buildingHeight = (tags = {}) =>
  num(tags.height) ?? (num(tags['building:levels']) ? num(tags['building:levels']) * 3 : null) ?? BY_TYPE[tags.building] ?? 10;
