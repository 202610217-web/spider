// 프레임률 방어: 느린 프레임이 많으면 렌더 해상도 배율을 낮추고, 여유가 이어지면 다시 올림
// 프레임마다 dt(초)를 넣으면 배율이 바뀔 때만 새 배율을, 아니면 null을 돌려줌
export function createGovernor(max, min = 0.5) {
  let scale = max, t = 0, n = 0, slow = 0, hold = 0, backoff = 4;
  return (dt) => {
    t += dt; n++;
    if (dt > 1 / 55) slow++; // 평균 대신 느린 프레임 수를 세서, 타일 로딩 같은 한 번의 끊김에는 반응하지 않음
    if (t < 1) return null;  // 1초마다 판단
    const bad = slow > n * 0.3, good = slow <= n * 0.05;
    t = n = slow = 0;
    const before = scale;
    if (bad) { scale = Math.max(min, scale * 0.85); hold = backoff; backoff = Math.min(backoff * 2, 120); } // 올렸다 다시 느려지면 다음 시도를 점점 미룸
    else if (good && hold-- <= 0) scale = Math.min(max, scale * 1.1);
    return scale === before ? null : scale;
  };
}
