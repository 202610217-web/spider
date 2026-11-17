import assert from 'node:assert';
import { gisTags, checkFields, useToBuilding } from './gis.js';

const row = (o) => ({ A9: '단독주택', A13: '19870512', A16: '0', A26: '2', A11: '벽돌구조', ...o });
assert.equal(useToBuilding('공동주택', 15), 'apartments');
assert.equal(useToBuilding('공동주택', 4), 'residential', '4층 공동주택은 빌라');
assert.equal(useToBuilding('제2종근린생활시설'), 'commercial');
assert.equal(useToBuilding('창고시설'), 'warehouse');
assert.equal(useToBuilding(''), 'yes');
assert.deepEqual(gisTags(row({}), 'A11'), { building: 'house', 'building:levels': 2, start_date: '1987', 'building:material': 'brick' }, '높이 0은 없는 값으로');
assert.deepEqual(gisTags(row({ A16: '45.5', A26: '15', A9: '공동주택', A11: '철근콘크리트구조' }), 'A11'), { building: 'apartments', height: 45.5, 'building:levels': 15, start_date: '1987' });
assert.equal(gisTags(row({ A11: '목구조' }), 'A11')['building:architecture'], 'traditional');
assert.equal(checkFields([row({}), row({ A9: '제1종근린생활시설' }), row({})]), 'A11', '구조명 칸을 찾음');
assert.throws(() => checkFields([{ A9: '12', A26: '단독주택' }]), /필드 번호가 예상과 다름/, '번호가 바뀐 배포본은 멈춤');
console.log('gis ok');
