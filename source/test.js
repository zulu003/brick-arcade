// Automated checks for Brick Arcade. No packages needed: Node 22+ and Chrome or Edge.
//   node source/test.js            build, then run every test
//   node source/test.js pop        run only tests whose name contains "pop"
// It builds the offline page, adds a test hook (window.__t evaluates code inside the game's scope),
// serves it on localhost, opens it in headless Chrome, and runs each test in a fresh page with empty storage.
// Set CHROME=path\to\chrome.exe if Chrome/Edge is installed somewhere unusual.
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const { spawn, execFileSync } = require('child_process');
const TESTS = require('./tests.js');
const root = path.join(__dirname, '..');
const only = process.argv[2] || '';

const CANDIDATES = [process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  execFileSync(process.execPath, [path.join(__dirname, 'build.js')], { stdio: 'inherit' });
  const page = fs.readFileSync(path.join(root, 'brick-arcade.html'), 'utf8');
  const at = page.lastIndexOf('})();');
  if (at < 0) throw new Error('could not find the end of the game script');
  const testPage = page.slice(0, at) + 'window.__t = c => eval(c);\n' + page.slice(at);

  const server = http.createServer((req, res) => {
    if (req.url.split('?')[0] === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(testPage); }
    else { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/`;

  const chrome = CANDIDATES.find(p => p && fs.existsSync(p));
  if (!chrome) throw new Error('Chrome or Edge not found; set CHROME to its path');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'brick-test-'));
  const proc = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--mute-audio',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1000,900', 'about:blank'], { stdio: 'ignore' });
  let cdp;
  try {
    let port = null;
    for (let i = 0; i < 100 && !port; i++) {
      try { port = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch (e) { await sleep(100); }
    }
    if (!port) throw new Error('Chrome did not start');
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const target = targets.find(t => t.type === 'page');
    cdp = await connect(target.webSocketDebuggerUrl);
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');

    const errors = [];
    cdp.on('Runtime.exceptionThrown', p => errors.push(p.exceptionDetails.exception ? p.exceptionDetails.exception.description : p.exceptionDetails.text));
    cdp.on('Runtime.consoleAPICalled', p => { if (p.type === 'error') errors.push(p.args.map(a => a.value || a.description).join(' ')); });

    const open = async () => {
      const loaded = cdp.once('Page.loadEventFired');
      await cdp.send('Page.navigate', { url: url + '?r=' + Math.random() });
      await loaded; await sleep(50);
    };
    const run = async code => {
      const r = await cdp.send('Runtime.evaluate', { expression: `(async () => { ${PRELUDE}\n${code}\n})()`, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text);
      return r.result.value;
    };

    let pass = 0, fail = 0;
    const list = TESTS.filter(t => t.name.includes(only));
    for (const t of list) {
      errors.length = 0;
      const t0 = Date.now();
      try {
        await open();
        await run(`localStorage.clear(); localStorage.setItem('brick-intro-seen', JSON.stringify(['fall','pack','brk','stk','pop','sld']));`);
        await open();
        const note = await run(t.code);
        if (errors.length) throw new Error('page error: ' + errors.join(' | '));
        pass++; console.log(`  ok   ${t.name}${note ? '  — ' + note : ''}  (${Date.now() - t0}ms)`);
      } catch (e) {
        fail++; console.log(`  FAIL ${t.name}\n       ${String(e.message || e).split('\n').slice(0, 4).join('\n       ')}`);
      }
    }
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exitCode = fail ? 1 : 0;
  } finally {
    if (cdp) cdp.close();
    proc.kill();
    server.close();
    await sleep(300);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  }
}

// helpers available inside every test
const PRELUDE = `
const t = window.__t, $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const assert = (c, m) => { if (!c) throw new Error('assert: ' + m); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('assert: ' + m + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); };
const key = (code, k) => { window.dispatchEvent(new KeyboardEvent('keydown', { code, key: k || code, bubbles: true })); window.dispatchEvent(new KeyboardEvent('keyup', { code, key: k || code, bubbles: true })); };
const rnd = n => Math.floor(Math.random() * n);
`;

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0; const waiting = new Map(), handlers = {};
  ws.onmessage = m => {
    const msg = JSON.parse(m.data);
    if (msg.id && waiting.has(msg.id)) { const { ok, ko } = waiting.get(msg.id); waiting.delete(msg.id); msg.error ? ko(new Error(msg.error.message)) : ok(msg.result); }
    else if (msg.method) (handlers[msg.method] || []).slice().forEach(h => h(msg.params));
  };
  const api = {
    send: (method, params = {}) => new Promise((ok, ko) => { const i = ++id; waiting.set(i, { ok, ko }); ws.send(JSON.stringify({ id: i, method, params })); }),
    on: (ev, h) => { (handlers[ev] = handlers[ev] || []).push(h); },
    once: ev => new Promise(ok => { const h = p => { handlers[ev] = handlers[ev].filter(x => x !== h); ok(p); }; api.on(ev, h); }),
    close: () => ws.close(),
  };
  return new Promise((ok, ko) => { ws.onopen = () => ok(api); ws.onerror = ko; });
}

main().catch(e => { console.error(e); process.exitCode = 1; });
