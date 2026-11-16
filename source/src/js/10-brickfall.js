// ================= BRICKFALL =================
const COLS = 10, ROWS = 20, CELL = 32;
const SHAPES = {
  I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  J: [[1,0,0],[1,1,1],[0,0,0]],
  L: [[0,0,1],[1,1,1],[0,0,0]],
  O: [[1,1],[1,1]],
  S: [[0,1,1],[1,1,0],[0,0,0]],
  T: [[0,1,0],[1,1,1],[0,0,0]],
  Z: [[1,1,0],[0,1,1],[0,0,0]],
};
const KICKS = [[0,0],[-1,0],[1,0],[0,-1],[-2,0],[2,0],[-1,-1],[1,-1]];
const LINE_PTS = [0,100,300,500,800];
const DAS = 160, ARR = 45, SOFT = 40, LOCK = 500, CLEAR_MS = 240;

const cv = $('board'), ctx = cv.getContext('2d');
const holdCv = $('holdCv'), hctx = holdCv.getContext('2d');
const nextCv = $('nextCv'), nctx = nextCv.getContext('2d');
setupHiDPI(cv, COLS*CELL, ROWS*CELL, ctx);
setupHiDPI(holdCv, 96, 64, hctx);
setupHiDPI(nextCv, 96, 192, nctx);

let best = load('brickfall-best');
let S;
function fresh() {
  return { board: Array.from({length: ROWS}, () => Array(COLS).fill(null)),
    queue: [], cur: null, hold: null, canHold: true, score: 0, lines: 0, level: 1,
    mode: 'ready', dropAcc: 0, lockT: 0, lockResets: 0, clearing: null, clearT: 0 };
}
const rotM = (m, dir) => {
  const n = m.length, out = m.map(r => r.slice());
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
    if (dir > 0) out[c][n-1-r] = m[r][c]; else out[n-1-c][r] = m[r][c];
  return out;
};
function collide(m, x, y) {
  for (let r = 0; r < m.length; r++) for (let c = 0; c < m.length; c++) {
    if (!m[r][c]) continue;
    const nx = x + c, ny = y + r;
    if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
    if (ny >= 0 && S.board[ny][nx]) return true;
  }
  return false;
}
function refill() {
  const b = Object.keys(SHAPES);
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  S.queue.push(...b);
}
function nextType() { while (S.queue.length < 8) refill(); return S.queue.shift(); }
function spawn(type) {
  const m = SHAPES[type].map(r => r.slice());
  S.cur = { type, m, x: Math.floor((COLS - m.length) / 2), y: type === 'I' ? -1 : 0 };
  S.lockT = 0; S.lockResets = 0; S.dropAcc = 0;
  if (collide(S.cur.m, S.cur.x, S.cur.y)) gameOver();
}
const grounded = () => S.cur && collide(S.cur.m, S.cur.x, S.cur.y + 1);
function touched() { if (grounded() && S.lockResets < 15) { S.lockT = 0; S.lockResets++; } }
function move(dx) {
  if (!S.cur || collide(S.cur.m, S.cur.x + dx, S.cur.y)) return false;
  S.cur.x += dx; touched(); sfx('move'); return true;
}
function rotate(dir) {
  if (!S.cur || S.cur.type === 'O') return;
  const m = rotM(S.cur.m, dir);
  for (const [kx, ky] of KICKS) {
    if (!collide(m, S.cur.x + kx, S.cur.y + ky)) { S.cur.m = m; S.cur.x += kx; S.cur.y += ky; touched(); sfx('rotate'); return; }
  }
}
function softDrop() {
  if (!S.cur) return;
  if (!collide(S.cur.m, S.cur.x, S.cur.y + 1)) { S.cur.y++; S.score += 1; S.dropAcc = 0; }
}
function hardDrop() {
  if (!S.cur) return;
  let d = 0;
  while (!collide(S.cur.m, S.cur.x, S.cur.y + 1)) { S.cur.y++; d++; }
  S.score += d * 2; sfx('drop'); lock();
}
function holdPiece() {
  if (!S.cur || !S.canHold) return;
  const t = S.cur.type;
  if (S.hold) { const h = S.hold; S.hold = t; spawn(h); } else { S.hold = t; spawn(nextType()); }
  S.canHold = false; sfx('hold');
}
function lock() {
  const { m, x, y, type } = S.cur;
  let above = false;
  for (let r = 0; r < m.length; r++) for (let c = 0; c < m.length; c++) {
    if (!m[r][c]) continue;
    if (y + r < 0) { above = true; continue; }
    S.board[y + r][x + c] = type;
  }
  S.cur = null;
  if (above) { gameOver(); return; }
  const full = [];
  for (let r = 0; r < ROWS; r++) if (S.board[r].every(Boolean)) full.push(r);
  if (full.length) { S.clearing = full; S.clearT = 0; sfx('clear', full.length); }
  else { sfx('lock'); spawn(nextType()); S.canHold = true; }
  fallSave();
}
function finishClear() {
  const n = S.clearing.length;
  S.board = S.board.filter((_, r) => !S.clearing.includes(r));
  while (S.board.length < ROWS) S.board.unshift(Array(COLS).fill(null));
  S.score += LINE_PTS[n] * S.level;
  S.lines += n;
  S.level = Math.floor(S.lines / 10) + 1;
  S.clearing = null;
  spawn(nextType()); S.canHold = true;
  fallSave();
}
const gravityMs = lv => Math.max(8, Math.pow(Math.max(0.8 - (lv - 1) * 0.007, 0.05), lv - 1) * 1000);

function start() { S = fresh(); S.mode = 'play'; spawn(nextType()); showOverlay(); fallSave(); }
// the game in progress is saved on every lock and pause, and comes back paused
const FALL_SAVE = 'brickfall-save';
function fallSave() {
  if (S.mode !== 'play' && S.mode !== 'pause') { dropKey(FALL_SAVE); return; }
  saveJSON(FALL_SAVE, Object.assign({}, S, { mode: 'pause', clearing: null }));
}
function fallResume() {
  const s = loadJSON(FALL_SAVE);
  if (!s || !Array.isArray(s.board) || s.board.length !== ROWS || !Array.isArray(s.queue)) return false;
  S = Object.assign(fresh(), s, { mode: 'pause', clearing: null });
  if (!S.cur) spawn(nextType());
  return true;
}
function gameOver() {
  S.mode = 'over'; S.cur = null; sfx('over'); dropKey(FALL_SAVE); recordGame('fall', S.score);
  if (S.score > best) { best = S.score; save('brickfall-best', best); }
  showOverlay();
}
function togglePause() {
  if (S.mode === 'play') S.mode = 'pause';
  else if (S.mode === 'pause') S.mode = 'play';
  releaseAll(); showOverlay(); fallSave();
}

const ov = $('overlay'), ovTitle = $('ovTitle'), ovText = $('ovText'), ovScore = $('ovScore'), ovBtn = $('ovBtn');
function showOverlay() {
  if (S.mode === 'play') { ov.hidden = true; return; }
  ov.hidden = false; ovScore.hidden = true;
  if (S.mode === 'ready') {
    ovTitle.textContent = 'BRICKFALL';
    ovText.innerHTML = '줄을 채우면 사라집니다.<br>10줄마다 레벨이 오르고 빨라집니다.';
    ovBtn.textContent = '시작';
  } else if (S.mode === 'pause') {
    ovTitle.textContent = '일시정지';
    ovText.textContent = 'P 또는 Esc로 계속합니다.';
    ovBtn.textContent = '계속';
  } else {
    ovTitle.textContent = '게임 오버';
    ovText.textContent = S.score >= best && S.score > 0 ? '새 최고 기록입니다.' : `레벨 ${S.level} · ${S.lines}줄`;
    ovScore.hidden = false; ovScore.textContent = fmt(S.score);
    ovBtn.textContent = '다시 시작';
  }
}
ovBtn.addEventListener('click', () => { if (S.mode === 'pause') togglePause(); else start(); });

const shown = {};
function setText(id, v) { if (shown[id] !== v) { shown[id] = v; $(id).textContent = typeof v === 'number' ? fmt(v) : v; } }
function updateStats() {
  setText('sScore', S.score); setText('sLines', S.lines); setText('sLevel', S.level); setText('sBest', Math.max(best, S.score));
}

const held = { left: false, right: false, down: false };
let dasDir = 0, dasT = 0, arrT = 0, softT = 0;
function releaseAll() { held.left = held.right = held.down = false; dasDir = 0; }
function press(act) {
  if (S.mode === 'ready' || S.mode === 'over') { if (act === 'drop' || act === 'start') start(); return; }
  if (act === 'pause') { togglePause(); return; }
  if (S.mode !== 'play' || !S.cur) {
    if (act === 'left' || act === 'right' || act === 'down') held[act] = true;
    if (act === 'left' || act === 'right') { dasDir = act === 'left' ? -1 : 1; dasT = arrT = 0; }
    return;
  }
  switch (act) {
    case 'left': case 'right':
      held[act] = true; dasDir = act === 'left' ? -1 : 1; dasT = arrT = 0; move(dasDir); break;
    case 'down': held.down = true; softT = 0; softDrop(); break;
    case 'cw': rotate(1); break;
    case 'ccw': rotate(-1); break;
    case 'drop': hardDrop(); break;
    case 'hold': holdPiece(); break;
  }
}
function release(act) {
  if (act === 'left' || act === 'right') {
    held[act] = false;
    const want = held.left ? -1 : held.right ? 1 : 0;
    if (want !== dasDir) { dasDir = want; dasT = arrT = 0; }
  } else if (act === 'down') held.down = false;
}
const KEYMAP = { ArrowLeft:'left', ArrowRight:'right', ArrowDown:'down', ArrowUp:'cw', KeyX:'cw', KeyZ:'ccw',
  Space:'drop', KeyC:'hold', ShiftLeft:'hold', ShiftRight:'hold', KeyP:'pause', Escape:'pause', Enter:'start' };
addEventListener('keydown', e => {
  if (current === 'menu') {
    if (e.key === '1') show('fall'); else if (e.key === '2') show('pack');
    else if (e.key === '3') show('brk'); else if (e.key === '4') show('stk');
    else if (e.key === '5') show('pop'); else if (e.key === '6') show('sld');
    return;
  }
  if (current !== 'fall') return;
  const act = KEYMAP[e.code]; if (!act) return;
  e.preventDefault();
  if (e.repeat) return;
  if (act === 'start') { if (S.mode === 'pause') togglePause(); else if (S.mode !== 'play') start(); return; }
  press(act);
});
addEventListener('keyup', e => { if (current !== 'fall') return; const act = KEYMAP[e.code]; if (act) release(act); });
addEventListener('blur', () => { releaseAll(); if (current === 'fall' && S.mode === 'play') togglePause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && current === 'fall' && S.mode === 'play') togglePause(); });

document.querySelectorAll('#pad button').forEach(b => {
  const act = b.dataset.act;
  b.addEventListener('pointerdown', e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (_) {} press(act); });
  const up = () => release(act);
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  b.addEventListener('contextmenu', e => e.preventDefault());
});

function updateFall(dt) {
  if (S.mode !== 'play') return;
  if (S.clearing) { S.clearT += dt; if (S.clearT >= CLEAR_MS) finishClear(); return; }
  if (!S.cur) return;
  if (dasDir) {
    dasT += dt;
    if (dasT >= DAS) { arrT += dt; while (arrT >= ARR) { arrT -= ARR; if (!move(dasDir)) { arrT = 0; break; } } }
  }
  if (held.down) { softT += dt; while (softT >= SOFT && S.cur) { softT -= SOFT; softDrop(); } }
  const g = gravityMs(S.level);
  S.dropAcc += dt;
  while (S.dropAcc >= g && S.cur) {
    S.dropAcc -= g;
    if (!collide(S.cur.m, S.cur.x, S.cur.y + 1)) S.cur.y++; else { S.dropAcc = 0; break; }
  }
  if (S.cur && grounded()) { S.lockT += dt; if (S.lockT >= LOCK) lock(); }
  else S.lockT = 0;
}
function drawFall() {
  const W = COLS * CELL, H = ROWS * CELL;
  ctx.fillStyle = WELL; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = GRID; ctx.lineWidth = 1; ctx.globalAlpha = .45;
  ctx.beginPath();
  for (let c = 1; c < COLS; c++) { ctx.moveTo(c * CELL + .5, 0); ctx.lineTo(c * CELL + .5, H); }
  for (let r = 1; r < ROWS; r++) { ctx.moveTo(0, r * CELL + .5); ctx.lineTo(W, r * CELL + .5); }
  ctx.stroke(); ctx.globalAlpha = 1;
  const flash = S.clearing ? (Math.floor(S.clearT / 60) % 2 === 0) : false;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const t = S.board[r][c]; if (!t) continue;
    block(ctx, c * CELL, r * CELL, CELL, (S.clearing && S.clearing.includes(r) && flash) ? '#ffffff' : COLORS[t]);
  }
  if (S.cur && S.mode !== 'over') {
    const { m, x, type } = S.cur; let gy = S.cur.y;
    while (!collide(m, x, gy + 1)) gy++;
    ctx.strokeStyle = COLORS[type]; ctx.lineWidth = 2; ctx.globalAlpha = .55;
    for (let r = 0; r < m.length; r++) for (let c = 0; c < m.length; c++)
      if (m[r][c] && gy + r >= 0) ctx.strokeRect((x + c) * CELL + 3, (gy + r) * CELL + 3, CELL - 6, CELL - 6);
    ctx.globalAlpha = 1;
    const fade = S.lockT > 0 ? 1 - (S.lockT / LOCK) * .35 : 1;
    for (let r = 0; r < m.length; r++) for (let c = 0; c < m.length; c++)
      if (m[r][c] && S.cur.y + r >= 0) block(ctx, (x + c) * CELL, (S.cur.y + r) * CELL, CELL, COLORS[type], fade);
  }
  hctx.clearRect(0, 0, 96, 64);
  if (S.hold) drawMini(hctx, S.hold, 48, 32, 20, S.canHold ? 1 : .35);
  nctx.clearRect(0, 0, 96, 192);
  while (S.queue.length < 3) refill();
  for (let i = 0; i < 3; i++) drawMini(nctx, S.queue[i], 48, 32 + i * 64, i === 0 ? 20 : 16, i === 0 ? 1 : .7);
  updateStats();
}
function drawMini(c, type, cx, cy, s, alpha = 1) {
  const m = SHAPES[type]; let r0 = 9, r1 = -1, c0 = 9, c1 = -1;
  m.forEach((row, r) => row.forEach((v, cc) => { if (v) { r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, cc); c1 = Math.max(c1, cc); } }));
  const w = (c1 - c0 + 1) * s, h = (r1 - r0 + 1) * s, ox = cx - w / 2, oy = cy - h / 2;
  for (let r = r0; r <= r1; r++) for (let cc = c0; cc <= c1; cc++)
    if (m[r][cc]) block(c, ox + (cc - c0) * s, oy + (r - r0) * s, s, COLORS[type], alpha);
}

