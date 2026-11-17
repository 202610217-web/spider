import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// 오리지널 주인공 "누리". 3D 모델(public/models/nuri.glb, Higgsfield로 만든 오리지널 디자인)을 쓰고, 아래 도형 몸은 모델을 받기 전·못 받았을 때의 기본 모양
// 기본 모양: 남색 슈트, 민트색 띠·장갑·부츠, 둥근 흰 헬멧에 가로 바이저 하나
// 관절(어깨·팔꿈치·엉덩이·무릎)이 있는 몸을 상태별 목표 자세로 부드럽게 따라가게 함 (애니메이션 파일 없음)
const NAVY = 0x1f2a44, MINT = 0x3fe0c5, WHITE = 0xf2f2f2;
const HIP = 0.45, LEG = 0.475, ARM = 0.3; // 발 -0.5(충돌 구 바닥) ~ 머리 1.3 → 키 1.8m
const REST = { sLx: 0, sLz: 0.12, sRx: 0, sRz: -0.12, eL: -0.15, eR: -0.15, hLx: 0, hLz: 0, hRx: 0, hRz: 0, kL: 0, kR: 0, pitch: 0, roll: 0, drop: 0, yaw: 0 };
const BODY = new Set(['pitch', 'roll', 'yaw']); // 몸통은 팔다리보다 천천히 따라감(무게감)
// 쪼그려 앉기: 엉덩이를 th만큼 굽히면 무릎은 2배, 몸은 발이 땅에 붙은 채로 그만큼 내려감
const squat = (th) => ({ hLx: -th, hRx: -th, kL: 2 * th, kR: 2 * th, drop: 2 * LEG * (1 - Math.cos(th)) });
// 착지 자세: 떨어지던 속도(vy, 음수)와 그때의 수평 속도(hv)로 고름. dur: 자세를 잡고 일어서기까지(초)
export const LANDINGS = {
  soft: { dur: 0.3, pose: { ...squat(0.4), sLx: -0.25, sRx: -0.25, pitch: 0.12 } },                                     // 가볍게 무릎만
  crouch: { dur: 0.5, pose: { ...squat(0.85), sLx: -0.8, sRx: -0.8, sLz: 0.5, sRz: -0.5, eL: -0.5, eR: -0.5, pitch: 0.35 } }, // 두 팔을 벌려 균형
  hero: { dur: 0.75, pose: { drop: 0.72, hLx: -1.5, kL: 1.9, hRx: 0.15, kR: 2.3, hRz: -0.15, sRx: -0.5, eR: -0.1, sRz: -0.1, sLx: 0.9, sLz: 0.7, eL: -0.4, pitch: 0.55 } }, // 한 무릎·한 손을 땅에 짚는 세 점 착지
  impact: { dur: 0.95, pose: { ...squat(1.05), sLx: -1.15, sRx: -1.15, sLz: 0.3, sRz: -0.3, eL: -0.2, eR: -0.2, pitch: 0.75 } }, // 아주 높은 데서: 두 손으로 땅을 짚음
};
export function landingKind(vy, hv) {
  if (vy > -5) return null;
  if (vy < -11 && hv >= 7) return 'roll'; // 빠르게 달려 들어오면 앞구르기로 충격을 흘림
  if (vy > -11) return 'soft';
  if (vy > -18) return 'crouch';
  return vy > -30 ? 'hero' : 'impact';
}
const clamp = THREE.MathUtils.clamp;

// 뼈대 있는 모델(public/models/nuri.glb)을 아래 자세 값 그대로 움직이게 연결. 뼈 이름은 Left/Right + Arm·ForeArm·Hand·UpLeg·Leg·Foot
// 자세 값은 "팔다리가 똑바로 아래로 늘어진 상태에서 주인공 기준 x·z축으로 얼마나 돌리나"이므로,
// 뼈마다 쉬는 자세(A자)의 방향을 아래로 맞추는 회전(align)을 먼저 구해 두고 그 위에 자세 회전을 얹음
// 돌려주는 값: { hands: { L, R }, set(관절 이름 예 'sL', x, z) } — 뼈가 없으면 null. model은 아직 어디에도 붙이지 않은(회전 없는) 상태여야 함
const LIMBS = { s: ['Arm', 'ForeArm'], e: ['ForeArm', 'Hand'], h: ['UpLeg', 'Leg'], k: ['Leg', 'Foot'] }, UPPER = { e: 's', k: 'h' };
export function rigModel(model) {
  model.updateMatrixWorld(true);
  const rig = {}, a = new THREE.Vector3(), b = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0);
  for (const [s, side] of [['L', 'Left'], ['R', 'Right']]) for (const key in LIMBS) {
    const o = model.getObjectByName(side + LIMBS[key][0]), child = model.getObjectByName(side + LIMBS[key][1]);
    if (!o || !child) return null;
    const qw = o.getWorldQuaternion(new THREE.Quaternion());
    rig[key + s] = { o, rest: o.quaternion.clone(), qw, qwInv: qw.clone().invert(), align: new THREE.Quaternion().setFromUnitVectors(child.getWorldPosition(a).sub(o.getWorldPosition(b)).normalize(), down) };
  }
  const e = new THREE.Euler(), r = new THREE.Quaternion(), q = new THREE.Quaternion();
  return {
    hands: { L: model.getObjectByName('LeftHand'), R: model.getObjectByName('RightHand') },
    set(name, x, z = 0) {
      const j = rig[name], up = UPPER[name[0]] && rig[UPPER[name[0]] + name[1]];
      r.setFromEuler(e.set(x, 0, z)).multiply(j.align);             // 모델 기준 회전 = 자세 × 아래로 맞춤
      if (up) r.premultiply(q.copy(up.align).invert());              // 아래 마디: 위 마디가 이미 맞춘 만큼은 뺌
      j.o.quaternion.copy(j.rest).multiply(j.qwInv).multiply(r).multiply(j.qw); // 뼈 자신의 축으로 옮겨 적용
    },
  };
}

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
  let prev = 'idle', side = 'L', ph = 0, time = 0, flip = 0, twist = 0, trick = 0, lastVy = 0, lastHv = 0, lastYaw = 0, airT = 0, slope = 0;
  let land = null; // 지금 하는 착지 자세 { kind, t }
  let rig = null; // 3D 모델이 붙으면 그 뼈대
  root.hand = hands.L; // 거미줄을 쥔 손
  // 3D 모델로 바꿈: 기본 모양(도형)을 숨기고 같은 자리에 붙임. 모델은 발이 원점·키 1.8m·앞이 +z
  root.setModel = (model) => {
    const r = rigModel(model);
    if (!r) return console.warn('누리 모델에 필요한 뼈가 없음 — 기본 모양을 씀');
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.material = new THREE.MeshLambertMaterial({ map: o.material.map, emissive: 0xffffff, emissiveMap: o.material.map, emissiveIntensity: 0.3 }); // 다른 물체와 같은 조명 + 어두운 곳에서도 색이 보이게
      o.frustumCulled = false; // 뼈로 움직이면 원래 경계 상자가 맞지 않음
    });
    for (const c of body.children) c.visible = false;
    model.position.y = -0.5 - HIP; // body(엉덩이 높이) 기준: 발이 충돌 구 바닥에
    body.add(model);
    rig = r;
    root.hand = rig.hands[side];
  };

  // p: Player, glide: 활공 버튼. root의 위치·방향(rotation.y)을 정한 뒤 매 프레임 호출
  root.animate = (p, dt, glide) => {
    const st = heroState(p, glide), v = p.vel, hv = Math.hypot(v.x, v.z), T = { ...REST };
    const grounded = st === 'run' || st === 'idle';
    if (st !== prev) {
      if (st === 'swing') root.hand = (rig?.hands ?? hands)[side = side === 'L' ? 'R' : 'L']; // 스윙마다 손을 바꿈
      // 빠르게 놓으면 묘기: 앞 공중제비 → 비틀기 → 뒤 공중제비 순서로 돌아가며
      if (prev === 'swing' && st === 'air' && v.length() > 15) { if (trick % 3 === 1) twist = Math.PI * 2; else flip = (1 - (trick % 3)) * Math.PI * 2; trick++; }
      if (grounded && !(prev === 'run' || prev === 'idle')) { // 착지: 떨어지던 속도에 따라 다른 자세
        const kind = landingKind(lastVy, lastHv);
        if (kind === 'roll') flip = Math.PI * 2;
        land = kind && kind !== 'roll' ? { kind, t: 0 } : null;
      }
      prev = st;
    }
    time += dt;
    airT = grounded || st === 'climb' || st === 'wallrun' ? 0 : airT + dt;
    // 땅의 기울기(진행 방향으로 1m에 몇 m 오르나): 오르막은 숙이고 보폭을 줄이며, 내리막은 몸을 젖힘. 옥상 위에서는 0
    slope = 0;
    if (grounded && hv > 0.5 && p.groundAt) {
      const ux = v.x / hv, uz = v.z / hv, g = (x, z) => p.groundAt(x, z, p.pos.y);
      if (p.pos.y - 0.5 - g(p.pos.x, p.pos.z) < 0.3) slope = clamp((g(p.pos.x + ux * 1.5, p.pos.z + uz * 1.5) - g(p.pos.x - ux * 1.5, p.pos.z - uz * 1.5)) / 3, -1, 1);
    }
    const o = side === 'L' ? 'R' : 'L', sgn = (s) => (s === 'L' ? 1 : -1);
    if (st === 'run' || st === 'wallrun') {
      // 걷기(약 5m/s)에서 달리기(11m/s)로 섞음 g. 걸음 수는 속도에 따라 초당 3걸음(걷기)~4.7걸음(전력 질주), 오르막은 잦게
      const g = clamp((hv - 4) / 5, 0, 1), up = Math.max(0, slope);
      ph += dt * 2 * Math.PI * (0.9 + hv * 0.13) * (1 + up * 0.3);
      const s = Math.sin(ph), c = Math.cos(ph), a = (0.45 + 0.35 * g) * (1 - Math.max(0, -slope) * 0.3);
      T.hLx = -s * a - up * 0.3; T.hRx = s * a - up * 0.3;                               // 오르막: 다리를 더 들어 올림
      T.kL = 0.12 + 0.2 * g + (0.5 + 0.9 * g + up * 0.6) * Math.max(0, c); T.kR = 0.12 + 0.2 * g + (0.5 + 0.9 * g + up * 0.6) * Math.max(0, -c); // 앞으로 내딛는 다리만 무릎을 접음
      T.sLx = s * a * 0.9; T.sRx = -s * a * 0.9; T.eL = T.eR = -0.25 - 1.15 * g;            // 팔은 다리와 엇갈려 흔듦, 달리면 팔꿈치를 접음
      T.sLz = 0.1 + 0.05 * g; T.sRz = -0.1 - 0.05 * g;
      T.pitch = 0.04 + 0.2 * g + slope * 0.45;                                               // 달릴수록·오르막일수록 앞으로 숙임
      T.drop = (0.02 + 0.04 * g) * Math.abs(c); T.yaw = -s * (0.08 + 0.1 * g);               // 위아래 출렁임과 상체 비틀림
      if (st === 'wallrun' && p.wall) { // 벽 반대쪽으로 몸을 눕히고 벽 쪽 손으로 벽을 짚음
        const right = p.wall.x * Math.cos(root.rotation.y) - p.wall.z * Math.sin(root.rotation.y) > 0; // 벽이 오른쪽
        T.roll = right ? -0.6 : 0.6;
        T[right ? 'sRz' : 'sLz'] = right ? -1.3 : 1.3; T[right ? 'sRx' : 'sLx'] = 0; T[right ? 'eR' : 'eL'] = 0;
      }
    } else if (st === 'idle') { // 숨쉬기와 몇 초마다 무게를 한쪽 다리로 옮김
      const b = Math.sin(time * 1.7), w = Math.sin(time * 0.45);
      T.drop = 0.012 + b * 0.006; T.sLz += b * 0.025; T.sRz -= b * 0.025; T.pitch = 0.02 + b * 0.01;
      T.roll = w * 0.04; T.kL = 0.06 + 0.12 * Math.max(0, w); T.kR = 0.06 + 0.12 * Math.max(0, -w); T.hLz = 0.04; T.hRz = -0.04;
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
        T.yaw = Math.asin(clamp(d.x, -1, 1)) * 0.4; // 줄 쪽으로 상체를 돌림
      }
    } else if (st === 'climb') { // 팔다리를 번갈아 뻗으며 기어오름
      ph += (Math.abs(v.y) + hv) * dt * 1.5;
      const s = Math.sin(ph);
      T.sLx = -2.4 + s * 0.5; T.sRx = -2.4 - s * 0.5; T.eL = -0.8 - s * 0.4; T.eR = -0.8 + s * 0.4;
      T.hLx = -0.9 - s * 0.5; T.hRx = -0.9 + s * 0.5; T.kL = 1.4 + s * 0.4; T.kR = 1.4 - s * 0.4;
      T.hLz = 0.4; T.hRz = -0.4; T.pitch = 0.1;
    } else if (st === 'glide') { // 팔다리를 벌리고 엎드려 활공, 바람에 조금씩 흔들림
      const f = Math.sin(time * 9) * 0.04;
      T.pitch = 1.2; T.sLz = 1.45 + f; T.sRz = -1.45 - f; T.eL = T.eR = 0; T.hLz = 0.35; T.hRz = -0.35; T.kL = 0.15 + f; T.kR = 0.15 - f;
    } else if (v.y > 2) { // 도약: 한 팔을 치켜들고 한 무릎을 올림
      T.sLx = -2.6; T.sRx = 0.4; T.eL = -0.3; T.hLx = -1; T.kL = 1.3; T.hRx = 0.3; T.kR = 0.2; T.pitch = -0.1;
    } else if (airT > 0.9 && v.y < -12) { // 오래 떨어지면 팔다리를 휘저으며 균형을 잡음
      const w = time * 7;
      T.pitch = 0.3; T.sLx = -1.3 + Math.sin(w) * 0.7; T.sRx = -1.3 + Math.sin(w + Math.PI) * 0.7; T.sLz = 0.9; T.sRz = -0.9; T.eL = T.eR = -0.6;
      T.hLx = -0.6 + Math.sin(w * 0.8) * 0.45; T.hRx = -0.6 - Math.sin(w * 0.8) * 0.45; T.kL = T.kR = 0.9;
    } else { // 낙하: 떨어질수록 앞으로 숙이고 착지할 다리를 내림
      T.pitch = clamp(-v.y * 0.02, -0.3, 0.9);
      T.sLx = T.sRx = -0.5; T.sLz = 1; T.sRz = -1; T.hLx = -0.5; T.kL = 0.9; T.hRx = 0.2; T.kR = 0.5;
    }
    // 방향을 틀면 그쪽으로 몸을 기울임
    const dy = THREE.MathUtils.euclideanModulo(root.rotation.y - lastYaw + Math.PI, Math.PI * 2) - Math.PI;
    if (dt > 0 && st !== 'climb' && st !== 'wallrun' && st !== 'idle') T.roll = clamp((-dy / dt) * 0.06, -0.5, 0.5);
    lastYaw = root.rotation.y; lastVy = v.y; lastHv = hv;
    // 착지 자세: 순식간에 내려앉았다가 버티고 천천히 일어섬. 영웅 착지·충격 착지 중에 움직이기 시작하면 바로 일어섬
    if (land) {
      const L = LANDINGS[land.kind];
      if (hv > 1.5 && land.t > 0.15 && land.t < L.dur * 0.6) land.t = L.dur * 0.6;
      land.t += dt;
      const t = land.t / L.dur, w = t < 0.12 ? t / 0.12 : t < 0.6 ? 1 : Math.max(0, (1 - t) / 0.4);
      for (const k in L.pose) T[k] += (L.pose[k] - T[k]) * w;
      if (t >= 1) land = null;
    }
    if (Math.abs(flip) > 0.3) Object.assign(T, { hLx: -1.7, hRx: -1.7, kL: 2.1, kR: 2.1, sLx: -0.9, sRx: -0.9, eL: -1.6, eR: -1.6 }); // 구르는 동안 몸을 말아 쥠
    if (twist > 0.3) Object.assign(T, { sLx: -0.4, sRx: -0.4, sLz: 0.1, sRz: -0.1, eL: -2, eR: -2, hLx: 0, hRx: 0, kL: 0.1, kR: 0.1, pitch: 0.2 }); // 비트는 동안 팔을 모음

    // 따라가는 빠르기: 걸음처럼 계속 바뀌는 동작은 빠르게, 자세가 바뀔 때는 부드럽게, 착지는 순간적으로
    const fast = st === 'run' || st === 'climb' || st === 'wallrun' || (land && land.t < 0.1);
    const aL = 1 - Math.exp(-dt * (fast ? 22 : 10)), aB = 1 - Math.exp(-dt * (land ? 16 : 7));
    for (const k in cur) cur[k] += (T[k] - cur[k]) * (BODY.has(k) ? aB : aL);
    flip -= Math.sign(flip) * Math.min(Math.abs(flip), dt * 9);
    twist = Math.max(0, twist - dt * 11);
    for (const s of ['L', 'R']) {
      J['s' + s].rotation.set(cur['s' + s + 'x'], 0, cur['s' + s + 'z']);
      J['e' + s].rotation.x = cur['e' + s];
      J['h' + s].rotation.set(cur['h' + s + 'x'], 0, cur['h' + s + 'z']);
      J['k' + s].rotation.x = cur['k' + s];
      if (rig) {
        rig.set('s' + s, cur['s' + s + 'x'], cur['s' + s + 'z']); rig.set('e' + s, cur['e' + s]);
        rig.set('h' + s, cur['h' + s + 'x'], cur['h' + s + 'z']); rig.set('k' + s, cur['k' + s]);
      }
    }
    body.position.y = HIP - cur.drop;
    body.rotation.set(cur.pitch + flip, twist + cur.yaw, cur.roll);
    const sp = v.length();
    scarf.rotation.x = Math.min(1.5, sp * 0.08) - cur.pitch * 0.7 + Math.sin(time * 12) * 0.12 * Math.min(1, sp / 10);
    root.updateMatrixWorld(true); // 손 위치를 바로 읽을 수 있게
  };
  root.landing = () => land?.kind ?? null; // 지금 하는 착지 자세 (시험용)
  root.animate({ vel: new THREE.Vector3(), onGround: true }, 0, false);
  // 브라우저에서는 3D 모델을 받아 바꿈 (못 받으면 기본 모양 그대로)
  if (typeof document !== 'undefined') new GLTFLoader().load(`${import.meta.env.BASE_URL}models/nuri.glb`, (g) => root.setModel(g.scene), undefined, (e) => console.warn('누리 모델을 못 불러옴 — 기본 모양을 씀', e));
  return root;
}
