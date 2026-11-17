// Test cases for source/test.js. Each `code` runs in the page (see PRELUDE there for t, $, assert, eq, key, sleep, rnd).
// t('expr') evaluates inside the game's scope, so tests can read state (S, P, B, T, PO, SL) and call game functions.
module.exports = [
  // ---------------- shell ----------------
  { name: 'shell: menu shows seven games and no errors on load', code: `
    assert(!$('scrMenu').hidden, 'menu visible');
    eq(document.querySelectorAll('.cards .card').length, 7, 'seven cards');` },
  { name: 'shell: every screen opens', code: `
    for (const s of ['fall','pack','brk','stk','pop','sld','snk','stats','ach','menu']) { t(\`show('\${s}')\`); eq(t('current'), s, 'current screen'); assert(!$('scr' + ({fall:'Fall',pack:'Pack',brk:'Brk',stk:'Stk',pop:'Pop',sld:'Sld',snk:'Snk',stats:'Stats',ach:'Ach',menu:'Menu'})[s]).hidden, s + ' visible'); }` },
  { name: 'shell: first visit shows how-to-play once', code: `
    localStorage.removeItem('brick-intro-seen');
    t("show('pop')"); assert(!$('intro').hidden, 'intro shown');
    $('introGo').click(); assert($('intro').hidden, 'intro closed');
    t("show('menu')"); t("show('pop')"); assert($('intro').hidden, 'not shown again');` },
  { name: 'shell: mode picker for the four two-mode games only', code: `
    for (const g of ['fall','pack','brk','pop']) { t(\`goGame('\${g}')\`); assert(!$('modeSheet').hidden, g + ' picker'); $('modeCancel').click(); eq(t('current'), 'menu', 'stays on menu'); }
    for (const g of ['stk','sld','snk']) { t("show('menu')"); t(\`goGame('\${g}')\`); assert($('modeSheet').hidden, g + ' no picker'); eq(t('current'), g, 'opened'); }` },
  { name: 'shell: settings save theme, volume, vibration and marks', code: `
    t("show('menu')"); document.querySelector('[data-settings]').click(); assert(!$('settings').hidden, 'open');
    $('skinLight').click(); eq(document.documentElement.getAttribute('data-skin'), 'light', 'skin');
    $('marksOn').click(); eq(t('MARKS'), true, 'marks on');
    const v = $('volRange'); v.value = 30; v.dispatchEvent(new Event('input'));
    const s = JSON.parse(localStorage.getItem('brick-settings'));
    eq([s.skin, s.vol, s.marks], ['light', 30, true], 'saved');
    $('closeSettings').click(); assert($('settings').hidden, 'closed');` },
  { name: 'shell: text is readable in light and dark themes', code: `
    const lum = c => { const m = c.match(/[\\d.]+/g).map(Number); const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(m[0]) + .7152 * f(m[1]) + .0722 * f(m[2]); };
    const bgOf = el => { for (let e = el; e; e = e.parentElement) { const b = getComputedStyle(e).backgroundColor; const a = (b.match(/[\\d.]+/g) || []).map(Number); if (a.length === 3 || (a.length === 4 && a[3] > .5)) return b; } return getComputedStyle(document.body).backgroundColor; };
    const ratio = el => { const a = lum(getComputedStyle(el).color), b = lum(bgOf(el)); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };
    const bad = [];
    for (const skin of ['dark', 'light']) {
      t(\`settings.skin = '\${skin}'; applySkin()\`);
      // open every screen and dialog that carries text, then measure each visible text element
      const views = [() => t("show('menu')"), () => t("show('stats')"), () => t("show('ach')"), () => { t("show('menu')"); t("openModePicker('pop')"); },
        () => { $('modeCancel').click(); t("openIntro('fall')"); }, () => { t('closeIntro()'); document.querySelector('[data-settings]').click(); },
        () => { $('closeSettings').click(); $('updToast').hidden = false; }, () => { t("show('pop')"); }, () => { t("show('pack')"); }, () => { t("show('fall')"); }];
      for (const v of views) {
        v();
        for (const el of document.querySelectorAll('h1,h2,h3,p,b,span,button,dt,dd,label,li,em')) {
          if (!el.offsetParent || !el.textContent.trim() || el.closest('[hidden]')) continue;
          if ([...el.childNodes].every(n => n.nodeType !== 3 || !n.textContent.trim())) continue;
          if (getComputedStyle(el).opacity < .9 || el.closest('.ach:not(.got)') || el.closest('.logo')) continue;
          const r = ratio(el), big = parseFloat(getComputedStyle(el).fontSize) >= 18;
          if (r < (big ? 3 : 4.5)) bad.push(skin + ': "' + el.textContent.trim().slice(0, 24) + '" ' + r.toFixed(2));
        }
      }
      $('updToast').hidden = true;
    }
    assert(!bad.length, 'low contrast: ' + [...new Set(bad)].slice(0, 40).join('; '));` },

  // ---------------- BRICKFALL ----------------
  { name: 'fall: random play keeps a valid board', code: `
    t("show('fall'); start()");
    const acts = ['left','right','cw','ccw','drop','down','hold'];
    for (let i = 0; i < 600 && t("S.mode") !== 'over'; i++) { t(\`press('\${acts[rnd(acts.length)]}'); release('down'); updateFall(60)\`); if (t('S.clearing')) t('updateFall(300)'); }
    eq(t('S.board.length'), 20, 'rows'); assert(t('S.board.every(r => r.length === 10)'), 'cols');
    assert(t('S.score') >= 0, 'score');
    return 'score ' + t('S.score') + ', mode ' + t('S.mode');` },
  { name: 'fall: filling a row clears it and scores', code: `
    t("show('fall'); start()");
    t("S.board[19] = Array.from({length:10}, (_, c) => c === 4 || c === 5 ? null : 'G'); S.board[18] = Array.from({length:10}, (_, c) => c === 4 || c === 5 ? null : 'G'); S.queue = ['I','I','I','I','I','I','I','I']; S.cur = null; spawn('O')");
    t('hardDrop()'); assert(t('S.clearing') && t('S.clearing.length') === 2, 'two rows flagged');
    t('updateFall(300)'); eq(t('S.lines'), 2, 'lines'); assert(t('S.board[19].every(v => !v)'), 'bottom empty');
    assert(t('S.score') >= 300, 'scored');` },
  { name: 'fall: stage clear moves to the next stage with more junk', code: `
    t("GM.fall = 'stage'; fallMode('stage'); show('fall'); start()");
    eq(t('S.board.filter(r => r.includes("G")).length'), 2, 'stage 1 has 2 junk rows');
    t("S.stageLines = 9; S.board = Array.from({length:20}, () => Array(10).fill(null)); S.board[19] = Array.from({length:10}, (_, c) => c === 4 || c === 5 ? null : 'G'); S.cur = null; spawn('O'); hardDrop(); updateFall(300)");
    eq(t('S.mode'), 'clear', 'clear screen');
    eq(JSON.parse(localStorage.getItem('brickfall-stage-save')).mode, 'clear', 'clear is saved');
    $('ovBtn').click();
    eq([t('S.stage'), t('S.mode'), t('S.board.filter(r => r.includes("G")).length')], [2, 'play', 3], 'stage 2');` },
  { name: 'fall: game in progress survives a reload (both modes)', code: `
    t("show('fall'); start()"); for (let i = 0; i < 6; i++) t("hardDrop(); if (S.clearing) updateFall(300)");
    t('togglePause()');
    const e = JSON.parse(localStorage.getItem('brickfall-save'));
    t("fallResume('endless')"); eq(t('S.score'), e.score, 'endless score back'); eq(t('S.mode'), 'pause', 'paused');
    t("fallMode('stage'); start()"); t('hardDrop()'); t('togglePause()');
    const s = JSON.parse(localStorage.getItem('brickfall-stage-save'));
    t("fallMode('endless')"); eq(t('S.gm'), 'endless', 'switched'); eq(t('S.score'), e.score, 'endless kept');
    t("fallMode('stage')"); eq(t('S.score'), s.score, 'stage kept');` },

  { name: 'fall: touch swipes move, rotate, drop and hold', code: `
    t("show('fall'); start(); S.board = Array.from({length:20}, () => Array(10).fill(null)); S.cur = null; S.hold = null; S.canHold = true; spawn('T')");
    const cv = $('board'), r = cv.getBoundingClientRect(), cell = r.width / 10;
    const at = (x, y) => ({ clientX: r.left + x, clientY: r.top + y, pointerType: 'touch', pointerId: 7, bubbles: true });
    const gesture = async (pts, gap) => {
      cv.dispatchEvent(new PointerEvent('pointerdown', at(...pts[0])));
      for (const p of pts.slice(1)) { await sleep(gap); cv.dispatchEvent(new PointerEvent('pointermove', at(...p))); }
      cv.dispatchEvent(new PointerEvent('pointerup', at(...pts[pts.length - 1])));
    };
    const x0 = t('S.cur.x'), y0 = t('S.cur.y'), cx = r.width / 2, cy = r.height / 3;
    // drag right three cells, slowly: three columns, no drop
    await gesture([[cx, cy], [cx + cell, cy + 2], [cx + 2 * cell, cy + 3], [cx + 3 * cell, cy + 3]], 40);
    eq([t('S.cur.x') - x0, t('S.cur.y')], [3, y0], 'moved 3 right, same row');
    // tap: rotates
    const m0 = JSON.stringify(t('S.cur.m')); await gesture([[cx, cy], [cx + 2, cy + 1]], 20);
    assert(JSON.stringify(t('S.cur.m')) !== m0, 'tap rotates');
    // slow drag down two cells: soft drop, piece still falling
    const ySlow = t('S.cur.y'); await gesture([[cx, cy], [cx, cy + cell * .7], [cx, cy + cell * 1.4], [cx, cy + cell * 2.1]], 120);
    eq([t('S.cur.y') - ySlow, t('S.cur.type')], [2, 'T'], 'soft-dropped 2 rows');
    // flick up: hold
    await gesture([[cx, cy + 3 * cell], [cx, cy + 1.5 * cell], [cx, cy]], 16);
    eq(t('S.hold'), 'T', 'held');
    // flick down: hard drop locks the piece
    const filled = t('S.board.flat().filter(Boolean).length');
    await gesture([[cx, cy], [cx, cy + 1.5 * cell], [cx, cy + 3 * cell], [cx, cy + 4.5 * cell]], 16);
    assert(t('S.board.flat().filter(Boolean).length') > filled, 'dropped and locked');` },

  // ---------------- BRICKPACK ----------------
  { name: 'pack: random play until no move, then records the game', code: `
    t("show('pack'); packStart(false, 'endless')");
    let moves = 0;
    while (t("P.mode") === 'play' && moves < 400) {
      const ok = t(\`(() => { for (let i = 0; i < 3; i++) { const p = P.tray[i]; if (!p) continue;
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (fitsAt(p, r, c)) { place(i, r, c); return true; } } return false; })()\`);
      if (!ok) break; moves++;
    }
    eq(t('P.mode'), 'over', 'game ended');
    eq(localStorage.getItem('brickpack-save'), null, 'save dropped');
    eq(JSON.parse(localStorage.getItem('brick-stats')).pack.n, 1, 'stats counted');
    return moves + ' pieces, ' + t('P.score') + ' points';` },
  { name: 'pack: clearing every stone passes the stage', code: `
    t("show('pack'); packStart(false, 'stage')");
    eq(t('stonesLeft()'), 4, 'stage 1 has 4 stones');
    t("P.grid = Array.from({length:8}, () => Array(8).fill(null)); P.grid[0] = [STONE,'#ef6670','#ef6670','#ef6670','#ef6670','#ef6670','#ef6670',null]; P.tray = [{cells:[[0,0]],w:1,h:1,color:'#56cfe1'}, null, null]; place(0, 0, 7)");
    eq(t('P.mode'), 'clear', 'stage cleared');
    await sleep(700); assert(!$('pOverlay').hidden, 'clear overlay');
    $('pRestart').click(); eq([t('P.stage'), t('stonesLeft()'), t('P.mode')], [2, 6, 'play'], 'stage 2');` },
  { name: 'pack: daily board gives the same pieces', code: `
    t("packStart(true)"); const a = JSON.stringify(t('P.tray'));
    t("packStart(true)"); eq(JSON.stringify(t('P.tray')), a, 'same daily tray');
    let same = 0; for (let i = 0; i < 5; i++) { t("packStart(false)"); if (JSON.stringify(t('P.tray')) === a) same++; }
    assert(same < 5, 'normal games differ');` },

  // ---------------- BRICKBREAK ----------------
  { name: 'brk: endless mode runs and the wall comes down', code: `
    t("show('brk'); GM.brk = 'endless'; brkMode('endless'); brkStart(); launch()");
    const rows0 = t('B.rows');
    for (let i = 0; i < 1500 && t("B.mode") === 'play'; i++) {
      t("B.px = Math.max(B.pw/2, Math.min(360 - B.pw/2, (B.balls[0] || {x:180}).x)); if (B.balls.some(b => b.stuck) && !B.msg) launch(); updateBrk(16)");
    }
    assert(t('B.rows') > rows0, 'rows added');
    assert(t('B.bricks.every(k => k.hp >= 1)'), 'bricks valid');
    return 'level ' + t('B.level') + ', score ' + t('B.score') + ', mode ' + t('B.mode');` },
  { name: 'brk: stage mode loads maps and advances on clear', code: `
    t("show('brk'); brkMode('stage'); brkStart()");
    eq(t('B.bricks.length'), 40, 'map 1 has 40 bricks');
    t("B.bricks = [{x:20,y:56,hp:Infinity}]; launch(); updateBrk(16)");
    eq(t('B.msg'), 'clear', 'clear message');
    t('updateBrk(1700)'); eq(t('stageNo()'), 2, 'stage 2'); eq(t('B.bricks.length'), 30, 'map 2');
    assert(!t('B.rows'), 'no wall rows in stage mode');` },
  { name: 'brk: save keeps unbreakable bricks', code: `
    t("show('brk'); brkMode('stage'); brkStart(); B.stage = 2; loadMap(); brkSave()");
    const n = t('B.bricks.filter(k => k.hp === Infinity).length'); assert(n > 0, 'map has unbreakable');
    t("brkMode('endless'); brkMode('stage')");
    eq(t('B.bricks.filter(k => k.hp === Infinity).length'), n, 'unbreakable after reload');` },

  // ---------------- BRICKSTACK ----------------
  { name: 'stack: stacking until a miss, and pause does not drop', code: `
    t("show('stk'); stkStart()");
    for (let i = 0; i < 25 && t('T.mode') === 'play'; i++) { t(\`T.mov.x = T.stack[T.stack.length-1].x + \${i % 3 === 0 ? 0 : 3}; stkTap()\`); }
    const h = t('T.score'); assert(h >= 20, 'built ' + h);
    t('stkPause()'); eq(t('T.mode'), 'pause', 'paused');
    t('stkTap()'); eq([t('T.mode'), t('T.score')], ['play', h], 'resume does not drop');
    t("T.mov.x = 400; stkTap()"); eq(t('T.mode'), 'over', 'miss ends the game');` },

  // ---------------- BRICKPOP ----------------
  { name: 'pop: endless random play stays on the board until it overflows', code: `
    t("show('pop'); popNew(false, 'endless')");
    let n = 0;
    while (t('PO.mode') === 'play' && n < 3000) { t(\`(() => { const c = \${rnd(10)}, i = \${rnd(12)}; if (PO.cols[c] && PO.cols[c][i]) popAt(c, i); })()\`); n++; }
    eq(t('PO.mode'), 'over', 'ended');
    assert(t('PO.cols.some(c => c.length > 12)'), 'ended by overflow');
    return 'level ' + t('PO.level') + ', score ' + t('PO.score');` },
  { name: 'pop: stage ends at no moves and passes only at the target', code: `
    const out = [];
    for (let k = 0; k < 6; k++) {
      t("show('pop'); popNew(false, 'stage')");
      while (t('PO.mode') === 'play') t("(() => { for (let c = 0; c < PO.cols.length; c++) for (let i = 0; i < PO.cols[c].length; i++) if (popGroup(c, i).length >= 2) { popAt(c, i); return; } })()");
      const passed = t('PO.stageScore >= PO.target');
      eq(t('PO.mode'), passed ? 'clear' : 'over', 'result matches target');
      out.push(t('PO.stageScore') + (passed ? '✓' : '✗'));
    }
    return 'stage 1 scores: ' + out.join(' ');` },
  { name: 'pop: daily board is the same for the day', code: `
    t("popNew(true, 'endless')"); const a = JSON.stringify(t('PO.cols.map(c => c.map(x => x.color))'));
    t("popNew(true)"); eq(JSON.stringify(t('PO.cols.map(c => c.map(x => x.color))')), a, 'same');
    t("popNew(false)"); assert(JSON.stringify(t('PO.cols.map(c => c.map(x => x.color))')) !== a, 'normal differs');` },

  // ---------------- BRICKSLIDE ----------------
  { name: 'slide: random slides never overlap, float or leave full rows', code: `
    t("show('sld'); sldNew()");
    const settle = () => { for (let i = 0; i < 400 && t("SL.phase") !== 'idle' && t('SL.mode') === 'play'; i++) t('updateSld(50)'); };
    settle(); let moves = 0;
    for (let k = 0; k < 120 && t('SL.mode') === 'play'; k++) {
      const moved = t(\`(() => { const g = sldOcc(); const opts = [];
        for (const b of SL.bars) for (let nc = 0; nc + b.len <= 8; nc++) { if (nc === b.c) continue;
          let ok = true; const lo = Math.min(nc, b.c), hi = Math.max(nc, b.c) + b.len;
          for (let x = lo; x < hi; x++) if (g[b.r][x] && g[b.r][x] !== b) { ok = false; break; }
          if (ok) opts.push([b, nc]); }
        if (!opts.length) return false; const [b, nc] = opts[\${rnd(1000)} % opts.length];
        b.c = nc; SL.rise = true; SL.chain = 0; sldGravity(); SL.phase = 'anim'; return true; })()\`);
      if (!moved) break; moves++; settle();
      if (t('SL.mode') !== 'play') break;
      const bad = t(\`(() => { const g = Array.from({length:10}, () => Array(8).fill(0));
        for (const b of SL.bars) for (let x = 0; x < b.len; x++) { if (b.c + x > 7 || b.r < 0 || b.r > 9) return 'out of board'; if (g[b.r][b.c + x]++) return 'overlap'; }
        for (const b of SL.bars) if (b.r < 9) { let free = true; for (let x = 0; x < b.len; x++) if (g[b.r + 1][b.c + x]) free = false; if (free) return 'floating bar'; }
        if (g.some(r => r.every(Boolean))) return 'full row left'; return ''; })()\`);
      assert(!bad, bad + ' after move ' + moves);
    }
    return moves + ' moves, ' + t('SL.lines') + ' lines, mode ' + t('SL.mode');` },

  // ---------------- BRICKSNAKE ----------------
  { name: 'snake: steered play keeps a joined body until it crashes', code: `
    t("show('snk'); snkStart()");
    // a simple pilot: head for the nearest brick, never step into a wall, stone or the body if another way exists
    const pilot = \`(() => { const [hx, hy] = N.body[0]; const f = N.food.slice().sort((a, b) => (Math.abs(a.x-hx)+Math.abs(a.y-hy)) - (Math.abs(b.x-hx)+Math.abs(b.y-hy)))[0];
      const ok = d => { const [dx, dy] = DIRS[d], x = hx + dx, y = hy + dy; return x >= 0 && y >= 0 && x < NC && y < NR && !N.body.slice(0, -1).some(([a, b]) => a === x && b === y) && !N.stones.some(s => s.x === x && s.y === y); };
      const want = [f && f.x > hx ? 'right' : null, f && f.x < hx ? 'left' : null, f && f.y > hy ? 'down' : null, f && f.y < hy ? 'up' : null].filter(Boolean);
      const [lx, ly] = DIRS[N.dir]; const back = Object.keys(DIRS).find(d => DIRS[d][0] === -lx && DIRS[d][1] === -ly);
      const pick = [...want, N.dir, 'up', 'down', 'left', 'right'].find(d => d !== back && ok(d));
      if (pick && pick !== N.dir) N.queue = [pick]; snkStepOnce(); })()\`;
    let steps = 0;
    for (; steps < 4000 && t('N.mode') === 'play'; steps++) {
      t(pilot);
      const bad = t(\`(() => { if (N.cols.length !== N.body.length) return 'colour count';
        for (let i = 1; i < N.body.length; i++) { const [a, b] = N.body[i - 1], [c, d] = N.body[i]; if (Math.abs(a - c) + Math.abs(b - d) !== 1) return 'body not joined at ' + i; }
        if (N.mode === 'play' && new Set(N.body.map(p => p.join())).size !== N.body.length) return 'overlap';
        for (let i = 1; i < N.cols.length - 2; i++) if (N.cols[i] && N.cols[i] === N.cols[i + 1] && N.cols[i] === N.cols[i + 2] && i === 1) return 'run of 3 left behind the head';
        return ''; })()\`);
      assert(!bad, bad + ' at step ' + steps);
    }
    assert(t('N.eaten') >= 5, 'ate ' + t('N.eaten'));
    return steps + ' steps, ' + t('N.eaten') + ' bricks, length ' + t('N.body.length') + ', score ' + t('N.score') + ', ' + t('N.mode');` },
  { name: 'snake: three of a colour pop, and the close-up can chain', code: `
    t("show('snk'); snkStart(); N.stones = []; N.body = [[5,5],[4,5],[3,5],[2,5],[1,5]]; N.cols = [null,'#ef6670','#ef6670','#6ccf86','#5c86f2']; N.dir = 'right'; N.queue = []; N.food = [{x:6,y:5,c:'#ef6670'}]; N.score = 0; snkStepOnce()");
    eq([t('N.body.length'), t('N.cols.slice(1)'), t('N.score')], [3, ['#6ccf86','#5c86f2'], 100], 'popped three red');
    t("N.body = [[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,9]]; N.cols = [null,'#ef6670','#ef6670','#5c86f2','#5c86f2','#5c86f2','#6ccf86']; N.dir = 'right'; N.food = [{x:6,y:8,c:'#ef6670'}]; N.score = 0; snkStepOnce()");
    eq([t('N.body.length'), t('N.cols.slice(1)')], [2, ['#6ccf86']], 'red then blue popped');
    eq(t('N.score'), 10 + 90 + 180, 'chain scores double');
    const got = JSON.parse(localStorage.getItem('brick-ach')); assert(got['snk-pop'] && got['snk-chain2'], 'pop achievements');` },
  { name: 'snake: no turning back, walls end it, pause and resume', code: `
    t("show('snk'); snkStart(); N.stones = []; N.food = []; snkTurn('left')"); eq(t('N.queue.length'), 0, 'reverse ignored');
    t("snkTurn('up')"); eq(t('N.queue'), ['up'], 'turn queued');
    t("snkPause()"); eq(t('N.mode'), 'pause', 'paused'); const s = JSON.parse(localStorage.getItem('bricksnake-save')); eq(s.body.length, 3, 'saved');
    t("snkResume()"); eq(t('N.mode'), 'pause', 'resumes paused');
    t("snkTurn('up')"); eq(t('N.mode'), 'play', 'a turn resumes');
    for (let i = 0; i < 30 && t('N.mode') === 'play'; i++) t('snkStepOnce()');
    eq(t('N.mode'), 'over', 'hit the wall'); eq(localStorage.getItem('bricksnake-save'), null, 'save dropped');
    eq(JSON.parse(localStorage.getItem('brick-stats')).snk.n, 1, 'stats');` },

  // ---------------- rewards ----------------
  { name: 'rewards: locked until enough stars, then change the look', code: `
    t("show('ach')");
    eq([...document.querySelectorAll('#rewards .rw:not(:disabled)')].map(b => b.textContent), ['기본', '기본', '새내기'], 'only defaults open');
    // 3 stars per ★★★, 2 per ★★, 1 per ★: unlock enough for 30 stars
    const ids = t('ACH').filter(a => a.s === 3).slice(0, 10).map(a => a.id);
    localStorage.setItem('brick-ach', JSON.stringify(Object.fromEntries(ids.map(i => [i, '2026-11-17']))));
    t("show('menu')"); assert($('mTitle').textContent.includes('벽돌 수집가') && $('mTitle').textContent.includes('30'), 'title on menu: ' + $('mTitle').textContent);
    t("show('ach')");
    const open = [...document.querySelectorAll('#rewards .rw:not(:disabled)')].map(b => b.textContent);
    for (const n of ['파스텔', '네온', '보석', '둥근', '픽셀', '벽돌 견습생', '벽돌 수집가']) assert(open.includes(n), n + ' open');
    assert(!open.includes('레트로') && !open.includes('유리'), 'higher ones locked');
    [...document.querySelectorAll('#rewards .rw')].find(b => b.textContent === '네온').click();
    eq(t("paint('#ef6670')"), '#ff3b6b', 'neon red');
    [...document.querySelectorAll('#rewards .rw')].find(b => b.textContent === '픽셀').click();
    eq(t('LOOK'), 'pixel', 'pixel shape');
    [...document.querySelectorAll('#rewards .rw')].find(b => b.textContent === '벽돌 견습생').click();
    const st = JSON.parse(localStorage.getItem('brick-settings')); eq([st.palette, st.shape, st.title], ['neon', 'pixel', '벽돌 견습생'], 'saved');
    t("show('menu')"); assert($('mTitle').textContent.startsWith('벽돌 견습생'), 'picked title shown');
    // every shape draws in every game without errors
    for (const sh of ['bevel', 'round', 'pixel', 'glass']) { t(\`setLook('jewel', '\${sh}'); refreshTheme()\`); for (const g of ['fall','pack','brk','stk','pop','sld','snk']) { t(\`show('\${g}')\`); await sleep(40); } }` },

  // ---------------- achievements & data ----------------
  { name: 'achievements: nine per game, three per tier, unique ids', code: `
    const A = t('ACH'); eq(new Set(A.map(a => a.id)).size, A.length, 'unique ids');
    for (const g of ['fall','pack','brk','stk','pop','sld','snk']) for (const s of [1,2,3]) eq(A.filter(a => a.g === g && a.s === s).length, 3, g + ' tier ' + s);` },
  { name: 'achievements: unlock once, show a notice, list on the screen', code: `
    t("achEv('pop', 'pop', { n: 12, level: 1, stage: false, empty: false })");
    const got = JSON.parse(localStorage.getItem('brick-ach')); assert(got['pop-10'], 'pop-10 unlocked'); assert(!got['pop-20'], 'pop-20 still locked');
    assert(!$('achToast').hidden, 'notice shown'); eq($('achName').textContent, '10개 한 번에', 'notice text');
    t("achEv('pop', 'pop', { n: 12 })"); eq(t('achQueue.length'), 0, 'no duplicate');
    t("show('ach')"); eq(document.querySelectorAll('.ach').length, 63, '63 rows'); eq(document.querySelectorAll('.ach.got').length, 1, 'one unlocked');` },
  { name: 'achievements: playing unlocks them (4 lines, perfect stack, item)', code: `
    t("show('fall'); start(); S.board = Array.from({length:20}, (_, r) => r >= 16 ? Array.from({length:10}, (_, c) => c === 0 ? null : 'G') : Array(10).fill(null)); S.cur = null; spawn('I'); rotate(1); for (let i = 0; i < 6; i++) move(-1); hardDrop(); updateFall(300)");
    const got = JSON.parse(localStorage.getItem('brick-ach') || '{}');
    assert(got['fall-four'] && got['fall-line'], 'four-line unlocked: ' + Object.keys(got));
    assert(got['fall-empty'], 'board emptied too');
    t("show('stk'); stkStart(); T.mov.x = T.stack[0].x; stkTap()"); assert(JSON.parse(localStorage.getItem('brick-ach'))['stk-perfect'], 'perfect');
    t("show('brk'); brkMode('endless'); brkStart(); applyItem(ITEM_KIND[1])"); const g2 = JSON.parse(localStorage.getItem('brick-ach'));
    assert(g2['brk-item'] && g2['brk-ball3'], 'item + three balls');` },
  { name: 'data: export and import restore every record', code: `
    localStorage.setItem('brickpop-best', '777'); localStorage.setItem('brick-ach', '{"pop-10":"2026-01-01"}');
    t("show('stats')"); $('xExport').click(); const code = $('xCode').value; assert(code.startsWith('BA1.'), 'code');
    const before = JSON.stringify(Object.keys(localStorage).filter(k => k.startsWith('brick')).sort().map(k => [k, localStorage.getItem(k)]));
    localStorage.setItem('brickpop-best', '1'); localStorage.removeItem('brick-ach');
    $('xImportOpen').click(); $('xPaste').value = 'nope'; $('xImport').click(); assert($('xInMsg').textContent, 'bad code message');
    window.confirm = () => true; window.__noReload = true;
    const data = t('xUnpack')(code); for (const k of Object.keys(localStorage)) if (k.startsWith('brick')) localStorage.removeItem(k);
    for (const k of Object.keys(data)) localStorage.setItem(k, data[k]);
    const after = JSON.stringify(Object.keys(localStorage).filter(k => k.startsWith('brick')).sort().map(k => [k, localStorage.getItem(k)]));
    eq(after, before, 'restored');` },
  { name: 'data: stats screen shows eleven cards', code: `
    t("recordGame('pop', 120); recordGame('pop', 300); show('stats')");
    eq(document.querySelectorAll('.st-card').length, 11, 'cards');
    assert($('statsList').textContent.includes('210'), 'average shown');` },
];
