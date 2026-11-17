import { addRibbon, densify, offset } from './roads.js';

// (x, y)에서 가장 가까운 도로 구간: { d: 거리, ang: 도로 방향(rad, 동쪽 0·북쪽 +), w: 폭 }. 도로가 없으면 d = Infinity
export function nearestRoad(roads, x, y) {
  const best = { d: Infinity, ang: 0, w: 0 };
  for (const { w, line } of roads) for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1], [bx, by] = line[i], dx = bx - ax, dy = by - ay;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    const d = Math.hypot(x - ax - dx * t, y - ay - dy * t);
    if (d < best.d) { best.d = d; best.ang = Math.atan2(dy, dx); best.w = w; }
  }
  return best;
}

// 꺾은선 line(점마다 높이 ys) 위에서 (x, y)에 가장 가까운 점: { d: 거리, y: 그 점의 높이 }. 다리 상판 높이를 읽는 데 씀
export function along(line, ys, x, y) {
  const best = { d: Infinity, y: 0 };
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1], [bx, by] = line[i], dx = bx - ax, dy = by - ay;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    const d = Math.hypot(x - ax - dx * t, y - ay - dy * t);
    if (d < best.d) { best.d = d; best.y = ys[i - 1] + (ys[i] - ys[i - 1]) * t; }
  }
  return best;
}

// 도로 주변 꾸밈 (좌표는 타일 기준 [동, 북], 결과는 addRibbon과 같은 pos/idx)
// roads: [{ w, line, y? }] (y(x, z): 다리처럼 땅과 다른 높이를 쓰는 도로, 없으면 yAt), cross: 횡단보도 [[x, y, 도로 방향, 도로 폭]], yAt(x, z): 땅 높이
// 돌려주는 값: walk 인도, white 흰 차선·횡단보도, yellow 중앙선, trees 가로수 위치 [[x, y]]
export function street(roads, cross, yAt) {
  const mk = () => ({ pos: [], idx: [] }), walk = mk(), white = mk(), yellow = mk(), trees = [];
  let at = yAt;
  const up = (dy) => { const f = at; return (x, z) => f(x, z) + dy; };
  for (const { w, line, y } of roads) {
    at = y ?? yAt;
    const fine = densify(line, 6);
    addRibbon(walk.pos, walk.idx, fine, w + 5, up(0.2));   // 인도: 도로 양옆 2.5m (도로가 0.3 높이로 그 위를 덮음)
    addRibbon(yellow.pos, yellow.idx, fine, 0.2, up(0.36)); // 노란 중앙선
    if (w >= 11) for (const side of [1, -1]) {             // 넓은 도로: 4m 긋고 4m 띄운 흰 점선 차선
      const lane = densify(offset(line, (side * w) / 4), 4);
      for (let i = 0; i + 1 < lane.length; i += 2) addRibbon(white.pos, white.idx, [lane[i], lane[i + 1]], 0.15, up(0.36));
    }
    if (w >= 8 && !y) for (const side of [1, -1]) trees.push(...offset(densify(line, 24), side * (w / 2 + 1.6))); // 가로수: 인도 위, 24m 이하 간격
  }
  at = yAt;
  for (const [x, y, ang, w] of cross) {                    // 횡단보도: 도로 방향으로 4m 긴 줄을 1m 간격으로 폭만큼
    const dx = Math.cos(ang) * 2, dy = Math.sin(ang) * 2, nx = -Math.sin(ang), ny = Math.cos(ang);
    for (let o = -w / 2 + 0.5; o < w / 2; o++) addRibbon(white.pos, white.idx, [[x + nx * o - dx, y + ny * o - dy], [x + nx * o + dx, y + ny * o + dy]], 0.5, up(0.37));
  }
  return { walk, white, yellow, trees };
}
