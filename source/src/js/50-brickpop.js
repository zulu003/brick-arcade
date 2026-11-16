// ================= BRICKPOP =================
const OC = 10, OR = 12, OS = 32, OX = 20, OY = 20, OW = 360, OH = 440;
// Endless mode: start half full; every few pops a new row rises from the bottom.
// A column taller than the board ends the game. Rows come faster (and a 5th color joins) as the level climbs.
const POP_START_ROWS = 6, POP_ROWS_PER_LEVEL = 8, POP_EXTRA = '#b47cf2';
const riseEvery = lv => Math.max(1, 5 - Math.ceil(lv / 2));   // pops per new row: 4,4,3,3,2,2,1…
const POP_COLORS = ['#ef6670', '#f4cc4a', '#5c86f2', '#6ccf86'];
const ocv = $('popCv'), octx = ocv.getContext('2d');
setupHiDPI(ocv, OW, OH, octx);
let oBest = load('brickpop-best');
let PO = null, oHover = null, oid = 0;

// cols[c] holds cells bottom-to-top; each cell keeps its own drawn position (vx, vy) that eases to its slot
const oSlotX = c => OX + c * OS, oSlotY = i => OY + (OR - 1 - i) * OS;
const popColors = () => PO.level >= 3 ? [...POP_COLORS, POP_EXTRA] : POP_COLORS;
function popRandRow() { const cs = popColors(); return Array.from({ length: OC }, () => cs[Math.floor(Math.random() * cs.length)]); }
function popNew() {
  PO = { cols: [], score: 0, mode: 'play', fx: [], texts: [], level: 1, rows: 0, movesLeft: riseEvery(1), next: null };
  for (let c = 0; c < OC; c++) {
    const col = [];
    for (let i = 0; i < POP_START_ROWS; i++)
      col.push({ id: oid++, color: POP_COLORS[Math.floor(Math.random() * POP_COLORS.length)], vx: oSlotX(c), vy: oSlotY(i) - OH - i * 14 - c * 6 });
    PO.cols.push(col);
  }
  PO.next = popRandRow();
  oHover = null; $('oOverlay').hidden = true; popStats(); popSave();
}
const POP_SAVE = 'brickpop-save';
function popSave() {
  if (PO.mode !== 'play') { dropKey(POP_SAVE); return; }
  saveJSON(POP_SAVE, { cols: PO.cols.map(col => col.map(cell => cell.color)), score: PO.score, level: PO.level, rows: PO.rows, movesLeft: PO.movesLeft, next: PO.next });
}
function popResume() {
  const s = loadJSON(POP_SAVE);
  if (!s || !Array.isArray(s.cols) || !Array.isArray(s.next) || s.next.length !== OC) return false;
  PO = { cols: [], score: +s.score || 0, mode: 'play', fx: [], texts: [], level: +s.level || 1, rows: +s.rows || 0,
    movesLeft: +s.movesLeft || 1, next: s.next };
  PO.cols = s.cols.filter(col => Array.isArray(col) && col.length).slice(0, OC)
    .map((col, c) => col.map((color, i) => ({ id: oid++, color, vx: oSlotX(c), vy: oSlotY(i) - OH - i * 14 - c * 6 })));
  oHover = null; $('oOverlay').hidden = true; popStats();
  return true;
}
// push the waiting row in at the bottom; returns false if that overflowed the board
function popRise() {
  while (PO.cols.length < OC) PO.cols.push([]);
  PO.next.forEach((color, c) => PO.cols[c].unshift({ id: oid++, color, vx: oSlotX(c), vy: oSlotY(-1) }));
  PO.rows++;
  const nl = 1 + Math.floor(PO.rows / POP_ROWS_PER_LEVEL);
  if (nl > PO.level) { PO.level = nl; PO.texts.push({ text: `레벨 ${nl}`, x: OW / 2, y: OY + OR * OS / 2, t: performance.now() }); sfx('stage'); }
  PO.movesLeft = riseEvery(PO.level);
  PO.next = popRandRow();
  sfx('lock');
  if (PO.cols.some(col => col.length > OR)) { popOver(); return false; }
  return true;
}
function popGroup(c, i) {
  const col = PO.cols[c]; if (!col || !col[i]) return [];
  const color = col[i].color, seen = new Set([c + ',' + i]), out = [[c, i]], stack = [[c, i]];
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      const k = nx + ',' + ny;
      if (seen.has(k)) continue;
      const cell = PO.cols[nx] && PO.cols[nx][ny];
      if (cell && cell.color === color) { seen.add(k); out.push([nx, ny]); stack.push([nx, ny]); }
    }
  }
  return out;
}
const popLeft = () => PO.cols.reduce((a, col) => a + col.length, 0);
function popHasMoves() {
  for (let c = 0; c < PO.cols.length; c++) for (let i = 0; i < PO.cols[c].length; i++) {
    const color = PO.cols[c][i].color;
    if (PO.cols[c][i + 1] && PO.cols[c][i + 1].color === color) return true;
    if (PO.cols[c + 1] && PO.cols[c + 1][i] && PO.cols[c + 1][i].color === color) return true;
  }
  return false;
}
const popPts = n => (n - 2) * (n - 2);
function popAt(c, i) {
  if (PO.mode !== 'play') return;
  const g = popGroup(c, i);
  if (g.length < 2) return;
  const now = performance.now(), dead = new Set(g.map(([x, y]) => PO.cols[x][y].id));
  let sx = 0, sy = 0;
  for (const [x, y] of g) { const cell = PO.cols[x][y]; PO.fx.push({ x: cell.vx, y: cell.vy, color: cell.color, t: now }); sx += cell.vx; sy += cell.vy; }
  const pts = popPts(g.length);
  PO.score += pts;
  PO.texts.push({ text: pts ? `+${fmt(pts)}` : '+0', x: sx / g.length + OS / 2, y: sy / g.length + OS / 2, t: now });
  PO.cols = PO.cols.map(col => col.filter(cell => !dead.has(cell.id))).filter(col => col.length);
  sfx(g.length >= 6 ? 'clear' : 'place', Math.min(5, Math.floor(g.length / 4)));
  oHover = null;
  PO.movesLeft--;
  if (!popLeft()) {
    PO.score += 1000;
    PO.texts.push({ text: '판 비우기 +1,000', x: OW / 2, y: OY + OR * OS / 2, t: now + 200 });
    for (let k = 0; k < 3 && PO.mode === 'play'; k++) popRise();
  } else if (PO.movesLeft <= 0) popRise();
  // never leave the player without a move: keep raising rows until a pair exists (or the board overflows)
  while (PO.mode === 'play' && !popHasMoves()) popRise();
  popStats(); popSave();
}
function popOver() {
  PO.mode = 'over'; sfx('over'); dropKey(POP_SAVE);
  const rec = PO.score > oBest;
  if (rec) { oBest = PO.score; save('brickpop-best', oBest); }
  $('oOvTitle').textContent = '게임 오버';
  $('oOvText').textContent = `벽돌이 맨 위를 넘었어요. 레벨 ${PO.level}까지 왔어요.` + (rec ? ' 새 최고 기록입니다.' : '');
  $('oOvScore').textContent = fmt(PO.score);
  setTimeout(() => { if (PO.mode === 'over') $('oOverlay').hidden = false; }, 700);
}
function popStats() {
  setText('oScore', PO.score); setText('oLevel', PO.level); setText('oNext', `${PO.movesLeft}번`); setText('oBest', Math.max(oBest, PO.score));
  const n = oHover ? oHover.length : 0;
  setText('oPreview', n >= 2 ? `${n}개 · +${fmt(popPts(n))}` : '');
}
function popCell(e) {
  const r = ocv.getBoundingClientRect();
  const x = (e.clientX - r.left) * OW / r.width, y = (e.clientY - r.top) * OH / r.height;
  const c = Math.floor((x - OX) / OS), i = OR - 1 - Math.floor((y - OY) / OS);
  if (c < 0 || i < 0 || !PO.cols[c] || !PO.cols[c][i]) return null;
  return [c, i];
}
ocv.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse' || PO.mode !== 'play') return;
  const at = popCell(e); const g = at ? popGroup(at[0], at[1]) : [];
  oHover = g.length >= 2 ? g : null; popStats();
});
ocv.addEventListener('pointerleave', () => { oHover = null; popStats(); });
ocv.addEventListener('pointerdown', e => {
  e.preventDefault();
  const at = popCell(e); if (at) popAt(at[0], at[1]);
  if (e.pointerType === 'mouse') { const a2 = popCell(e); const g = a2 ? popGroup(a2[0], a2[1]) : []; oHover = g.length >= 2 ? g : null; popStats(); }
});
ocv.addEventListener('contextmenu', e => e.preventDefault());
$('oRestart').addEventListener('click', popNew);
$('oNew').addEventListener('click', popNew);

function updatePop(dt) {
  const s = dt / 1000, v = 1300 * s;
  PO.cols.forEach((col, c) => col.forEach((cell, i) => {
    const tx = oSlotX(c), ty = oSlotY(i);
    cell.vx += Math.max(-v, Math.min(v, tx - cell.vx));
    cell.vy += Math.max(-v, Math.min(v, ty - cell.vy));
  }));
}
function drawPop(now) {
  const c = octx;
  c.clearRect(0, 0, OW, OH);
  c.fillStyle = PWELL; rrect(c, OX - 8, OY - 8, OC * OS + 16, OR * OS + 16, 10);
  c.fillStyle = PEMPTY;
  for (let x = 0; x < OC; x++) for (let y = 0; y < OR; y++) rrect(c, OX + x * OS + 3, OY + y * OS + 3, OS - 6, OS - 6, 4);
  // warn when a column is one row from the top
  if (PO.mode === 'play' && PO.cols.some(col => col.length >= OR)) {
    c.fillStyle = `rgba(239,102,112,${.2 + .12 * Math.sin(now / 160)})`;
    c.fillRect(OX, OY, OC * OS, OS);
  }
  // the row that rises next, as a strip under the board
  if (PO.next) PO.next.forEach((color, x) => bevelRect(c, OX + x * OS + 3, OY + OR * OS + 14, OS - 6, 12, color, PO.movesLeft <= 1 ? .95 : .6));
  c.save(); c.beginPath(); c.rect(OX - 8, OY - 8, OC * OS + 16, OR * OS + 16); c.clip();
  const hov = new Set((oHover || []).map(([x, y]) => PO.cols[x] && PO.cols[x][y] && PO.cols[x][y].id));
  for (const col of PO.cols) for (const cell of col) {
    block(c, cell.vx, cell.vy, OS, cell.color);
    if (hov.has(cell.id)) { c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(cell.vx + 1, cell.vy + 1, OS - 2, OS - 2); }
  }
  c.restore();
  PO.fx = PO.fx.filter(f => now - f.t < 280);
  for (const f of PO.fx) {
    const q = Math.max(0, (now - f.t) / 280), s = OS * (1 - q);
    block(c, f.x + (OS - s) / 2, f.y + (OS - s) / 2, s, q < .2 ? '#ffffff' : f.color, 1 - q * .7);
  }
  PO.texts = PO.texts.filter(t => now - t.t < 900);
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '20px Bungee, "IBM Plex Sans KR", Impact, sans-serif';
  for (const t of PO.texts) {
    const q = (now - t.t) / 900; if (q < 0) continue;
    c.globalAlpha = 1 - q * q;
    c.lineWidth = 5; c.strokeStyle = PWELL; c.strokeText(t.text, t.x, t.y - 30 * q);
    c.fillStyle = tok('--ink', '#ffffff'); c.fillText(t.text, t.x, t.y - 30 * q);
  }
  c.globalAlpha = 1;
}
if (!popResume()) popNew();

