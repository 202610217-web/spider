import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Z, S } from './tile.js';
import { ringToBox } from './player.js';

const BASE = import.meta.env.VITE_TILE_URL ?? '/data/tiles'; // 배포 시 R2 주소
const LOAD = 1, KEEP = 2; // 주변 3×3 타일 로드, 5×5 밖은 해제
const mat = new THREE.MeshLambertMaterial({ color: 0xd8d2c4 });

// 플레이어 주변 타일만 불러오고 먼 타일은 해제. 월드 원점 = 타일 (ox, oy)의 북서쪽 모서리
export function createTiles(scene, ox, oy, onChange) {
  const loaded = new Map(); // "x/y" → { mesh, boxes } (로딩 중이면 null)
  const boxes = () => [...loaded.values()].flatMap((t) => t?.boxes ?? []);

  async function load(tx, ty, key) {
    loaded.set(key, null);
    // 타일 없음(바다·빈 땅) 또는 개발 서버의 HTML 응답 → 빈 타일
    const { buildings } = await fetch(`${BASE}/${Z}/${key}.json`).then((r) => r.json()).catch(() => ({ buildings: [] }));
    if (!loaded.has(key)) return; // 로딩 중 범위를 벗어남
    const off = new THREE.Vector3((tx - ox) * S, 0, (ty - oy) * S);
    const tile = { mesh: null, boxes: buildings.map(({ ring, h }) => ringToBox(ring, h).translate(off)) };
    if (buildings.length) {
      // 지오메트리는 타일 기준 좌표, 위치만 옮김 → 원점에서 멀어져도 떨림 없음
      tile.mesh = new THREE.Mesh(mergeGeometries(buildings.map(({ h, ring }) =>
        new THREE.ExtrudeGeometry(new THREE.Shape(ring.map(([x, y]) => new THREE.Vector2(x, y))), { depth: h, bevelEnabled: false })
          .rotateX(-Math.PI / 2))), mat); // 바닥(x, 북) → (x, -z), 돌출 → +y
      tile.mesh.position.copy(off);
      scene.add(tile.mesh);
    }
    loaded.set(key, tile);
    onChange(boxes());
  }

  return function update(pos) {
    const px = ox + Math.floor(pos.x / S), py = oy + Math.floor(pos.z / S);
    for (let x = px - LOAD; x <= px + LOAD; x++) for (let y = py - LOAD; y <= py + LOAD; y++) {
      const key = `${x}/${y}`;
      if (!loaded.has(key)) load(x, y, key);
    }
    let removed = false;
    for (const [key, tile] of loaded) {
      const [x, y] = key.split('/').map(Number);
      if (Math.abs(x - px) <= KEEP && Math.abs(y - py) <= KEEP) continue;
      if (tile?.mesh) { scene.remove(tile.mesh); tile.mesh.geometry.dispose(); }
      loaded.delete(key);
      removed = true;
    }
    if (removed) onChange(boxes());
  };
}
