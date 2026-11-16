// 도로 중심선(타일 기준 [동, 북]) → 바닥에 깔리는 띠 지오메트리 데이터
export const ROAD_WIDTH = { // 도로 등급별 폭(m). 여기 없는 등급(보행로·골목 진입로 등)은 타일에 넣지 않음
  motorway: 20, trunk: 16, primary: 14, secondary: 11, tertiary: 8, residential: 6, unclassified: 6,
  motorway_link: 8, trunk_link: 8, primary_link: 7, secondary_link: 6, tertiary_link: 6,
};

// 꼭짓점마다 앞뒤 방향의 수직으로 w/2씩 벌려 이어진 띠를 만듦. pos/idx 배열에 덧붙임 (y는 위, z = -북)
// yAt(x, z): 그 지점의 땅 높이
export function addRibbon(pos, idx, line, w, yAt = () => 0) {
  const base = pos.length / 3, n = line.length;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = line[Math.max(i - 1, 0)], [bx, by] = line[Math.min(i + 1, n - 1)];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const nx = (-(by - ay) / len) * (w / 2), ny = ((bx - ax) / len) * (w / 2);
    const [x, y] = line[i];
    pos.push(x + nx, yAt(x + nx, -(y + ny)), -(y + ny), x - nx, yAt(x - nx, -(y - ny)), -(y - ny));
    if (i) { const k = base + i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
}

// 긴 구간에 점을 끼워 넣어 모든 구간이 max 이하가 되게 함 (도로가 지형 굴곡을 따라가고 타일 경계에서 자를 수 있게)
export function densify(line, max) {
  const out = [line[0]];
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1], [bx, by] = line[i];
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / max);
    for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  return out;
}
