// ================= stats, record transfer, daily results, how-to-play =================
const GAMES = [
  { id: 'fall', name: 'BRICKFALL', best: () => best, unit: '' },
  { id: 'fall-stage', name: 'BRICKFALL · 스테이지', best: () => stageRec('fall').best, stage: 'fall', unit: '' },
  { id: 'pack', name: 'BRICKPACK', best: () => pBest, unit: '' },
  { id: 'pack-stage', name: 'BRICKPACK · 스테이지', best: () => stageRec('pack').best, stage: 'pack', unit: '' },
  { id: 'brk', name: 'BRICKBREAK', best: () => bBest, unit: '' },
  { id: 'brk-stage', name: 'BRICKBREAK · 스테이지', best: () => stageRec('brk').best, stage: 'brk', unit: '' },
  { id: 'stk', name: 'BRICKSTACK', best: () => tBest, unit: '층' },
  { id: 'pop', name: 'BRICKPOP', best: () => oBest, unit: '' },
  { id: 'pop-stage', name: 'BRICKPOP · 스테이지', best: () => stageRec('pop').best, stage: 'pop', unit: '' },
  { id: 'sld', name: 'BRICKSLIDE', best: () => lBest, unit: '' },
];
const STATS_KEY = 'brick-stats';

// every finished game: count it, keep the last 10 scores and the day of the highest one
function recordGame(id, score) {
  const all = loadJSON(STATS_KEY) || {};
  const g = all[id] || { n: 0, total: 0, hi: 0, hiAt: '', recent: [] };
  g.n++; g.total += score;
  if (score > g.hi) { g.hi = score; g.hiAt = today(); }
  g.recent = [...(g.recent || []), score].slice(-10);
  all[id] = g; saveJSON(STATS_KEY, all);
}

// daily board: best score for today's board, shown at game over
function dailyLine(id, day, score) {
  const key = `brick-daily-${id}`, d = loadJSON(key);
  const prev = d && d.day === day ? d.best : 0;
  if (score > prev) saveJSON(key, { day, best: score });
  return score > prev && prev > 0 ? ` 오늘의 판 최고 기록이에요.` : ` 오늘의 판 최고 ${fmt(Math.max(prev, score))}점.`;
}

function renderStats() {
  const all = loadJSON(STATS_KEY) || {}, list = $('statsList');
  list.textContent = '';
  for (const gm of GAMES) {
    const g = all[gm.id] || { n: 0, total: 0, hi: 0, hiAt: '', recent: [] };
    const bestScore = Math.max(gm.best(), g.hi);
    const card = document.createElement('div'); card.className = 'st-card';
    const h = document.createElement('h3'); h.textContent = gm.name; card.append(h);
    const nums = document.createElement('div'); nums.className = 'st-nums';
    const num = (label, v) => { const s = document.createElement('span'); s.textContent = label; const b = document.createElement('b'); b.textContent = v; s.append(b); nums.append(s); };
    num('최고', fmt(bestScore) + gm.unit);
    num('판 수', fmt(g.n));
    num('평균', g.n ? fmt(Math.round(g.total / g.n)) + gm.unit : '—');
    card.append(nums);
    const recent = g.recent || [];
    if (recent.length) {
      const bars = document.createElement('div'); bars.className = 'st-bars';
      bars.setAttribute('aria-label', `최근 ${recent.length}판 점수: ${recent.map(fmt).join(', ')}`);
      const top = Math.max(1, ...recent);
      for (const v of recent) { const i = document.createElement('i'); i.style.height = `${Math.max(4, v / top * 100)}%`; i.title = fmt(v); bars.append(i); }
      card.append(bars);
    }
    const foot = document.createElement('div'); foot.className = 'st-foot';
    const reach = gm.stage && stageRec(gm.stage).max ? ` · 최고 스테이지 ${stageRec(gm.stage).max}` : '';
    foot.textContent = (!g.n ? '아직 끝낸 판이 없어요.'
      : `최근 ${recent.length}판` + (g.hiAt && g.hi >= bestScore ? ` · 최고 기록 ${g.hiAt.replace(/-/g, '.')}` : '')) + reach;
    card.append(foot);
    list.append(card);
  }
}
$('goStats').addEventListener('click', () => show('stats'));

// ---- record transfer: every "brick…" key in this browser, packed into one code
const xPack = obj => 'BA1.' + btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
const xUnpack = code => {
  const m = /^BA1\.([A-Za-z0-9+/=\s]+)$/.exec(code.trim());
  if (!m) return null;
  try { const o = JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/\s/g, ''))))); return o && typeof o === 'object' ? o : null; } catch (e) { return null; }
};
function brickKeys() {
  const out = {};
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('brick')) out[k] = localStorage.getItem(k); } } catch (e) {}
  return out;
}
$('xExport').addEventListener('click', () => {
  $('xIn').hidden = true; $('xOut').hidden = false;
  $('xCode').value = xPack(brickKeys()); $('xMsg').textContent = '';
  $('xCode').focus(); $('xCode').select();
});
$('xCopy').addEventListener('click', async () => {
  const t = $('xCode');
  try { await navigator.clipboard.writeText(t.value); $('xMsg').textContent = '복사했어요.'; }
  catch (e) { t.focus(); t.select(); $('xMsg').textContent = '선택해 뒀어요. 길게 눌러 복사하세요.'; }
});
$('xImportOpen').addEventListener('click', () => {
  $('xOut').hidden = true; $('xIn').hidden = false; $('xInMsg').textContent = ''; $('xPaste').focus();
});
$('xImport').addEventListener('click', () => {
  const data = xUnpack($('xPaste').value);
  const keys = data ? Object.keys(data).filter(k => k.startsWith('brick') && typeof data[k] === 'string') : [];
  if (!keys.length) { $('xInMsg').textContent = '코드를 읽지 못했어요. 처음부터 끝까지 그대로 붙여 넣었는지 확인하세요.'; return; }
  if (!confirm('지금 이 기기의 기록이 코드의 기록으로 바뀌어요. 계속할까요?')) return;
  try {
    for (const k of Object.keys(brickKeys())) localStorage.removeItem(k);
    for (const k of keys) localStorage.setItem(k, data[k]);
  } catch (e) { $('xInMsg').textContent = '저장하지 못했어요. 브라우저 저장 공간을 확인하세요.'; return; }
  location.hash = 'stats'; location.reload();
});

// ---- how to play: shown the first time each game opens, and from the ? button
const INTRO = {
  fall: ['떨어지는 블록을 옮기고 돌려서 가로줄을 꽉 채우면 줄이 지워져요.',
    '키보드: ← → 이동, ↑ 회전, ↓ 천천히 내리기, Space 바로 떨어뜨리기, C 보관, P 일시정지.',
    '휴대폰: 화면 아래 버튼으로 조작해요.', '10줄마다 레벨이 오르고 빨라져요. 블록이 맨 위에 닿으면 끝나요.'],
  pack: ['아래 조각 3개를 끌어서 8×8 판에 놓아요. 조각은 돌릴 수 없어요.',
    '가로줄이나 세로줄을 꽉 채우면 지워지고, 여러 줄을 한 번에 지우거나 연달아 지우면 점수가 커져요.',
    '어떤 조각도 놓을 수 없으면 끝나요. 시간 제한은 없어요.', '오늘의 판은 하루 동안 모두에게 같은 조각이 나와요.'],
  brk: ['패들을 움직여 공을 튕기고 벽돌을 깨요. 키보드 ← →, 또는 화면을 끌어서 움직여요.',
    'Space나 탭으로 공을 발사해요. 노랑·빨강 벽돌은 여러 번 맞혀야 해요.',
    '벽돌 벽이 몇 초마다 한 줄씩 내려와요. 빨간 선에 닿거나 목숨을 다 잃으면 끝나요.', '떨어지는 아이템을 받으면 패들이 넓어지거나 공이 늘어나요.'],
  stk: ['좌우로 움직이는 벽돌을 탭(또는 Space)해서 아래 벽돌 위에 떨어뜨려요.',
    '삐져나온 부분은 잘려 나가서 벽돌이 점점 좁아져요.', '딱 맞추면 퍼펙트! 3번 연속이면 벽돌이 다시 넓어져요.'],
  pop: ['같은 색이 2개 이상 붙은 덩어리를 누르면 터져요. n개를 터뜨리면 (n−2)²점이라 크게 모을수록 좋아요.',
    '몇 번 터뜨릴 때마다 아래에서 새 줄이 올라와요. 판 아래 색 띠가 다음 줄이에요.',
    '벽돌이 맨 위를 넘으면 끝나요. 판을 다 비우면 1,000점 보너스.', '오늘의 판은 하루 동안 모두에게 같은 판이 나와요.'],
  sld: ['가로 벽돌을 좌우로 끌어서 옮겨요. 아래가 비어 있으면 떨어져요.',
    '가로줄을 꽉 채우면 지워지고, 연달아 지우면 점수가 커져요.',
    '한 번 옮길 때마다 아래에서 새 줄이 올라와요. 벽돌이 맨 위를 넘으면 끝나요.'],
};
const INTRO_KEY = 'brick-intro-seen';
const intro = $('intro');
let introOpener = null;
function pauseCurrent() {
  if (current === 'fall' && S.mode === 'play') togglePause();
  if (current === 'brk' && B.mode === 'play') brkPause();
  if (current === 'stk') stkPause();
}
function openIntro(id, btn) {
  let lines = INTRO[id]; if (!lines) return;
  pauseCurrent();
  introOpener = btn || null;
  $('introTitle').textContent = (GAMES.find(g => g.id === id) || {}).name || '';
  if (MODE_INFO[id]) lines = [...lines, `스테이지: ${MODE_INFO[id].stage}`, `무한: ${MODE_INFO[id].endless}`];
  const ul = $('introList'); ul.textContent = '';
  for (const l of lines) { const li = document.createElement('li'); li.textContent = l; ul.append(li); }
  intro.hidden = false; $('introGo').focus();
  const seen = loadJSON(INTRO_KEY) || [];
  if (!seen.includes(id)) saveJSON(INTRO_KEY, [...seen, id]);
}
// ---- mode picker: stage or endless, for the games that have both
const MODE_INFO = {
  fall: { stage: `한 스테이지에 10줄을 지우면 통과. 아래에 깔린 회색 줄이 점점 늘고 빨라져요.`, endless: '블록이 맨 위에 닿을 때까지. 10줄마다 빨라져요.', save: ['brickfall-stage-save', 'brickfall-save'] },
  pack: { stage: '판에 놓인 회색 돌을 모두 지우면 통과. 스테이지마다 돌이 늘어나요.', endless: '조각을 놓을 곳이 없을 때까지 점수를 쌓아요.', save: ['brickpack-stage-save', 'brickpack-save'] },
  brk: { stage: '모양이 다른 벽돌 판 10개를 차례로 깨요. 다 깨면 더 빠르게 반복돼요.', endless: '벽돌 벽이 몇 초마다 내려와요. 빨간 선에 닿으면 끝나요.', save: ['brickbreak-stage-save', 'brickbreak-save'] },
  pop: { stage: '꽉 찬 판에서 목표 점수를 넘기면 통과. 판은 다시 차지 않아요.', endless: '아래에서 새 줄이 계속 올라와요. 맨 위를 넘으면 끝나요.', save: ['brickpop-stage-save', 'brickpop-save'] },
};
const modeSheet = $('modeSheet');
let modeFor = null, modeOpener = null;
function openModePicker(g) {
  const info = MODE_INFO[g]; if (!info) { show(g); return; }
  modeFor = g; modeOpener = document.activeElement;
  $('modeTitle').textContent = (GAMES.find(x => x.id === g) || {}).name;
  // only a game with some progress counts as "resume" (a fresh board is saved as soon as it is dealt)
  const has = k => { const s = loadJSON(k); return !!s && ((+s.score || 0) > 0 || (+s.stage || 0) > 1 || (+s.loop || 0) > 0); };
  const endlessBest = (GAMES.find(x => x.id === g) || {}).best();
  for (const b of modeSheet.querySelectorAll('.mode-btn')) {
    const st = b.dataset.gm === 'stage', rec = stageRec(g);
    b.querySelector('.mode-desc').textContent = st ? info.stage : info.endless;
    const meta = b.querySelector('.mode-meta'); meta.textContent = '';
    if (has(info.save[st ? 0 : 1])) { const em = document.createElement('em'); em.textContent = '이어하기 · '; meta.append(em); }
    meta.append(st ? (rec.max ? `최고 스테이지 ${rec.max} · ${fmt(rec.best)}점` : '아직 기록이 없어요') : (endlessBest ? `최고 ${fmt(endlessBest)}점` : '아직 기록이 없어요'));
  }
  modeSheet.hidden = false;
  modeSheet.querySelector(`.mode-btn[data-gm="${GM[g]}"]`).focus();
}
function closeModePicker() { modeSheet.hidden = true; if (modeOpener && modeOpener.focus) modeOpener.focus(); modeFor = null; }
function pickMode(gm) {
  const g = modeFor; if (!g) return;
  modeSheet.hidden = true; modeFor = null;
  GM[g] = gm;
  if (g === 'fall') fallMode(gm); else if (g === 'pack') packMode(gm); else if (g === 'brk') brkMode(gm); else if (g === 'pop') popMode(gm);
  show(g);
}
for (const b of modeSheet.querySelectorAll('.mode-btn')) b.addEventListener('click', () => pickMode(b.dataset.gm));
$('modeCancel').addEventListener('click', closeModePicker);
modeSheet.addEventListener('pointerdown', e => { if (e.target === modeSheet) closeModePicker(); });
addEventListener('keydown', e => {
  if (modeSheet.hidden) return;
  if (e.key === 'Escape') { e.preventDefault(); closeModePicker(); }
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); const bs = [...modeSheet.querySelectorAll('.mode-btn')];
    bs[(bs.indexOf(document.activeElement) + 1) % 2].focus();
  }
  if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Tab') e.stopImmediatePropagation();
  else e.stopPropagation();
}, true);

function closeIntro() { intro.hidden = true; if (introOpener) introOpener.focus(); introOpener = null; }
function maybeIntro(id) { if (INTRO[id] && !(loadJSON(INTRO_KEY) || []).includes(id)) openIntro(id); }
$('introGo').addEventListener('click', closeIntro);
intro.addEventListener('pointerdown', e => { if (e.target === intro) closeIntro(); });
document.querySelectorAll('[data-help]').forEach(b => b.addEventListener('click', () => openIntro(current, b)));
addEventListener('keydown', e => {
  if (intro.hidden) return;
  if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); closeIntro(); }
  e.stopImmediatePropagation();
}, true);
