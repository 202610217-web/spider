import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Z, S } from './tile.js';
import { makeCollider, inside } from './collide.js';
import { addRibbon, densify } from './roads.js';
import { street, nearestRoad, along } from './street.js';
import { N, tileHeights, heightAt } from './terrain.js';
import { decode } from './land.js';
import { buildingGeometries, buildingMaterials, surface } from './buildings.js';

const BASE = import.meta.env.VITE_TILE_URL || import.meta.env.BASE_URL + 'data/tiles'; // VITE_TILE_URL: R2 공개 주소
const LOAD = 1, KEEP = 2; // 주변 3×3 타일 로드, 5×5 밖은 해제
const SINK = 8; // 경사지에서 건물 밑이 뜨지 않게 땅속으로 내리는 깊이(m)
const CLEAR = 8, RAMP = 60; // 다리: 땅(강바닥)에서 8m 위, 일반 도로와 만나는 곳에서 60m에 걸쳐 올라감
const PAVED = new THREE.Color(0xb4b4ae), GREEN = new THREE.Color(0x6f8a5a), tint = new THREE.Color();
const LAND_COLOR = [null, 0xa3a06a, 0x7c9c58, 0x4d6b3d].map((c) => c && new THREE.Color(c)); // 땅 덮개: 논밭, 풀밭·공원, 숲
// 바닥에 겹쳐 까는 것들: 깜빡이지 않게 위에 놓일수록 깊이를 더 당김 (물 < 인도 < 도로 < 차선)
const flat = (opts, order) => new THREE.MeshLambertMaterial({ ...opts, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -order, polygonOffsetUnits: -order });
// 물결 노멀맵: 방향·주기가 다른 사인파 몇 개를 더한 높이의 기울기 (가장자리가 이어지게 정수 주기만)
function ripples() {
  const n = 128, c = Object.assign(document.createElement('canvas'), { width: n, height: n }), x = c.getContext('2d'), img = x.createImageData(n, n);
  const waves = [[1, 2, 1], [3, -1, 0.6], [-2, 5, 0.35], [5, 4, 0.25], [-7, 3, 0.15]]; // [가로 주기, 세로 주기, 세기]
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let dx = 0, dy = 0;
    for (const [fx, fy, a] of waves) { const s = Math.cos(((i * fx + j * fy) / n) * 2 * Math.PI) * a; dx += s * fx; dy += s * fy; }
    const k = (j * n + i) * 4, l = Math.hypot(dx * 0.12, dy * 0.12, 1);
    img.data[k] = 128 - (dx * 0.12 / l) * 127; img.data[k + 1] = 128 - (dy * 0.12 / l) * 127; img.data[k + 2] = (1 / l) * 255; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 10, 1 / 10); // 물 uv는 미터 단위 → 10m마다 반복
  return t;
}
// 물에 비치는 하늘: 위는 짙은 파랑, 지평선은 배경색 (건물은 비치지 않음)
function sky() {
  const c = Object.assign(document.createElement('canvas'), { width: 4, height: 64 }), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, '#3f78c0'); g.addColorStop(0.5, '#cfe2f3'); g.addColorStop(1, '#8a98a0');
  x.fillStyle = g; x.fillRect(0, 0, 4, 64);
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// 여러 모양을 색을 입혀 하나로 합침 (가로수·신호등처럼 InstancedMesh로 찍는 것)
const paint = (parts) => mergeGeometries(parts.map(([g, c]) => {
  if (g.index) g = g.toNonIndexed();
  g.deleteAttribute('uv');
  const col = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < col.length; i += 3) tint.set(c).toArray(col, i);
  return g.setAttribute('color', new THREE.BufferAttribute(col, 3));
}));
let M; // 재질·가로수·신호등 모양은 텍스처를 쓰므로 첫 타일에서 만듦
const materials = () => (M ??= {
  ground: new THREE.MeshLambertMaterial({ ...surface('concrete'), vertexColors: true }),
  // 물: 흐르는 물결(노멀맵을 animate에서 밀어 줌) + 햇빛 반짝임 + 하늘 비침
  water: new THREE.MeshPhongMaterial({ color: 0x1f4a63, shininess: 120, specular: 0xbbccdd, normalMap: ripples(), envMap: sky(), reflectivity: 0.55, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  walk: flat({ ...surface('concrete'), color: 0xd0cdc4 }, 2),
  road: flat({ ...surface('asphalt'), color: 0x9a9a9a }, 3),
  white: flat({ color: 0xe8e8e4 }, 5),
  yellow: flat({ color: 0xe8b93a }, 5),
  tree: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  // 가로수 한 그루: 줄기 + 잎 덩어리 (키 약 6m, 타일마다 InstancedMesh로 찍음)
  treeGeo: paint([[new THREE.CylinderGeometry(0.15, 0.22, 3, 5).translate(0, 1.5, 0), 0x6b4a32], [new THREE.IcosahedronGeometry(1.9, 0).scale(1, 1.2, 1).translate(0, 4.3, 0), 0x4f8a3f]]),
  // 신호등 한 대: 기둥(원점) + 도로 쪽(+x)으로 뻗은 팔 + 가로로 긴 등 상자(빨강·노랑·초록, 도로 방향 ±z 양쪽에서 보임)
  lightGeo: paint([
    [new THREE.CylinderGeometry(0.09, 0.12, 6.2, 6).translate(0, 3.1, 0), 0x70757a],
    [new THREE.BoxGeometry(4, 0.12, 0.12).translate(2, 6, 0), 0x70757a],
    [new THREE.BoxGeometry(1.5, 0.5, 0.3).translate(3.6, 5.65, 0), 0x22262a],
    ...[[0xe03a2e, 3.15], [0xf0b429, 3.6], [0x2fbf5f, 4.05]].flatMap(([c, x]) => [[new THREE.CircleGeometry(0.16, 10).translate(x, 5.65, 0.16), c], [new THREE.CircleGeometry(0.16, 10).rotateY(Math.PI).translate(x, 5.65, -0.16), c]]),
  ]),
});
// pos/idx(+uv) → 법선까지 있는 지오메트리. uv: 위에서 본 위치 기준, 3m마다 반복
const ribbon = ({ pos, idx }, uv) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(pos.filter((_, i) => i % 3 !== 1).map((v) => v / 3), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};
const dummy = new THREE.Object3D();

// 플레이어 주변 타일만 불러오고 먼 타일은 해제. 월드 원점 = 타일 (ox, oy)의 북서쪽 모서리
export function createTiles(scene, ox, oy, onChange) {
  const loaded = new Map(); // "x/y" → { group, colliders, hgt, roads, off } (로딩 중이면 null)
  const colliders = () => [...loaded.values()].flatMap((t) => t?.colliders ?? []);

  let turn = Promise.resolve(); // 타일 메시 만들기는 한 프레임에 하나씩 (여러 타일이 한꺼번에 도착해도 끊김을 나눔)

  async function load(tx, ty, key) {
    loaded.set(key, null);
    // 타일 없음(바다·빈 땅) 또는 개발 서버의 HTML 응답 → 빈 타일
    const [{ buildings = [], roads = [], water = [], cross = [], lights = [], land }, hgt] = await Promise.all([
      fetch(`${BASE}/${Z}/${key}.json`).then((r) => r.json()).catch(() => ({})),
      tileHeights(tx, ty),
    ]);
    // shortcut: 건물이 아주 많은 타일 하나는 여전히 한 프레임에 만들어 잠깐 끊길 수 있음, 눈에 띄면 워커로 옮기기
    await (turn = turn.then(() => new Promise(requestAnimationFrame)));
    if (!loaded.has(key)) return; // 로딩 중 범위를 벗어남
    const off = new THREE.Vector3((tx - ox) * S, 0, (ty - oy) * S);
    // 지오메트리는 타일 기준 좌표, 그룹 위치만 옮김 → 원점에서 멀어져도 떨림 없음
    const tile = { group: new THREE.Group(), colliders: [], hgt, roads, off, decks: [] }; // decks: 다리 상판 [{ w, fine, ys, box }]
    tile.group.position.copy(off);

    const ground = new THREE.PlaneGeometry(S, S, N, N).rotateX(-Math.PI / 2).translate(S / 2, 0, S / 2); // 꼭짓점 순서 = 고도 격자 순서
    for (let i = 0; i < hgt.length; i++) ground.attributes.position.setY(i, hgt[i]);
    ground.computeVertexNormals();
    // 평평한 곳은 포장된 도시 바닥(회색), 비탈은 산(녹색). 무늬는 6m마다 반복
    const { normal, uv } = ground.attributes, col = new Float32Array(hgt.length * 3);
    const cover = land && decode(land); // land 격자 칸 수 = 지형 격자 칸 수(N)
    for (let i = 0; i < hgt.length; i++) {
      // 땅 덮개(숲·공원·논밭)가 있으면 그 색, 없으면 평평한 곳은 포장(회색)·비탈은 산(녹색). 꼭짓점 (i, j) → 칸 (i, j) (가장자리는 안쪽 칸)
      const k = cover ? cover[Math.min(Math.floor(i / (N + 1)), N - 1) * N + Math.min(i % (N + 1), N - 1)] : 0;
      (k ? tint.copy(LAND_COLOR[k]) : tint.lerpColors(PAVED, GREEN, THREE.MathUtils.clamp((0.995 - normal.getY(i)) / 0.03, 0, 1))).toArray(col, i * 3);
      uv.setXY(i, (uv.getX(i) * S) / 6, (uv.getY(i) * S) / 6);
    }
    ground.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = materials(), add = (geo, mat, cast) => { const o = new THREE.Mesh(geo, mat); o.receiveShadow = true; o.castShadow = !!cast; tile.group.add(o); return o; };
    const yAt = (x, z) => heightAt(hgt, x, z);
    add(ground, m.ground);

    // 물: 강·호수는 다각형마다 가장 낮은 물가 높이에 평평하게 깔고(가운데가 지형 위로 뜨거나 다리를 덮지 않게), 고도 0 이하(바다)가 있는 타일은 수면 한 장을 깖
    for (const [outer, ...holes] of water) {
      const sh = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)));
      sh.holes = holes.map((r) => new THREE.Path(r.map(([x, y]) => new THREE.Vector2(x, y))));
      const level = Math.min(...outer.map(([x, y]) => yAt(x, -y))) + 0.1;
      add(new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2).translate(0, level, 0), m.water); // (x, 북) → (x, -z). uv는 미터 단위 그대로
    }
    if (hgt.some((h) => h <= 0)) add(new THREE.ShapeGeometry(new THREE.Shape([[0, 0], [S, 0], [S, -S], [0, -S]].map(([x, y]) => new THREE.Vector2(x, y)))).rotateX(-Math.PI / 2).translate(0, 0.12, 0), m.water);

    if (buildings.length) {
      const baseOf = (ring) => Math.min(...ring.map(([x, y]) => yAt(x, -y))); // 바닥 = 둘레에서 가장 낮은 땅
      for (const { h, ring } of buildings) { const base = baseOf(ring); tile.colliders.push(makeCollider(ring, off, base - SINK, base + h)); }
      const geo = buildingGeometries(buildings, baseOf, SINK), mats = buildingMaterials();
      geo.walls.forEach((g, k) => g && add(g, mats.walls[k], true));
      add(geo.roof, mats.roof, true);
      geo.pitched.forEach((g, k) => g && add(g, mats.pitched[k], true));
      if (geo.signs) tile.group.add(new THREE.Mesh(geo.signs, mats.signs));
    }
    if (roads.length) {
      // 다리(b): 상판을 땅에서 CLEAR만큼 띄움. 일반 도로와 가까운 곳(다리 끝)은 0에서 시작해 RAMP에 걸쳐 올라감
      // shortcut: 다른 도로 위를 지나는 고가도로는 그 도로 근처에서 내려앉음(예전처럼 땅에 붙음), 제대로 하려면 타일 생성 때 다리 전체를 이어 높이를 정해야 함
      const land = roads.filter((r) => !r.b);
      for (const r of roads) if (r.b) {
        const fine = densify(r.line, 6), ys = fine.map(([x, y]) => yAt(x, -y) + CLEAR * Math.min(1, nearestRoad(land, x, y).d / RAMP));
        const xs = fine.map((p) => p[0]), ns = fine.map((p) => p[1]), pad = r.w / 2 + 2.5; // 인도까지 포함한 폭
        r.y = (x, z) => along(fine, ys, x, -z).y;
        tile.decks.push({ pad, fine, ys, box: [Math.min(...xs) - pad, Math.max(...xs) + pad, Math.min(...ns) - pad, Math.max(...ns) + pad] });
      }
      const pos = [], idx = [];
      // 6m마다 땅 높이를 따라가게 해서 도로가 땅속으로 끊겨 보이지 않게 함
      for (const { w, line, y } of roads) addRibbon(pos, idx, densify(line, 6), w, (x, z) => (y ?? yAt)(x, z) + 0.3);
      add(ribbon({ pos, idx }, true), m.road);
      // 인도·차선·횡단보도·가로수
      const st = street(roads, cross, yAt);
      add(ribbon(st.walk, true), m.walk);
      add(ribbon(st.yellow), m.yellow);
      if (st.white.idx.length) add(ribbon(st.white), m.white);
      // 가로수: 건물 안에 들어가는 자리는 뺌. 충돌은 없음(그냥 지나감)
      const spots = st.trees.filter(([x, y]) => !tile.colliders.some((c) => c.box.min.x <= off.x + x && off.x + x <= c.box.max.x && c.box.min.z <= off.z - y && off.z - y <= c.box.max.z && inside(c.pts, off.x + x, off.z - y)));
      if (spots.length) {
        const trees = new THREE.InstancedMesh(m.treeGeo, m.tree, spots.length);
        spots.forEach(([x, y], i) => {
          const r = Math.abs(Math.sin(x * 12.9898 + y * 78.233)) ; // 자리마다 늘 같은 크기·방향
          dummy.position.set(x, yAt(x, -y), -y);
          dummy.rotation.y = r * 6.28;
          dummy.scale.setScalar(0.8 + r * 0.6);
          dummy.updateMatrix();
          trees.setMatrixAt(i, dummy.matrix);
        });
        trees.castShadow = true;
        tile.group.add(trees);
      }
      // 신호등: 도로 가장자리에 세우고 팔이 도로 쪽을 향함
      if (lights.length) {
        const poles = new THREE.InstancedMesh(m.lightGeo, m.tree, lights.length);
        lights.forEach(([x, y, ang, w], i) => {
          const px = x - Math.sin(ang) * (w / 2 + 0.8), py = y + Math.cos(ang) * (w / 2 + 0.8);
          dummy.position.set(px, yAt(px, -py), -py);
          dummy.rotation.y = ang - Math.PI / 2;
          dummy.scale.setScalar(1);
          dummy.updateMatrix();
          poles.setMatrixAt(i, dummy.matrix);
        });
        tile.group.add(poles);
      }
    }
    scene.add(tile.group);
    loaded.set(key, tile);
    onChange(colliders());
  }

  // vel: 빠르게 날아갈 때를 대비해 3초 뒤 위치 쪽 타일도 미리 불러옴 (해제 범위 안인 한 칸 앞까지)
  function update(pos, vel) {
    const px = ox + Math.floor(pos.x / S), py = oy + Math.floor(pos.z / S);
    const ax = px + Math.sign(Math.floor((pos.x + vel.x * 3) / S) + ox - px), ay = py + Math.sign(Math.floor((pos.z + vel.z * 3) / S) + oy - py);
    for (const [cx, cy] of [[px, py], [ax, ay]]) for (let x = cx - LOAD; x <= cx + LOAD; x++) for (let y = cy - LOAD; y <= cy + LOAD; y++) {
      const key = `${x}/${y}`;
      if (!loaded.has(key)) load(x, y, key);
    }
    let removed = false;
    for (const [key, tile] of loaded) {
      const [x, y] = key.split('/').map(Number);
      if (Math.abs(x - px) <= KEEP && Math.abs(y - py) <= KEEP) continue;
      if (tile) { scene.remove(tile.group); for (const m of tile.group.children) if (m.geometry !== M.treeGeo && m.geometry !== M.lightGeo) m.geometry.dispose(); } // 가로수·신호등 모양은 타일끼리 함께 씀
      loaded.delete(key);
      removed = true;
    }
    if (removed) onChange(colliders());
  }
  // 월드 좌표의 땅 높이 (타일이 아직 없으면 0). y(내 높이)를 주면 그 아래 1m 안쪽에 있는 다리 상판도 땅으로 봄 → 다리 위를 걷고, 밑으로도 지나감
  function groundAt(x, z, y) {
    const tx = Math.floor(x / S), ty = Math.floor(z / S), t = loaded.get(`${ox + tx}/${oy + ty}`);
    if (!t) return 0;
    const lx = x - tx * S, ln = -(z - ty * S); // 타일 기준 [동, 북]
    let g = heightAt(t.hgt, lx, -ln);
    if (y !== undefined) for (const d of t.decks) {
      if (lx < d.box[0] || lx > d.box[1] || ln < d.box[2] || ln > d.box[3]) continue;
      const a = along(d.fine, d.ys, lx, ln);
      if (a.d <= d.pad && y >= a.y - 1 && a.y + 0.3 > g) g = a.y + 0.3;
    }
    return g;
  }
  // 물결을 흘려보내고, 낮일수록 하늘을 더 비춤 (t: 초, day: 0 밤 ~ 1 낮)
  const animate = (t, day = 1) => { if (!M) return; M.water.normalMap.offset.set(t * 0.03, t * 0.02); M.water.reflectivity = 0.1 + 0.45 * day; };
  return { update, groundAt, animate, loaded };
}
