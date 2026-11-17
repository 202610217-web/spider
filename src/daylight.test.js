import assert from 'node:assert';
import { sunDirection, daylight } from './daylight.js';

const deg = (v) => (Math.asin(v[1]) * 180) / Math.PI;
// 서울(37.5°): 춘분(80일) 남중 고도 ≈ 90 - 37.5 = 52.5°, 하지(172일) ≈ 76°, 동지(355일) ≈ 29°
assert.ok(Math.abs(deg(sunDirection(12.5, 80)) - 52.5) < 1.5, `춘분 ${deg(sunDirection(12.5, 80))}`);
assert.ok(Math.abs(deg(sunDirection(12.5, 172)) - 76) < 1, `하지 ${deg(sunDirection(12.5, 172))}`);
assert.ok(Math.abs(deg(sunDirection(12.5, 355)) - 29) < 1, `동지 ${deg(sunDirection(12.5, 355))}`);
const noon = sunDirection(12.5, 80), am = sunDirection(9, 80), pm = sunDirection(16, 80);
assert.ok(noon[2] > 0.5 && Math.abs(noon[0]) < 1e-9, '남중 때는 정남쪽(+z)');
assert.ok(am[0] > 0.5 && pm[0] < -0.5, '오전엔 동쪽(+x), 오후엔 서쪽');
assert.ok(sunDirection(0.5, 80)[1] < -0.7, '자정엔 지평선 아래');
assert.ok(Math.abs(Math.hypot(...am) - 1) < 1e-9);

const n = daylight(-30), d = daylight(60), s = daylight(1);
assert.ok(n.night === 1 && n.moon && d.night === 0 && !d.moon, '밤은 창문 불빛 켜고 달빛, 낮은 끔');
assert.ok(d.sunIntensity > s.sunIntensity && s.sunIntensity > daylight(-5).sunIntensity, '해가 높을수록 밝음');
assert.equal(s.fog, 0xe9a882, '해 뜰 때 노을빛 안개');
assert.equal(daylight(-9.5).fog, 0x202745, '사이 값은 섞음(가운데)');
console.log('daylight ok');
