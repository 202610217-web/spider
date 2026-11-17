import assert from 'node:assert';
import { cityMatches, nominatim } from './cities.js';

assert.deepEqual(cityMatches('서울 광화문'), [{ name: '서울 광화문', addr: '바로 이동', ll: '37.5759,126.9768' }]);
assert.deepEqual(cityMatches(' 부산 ').map((c) => c.name), ['부산 서면', '부산 해운대'], '일부만 쳐도 찾음');
assert.equal(cityMatches('롯데월드타워').length, 0);

let asked;
const hits = await nominatim(' 롯데월드타워 ', (url) => {
  asked = url;
  return [{ lat: '37.5125537', lon: '127.1026790', name: '롯데월드타워', display_name: '롯데월드타워, 잠실로, 신천동, 송파구, 서울특별시, 05551, 대한민국' }, { lat: 'x', lon: '1' }];
});
assert.deepEqual(hits, [{ name: '롯데월드타워', addr: '서울특별시 송파구 신천동 잠실로', ll: '37.51255,127.10268' }], '이상한 응답은 버리고 주소는 큰 단위부터');
assert.ok(asked.includes('countrycodes=kr') && asked.endsWith('q=' + encodeURIComponent('롯데월드타워')), '한국 안에서만, 검색어는 인코딩');
assert.deepEqual(await nominatim('없는 곳', () => []), []);
console.log('cities ok');
