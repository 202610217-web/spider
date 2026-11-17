#!/usr/bin/env bash
# Overture Maps 건물 중 OSM에 없는 한국 건물만 data/overture.ndjson으로 받음 (이미 있으면 건너뜀). pipx 필요
set -euo pipefail
OUT=data/overture.ndjson
if [ -s "$OUT" ]; then echo "$OUT 이미 있음"; exit 0; fi
mkdir -p data
curl -fL -o data/south-korea.poly https://download.geofabrik.de/asia/south-korea.poly
# 한국을 덮는 사각형(서,남,동,북)으로 받은 뒤 나라 경계로 걸러 일본·북한 건물을 뺌
pipx run overturemaps download --bbox=124.5,33.0,131.0,38.7 -f geojsonseq --type=building \
  | node scripts/overture.js data/south-korea.poly > "$OUT.tmp"
mv "$OUT.tmp" "$OUT"
wc -l "$OUT"; du -h "$OUT"
