// 다각형 링을 사각형 [x0, x1] × [y0, y1] 안쪽만 남기게 자름 (Sutherland–Hodgman). 큰 강·호수를 타일마다 나눠 담는 데 씀
// shortcut: 오목한 링이 사각형 밖으로 나갔다 들어오면 경계선을 따라 폭 0인 띠가 남음(화면에는 안 보임), 문제가 되면 제대로 된 다각형 자르기로 교체
export function clipRing(ring, x0, y0, x1, y1) {
  let pts = ring;
  for (const [axis, v, less] of [[0, x0, false], [0, x1, true], [1, y0, false], [1, y1, true]]) {
    const out = [], inn = (p) => (less ? p[axis] <= v : p[axis] >= v);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if (inn(a)) out.push(a);
      if (inn(a) !== inn(b)) { const t = (v - a[axis]) / (b[axis] - a[axis]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    pts = out;
    if (pts.length < 3) return [];
  }
  return pts;
}
