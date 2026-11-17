# 텍스처 출처

모두 [Poly Haven](https://polyhaven.com) (CC0)의 1k diffuse를 512px로 줄인 것. 벽·옥상용은 건물 색을 곱할 수 있게 밝은 회색조로 변환.

- `brick.jpg` — red_bricks_04
- `plaster.jpg` — painted_plaster_wall
- `panel.jpg` — corrugated_iron_02
- `concrete.jpg` — concrete_floor_worn_001
- `asphalt.jpg` — asphalt_02

## 창호 (피그마)

`win0.svg`(빌라 창)·`win1.svg`(아파트·상가 띠창)·`win2.svg`(유리 커튼월)은 피그마 파일
[Spider — 서울 건물 창호 텍스처](https://www.figma.com/design/Jij69VWpfRiEYwQmgJgoJp)에서 그려 SVG로 내보낸 것(그라디언트 id만 `g`로 줄임).
벽 한 칸(3m × 3m = 256px)에 사진 바탕 → 창호 순서로 겹쳐 그림 (`src/buildings.js`).

## 추가

- `rooftile.jpg` — roof_tiles_14 (기와·박공지붕)
- `*_n.jpg` — 위 각 텍스처의 노멀맵(nor_gl)
