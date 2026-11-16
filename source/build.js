// Build Brick Arcade from source/src/ (run from anywhere: node source/build.js).
//   node source/build.js          -> index.html (installable web app), brick-arcade.html (single offline file),
//                                    source/artifact.html (page body for the Claude artifact)
//   node source/build.js --bump   -> same, and bumps the service-worker cache version in sw.js
//                                    (do this for every release so installed apps pick up the change)
//
// Source layout:
//   src/page.html      page skeleton and markup; /*@css*/ and /*@js*/ mark where the pieces go
//   src/style.css      all styles
//   src/js/*.js        one file per game plus shared code, joined in file-name order
//                      inside a single (() => { ... })() so they share one scope
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), src = path.join(__dirname, 'src');
const read = f => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const write = (f, s) => fs.writeFileSync(path.join(root, f), s);

// 1) artifact page
const jsDir = path.join(src, 'js');
const js = fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).sort().map(f => read(path.join(jsDir, f))).join('');
const page = read(path.join(src, 'page.html'))
  .replace('/*@css*/\n', () => read(path.join(src, 'style.css')))
  .replace('/*@js*/\n', () => js);
write('source/artifact.html', page);

// 2) standalone offline file
const head = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#15131e">
<title>Brick Arcade</title>
<style>
/* standalone base: what the artifact viewer used to provide */
:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0;font-size:14px;overscroll-behavior:none}
[hidden]{display:none!important}
</style>
`;
let body = page.slice(page.indexOf('<style>')).replace('</style>', '</style>\n</head>\n<body>');
const standalone = head + body.trimEnd() + '\n</body>\n</html>\n';
write('brick-arcade.html', standalone);

// 3) PWA index
const headAdd = `<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Brick Arcade">
<title>Brick Arcade</title>`;
const swReg = `<script>
if ('serviceWorker' in navigator) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      // a new version finished installing while this page was open -> offer a reload
      const watch = w => w && w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) window.brickUpdateReady && window.brickUpdateReady();
      });
      watch(reg.installing);
      reg.addEventListener('updatefound', () => watch(reg.installing));
      // phones keep the app open for days: check again whenever it comes back to the front
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch(() => {});
  });
}
</script>
</body>`;
const pwa = standalone.replace('<title>Brick Arcade</title>', () => headAdd).replace('</body>', () => swReg);
write('index.html', pwa);

// 4) service worker cache version
const swPath = path.join(root, 'sw.js');
let sw = read(swPath);
if (process.argv.includes('--bump')) {
  sw = sw.replace(/brick-arcade-v(\d+)/, (_, n) => 'brick-arcade-v' + (+n + 1));
  fs.writeFileSync(swPath, sw);
}
console.log('built', (sw.match(/brick-arcade-v\d+/) || [''])[0]);
