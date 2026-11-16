// ================= BRICKPACK =================
const PB = 8, PC = 40, BX = 20, BY = 20, PW = 360, PH = 510, TRAY_Y = 372, SLOT = 120;
const pcv = $('packCv'), pctx = pcv.getContext('2d');
setupHiDPI(pcv, PW, PH, pctx);
const PACK_SHAPES = [
  [['#'],1], [['##'],2], [['#','#'],2], [['###'],2], [['#','#','#'],2],
  [['####'],2], [['#','#','#','#'],2], [['#####'],1], [['#','#','#','#','#'],1],
  [['##','##'],3], [['###','###','###'],1], [['###','###'],1], [['##','##','##'],1],
  [['##','#.'],2], [['##','.#'],2], [['#.','##'],2], [['.#','##'],2],
  [['###','#..'],1], [['###','..#'],1], [['#..','###'],1], [['..#','###'],1],
  [['##','#.','#.'],1], [['##','.#','.#'],1], [['#.','#.','##'],1], [['.#','.#','##'],1],
  [['###','.#.'],1], [['.#.','###'],1], [['#.','##','#.'],1], [['.#','##','.#'],1],
  [['##.','.##'],1], [['.##','##.'],1], [['#.','##','.#'],1], [['.#','##','#.'],1],
  [['###','#..','#..'],1], [['###','..#','..#'],1], [['#..','#..','###'],1], [['..#','..#','###'],1],
];
const PIECES = PACK_SHAPES.map(([rows, weight]) => {
  const cells = [];
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') cells.push([y, x]); }));
  return { cells, h: rows.length, w: Math.max(...rows.map(r => r.length)), weight };
});
const TOTAL_W = PIECES.reduce((a, p) => a + p.weight, 0);

let pBest = load('brickpack-best');
let P, drag = null;
function packFresh() {
  const p = { grid: Array.from({length: PB}, () => Array(PB).fill(null)), tray: [null, null, null],
    score: 0, combo: 0, sinceClear: 0, mode: 'play', fx: [], texts: [] };
  return p;
}
function randPiece() {
  let k = Math.random() * TOTAL_W, pick = PIECES[0];
  for (const p of PIECES) { k -= p.weight; if (k < 0) { pick = p; break; } }
  return { cells: pick.cells, w: pick.w, h: pick.h, color: PALETTE[Math.floor(Math.random() * PALETTE.length)] };
}
function fitsAt(p, r, c) {
  for (const [dy, dx] of p.cells) {
    const rr = r + dy, cc = c + dx;
    if (rr < 0 || cc < 0 || rr >= PB || cc >= PB || P.grid[rr][cc]) return false;
  }
  return true;
}
function fitsAny(p) {
  for (let r = 0; r <= PB - p.h; r++) for (let c = 0; c <= PB - p.w; c++) if (fitsAt(p, r, c)) return true;
  return false;
}
function deal() {
  for (let t = 0; t < 40; t++) {
    const set = [randPiece(), randPiece(), randPiece()];
    if (set.some(fitsAny) || t === 39) { P.tray = set; return; }
  }
}
function packStart() {
  P = packFresh(); drag = null; deal();
  $('pOverlay').hidden = true; updatePackStats(); packSave();
}
const PACK_SAVE = 'brickpack-save';
function packSave() {
  if (P.mode !== 'play') { dropKey(PACK_SAVE); return; }
  saveJSON(PACK_SAVE, { grid: P.grid, tray: P.tray, score: P.score, combo: P.combo, sinceClear: P.sinceClear });
}
// pick up a saved game; false if there is none (or it is unreadable)
function packResume() {
  const s = loadJSON(PACK_SAVE);
  if (!s || !Array.isArray(s.grid) || s.grid.length !== PB || !Array.isArray(s.tray)) return false;
  P = Object.assign(packFresh(), { grid: s.grid, tray: s.tray, score: +s.score || 0, combo: +s.combo || 0, sinceClear: +s.sinceClear || 0 });
  drag = null; $('pOverlay').hidden = true; updatePackStats();
  if (!P.tray.some(t => t && fitsAny(t))) packOver();
  return true;
}
function packOver() {
  P.mode = 'over'; sfx('over'); dropKey(PACK_SAVE);
  if (P.score > pBest) { pBest = P.score; save('brickpack-best', pBest); $('pOvText').textContent = '새 최고 기록입니다.'; }
  else $('pOvText').textContent = '더 이상 놓을 자리가 없어요.';
  $('pOvScore').textContent = fmt(P.score);
  updatePackStats();
  setTimeout(() => { if (P.mode === 'over') $('pOverlay').hidden = false; }, 550);
}
$('pRestart').addEventListener('click', packStart);

function place(i, r, c) {
  const p = P.tray[i], now = performance.now();
  for (const [dy, dx] of p.cells) P.grid[r + dy][c + dx] = p.color;
  P.tray[i] = null;
  let gain = p.cells.length;

  const rows = [], cols = [];
  for (let y = 0; y < PB; y++) if (P.grid[y].every(Boolean)) rows.push(y);
  for (let x = 0; x < PB; x++) if (P.grid.every(row => row[x])) cols.push(x);
  const n = rows.length + cols.length;
  const cx = BX + (c + p.w / 2) * PC, cy = BY + (r + p.h / 2) * PC;

  if (n) {
    P.combo = (P.combo > 0 && P.sinceClear <= 3) ? P.combo + 1 : 1;
    P.sinceClear = 0;
    const lineGain = (n * (n + 1) / 2) * 10 * P.combo;
    gain += lineGain;
    const seen = new Set();
    const clearCell = (y, x) => {
      const k = y * PB + x; if (seen.has(k)) return; seen.add(k);
      P.fx.push({ x, y, color: P.grid[y][x], t: now + (rows.includes(y) ? x : y) * 18 });
    };
    rows.forEach(y => { for (let x = 0; x < PB; x++) clearCell(y, x); });
    cols.forEach(x => { for (let y = 0; y < PB; y++) clearCell(y, x); });
    seen.forEach(k => { P.grid[Math.floor(k / PB)][k % PB] = null; });
    let label = n > 1 ? `${n}줄! +${fmt(lineGain)}` : `+${fmt(lineGain)}`;
    P.texts.push({ text: label, x: cx, y: cy, t: now, color: tok('--ink', '#ffffff') });
    if (P.combo >= 2) P.texts.push({ text: `콤보 ×${P.combo}`, x: cx, y: cy + 30, t: now + 120, color: tok('--accent', '#ffb547') });
    if (P.grid.every(row => row.every(v => !v))) {
      gain += 300;
      P.texts.push({ text: '판 비우기 +300', x: PW / 2, y: BY + PB * PC / 2, t: now + 250, color: '#6ccf86' });
    }
  } else {
    P.sinceClear++;
    if (P.sinceClear > 3) P.combo = 0;
  }
  P.score += gain;
  sfx(n ? 'clear' : 'place', n + (P.combo >= 2 ? 1 : 0));
  if (P.tray.every(t => !t)) deal();
  updatePackStats();
  if (!P.tray.some(t => t && fitsAny(t))) packOver(); else packSave();
}
function updatePackStats() {
  setText('pScore', P.score);
  setText('pBest', Math.max(pBest, P.score));
  setText('pCombo', P.combo >= 2 ? `콤보 ×${P.combo}` : '');
}

// dragging
function toLocal(e) {
  const r = pcv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * PW / r.width, y: (e.clientY - r.top) * PH / r.height };
}
function snapFor(d) {
  const p = P.tray[d.i];
  const tlx = d.x - p.w * PC / 2, tly = d.y - d.lift - p.h * PC / 2;
  const c = Math.round((tlx - BX) / PC), r = Math.round((tly - BY) / PC);
  return { r, c, ok: fitsAt(p, r, c) };
}
pcv.addEventListener('pointerdown', e => {
  if (!P || P.mode !== 'play' || drag) return;
  const pt = toLocal(e);
  if (pt.y < TRAY_Y - 10) return;
  const i = Math.min(2, Math.max(0, Math.floor(pt.x / SLOT)));
  if (!P.tray[i]) return;
  e.preventDefault();
  try { pcv.setPointerCapture(e.pointerId); } catch (_) {}
  drag = { i, x: pt.x, y: pt.y, lift: e.pointerType === 'mouse' ? 0 : 80, id: e.pointerId };
  drag.snap = snapFor(drag);
  pcv.style.cursor = 'grabbing';
});
pcv.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const pt = toLocal(e); drag.x = pt.x; drag.y = pt.y; drag.snap = snapFor(drag);
});
function endDrag(e, cancel) {
  if (!drag || (e && e.pointerId !== drag.id)) return;
  const d = drag; drag = null; pcv.style.cursor = '';
  if (!cancel && d.snap && d.snap.ok && P.mode === 'play') place(d.i, d.snap.r, d.snap.c);
}
pcv.addEventListener('pointerup', e => endDrag(e, false));
pcv.addEventListener('pointercancel', e => endDrag(e, true));
pcv.addEventListener('contextmenu', e => e.preventDefault());

function drawPack(now) {
  const c = pctx;
  c.clearRect(0, 0, PW, PH);
  c.fillStyle = PWELL; rrect(c, BX - 8, BY - 8, PB * PC + 16, PB * PC + 16, 10);

  let prev = null, hlColor = null;
  const hlRows = new Set(), hlCols = new Set();
  if (drag && drag.snap && drag.snap.ok) {
    prev = drag.snap; const p = P.tray[drag.i]; hlColor = p.color;
    const mine = new Set(p.cells.map(([dy, dx]) => (prev.r + dy) * PB + prev.c + dx));
    const occ = (y, x) => P.grid[y][x] || mine.has(y * PB + x);
    for (let y = 0; y < PB; y++) { let f = true; for (let x = 0; x < PB; x++) if (!occ(y, x)) { f = false; break; } if (f) hlRows.add(y); }
    for (let x = 0; x < PB; x++) { let f = true; for (let y = 0; y < PB; y++) if (!occ(y, x)) { f = false; break; } if (f) hlCols.add(x); }
  }
  for (let y = 0; y < PB; y++) for (let x = 0; x < PB; x++) {
    const px = BX + x * PC, py = BY + y * PC, v = P.grid[y][x];
    if (v) block(c, px, py, PC, (hlRows.has(y) || hlCols.has(x)) ? hlColor : v);
    else { c.fillStyle = PEMPTY; rrect(c, px + 2, py + 2, PC - 4, PC - 4, 5); }
  }
  if (prev) {
    const p = P.tray[drag.i];
    for (const [dy, dx] of p.cells) block(c, BX + (prev.c + dx) * PC, BY + (prev.r + dy) * PC, PC, p.color, .45);
  }
  // clear effects
  P.fx = P.fx.filter(f => now - f.t < 340);
  for (const f of P.fx) {
    const k = Math.max(0, (now - f.t) / 340), s = PC * (1 - k);
    block(c, BX + f.x * PC + (PC - s) / 2, BY + f.y * PC + (PC - s) / 2, s, k < .15 ? '#ffffff' : f.color, 1 - k * .8);
  }
  // tray
  for (let i = 0; i < 3; i++) {
    const p = P.tray[i];
    if (!p || (drag && drag.i === i)) continue;
    const s = Math.min(24, Math.floor(104 / Math.max(p.w, p.h)));
    const ox = i * SLOT + SLOT / 2 - p.w * s / 2, oy = TRAY_Y + 64 - p.h * s / 2;
    const a = (P.mode === 'play' && fitsAny(p)) ? 1 : .28;
    for (const [dy, dx] of p.cells) block(c, ox + dx * s, oy + dy * s, s, p.color, a);
  }
  // dragged piece
  if (drag) {
    const p = P.tray[drag.i];
    const tlx = drag.x - p.w * PC / 2, tly = drag.y - drag.lift - p.h * PC / 2;
    for (const [dy, dx] of p.cells) block(c, tlx + dx * PC, tly + dy * PC, PC, p.color, .92);
  }
  // floating text
  P.texts = P.texts.filter(t => now - t.t < 900);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = '22px Bungee, Impact, sans-serif';
  for (const t of P.texts) {
    const k = (now - t.t) / 900; if (k < 0) continue;
    c.globalAlpha = 1 - k * k;
    const y = t.y - 36 * k;
    c.lineWidth = 5; c.strokeStyle = PWELL; c.strokeText(t.text, t.x, y);
    c.fillStyle = t.color; c.fillText(t.text, t.x, y);
  }
  c.globalAlpha = 1;
}

