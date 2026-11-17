// ================= loop & boot =================
let last = 0;
function frame(t) {
  const dt = Math.min(t - (last || t), 100); last = t;
  if (current === 'fall') { updateFall(dt); drawFall(); }
  else if (current === 'pack') drawPack(t);
  else if (current === 'brk') { updateBrk(dt); drawBrk(t); }
  else if (current === 'stk') { updateStk(dt); drawStk(t); }
  else if (current === 'pop') { updatePop(dt); drawPop(t); }
  else if (current === 'sld') { updateSld(dt); drawSld(t); }
  else if (current === 'snk') { updateSnk(dt); drawSnk(t); }
  requestAnimationFrame(frame);
}
function boot(data) {
  S = fresh();
  if (data && data.S && data.S.board) { Object.assign(S, data.S); if (S.mode === 'play') S.mode = 'pause'; }
  else fallResume();
  if (data && data.P && data.P.grid) { P = Object.assign(packFresh(), data.P, { fx: [], texts: [] }); updatePackStats(); if (P.mode === 'over') packOver(); }
  else if (!packResume()) packStart();
  showOverlay();
  show(location.hash.slice(1) || 'menu', true);
  requestAnimationFrame(frame);
}
const hot = window.claude && window.claude.hot;
if (hot && typeof hot.snapshot === 'function') { try { hot.snapshot(() => ({ S, P })); } catch (e) {} }
if (hot && typeof hot.ready === 'function') hot.ready(boot); else boot((hot && hot.data) || {});
