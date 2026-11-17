// ================= shared helpers for the new games =================
function bevelRect(c, x, y, w, h, color, alpha = 1) {
  c.globalAlpha = alpha;
  if (LOOK !== 'bevel') { drawLook(c, x, y, w, h, paint(color)); c.globalAlpha = 1; return; }
  c.fillStyle = paint(color); c.fillRect(x + 1, y + 1, w - 2, h - 2);
  const e = Math.max(2, Math.min(w, h) * .18);
  c.fillStyle = 'rgba(255,255,255,.32)'; c.fillRect(x + 1, y + 1, w - 2, e);
  c.fillStyle = 'rgba(0,0,0,.26)'; c.fillRect(x + 1, y + h - 1 - e, w - 2, e);
  c.globalAlpha = 1;
}
let BFIELD = tok('--brk-field', '#27315c');

