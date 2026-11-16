# Spider — 대한민국 거미줄 스윙 탐험

## 목표
전국 실제 건물·도로·지형 위를 3인칭 시점으로 거미줄 스윙하며 탐험. 전투·멀티플레이 없음.
주인공은 오리지널 캐릭터 "누리"(남색 슈트·민트 띠·흰 헬멧+가로 바이저, `src/hero.js`). 기존 만화·영화 캐릭터 이름·디자인 사용 금지.

## 기술
- Vite + Three.js (JavaScript)
- 사이트: Cloudflare Pages / 지도 타일: Cloudflare R2

## 데이터
- 건물·도로: OpenStreetMap (Overpass API)
- 지형: AWS Terrain Tiles (Terrarium)

## 원칙
- 건물은 로우폴리 상자형, 충돌은 박스 충돌
- 건물 높이 추정 규칙은 `src/height.js` 하나만 사용: `height` → `building:levels × 3m` → 10m
- 플레이어 주변 타일만 불러오고 먼 타일은 해제(스트리밍)
- 좌표는 타일마다 원점을 따로 잡아 부동소수점 떨림 방지 (타일 데이터는 원점 기준 미터)
- 큰 데이터 파일은 저장소에 올리지 않음 (`public/data/`는 gitignore, 스크립트로 생성)
- `military` 태그가 붙은 시설은 데이터에서 제외
- OSM 출처 표기 필수 (© OpenStreetMap contributors)

## 명령
- `npm run fetch:osm` — 테스트 데이터 생성
- `npm run dev` — 개발 서버
- `npm test` — 높이 규칙 자체 검사

## 진행 현황
- [x] 1단계: Vite+Three.js 초기화, 광화문 1km² 건물 fetch, 돌출 표시, 마우스/터치 카메라
- [x] 2단계: 주인공 누리, 3인칭 카메라, 걷기/점프, 거미줄 스윙(자동 조준·로프 제약), 건물 AABB 충돌, 터치 조이스틱/버튼
