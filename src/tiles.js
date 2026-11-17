import * as THREE from 'three';
import { Z, S } from './tile.js';
import { makeCollider } from './collide.js';
import { addRibbon, densify } from './roads.js';
import { N, tileHeights, heightAt } from './terrain.js';
import { buildingGeometries, buildingMaterials } from './buildings.js';

const BASE = import.meta.env.VITE_TILE_URL || import.meta.env.BASE_URL + 'data/tiles'; // VITE_TILE_URL: R2 공개 주소
const LOAD = 1, KEEP = 2; // 주변 3×3 타일 로드, 5×5 밖은 해제
const SINK = 8; // 경사지에서 건물 밑이 뜨지 않게 땅속으로 내리는 깊이(m)
const groundMat = new THREE.MeshLambertMaterial({ color: 0x8a9a7a });
// 바닥과 겹쳐 깜빡이지 않게 살짝 띄우고 깊이도 당김
const roadMat = new THREE.MeshBasicMaterial({ color: 0x4a4d52, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

// 플레이어 주변 타일만 불러오고 먼 타일은 해제. 월드 원점 = 타일 (ox, oy)의 북서쪽 모서리
export function createTiles(scene, ox, oy, onChange) {
  const loaded = new Map(); // "x/y" → { group, colliders, hgt, roads, off } (로딩 중이면 null)
  const colliders = () => [...loaded.values()].flatMap((t) => t?.colliders ?? []);

  async function load(tx, ty, key) {
    loaded.set(key, null);
    // 타일 없음(바다·빈 땅) 또는 개발 서버의 HTML 응답 → 빈 타일
    const [{ buildings = [], roads = [] }, hgt] = await Promise.all([
      fetch(`${BASE}/${Z}/${key}.json`).then((r) => r.json()).catch(() => ({})),
      tileHeights(tx, ty),
    ]);
    if (!loaded.has(key)) return; // 로딩 중 범위를 벗어남
    const off = new THREE.Vector3((tx - ox) * S, 0, (ty - oy) * S);
    // 지오메트리는 타일 기준 좌표, 그룹 위치만 옮김 → 원점에서 멀어져도 떨림 없음
    const tile = { group: new THREE.Group(), colliders: [], hgt, roads, off };
    tile.group.position.copy(off);

    const ground = new THREE.PlaneGeometry(S, S, N, N).rotateX(-Math.PI / 2).translate(S / 2, 0, S / 2); // 꼭짓점 순서 = 고도 격자 순서
    for (let i = 0; i < hgt.length; i++) ground.attributes.position.setY(i, hgt[i]);
    ground.computeVertexNormals();
    tile.group.add(new THREE.Mesh(ground, groundMat));

    if (buildings.length) {
      const baseOf = (ring) => Math.min(...ring.map(([x, y]) => heightAt(hgt, x, -y))); // 바닥 = 둘레에서 가장 낮은 땅
      for (const { h, ring } of buildings) { const base = baseOf(ring); tile.colliders.push(makeCollider(ring, off, base - SINK, base + h)); }
      const geo = buildingGeometries(buildings, baseOf, SINK), mats = buildingMaterials();
      geo.walls.forEach((g, k) => g && tile.group.add(new THREE.Mesh(g, mats.walls[k])));
      tile.group.add(new THREE.Mesh(geo.roof, mats.roof));
    }
    if (roads.length) {
      const pos = [], idx = [];
      // 6m마다 땅 높이를 따라가게 해서 도로가 땅속으로 끊겨 보이지 않게 함
      for (const { w, line } of roads) addRibbon(pos, idx, densify(line, 6), w, (x, z) => heightAt(hgt, x, z) + 0.3);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      tile.group.add(new THREE.Mesh(g, roadMat));
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
      if (tile) { scene.remove(tile.group); for (const m of tile.group.children) m.geometry.dispose(); }
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
