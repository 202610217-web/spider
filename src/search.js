import { cityMatches, nominatim } from './cities.js';
import { hasKakao, kakao } from './kakao.js';

// 장소 검색창: 치는 동안 결과 목록을 보여 주고, 고르면 그 위치(?ll=위도,경도)에서 다시 시작
// 카카오 키가 있으면 치는 대로 카카오 검색, 없거나 실패하면 치는 동안은 도시 목록만·Enter를 누르면 OSM 검색
export function setupSearch(input, list, status) {
  let items = [], shownFor = '', active = 0, seq = 0, timer, useKakao = hasKakao; // shownFor: 지금 목록이 어떤 검색어의 결과인지
  const say = (text) => { status.textContent = text; status.hidden = !text; };
  const show = () => {
    list.replaceChildren(...items.map((it, i) => {
      const li = document.createElement('li');
      li.id = `result-${i}`; li.role = 'option'; li.ariaSelected = String(i === active);
      const name = document.createElement('b'), addr = document.createElement('small');
      name.textContent = it.name; addr.textContent = it.addr; // 검색 결과는 글자로만 넣음(HTML로 해석하지 않음)
      li.append(name, addr);
      li.addEventListener('pointerdown', (e) => { e.preventDefault(); go(it); }); // 입력창이 포커스를 잃기 전에
      return li;
    }));
    list.hidden = !items.length;
    input.setAttribute('aria-expanded', String(items.length > 0));
    if (items.length) input.setAttribute('aria-activedescendant', `result-${active}`); else input.removeAttribute('aria-activedescendant');
    list.children[active]?.scrollIntoView({ block: 'nearest' });
  };
  const go = (it) => { say(`${it.name}(으)로 이동 중…`); location.search = `?ll=${it.ll}`; }; // 원점이 바뀌므로 새로 불러옴
  const close = () => { clearTimeout(timer); seq++; items = []; show(); say(''); };

  // live: 치는 중(서비스 호출을 아낌), 아니면 Enter로 확정한 검색
  async function search(live) {
    const q = input.value.trim(), mine = ++seq;
    items = q ? cityMatches(q) : []; shownFor = q; active = 0; show();
    if (q.length < 2 || (live && !useKakao)) return say(q && !items.length ? 'Enter로 주소·건물 이름 검색' : '');
    say('찾는 중…');
    let found = null;
    if (useKakao) found = await kakao(q).catch((e) => { console.warn(e); useKakao = false; return null; }); // 실패하면 이후 OSM으로
    if (!found && !live) found = await nominatim(q).catch(() => null);
    if (mine !== seq) return; // 그사이 새로 침
    if (found) { items = [...items, ...found.filter((f) => !items.some((c) => c.ll === f.ll))]; show(); }
    if (!live && items.length === 1) return go(items[0]); // Enter로 찾은 결과가 하나뿐이면 바로 이동
    say(items.length ? '' : found ? `못 찾음: ${q}` : live ? 'Enter로 주소·건물 이름 검색' : '검색 서비스에 연결하지 못했어요');
  }

  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => search(true), 250); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!items.length) return;
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length; show();
    } else if (e.key === 'Enter') {
      clearTimeout(timer);
      if (items.length && status.hidden && shownFor === input.value.trim()) go(items[active]); else search(false); // 지금 검색어의 목록이 떠 있으면 고른 곳으로, 아니면 검색
    } else if (e.key === 'Escape') { input.value = ''; close(); input.blur(); }
  });
  input.addEventListener('blur', close);
  // '/' 키로 검색창으로 (게임 중 마우스 고정도 풂)
  addEventListener('keydown', (e) => { if (e.key === '/' && document.activeElement !== input) { e.preventDefault(); document.exitPointerLock?.(); input.focus(); } });
}
