// 메인 화면: 주소에 ?ll= 이 없을 때(처음 들어왔을 때)만 보임. 뒤에서는 게임이 돌고 카메라가 천천히 돎
// 시작하기 → 기본 위치에서 시작, 바로 가기·검색 → 그 위치로 새로 불러와 바로 게임
const CHIPS = { '서울 광화문': '37.5759,126.9768', '서울 강남': '37.4979,127.0276', '부산 해운대': '35.1631,129.1636', '제주': '33.4996,126.5312' };

// 돌려주는 값: 지금 메인 화면이 떠 있는지 알려 주는 함수
export function setupMenu() {
  const search = document.getElementById('search'), start = document.getElementById('start');
  if (new URLSearchParams(location.search).has('ll')) return () => false;
  document.body.classList.add('menu');
  document.getElementById('search-slot').append(search);
  document.getElementById('chips').append(...Object.entries(CHIPS).map(([name, ll]) => {
    const b = Object.assign(document.createElement('button'), { className: 'glass', textContent: name });
    b.addEventListener('click', () => (location.search = `?ll=${ll}`));
    return b;
  }));
  start.addEventListener('click', () => {
    document.body.classList.remove('menu');
    document.body.append(search); // 검색창을 게임 화면 왼쪽 위로
  });
  start.focus();
  return () => document.body.classList.contains('menu');
}
