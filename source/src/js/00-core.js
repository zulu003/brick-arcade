// ================= shared =================
const $ = id => document.getElementById(id);
const COLORS = { I:'#56cfe1', O:'#f4cc4a', T:'#b47cf2', S:'#6ccf86', Z:'#ef6670', J:'#5c86f2', L:'#f39b4a' };
const PALETTE = Object.values(COLORS);
const css = getComputedStyle(document.documentElement);
const tok = (n, d) => css.getPropertyValue(n).trim() || d;
let WELL = tok('--well', '#0f0d17'), GRID = tok('--line', '#302b44'), EMPTY = tok('--cell', '#1d1a2a');
let PWELL = tok('--pack-well', '#363162'), PEMPTY = tok('--pack-cell', '#4a437c');
const fmt = n => n.toLocaleString('ko-KR');
const load = k => { try { return parseInt(localStorage.getItem(k) || '0', 10) || 0; } catch (e) { return 0; } };
const save = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) {} };
// games in progress (Brickpack, Brickpop, Brickslide) are kept here so closing the app doesn't lose them
const loadJSON = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const saveJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const dropKey = k => { try { localStorage.removeItem(k); } catch (e) {} };
// local date as YYYY-MM-DD (for the daily board and the stats screen)
const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// seeded random for the daily board: the state lives in o.rs so it can be saved and resumed
function seedOf(str) { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h | 0; }
function rngNext(o) {
  o.rs = (o.rs + 0x6D2B79F5) | 0;
  let t = o.rs; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// game modes: four games offer a stage mode next to the endless one (picked from the menu)
const GM = { fall: 'endless', pack: 'endless', brk: 'endless', pop: 'endless' };
const STAGE_KEY = { fall: 'brickfall', pack: 'brickpack', brk: 'brickbreak', pop: 'brickpop' };
// stage-mode records: best score and furthest stage reached
const stageRec = g => ({ best: load(STAGE_KEY[g] + '-stage-best'), max: load(STAGE_KEY[g] + '-stage-max') });
function stageRecSave(g, score, stage) {
  const r = stageRec(g), rec = score > r.best;
  if (rec) save(STAGE_KEY[g] + '-stage-best', score);
  if (stage > r.max) save(STAGE_KEY[g] + '-stage-max', stage);
  return rec;
}

// colour-blind help: a small shape on each block colour (Settings → 블록 무늬)
let MARKS = false;
const MARK_OF = { '#ef6670': 'circle', '#f4cc4a': 'tri', '#5c86f2': 'square', '#6ccf86': 'diamond', '#b47cf2': 'plus', '#56cfe1': 'ring', '#f39b4a': 'x' };
function drawMark(c, x, y, s, color) {
  const kind = MARK_OF[color]; if (!kind || s < 14) return;
  const cx = x + s / 2, cy = y + s / 2, r = s * .19;
  c.fillStyle = 'rgba(20,16,36,.42)'; c.strokeStyle = 'rgba(20,16,36,.42)'; c.lineWidth = Math.max(2, s * .08);
  c.beginPath();
  if (kind === 'circle') { c.arc(cx, cy, r, 0, Math.PI * 2); c.fill(); }
  else if (kind === 'ring') { c.arc(cx, cy, r * .85, 0, Math.PI * 2); c.stroke(); }
  else if (kind === 'square') { c.fillRect(cx - r * .9, cy - r * .9, r * 1.8, r * 1.8); }
  else if (kind === 'tri') { c.moveTo(cx, cy - r * 1.1); c.lineTo(cx + r * 1.1, cy + r * .85); c.lineTo(cx - r * 1.1, cy + r * .85); c.closePath(); c.fill(); }
  else if (kind === 'diamond') { c.moveTo(cx, cy - r * 1.2); c.lineTo(cx + r, cy); c.lineTo(cx, cy + r * 1.2); c.lineTo(cx - r, cy); c.closePath(); c.fill(); }
  else if (kind === 'plus') { c.moveTo(cx - r, cy); c.lineTo(cx + r, cy); c.moveTo(cx, cy - r); c.lineTo(cx, cy + r); c.stroke(); }
  else if (kind === 'x') { c.moveTo(cx - r * .8, cy - r * .8); c.lineTo(cx + r * .8, cy + r * .8); c.moveTo(cx + r * .8, cy - r * .8); c.lineTo(cx - r * .8, cy + r * .8); c.stroke(); }
}

function setupHiDPI(c, w, h, x) {
  const d = Math.min(window.devicePixelRatio || 1, 3);
  c.width = w * d; c.height = h * d; x.setTransform(d, 0, 0, d, 0, 0);
}
function block(c, x, y, s, color, alpha = 1) {
  if (s <= 0) return;
  c.globalAlpha = alpha;
  c.fillStyle = color; c.fillRect(x + 1, y + 1, s - 2, s - 2);
  const e = Math.max(2, s * .15);
  c.fillStyle = 'rgba(255,255,255,.30)'; c.fillRect(x + 1, y + 1, s - 2, e);
  c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(x + 1, y + 1, e, s - 2);
  c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(x + 1, y + s - 1 - e, s - 2, e);
  if (MARKS) drawMark(c, x, y, s, color);
  c.globalAlpha = 1;
}
function rrect(c, x, y, w, h, r) {
  c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); c.fill();
}

// ================= navigation =================
const screens = { menu: $('scrMenu'), fall: $('scrFall'), pack: $('scrPack'), brk: $('scrBrk'), stk: $('scrStk'), pop: $('scrPop'), sld: $('scrSld'), stats: $('scrStats') };
let current = 'menu';
function show(name, fromHash) {
  if (!screens[name]) name = 'menu';
  if (current === 'fall' && name !== 'fall' && S.mode === 'play') togglePause();
  if (current === 'brk' && name !== 'brk' && B.mode === 'play') brkPause();
  if (current === 'stk' && name !== 'stk') stkPause();
  for (const k in screens) screens[k].hidden = k !== name;
  current = name;
  document.body.classList.toggle('pack', name === 'pack');
  document.body.classList.toggle('brk', name === 'brk');
  document.body.classList.toggle('stk', name === 'stk');
  document.body.classList.toggle('pop', name === 'pop');
  document.body.classList.toggle('sld', name === 'sld');
  if (name === 'menu') refreshMenu();
  if (name === 'stats') renderStats();
  maybeIntro(name);
  if (!fromHash && location.hash.slice(1) !== name) location.hash = name;
  window.scrollTo(0, 0);
}
addEventListener('hashchange', () => show(location.hash.slice(1), true));
document.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => show(b.dataset.nav)));
// games with two modes ask which one first; the others open straight away
function goGame(g) { if (GM[g]) openModePicker(g); else show(g); }
$('goFall').addEventListener('click', () => goGame('fall'));
$('goPack').addEventListener('click', () => goGame('pack'));
$('goBrk').addEventListener('click', () => goGame('brk'));
$('goStk').addEventListener('click', () => goGame('stk'));
$('goPop').addEventListener('click', () => goGame('pop'));
$('goSld').addEventListener('click', () => goGame('sld'));

function refreshMenu() {
  const withStage = (v, g) => { const m = stageRec(g).max; return fmt(v) + (m ? ` · 스테이지 ${m}` : ''); };
  $('mBestFall').textContent = withStage(best, 'fall');
  $('mBestPack').textContent = withStage(pBest, 'pack');
  $('mBestBrk').textContent = withStage(bBest, 'brk');
  $('mBestStk').textContent = fmt(tBest);
  $('mBestPop').textContent = withStage(oBest, 'pop');
  $('mBestSld').textContent = fmt(lBest);
}
function drawArt(id, rows, cell) {
  const c = $(id), x = c.getContext('2d');
  setupHiDPI(c, 140, 140, x);
  const w = rows[0].length * cell, h = rows.length * cell, ox = (140 - w) / 2, oy = (140 - h) / 2;
  rows.forEach((row, r) => [...row].forEach((ch, cc) => {
    const px = ox + cc * cell, py = oy + r * cell;
    if (ch === '.') { x.fillStyle = EMPTY; x.fillRect(px + 1, py + 1, cell - 2, cell - 2); }
    else block(x, px, py, cell, COLORS[ch]);
  }));
}
function artFP() {
drawArt('artFall', [
  '....T.....', '...TTT....', '..........', '..........', '..........',
  'I.........', 'I.......OO', 'I.LL..SSOO', 'ILLZZSS.JJ', 'IL.ZZJJJ.J'
], 13);
drawArt('artPack', [
  '........', '..OO....', '..OO.TTT', 'S.....T.', 'SS......', '.S..LLL.', 'IIIIL...', 'JJJ.ZZ..'
], 16);
}
artFP();

