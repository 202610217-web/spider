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
- 지형: AWS Terrain Tiles (Terrarium) z12 PNG를 브라우저가 직접 받아 타일당 33×33 고도 격자로 사용 (`src/terrain.js`), 실패 시 평지

## 원칙
- 건물은 바닥 모양을 그대로 올린 로우폴리 기둥, 충돌·거미줄 부착·카메라도 같은 기둥(`src/collide.js`) 기준 (외곽 상자는 걸러내기용)
- 도로는 바닥에 깔리는 띠, 폭은 등급별 표(`src/roads.js`)만 사용. 표에 없는 등급과 터널은 제외
- 건물 높이 추정 규칙은 `src/height.js` 하나만 사용: `height` → `building:levels × 3m` → 건물 종류별 기본값 → 20m
- 단위는 실제 미터, 주인공 키 1.8m
- 플레이어 주변 타일만 불러오고 먼 타일은 해제(스트리밍)
- 좌표는 타일마다 원점을 따로 잡아 부동소수점 떨림 방지 (타일 데이터는 원점 기준 미터)
- 큰 데이터 파일은 저장소에 올리지 않음 (`public/data/`는 gitignore, 스크립트로 생성)
- `military` 태그가 붙은 시설과, 군 부지(`landuse=military`, `military=*`) 다각형 안의 건물·도로는 데이터에서 제외
- OSM 출처 표기 필수 (© OpenStreetMap contributors)

## R2 이전 (선택)
- `scripts/upload-r2.sh`: 타일을 gzip으로 압축해 R2에 올림(aws CLI, S3 호환 API). GitHub Actions의 `upload-r2` 워크플로를 수동 실행
- 저장소 Secrets `R2_ACCOUNT_ID`·`R2_ACCESS_KEY_ID`·`R2_SECRET_ACCESS_KEY`, Variables `R2_BUCKET` 필요. 버킷은 공개 접근과 CORS(GET 허용)를 켜야 함
- Variables에 `TILE_URL`(버킷 공개 주소 + `/tiles`)을 넣고 다시 배포하면 로더가 R2에서 읽음 (`VITE_TILE_URL`)
- 실제 R2 계정으로는 아직 실행해 보지 않음

## 명령
- `npm run build:tiles` — 한국 추출본 다운로드 후 전국 건물 타일 생성 (osmium-tool 설치 필요, 다른 파일은 `npm run build:tiles -- 경로.osm.pbf`)
- 시작 위치 변경: 주소 뒤에 `?ll=위도,경도`, 또는 화면의 도시 검색창(`src/cities.js`)
- `npm run dev` — 개발 서버
- `npm test` — 높이 규칙·물리·도로·조준·지형 보간·충돌 자체 검사

## 진행 현황
- [x] 1단계: Vite+Three.js 초기화, 광화문 1km² 건물 fetch, 돌출 표시, 마우스/터치 카메라
- [x] 2단계: 주인공 누리, 3인칭 카메라, 걷기/점프, 거미줄 스윙(자동 조준·로프 제약), 건물 AABB 충돌, 터치 조이스틱/버튼
- [x] 3단계: Overpass → 전국 추출본 타일 파이프라인, 주변 3×3 타일 스트리밍(5×5 밖 해제), 거미줄은 충돌 박스에 부착
- 남은 일: 실제 한국 추출본으로 build:tiles 실행 검증(클라우드 세션에서는 다운로드 차단됨), 타일 R2 업로드(배포 시 public/data는 Pages에 올리지 않기), 군 부지 폴리곤 내부 건물 제외
- [x] 4단계(임시 배포): GitHub Actions(`.github/workflows/deploy.yml`)가 서울 타일을 만들고 main 푸시 시 GitHub Pages에 배포. 실제 한국 추출본으로 빌드 성공 확인. 전국 확장 시 Cloudflare Pages + R2로 이전
- [x] 5단계: 도로 — 타일에 `roads` 추가, 등급별 폭의 띠로 표시
- 다음 후보: 지형(Terrarium), 전국 확장(Cloudflare 이전), 카메라 벽 통과 방지
- [x] 6단계: 거미줄 조작 개선 — 스틱 방향 자동 조준, 걸 수 있는 지점 표시(벽의 점 + 버튼 색), 줄 감아 올리기, 공중 카메라 자동 추적
- [x] 7단계: 지형(땅 메시, 건물 바닥·도로·플레이어가 고도를 따름), 카메라 벽 통과 방지, 도로를 타일 경계에서 분할, 배포를 전국 타일로 확대(압축 약 100MB)
- 다음 후보: 군 부지 폴리곤 내부 건물 제외, Cloudflare Pages + R2 이전, 고가도로·다리 높이
- [x] 8단계: 주인공 키 1.8m, 종류별 건물 기본 높이, 건물 모양 그대로 충돌(보이지 않는 벽 제거), 도로를 6m마다 땅에 맞춤, 스윙이 걸린 곳으로 끌려가지 않고 앞으로 나아감
- [x] 9단계: 종류 없는 건물 기본 높이 20m, 벽타기(벽 쪽으로 스틱을 밀면 오르고 점프로 벽에서 뛰어내림)
- [x] 10단계: 군 부지 다각형 안의 건물·도로 제외
- 다음 후보: 물(강·바다) 표시, 고가도로·다리 높이, Cloudflare Pages + R2 이전
- [x] 11단계: 달리기, 벽타기 오르내리기·매달리기, 잡아당기기, 활공, 지형에 거미줄, 속도에 따른 시야각, 진행 방향 타일 미리 불러오기, 도시 검색 순간이동, 미니맵, R2 업로드 스크립트·워크플로(미실행), 거미줄 사거리 80m
- [x] 12단계: 누리에 관절(어깨·팔꿈치·엉덩이·무릎)과 상태별 자세(`src/hero.js`: 달리기·스윙·당기기·벽타기·활공·낙하·착지 웅크림·놓을 때 공중제비), 줄은 쥔 손에서 나감
- 보류: 브이월드(VWorld) 지도 — 인증키 필요, 클라우드 세션에서 vworld.kr 접속 불가로 문서 미확인
- 조작: 걷기 5m/s·달리기 11m/s(Shift / 스틱 멀리), 거미줄(왼쪽 버튼 / [거미줄]), 당기기(E·오른쪽 버튼 / [당기기]), 점프(Space / [점프])
