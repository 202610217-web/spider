#!/usr/bin/env bash
# public/data/tiles(gzip 타일)를 Cloudflare R2 버킷의 tiles/ 아래에 올림 (R2의 S3 호환 API + aws CLI)
# 환경 변수: R2_ACCOUNT_ID, R2_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY (R2 API 토큰의 키)
# wrangler를 쓰지 않는 이유: 파일을 하나씩 올리고 API 호출 제한(5분에 1200회)이 있어 수만 개 타일에는 너무 느림
set -euo pipefail
: "${R2_ACCOUNT_ID:?}" "${R2_BUCKET:?}"
rm -rf data/r2 && mkdir -p data/r2 && cp -r public/data/tiles data/r2/tiles
# 타일은 이미 gzip(.json.gz) → 이름만 .json으로 바꿔 Content-Encoding: gzip으로 올리면 브라우저가 알아서 풂
find data/r2 -name '*.json.gz' -print0 | xargs -0 -P 4 -n 200 sh -c 'for f; do mv "$f" "${f%.gz}"; done' _
du -sh data/r2
# 최신 aws CLI의 기본 체크섬 방식을 R2가 받지 않는 경우가 있어 예전 방식으로
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required AWS_RESPONSE_CHECKSUM_VALIDATION=when_required
aws s3 sync data/r2/tiles "s3://$R2_BUCKET/tiles" --endpoint-url "https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com" --region auto \
  --content-type application/json --content-encoding gzip --only-show-errors
echo "업로드 완료"
