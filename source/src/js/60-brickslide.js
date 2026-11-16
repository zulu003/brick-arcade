// ================= BRICKSLIDE =================
const LC = 8, LR = 10, LS = 40, LX = 20, LY = 40, LW = 360, LH = 480;
const LEN_COLOR = { 1: '#56cfe1', 2: '#6ccf86', 3: '#f4cc4a', 4: '#ef6670' };
const lcv = $('sldCv'), lctx = lcv.getContext('2d');
setupHiDPI(lcv, LW, LH, lctx);
let lBest = load('brickslide-best');
let SL = null, lid = 0, ldrag = null;

function sldOcc() {
  const g = Array.from({ length: LR }, () => Array(LC).fill(null));
  for (const b of SL.bars) if (b.r >= 0 && b.r < LR) for (let k = 0; k < b.len; k++) g[b.r][b.c + k] = b;
  return g;
}
function sldGravity() {
  let moved = true;
  while (moved) {
    moved = false;
    const g = sldOcc();
    for (const b of [...SL.bars].sort((a, z) => z.r - a.r)) {
      if (b.r + 1 >= LR) continue;
      let ok = true;
      for (let k = 0; k < b.len; k++) if (g[b.r + 1][b.c + k]) { ok = false; break; }
      if (ok) {
        for (let k = 0; k < b.len; k++) { g[b.r][b.c + k] = null; g[b.r + 1][b.c + k] = b; }
        b.r++; moved = true;
      }
    }
  }
}
function sldGenRow(r, animate) {
  const row = [];
  let c = 0, filled = 0;
  while (c < LC) {
    if (Math.random() < .3) { c++; continue; }
    const len = 1 + Math.floor(Math.random() * Math.min(4, LC - c));
    row.push({ id: lid++, r, c, len, vx: c, vy: animate ? r + 1 : r });
    c += len; filled += len;
  }
  if (filled >= LC) { const last = row.pop(); filled -= last.len; }
  if (!row.length) row.push({ id: lid++, r, c: 0, len: 2, vx: 0, vy: animate ? r + 1 : r });
  SL.bars.push(...row);
}
function sldRise(animate) {
  for (const b of SL.bars) b.r--;
  sldGenRow(LR - 1, animate);
}
function sldNew() {
  SL = { bars: [], score: 0, lines: 0, phase: 'idle', rise: false, chain: 0, clearT: 0, mode: 'play', texts: [] };
  for (let k = 0; k < 4; k++) sldRise(false);
  sldGravity();
  for (const b of SL.bars) { b.vx = b.c; b.vy = b.r - LR; }
  SL.phase = 'anim';
  ldrag = null; $('lOverlay').hidden = true; sldStats(); dropKey(SLD_SAVE);
}
const SLD_SAVE = 'brickslide-save';
function sldSave() {
  if (SL.mode !== 'play') { dropKey(SLD_SAVE); return; }
  saveJSON(SLD_SAVE, { bars: SL.bars.map(b => [b.r, b.c, b.len]), score: SL.score, lines: SL.lines });
}
function sldResume() {
  const s = loadJSON(SLD_SAVE);
  if (!s || !Array.isArray(s.bars) || !s.bars.length) return false;
  SL = { bars: [], score: +s.score || 0, lines: +s.lines || 0, phase: 'anim', rise: false, chain: 0, clearT: 0, mode: 'play', texts: [] };
  for (const [r, c, len] of s.bars) if (r >= 0 && r < LR && c >= 0 && len >= 1 && c + len <= LC) SL.bars.push({ id: lid++, r, c, len, vx: c, vy: r - LR });
  if (!SL.bars.length) return false;
  ldrag = null; $('lOverlay').hidden = true; sldStats();
  return true;
}
function sldFullRows() {
  const g = sldOcc(), rows = [];
  for (let r = 0; r < LR; r++) if (g[r].every(Boolean)) rows.push(r);
  return rows;
}
function sldCanMove() {
  const g = sldOcc();
  return SL.bars.some(b => (b.c > 0 && !g[b.r][b.c - 1]) || (b.c + b.len < LC && !g[b.r][b.c + b.len]));
}
function sldCheck() {
  const rows = sldFullRows();
  if (rows.length) {
    SL.chain++;
    for (const b of SL.bars) if (rows.includes(b.r)) b.clearing = true;
    const pts = rows.length * 100 * SL.chain;
    SL.score += pts; SL.lines += rows.length;
    SL.texts.push({ text: SL.chain > 1 ? `연쇄 ×${SL.chain} +${fmt(pts)}` : `+${fmt(pts)}`, y: LY + rows[0] * LS + LS / 2, t: performance.now() });
    sfx('clear', rows.length + SL.chain - 1);
    SL.phase = 'clearing'; SL.clearT = 0; sldStats();
    return;
  }
  if (SL.rise) {
    SL.rise = false; sldRise(true);
    if (SL.bars.some(b => b.r < 0)) { sldOver(); return; }
    sldGravity();   // bricks above the new row's gaps fall in (and may complete rows)
    SL.phase = 'anim'; return;
  }
  SL.phase = 'idle';
  if (!sldCanMove()) { SL.rise = true; SL.phase = 'check'; }
  else sldSave();
}
function sldOver() {
  SL.mode = 'over'; sfx('over'); dropKey(SLD_SAVE); recordGame('sld', SL.score);
  const rec = SL.score > lBest;
  if (rec) { lBest = SL.score; save('brickslide-best', lBest); }
  $('lOvText').textContent = `벽돌이 맨 위를 넘었어요. 지운 줄 ${SL.lines}개.` + (rec ? ' 새 최고 기록입니다.' : '');
  $('lOvScore').textContent = fmt(SL.score);
  sldStats();
  setTimeout(() => { if (SL.mode === 'over') $('lOverlay').hidden = false; }, 700);
}
function sldStats() { setText('lScore', SL.score); setText('lLines', SL.lines); setText('lBest', Math.max(lBest, SL.score)); }
$('lRestart').addEventListener('click', sldNew);

function updateSld(dt) {
  const s = dt / 1000;
  for (const b of SL.bars) {
    const vy = 18 * s;
    b.vy += Math.max(-vy, Math.min(vy, b.r - b.vy));
    if (!ldrag || ldrag.b !== b) { const vx = 22 * s; b.vx += Math.max(-vx, Math.min(vx, b.c - b.vx)); }
  }
  if (SL.mode !== 'play') return;
  if (SL.phase === 'anim') {
    if (SL.bars.every(b => Math.abs(b.vy - b.r) < .001 && (ldrag && ldrag.b === b || Math.abs(b.vx - b.c) < .001))) SL.phase = 'check';
  } else if (SL.phase === 'check') sldCheck();
  else if (SL.phase === 'clearing') {
    SL.clearT += dt;
    if (SL.clearT >= 240) { SL.bars = SL.bars.filter(b => !b.clearing); sldGravity(); SL.phase = 'anim'; }
  }
}
function sldLocal(e) {
  const r = lcv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * LW / r.width, y: (e.clientY - r.top) * LH / r.height };
}
lcv.addEventListener('pointerdown', e => {
  if (SL.mode !== 'play' || SL.phase !== 'idle' || ldrag) return;
  const p = sldLocal(e), col = Math.floor((p.x - LX) / LS), row = Math.floor((p.y - LY) / LS);
  const b = SL.bars.find(z => z.r === row && col >= z.c && col < z.c + z.len);
  if (!b) return;
  e.preventDefault();
  try { lcv.setPointerCapture(e.pointerId); } catch (_) {}
  const g = sldOcc();
  let minC = b.c; while (minC > 0 && !g[b.r][minC - 1]) minC--;
  let maxC = b.c; while (maxC + b.len < LC && !g[b.r][maxC + b.len]) maxC++;
  ldrag = { b, id: e.pointerId, startX: p.x, origC: b.c, minC, maxC };
  lcv.style.cursor = 'grabbing';
});
lcv.addEventListener('pointermove', e => {
  if (!ldrag || e.pointerId !== ldrag.id) return;
  const p = sldLocal(e);
  ldrag.b.vx = Math.max(ldrag.minC, Math.min(ldrag.maxC, ldrag.origC + (p.x - ldrag.startX) / LS));
});
function sldRelease(e, cancel) {
  if (!ldrag || (e && e.pointerId !== ldrag.id)) return;
  const d = ldrag; ldrag = null; lcv.style.cursor = '';
  const nc = cancel ? d.origC : Math.round(d.b.vx);
  if (nc !== d.origC) {
    d.b.c = nc; sfx('place');
    SL.rise = true; SL.chain = 0;
    sldGravity(); SL.phase = 'anim';
  }
}
lcv.addEventListener('pointerup', e => sldRelease(e, false));
lcv.addEventListener('pointercancel', e => sldRelease(e, true));
lcv.addEventListener('contextmenu', e => e.preventDefault());

function drawSld(now) {
  const c = lctx;
  c.clearRect(0, 0, LW, LH);
  c.fillStyle = PWELL; rrect(c, LX - 8, LY - 8, LC * LS + 16, LR * LS + 16, 10);
  c.fillStyle = PEMPTY;
  for (let x = 0; x < LC; x++) for (let y = 0; y < LR; y++) rrect(c, LX + x * LS + 3, LY + y * LS + 3, LS - 6, LS - 6, 5);
  // top row warning when bricks sit there
  if (SL.bars.some(b => b.r === 0)) {
    c.fillStyle = `rgba(239,102,112,${.18 + .12 * Math.sin(now / 160)})`;
    c.fillRect(LX, LY, LC * LS, LS);
  }
  c.save(); c.beginPath(); c.rect(LX - 8, LY - 8, LC * LS + 16, LR * LS + 16); c.clip();
  if (ldrag) {
    c.fillStyle = 'rgba(255,255,255,.14)';
    rrect(c, LX + ldrag.minC * LS + 2, LY + ldrag.b.r * LS + 2, (ldrag.maxC - ldrag.minC + ldrag.b.len) * LS - 4, LS - 4, 6);
  }
  const flash = Math.floor(now / 60) % 2 === 0;
  for (const b of SL.bars) {
    const x = LX + b.vx * LS, y = LY + b.vy * LS;
    const color = b.clearing && flash ? '#ffffff' : LEN_COLOR[b.len];
    bevelRect(c, x + 2, y + 2, b.len * LS - 4, LS - 4, color, ldrag && ldrag.b === b ? .9 : 1);
    c.fillStyle = 'rgba(0,0,0,.18)';
    for (let k = 1; k < b.len; k++) c.fillRect(x + k * LS - 1, y + 8, 2, LS - 16);
  }
  c.restore();
  SL.texts = SL.texts.filter(t => now - t.t < 900);
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '22px Bungee, "IBM Plex Sans KR", Impact, sans-serif';
  for (const t of SL.texts) {
    const q = (now - t.t) / 900;
    c.globalAlpha = 1 - q * q;
    c.lineWidth = 5; c.strokeStyle = PWELL; c.strokeText(t.text, LW / 2, t.y - 30 * q);
    c.fillStyle = tok('--ink', '#ffffff'); c.fillText(t.text, LW / 2, t.y - 30 * q);
  }
  c.globalAlpha = 1;
  c.font = '600 12px "IBM Plex Sans KR", system-ui, sans-serif'; c.fillStyle = tok('--muted', '#9b93b5');
  c.fillText(SL.phase === 'idle' && SL.mode === 'play' ? '벽돌을 좌우로 끌어 옮기세요' : '', LW / 2, LY + LR * LS + 22);
}
if (!sldResume()) sldNew();

// menu art for the two new games
function artPop() {
  const a = $('artPop'), x = a.getContext('2d'); setupHiDPI(a, 140, 140, x);
  const map = { r: POP_COLORS[0], y: POP_COLORS[1], b: POP_COLORS[2], g: POP_COLORS[3] };
  ['.......', '..b....', '.bby.g.', 'rbyyggr', 'rryggbr', 'yrrbbbr', 'yybbgrr'].forEach((row, r) => [...row].forEach((ch, cc) => {
    const px = 14 + cc * 16, py = 14 + r * 16;
    if (ch === '.') { x.fillStyle = PEMPTY; x.fillRect(px + 1, py + 1, 14, 14); } else block(x, px, py, 16, map[ch]);
  }));
}
function artSld() {
  const a = $('artSld'), x = a.getContext('2d'); setupHiDPI(a, 140, 140, x);
  for (let r = 0; r < 7; r++) for (let cc = 0; cc < 7; cc++) { x.fillStyle = PEMPTY; x.fillRect(14 + cc * 16 + 1, 14 + r * 16 + 1, 14, 14); }
  [[6, 0, 3], [6, 4, 3], [5, 1, 2], [5, 3, 4], [4, 0, 1], [4, 2, 3], [3, 1, 2], [3, 5, 2], [1, 3, 2]].forEach(([r, cc, len]) =>
    bevelRect(x, 14 + cc * 16 + 1, 14 + r * 16 + 1, len * 16 - 2, 14, LEN_COLOR[len]));
}
artPop(); artSld();

