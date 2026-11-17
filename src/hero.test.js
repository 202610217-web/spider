import assert from 'node:assert';
import * as THREE from 'three';
import { createHero, heroState, rigModel, landingKind } from './hero.js';

const P = (o) => ({ vel: new THREE.Vector3(), pos: new THREE.Vector3(), anchor: null, zipping: false, climbing: false, onGround: false, ...o });
const v = (x, y, z) => new THREE.Vector3(x, y, z);

assert.equal(heroState(P({ onGround: true })), 'idle');
assert.equal(heroState(P({ onGround: true, vel: v(5, 0, 0) })), 'run');
assert.equal(heroState(P({ anchor: v(0, 30, 0) })), 'swing');
assert.equal(heroState(P({ anchor: v(0, 30, 0), zipping: true })), 'zip');
assert.equal(heroState(P({ climbing: true })), 'climb');
assert.equal(heroState(P({ climbing: true, vel: v(7, 1, 0) })), 'wallrun');
assert.equal(heroState(P({ vel: v(0, -5, 0) }), true), 'glide');
assert.equal(heroState(P({ vel: v(0, -5, 0) }), false), 'air');

// 모든 상태에서 자세 값이 유한하고, 발이 충돌 구 바닥(-0.5) 근처, 머리가 1.3 근처(키 1.8m)
const hero = createHero();
const box = new THREE.Box3().setFromObject(hero);
assert.ok(Math.abs(box.min.y + 0.5) < 0.1 && Math.abs(box.max.y - 1.3) < 0.1, `키 ${box.min.y} ~ ${box.max.y}`);
const hand = v();
for (const p of [P({ onGround: true, vel: v(0, 0, 11) }), P({ climbing: true, vel: v(0, 7, 0) }), P({ climbing: true, wall: v(1, 0, 0), vel: v(0, 0, 7) }), P({ vel: v(0, 8, 5) }), P({ vel: v(0, -30, 20) }), P({ anchor: v(0, 30, 40), zipping: true }), P({ anchor: v(3, 30, 10), vel: v(0, -10, 30) })]) {
  for (let i = 0; i < 120; i++) hero.animate(p, 1 / 60, true);
  hero.traverse((o) => assert.ok([o.rotation.x, o.rotation.z, o.position.y].every(Number.isFinite)));
}
// 놓기 묘기 3종과 착지 구르기 도중에도 값이 유한
for (let t = 0; t < 3; t++) for (const p of [P({ anchor: v(0, 30, 10), vel: v(0, 0, 30) }), P({ vel: v(0, -20, 30) }), P({ onGround: true, vel: v(0, 0, 11) })]) {
  for (let i = 0; i < 5; i++) hero.animate(p, 1 / 60, false);
  hero.traverse((o) => assert.ok(o.rotation.toArray().slice(0, 3).every(Number.isFinite)));
}
for (let i = 0; i < 120; i++) hero.animate(P({ anchor: v(3, 30, 10), vel: v(0, -10, 30) }), 1 / 60, true);
// 스윙: 쥔 손이 머리 위로, 걸린 곳 쪽(앞)으로 뻗음
hero.hand.getWorldPosition(hand);
assert.ok(hand.y > 0.9 && hand.z > 0, `스윙 손 위치 ${hand.toArray()}`);

// 착지: 떨어지던 속도·수평 속도에 따라 다른 자세
assert.equal(landingKind(-3, 0), null);
assert.equal(landingKind(-8, 2), 'soft');
assert.equal(landingKind(-15, 2), 'crouch');
assert.equal(landingKind(-22, 2), 'hero');
assert.equal(landingKind(-40, 2), 'impact');
assert.equal(landingKind(-15, 9), 'roll');
const h2 = createHero(), handR = v();
for (let i = 0; i < 60; i++) h2.animate(P({ vel: v(0, -25, 0) }), 1 / 60, false); // 높은 데서 수직으로 떨어지다
for (let i = 0; i < 18; i++) h2.animate(P({ onGround: true }), 1 / 60, false);   // 착지 0.3초 뒤
assert.equal(h2.landing(), 'hero');
h2.updateMatrixWorld(true);
h2.traverse((o) => { if (o.isMesh && o.geometry.type === 'SphereGeometry' && o.position.y === -0.3 && o.parent.parent.position.x < 0) o.getWorldPosition(handR); });
assert.ok(handR.y < -0.3, `영웅 착지: 오른손이 땅 가까이 ${handR.y}`);
for (let i = 0; i < 60; i++) h2.animate(P({ onGround: true }), 1 / 60, false);
assert.equal(h2.landing(), null, '착지 자세는 끝나면 풀림');
// 경사: 오르막을 달리면 평지보다 앞으로 더 숙임
const pitchOn = (ground) => {
  const h = createHero();
  for (let i = 0; i < 90; i++) h.animate({ ...P({ onGround: true, vel: v(0, 0, 8) }), groundAt: ground }, 1 / 60, false);
  return h.children[0].rotation.x;
};
const flat = pitchOn(() => -0.5), upHill = pitchOn((x, z) => -0.5 + z * 0.4), downHill = pitchOn((x, z) => -0.5 - z * 0.4);
assert.ok(upHill > flat + 0.1 && downHill < flat - 0.1, `경사: 오르막 ${upHill} 평지 ${flat} 내리막 ${downHill}`);

// 뼈대 연결: A자 자세(팔이 45° 벌어짐, 뼈 자체도 돌아가 있음)인 가짜 뼈대에서 자세 값 0 → 팔다리가 똑바로 아래로, 팔꿈치 -90° → 팔뚝이 앞(+z)으로
const bone = (name, parent, x, y, z, rz = 0) => { const o = new THREE.Bone(); o.name = name; o.position.set(x, y, z); o.rotation.z = rz; parent.add(o); return o; };
const model = new THREE.Group(), arm = new THREE.Group(); arm.scale.setScalar(0.01); model.add(arm);
const hips = bone('Hips', arm, 0, 100, 0);
for (const [side, sx] of [['Left', 1], ['Right', -1]]) {
  const up = bone(side + 'Arm', hips, sx * 20, 40, 0, sx * 0.7), fore = bone(side + 'ForeArm', up, 0, -25, 0, sx * 0.1); bone(side + 'Hand', fore, 0, -25, 0);
  const leg = bone(side + 'UpLeg', hips, sx * 10, 0, 0, sx * 0.1), shin = bone(side + 'Leg', leg, 0, -40, 0); bone(side + 'Foot', shin, 0, -40, 0);
}
assert.equal(rigModel(new THREE.Group()), null, '뼈가 없으면 null');
const rig = rigModel(model), at = (n) => model.getObjectByName(n).getWorldPosition(v());
for (const n of ['sL', 'eL', 'hL', 'kL', 'sR', 'eR', 'hR', 'kR']) rig.set(n, 0, 0);
model.updateMatrixWorld(true);
for (const side of ['Left', 'Right']) {
  const [a, f, h2] = [at(side + 'Arm'), at(side + 'ForeArm'), at(side + 'Hand')];
  assert.ok(Math.abs(f.x - a.x) < 1e-6 && Math.abs(h2.x - a.x) < 1e-6 && Math.abs(a.y - h2.y - 0.5) < 1e-6, `${side} 팔이 똑바로 아래로: ${h2.toArray()}`);
  assert.ok(Math.abs(at(side + 'Foot').x - at(side + 'UpLeg').x) < 1e-6, '다리도 아래로');
}
rig.set('eL', -Math.PI / 2); rig.set('sR', -Math.PI / 2); model.updateMatrixWorld(true);
const fl = at('LeftForeArm'), hl = at('LeftHand');
assert.ok(Math.abs(hl.z - fl.z - 0.25) < 1e-6 && Math.abs(hl.y - fl.y) < 1e-6, `팔꿈치를 굽히면 팔뚝이 앞으로: ${hl.toArray()}`);
assert.ok(Math.abs(at('RightHand').z - at('RightArm').z - 0.5) < 1e-6, '어깨를 앞으로 들면 팔 전체가 앞으로(팔뚝도 따라감)');
console.log('hero ok');
