// 건물 높이 추정 규칙 (프로젝트 전체에서 이것만 사용)
const num = (v) => { const n = parseFloat(v); return n > 0 ? n : null; };
export const buildingHeight = (tags = {}) =>
  num(tags.height) ?? (num(tags['building:levels']) ? num(tags['building:levels']) * 3 : null) ?? 10;
