// ================= BRICKBREAK =================
const BW = 360, BH = 540, BRW = 32, BRH = 16, BOX = 20, BOY = 56, PAD_Y = 500, PAD_H = 12, BR = 6;
// Endless mode: a new row of bricks pushes the wall down every few seconds.
// Bricks reaching the danger line end the game; the wall speeds up every ROWS_PER_LEVEL rows.
const BCOLS = 10, DANGER_Y = PAD_Y - 40, ROWS_PER_LEVEL = 6, START_ROWS = 5;
const dropEvery = lv => Math.max(3500, 9000 - (lv - 1) * 600);
// Stage mode: hand-made walls. '.' empty, 1–3 = hits needed, X = unbreakable. After the last map they loop, faster.
const STAGES = [
  ['..........', '1111111111', '1111111111', '1111111111', '1111111111'],
  ['....22....', '...1111...', '..222222..', '.11111111.', '2222222222'],
  ['1.1.1.1.1.', '.2.2.2.2.2', '1.1.1.1.1.', 'XX......XX', '3333333333'],
  ['3333333333', '2........2', '2.111111.2', '2.1XXXX1.2', '2.111111.2', '2........2', '3333333333'],
  ['....33....', '...2222...', '..111111..', '.22222222.', '..111111..', '...2222...', '....33....'],
  ['X.X.X.X.X.', '2222222222', '.X.X.X.X.X', '3333333333', '1111111111', '1111111111'],
  ['11......11', '221....122', '3321..1233', '3321..1233', '221....122', '11......11'],
  ['.1.1.1.1.1', '2.2.2.2.2.', '.3.3.3.3.3', 'X.X.X.X.X.', '.2.2.2.2.2', '1.1.1.1.1.'],
  ['2222222222', '2XXXXXXXX2', '2.3.33.3.2', '2.333333.2', '2..3333..2', '2XXX..XXX2', '1111111111'],
  ['3.......33', '33.....333', '333...3332', '2333.33322', '1233333221', '1122222211', '..111111..'],
];
const HP_COLOR = { 1: '#6ccf86', 2: '#f4cc4a', 3: '#ef6670' };
const ITEM_KIND = [
  { k: 'W', label: '⟷', color: '#5c86f2', w: 4 },
  { k: 'M', label: '●●', color: '#f39b4a', w: 4 },
  { k: 'L', label: '♥', color: '#ef6670', w: 1 },
];
const bcv = $('brkCv'), bctx = bcv.getContext('2d');
setupHiDPI(bcv, BW, BH, bctx);
let bBest = load('brickbreak-best');
let B = brkFresh();

function brkFresh(gm = 'endless') {
  return { level: 1, rows: 0, dropT: 0, slide: 0, score: 0, lives: 3, bricks: [], balls: [], items: [], fx: [],
    px: BW / 2, pw: 64, wideT: 0, mode: 'ready', msg: null, msgT: 0, pop: null, reason: '', keys: { l: false, r: false },
    gm, stage: 0, loop: 0 };
}
const stageNo = () => B.loop * STAGES.length + B.stage + 1;
const brkSpeed = () => B.gm === 'stage' ? Math.min(540, 300 + B.stage * 14 + B.loop * 60) : Math.min(520, 300 + (B.level - 1) * 14);
const brkBest = () => B.gm === 'stage' ? stageRec('brk').best : bBest;
function loadMap() {
  B.lostInStage = false;
  B.bricks = []; B.items = []; B.fx = []; B.slide = 0;
  STAGES[B.stage].forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch !== '.') B.bricks.push({ x: BOX + c * BRW, y: BOY + r * BRH, hp: ch === 'X' ? Infinity : +ch });
  }));
  resetBall();
}
function addRow(animate) {
  const lv = B.level;
  const pGap = Math.max(.08, .3 - lv * .02), p3 = Math.min(.35, (lv - 1) * .05), p2 = Math.min(.45, .15 + (lv - 1) * .05);
  if (animate) { for (const k of B.bricks) k.y += BRH; B.slide = BRH; }
  else for (const k of B.bricks) k.y += BRH;
  let cols = [];
  for (let c = 0; c < BCOLS; c++) if (Math.random() >= pGap) cols.push(c);
  while (cols.length < 6) { const c = Math.floor(Math.random() * BCOLS); if (!cols.includes(c)) cols.push(c); }
  for (const c of cols) {
    const r = Math.random();
    B.bricks.push({ x: BOX + c * BRW, y: BOY, hp: r < p3 ? 3 : r < p3 + p2 ? 2 : 1 });
  }
  B.rows++;
  const nl = 1 + Math.floor(Math.max(0, B.rows - START_ROWS) / ROWS_PER_LEVEL);
  if (nl > B.level) { B.level = nl; B.pop = { text: `레벨 ${nl}`, t: performance.now() }; sfx('stage'); achEv('brk', 'level', { level: nl }); }
  B.dropT = dropEvery(B.level);
  if (B.mode === 'play') brkSave();
}
function loadStage() {
  B.bricks = []; B.items = []; B.fx = [];
  for (let i = 0; i < START_ROWS; i++) addRow(false);
  resetBall();
}
function resetBall() {
  B.balls = [{ x: B.px, y: PAD_Y - BR - 1, vx: 0, vy: 0, stuck: true }];
  B.pw = 64; B.wideT = 0;
}
function launch() {
  for (const b of B.balls) if (b.stuck) {
    const s = brkSpeed(), a = Math.random() * .6 - .3;
    b.vx = s * Math.sin(a); b.vy = -s * Math.cos(a); b.stuck = false;
  }
}
function brkStart() { B = brkFresh(B.gm); B.mode = 'play'; if (B.gm === 'stage') loadMap(); else loadStage(); brkOverlay(); brkSave(); }
// saved on every pause, life lost and new row / stage; on return the ball waits on the paddle (one save per mode)
const brkKey = gm => gm === 'stage' ? 'brickbreak-stage-save' : 'brickbreak-save';
function brkSave() {
  if (B.mode !== 'play' && B.mode !== 'pause') { dropKey(brkKey(B.gm)); return; }
  saveJSON(brkKey(B.gm), { level: B.level, rows: B.rows, dropT: B.dropT, score: B.score, lives: B.lives, px: B.px,
    stage: B.stage, loop: B.loop,
    bricks: B.bricks.map(k => ({ x: k.x, y: k.y, hp: k.hp === Infinity ? -1 : k.hp })) });
}
function brkResume(gm = 'endless') {
  const s = loadJSON(brkKey(gm));
  if (!s || !Array.isArray(s.bricks)) return false;
  B = brkFresh(gm);
  Object.assign(B, { level: +s.level || 1, rows: +s.rows || 0, dropT: +s.dropT || dropEvery(+s.level || 1), score: +s.score || 0,
    lives: +s.lives || 1, px: +s.px || BW / 2, stage: Math.min(STAGES.length - 1, +s.stage || 0), loop: +s.loop || 0,
    bricks: s.bricks.filter(k => k && k.hp !== 0).map(k => ({ x: k.x, y: k.y, hp: k.hp === -1 ? Infinity : k.hp })), mode: 'pause' });
  resetBall();
  return true;
}
function brkMode(gm) {
  if (B.gm === gm && B.mode !== 'over') return;
  if (!brkResume(gm)) B = brkFresh(gm);
  brkOverlay();
}
function brkPause() {
  if (B.mode === 'play') B.mode = 'pause'; else if (B.mode === 'pause') B.mode = 'play';
  B.keys.l = B.keys.r = false; brkOverlay(); brkSave();
}
function brkOver() {
  B.mode = 'over'; sfx('over'); dropKey(brkKey(B.gm));
  recordGame(B.gm === 'stage' ? 'brk-stage' : 'brk', B.score);
  if (B.gm === 'stage') B.newBest = stageRecSave('brk', B.score, stageNo());
  else { B.newBest = B.score > bBest; if (B.newBest) { bBest = B.score; save('brickbreak-best', bBest); } }
  brkOverlay();
}
function brkOverlay() {
  const o = $('bOverlay');
  if (B.mode === 'play') { o.hidden = true; return; }
  o.hidden = false; $('bOvScore').hidden = true;
  if (B.mode === 'ready' && B.gm === 'stage') {
    $('bOvTitle').textContent = 'BRICKBREAK · 스테이지';
    $('bOvText').innerHTML = `벽돌을 모두 깨면 다음 스테이지예요. 모양이 다른 ${STAGES.length}개 스테이지가 있고, 다 깨면 더 빠르게 반복돼요.<br>회색 벽돌은 깨지지 않아요.`;
    $('bOvBtn').textContent = '시작';
  } else if (B.mode === 'ready') {
    $('bOvTitle').textContent = 'BRICKBREAK';
    $('bOvText').innerHTML = '벽돌 벽이 몇 초마다 한 줄씩 내려와요.<br>빨간 선에 닿기 전에 깨세요. 끝없이 이어지고 점점 빨라져요.<br>노랑·빨강 벽돌은 여러 번 맞혀야 해요.';
    $('bOvBtn').textContent = '시작';
  } else if (B.mode === 'pause') {
    $('bOvTitle').textContent = '일시정지';
    $('bOvText').textContent = 'P 또는 Esc로 계속합니다.';
    $('bOvBtn').textContent = '계속';
  } else {
    $('bOvTitle').textContent = '게임 오버';
    $('bOvText').textContent = (B.gm === 'stage' ? `${B.reason} 스테이지 ${stageNo()}까지 왔어요.` : `${B.reason} 레벨 ${B.level}까지 버텼어요.`) + (B.newBest && B.score > 0 ? ' 새 최고 기록입니다.' : '');
    $('bOvScore').hidden = false; $('bOvScore').textContent = fmt(B.score);
    $('bOvBtn').textContent = '다시 시작';
  }
}
$('bOvBtn').addEventListener('click', () => { if (B.mode === 'pause') brkPause(); else brkStart(); });
brkResume();
brkOverlay();

function hitBrick(k) {
  if (k.hp === Infinity) { sfx('wall'); return; }
  k.hp--; B.score += 10; sfx('brick'); clearStall();
  if (k.hp <= 0) {
    B.broken = (B.broken || 0) + 1; achEv('brk', 'brick', { broken: B.broken });
    B.score += 20;
    B.fx.push({ x: k.x, y: k.y, t: performance.now() });
    if (Math.random() < .16) {
      const tot = ITEM_KIND.reduce((a, i) => a + i.w, 0);
      let r = Math.random() * tot, kind = ITEM_KIND[0];
      for (const i of ITEM_KIND) { r -= i.w; if (r < 0) { kind = i; break; } }
      B.items.push({ x: k.x + BRW / 2, y: k.y + BRH / 2, kind });
    }
  }
}
function applyItem(kind) {
  sfx('item');
  if (kind.k === 'W') { B.pw = 104; B.wideT = 12000; }
  else if (kind.k === 'L') { B.lives = Math.min(5, B.lives + 1); }
  else if (kind.k === 'M') {
    const src = B.balls.find(b => !b.stuck) || B.balls[0];
    if (!src) return;
    if (src.stuck) launch();
    const add = [];
    for (const a of [-.4, .4]) {
      const c = Math.cos(a), s = Math.sin(a);
      add.push({ x: src.x, y: src.y, vx: src.vx * c - src.vy * s, vy: src.vx * s + src.vy * c, stuck: false });
    }
    B.balls.push(...add);
  }
  achEv('brk', 'item', { balls: B.balls.length });
}
function stepBall(b, s) {
  const px = b.x, py = b.y;
  b.x += b.vx * s; b.y += b.vy * s;
  if (b.x < BR) { b.x = BR; b.vx = Math.abs(b.vx); }
  if (b.x > BW - BR) { b.x = BW - BR; b.vx = -Math.abs(b.vx); }
  if (b.y < BR) { b.y = BR; b.vy = Math.abs(b.vy); keepAngle(b); }
  // paddle
  if (b.vy > 0 && b.y + BR >= PAD_Y && py + BR <= PAD_Y + 2 && Math.abs(b.x - B.px) <= B.pw / 2 + BR) {
    const off = Math.max(-1, Math.min(1, (b.x - B.px) / (B.pw / 2)));
    const a = off * 1.05, sp = brkSpeed();
    b.vx = sp * Math.sin(a); b.vy = -sp * Math.cos(a); b.y = PAD_Y - BR; sfx('paddle'); clearStall();
    return;
  }
  if (b.y > BH + BR) { b.dead = true; return; }
  // bricks: bounce off the side the ball actually came from (judged from where it was before this step)
  for (const k of B.bricks) {
    if (k.hp <= 0 || (b.ghost && k.hp === Infinity)) continue;
    const cx = Math.max(k.x, Math.min(b.x, k.x + BRW)), cy = Math.max(k.y, Math.min(b.y, k.y + BRH));
    const dx = b.x - cx, dy = b.y - cy;
    if (dx * dx + dy * dy < BR * BR) {
      const above = py <= k.y, below = py >= k.y + BRH, left = px <= k.x, right = px >= k.x + BRW;
      if (above || below) b.vy = above ? -Math.abs(b.vy) : Math.abs(b.vy);
      if (left || right) {
        // on a corner, only turn sideways if the ball was more beside the brick than above/below it
        const side = !(above || below) || Math.min(Math.abs(px - k.x), Math.abs(px - k.x - BRW)) > Math.min(Math.abs(py - k.y), Math.abs(py - k.y - BRH));
        if (side) b.vx = left ? -Math.abs(b.vx) : Math.abs(b.vx);
      }
      if (!(above || below || left || right)) {
        // already overlapping (it can happen after the wall moved): push out the short way
        const ox = Math.min(b.x - k.x, k.x + BRW - b.x), oy = Math.min(b.y - k.y, k.y + BRH - b.y);
        if (ox < oy) b.vx = b.x < k.x + BRW / 2 ? -Math.abs(b.vx) : Math.abs(b.vx);
        else b.vy = b.y < k.y + BRH / 2 ? -Math.abs(b.vy) : Math.abs(b.vy);
      }
      b.x = px; b.y = py;
      keepAngle(b);
      hitBrick(k);
      break;
    }
  }
}
// never let the ball fly almost flat: it would crawl sideways between walls and grey bricks
function keepAngle(b) {
  const sp = Math.hypot(b.vx, b.vy), minVy = sp * .28;
  if (Math.abs(b.vy) < minVy) {
    b.vy = (b.vy < 0 ? -1 : 1) * minVy;
    b.vx = (b.vx < 0 ? -1 : 1) * Math.sqrt(Math.max(0, sp * sp - minVy * minVy));
  }
}
// a ball that has not reached the paddle or a breakable brick for a while is bouncing in a loop
// (typically caged by grey bricks and the ceiling). After 4s it gets a small tilt every 1.5s; after 7s it turns
// see-through, passes grey bricks only, and heads down, until it next touches the paddle or a breakable brick.
const STALL_TILT = 4000, STALL_GHOST = 7000;
function unstick(dt) {
  if (!B.balls.some(b => !b.stuck)) { B.stall = 0; B.tiltT = 0; return; }
  B.stall = (B.stall || 0) + dt;
  if (B.stall >= STALL_GHOST) {
    for (const b of B.balls) if (!b.stuck && !b.ghost) { b.ghost = true; b.vy = Math.abs(b.vy); keepAngle(b); }
    return;
  }
  if (B.stall < STALL_TILT) return;
  B.tiltT = (B.tiltT || 0) - dt;
  if (B.tiltT > 0) return;
  B.tiltT = 1500;
  for (const b of B.balls) {
    if (b.stuck) continue;
    const a = (Math.random() < .5 ? -1 : 1) * (.35 + Math.random() * .3), c = Math.cos(a), s = Math.sin(a);
    const vx = b.vx * c - b.vy * s, vy = b.vx * s + b.vy * c;
    b.vx = vx; b.vy = vy; keepAngle(b);
  }
}
function clearStall() { B.stall = 0; B.tiltT = 0; for (const b of B.balls) b.ghost = false; }
function updateBrk(dt) {
  if (B.mode !== 'play') return;
  const s = dt / 1000;
  if (B.msg) {
    B.msgT -= dt;
    if (B.msgT <= 0) {
      const m = B.msg; B.msg = null;
      if (m === 'clear') { B.stage++; if (B.stage >= STAGES.length) { B.stage = 0; B.loop++; } loadMap(); brkSave(); }
    }
    if (B.msg === 'clear') return;
  }
  if (B.slide > 0) B.slide = Math.max(0, B.slide - BRH * dt / 220);
  // the wall only advances while a ball is in play
  if (B.gm !== 'stage' && B.balls.some(b => !b.stuck)) {
    B.dropT -= dt;
    if (B.dropT <= 0) addRow(true);
  }
  if (B.gm !== 'stage' && B.bricks.some(k => k.y + BRH >= DANGER_Y)) { B.reason = '벽돌이 빨간 선에 닿았어요.'; brkOver(); return; }
  const dir = (B.keys.r ? 1 : 0) - (B.keys.l ? 1 : 0);
  if (dir) B.px += dir * 460 * s;
  B.px = Math.max(B.pw / 2, Math.min(BW - B.pw / 2, B.px));
  if (B.wideT > 0) { B.wideT -= dt; if (B.wideT <= 0) B.pw = 64; }

  unstick(dt);
  for (const b of B.balls) {
    if (b.stuck) { b.x = B.px; b.y = PAD_Y - BR - 1; continue; }
    const dist = Math.hypot(b.vx, b.vy) * s, steps = Math.max(1, Math.ceil(dist / 4));
    for (let i = 0; i < steps && !b.dead; i++) stepBall(b, s / steps);
  }
  B.bricks = B.bricks.filter(k => k.hp > 0);
  B.balls = B.balls.filter(b => !b.dead);
  if (!B.balls.length) {
    B.lives--; B.lostInStage = true;
    if (B.lives <= 0) { B.reason = '목숨을 모두 잃었어요.'; brkOver(); return; }
    resetBall(); B.msg = 'miss'; B.msgT = 1100; sfx('lose'); brkSave();
  }
  for (const it of B.items) {
    it.y += 150 * s;
    if (it.y + 8 >= PAD_Y && it.y - 8 <= PAD_Y + PAD_H && Math.abs(it.x - B.px) <= B.pw / 2 + 14) { it.got = true; applyItem(it.kind); }
  }
  B.items = B.items.filter(it => !it.got && it.y < BH + 20);
  if (B.gm === 'stage') {
    if (!B.bricks.some(k => k.hp !== Infinity)) {
      B.score += 500 + B.lives * 100; B.items = []; B.msg = 'clear'; B.msgT = 1600; sfx('stage');
      achEv('brk', 'stageclear', { stage: stageNo(), noLoss: !B.lostInStage });
      stageRecSave('brk', B.score, stageNo() + 1);
    }
  } else if (!B.bricks.length) {
    B.score += 300; addRow(true); addRow(false);
    B.pop = { text: '싹쓸이 +300', t: performance.now() }; sfx('stage');
  }
}
function drawBrk(now) {
  const c = bctx;
  const g = c.createLinearGradient(0, 0, 0, BH);
  g.addColorStop(0, BFIELD); g.addColorStop(1, tok('--brk-bg', '#3b4878'));
  c.fillStyle = g; c.fillRect(0, 0, BW, BH);
  // time until the next row, as a thin bar along the top
  if (B.mode !== 'ready' && B.gm !== 'stage') {
    const q = Math.max(0, Math.min(1, B.dropT / dropEvery(B.level)));
    c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(0, 0, BW, 5);
    c.fillStyle = q < .25 ? '#ef6670' : tok('--accent', '#ffb547'); c.fillRect(0, 0, BW * (1 - q), 5);
  }
  // danger line: brighter as the wall gets close
  const lowest = B.bricks.reduce((m, k) => Math.max(m, k.y + BRH), 0);
  const near = Math.max(0, Math.min(1, 1 - (DANGER_Y - lowest) / 120));
  if (B.gm !== 'stage') {
    c.strokeStyle = `rgba(239,102,112,${.35 + .6 * near})`; c.lineWidth = 2; c.setLineDash([8, 6]);
    c.beginPath(); c.moveTo(0, DANGER_Y + .5); c.lineTo(BW, DANGER_Y + .5); c.stroke(); c.setLineDash([]);
  }
  for (const k of B.bricks) bevelRect(c, k.x, k.y - B.slide, BRW, BRH, k.hp === Infinity ? '#9a97b8' : HP_COLOR[Math.min(3, k.hp)]);
  B.fx = B.fx.filter(f => now - f.t < 300);
  for (const f of B.fx) {
    const q = (now - f.t) / 300;
    c.globalAlpha = 1 - q; c.fillStyle = '#ffffff';
    c.fillRect(f.x + BRW * q / 2, f.y + BRH * q / 2, BRW * (1 - q), BRH * (1 - q));
    c.globalAlpha = 1;
  }
  for (const it of B.items) {
    c.fillStyle = it.kind.color; rrect(c, it.x - 15, it.y - 9, 30, 18, 9);
    c.fillStyle = '#ffffff'; c.font = '600 12px "IBM Plex Sans KR", system-ui, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(it.kind.label, it.x, it.y + 1);
  }
  // paddle
  c.fillStyle = B.wideT > 0 ? '#7ea0ff' : tok('--accent', '#ffb547');
  rrect(c, B.px - B.pw / 2, PAD_Y, B.pw, PAD_H, 6);
  c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(B.px - B.pw / 2 + 5, PAD_Y + 2, B.pw - 10, 3);
  // balls
  c.fillStyle = tok('--ball', '#ffffff');
  for (const b of B.balls) { c.globalAlpha = b.ghost ? .45 + .25 * Math.sin(now / 80) : 1; c.beginPath(); c.arc(b.x, b.y, BR, 0, Math.PI * 2); c.fill(); }
  c.globalAlpha = 1;
  // messages
  c.textAlign = 'center'; c.textBaseline = 'middle';
  let msg = null;
  if (B.msg === 'clear') msg = `스테이지 ${stageNo()} 클리어!`;
  else if (B.msg === 'miss') msg = '공을 놓쳤어요';
  else if (B.mode === 'play' && B.balls.some(b => b.stuck)) msg = '탭 또는 Space로 발사';
  if (msg) {
    c.font = '20px Bungee, "IBM Plex Sans KR", Impact, sans-serif';
    c.lineWidth = 5; c.strokeStyle = BFIELD; c.strokeText(msg, BW / 2, 360);
    c.fillStyle = tok('--ink', '#ffffff'); c.fillText(msg, BW / 2, 360);
  }
  if (B.pop) {
    const q = (now - B.pop.t) / 1200;
    if (q >= 1) B.pop = null;
    else {
      c.globalAlpha = 1 - q * q; c.font = '24px Bungee, "IBM Plex Sans KR", Impact, sans-serif';
      c.lineWidth = 5; c.strokeStyle = BFIELD; c.strokeText(B.pop.text, BW / 2, 300 - 20 * q);
      c.fillStyle = tok('--accent', '#ffb547'); c.fillText(B.pop.text, BW / 2, 300 - 20 * q);
      c.globalAlpha = 1;
    }
  }
  setText('bStageL', B.gm === 'stage' ? '스테이지' : '레벨');
  setText('bScore', B.score); setText('bStage', B.gm === 'stage' ? stageNo() : B.level);
  setText('bLives', '♥'.repeat(Math.max(0, B.lives)) || '–'); setText('bBest', Math.max(brkBest(), B.score));
}
function brkLocalX(e) { const r = bcv.getBoundingClientRect(); return (e.clientX - r.left) * BW / r.width; }
let brkTouch = null;
bcv.addEventListener('pointerdown', e => {
  if (B.mode !== 'play') return;
  e.preventDefault();
  try { bcv.setPointerCapture(e.pointerId); } catch (_) {}
  brkTouch = e.pointerId;
  B.px = brkLocalX(e);
  if (B.balls.some(b => b.stuck) && !B.msg) launch();
});
bcv.addEventListener('pointermove', e => {
  if (B.mode !== 'play') return;
  if (e.pointerType === 'mouse' || e.pointerId === brkTouch) B.px = brkLocalX(e);
});
const brkUp = e => { if (e.pointerId === brkTouch) brkTouch = null; };
bcv.addEventListener('pointerup', brkUp); bcv.addEventListener('pointercancel', brkUp);
bcv.addEventListener('contextmenu', e => e.preventDefault());

