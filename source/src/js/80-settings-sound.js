// ================= settings: theme + volume =================
let settings = { skin: 'dark', vol: 70, vibe: true, marks: false };
try { Object.assign(settings, JSON.parse(localStorage.getItem('brick-settings') || '{}')); } catch (e) {}
MARKS = !!settings.marks;
const saveSettings = () => { try { localStorage.setItem('brick-settings', JSON.stringify(settings)); } catch (e) {} };

function refreshTheme() {
  WELL = tok('--well', '#0f0d17'); GRID = tok('--line', '#302b44'); EMPTY = tok('--cell', '#1d1a2a');
  PWELL = tok('--pack-well', '#363162'); PEMPTY = tok('--pack-cell', '#4a437c');
  BFIELD = tok('--brk-field', '#27315c');
  artFP(); artBrk(); artStk(); artPop(); artSld();
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', tok('--bg', '#15131e'));
}
function applySkin() {
  document.documentElement.setAttribute('data-skin', settings.skin);
  refreshTheme();
}
try { matchMedia('(prefers-color-scheme: light)').addEventListener('change', refreshTheme); } catch (e) {}
new MutationObserver(refreshTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

// sound: tiny synthesized effects, no files needed (works offline)
let actx = null, master = null;
function ensureAudio() {
  try {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      actx = new AC(); master = actx.createGain(); master.connect(actx.destination); setVol();
    }
    if (actx.state === 'suspended') actx.resume();
  } catch (e) {}
}
function setVol() { if (master) master.gain.value = (settings.vol / 100) * .6; }
addEventListener('pointerdown', ensureAudio, true);
addEventListener('keydown', ensureAudio, true);
function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
  const t = actx.currentTime + when;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + .006);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .02);
}
const ARP = [523, 659, 784, 1046, 1318, 1568];
// short vibrations on phones that support it (Android; iPhone Safari has no vibration API)
const canVibe = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
const VIBE = { drop: 12, lock: 8, place: 8, item: 15, stack: 10, perfect: [12, 40, 12], lose: 70, stage: [20, 60, 20], over: [60, 50, 120] };
function buzz(name, n) {
  if (!settings.vibe || !canVibe) return;
  const ua = navigator.userActivation; if (ua && !ua.hasBeenActive) return;   // browsers block it before the first tap
  let p = name === 'clear' ? [18 + Math.min(n, 5) * 8] : VIBE[name];
  if (!p) return;
  try { navigator.vibrate(p); } catch (e) {}
}
function sfx(name, n = 1) {
  buzz(name, n);
  if (!settings.vol || !actx || actx.state !== 'running') return;
  try {
    switch (name) {
      case 'move': tone(520, .03, 'square', .05); break;
      case 'rotate': tone(760, .045, 'triangle', .12); break;
      case 'hold': tone(440, .07, 'triangle', .12, 0, 660); break;
      case 'drop': tone(200, .12, 'sine', .3, 0, 70); break;
      case 'lock': tone(180, .06, 'triangle', .15); break;
      case 'place': tone(330, .07, 'triangle', .18, 0, 420); break;
      case 'clear': for (let i = 0; i < Math.min(n + 1, 6); i++) tone(ARP[i], .12, 'square', .1, i * .055); break;
      case 'over': tone(392, .18, 'triangle', .2); tone(294, .18, 'triangle', .2, .18); tone(196, .4, 'triangle', .22, .36); break;
      case 'paddle': tone(300, .05, 'square', .12); break;
      case 'brick': tone(620 + Math.random() * 80, .05, 'square', .09); break;
      case 'wall': tone(140, .04, 'triangle', .12); break;
      case 'item': tone(500, .18, 'sine', .2, 0, 1000); break;
      case 'lose': tone(330, .3, 'sawtooth', .1, 0, 110); break;
      case 'stage': ARP.slice(0, 4).forEach((f, i) => tone(f, .14, 'square', .1, i * .08)); break;
      case 'stack': tone(220 * Math.pow(2, (n % 12) / 12), .08, 'triangle', .2); break;
      case 'perfect': tone(880, .08, 'sine', .2); tone(1320, .16, 'sine', .2, .06); break;
      case 'test': tone(660, .1, 'triangle', .25); tone(880, .12, 'triangle', .22, .09); break;
    }
  } catch (e) {}
}

// settings dialog
const sheet = $('settings');
let sheetOpener = null;
function syncSettingsUI() {
  for (const r of document.querySelectorAll('input[name="skin"]')) r.checked = r.value === settings.skin;
  $('volRange').value = settings.vol; $('volVal').textContent = settings.vol;
  for (const r of document.querySelectorAll('input[name="vibe"]')) { r.checked = (r.value === 'on') === (settings.vibe && canVibe); r.disabled = !canVibe; }
  for (const r of document.querySelectorAll('input[name="marks"]')) r.checked = (r.value === 'on') === !!settings.marks;
  if (!canVibe) $('vibeNote').textContent = '이 기기나 브라우저는 진동을 지원하지 않아요.';
}
function openSettings(btn) {
  if (current === 'fall' && S.mode === 'play') togglePause();
  if (current === 'brk' && B.mode === 'play') brkPause();
  if (current === 'stk') stkPause();
  sheetOpener = btn || null;
  syncSettingsUI(); sheet.hidden = false;
  const on = document.querySelector('input[name="skin"]:checked'); if (on) on.focus();
}
function closeSettings() { sheet.hidden = true; if (sheetOpener) sheetOpener.focus(); }
document.querySelectorAll('[data-settings]').forEach(b => b.addEventListener('click', () => openSettings(b)));
$('closeSettings').addEventListener('click', closeSettings);
sheet.addEventListener('pointerdown', e => { if (e.target === sheet) closeSettings(); });
for (const r of document.querySelectorAll('input[name="skin"]')) r.addEventListener('change', () => {
  if (!r.checked) return; settings.skin = r.value; saveSettings(); applySkin();
});
for (const r of document.querySelectorAll('input[name="marks"]')) r.addEventListener('change', () => {
  if (!r.checked) return; settings.marks = MARKS = r.value === 'on'; saveSettings(); refreshTheme();
});
for (const r of document.querySelectorAll('input[name="vibe"]')) r.addEventListener('change', () => {
  if (!r.checked) return; settings.vibe = r.value === 'on'; saveSettings();
  if (settings.vibe) buzz('perfect');
});
$('volRange').addEventListener('input', e => {
  settings.vol = +e.target.value; $('volVal').textContent = settings.vol; setVol(); saveSettings();
});
$('volRange').addEventListener('change', () => { ensureAudio(); setTimeout(() => sfx('test'), 30); });
// while the dialog is open, keys go to the dialog only (games never see them)
addEventListener('keydown', e => {
  if (sheet.hidden) return;
  if (e.key === 'Escape') { e.preventDefault(); closeSettings(); }
  e.stopImmediatePropagation();
}, true);
applySkin();

// update notice: the installed app (site/index.html) calls this when a new version has been downloaded
window.brickUpdateReady = () => { $('updToast').hidden = false; };
$('updBtn').addEventListener('click', () => location.reload());
$('updLater').addEventListener('click', () => { $('updToast').hidden = true; });

