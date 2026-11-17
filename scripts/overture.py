# Overture Maps 건물 중 OSM에 없는 것(위성 영상 AI로 그린 건물 윤곽)을 남한 안에서만 뽑아 data/overture.ndjson으로 저장
# 한 줄에 건물 하나: 바깥 링 [[경도, 위도], ...]. scripts/build-tiles.js가 읽어 OSM 건물과 함께 타일에 넣음
# 사용: pip install duckdb && python3 scripts/overture.py   (인터넷으로 Overture S3를 직접 읽음, 수 분)
# shortcut: Overture는 오래된 릴리스를 S3에서 지움 → 403/빈 결과가 나오면 RELEASE를 https://docs.overturemaps.org/release/latest/ 의 최신으로 바꿀 것
import os, duckdb

RELEASE = os.environ.get('OVERTURE_RELEASE', '2026-10-21.0')
BASE = f's3://overturemaps-us-west-2/release/{RELEASE}'
OUT = 'data/overture.ndjson'

con = duckdb.connect()
con.sql("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial;")
con.sql("CREATE SECRET anon (TYPE s3, PROVIDER config, KEY_ID '', SECRET '', REGION 'us-west-2');")  # 공개 버킷: 환경의 AWS 키를 쓰지 않음
# 남한 국경(섬 포함). 이 안에 중심이 있는 건물만 → 북한·중국·일본 건물 제외
con.sql(f"""CREATE TABLE kr AS SELECT geometry g FROM read_parquet('{BASE}/theme=divisions/type=division_area/*', hive_partitioning=1)
  WHERE country = 'KR' AND subtype = 'country' AND bbox.xmin < 132 AND bbox.xmax > 124""")
if not con.sql("SELECT count(*) FROM kr").fetchall()[0][0]:
    raise SystemExit('남한 경계를 못 찾음 (RELEASE 확인)')
os.makedirs('data', exist_ok=True)
con.sql(f"""COPY (
  SELECT ST_AsGeoJSON(ST_ExteriorRing(ST_SimplifyPreserveTopology(b.geometry, 0.000005))) AS j  -- 약 0.5m 이하 굴곡은 줄임
  FROM read_parquet('{BASE}/theme=buildings/type=building/*', hive_partitioning=1) b
  WHERE b.bbox.xmin > 124.5 AND b.bbox.xmax < 131.0 AND b.bbox.ymin > 33.0 AND b.bbox.ymax < 38.7
    AND b.sources[1].dataset <> 'OpenStreetMap'        -- OSM 건물은 build-tiles.js가 원본(태그 포함)에서 직접 읽음
    AND NOT coalesce(b.is_underground, false)
    AND ST_GeometryType(b.geometry) = 'POLYGON'
    AND EXISTS (SELECT 1 FROM kr WHERE ST_Intersects(kr.g, ST_Centroid(b.geometry)))
) TO '{OUT}.tmp' (FORMAT csv, HEADER false, QUOTE '', DELIMITER '\\t')""")
os.replace(f'{OUT}.tmp', OUT)
print(OUT, sum(1 for _ in open(OUT)), '개')
