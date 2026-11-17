import assert from 'node:assert';
import { parsePoly, inPoly } from './poly.js';
const rings = parsePoly(`korea
1
   1.26E+02   3.3E+01
   1.30E+02   3.3E+01
   1.30E+02   3.8E+01
   1.26E+02   3.8E+01
   1.26E+02   3.3E+01
END
!2
   127 35
   128 35
   128 36
END
island
   131.8 37.2
   131.9 37.2
   131.9 37.3
   131.8 37.3
END
END
`);
assert.equal(rings.length, 2, '구멍은 빼고 바깥 링 2개');
assert.ok(inPoly(rings, 126.98, 37.57) && inPoly(rings, 131.85, 37.25));
assert.ok(!inPoly(rings, 130.4, 33.6 - 1) && !inPoly(rings, 125, 37));
console.log('poly ok');
