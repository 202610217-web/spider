// 장소 검색에 쓰는 자료: 미리 넣어 둔 도시 목록과 OSM 검색. 결과는 모두 { name, addr, ll: '위도,경도' }
const CITIES = {
  '서울 광화문': '37.5759,126.9768', '서울 강남': '37.4979,127.0276', '서울 여의도': '37.5219,126.9245', '서울 잠실': '37.5133,127.1001',
  '부산 서면': '35.1577,129.0590', '부산 해운대': '35.1631,129.1636', '대구': '35.8690,128.5940', '인천': '37.4563,126.7052', '인천 송도': '37.3830,126.6560',
  '광주': '35.1470,126.9190', '대전': '36.3504,127.3845', '울산': '35.5384,129.3114', '세종': '36.4800,127.2890', '수원': '37.2636,127.0286',
  '창원': '35.2279,128.6811', '전주': '35.8242,127.1480', '청주': '36.6424,127.4890', '춘천': '37.8813,127.7298', '포항': '36.0190,129.3435', '제주': '33.4996,126.5312',
};


// 목록의 도시 중 검색어가 들어간 것 (서비스를 부르지 않으므로 글자를 칠 때마다 바로)
export const cityMatches = (q) => Object.keys(CITIES).filter((c) => c.includes(q.trim())).map((name) => ({ name, addr: '바로 이동', ll: CITIES[name] }));

// OSM 검색 서비스(Nominatim): 한국 안에서 주소·건물 이름을 찾음. 카카오 키가 없을 때 씀
// 이용 규칙: 초당 1회 이하·자동완성 금지 → 글자를 칠 때마다가 아니라 입력을 마쳤을 때(Enter)만 부를 것
export async function nominatim(q, fetchJson = (url) => fetch(url).then((r) => r.json())) {
  const hits = await fetchJson(`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=kr&accept-language=ko&limit=5&q=${encodeURIComponent(q.trim())}`);
  return hits.filter((h) => isFinite(h.lat) && isFinite(h.lon)).map((h) => {
    const [name, ...rest] = String(h.display_name ?? '').split(', ');
    return { name: h.name || name, addr: rest.filter((p) => p !== '대한민국' && !/^\d{5}$/.test(p)).reverse().join(' '), ll: `${(+h.lat).toFixed(5)},${(+h.lon).toFixed(5)}` }; // 주소는 큰 단위부터, 우편번호·나라는 뺌
  });
}
