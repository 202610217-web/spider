// 키보드·마우스·터치 입력 → { yaw, pitch, mx, my, jump, web, zip, run, glide, lookAt }
export const STICK = 60; // 조이스틱 반지름(px): 이만큼 밀면 최대 걷기, 1.5배를 넘기면 달리기

// 엄지가 처음 닿은 곳에서 (dx, dy)만큼 밀었을 때의 이동 입력. 가운데 12%는 무시(손떨림)
export function stickAxes(dx, dy) {
  const d = Math.hypot(dx, dy);
  if (d < STICK * 0.12) return { mx: 0, my: 0, run: false };
  const k = Math.min(1, d / STICK) / d;
  return { mx: dx * k, my: -dy * k, run: d > STICK * 1.5 };
}

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

  // 터치(태블릿 가로가 기준): 화면 왼쪽 40%를 엄지로 누르면 그 자리에 조이스틱이 생김(멀리 밀면 달리기), 나머지 = 끌어서 시점, 버튼 = 거미줄/당기기/점프
  const base = document.getElementById('stick'), knob = base?.firstElementChild;
  const sticks = new Map();
  const showStick = (x, y, dx = 0, dy = 0) => {
    if (!base) return;
    base.style.transform = `translate(${x}px, ${y}px)`;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    base.classList.add('on');
  };
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); // 길게 누르기 메뉴·확대를 막음
    for (const t of e.changedTouches) {
      const left = t.clientX < innerWidth * 0.4 && ![...sticks.values()].some((st) => st.left); // 왼쪽 엄지는 하나만
      sticks.set(t.identifier, { x: t.clientX, y: t.clientY, left });
      if (left) showStick(t.clientX, t.clientY);
    }
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const st = sticks.get(t.identifier); if (!st) continue;
      const dx = t.clientX - st.x, dy = t.clientY - st.y;
      if (st.left) {
        Object.assign(s, stickAxes(dx, dy));
        const k = Math.min(1, STICK / (Math.hypot(dx, dy) || 1));
        showStick(st.x, st.y, dx * k, dy * k);
      } else { look(dx, dy, 0.006); st.x = t.clientX; st.y = t.clientY; }
    }
  }, { passive: false });
  const end = (e) => {
    for (const t of e.changedTouches) {
      if (sticks.get(t.identifier)?.left) { s.mx = s.my = 0; s.run = false; base?.classList.remove('on'); }
      sticks.delete(t.identifier);
    }
  };
  canvas.addEventListener('touchend', end);
  canvas.addEventListener('touchcancel', end);

  // 버튼은 누르는 동안만 켜짐. 시스템 제스처 등으로 터치가 취소돼도(touchcancel) 꺼지게
  const btn = (id, down, up) => {
    const el = document.getElementById(id);
    el.addEventListener('touchstart', (e) => { e.preventDefault(); el.classList.add('down'); down(); });
    for (const type of ['touchend', 'touchcancel']) el.addEventListener(type, (e) => { e.preventDefault(); el.classList.remove('down'); up(); });
  };
  btn('btn-web', () => (s.web = true), () => (s.web = false));
  btn('btn-zip', () => (s.zip = true), () => (s.zip = false));
  btn('btn-jump', () => (s.jump = s.glide = true), () => (s.glide = false));
  return s;
}
