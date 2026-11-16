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
  c.globalAlpha = 1;
}
function rrect(c, x, y, w, h, r) {
  c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); c.fill();
}

// ================= navigation =================
const screens = { menu: $('scrMenu'), fall: $('scrFall'), pack: $('scrPack'), brk: $('scrBrk'), stk: $('scrStk'), pop: $('scrPop'), sld: $('scrSld') };
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
  if (!fromHash && location.hash.slice(1) !== name) location.hash = name;
  window.scrollTo(0, 0);
}
addEventListener('hashchange', () => show(location.hash.slice(1), true));
document.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => show(b.dataset.nav)));
$('goFall').addEventListener('click', () => show('fall'));
$('goPack').addEventListener('click', () => show('pack'));
$('goBrk').addEventListener('click', () => show('brk'));
$('goStk').addEventListener('click', () => show('stk'));
$('goPop').addEventListener('click', () => show('pop'));
$('goSld').addEventListener('click', () => show('sld'));

function refreshMenu() {
  $('mBestFall').textContent = fmt(best);
  $('mBestPack').textContent = fmt(pBest);
  $('mBestBrk').textContent = fmt(bBest);
  $('mBestStk').textContent = fmt(tBest);
  $('mBestPop').textContent = fmt(oBest);
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

