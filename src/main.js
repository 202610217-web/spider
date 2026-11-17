import * as THREE from 'three';
import { Player, R } from './player.js';
import { createTiles } from './tiles.js';
import { S, lonLatToTile, tileToLonLat } from './tile.js';
import { createInput } from './input.js';
import { createHero, heroState } from './hero.js';
import { createGovernor } from './perf.js';
import { findAnchor } from './web.js';
import { rayHit } from './collide.js';
import { createMinimap } from './minimap.js';
import { setupSearch } from './search.js';
import { setupMenu } from './menu.js';
import { watchRegion } from './region.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { sunDirection, daylight, HOURS_PER_MINUTE } from './daylight.js';
import { buildingMaterials } from './buildings.js';

const WEB_RANGE = 80, STEP = 1 / 120, CAM_DIST = 9, FOV = 65;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
// 터치 기기 표시: 손가락이 주 입력이면 처음부터, 아니면 처음 터치했을 때 (터치 조작 버튼·조이스틱이 보임)
const touchUI = () => { document.body.classList.add('touch'); document.getElementById('q').placeholder = '장소 검색: 도시·주소·건물 이름'; }; // '/' 단축키 표시는 뺌
if (matchMedia('(any-pointer: coarse)').matches) touchUI();
addEventListener('touchstart', touchUI, { once: true, passive: true });
addEventListener('gesturestart', (e) => e.preventDefault()); // iOS 사파리는 user-scalable=no를 무시하므로 손가락 확대를 직접 막음
// 휴대폰·태블릿은 화면이 작아 해상도 1.5배로 시작(60fps 우선), 여유가 있으면 해상도 조절기가 올림
const maxRatio = Math.min(devicePixelRatio, document.body.classList.contains('touch') ? 1.5 : 2), governor = createGovernor(maxRatio, maxRatio * 0.5);
renderer.setPixelRatio(maxRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping; // 하늘(대기 산란)의 밝은 빛과 그늘을 함께 담음. 밝기는 시간대별 노출로
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 그림자 가장자리를 부드럽게
renderer.shadowMap.autoUpdate = false; // 해와 건물은 안 움직이므로 그림자 지도는 자리를 옮길 때만 다시 그림
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9cc3e6);
scene.fog = new THREE.Fog(0x9cc3e6, 300, 950); // 로드 반경(약 1km) 밖은 안개로 가림
const hemi = new THREE.HemisphereLight(0xffffff, 0x667755, 1.5);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.5); // 낮에는 햇빛, 밤에는 달빛
const SHADOW = 220, SNAP = 40; // 그림자는 주인공 주변 ±220m만, 40m 움직일 때마다 다시 맞춤

// 하늘: 대기 산란으로 계산한 하늘색·노을·해·구름 (Three.js Sky, Preetham 모델). 카메라를 따라다니는 상자, 먼 끝(1000m) 안쪽 크기
const sky = new Sky();
sky.scale.setScalar(1000);
sky.material.uniforms.turbidity.value = 3;
sky.material.uniforms.rayleigh.value = 1.5;
scene.add(sky);
// 별: 밤에만 보임
const stars = new THREE.Points(
  new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 1500 }, () => {
    const u = Math.random() * 2 * Math.PI, v = Math.random() * 0.95 + 0.05; // 위쪽 반구만
    const r = Math.sqrt(1 - v * v) * 480;
    return [Math.cos(u) * r, v * 480, Math.sin(u) * r];
  }).flat(), 3)),
  new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }),
);
scene.add(stars);
// 박명·밤하늘: 대기 산란 하늘은 해가 지면 금방 새까매지므로, 지평선은 남은 노을빛·위는 짙은 남색인 그라데이션을 더해 줌
const twilight = new THREE.Mesh(new THREE.SphereGeometry(470, 24, 12), new THREE.ShaderMaterial({
  uniforms: { horizon: { value: new THREE.Color() }, zenith: { value: new THREE.Color() }, strength: { value: 0 } },
  vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform vec3 horizon; uniform vec3 zenith; uniform float strength; varying vec3 vDir; void main() { float h = pow(clamp(vDir.y, 0.0, 1.0), 0.45); gl_FragColor = vec4(mix(horizon, zenith, h) * strength, 1.0);\n#include <colorspace_fragment>\n}', // 색은 선형으로 계산하고 화면 색 공간(sRGB)으로 바꿔 냄
  side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, // transparent: 불투명한 하늘(Sky)을 그린 뒤에 더해지게
}));
scene.add(twilight);
// 달: 둥근 원판과 은은한 달무리 (해의 반대쪽 하늘). 크기는 보기 좋게 실제보다 크게
const glowTexture = (inner, outer) => {
  const c = Object.assign(document.createElement('canvas'), { width: 128, height: 128 }), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner); g.addColorStop(outer, inner); g.addColorStop(Math.min(1, outer + 0.06), 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
};
const moon = new THREE.Group();
for (const [size, tex, opacity] of [[34, glowTexture('#f4f1e6', 0.42), 1], [150, glowTexture('rgba(190,205,255,0.5)', 0.05), 0.6]]) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, toneMapped: false, opacity }));
  sp.scale.setScalar(size); moon.add(sp);
}
scene.add(moon);

// 시각: ?time=시(예 18.5) 가 있으면 그때부터, 없으면 기기의 지금 시각부터. 실제 1분 = 게임 1시간
const startHour = Number(new URLSearchParams(location.search).get('time') ?? NaN), started = performance.now(), today = new Date();
const hour0 = Number.isFinite(startHour) ? startHour : today.getHours() + today.getMinutes() / 60;
const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 864e5);
const lightDir = new THREE.Vector3(), lastShadowDir = new THREE.Vector3();
const clockEl = document.createElement('span'), regionEl = document.createElement('span');
let light;
function updateDaylight(now) {
  const hour = (hour0 + ((now - started) / 60000) * HOURS_PER_MINUTE) % 24;
  const s = sunDirection(hour, dayOfYear, lat);
  const elev = (Math.asin(s[1]) * 180) / Math.PI;
  light = daylight(elev);
  sky.material.uniforms.sunPosition.value.set(...s);
  sky.material.uniforms.time.value = now / 1000;
  hemi.color.setHex(light.sky); hemi.groundColor.setHex(light.ground); hemi.intensity = light.hemi;
  sun.color.setHex(light.sun); sun.intensity = light.sunIntensity;
  lightDir.set(...(light.moon ? sunDirection(hour + 12, dayOfYear, lat) : s)); // 달은 해의 반대쪽 하늘에 있다고 봄
  lightDir.y = Math.max(lightDir.y, 0.08); // 해가 지평선에 걸려도 그림자가 끝없이 늘어나지 않게
  lightDir.normalize();
  scene.fog.color.setHex(light.fog); scene.background.setHex(light.fog);
  renderer.toneMappingExposure = light.exposure;
  stars.material.opacity = Math.max(0, light.night - 0.5) * 2; // 별은 하늘이 충분히 어두워진 뒤에
  // 박명: 해가 지평선 아래 0~18°일 때 지평선 쪽에 노을빛이 남고, 깊은 밤에는 남색만
  const dusk = THREE.MathUtils.clamp(1 - Math.abs(elev + 4) / 8, 0, 1); // 해가 지평선 아래 4°쯤일 때 가장 진함(시민 박명)
  twilight.material.uniforms.horizon.value.setHex(light.fog).multiplyScalar(0.35 + 0.65 * dusk);
  twilight.material.uniforms.zenith.value.setHex(0x06102a).lerp(new THREE.Color(0x1e2f66), dusk);
  twilight.material.uniforms.strength.value = Math.max(light.night * 0.8, dusk);
  const md = sunDirection(hour + 12, dayOfYear, lat); // 달은 해의 반대쪽 하늘
  moon.position.set(md[0] * 440, md[1] * 440, md[2] * 440);
  moon.visible = md[1] > -0.05;
  moon.children.forEach((c) => (c.material.opacity = (c === moon.children[0] ? 1 : 0.6) * Math.min(1, light.night * 1.4)));
  for (const m of buildingMaterials().walls) m.emissiveIntensity = light.night * 0.7; // 밤에는 창문에 불이 켜짐
  const h = Math.floor(hour), m = Math.floor((hour - h) * 60);
  clockEl.textContent = `${h < 12 ? '오전' : '오후'} ${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}`;
}
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
document.getElementById('pos').append(clockEl, regionEl); // 미니맵 아래: 게임 시각과 "서울특별시 종로구" 같은 행정구역
const updateRegion = watchRegion((name) => (regionEl.textContent = name));
const drawMinimap = createMinimap(document.getElementById('minimap'), tiles);
setupSearch(document.getElementById('q'), document.getElementById('results'), document.getElementById('status'));
const inMenu = setupMenu();
if (import.meta.env.VITE_GIS) document.getElementById('attr').insertAdjacentText('beforeend', ' · 건물 국토교통부 GIS건물통합정보(공공누리 제1유형)');
let acc = 0, last = performance.now(), frame = 0, near = [], zipHeld = false;

renderer.setAnimationLoop((now) => {
  const dt = Math.min((now - last) / 1000, 0.1);
  updateDaylight(now);
  const ratio = governor(dt);
  if (ratio) { renderer.setPixelRatio(ratio); sun.castShadow = ratio > maxRatio * 0.6; shadowDirty = true; } // 해상도를 많이 낮춰야 하는 기기에서는 그림자도 끔
  acc += dt;
  last = now;

  if (inMenu()) input.yaw += dt * 0.12; // 메인 화면 뒤에서 도시를 천천히 둘러봄
  const sy = Math.sin(input.yaw), cy = Math.cos(input.yaw);
  move.set(-sy * input.my + cy * input.mx, 0, -cy * input.my - sy * input.mx);
  if (move.lengthSq() > 1) move.normalize();
  // 제자리에서 떨어지다 활공을 시작하면 갈 방향이 없으므로 카메라 정면으로 출발
  if (input.glide && !player.onGround && move.lengthSq() < 0.01 && Math.hypot(player.vel.x, player.vel.z) < 1) move.set(-sy, 0, -cy);

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
  tiles.animate(now / 1000, 1 - light.night);

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
  // 해가 1°쯤 움직일 때마다(실제 4초쯤)도 다시 그림
  if (shadowDirty || !target.equals(sun.target.position) || lightDir.dot(lastShadowDir) < 0.99985) {
    lastShadowDir.copy(lightDir);
    sun.target.position.copy(target);
    sun.position.copy(target).addScaledVector(lightDir, 600);
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
  camera.position.y = Math.max(camera.position.y, tiles.groundAt(camera.position.x, camera.position.z, player.pos.y) + 0.5); // 다리 위에 있으면 카메라도 상판 위로
  camera.lookAt(target);
  // 빠를수록 시야각을 넓혀 속도감을 줌
  camera.fov += (FOV + Math.min(25, player.vel.length() * 0.45) - camera.fov) * Math.min(1, dt * 3);
  camera.updateProjectionMatrix();
  sky.position.copy(camera.position); stars.position.copy(camera.position); twilight.position.copy(camera.position); moon.position.add(camera.position); // 하늘은 늘 멀리 있게 (달 위치는 updateDaylight가 매 프레임 카메라 기준으로 다시 정함)
  if (frame % 12 === 0) {
    drawMinimap(player, hero.rotation.y);
    const [lo, la] = tileToLonLat(ox + player.pos.x / S, oy + player.pos.z / S);
    updateRegion(player.pos.x, player.pos.z, la, lo, now);
  }
  renderer.render(scene, camera);
});
