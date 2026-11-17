import * as THREE from 'three';

// 오리지널 주인공 "누리": 남색 슈트, 민트색 띠·장갑·부츠, 둥근 흰 헬멧에 가로 바이저 하나
// 관절(어깨·팔꿈치·엉덩이·무릎)이 있는 몸을 상태별 목표 자세로 부드럽게 따라가게 함 (애니메이션 파일 없음)
const NAVY = 0x1f2a44, MINT = 0x3fe0c5, WHITE = 0xf2f2f2;
const HIP = 0.45, LEG = 0.475, ARM = 0.3; // 발 -0.5(충돌 구 바닥) ~ 머리 1.3 → 키 1.8m
const REST = { sLx: 0, sLz: 0.12, sRx: 0, sRz: -0.12, eL: -0.15, eR: -0.15, hLx: 0, hLz: 0, hRx: 0, hRz: 0, kL: 0, kR: 0, pitch: 0, roll: 0, drop: 0 };
const clamp = THREE.MathUtils.clamp;

export function heroState(p, glide) {
  if (p.zipping) return 'zip';
  if (p.anchor) return 'swing';
  if (p.climbing) return 'climb';
  if (p.onGround) return Math.hypot(p.vel.x, p.vel.z) > 0.5 ? 'run' : 'idle';
  return glide && p.vel.y < 0 ? 'glide' : 'air';
}

export function createHero() {
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const navy = mat(NAVY), mint = mat(MINT);
  // 위쪽 끝이 관절인 팔다리 마디
  const seg = (len, r, m, parent, x = 0, y = 0) => {
    const j = new THREE.Group();
    j.position.set(x, y, 0);
    j.add(new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 8).translate(0, -len / 2, 0), m));
    parent.add(j);
    return j;
  };
  const root = new THREE.Group(), body = new THREE.Group(); // body: 엉덩이 기준으로 기울고 구름
  root.add(body);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.3, 4, 8), navy);
  torso.position.y = 0.3;
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.07, 12), mint);
  belt.position.y = 0.06;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), mat(WHITE));
  head.position.y = 0.7;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.06), mint);
  visor.position.set(0, 0.72, 0.13); // 앞 = +z
  body.add(torso, belt, head, visor);
  const J = {}, hands = {};
  for (const [s, x] of [['L', 1], ['R', -1]]) { // 앞이 +z이므로 왼쪽이 +x
    J['s' + s] = seg(ARM, 0.06, navy, body, x * 0.24, 0.5);
    J['e' + s] = seg(ARM, 0.055, mint, J['s' + s], 0, -ARM);
    hands[s] = new THREE.Object3D();
    hands[s].position.y = -ARM;
    J['e' + s].add(hands[s]);
    J['h' + s] = seg(LEG, 0.085, navy, body, x * 0.1, 0);
    J['k' + s] = seg(LEG, 0.07, mint, J['h' + s], 0, -LEG);
  }

  const cur = { ...REST }, d = new THREE.Vector3();
  let prev = 'idle', side = 'L', ph = 0, time = 0, flip = 0, crouch = 0, lastVy = 0, lastYaw = 0;
  root.hand = hands.L; // 거미줄을 쥔 손

  // p: Player, glide: 활공 버튼. root의 위치·방향(rotation.y)을 정한 뒤 매 프레임 호출
  root.animate = (p, dt, glide) => {
    const st = heroState(p, glide), v = p.vel, hv = Math.hypot(v.x, v.z), T = { ...REST };
    if (st !== prev) {
      if (st === 'swing') root.hand = hands[side = side === 'L' ? 'R' : 'L']; // 스윙마다 손을 바꿈
      if (prev === 'swing' && st === 'air' && v.length() > 15) flip = Math.PI * 2; // 빠르게 놓으면 앞으로 한 바퀴
      if ((st === 'run' || st === 'idle') && lastVy < -8) crouch = 1; // 착지 충격으로 웅크림
      prev = st;
    }
    time += dt;
    const o = side === 'L' ? 'R' : 'L', sgn = (s) => (s === 'L' ? 1 : -1);
    if (st === 'run') {
      ph += hv * dt * 1.6;
      const s = Math.sin(ph), c = Math.cos(ph), a = Math.min(1, hv / 11) * 0.6 + 0.3;
      T.hLx = -s * a; T.hRx = s * a;
      T.kL = a * (0.3 + 0.9 * Math.max(0, c)); T.kR = a * (0.3 + 0.9 * Math.max(0, -c));
      T.sLx = s * a; T.sRx = -s * a; T.eL = T.eR = -0.4 - a;
      T.pitch = hv * 0.025; T.drop = 0.05 * Math.abs(c);
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
    } else { // 공중: 떨어질수록 앞으로 숙임
      T.pitch = clamp(-v.y * 0.02, -0.3, 0.9);
      T.sLx = T.sRx = -0.5; T.sLz = 1; T.sRz = -1; T.hLx = -0.5; T.kL = 0.9; T.hRx = 0.2; T.kR = 0.5;
    }
    // 방향을 틀면 그쪽으로 몸을 기울임
    const dy = THREE.MathUtils.euclideanModulo(root.rotation.y - lastYaw + Math.PI, Math.PI * 2) - Math.PI;
    if (dt > 0 && st !== 'climb') T.roll = clamp((-dy / dt) * 0.06, -0.5, 0.5);
    lastYaw = root.rotation.y; lastVy = v.y;

    const a = 1 - Math.exp(-dt * 14);
    for (const k in cur) cur[k] += (T[k] - cur[k]) * a;
    flip = Math.max(0, flip - dt * 9);
    crouch = Math.max(0, crouch - dt * 3);
    const th = crouch * 0.9;
    for (const s of ['L', 'R']) {
      J['s' + s].rotation.set(cur['s' + s + 'x'], 0, cur['s' + s + 'z']);
      J['e' + s].rotation.x = cur['e' + s];
      J['h' + s].rotation.set(cur['h' + s + 'x'] - th, 0, cur['h' + s + 'z']);
      J['k' + s].rotation.x = cur['k' + s] + th * 2;
    }
    body.position.y = HIP - cur.drop - LEG * 2 * (1 - Math.cos(th));
    body.rotation.set(cur.pitch + flip, 0, cur.roll);
    root.updateMatrixWorld(true); // 손 위치를 바로 읽을 수 있게
  };
  root.animate({ vel: new THREE.Vector3(), onGround: true }, 0, false);
  return root;
}
