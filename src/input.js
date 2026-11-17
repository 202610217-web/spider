// 키보드·마우스·터치 입력 → { yaw, pitch, mx, my, jump, web, zip, run, glide, lookAt }
export function createInput(canvas) {
  const s = { yaw: 0, pitch: -0.12, mx: 0, my: 0, jump: false, web: false, zip: false, run: false, glide: false, lookAt: 0 }; // lookAt: 마지막으로 시점을 직접 돌린 시각
  const keys = new Set();
  const look = (dx, dy, k) => {
    s.lookAt = performance.now();
    s.yaw -= dx * k;
    s.pitch = Math.max(-0.4, Math.min(1.3, s.pitch + dy * k));
  };
  const axes = () => {
    s.mx = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    s.my = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    s.run = keys.has('ShiftLeft') || keys.has('ShiftRight');
    s.zip = keys.has('KeyE') || keys.has('Mouse2');
    s.glide = keys.has('Space'); // 점프를 누르고 있으면 공중에서 활공
  };
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return; // 장소 검색창에 입력 중
    keys.add(e.code); if (e.code === 'Space') s.jump = true; axes();
  });
  addEventListener('keyup', (e) => { keys.delete(e.code); axes(); });

  // 마우스: 첫 클릭으로 포인터 고정, 이후 왼쪽 버튼 누르는 동안 거미줄, 오른쪽 버튼은 잡아당기기
  canvas.addEventListener('mousedown', (e) => {
    if (document.pointerLockElement !== canvas) return canvas.requestPointerLock();
    if (e.button === 0) s.web = true;
    if (e.button === 2) { keys.add('Mouse2'); axes(); }
  });
  addEventListener('mouseup', (e) => { if (e.button === 0) s.web = false; if (e.button === 2) { keys.delete('Mouse2'); axes(); } });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('mousemove', (e) => { if (document.pointerLockElement === canvas) look(e.movementX, e.movementY, 0.003); });

  // 터치: 왼쪽 절반 = 가상 조이스틱(멀리 밀면 달리기), 오른쪽 절반 = 시점, 버튼 = 거미줄/당기기/점프
  const sticks = new Map();
  canvas.addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) sticks.set(t.identifier, { x: t.clientX, y: t.clientY, left: t.clientX < innerWidth / 2 });
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      const st = sticks.get(t.identifier); if (!st) continue;
      const dx = t.clientX - st.x, dy = t.clientY - st.y;
      if (st.left) { s.mx = Math.max(-1, Math.min(1, dx / 50)); s.my = Math.max(-1, Math.min(1, -dy / 50)); s.run = Math.hypot(dx, dy) > 90; }
      else { look(dx, dy, 0.006); st.x = t.clientX; st.y = t.clientY; }
    }
  }, { passive: true });
  const end = (e) => {
    for (const t of e.changedTouches) { if (sticks.get(t.identifier)?.left) { s.mx = s.my = 0; s.run = false; } sticks.delete(t.identifier); }
  };
  canvas.addEventListener('touchend', end);
  canvas.addEventListener('touchcancel', end);

  const btn = (id, down, up) => {
    const el = document.getElementById(id);
    el.addEventListener('touchstart', (e) => { e.preventDefault(); down(); });
    el.addEventListener('touchend', (e) => { e.preventDefault(); up(); });
  };
  btn('btn-web', () => (s.web = true), () => (s.web = false));
  btn('btn-zip', () => (s.zip = true), () => (s.zip = false));
  btn('btn-jump', () => (s.jump = s.glide = true), () => (s.glide = false));
  return s;
}
