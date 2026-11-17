import assert from 'node:assert';
import { findPlace } from './cities.js';

const never = () => { throw new Error('목록에 있는 도시는 검색 서비스를 부르지 않음'); };
assert.equal(await findPlace('서울 광화문', never), '37.5759,126.9768');
assert.equal(await findPlace(' 부산 ', never), '35.1577,129.0590', '일부만 쳐도 첫 항목');
assert.equal(await findPlace('  ', never), null);
let asked;
assert.equal(await findPlace('롯데월드타워', (url) => { asked = url; return [{ lat: '37.5125537', lon: '127.1026790' }]; }), '37.51255,127.10268');
assert.ok(asked.includes('countrycodes=kr') && asked.endsWith('q=' + encodeURIComponent('롯데월드타워')), '한국 안에서만, 검색어는 인코딩');
assert.equal(await findPlace('없는 곳', () => []), null);
assert.equal(await findPlace('이상한 응답', () => [{ lat: 'x' }]), null);
console.log('cities ok');
