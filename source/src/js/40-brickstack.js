// ================= BRICKSTACK =================
const SW = 360, SH = 540, SBH = 26, BASE_W = 200, GROUND = SH - 70;
const scv = $('stkCv'), sctx = scv.getContext('2d');
setupHiDPI(scv, SW, SH, sctx);
let tBest = load('brickstack-best');
let T = stkFresh();

function stkFresh() {
  return { stack: [{ x: (SW - BASE_W) / 2, w: BASE_W }], mov: null, debris: [], cam: 0,
    score: 0, perfect: 0, mode: 'ready', pop: null };
}
// world y of the top edge of block i (0 = base); camera shifts the world down as the tower grows
const blockY = i => GROUND - (i + 1) * SBH;
function spawnMov() {
  const top = T.stack[T.stack.length - 1], n = T.stack.length;
  const fromLeft = n % 2 === 1;
  T.mov = { x: fromLeft ? -top.w * .2 : SW - top.w * .8, w: top.w, dir: fromLeft ? 1 : -1, sp: Math.min(150 + n * 9, 470) };
}
function stkStart() { T = stkFresh(); T.mode = 'play'; spawnMov(); $('tOverlay').hidden = true; }
function stkOver() {
  T.mode = 'over'; T.mov = null; sfx('over');
  const rec = T.score > tBest;
  if (rec) { tBest = T.score; save('brickstack-best', tBest); }
  $('tOvText').textContent = rec && T.score > 0 ? '새 최고 기록입니다.' : '벽돌이 아래 벽돌을 벗어났어요.';
  $('tOvScore').textContent = `${fmt(T.score)}층`;
  setTimeout(() => { if (T.mode === 'over') $('tOverlay').hidden = false; }, 700);
}
$('tRestart').addEventListener('click', stkStart);
// paused when the app goes to the background, the screen is left or Settings opens; the next tap resumes (without dropping)
function stkPause() { if (T.mode === 'play') T.mode = 'pause'; }
function stkTap() {
  if (T.mode === 'ready') { stkStart(); return; }
  if (T.mode === 'pause') { T.mode = 'play'; return; }
  if (T.mode !== 'play' || !T.mov) return;
  const top = T.stack[T.stack.length - 1], m = T.mov, lvl = T.stack.length;
  const left = Math.max(m.x, top.x), right = Math.min(m.x + m.w, top.x + top.w), ov = right - left;
  if (ov <= 0) {
    T.debris.push({ x: m.x, w: m.w, y: blockY(lvl), vy: 0, i: lvl });
    stkOver(); return;
  }
  let nx = left, nw = ov;
  if (Math.abs(m.x - top.x) <= 4) {
    nx = top.x; nw = top.w; T.perfect++;
    if (T.perfect >= 3) { const grow = Math.min(10, BASE_W - nw); nx -= grow / 2; nw += grow; }
    T.pop = { text: T.perfect >= 2 ? `퍼펙트 ×${T.perfect}` : '퍼펙트!', t: performance.now() };
    sfx('perfect');
  } else {
    T.perfect = 0; sfx('stack', T.stack.length);
    if (m.x < top.x) T.debris.push({ x: m.x, w: top.x - m.x, y: blockY(lvl), vy: 0, i: lvl });
    else T.debris.push({ x: top.x + top.w, w: m.x + m.w - (top.x + top.w), y: blockY(lvl), vy: 0, i: lvl });
  }
  T.stack.push({ x: nx, w: nw });
  T.score = T.stack.length - 1;
  spawnMov();
}
function updateStk(dt) {
  const s = dt / 1000;
  if (T.mov && T.mode === 'play') {
    const m = T.mov;
    m.x += m.dir * m.sp * s;
    const lo = -m.w * .2, hi = SW - m.w * .8;
    if (m.x < lo) { m.x = lo; m.dir = 1; }
    if (m.x > hi) { m.x = hi; m.dir = -1; }
  }
  for (const d of T.debris) { d.vy += 1100 * s; d.y += d.vy * s; }
  T.debris = T.debris.filter(d => d.y + T.cam < SH + 60);
  const target = Math.max(0, T.stack.length * SBH - 300);
  T.cam += (target - T.cam) * Math.min(1, s * 6);
}
function drawStk(now) {
  const c = sctx, h = T.score;
  const g = c.createLinearGradient(0, 0, 0, SH);
  const lite = tok('--is-light', '0') === '1';
  g.addColorStop(0, lite ? `hsl(${225 - h * 4}, 62%, 82%)` : `hsl(${225 - h * 4}, 48%, 56%)`);
  g.addColorStop(1, lite ? `hsl(${245 - h * 4}, 48%, 66%)` : `hsl(${245 - h * 4}, 40%, 32%)`);
  c.fillStyle = g; c.fillRect(0, 0, SW, SH);
  c.save(); c.translate(0, T.cam);
  // ground
  c.fillStyle = lite ? 'rgba(40,35,80,.18)' : 'rgba(15,13,30,.45)'; c.fillRect(0, GROUND, SW, SH);
  T.stack.forEach((b, i) => bevelRect(c, b.x, blockY(i), b.w, SBH, PALETTE[i % PALETTE.length]));
  for (const d of T.debris) bevelRect(c, d.x, d.y, d.w, SBH, PALETTE[d.i % PALETTE.length], .85);
  if (T.mov && (T.mode === 'play' || T.mode === 'pause')) bevelRect(c, T.mov.x, blockY(T.stack.length), T.mov.w, SBH, PALETTE[T.stack.length % PALETTE.length]);
  c.restore();
  // score & prompts
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = '52px Bungee, Impact, sans-serif';
  c.fillStyle = lite ? 'rgba(33,28,49,.85)' : 'rgba(255,255,255,.9)'; c.fillText(String(T.score), SW / 2, 64);
  if (T.mode === 'ready') {
    c.font = '20px Bungee, "IBM Plex Sans KR", Impact, sans-serif';
    c.fillStyle = lite ? '#211c31' : '#ffffff'; c.fillText('탭해서 시작', SW / 2, 200);
  } else if (T.mode === 'pause') {
    c.fillStyle = lite ? 'rgba(255,255,255,.55)' : 'rgba(15,13,30,.45)'; c.fillRect(0, 0, SW, SH);
    c.font = '24px Bungee, "IBM Plex Sans KR", Impact, sans-serif';
    c.fillStyle = lite ? '#211c31' : '#ffffff'; c.fillText('일시정지', SW / 2, 200);
    c.font = '600 15px "IBM Plex Sans KR", system-ui, sans-serif'; c.fillText('탭해서 계속', SW / 2, 234);
  }
  if (T.pop) {
    const q = (now - T.pop.t) / 800;
    if (q >= 1) T.pop = null;
    else {
      c.globalAlpha = 1 - q; c.font = '22px Bungee, "IBM Plex Sans KR", Impact, sans-serif';
      c.fillStyle = tok('--accent', '#ffb547'); c.fillText(T.pop.text, SW / 2, 112 - 16 * q);
      c.globalAlpha = 1;
    }
  }
  setText('tScore', T.score); setText('tBest', Math.max(tBest, T.score));
}
scv.addEventListener('pointerdown', e => { e.preventDefault(); stkTap(); });
scv.addEventListener('contextmenu', e => e.preventDefault());

// keyboard for the new games
addEventListener('keydown', e => {
  if (current === 'brk') {
    if (e.code === 'ArrowLeft') { B.keys.l = true; e.preventDefault(); }
    else if (e.code === 'ArrowRight') { B.keys.r = true; e.preventDefault(); }
    else if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault(); if (e.repeat) return;
      if (B.mode === 'play') { if (!B.msg) launch(); }
      else if (B.mode === 'pause') brkPause(); else brkStart();
    }
    else if (e.code === 'KeyP' || e.code === 'Escape') { e.preventDefault(); if (B.mode === 'play' || B.mode === 'pause') brkPause(); }
  } else if (current === 'stk') {
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown') {
      e.preventDefault(); if (e.repeat) return;
      if (T.mode === 'over') { if ($('tOverlay').hidden === false) stkStart(); } else stkTap();
    }
  }
});
addEventListener('keyup', e => {
  if (e.code === 'ArrowLeft') B.keys.l = false;
  if (e.code === 'ArrowRight') B.keys.r = false;
});
addEventListener('blur', () => { if (current === 'brk' && B.mode === 'play') brkPause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && current === 'brk' && B.mode === 'play') brkPause(); });
addEventListener('blur', () => { if (current === 'stk') stkPause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && current === 'stk') stkPause(); });

// menu art
function artBrk() {
  const a = $('artBrk'), x = a.getContext('2d'); setupHiDPI(a, 140, 140, x);
  x.fillStyle = BFIELD; x.fillRect(4, 4, 132, 132);
  const rows = ['3333333', '2222222', '1111.11', '11..1.1'];
  rows.forEach((row, r) => [...row].forEach((ch, cc) => { if (ch !== '.') bevelRect(x, 10 + cc * 17.2, 14 + r * 10, 17.2, 10, HP_COLOR[ch]); }));
  x.fillStyle = '#ffffff'; x.beginPath(); x.arc(84, 92, 4, 0, Math.PI * 2); x.fill();
  x.fillStyle = tok('--accent', '#ffb547'); rrect(x, 52, 118, 40, 7, 4);
}
function artStk() {
  const a = $('artStk'), x = a.getContext('2d'); setupHiDPI(a, 140, 140, x);
  const widths = [90, 84, 84, 76, 70, 70, 62];
  let left = 25;
  widths.forEach((w, i) => { left += i ? (i % 2 ? 4 : -1) : 0; bevelRect(x, left, 120 - (i + 1) * 13, w, 13, PALETTE[i % PALETTE.length]); });
  bevelRect(x, 8, 120 - 8 * 13 - 6, 58, 13, PALETTE[7 % PALETTE.length]);
}
artBrk(); artStk();

