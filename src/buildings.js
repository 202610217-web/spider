import * as THREE from 'three';
import { LOOKS } from './style.js';

const FLOOR = 3; // 벽 무늬 한 칸 = 3m × 3m (한 층 × 창 한 칸)
const pick = (list, seed) => list[seed % list.length];
const color = new THREE.Color();

// 건물들을 벽 무늬별 지오메트리 + 옥상 지오메트리로 합침 (타일당 그리기 호출을 몇 번으로 줄임)
// buildings: [{ h, s, ring }] (타일 기준 [동, 북]), baseOf(ring): 바닥 높이, sink: 땅속으로 내리는 깊이
// 돌려주는 값: { walls: [무늬 번호별 BufferGeometry | undefined], roof: BufferGeometry }
export function buildingGeometries(buildings, baseOf, sink) {
  const walls = [], roof = { pos: [], nor: [], col: [] };
  for (const { h, s = 2, ring } of buildings) {
    const look = LOOKS[s] ?? LOOKS[2];
    const seed = Math.abs(Math.round(ring[0][0] * 7 + ring[0][1] * 13 + h)); // 같은 건물은 늘 같은 색
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(ring.map(([x, y]) => new THREE.Vector2(x, y))), { depth: h + sink, bevelEnabled: false })
      .rotateX(-Math.PI / 2).translate(0, baseOf(ring) - sink, 0); // 바닥(x, 북) → (x, -z), 돌출 → +y
    const { position, normal, uv } = g.attributes, caps = g.groups[0].count; // 앞쪽 caps개가 위아래 뚜껑, 나머지가 벽
    const w = (walls[look.tex] ??= { pos: [], nor: [], uv: [], col: [] });
    for (let i = 0; i < position.count; i++) {
      const out = i < caps ? roof : w;
      out.pos.push(position.getX(i), position.getY(i), position.getZ(i));
      out.nor.push(normal.getX(i), normal.getY(i), normal.getZ(i));
      color.set(pick(i < caps ? look.roof : look.wall, seed));
      out.col.push(color.r, color.g, color.b);
      if (i >= caps) w.uv.push(uv.getX(i) / FLOOR, uv.getY(i) / FLOOR); // ExtrudeGeometry의 벽 uv는 미터 단위(가로 위치, 높이)
    }
    g.dispose();
  }
  const make = (b) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
    if (b.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    return g;
  };
  return { walls: walls.map((b) => b && make(b)), roof: make(roof) };
}

// 벽 무늬 텍스처: 흰 바탕(건물 색이 곱해짐)에 어두운 창. 0 작은 창, 1 긴 띠창, 2 유리 커튼월, 3 패널(창 없음)
function wallTexture(kind) {
  const c = Object.assign(document.createElement('canvas'), { width: 64, height: 64 }), x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 64);
  const glass = '#34465a';
  if (kind === 0) { x.fillStyle = glass; x.fillRect(20, 16, 24, 26); x.fillStyle = '#d8d8d8'; x.fillRect(18, 42, 28, 3); }
  if (kind === 1) { x.fillStyle = glass; x.fillRect(3, 14, 58, 28); x.fillStyle = '#e8e8e8'; x.fillRect(31, 14, 2, 28); x.fillStyle = '#d0d0d0'; x.fillRect(0, 60, 64, 4); }
  if (kind === 2) { x.fillStyle = '#b8c4d0'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#7d8a98'; x.fillRect(0, 50, 64, 14); x.fillStyle = '#f4f4f4'; x.fillRect(0, 0, 3, 64); x.fillRect(0, 0, 64, 3); }
  if (kind === 3) { x.fillStyle = '#d4d4d4'; for (let y = 0; y < 64; y += 16) x.fillRect(0, y, 64, 2); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

let mats;
// 재질은 처음 쓸 때 한 번만 만듦: { walls: [무늬별], roof }
export function buildingMaterials() {
  return (mats ??= {
    walls: [0, 1, 2, 3].map((k) => new THREE.MeshLambertMaterial({ map: wallTexture(k), vertexColors: true })),
    roof: new THREE.MeshLambertMaterial({ vertexColors: true }),
  });
}
