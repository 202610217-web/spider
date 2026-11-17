// 카카오맵 장소 검색·주소 변환 (Kakao 지도 Web API의 services 라이브러리, https://apis.map.kakao.com/web/documentation/#services)
// JavaScript 키는 카카오 개발자 사이트에서 발급받아 사이트 도메인을 등록해야 함. 빌드 때 VITE_KAKAO_KEY로 넣음 (없으면 OSM 검색을 씀)
const KEY = import.meta.env.VITE_KAKAO_KEY;
export const hasKakao = !!KEY;

let sdk; // Promise<kakao.maps.services> — 처음 검색할 때 한 번만 불러옴
const services = () => (sdk ??= new Promise((ok, fail) => {
  const s = document.createElement('script');
  s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(KEY)}&libraries=services&autoload=false`;
  s.onload = () => window.kakao.maps.load(() => ok(window.kakao.maps.services));
  s.onerror = () => fail(new Error('카카오 지도 API를 불러오지 못함 (키 또는 등록 도메인 확인)'));
  document.head.append(s);
}));

// 검색어 → [{ name, addr, ll }]. 주소로 맞는 것을 먼저, 그다음 장소(건물·가게 이름)
export async function kakao(q) {
  const sv = await services();
  const ask = (run) => new Promise((ok, fail) => run((result, status) => (status === sv.Status.ERROR ? fail(new Error('카카오 검색 오류')) : ok(status === sv.Status.OK ? result : []))));
  const ll = (r) => `${(+r.y).toFixed(5)},${(+r.x).toFixed(5)}`; // x 경도, y 위도
  const [addrs, places] = await Promise.all([
    ask((cb) => new sv.Geocoder().addressSearch(q, cb, { size: 3 })),
    ask((cb) => new sv.Places().keywordSearch(q, cb, { size: 6 })),
  ]);
  return [
    ...addrs.map((r) => ({ name: r.address_name, addr: '주소', ll: ll(r) })),
    ...places.map((r) => ({ name: r.place_name, addr: r.road_address_name || r.address_name, ll: ll(r) })),
  ];
}
