import * as THREE from 'three';

// 오리지널 주인공 "누리": 남색 슈트, 민트색 띠·장갑·부츠, 둥근 흰 헬멧에 가로 바이저 하나
// 관절(어깨·팔꿈치·엉덩이·무릎)이 있는 몸을 상태별 목표 자세로 부드럽게 따라가게 함 (애니메이션 파일 없음)
const NAVY = 0x1f2a44, MINT = 0x3fe0c5, WHITE = 0xf2f2f2;
const HIP = 0.45, LEG = 0.475, ARM = 0.3; // 발 -0.5(충돌 구 바닥) ~ 머리 1.3 → 키 1.8m
const REST = { sLx: 0, sLz: 0.12, sRx: 0, sRz: -0.12, eL: -0.15, eR: -0.15, hLx: 0, hLz: 0, hRx: 0, hRz: 0, kL: 0, kR: 0, pitch: 0, roll: 0, drop: 0 };
const clamp = THREE.MathUtils.clamp;

export function heroState(p, glide) {
  const hv = Math.hypot(p.vel.x, p.vel.z);
  if (p.zipping) return 'zip';
  if (p.anchor) return 'swing';
  if (p.climbing) return hv > 3 && hv > Math.abs(p.vel.y) ? 'wallrun' : 'climb'; // 벽을 따라 옆으로 빠르게 가면 벽 달리기
  if (p.onGround) return hv > 0.5 ? 'run' : 'idle';
  return glide && p.vel.y < 0 ? 'glide' : 'air';
}

export function createHero() {
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const navy = mat(NAVY), mint = mat(MINT);
  const add = (parent, geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
  // 위쪽 끝이 관절인 팔다리 마디: 아래로 가늘어지는 원통 + 관절 구(jm: 보호대 색)
  const seg = (len, r0, r1, parent, x, y, jm = navy) => {
    const j = new THREE.Group();
    j.position.set(x, y, 0);
    add(j, new THREE.CylinderGeometry(r0, r1, len, 8).translate(0, -len / 2, 0), navy);
    add(j, new THREE.SphereGeometry(r0 * 1.1, 8, 6), jm);
    parent.add(j);
    return j;
  };
  const root = new THREE.Group(), body = new THREE.Group(); // body: 엉덩이 기준으로 기울고 구름
  root.add(body);
  // 몸통: 허리가 들어가고 가슴·어깨가 넓은 옆선을 돌려 만들고 앞뒤로 납작하게
  const side2 = [[0.1, -0.04], [0.135, 0.04], [0.11, 0.2], [0.165, 0.42], [0.15, 0.53], [0.06, 0.58], [0.05, 0.63]].map(([r, y]) => new THREE.Vector2(r, y));
  add(body, new THREE.LatheGeometry(side2, 12).scale(1, 1, 0.7), navy);
  add(body, new THREE.CylinderGeometry(0.128, 0.138, 0.06, 12).scale(1, 1, 0.72), mint, 0, 0.06); // 띠
  for (const x of [1, -1]) add(body, new THREE.BoxGeometry(0.11, 0.028, 0.02), mint, x * 0.04, 0.4, 0.108).rotation.z = x * 0.6; // 가슴의 V 무늬
  add(body, new THREE.SphereGeometry(0.13, 14, 10).scale(1, 1.08, 1.05), mat(WHITE), 0, 0.75); // 헬멧
  // 가로 바이저: 헬멧 앞(+z)을 감싸는 띠, 조명과 무관하게 빛남
  add(body, new THREE.SphereGeometry(0.134, 10, 3, Math.PI / 2 - 1, 2, 1.2, 0.36).scale(1, 1.08, 1.05), new THREE.MeshBasicMaterial({ color: MINT }), 0, 0.75);
  for (const x of [1, -1]) add(body, new THREE.CylinderGeometry(0.035, 0.035, 0.03, 8).rotateZ(Math.PI / 2), mint, x * 0.13, 0.75);
  // 목도리: 속도에 따라 뒤로 날림
  const scarf = new THREE.Group();
  scarf.position.set(0, 0.57, -0.09);
  add(scarf, new THREE.BoxGeometry(0.11, 0.5, 0.012).translate(0, -0.25, 0), mint);
  body.add(scarf);
  const J = {}, hands = {};
  for (const [s, x] of [['L', 1], ['R', -1]]) { // 앞이 +z이므로 왼쪽이 +x
    J['s' + s] = seg(ARM, 0.062, 0.05, body, x * 0.2, 0.5, mint);
    J['e' + s] = seg(ARM, 0.05, 0.04, J['s' + s], 0, -ARM);
    hands[s] = add(J['e' + s], new THREE.SphereGeometry(0.05, 8, 6).scale(0.8, 1.2, 1), mint, 0, -ARM); // 장갑
    J['h' + s] = seg(LEG, 0.09, 0.065, body, x * 0.085, 0);
    J['k' + s] = seg(LEG, 0.065, 0.048, J['h' + s], 0, -LEG, mint); // 무릎 보호대
    add(J['k' + s], new THREE.CylinderGeometry(0.056, 0.052, 0.14, 8), mint, 0, -LEG + 0.12); // 부츠 목
    add(J['k' + s], new THREE.BoxGeometry(0.09, 0.07, 0.23), mint, 0, -LEG + 0.035, 0.05); // 부츠 발
  }

  const cur = { ...REST }, d = new THREE.Vector3();
  let prev = 'idle', side = 'L', ph = 0, time = 0, flip = 0, twist = 0, trick = 0, crouch = 0, lastVy = 0, lastYaw = 0;
  root.hand = hands.L; // 거미줄을 쥔 손

  // p: Player, glide: 활공 버튼. root의 위치·방향(rotation.y)을 정한 뒤 매 프레임 호출
  root.animate = (p, dt, glide) => {
    const st = heroState(p, glide), v = p.vel, hv = Math.hypot(v.x, v.z), T = { ...REST };
    if (st !== prev) {
      if (st === 'swing') root.hand = hands[side = side === 'L' ? 'R' : 'L']; // 스윙마다 손을 바꿈
      // 빠르게 놓으면 묘기: 앞 공중제비 → 비틀기 → 뒤 공중제비 순서로 돌아가며
      if (prev === 'swing' && st === 'air' && v.length() > 15) { if (trick % 3 === 1) twist = Math.PI * 2; else flip = (1 - (trick % 3)) * Math.PI * 2; trick++; }
      if ((st === 'run' || st === 'idle') && lastVy < -8) { crouch = 1; if (lastVy < -12 && hv > 8) flip = Math.PI * 2; } // 착지: 웅크림, 빠르면 앞구르기
      prev = st;
    }
    time += dt;
    const o = side === 'L' ? 'R' : 'L', sgn = (s) => (s === 'L' ? 1 : -1);
    if (st === 'run' || st === 'wallrun') {
      ph += hv * dt * 1.6;
      const s = Math.sin(ph), c = Math.cos(ph), a = Math.min(1, hv / 11) * 0.6 + 0.3;
      T.hLx = -s * a; T.hRx = s * a;
      T.kL = a * (0.3 + 0.9 * Math.max(0, c)); T.kR = a * (0.3 + 0.9 * Math.max(0, -c));
      T.sLx = s * a; T.sRx = -s * a; T.eL = T.eR = -0.4 - a;
      T.pitch = hv * 0.025; T.drop = 0.05 * Math.abs(c);
      if (st === 'wallrun' && p.wall) { // 벽 반대쪽으로 몸을 눕히고 벽 쪽 손으로 벽을 짚음
        const right = p.wall.x * Math.cos(root.rotation.y) - p.wall.z * Math.sin(root.rotation.y) > 0; // 벽이 오른쪽
        T.roll = right ? -0.6 : 0.6;
        T[right ? 'sRz' : 'sLz'] = right ? -1.3 : 1.3; T[right ? 'sRx' : 'sLx'] = 0; T[right ? 'eR' : 'eL'] = 0;
      }
    } else if (st === 'idle') {
      T.drop = 0.01 + Math.sin(time * 2) * 0.01; T.sLz += Math.sin(time * 2) * 0.03; T.sRz -= Math.sin(time * 2) * 0.03;
    } else if (st === 'swing' || st === 'zip') {
      // 줄 방향을 주인공 기준으로 돌려, 몸을 줄 쪽으로 기울이고 쥔 팔을 걸린 곳으로 뻗음
      d.subVectors(p.anchor, p.pos).normalize().applyAxisAngle(THREE.Object3D.DEFAULT_UP, -root.rotation.y);
      const lean = Math.atan2(d.z, Math.max(d.y, 0.01));
      if (st === 'zip') { // 두 팔을 앞으로 뻗고 날아감
        T.pitch = clamp(lean, 0.2, 1.4);
        T.sLx = T.sRx = -2.9; T.eL = T.eR = 0; T.hLx = 0.15; T.hRx = 0.3; T.kR = 0.5;
      } else {
        const k = clamp(v.y / 20, -1, 1); // 내려갈 때는 무릎을 접고, 올라갈 때는 다리를 앞으로 참
        T.pitch = clamp(lean * 0.7, -1.2, 1.2);
        T['s' + side + 'x'] = -Math.PI + lean - T.pitch; T['s' + side + 'z'] = Math.asin(clamp(d.x, -1, 1)); T['e' + side] = 0;
        T['s' + o + 'x'] = 0.6; T['s' + o + 'z'] = sgn(o) * 0.5; T['e' + o] = -0.5;
        T.hLx = -0.55 - 0.25 * k; T.kL = 0.8 - 0.6 * k; T.hRx = T.hLx + 0.5; T.kR = T.kL + 0.3;
      }
    } else if (st === 'climb') { // 팔다리를 번갈아 뻗으며 기어오름
      ph += (Math.abs(v.y) + hv) * dt * 1.5;
      const s = Math.sin(ph);
      T.sLx = -2.4 + s * 0.5; T.sRx = -2.4 - s * 0.5; T.eL = -0.8 - s * 0.4; T.eR = -0.8 + s * 0.4;
      T.hLx = -0.9 - s * 0.5; T.hRx = -0.9 + s * 0.5; T.kL = 1.4 + s * 0.4; T.kR = 1.4 - s * 0.4;
      T.hLz = 0.4; T.hRz = -0.4; T.pitch = 0.1;
    } else if (st === 'glide') { // 팔다리를 벌리고 엎드려 활공
      T.pitch = 1.2; T.sLz = 1.45; T.sRz = -1.45; T.eL = T.eR = 0; T.hLz = 0.35; T.hRz = -0.35;
    } else if (v.y > 2) { // 도약: 한 팔을 치켜들고 한 무릎을 올림
      T.sLx = -2.6; T.sRx = 0.4; T.eL = -0.3; T.hLx = -1; T.kL = 1.3; T.hRx = 0.3; T.kR = 0.2; T.pitch = -0.1;
    } else { // 낙하: 떨어질수록 앞으로 숙임
      T.pitch = clamp(-v.y * 0.02, -0.3, 0.9);
      T.sLx = T.sRx = -0.5; T.sLz = 1; T.sRz = -1; T.hLx = -0.5; T.kL = 0.9; T.hRx = 0.2; T.kR = 0.5;
    }
    // 방향을 틀면 그쪽으로 몸을 기울임
    const dy = THREE.MathUtils.euclideanModulo(root.rotation.y - lastYaw + Math.PI, Math.PI * 2) - Math.PI;
    if (dt > 0 && st !== 'climb' && st !== 'wallrun') T.roll = clamp((-dy / dt) * 0.06, -0.5, 0.5);
    lastYaw = root.rotation.y; lastVy = v.y;
    if (Math.abs(flip) > 0.3) Object.assign(T, { hLx: -1.7, hRx: -1.7, kL: 2.1, kR: 2.1, sLx: -0.9, sRx: -0.9, eL: -1.6, eR: -1.6 }); // 구르는 동안 몸을 말아 쥠
    if (twist > 0.3) Object.assign(T, { sLx: -0.4, sRx: -0.4, sLz: 0.1, sRz: -0.1, eL: -2, eR: -2, hLx: 0, hRx: 0, kL: 0.1, kR: 0.1, pitch: 0.2 }); // 비트는 동안 팔을 모음

    const a = 1 - Math.exp(-dt * 14);
    for (const k in cur) cur[k] += (T[k] - cur[k]) * a;
    flip -= Math.sign(flip) * Math.min(Math.abs(flip), dt * 9);
    twist = Math.max(0, twist - dt * 11);
    crouch = Math.max(0, crouch - dt * 3);
    const th = crouch * 0.9;
    for (const s of ['L', 'R']) {
      J['s' + s].rotation.set(cur['s' + s + 'x'], 0, cur['s' + s + 'z']);
      J['e' + s].rotation.x = cur['e' + s];
      J['h' + s].rotation.set(cur['h' + s + 'x'] - th, 0, cur['h' + s + 'z']);
      J['k' + s].rotation.x = cur['k' + s] + th * 2;
    }
    body.position.y = HIP - cur.drop - LEG * 2 * (1 - Math.cos(th));
    body.rotation.set(cur.pitch + flip, twist, cur.roll);
    const sp = v.length();
    scarf.rotation.x = Math.min(1.5, sp * 0.08) - cur.pitch * 0.7 + Math.sin(time * 12) * 0.12 * Math.min(1, sp / 10);
    root.updateMatrixWorld(true); // 손 위치를 바로 읽을 수 있게
  };
  root.animate({ vel: new THREE.Vector3(), onGround: true }, 0, false);
  return root;
}
