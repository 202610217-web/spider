import * as THREE from 'three';
import { Player, R } from './player.js';
import { createTiles } from './tiles.js';
import { S, lonLatToTile } from './tile.js';
import { createInput } from './input.js';
import { createHero, heroState } from './hero.js';
import { createGovernor } from './perf.js';
import { findAnchor } from './web.js';
import { rayHit } from './collide.js';
import { createMinimap } from './minimap.js';
import { setupCities } from './cities.js';

const WEB_RANGE = 80, STEP = 1 / 120, CAM_DIST = 9, FOV = 65;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
const maxRatio = Math.min(devicePixelRatio, 2), governor = createGovernor(maxRatio, maxRatio * 0.5);
renderer.setPixelRatio(maxRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.autoUpdate = false; // 해와 건물은 안 움직이므로 그림자 지도는 자리를 옮길 때만 다시 그림
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9cc3e6);
scene.fog = new THREE.Fog(0x9cc3e6, 300, 950); // 로드 반경(약 1km) 밖은 안개로 가림
scene.add(new THREE.HemisphereLight(0xffffff, 0x667755, 1.5));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
const SUN = new THREE.Vector3(300, 500, 200), SHADOW = 220, SNAP = 40; // 그림자는 주인공 주변 ±220m만, 40m 움직일 때마다 다시 맞춤
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -SHADOW, right: SHADOW, top: SHADOW, bottom: -SHADOW, near: 1, far: 2500 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.5;
scene.add(sun, sun.target);
let shadowDirty = true;

const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 1000); // 안개(950m)에 완전히 가려지는 먼 타일은 그리지 않음
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// 시작 위치: ?ll=위도,경도 (기본 광화문)
const [lat, lon] = (new URLSearchParams(location.search).get('ll') ?? '37.5759,126.9768').split(',').map(Number);
const [fx, fy] = lonLatToTile(lon, lat);
const ox = Math.floor(fx), oy = Math.floor(fy);
const player = new Player([]);
let all = []; // 불러온 모든 타일의 충돌체. 물리·조준·카메라는 가까운 것(near)만 봄
player.pos.set((fx - ox) * S, 50, (fy - oy) * S);
let ready = false; // 시작 타일이 뜨기 전에는 물리를 멈춤
const tiles = createTiles(scene, ox, oy, (colliders) => {
  all = colliders;
  frame = 0; // 다음 프레임에 near를 다시 고름
  shadowDirty = true;
  if (!ready && (ready = true)) player.pos.y = tiles.groundAt(player.pos.x, player.pos.z) + 50;
});
player.groundAt = tiles.groundAt;
const hero = createHero();
scene.add(hero);
const input = createInput(renderer.domElement);

const rope = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffffff }));
rope.frustumCulled = false;
scene.add(rope);

// 거미줄을 걸 수 있는 지점 표시 (벽에 가려도 보이게)
const marker = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0x3fe0c5, depthTest: false, transparent: true, opacity: 0.9, fog: false }));
marker.renderOrder = 1;
scene.add(marker);

// 주인공 발밑 그림자(그림자 지도는 멈춰 있으므로 따로 둥근 얼룩을 깖)
const blob = new THREE.Mesh(new THREE.CircleGeometry(0.45, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
scene.add(blob);

const move = new THREE.Vector3(), target = new THREE.Vector3();
const camRay = new THREE.Ray();
const webBtn = document.getElementById('btn-web'), zipBtn = document.getElementById('btn-zip');
const drawMinimap = createMinimap(document.getElementById('minimap'), tiles);
setupCities(document.getElementById('city'), document.getElementById('cities'));
let acc = 0, last = performance.now(), frame = 0, near = [], zipHeld = false;

renderer.setAnimationLoop((now) => {
  const dt = Math.min((now - last) / 1000, 0.1);
  const ratio = governor(dt);
  if (ratio) { renderer.setPixelRatio(ratio); sun.castShadow = ratio > maxRatio * 0.6; shadowDirty = true; } // 해상도를 많이 낮춰야 하는 기기에서는 그림자도 끔
  acc += dt;
  last = now;

  const sy = Math.sin(input.yaw), cy = Math.cos(input.yaw);
  move.set(-sy * input.my + cy * input.mx, 0, -cy * input.my - sy * input.mx);
  if (move.lengthSq() > 1) move.normalize();

  // 거미줄: 스틱을 민 방향(없으면 카메라 정면) 위쪽 건물을 자동 조준, 건물이 없으면 솟은 지형이나 앞쪽 위 허공에 걸림
  if (frame++ % 15 === 0) player.colliders = near = all.filter((c) => c.box.distanceToPoint(player.pos) < WEB_RANGE); // 15프레임에 최대 12m쯤 움직이므로 80m 반경이면 충분
  const heading = move.lengthSq() > 0.09 ? Math.atan2(move.x, move.z) : Math.atan2(-sy, -cy);
  const cand = player.anchor ? null : findAnchor(player.pos, heading, near, WEB_RANGE, tiles.groundAt);
  marker.visible = !!cand;
  webBtn.classList.toggle('ready', !!cand); // 조준점이 화면 밖이어도 버튼 색으로 알 수 있게
  zipBtn.classList.toggle('ready', !!cand || (!!player.anchor && !player.zipping));
  if (cand) { marker.position.copy(cand); marker.scale.setScalar(camera.position.distanceTo(cand) * 0.012); }
  // 거미줄 버튼: 누르고 있으면 걸려 스윙. 점프를 누르고 있으면 활공. 당기기 버튼: 누르는 순간 걸린 곳으로 날아감(스윙 중에도 가능)
  if (input.zip && !zipHeld) player.zip(cand);
  else if (input.web && cand) player.attach(cand);
  if (!input.web && !input.zip) player.release();
  zipHeld = input.zip;

  if (!ready) acc = 0;
  const opts = { run: input.run, glide: input.glide };
  while (acc >= STEP) { player.step(STEP, move, input.jump, opts); input.jump = false; acc -= STEP; }

  tiles.update(player.pos, player.vel);

  hero.position.copy(player.pos);
  const hv = Math.hypot(player.vel.x, player.vel.z);
  if (player.wall && heroState(player) === 'climb') hero.rotation.y = Math.atan2(-player.wall.x, -player.wall.z); // 벽타기 중에는 벽을 봄
  else if (hv > 0.5) hero.rotation.y = Math.atan2(player.vel.x, player.vel.z);
  hero.animate(player, dt, input.glide);

  // 공중에서는 카메라가 진행 방향 뒤로 천천히 따라옴 (직접 돌린 직후나 카메라 쪽으로 날아올 때는 제외)
  if (!player.onGround && hv > 4 && now - input.lookAt > 1200) {
    const d = THREE.MathUtils.euclideanModulo(Math.atan2(-player.vel.x, -player.vel.z) - input.yaw + Math.PI, Math.PI * 2) - Math.PI;
    if (Math.abs(d) < 2.6) input.yaw += d * Math.min(1, dt * 1.5);
  }

  // 발밑 그림자: 서 있으면 발밑(옥상 포함), 공중이면 땅에 높이만큼 흐리게
  const gy = player.onGround ? player.pos.y - R : tiles.groundAt(player.pos.x, player.pos.z);
  blob.position.set(player.pos.x, gy + 0.06, player.pos.z);
  blob.material.opacity = 0.4 * Math.max(0, 1 - (player.pos.y - R - gy) / 30);
  // 그림자 지도: 주인공이 SNAP만큼 움직였거나 타일이 바뀌면 그 자리로 옮겨 한 번 다시 그림
  target.copy(player.pos).divideScalar(SNAP).round().multiplyScalar(SNAP);
  if (shadowDirty || !target.equals(sun.target.position)) {
    sun.target.position.copy(target);
    sun.position.copy(target).addScaledVector(SUN, 2);
    renderer.shadowMap.needsUpdate = true;
    shadowDirty = false;
  }

  rope.visible = !!player.anchor;
  if (player.anchor) rope.geometry.setFromPoints([hero.hand.getWorldPosition(target), player.anchor]); // 줄은 쥔 손에서 나감

  // 카메라: 플레이어 뒤 CAM_DIST, 사이에 건물이 있으면 그 앞까지 당기고 땅 밑으로는 안 내려감
  target.copy(player.pos).y += 1.5;
  const cp = Math.cos(input.pitch);
  camRay.origin.copy(target);
  camRay.direction.set(sy * cp, Math.sin(input.pitch), cy * cp);
  let dist = CAM_DIST;
  for (const c of near) dist = Math.min(dist, rayHit(c, camRay) - 0.3);
  camera.position.copy(target).addScaledVector(camRay.direction, Math.max(dist, 1));
  camera.position.y = Math.max(camera.position.y, tiles.groundAt(camera.position.x, camera.position.z) + 0.5);
  camera.lookAt(target);
  // 빠를수록 시야각을 넓혀 속도감을 줌
  camera.fov += (FOV + Math.min(25, player.vel.length() * 0.45) - camera.fov) * Math.min(1, dt * 3);
  camera.updateProjectionMatrix();
  if (frame % 12 === 0) drawMinimap(player, hero.rotation.y);
  renderer.render(scene, camera);
});
