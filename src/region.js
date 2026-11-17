// 현재 위치의 행정구역 이름("서울특별시 종로구")을 OSM Nominatim 역지오코딩으로 알아냄
// Nominatim 이용 규칙(초당 1회 이하, 대량 호출 금지) → 300m 이상 움직였고 마지막 요청 뒤 10초가 지났을 때만 물어봄
const MOVE = 300, WAIT = 10000;

// Nominatim의 address → "시·도 시·군·구" (동 이하는 뺌). 광역시는 city+borough, 도는 province+city(+borough) 또는 province+county
export function regionName(a = {}) {
  const parts = [a.province ?? a.state, a.city, a.county, a.borough ?? a.city_district].filter(Boolean);
  return [...new Set(parts)].join(' ');
}

const ask = (lat, lon) => fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&accept-language=ko&lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}`).then((r) => r.json());

// show(이름): 이름이 바뀔 때 불림. 돌려주는 update(x, z, lat, lon, now)를 가끔(초당 몇 번) 부르면 됨
export function watchRegion(show, fetchJson = ask) {
  let lx = Infinity, lz = Infinity, lt = -Infinity, name = '';
  return (x, z, lat, lon, now) => {
    if (Math.hypot(x - lx, z - lz) < MOVE || now - lt < WAIT) return;
    lx = x; lz = z; lt = now;
    fetchJson(lat, lon).then((r) => {
      const n = regionName(r?.address);
      if (n && n !== name) show((name = n));
    }).catch(() => {}); // 서비스에 못 닿으면 마지막으로 알아낸 이름을 그대로 둠
  };
}
