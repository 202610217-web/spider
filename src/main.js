import * as THREE from 'three';
import { Player } from './player.js';
import { createTiles } from './tiles.js';
import { S, lonLatToTile } from './tile.js';
import { createInput } from './input.js';
import { createHero } from './hero.js';
import { findAnchor } from './web.js';

const WEB_RANGE = 150, STEP = 1 / 120, CAM_DIST = 9;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9cc3e6);
scene.fog = new THREE.Fog(0x9cc3e6, 300, 950); // 로드 반경(약 1km) 밖은 안개로 가림
scene.add(new THREE.HemisphereLight(0xffffff, 0x667755, 1.5));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(300, 500, 200);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(65, 1, 0.5, 3000);
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
player.pos.set((fx - ox) * S, 50, (fy - oy) * S);
let ready = false; // 시작 타일이 뜨기 전에는 물리를 멈춤
const tiles = createTiles(scene, ox, oy, (boxes) => {
  player.boxes = boxes;
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

const move = new THREE.Vector3(), target = new THREE.Vector3();
const camRay = new THREE.Ray(), camHit = new THREE.Vector3();
const webBtn = document.getElementById('btn-web');
let acc = 0, last = performance.now(), frame = 0, near = [];

renderer.setAnimationLoop((now) => {
  const dt = Math.min((now - last) / 1000, 0.1);
  acc += dt;
  last = now;

  const sy = Math.sin(input.yaw), cy = Math.cos(input.yaw);
  move.set(-sy * input.my + cy * input.mx, 0, -cy * input.my - sy * input.mx);
  if (move.lengthSq() > 1) move.normalize();

  // 거미줄: 스틱을 민 방향(없으면 카메라 정면) 위쪽 건물을 자동 조준. 걸 수 있으면 표시하고, 버튼을 누르고 있으면 걸림
  if (frame++ % 15 === 0) near = player.boxes.filter((b) => b.distanceToPoint(player.pos) < WEB_RANGE);
  const heading = move.lengthSq() > 0.09 ? Math.atan2(move.x, move.z) : Math.atan2(-sy, -cy);
  const cand = player.anchor ? null : findAnchor(player.pos, heading, near, WEB_RANGE);
  marker.visible = !!cand;
  webBtn.classList.toggle('ready', !!cand); // 조준점이 화면 밖이어도 버튼 색으로 알 수 있게
  if (cand) { marker.position.copy(cand); marker.scale.setScalar(camera.position.distanceTo(cand) * 0.012); }
  if (input.web && cand) player.attach(cand);
  if (!input.web) player.release();

  if (!ready) acc = 0;
  while (acc >= STEP) { player.step(STEP, move, input.jump); input.jump = false; acc -= STEP; }

  tiles.update(player.pos);

  hero.position.copy(player.pos);
  const hv = Math.hypot(player.vel.x, player.vel.z);
  if (hv > 0.5) hero.rotation.y = Math.atan2(player.vel.x, player.vel.z);

  // 공중에서는 카메라가 진행 방향 뒤로 천천히 따라옴 (직접 돌린 직후나 카메라 쪽으로 날아올 때는 제외)
  if (!player.onGround && hv > 4 && now - input.lookAt > 1200) {
    const d = THREE.MathUtils.euclideanModulo(Math.atan2(-player.vel.x, -player.vel.z) - input.yaw + Math.PI, Math.PI * 2) - Math.PI;
    if (Math.abs(d) < 2.6) input.yaw += d * Math.min(1, dt * 1.5);
  }

  rope.visible = !!player.anchor;
  if (player.anchor) rope.geometry.setFromPoints([player.pos, player.anchor]);

  // 카메라: 플레이어 뒤 CAM_DIST, 사이에 건물이 있으면 그 앞까지 당기고 땅 밑으로는 안 내려감
  target.copy(player.pos).y += 1.5;
  const cp = Math.cos(input.pitch);
  camRay.origin.copy(target);
  camRay.direction.set(sy * cp, Math.sin(input.pitch), cy * cp);
  let dist = CAM_DIST;
  for (const b of near) if (camRay.intersectBox(b, camHit)) dist = Math.min(dist, camHit.distanceTo(target) - 0.3);
  camera.position.copy(target).addScaledVector(camRay.direction, Math.max(dist, 1));
  camera.position.y = Math.max(camera.position.y, tiles.groundAt(camera.position.x, camera.position.z) + 0.5);
  camera.lookAt(target);
  renderer.render(scene, camera);
});
