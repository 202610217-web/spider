# Spider — 대한민국 거미줄 스윙 탐험

## 목표
전국 실제 건물·도로·지형 위를 3인칭 시점으로 거미줄 스윙하며 탐험. 전투·멀티플레이 없음.
주인공은 오리지널 캐릭터 "누리"(남색 슈트·민트 띠·흰 헬멧+가로 바이저, `src/hero.js`). 기존 만화·영화 캐릭터 이름·디자인 사용 금지.

## 기술
- Vite + Three.js (JavaScript)
- 사이트: Cloudflare Pages / 지도 타일: Cloudflare R2

## 데이터
- 건물·도로: OpenStreetMap — Geofabrik 한국 추출본(.osm.pbf)을 `osmium-tool`로 가공 (`scripts/build-tiles.js`)
- 타일: z15 슬리피 타일(약 1km), `public/data/tiles/15/x/y.json`, 좌표는 타일 북서 모서리 기준 미터 (`src/tile.js`)
- 지형: AWS Terrain Tiles (Terrarium)

## 원칙
- 건물은 로우폴리 상자형, 충돌은 박스 충돌
- 도로는 바닥에 깔리는 띠, 폭은 등급별 표(`src/roads.js`)만 사용. 표에 없는 등급과 터널은 제외
- 건물 높이 추정 규칙은 `src/height.js` 하나만 사용: `height` → `building:levels × 3m` → 10m
- 플레이어 주변 타일만 불러오고 먼 타일은 해제(스트리밍)
- 좌표는 타일마다 원점을 따로 잡아 부동소수점 떨림 방지 (타일 데이터는 원점 기준 미터)
- 큰 데이터 파일은 저장소에 올리지 않음 (`public/data/`는 gitignore, 스크립트로 생성)
- `military` 태그가 붙은 시설은 데이터에서 제외
- OSM 출처 표기 필수 (© OpenStreetMap contributors)

## 명령
- `npm run build:tiles` — 한국 추출본 다운로드 후 전국 건물 타일 생성 (osmium-tool 설치 필요, 다른 파일은 `npm run build:tiles -- 경로.osm.pbf`)
- 시작 위치 변경: 주소 뒤에 `?ll=위도,경도`
- `npm run dev` — 개발 서버
- `npm test` — 높이 규칙·물리·도로 띠 자체 검사

## 진행 현황
- [x] 1단계: Vite+Three.js 초기화, 광화문 1km² 건물 fetch, 돌출 표시, 마우스/터치 카메라
- [x] 2단계: 주인공 누리, 3인칭 카메라, 걷기/점프, 거미줄 스윙(자동 조준·로프 제약), 건물 AABB 충돌, 터치 조이스틱/버튼
- [x] 3단계: Overpass → 전국 추출본 타일 파이프라인, 주변 3×3 타일 스트리밍(5×5 밖 해제), 거미줄은 충돌 박스에 부착
- 남은 일: 실제 한국 추출본으로 build:tiles 실행 검증(클라우드 세션에서는 다운로드 차단됨), 타일 R2 업로드(배포 시 public/data는 Pages에 올리지 않기), 군 부지 폴리곤 내부 건물 제외
- [x] 4단계(임시 배포): GitHub Actions(`.github/workflows/deploy.yml`)가 서울 타일을 만들고 main 푸시 시 GitHub Pages에 배포. 실제 한국 추출본으로 빌드 성공 확인. 전국 확장 시 Cloudflare Pages + R2로 이전
- [x] 5단계: 도로 — 타일에 `roads` 추가, 등급별 폭의 띠로 표시
- 다음 후보: 지형(Terrarium), 전국 확장(Cloudflare 이전), 카메라 벽 통과 방지
