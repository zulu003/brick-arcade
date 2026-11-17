// ================= BRICKSNAKE =================
// A snake made of bricks. Each brick it eats joins the body (right behind the head) in that brick's colour.
// Three or more of one colour in a row behind the head pop: the snake gets shorter and scores, and the
// colours that close up can pop again (a chain). It speeds up as it eats; grey stones appear every 12 bricks.
// Hitting the wall, a stone or itself ends the game.
const NC = 18, NR = 18, NS = 20, NX = 0, NY = 0, NW = 360, NH = 360;
const SNK_COLORS = ['#ef6670', '#f4cc4a', '#5c86f2', '#6ccf86'];
const SNK_FOOD = 3, SNK_STONE_EVERY = 12, SNK_STONE = '#8a85a6';
// ms per move: a calm start (about 3.6 moves a second), 2ms faster per brick, never faster than 90ms
const snkStep = eaten => Math.max(90, 280 - eaten * 2);
const snCv = $('snkCv'), snCtx = snCv.getContext('2d');
setupHiDPI(snCv, NW, NH, snCtx);
let nBest = load('bricksnake-best');
let N = null;
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

function snkFresh() {
  const y = Math.floor(NR / 2);
  return { body: [[6, y], [5, y], [4, y]], cols: [null, '#6ccf86', '#5c86f2'], dir: 'right', queue: [], food: [], stones: [],
    score: 0, eaten: 0, acc: 0, mode: 'ready', fx: [], texts: [], popped: 0, best: 0 };
}
const snkFree = (x, y) => !N.body.some(([a, b]) => a === x && b === y) && !N.food.some(f => f.x === x && f.y === y) && !N.stones.some(s => s.x === x && s.y === y);
function snkSpot(awayFromHead) {
  const [hx, hy] = N.body[0];
  for (let t = 0; t < 400; t++) {
    const x = Math.floor(Math.random() * NC), y = Math.floor(Math.random() * NR);
    if (!snkFree(x, y)) continue;
    if (awayFromHead && Math.abs(x - hx) + Math.abs(y - hy) < 5) continue;
    return { x, y };
  }
  return null;
}
function snkFeed() {
  while (N.food.length < SNK_FOOD) {
    const p = snkSpot(false); if (!p) return;
    N.food.push({ x: p.x, y: p.y, c: SNK_COLORS[Math.floor(Math.random() * SNK_COLORS.length)] });
  }
}
function snkStart() {
  N = snkFresh(); N.mode = 'play'; snkFeed();
  $('nOverlay').hidden = true; snkStats(); snkSave();
}
function snkTurn(d) {
  if (!N || (N.mode !== 'play' && N.mode !== 'pause')) return;
  if (N.mode === 'pause') { N.mode = 'play'; snkOverlay(); }
  const last = N.queue.length ? N.queue[N.queue.length - 1] : N.dir;
  const [dx, dy] = DIRS[d], [lx, ly] = DIRS[last];
  if (d === last || (dx === -lx && dy === -ly) || N.queue.length >= 2) return;
  N.queue.push(d);
}
// pop runs of 3+ equal colours starting right behind the head; repeat while the closing-up colours match
function snkPop() {
  let chain = 0;
  for (;;) {
    const c = N.cols[1]; if (!c) break;
    let n = 1; while (N.cols[1 + n] === c) n++;
    if (n < 3) break;
    chain++;
    const pts = n * n * 10 * chain;
    N.score += pts; N.popped += n;
    // the colours leave from behind the head; the snake gets shorter at the tail so the body stays joined
    const at = N.body.slice(1, 1 + n);
    for (const [x, y] of at) N.fx.push({ x, y, c, t: performance.now() });
    N.cols.splice(1, n);
    N.body.splice(N.body.length - n, n);
    N.texts.push({ text: chain > 1 ? `연쇄 ×${chain} +${fmt(pts)}` : `+${fmt(pts)}`, x: at[0][0], y: at[0][1], t: performance.now() });
    sfx('clear', Math.min(5, n - 2 + chain));
    achEv('snk', 'pop', { n, chain });
  }
}
function snkStepOnce() {
  if (N.queue.length) N.dir = N.queue.shift();
  const [dx, dy] = DIRS[N.dir], [hx, hy] = N.body[0];
  const nx = hx + dx, ny = hy + dy;
  const fi = N.food.findIndex(f => f.x === nx && f.y === ny);
  // the tail moves away this step unless we eat, so moving into the current tail cell is allowed
  const hitsBody = N.body.slice(0, fi >= 0 ? N.body.length : N.body.length - 1).some(([a, b]) => a === nx && b === ny);
  if (nx < 0 || ny < 0 || nx >= NC || ny >= NR || hitsBody || N.stones.some(s => s.x === nx && s.y === ny)) {
    snkOver(nx < 0 || ny < 0 || nx >= NC || ny >= NR ? '벽에 부딪혔어요.' : hitsBody ? '자기 몸에 부딪혔어요.' : '돌에 부딪혔어요.');
    return;
  }
  N.body.unshift([nx, ny]);
  if (fi >= 0) {
    const f = N.food.splice(fi, 1)[0];
    N.cols.splice(1, 0, f.c);          // the new colour sits right behind the head
    N.eaten++; N.score += 10;
    sfx('place');
    snkPop();
    if (N.eaten % SNK_STONE_EVERY === 0) { const p = snkSpot(true); if (p) { N.stones.push(p); sfx('lock'); } }
    snkFeed();
    achEv('snk', 'eat', { eaten: N.eaten, length: N.body.length, score: N.score });
    snkSave();
  } else N.body.pop();
  N.best = Math.max(N.best, N.body.length);
  snkStats();
}
function snkOver(why) {
  N.mode = 'over'; sfx('over'); dropKey(SNK_SAVE); recordGame('snk', N.score);
  const rec = N.score > nBest;
  if (rec) { nBest = N.score; save('bricksnake-best', nBest); }
  $('nOvTitle').textContent = '게임 오버';
  $('nOvText').textContent = `${why} 벽돌 ${N.eaten}개를 먹었어요.` + (rec && N.score > 0 ? ' 새 최고 기록입니다.' : '');
  $('nOvScore').textContent = fmt(N.score); $('nOvScore').hidden = false;
  $('nOvBtn').textContent = '다시 시작';
  setTimeout(() => { if (N.mode === 'over') $('nOverlay').hidden = false; }, 600);
  snkStats();
}
function snkPause() { if (N && N.mode === 'play') { N.mode = 'pause'; snkOverlay(); snkSave(); } }
function snkOverlay() {
  const o = $('nOverlay');
  if (N.mode === 'play') { o.hidden = true; return; }
  if (N.mode === 'over') return;
  o.hidden = false; $('nOvScore').hidden = true;
  if (N.mode === 'ready') {
    $('nOvTitle').textContent = 'BRICKSNAKE';
    $('nOvText').innerHTML = '벽돌을 먹으면 그 색이 머리 뒤에 붙어요.<br>같은 색 3개가 이어지면 터지고 몸이 짧아져요.';
    $('nOvBtn').textContent = '시작';
  } else {
    $('nOvTitle').textContent = '일시정지';
    $('nOvText').textContent = '방향키나 스와이프로 바로 계속해요.';
    $('nOvBtn').textContent = '계속';
  }
}
$('nOvBtn').addEventListener('click', () => { if (N.mode === 'pause') { N.mode = 'play'; snkOverlay(); } else snkStart(); });
function snkStats() { setText('nScore', N.score); setText('nLen', N.body.length); setText('nBest', Math.max(nBest, N.score)); }

// saved after every brick and on pause; comes back paused
const SNK_SAVE = 'bricksnake-save';
function snkSave() {
  if (N.mode !== 'play' && N.mode !== 'pause') { dropKey(SNK_SAVE); return; }
  saveJSON(SNK_SAVE, { body: N.body, cols: N.cols, dir: N.dir, food: N.food, stones: N.stones, score: N.score, eaten: N.eaten, popped: N.popped, best: N.best });
}
function snkResume() {
  const s = loadJSON(SNK_SAVE);
  if (!s || !Array.isArray(s.body) || !s.body.length || !Array.isArray(s.cols) || s.cols.length !== s.body.length) return false;
  N = Object.assign(snkFresh(), s, { mode: 'pause', queue: [], acc: 0, fx: [], texts: [] });
  return true;
}

function updateSnk(dt) {
  if (!N || N.mode !== 'play') return;
  N.acc += dt;
  const step = snkStep(N.eaten);
  while (N.acc >= step && N.mode === 'play') { N.acc -= step; snkStepOnce(); }
}
function drawSnk(now) {
  const c = snCtx;
  c.fillStyle = PWELL; c.fillRect(0, 0, NW, NH);
  c.fillStyle = PEMPTY;
  for (let x = 0; x < NC; x++) for (let y = 0; y < NR; y++) if ((x + y) % 2 === 0) c.fillRect(NX + x * NS, NY + y * NS, NS, NS);
  for (const s of N.stones) bevelRect(c, s.x * NS, s.y * NS, NS, NS, SNK_STONE);
  // food bobs a little so it reads as "to eat"
  for (const f of N.food) { const b = Math.sin(now / 220 + f.x) * 1.5; block(c, f.x * NS + 2, f.y * NS + 2 + b, NS - 4, f.c); }
  // body: tail first so the head is on top
  for (let i = N.body.length - 1; i >= 1; i--) { const [x, y] = N.body[i]; block(c, x * NS, y * NS, NS, N.cols[i] || '#9a97b8'); }
  const [hx, hy] = N.body[0];
  c.fillStyle = tok('--accent', '#ffb547');
  rrect(c, hx * NS + 1, hy * NS + 1, NS - 2, NS - 2, 6);
  // eyes look where we are going
  const [dx, dy] = DIRS[N.dir];
  c.fillStyle = '#1b1608';
  for (const k of [-1, 1]) {
    const ex = hx * NS + NS / 2 + dx * 4 + (dy ? k * 4 : 0), ey = hy * NS + NS / 2 + dy * 4 + (dx ? k * 4 : 0);
    c.beginPath(); c.arc(ex, ey, 2, 0, Math.PI * 2); c.fill();
  }
  N.fx = N.fx.filter(f => now - f.t < 300);
  for (const f of N.fx) { const q = (now - f.t) / 300, s = NS * (1 - q); block(c, f.x * NS + (NS - s) / 2, f.y * NS + (NS - s) / 2, s, q < .2 ? '#ffffff' : f.c, 1 - q * .7); }
  N.texts = N.texts.filter(t => now - t.t < 900);
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '18px Bungee, "IBM Plex Sans KR", Impact, sans-serif';
  for (const t of N.texts) {
    const q = (now - t.t) / 900, x = Math.min(NW - 60, Math.max(60, t.x * NS + NS / 2)), y = t.y * NS - 10 - 24 * q;
    c.globalAlpha = 1 - q * q; c.lineWidth = 4; c.strokeStyle = PWELL; c.strokeText(t.text, x, y);
    c.fillStyle = tok('--ink', '#ffffff'); c.fillText(t.text, x, y);
  }
  c.globalAlpha = 1;
}

// keyboard: arrows or WASD; Space/Enter starts; P/Esc pauses
addEventListener('keydown', e => {
  if (current !== 'snk') return;
  const map = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  if (map[e.code]) { e.preventDefault(); if (N.mode === 'ready' || N.mode === 'over') { if (N.mode === 'ready') snkStart(); } snkTurn(map[e.code]); }
  else if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (e.repeat) return; if (N.mode === 'pause') { N.mode = 'play'; snkOverlay(); } else if (N.mode !== 'play') snkStart(); }
  else if (e.code === 'KeyP' || e.code === 'Escape') { e.preventDefault(); if (N.mode === 'play') snkPause(); else if (N.mode === 'pause') { N.mode = 'play'; snkOverlay(); } }
});
// touch: swipe anywhere on the board (one turn per swipe); the pad buttons below do the same
let nSwipe = null;
snCv.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (N.mode === 'ready') snkStart();
  nSwipe = { id: e.pointerId, x: e.clientX, y: e.clientY, done: false };
  try { snCv.setPointerCapture(e.pointerId); } catch (_) {}
});
snCv.addEventListener('pointermove', e => {
  const g = nSwipe; if (!g || g.id !== e.pointerId || g.done) return;
  const dx = e.clientX - g.x, dy = e.clientY - g.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
  snkTurn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  // keep following the finger: a long drag that bends becomes the next turn
  g.x = e.clientX; g.y = e.clientY;
});
const nUp = e => { if (nSwipe && nSwipe.id === e.pointerId) nSwipe = null; };
snCv.addEventListener('pointerup', nUp); snCv.addEventListener('pointercancel', nUp);
snCv.addEventListener('contextmenu', e => e.preventDefault());
document.querySelectorAll('#nPad button').forEach(b => b.addEventListener('pointerdown', e => {
  e.preventDefault(); if (N.mode === 'ready') snkStart(); snkTurn(b.dataset.dir);
}));
addEventListener('blur', () => { if (current === 'snk') snkPause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && current === 'snk') snkPause(); });

function artSnk() {
  const c = $('artSnk'), x = c.getContext('2d');
  setupHiDPI(c, 140, 140, x);
  const path = [[2, 5], [3, 5], [4, 5], [4, 4], [4, 3], [5, 3], [6, 3], [7, 3], [7, 4], [7, 5], [7, 6], [6, 6]];
  const cols = ['#6ccf86', '#6ccf86', '#5c86f2', '#ef6670', '#ef6670', '#f4cc4a', '#5c86f2', '#5c86f2', '#6ccf86', '#ef6670', '#f4cc4a'];
  const s = 14, ox = 7, oy = 10;
  for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) { x.fillStyle = EMPTY; x.fillRect(ox + i * s + 1, oy + j * s + 1, s - 2, s - 2); }
  path.slice(1).forEach(([px, py], i) => block(x, ox + px * s, oy + py * s, s, cols[i]));
  x.fillStyle = tok('--accent', '#ffb547'); rrect(x, ox + path[0][0] * s + 1, oy + path[0][1] * s + 1, s - 2, s - 2, 4);
  block(x, ox + 1 * s, oy + 1 * s, s, '#ef6670'); block(x, ox + 6 * s, oy + 8 * s, s, '#f4cc4a');
}
artSnk();
if (!snkResume()) N = snkFresh();
snkOverlay(); snkStats();
