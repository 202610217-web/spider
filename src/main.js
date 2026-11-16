import * as THREE from 'three';
import { Player } from './player.js';
import { createTiles } from './tiles.js';
import { S, lonLatToTile } from './tile.js';
import { createInput } from './input.js';
import { createHero } from './hero.js';

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

const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshLambertMaterial({ color: 0x8a9a7a }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

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
const updateTiles = createTiles(scene, ox, oy, (boxes) => (player.boxes = boxes));
const hero = createHero();
scene.add(hero);
const input = createInput(renderer.domElement);

const rope = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffffff }));
rope.frustumCulled = false;
scene.add(rope);

const ray = new THREE.Ray(), hitPt = new THREE.Vector3();
// 거미줄은 충돌 박스에 붙음 (메시 레이캐스트보다 빠르고 충돌과 일치)
function webHit() {
  let best = null, bd = WEB_RANGE;
  for (const b of player.boxes) {
    if (!ray.intersectBox(b, hitPt)) continue;
    const d = hitPt.distanceTo(ray.origin);
    if (d < bd) { bd = d; best = hitPt.clone(); }
  }
  return best;
}
const aim = new THREE.Vector3(), dir = new THREE.Vector3();
const move = new THREE.Vector3(), target = new THREE.Vector3();
let acc = 0, last = performance.now(), webHeld = false;

renderer.setAnimationLoop((now) => {
  acc = Math.min(acc + (now - last) / 1000, 0.1);
  last = now;

  // 거미줄: 누르는 순간 카메라 앞쪽 위로 자동 조준 — 정면부터 좌우·각도를 넓혀가며 첫 건물에 붙음 (땅에는 안 붙음)
  if (input.web && !webHeld) {
    camera.getWorldDirection(aim);
    const yaw0 = Math.atan2(aim.x, aim.z);
    search: for (const side of [0, 0.35, -0.35, 0.7, -0.7]) for (const up of [0.8, 1.6, 3]) {
      ray.set(player.pos, dir.set(Math.sin(yaw0 + side), up, Math.cos(yaw0 + side)).normalize());
      const hit = webHit();
      if (hit) { player.attach(hit); break search; }
    }
  }
  if (!input.web && webHeld) player.release();
  webHeld = input.web;

  const sy = Math.sin(input.yaw), cy = Math.cos(input.yaw);
  move.set(-sy * input.my + cy * input.mx, 0, -cy * input.my - sy * input.mx);
  if (move.lengthSq() > 1) move.normalize();
  while (acc >= STEP) { player.step(STEP, move, input.jump); input.jump = false; acc -= STEP; }

  updateTiles(player.pos);
  ground.position.set(player.pos.x, 0, player.pos.z);

  hero.position.copy(player.pos);
  const hv = Math.hypot(player.vel.x, player.vel.z);
  if (hv > 0.5) hero.rotation.y = Math.atan2(player.vel.x, player.vel.z);

  rope.visible = !!player.anchor;
  if (player.anchor) rope.geometry.setFromPoints([player.pos, player.anchor]);

  // shortcut: 카메라가 건물 안으로 들어가도 막지 않음, 거슬리면 레이캐스트로 당기기
  target.copy(player.pos).y += 1.5;
  const cp = Math.cos(input.pitch);
  camera.position.set(target.x + sy * cp * CAM_DIST, target.y + Math.sin(input.pitch) * CAM_DIST, target.z + cy * cp * CAM_DIST);
  camera.lookAt(target);
  renderer.render(scene, camera);
});
