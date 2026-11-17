import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Z, S } from './tile.js';
import { makeCollider, inside } from './collide.js';
import { addRibbon, densify } from './roads.js';
import { street } from './street.js';
import { N, tileHeights, heightAt } from './terrain.js';
import { buildingGeometries, buildingMaterials, surface } from './buildings.js';

const BASE = import.meta.env.VITE_TILE_URL || import.meta.env.BASE_URL + 'data/tiles'; // VITE_TILE_URL: R2 공개 주소
const LOAD = 1, KEEP = 2; // 주변 3×3 타일 로드, 5×5 밖은 해제
const SINK = 8; // 경사지에서 건물 밑이 뜨지 않게 땅속으로 내리는 깊이(m)
const PAVED = new THREE.Color(0xb4b4ae), GREEN = new THREE.Color(0x6f8a5a), tint = new THREE.Color();
// 바닥에 겹쳐 까는 것들: 깜빡이지 않게 위에 놓일수록 깊이를 더 당김 (물 < 인도 < 도로 < 차선)
const flat = (opts, order) => new THREE.MeshLambertMaterial({ ...opts, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -order, polygonOffsetUnits: -order });
let M; // 재질·가로수 모양은 텍스처를 쓰므로 첫 타일에서 만듦
const materials = () => (M ??= {
  ground: new THREE.MeshLambertMaterial({ ...surface('concrete'), vertexColors: true }),
  water: new THREE.MeshPhongMaterial({ color: 0x2f5f7a, shininess: 90, specular: 0x8899aa, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  walk: flat({ ...surface('concrete'), color: 0xd0cdc4 }, 2),
  road: flat({ ...surface('asphalt'), color: 0x9a9a9a }, 3),
  white: flat({ color: 0xe8e8e4 }, 5),
  yellow: flat({ color: 0xe8b93a }, 5),
  tree: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  // 가로수 한 그루: 줄기 + 잎 덩어리 (키 약 6m, 타일마다 InstancedMesh로 찍음)
  treeGeo: mergeGeometries([[new THREE.CylinderGeometry(0.15, 0.22, 3, 5).translate(0, 1.5, 0), 0x6b4a32], [new THREE.IcosahedronGeometry(1.9, 0).scale(1, 1.2, 1).translate(0, 4.3, 0), 0x4f8a3f]].map(([g, c]) => {
    if (g.index) g = g.toNonIndexed();
    g.deleteAttribute('uv');
    const col = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < col.length; i += 3) tint.set(c).toArray(col, i);
    return g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  })),
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
    const [{ buildings = [], roads = [], water = [], cross = [] }, hgt] = await Promise.all([
      fetch(`${BASE}/${Z}/${key}.json`).then((r) => r.json()).catch(() => ({})),
      tileHeights(tx, ty),
    ]);
    // shortcut: 건물이 아주 많은 타일 하나는 여전히 한 프레임에 만들어 잠깐 끊길 수 있음, 눈에 띄면 워커로 옮기기
    await (turn = turn.then(() => new Promise(requestAnimationFrame)));
    if (!loaded.has(key)) return; // 로딩 중 범위를 벗어남
    const off = new THREE.Vector3((tx - ox) * S, 0, (ty - oy) * S);
    // 지오메트리는 타일 기준 좌표, 그룹 위치만 옮김 → 원점에서 멀어져도 떨림 없음
    const tile = { group: new THREE.Group(), colliders: [], hgt, roads, off };
    tile.group.position.copy(off);

    const ground = new THREE.PlaneGeometry(S, S, N, N).rotateX(-Math.PI / 2).translate(S / 2, 0, S / 2); // 꼭짓점 순서 = 고도 격자 순서
    for (let i = 0; i < hgt.length; i++) ground.attributes.position.setY(i, hgt[i]);
    ground.computeVertexNormals();
    // 평평한 곳은 포장된 도시 바닥(회색), 비탈은 산(녹색). 무늬는 6m마다 반복
    const { normal, uv } = ground.attributes, col = new Float32Array(hgt.length * 3);
    for (let i = 0; i < hgt.length; i++) {
      tint.lerpColors(PAVED, GREEN, THREE.MathUtils.clamp((0.995 - normal.getY(i)) / 0.03, 0, 1)).toArray(col, i * 3);
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
      add(new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2).translate(0, level, 0), m.water); // (x, 북) → (x, -z)
    }
    if (hgt.some((h) => h <= 0)) add(new THREE.PlaneGeometry(S, S).rotateX(-Math.PI / 2).translate(S / 2, 0.12, S / 2), m.water);

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
      const pos = [], idx = [];
      // 6m마다 땅 높이를 따라가게 해서 도로가 땅속으로 끊겨 보이지 않게 함
      for (const { w, line } of roads) addRibbon(pos, idx, densify(line, 6), w, (x, z) => yAt(x, z) + 0.3);
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
      if (tile) { scene.remove(tile.group); for (const m of tile.group.children) if (m.geometry !== M.treeGeo) m.geometry.dispose(); } // 가로수 모양은 타일끼리 함께 씀
      loaded.delete(key);
      removed = true;
    }
    if (removed) onChange(colliders());
  }
  // 월드 좌표의 땅 높이 (타일이 아직 없으면 0)
  function groundAt(x, z) {
    const tx = Math.floor(x / S), ty = Math.floor(z / S);
    const hgt = loaded.get(`${ox + tx}/${oy + ty}`)?.hgt;
    return hgt ? heightAt(hgt, x - tx * S, z - ty * S) : 0;
  }
  return { update, groundAt, loaded };
}
