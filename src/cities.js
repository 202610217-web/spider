// 장소 검색 순간이동: 도시를 고르거나 주소·건물 이름을 치면 그 위치(위도,경도)에서 다시 시작
const CITIES = {
  '서울 광화문': '37.5759,126.9768', '서울 강남': '37.4979,127.0276', '서울 여의도': '37.5219,126.9245', '서울 잠실': '37.5133,127.1001',
  '부산 서면': '35.1577,129.0590', '부산 해운대': '35.1631,129.1636', '대구': '35.8690,128.5940', '인천': '37.4563,126.7052', '인천 송도': '37.3830,126.6560',
  '광주': '35.1470,126.9190', '대전': '36.3504,127.3845', '울산': '35.5384,129.3114', '세종': '36.4800,127.2890', '수원': '37.2636,127.0286',
  '창원': '35.2279,128.6811', '전주': '35.8242,127.1480', '청주': '36.6424,127.4890', '춘천': '37.8813,127.7298', '포항': '36.0190,129.3435', '제주': '33.4996,126.5312',
};

// 검색어 → '위도,경도' (없으면 null). 목록의 도시가 아니면 OSM 검색 서비스(Nominatim)에 한국 안에서 주소·건물 이름을 물어봄
// Nominatim 이용 규칙: 초당 1회 이하 → 글자를 칠 때마다가 아니라 입력을 마쳤을 때(Enter)만 부름
export async function findPlace(q, fetchJson = (url) => fetch(url).then((r) => r.json())) {
  q = q.trim();
  if (!q) return null;
  const name = CITIES[q] ? q : Object.keys(CITIES).find((c) => c.includes(q)); // "부산"만 쳐도 첫 항목으로
  if (name) return CITIES[name];
  const [hit] = await fetchJson(`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=kr&accept-language=ko&limit=1&q=${encodeURIComponent(q)}`);
  return hit && isFinite(hit.lat) && isFinite(hit.lon) ? `${(+hit.lat).toFixed(5)},${(+hit.lon).toFixed(5)}` : null;
}

export function setupCities(input, list) {
  list.innerHTML = Object.keys(CITIES).map((c) => `<option value="${c}">`).join('');
  const hint = input.placeholder;
  input.addEventListener('change', async () => {
    const q = input.value;
    input.disabled = true; input.value = ''; input.placeholder = '찾는 중…';
    const ll = await findPlace(q).catch(() => null); // 검색 서비스에 못 닿아도 게임은 그대로
    if (ll) return void (location.search = `?ll=${ll}`); // 원점이 바뀌므로 새로 불러옴
    input.disabled = false; input.placeholder = q.trim() ? `못 찾음: ${q.trim()}` : hint;
  });
}
