import * as THREE from 'three';
import { LOOKS } from './style.js';

const FLOOR = 3; // 벽 무늬 한 칸 = 3m × 3m (한 층 × 창 한 칸)
const pick = (list, seed) => list[seed % list.length];
const color = new THREE.Color();

// 건물들을 벽 무늬별 지오메트리 + 옥상 지오메트리로 합침 (타일당 그리기 호출을 몇 번으로 줄임)
// buildings: [{ h, s, ring }] (타일 기준 [동, 북]), baseOf(ring): 바닥 높이, sink: 땅속으로 내리는 깊이
// 돌려주는 값: { walls: [무늬 번호별 BufferGeometry | undefined], roof: BufferGeometry }
export function buildingGeometries(buildings, baseOf, sink) {
  const walls = [], roof = { pos: [], nor: [], col: [], uv: [] };
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
      if (i < caps) roof.uv.push(position.getX(i) / FLOOR, position.getZ(i) / FLOOR); // 옥상 무늬는 위에서 본 위치 기준
      else w.uv.push(uv.getX(i) / FLOOR, uv.getY(i) / FLOOR); // ExtrudeGeometry의 벽 uv는 미터 단위(가로 위치, 높이)
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

const sharp = (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
// 사진 텍스처 (public/textures, Poly Haven CC0). 3m마다 반복
export const photo = (name) => sharp(new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}textures/${name}.jpg`));

// 벽 무늬 텍스처 한 칸(3m × 3m): 사진 바탕(밝은 회색조 → 건물 색이 곱해짐) 위에 피그마에서 그린 창호를 겹침
// 0 벽돌 + 작은 창, 1 미장 + 긴 띠창, 2 유리 커튼월, 3 골강판 패널(창 없음)
const LAYERS = [['brick.jpg', 'win0.svg'], ['plaster.jpg', 'win1.svg'], ['win2.svg'], ['panel.jpg']];
function wallTexture(kind) {
  const c = Object.assign(document.createElement('canvas'), { width: 256, height: 256 }), x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 256, 256); // 그림이 오기 전(또는 못 받으면) 흰 바탕 = 건물 색 그대로
  const t = sharp(new THREE.CanvasTexture(c));
  const load = (file) => new Promise((done) => Object.assign(new Image(), { onload() { done(this); }, onerror() { done(); }, src: `${import.meta.env.BASE_URL}textures/${file}` }));
  Promise.all(LAYERS[kind].map(load)).then((imgs) => { for (const img of imgs) if (img) x.drawImage(img, 0, 0, 256, 256); t.needsUpdate = true; });
  return t;
}

let mats;
// 재질은 처음 쓸 때 한 번만 만듦: { walls: [무늬별], roof }
export function buildingMaterials() {
  return (mats ??= {
    walls: [0, 1, 2, 3].map((k) => new THREE.MeshLambertMaterial({ map: wallTexture(k), vertexColors: true })),
    roof: new THREE.MeshLambertMaterial({ map: photo('concrete'), vertexColors: true }),
  });
}
