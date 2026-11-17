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
  // 태그가 전혀 없는 위성 AI 건물(Overture): 대부분 시골·교외 → 작으면 주택, 넓고 낮으면 창고·축사(공장 모양), 나머지는 상가
  if (!tags.building) return area < 300 ? 0 : h <= 12 && area >= 600 ? 4 : 2;
  // 종류 없음(building=yes가 대부분): 크기로 추정 — 작으면 주택, 높고 넓으면 오피스, 높고 좁으면 아파트, 나머지는 상가
  if (area < 120 && h <= 20) return 0;
  if (h >= 35) return area >= 1500 ? 3 : 1;
  return 2;
}

// 유형마다 디자인 3가지: 벽 무늬(buildings.js의 LAYERS 번호)와 벽·옥상 색 후보. 건물마다 자리로 디자인 하나와 색 하나를 골라
// 늘 같은 모습이 되게 함(buildings.js)
export const LOOKS = [
  [ // 0 빌라·주택
    { tex: 0, wall: [0xb5694d, 0xc98a6b, 0x9c5b45], roof: [0x3f8f5f, 0x4a9a6a, 0x8a8a84] },  // 붉은 벽돌 + 작은 창 + 녹색 방수 옥상
    { tex: 4, wall: [0xf0e6d6, 0xe8dcc4, 0xf4f0e8], roof: [0x3f8f5f, 0x9a9a96] },             // 크림색 미장 + 작은 창
    { tex: 5, wall: [0x8f8478, 0xa3998c, 0x7c6e62], roof: [0x8a8a84, 0x6f6f6a] },             // 회갈색 벽돌 + 넓은 창(요즘 빌라)
  ],
  [ // 1 아파트
    { tex: 1, wall: [0xf2f0ea, 0xe6e2d8, 0xdfe6ea], roof: [0xb9b9b4, 0xa9aaa6] },             // 흰 외벽 + 긴 띠창
    { tex: 6, wall: [0xf0dcd0, 0xdde6ee, 0xe9e2c8], roof: [0xb9b9b4] },                       // 연한 색 외벽 + 두 칸 창(오래된 단지)
    { tex: 2, wall: [0xc8d6e0, 0xb8c8d4, 0xd4dce2], roof: [0x8a8d92] },                       // 밝은 유리(주상복합)
  ],
  [ // 2 상가·학교·공공
    { tex: 1, wall: [0xcfc8bc, 0xbfb7aa, 0xd8d2c4], roof: [0x9a9a96, 0x3f8f5f] },             // 타일색 외벽 + 띠창
    { tex: 5, wall: [0xa85f48, 0xb87458, 0x96553f], roof: [0x8a8a84, 0x3f8f5f] },             // 붉은 벽돌 + 띠창(학교·관공서)
    { tex: 6, wall: [0xbdbab4, 0xa9a39a, 0xc9b9a3], roof: [0x9a9a96] },                       // 콘크리트 + 두 칸 창
  ],
  [ // 3 오피스·호텔
    { tex: 2, wall: [0x9fc4e0, 0x8fb3cc, 0xa9d0d8], roof: [0x8a8d92] },                       // 푸른 유리 커튼월
    { tex: 7, wall: [0xd0d4d8, 0xc4c8cc, 0xe0e0dc], roof: [0x6f7378] },                       // 짙은 유리 + 세로 기둥
    { tex: 6, wall: [0xd9d6cf, 0xc8c4bc, 0xb4b0a8], roof: [0x8a8d92] },                       // 석재색 외벽 + 격자 창
  ],
  [ // 4 공장·창고
    { tex: 3, wall: [0xd9dde0, 0xcfd6dc, 0xe6e0d2], roof: [0x3f6fb5, 0x4a7fc0, 0x9aa0a6] },   // 골강판 + 파란 지붕
    { tex: 8, wall: [0xe8e4dc, 0xc9d3cf, 0xdcd4c4], roof: [0xa0463a, 0x3f8f5f] },             // 골강판 + 높은 띠창 + 붉은·녹색 지붕
    { tex: 9, wall: [0xbdbab4, 0xa9a39a], roof: [0x9aa0a6, 0x3f6fb5] },                       // 콘크리트 블록 + 높은 띠창
  ],
  [ // 5 전통 건물
    { tex: 4, wall: [0xf4f0e6, 0xece4d4], roof: [0x3a3d42] },                                 // 흰 회벽 + 작은 창 + 검은 기와
    { tex: 3, wall: [0x8a4b3a, 0x7a3e30], roof: [0x3a3d42, 0x4a4d55] },                       // 붉은 나무 벽 + 기와
    { tex: 0, wall: [0xc9a27a, 0xb8916c], roof: [0x3a3d42] },                                 // 황토 벽돌 + 기와
  ],
];
