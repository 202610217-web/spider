// 건물 외관 유형 (프로젝트 전체에서 이것만 사용). 한국에서 흔한 실제 건물 모습을 참고
// 0 빌라·주택: 붉은 벽돌 + 작은 창 + 녹색 방수 옥상   1 아파트: 밝은 외벽 + 층마다 긴 띠창
// 2 상가·학교·공공: 타일/콘크리트 외벽 + 띠창            3 오피스·호텔: 유리 커튼월
// 4 공장·창고: 패널 외벽 + 파란 지붕                     5 전통 건물: 붉은 기둥색 벽 + 검은 기와색 지붕
const BY_TYPE = {
  house: 0, detached: 0, semidetached_house: 0, terrace: 0, bungalow: 0, hut: 0,
  apartments: 1, dormitory: 1,
  commercial: 2, retail: 2, supermarket: 2, kiosk: 2, school: 2, university: 2, college: 2, kindergarten: 2,
  hospital: 2, public: 2, civic: 2, government: 2, church: 2, train_station: 2,
  office: 3, hotel: 3,
  industrial: 4, warehouse: 4, factory: 4, manufacture: 4, garage: 4, garages: 4, shed: 4, greenhouse: 4, hangar: 4, roof: 4,
  temple: 5, shrine: 5, pagoda: 5, pavilion: 5, monastery: 5,
};

// tags: OSM 태그, h: 높이(m), area: 바닥 넓이(m²)
export function buildingStyle(tags = {}, h, area) {
  if (tags.historic || /hanok|traditional/.test(tags['building:architecture'] ?? '')) return 5;
  if (tags.building === 'residential') return h >= 20 ? 1 : 0;
  if (tags.building in BY_TYPE) return BY_TYPE[tags.building];
  // 종류 없음(building=yes가 대부분): 크기로 추정 — 작으면 주택, 높고 넓으면 오피스, 높고 좁으면 아파트, 나머지는 상가
  if (area < 120 && h <= 20) return 0;
  if (h >= 35) return area >= 1500 ? 3 : 1;
  return 2;
}

// 유형별 벽 무늬(buildings.js의 텍스처 번호)와 벽·옥상 색 후보. 건물마다 하나씩 골라 거리가 단조롭지 않게 함
export const LOOKS = [
  { tex: 0, wall: [0xb5694d, 0xc98a6b, 0x9c5b45, 0xd9c7b0, 0xcfcfc8], roof: [0x3f8f5f, 0x4a9a6a, 0x3f8f5f, 0x8a8a84] },
  { tex: 1, wall: [0xf2f0ea, 0xe6e2d8, 0xdfe6ea, 0xf0e6d6], roof: [0xb9b9b4, 0xa9aaa6] },
  { tex: 1, wall: [0xcfc8bc, 0xbfb7aa, 0xd8d2c4, 0xa9a39a, 0xc9b9a3], roof: [0x9a9a96, 0x3f8f5f, 0x8a8a84] },
  { tex: 2, wall: [0x9fc4e0, 0x8fb3cc, 0xa9d0d8, 0x7f9fb8], roof: [0x8a8d92] },
  { tex: 3, wall: [0xd9dde0, 0xcfd6dc, 0xe6e0d2], roof: [0x3f6fb5, 0x4a7fc0, 0x9aa0a6] },
  { tex: 3, wall: [0x8a4b3a, 0x8a4b3a, 0xe8e0cf], roof: [0x3a3d42] },
];
