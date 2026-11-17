#!/usr/bin/env bash
# 국토교통부 GIS건물통합정보 SHP → data/gis.ndjson (이미 있으면 건너뜀)
# 브이월드는 로그인해야 받을 수 있어 CI가 직접 못 받음 → 브이월드에서 받은 ZIP을 이 저장소의 GitHub 릴리스 'gis-buildings'에 올려 두면 여기서 받음
# 저장소의 data-src/gis/*.zip(작은 파일, 예: 일별 변동분)도 함께 씀. 둘 다 없으면 공식 데이터 없이(OSM + Overture만으로) 진행. 필요: gh(GH_TOKEN), unzip, ogr2ogr(gdal-bin), node
set -euo pipefail
OUT=data/gis.ndjson
if [ -s "$OUT" ]; then echo "$OUT 이미 있음"; exit 0; fi
mkdir -p data/gis
if ! ls data/gis/*.zip >/dev/null 2>&1; then
  gh release download gis-buildings -p '*.zip' -D data/gis --clobber || echo "릴리스 gis-buildings 없음"
  cp data-src/gis/*.zip data/gis/ 2>/dev/null || true
  ls data/gis/*.zip >/dev/null 2>&1 || { echo "공식 건물 ZIP 없음 — 공식 건물 데이터 없이 진행"; exit 0; }
fi
rm -rf data/gis/x && mkdir -p data/gis/x
for z in data/gis/*.zip; do unzip -oq "$z" -d data/gis/x; done
find data/gis/x -iname '*.zip' -exec unzip -oq {} -d data/gis/x \; # 시도 ZIP 안에 ZIP이 또 있는 경우
: > "$OUT.tmp"
find data/gis/x -iname '*.shp' | sort | while read -r shp; do
  base="${shp%.*}"; opts=()
  [ -f "$base.prj" ] || [ -f "$base.PRJ" ] || opts+=(-s_srs EPSG:5186) # 좌표계 파일이 없으면 2026년 배포본의 EPSG:5186
  [ -f "$base.cpg" ] || [ -f "$base.CPG" ] || opts+=(--config SHAPE_ENCODING CP949) # 인코딩 파일이 없으면 한글은 CP949
  echo "변환: $shp"
  ogr2ogr "${opts[@]}" -f GeoJSONSeq -t_srs EPSG:4326 /vsistdout/ "$shp" | node scripts/gis.js >> "$OUT.tmp"
done
mv "$OUT.tmp" "$OUT"
wc -l "$OUT"; du -h "$OUT"
