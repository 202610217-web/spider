import * as THREE from 'three';
import { LOOKS } from './style.js';

const FLOOR = 3; // 벽 무늬 한 칸 = 3m × 3m (한 층 × 창 한 칸)
const pick = (list, seed) => list[seed % list.length];
const color = new THREE.Color();

const GABLE = [0x4a4d55, 0x8a4a3a, 0x3f5f8a]; // 주택 박공지붕 색: 짙은 회색·적갈색·파랑
const hash = (n) => (Math.abs(n) * 9301 + 49297) % 233280;
const SIGN_W = 4, SIGN_H = 1.1; // 간판 크기(m). 그림은 16종(2열 × 8행)

// 건물들을 벽 무늬별 지오메트리 + 옥상 + 경사 지붕 + 간판으로 합침 (타일당 그리기 호출을 몇 번으로 줄임)
// buildings: [{ h, s, ring }] (타일 기준 [동, 북]), baseOf(ring): 바닥 높이, sink: 땅속으로 내리는 깊이
// 돌려주는 값: { walls: [무늬 번호별 | undefined], roof, pitched: [기와, 골강판] (없으면 undefined), signs (없으면 undefined) }
export function buildingGeometries(buildings, baseOf, sink) {
  const buf = () => ({ pos: [], nor: [], col: [], uv: [] });
  const walls = [], roof = buf(), pitched = [], signs = { pos: [], uv: [] };
  // 삼각형 하나를 경사 지붕에 넣음. 법선이 아래를 보면 뒤집어 위를 보게 함
  const tri = (out, a, b, c, ua, ub, uc) => {
    let nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (ny < 0) { [b, c, ub, uc] = [c, b, uc, ub]; nx = -nx; ny = -ny; nz = -nz; }
    const l = Math.hypot(nx, ny, nz) || 1;
    for (const [p, u] of [[a, ua], [b, ub], [c, uc]]) { out.pos.push(...p); out.nor.push(nx / l, ny / l, nz / l); out.uv.push(u[0] / 2, u[1] / 2); out.col.push(color.r, color.g, color.b); }
  };
  for (const { h, s = 2, ring } of buildings) {
    const look = LOOKS[s] ?? LOOKS[2], base = baseOf(ring);
    const seed = Math.abs(Math.round(ring[0][0] * 7 + ring[0][1] * 13 + h)); // 같은 건물은 늘 같은 색
    // 경사 지붕: 바닥이 사각형인 전통 건물·공장·낮은 주택(절반). 용마루 높이가 h, 벽은 처마(h - rh)까지
    let rh = 0;
    if (ring.length === 5 && (s === 5 || s === 4 || (s === 0 && h <= 9 && seed % 2 === 0))) {
      const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]), k = len(ring[0], ring[1]) >= len(ring[1], ring[2]) ? 0 : 1;
      const P = [0, 1, 2, 3].map((i) => ring[(i + k) % 4]), long = len(P[0], P[1]), short = len(P[1], P[2]);
      rh = Math.min(short * (s === 4 ? 0.15 : 0.35), 3, h * 0.4);
      const y0 = base + h - rh, y1 = base + h, slope = Math.hypot(short / 2, rh);
      const [a, b, c, d] = P.map(([x, y]) => [x, y0, -y]); // 처마 네 귀
      const m1 = [(P[1][0] + P[2][0]) / 2, y1, -(P[1][1] + P[2][1]) / 2], m0 = [(P[3][0] + P[0][0]) / 2, y1, -(P[3][1] + P[0][1]) / 2]; // 용마루 양 끝
      const out = (pitched[s === 4 ? 1 : 0] ??= buf());
      color.set(pick(s === 0 ? GABLE : look.roof, seed));
      tri(out, a, b, m1, [0, 0], [long, 0], [long, slope]); tri(out, a, m1, m0, [0, 0], [long, slope], [0, slope]);
      tri(out, c, d, m0, [0, 0], [long, 0], [long, slope]); tri(out, c, m0, m1, [0, 0], [long, slope], [0, slope]);
      tri(out, b, c, m1, [0, 0], [short, 0], [short / 2, rh]); tri(out, d, a, m0, [0, 0], [short, 0], [short / 2, rh]); // 박공(삼각 벽)
    }
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(ring.map(([x, y]) => new THREE.Vector2(x, y))), { depth: h - rh + sink, bevelEnabled: false })
      .rotateX(-Math.PI / 2).translate(0, base - sink, 0); // 바닥(x, 북) → (x, -z), 돌출 → +y
    const { position, normal, uv } = g.attributes, caps = g.groups[0].count; // 앞쪽 caps개가 위아래 뚜껑, 나머지가 벽
    const w = (walls[look.tex] ??= buf());
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
    // 간판: 상가(유형 2)의 2·3층 창 사이 벽에 가로 간판을 줄지어 붙임 (건물마다 늘 같은 자리·같은 그림)
    if (s === 2 && h <= 30) {
      const ccw = ring.reduce((a, [x, y], i) => a + (i ? ring[i - 1][0] * y - x * ring[i - 1][1] : 0), 0) > 0;
      for (let i = 1; i < ring.length; i++) {
        const [ax, ay] = ring[i - 1], [bx, by] = ring[i], len = Math.hypot(bx - ax, by - ay);
        const n = Math.floor((len - 1) / (SIGN_W + 0.5));
        if (n < 1) continue;
        const dx = (bx - ax) / len, dy = (by - ay) / len, ox = (ccw ? dy : -dy) * 0.12, oy = (ccw ? -dx : dx) * 0.12; // 벽에서 12cm 밖으로
        // 창 사이 벽의 가운데 높이: 벽 무늬가 바닥(base - sink)부터 3m마다 반복되므로 그 경계에 맞춤
        for (let f = 1, yc; f <= 2 && (yc = base - sink + FLOOR * (Math.ceil(sink / FLOOR) + f)) + SIGN_H < base + h; f++) for (let k = 0; k < n; k++) {
          const r = hash(seed + i * 31 + f * 17 + k * 7);
          if (r % 10 < 4) continue; // 열 자리 중 여섯 자리만 채움
          const t0 = (len - n * (SIGN_W + 0.5) + 0.5) / 2 + k * (SIGN_W + 0.5), t1 = t0 + SIGN_W, y0 = yc - SIGN_H / 2, y1 = yc + SIGN_H / 2;
          const A = [ax + dx * t0 + ox, -(ay + dy * t0 + oy)], B = [ax + dx * t1 + ox, -(ay + dy * t1 + oy)];
          const kind = r % 16, v1 = 1 - Math.floor(kind / 2) / 8, v0 = v1 - 1 / 8;
          let u0 = (kind % 2) / 2, u1 = u0 + 0.5;
          if (!ccw) [u0, u1] = [u1, u0]; // 밖에서 볼 때 글자가 뒤집히지 않게
          signs.pos.push(A[0], y0, A[1], B[0], y0, B[1], B[0], y1, B[1], A[0], y0, A[1], B[0], y1, B[1], A[0], y1, A[1]);
          signs.uv.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
        }
      }
    }
  }
  const make = (b) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    if (b.nor) g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
    if (b.col) g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    return g;
  };
  return { walls: walls.map((b) => b && make(b)), roof: make(roof), pitched: [0, 1].map((k) => pitched[k] && make(pitched[k])), signs: signs.pos.length ? make(signs) : undefined };
}

const sharp = (t, srgb = true) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const url = (file) => `${import.meta.env.BASE_URL}textures/${file}`;
// 사진 텍스처 (public/textures, Poly Haven CC0). name_n은 노멀맵
export const photo = (name) => sharp(new THREE.TextureLoader().load(url(name + '.jpg')), !name.endsWith('_n'));
// 사진 + 노멀맵을 쓰는 재질 옵션
export const surface = (name) => ({ map: photo(name), normalMap: photo(name + '_n') });

// 벽 무늬 한 칸(3m × 3m): 사진 바탕(밝은 회색조 → 건물 색이 곱해짐) 위에 피그마에서 그린 창호를 겹침. 노멀맵은 창 자리만 평평하게
// 0 벽돌 + 작은 창, 1 미장 + 긴 띠창, 2 유리 커튼월, 3 골강판 패널(창 없음)
const LAYERS = [['brick', 'win0.svg'], ['plaster', 'win1.svg'], [null, 'win2.svg'], ['panel', null]], FLAT = '#8080ff';
function wallSurface(kind) {
  const canvas = (fill) => { const c = Object.assign(document.createElement('canvas'), { width: 256, height: 256 }), x = c.getContext('2d'); x.fillStyle = fill; x.fillRect(0, 0, 256, 256); return x; };
  const x = canvas('#fff'), nx = canvas(FLAT); // 그림이 오기 전(또는 못 받으면) 흰 바탕·평평한 면 = 건물 색 그대로
  const map = sharp(new THREE.CanvasTexture(x.canvas)), normalMap = sharp(new THREE.CanvasTexture(nx.canvas), false);
  const load = (file) => file && new Promise((done) => Object.assign(new Image(), { onload() { done(this); }, onerror() { done(); }, src: url(file) }));
  const [name, win] = LAYERS[kind];
  Promise.all([load(name && name + '.jpg'), load(win), load(name && name + '_n.jpg')]).then(([p, w, n]) => {
    if (p) x.drawImage(p, 0, 0, 256, 256);
    if (n) nx.drawImage(n, 0, 0, 256, 256);
    if (w) {
      x.drawImage(w, 0, 0, 256, 256);
      const m = canvas('rgba(0,0,0,0)'); // 창 모양만 남긴 평평한 색
      m.drawImage(w, 0, 0, 256, 256); m.globalCompositeOperation = 'source-in'; m.fillStyle = FLAT; m.fillRect(0, 0, 256, 256);
      nx.drawImage(m.canvas, 0, 0);
    }
    map.needsUpdate = normalMap.needsUpdate = true;
  });
  return { map, normalMap };
}

// 간판 그림 16종을 한 장에 (2열 × 8행, 한 칸 256×64). 실제 상호가 아닌 업종 이름만
function signAtlas() {
  const c = Object.assign(document.createElement('canvas'), { width: 512, height: 512 }), x = c.getContext('2d');
  const words = ['약국', '카페', '부동산', '치킨', '노래방', 'PC방', '편의점', '미용실', '분식', '학원', '치과', '한의원', '세탁', '고깃집', '호프', '안경'];
  const colors = [['#1f8f4f', '#fff'], ['#5a3a2a', '#f4e4c8'], ['#f2c230', '#222'], ['#d8322f', '#fff'], ['#6a2fa0', '#ffe14a'], ['#1d4fa8', '#fff'], ['#fff', '#1d4fa8'], ['#e85d9a', '#fff']];
  x.font = 'bold 44px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  words.forEach((word, k) => {
    const [bg, fg] = colors[k % colors.length], px = (k % 2) * 256, py = Math.floor(k / 2) * 64;
    x.fillStyle = bg; x.fillRect(px, py, 256, 64);
    x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 4; x.strokeRect(px + 2, py + 2, 252, 60);
    x.fillStyle = fg; x.fillText(word, px + 128, py + 34);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

let mats;
// 재질은 처음 쓸 때 한 번만 만듦: { walls: [무늬별], roof, pitched: [기와, 골강판], signs }
export function buildingMaterials() {
  return (mats ??= {
    walls: [0, 1, 2, 3].map((k) => new THREE.MeshLambertMaterial({ ...wallSurface(k), vertexColors: true })),
    roof: new THREE.MeshLambertMaterial({ ...surface('concrete'), vertexColors: true }),
    pitched: ['rooftile', 'panel'].map((n) => new THREE.MeshLambertMaterial({ ...surface(n), vertexColors: true, side: THREE.DoubleSide })),
    signs: new THREE.MeshBasicMaterial({ map: signAtlas(), side: THREE.DoubleSide }),
  });
}
