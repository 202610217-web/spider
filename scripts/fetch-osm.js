// 광화문 일대 1km×1km 건물 → public/data/test.json (원점 기준 미터 좌표)
import { writeFileSync, mkdirSync } from 'node:fs';
import { buildingHeight } from '../src/height.js';

const ORIGIN = [126.9768, 37.5759]; // [lon, lat] 광화문
const HALF = 500; // m
const M_LAT = 111320, M_LON = 111320 * Math.cos(ORIGIN[1] * Math.PI / 180);
const dLat = HALF / M_LAT, dLon = HALF / M_LON;
const bbox = [ORIGIN[1] - dLat, ORIGIN[0] - dLon, ORIGIN[1] + dLat, ORIGIN[0] + dLon].join(',');

// shortcut: 멀티폴리곤 relation 건물은 제외, 전국 타일 단계에서 추가
const query = `[out:json][timeout:60];way["building"](${bbox});out geom tags;`;
const res = await fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'spider-game-dev' },
  body: 'data=' + encodeURIComponent(query),
});
if (!res.ok) throw new Error(`Overpass ${res.status}: ${await res.text()}`);
const { elements } = await res.json();

const buildings = elements
  .filter((e) => e.geometry?.length >= 4 && !e.tags.military && e.tags.building !== 'military')
  .map((e) => ({
    h: buildingHeight(e.tags),
    ring: e.geometry.map(({ lon, lat }) => [
      +((lon - ORIGIN[0]) * M_LON).toFixed(2),
      +((lat - ORIGIN[1]) * M_LAT).toFixed(2), // y = 북쪽
    ]),
  }));

mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/test.json', JSON.stringify({ origin: ORIGIN, attribution: '© OpenStreetMap contributors', buildings }));
console.log(`${buildings.length} buildings saved`);
