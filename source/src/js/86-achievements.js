// ================= achievements =================
// Three tiers per game, three achievements per tier:
//   ★   first steps        ★★  takes practice        ★★★ needs skill and some luck
// Games report what happened with achEv(game, event, data); each achievement tests one event.
// Unlocks are kept in localStorage 'brick-ach' as { id: 'YYYY-MM-DD' } (rewards can hang off this later).
const ACH = [
  // BRICKFALL
  { id: 'fall-line', g: 'fall', s: 1, t: '첫 줄', d: '줄을 하나 지워요.', ev: 'clear', ok: x => x.n >= 1 },
  { id: 'fall-5k', g: 'fall', s: 1, t: '5,000점', d: '무한 모드에서 5,000점을 넘겨요.', ev: 'score', ok: x => !x.stage && x.score >= 5000 },
  { id: 'fall-st1', g: 'fall', s: 1, t: '스테이지 1 통과', d: '스테이지 모드에서 스테이지 1을 클리어해요.', ev: 'stageclear', ok: x => x.stage >= 1 },
  { id: 'fall-four', g: 'fall', s: 2, t: '한 번에 4줄', d: '블록 하나로 4줄을 한꺼번에 지워요.', ev: 'clear', ok: x => x.n >= 4 },
  { id: 'fall-lv10', g: 'fall', s: 2, t: '레벨 10', d: '무한 모드에서 레벨 10에 올라요.', ev: 'score', ok: x => !x.stage && x.level >= 10 },
  { id: 'fall-st5', g: 'fall', s: 2, t: '스테이지 5 통과', d: '스테이지 모드에서 스테이지 5를 클리어해요.', ev: 'stageclear', ok: x => x.stage >= 5 },
  { id: 'fall-four2', g: 'fall', s: 3, t: '연속 4줄', d: '4줄 지우기를 두 번 연달아 해요. 사이에 다른 줄을 지우면 안 돼요.', ev: 'clear', ok: x => x.n >= 4 && x.prev >= 4 },
  { id: 'fall-empty', g: 'fall', s: 3, t: '깨끗한 판', d: '줄을 지운 뒤 판에 블록이 하나도 남지 않게 해요.', ev: 'clear', ok: x => x.empty },
  { id: 'fall-100k', g: 'fall', s: 3, t: '100,000점', d: '무한 모드에서 100,000점을 넘겨요.', ev: 'score', ok: x => !x.stage && x.score >= 100000 },
  // BRICKPACK
  { id: 'pack-line', g: 'pack', s: 1, t: '첫 줄', d: '줄을 하나 지워요.', ev: 'place', ok: x => x.n >= 1 },
  { id: 'pack-1k', g: 'pack', s: 1, t: '1,000점', d: '한 판에 1,000점을 넘겨요.', ev: 'place', ok: x => x.score >= 1000 },
  { id: 'pack-st1', g: 'pack', s: 1, t: '스테이지 1 통과', d: '스테이지 모드에서 회색 돌을 모두 지워요.', ev: 'stageclear', ok: x => x.stage >= 1 },
  { id: 'pack-three', g: 'pack', s: 2, t: '한 번에 3줄', d: '조각 하나로 3줄 이상을 지워요.', ev: 'place', ok: x => x.n >= 3 },
  { id: 'pack-combo5', g: 'pack', s: 2, t: '콤보 ×5', d: '콤보를 5까지 이어가요.', ev: 'place', ok: x => x.combo >= 5 },
  { id: 'pack-st5', g: 'pack', s: 2, t: '스테이지 5 통과', d: '스테이지 모드에서 스테이지 5를 클리어해요.', ev: 'stageclear', ok: x => x.stage >= 5 },
  { id: 'pack-five', g: 'pack', s: 3, t: '한 번에 5줄', d: '조각 하나로 5줄 이상을 지워요.', ev: 'place', ok: x => x.n >= 5 },
  { id: 'pack-empty', g: 'pack', s: 3, t: '판 비우기', d: '판을 완전히 비워요.', ev: 'place', ok: x => x.empty },
  { id: 'pack-20k', g: 'pack', s: 3, t: '20,000점', d: '한 판에 20,000점을 넘겨요.', ev: 'place', ok: x => x.score >= 20000 },
  // BRICKBREAK
  { id: 'brk-100', g: 'brk', s: 1, t: '벽돌 100개', d: '한 판에 벽돌 100개를 깨요.', ev: 'brick', ok: x => x.broken >= 100 },
  { id: 'brk-item', g: 'brk', s: 1, t: '첫 아이템', d: '떨어지는 아이템을 받아요.', ev: 'item', ok: () => true },
  { id: 'brk-st1', g: 'brk', s: 1, t: '스테이지 1 통과', d: '스테이지 모드에서 첫 벽돌 판을 깨요.', ev: 'stageclear', ok: x => x.stage >= 1 },
  { id: 'brk-lv5', g: 'brk', s: 2, t: '레벨 5', d: '무한 모드에서 레벨 5까지 버텨요.', ev: 'level', ok: x => x.level >= 5 },
  { id: 'brk-ball3', g: 'brk', s: 2, t: '공 세 개', d: '공 3개 이상을 동시에 띄워요.', ev: 'item', ok: x => x.balls >= 3 },
  { id: 'brk-clean', g: 'brk', s: 2, t: '실수 없이', d: '스테이지 모드에서 목숨을 잃지 않고 한 스테이지를 클리어해요.', ev: 'stageclear', ok: x => x.noLoss },
  { id: 'brk-st10', g: 'brk', s: 3, t: '스테이지 10 통과', d: '스테이지 모드에서 벽돌 판 10개를 모두 깨요.', ev: 'stageclear', ok: x => x.stage >= 10 },
  { id: 'brk-ball7', g: 'brk', s: 3, t: '공 일곱 개', d: '공 7개 이상을 동시에 띄워요.', ev: 'item', ok: x => x.balls >= 7 },
  { id: 'brk-lv12', g: 'brk', s: 3, t: '레벨 12', d: '무한 모드에서 레벨 12까지 버텨요.', ev: 'level', ok: x => x.level >= 12 },
  // BRICKSTACK
  { id: 'stk-10', g: 'stk', s: 1, t: '10층', d: '탑을 10층까지 쌓아요.', ev: 'stack', ok: x => x.height >= 10 },
  { id: 'stk-perfect', g: 'stk', s: 1, t: '첫 퍼펙트', d: '벽돌을 아래 벽돌과 딱 맞게 놓아요.', ev: 'stack', ok: x => x.run >= 1 },
  { id: 'stk-20', g: 'stk', s: 1, t: '20층', d: '탑을 20층까지 쌓아요.', ev: 'stack', ok: x => x.height >= 20 },
  { id: 'stk-40', g: 'stk', s: 2, t: '40층', d: '탑을 40층까지 쌓아요.', ev: 'stack', ok: x => x.height >= 40 },
  { id: 'stk-run3', g: 'stk', s: 2, t: '퍼펙트 ×3', d: '퍼펙트를 3번 연달아 해서 벽돌을 다시 넓혀요.', ev: 'stack', ok: x => x.run >= 3 },
  { id: 'stk-p10', g: 'stk', s: 2, t: '퍼펙트 10번', d: '한 판에 퍼펙트를 10번 해요.', ev: 'stack', ok: x => x.perfects >= 10 },
  { id: 'stk-80', g: 'stk', s: 3, t: '80층', d: '탑을 80층까지 쌓아요.', ev: 'stack', ok: x => x.height >= 80 },
  { id: 'stk-run10', g: 'stk', s: 3, t: '퍼펙트 ×10', d: '퍼펙트를 10번 연달아 해요.', ev: 'stack', ok: x => x.run >= 10 },
  { id: 'stk-p30', g: 'stk', s: 3, t: '퍼펙트 30번', d: '한 판에 퍼펙트를 30번 해요.', ev: 'stack', ok: x => x.perfects >= 30 },
  // BRICKPOP
  { id: 'pop-10', g: 'pop', s: 1, t: '10개 한 번에', d: '덩어리 하나로 10개 이상을 터뜨려요.', ev: 'pop', ok: x => x.n >= 10 },
  { id: 'pop-lv3', g: 'pop', s: 1, t: '레벨 3', d: '무한 모드에서 레벨 3에 올라요.', ev: 'pop', ok: x => !x.stage && x.level >= 3 },
  { id: 'pop-st1', g: 'pop', s: 1, t: '스테이지 1 통과', d: '스테이지 모드에서 첫 목표 점수를 넘겨요.', ev: 'stageclear', ok: x => x.stage >= 1 },
  { id: 'pop-20', g: 'pop', s: 2, t: '20개 한 번에', d: '덩어리 하나로 20개 이상을 터뜨려요.', ev: 'pop', ok: x => x.n >= 20 },
  { id: 'pop-lv6', g: 'pop', s: 2, t: '레벨 6', d: '무한 모드에서 레벨 6에 올라요.', ev: 'pop', ok: x => !x.stage && x.level >= 6 },
  { id: 'pop-st5', g: 'pop', s: 2, t: '스테이지 5 통과', d: '스테이지 모드에서 스테이지 5를 클리어해요.', ev: 'stageclear', ok: x => x.stage >= 5 },
  { id: 'pop-35', g: 'pop', s: 3, t: '35개 한 번에', d: '덩어리 하나로 35개 이상을 터뜨려요.', ev: 'pop', ok: x => x.n >= 35 },
  { id: 'pop-empty', g: 'pop', s: 3, t: '판 비우기', d: '스테이지 모드에서 꽉 찬 판을 하나도 남김없이 비워요.', ev: 'pop', ok: x => x.stage && x.empty },
  { id: 'pop-st8', g: 'pop', s: 3, t: '스테이지 8 통과', d: '스테이지 모드에서 스테이지 8을 클리어해요.', ev: 'stageclear', ok: x => x.stage >= 8 },
  // BRICKSLIDE
  { id: 'sld-line', g: 'sld', s: 1, t: '첫 줄', d: '줄을 하나 지워요.', ev: 'clear', ok: x => x.rows >= 1 },
  { id: 'sld-10', g: 'sld', s: 1, t: '한 판에 10줄', d: '한 판에 줄 10개를 지워요.', ev: 'clear', ok: x => x.lines >= 10 },
  { id: 'sld-chain2', g: 'sld', s: 1, t: '연쇄 ×2', d: '줄이 지워진 뒤 떨어진 벽돌로 또 줄을 지워요.', ev: 'clear', ok: x => x.chain >= 2 },
  { id: 'sld-two', g: 'sld', s: 2, t: '한 번에 2줄', d: '한 번에 2줄을 지워요.', ev: 'clear', ok: x => x.rows >= 2 },
  { id: 'sld-40', g: 'sld', s: 2, t: '한 판에 40줄', d: '한 판에 줄 40개를 지워요.', ev: 'clear', ok: x => x.lines >= 40 },
  { id: 'sld-chain3', g: 'sld', s: 2, t: '연쇄 ×3', d: '연쇄를 3번 이어가요.', ev: 'clear', ok: x => x.chain >= 3 },
  { id: 'sld-three', g: 'sld', s: 3, t: '한 번에 3줄', d: '한 번에 3줄 이상을 지워요.', ev: 'clear', ok: x => x.rows >= 3 },
  { id: 'sld-100', g: 'sld', s: 3, t: '한 판에 100줄', d: '한 판에 줄 100개를 지워요.', ev: 'clear', ok: x => x.lines >= 100 },
  { id: 'sld-chain5', g: 'sld', s: 3, t: '연쇄 ×5', d: '연쇄를 5번 이어가요.', ev: 'clear', ok: x => x.chain >= 5 },
  // BRICKSNAKE
  { id: 'snk-10', g: 'snk', s: 1, t: '벽돌 10개', d: '한 판에 벽돌 10개를 먹어요.', ev: 'eat', ok: x => x.eaten >= 10 },
  { id: 'snk-pop', g: 'snk', s: 1, t: '첫 터뜨리기', d: '같은 색 3개를 이어 터뜨려요.', ev: 'pop', ok: x => x.n >= 3 },
  { id: 'snk-500', g: 'snk', s: 1, t: '500점', d: '한 판에 500점을 넘겨요.', ev: 'eat', ok: x => x.score >= 500 },
  { id: 'snk-len20', g: 'snk', s: 2, t: '길이 20', d: '뱀의 길이를 20칸까지 늘려요.', ev: 'eat', ok: x => x.length >= 20 },
  { id: 'snk-chain2', g: 'snk', s: 2, t: '연쇄 ×2', d: '터진 뒤 맞닿은 색으로 한 번 더 터뜨려요.', ev: 'pop', ok: x => x.chain >= 2 },
  { id: 'snk-50', g: 'snk', s: 2, t: '벽돌 50개', d: '한 판에 벽돌 50개를 먹어요.', ev: 'eat', ok: x => x.eaten >= 50 },
  { id: 'snk-120', g: 'snk', s: 3, t: '벽돌 120개', d: '한 판에 벽돌 120개를 먹어요. 아주 빨라져요.', ev: 'eat', ok: x => x.eaten >= 120 },
  { id: 'snk-pop5', g: 'snk', s: 3, t: '5개 한 번에', d: '같은 색 5개 이상을 한 번에 터뜨려요.', ev: 'pop', ok: x => x.n >= 5 },
  { id: 'snk-chain3', g: 'snk', s: 3, t: '연쇄 ×3', d: '연쇄를 3번 이어가요.', ev: 'pop', ok: x => x.chain >= 3 },
];
const ACH_KEY = 'brick-ach';
const achGot = () => loadJSON(ACH_KEY) || {};
const achQueue = [];
let achShowing = false;
function achEv(g, ev, data) {
  let got = null;
  for (const a of ACH) {
    if (a.g !== g || a.ev !== ev) continue;
    got = got || achGot();
    if (got[a.id]) continue;
    let ok = false; try { ok = !!a.ok(data || {}); } catch (e) {}
    if (!ok) continue;
    got[a.id] = today(); saveJSON(ACH_KEY, got);
    achQueue.push(a);
  }
  if (achQueue.length && !achShowing) achNext();
}
// unlock notice: one at a time, a couple of seconds each
function achNext() {
  const a = achQueue.shift(); if (!a) { achShowing = false; return; }
  achShowing = true;
  $('achStars').textContent = '★'.repeat(a.s);
  $('achName').textContent = a.t;
  const el = $('achToast'); el.hidden = false; el.classList.remove('out');
  sfx('perfect');
  setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.hidden = true; achNext(); }, 250); }, 2400);
}

const GAME_NAMES = { fall: 'BRICKFALL', pack: 'BRICKPACK', brk: 'BRICKBREAK', stk: 'BRICKSTACK', pop: 'BRICKPOP', sld: 'BRICKSLIDE', snk: 'BRICKSNAKE' };
const achStars = (got = achGot()) => ACH.filter(a => got[a.id]).reduce((n, a) => n + a.s, 0);
const achAll = (got = achGot()) => ACH.every(a => got[a.id]);
const titleOpen = (ti, stars, all) => ti.all ? all : stars >= ti.stars;
// the title shown on the menu: the one picked on the achievements screen, else the best one unlocked
function currentTitle() {
  const got = achGot(), stars = achStars(got), all = achAll(got);
  const open = TITLES.filter(ti => titleOpen(ti, stars, all));
  return open.find(ti => ti.name === settings.title) || open[open.length - 1];
}
function showTitle() { const ti = currentTitle(); $('mTitle').textContent = `${ti.name} · ★ ${achStars()}`; }
function renderRewards() {
  const got = achGot(), stars = achStars(got), all = achAll(got), box = $('rewards');
  box.textContent = '';
  const h = document.createElement('h3'); h.textContent = '보상'; box.append(h);
  const p = document.createElement('p'); p.className = 'note';
  p.textContent = '업적으로 모은 별이 많을수록 더 많은 꾸미기가 열려요. 게임 규칙에는 영향이 없어요.'; box.append(p);
  const group = (label, items, isOn, pick) => {
    const g = document.createElement('div'); g.className = 'rw-group';
    const l = document.createElement('span'); l.className = 'label'; l.textContent = label; g.append(l);
    const row = document.createElement('div'); row.className = 'rw-row';
    for (const it of items) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'rw';
      const open = it.open;
      b.disabled = !open; b.setAttribute('aria-pressed', String(open && isOn(it)));
      if (it.swatch) { const i = document.createElement('i'); for (const col of it.swatch) { const s = document.createElement('b'); s.style.background = col; i.append(s); } b.append(i); }
      b.append(open ? it.name : `${it.name} · ★${it.need} 필요`);
      if (open) b.addEventListener('click', () => { pick(it); renderRewards(); });
      row.append(b);
    }
    g.append(row); box.append(g);
  };
  group('블록 색', Object.entries(PALETTES).map(([k, v]) => ({ key: k, name: v.name, need: v.stars, open: stars >= v.stars, swatch: [v.cols[4], v.cols[1], v.cols[5], v.cols[3]] })),
    it => (settings.palette || 'base') === it.key, it => { settings.palette = it.key; saveSettings(); setLook(settings.palette, settings.shape); refreshTheme(); });
  group('블록 모양', Object.entries(SHAPES_LOOK).map(([k, v]) => ({ key: k, name: v.name, need: v.stars, open: stars >= v.stars })),
    it => (settings.shape || 'bevel') === it.key, it => { settings.shape = it.key; saveSettings(); setLook(settings.palette, settings.shape); refreshTheme(); });
  const cur = currentTitle();
  group('칭호', TITLES.map(ti => ({ key: ti.name, name: ti.name, need: ti.all ? '전부' : ti.stars, open: titleOpen(ti, stars, all) })),
    it => cur.name === it.key, it => { settings.title = it.key; saveSettings(); });
}
function renderAch() {
  renderRewards();
  const got = achGot(), list = $('achList');
  const total = ACH.length, have = ACH.filter(a => got[a.id]).length;
  const starsHave = ACH.filter(a => got[a.id]).reduce((n, a) => n + a.s, 0), starsAll = ACH.reduce((n, a) => n + a.s, 0);
  $('achSum').textContent = `${have} / ${total}개 달성 · 별 ${starsHave} / ${starsAll}`;
  list.textContent = '';
  for (const g of Object.keys(GAME_NAMES)) {
    const sec = document.createElement('section'); sec.className = 'ach-game';
    const mine = ACH.filter(a => a.g === g);
    const h = document.createElement('h3');
    h.textContent = GAME_NAMES[g];
    const c = document.createElement('span'); c.textContent = `${mine.filter(a => got[a.id]).length}/${mine.length}`; h.append(c);
    sec.append(h);
    for (const a of mine) {
      const row = document.createElement('div'); row.className = 'ach' + (got[a.id] ? ' got' : '');
      const st = document.createElement('span'); st.className = 'ach-stars'; st.setAttribute('aria-label', `별 ${a.s}개`);
      st.textContent = '★'.repeat(a.s) + '☆'.repeat(3 - a.s);
      const body = document.createElement('div');
      const t = document.createElement('b'); t.textContent = a.t;
      const d = document.createElement('p'); d.textContent = a.d;
      body.append(t, d);
      const when = document.createElement('span'); when.className = 'ach-when';
      when.textContent = got[a.id] ? got[a.id].replace(/-/g, '.') : '잠김';
      row.append(st, body, when);
      sec.append(row);
    }
    list.append(sec);
  }
}
$('goAch').addEventListener('click', () => show('ach'));
