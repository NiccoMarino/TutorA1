// Prova su tante misure di schermo, senza telefono: apre la pagina in Chrome senza finestra con la misura di vari
// telefoni e tablet (tools/schermi-casi.mjs), in verticale e in orizzontale, con il testo normale e ingrandito,
// guarda avviso, home, menù, pagine e la guida in cinque momenti e scrive un resoconto con le schermate.
// Uso: npm run schermi   (scrive in device-check/schermi/, aperto da npm run serve su /device-check/schermi/)
// Limiti: è Chrome del computer, non la WebView del telefono; il riquadro sopra le altre app si prova con device-check.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AKEY, DISCLAIMER_VERSION } from '../src/core/store.js';
import { pageAudit, plateForm, showScreen } from './device-page.mjs';
import { cases, judge, scaledFontSize } from './schermi-casi.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = ROOT + 'device-check/schermi/';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
                'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const PORT = 5198, DEBUG = 9338;
const PAGES = ['menu', 'pSettings', 'pSim', 'pHist', 'pHow', 'pInfo'];
const SETTINGS = {limit:130, margin:2, preAlert:1, voice:false, beep:false, instWarn:true, theme:'auto'};
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitFor(fn, what, ms = 15000){
  const end = Date.now() + ms;
  while (Date.now() < end){ try { const v = await fn(); if (v) return v; } catch(e){} await sleep(100); }
  throw new Error('Tempo scaduto: ' + what);
}
function cdp(wsUrl){
  const ws = new WebSocket(wsUrl);
  let id = 0; const wait = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && wait.has(m.id)){ wait.get(m.id)(m); wait.delete(m.id); } };
  const send = (method, params = {}) => new Promise((ok, ko) => {
    const n = ++id; wait.set(n, m => m.error ? ko(new Error(method + ': ' + m.error.message)) : ok(m.result));
    ws.send(JSON.stringify({id: n, method, params}));
  });
  return {ready: new Promise(ok => { ws.onopen = ok; }), send, close: () => ws.close()};
}

// Nella pagina: GPS finto che riceve i punti di un percorso (test/fixtures/scenarios.json) fino a una condizione
const SETUP = `(() => {
  let deliver = null;
  Object.defineProperty(navigator, 'geolocation', {configurable: true, value: {
    watchPosition(ok){ deliver = ok; return 1; }, clearWatch(){}, getCurrentPosition(){} }});
  Object.defineProperty(navigator, 'vibrate', {configurable: true, value: () => true});
  window.__feed = (fixes, from, until, extra) => {
    const el = id => document.getElementById(id);
    let hit = -1;
    for (let i = from; i < fixes.length; i++){
      const f = fixes[i];
      deliver({coords: {latitude: f.lat, longitude: f.lon, accuracy: f.accuracy, speed: f.speed, heading: f.heading}, timestamp: Date.now() - (fixes.length - i)*1000});
      if (hit < 0 && new Function('el', 'return ' + until)(el)) hit = i;
      if (hit >= 0 && i >= hit + extra) return i + 1;
    }
    return -1;
  };
  return true;
})()`;
// Nella pagina: testo ingrandito come fa Android, moltiplicando ogni font-size degli stili
const zoomText = zoom => `(() => {
  const scaled = ${scaledFontSize.toString()};
  const walk = rules => { for (const r of rules){ if (r.cssRules) walk(r.cssRules);
    if (r.style && r.style.fontSize){ const v = scaled(r.style.fontSize, ${zoom}); if (v) r.style.fontSize = v; } } };
  for (const s of document.styleSheets) walk(s.cssRules);
  return true;
})()`;

// Momenti della guida, sul percorso della A1 molto veloce (prossimo Tutor, tratto, allarme, fine con sanzione)
const MOMENTS = [
  ['attesa', null],
  ['prossimo-tutor', ["/Prossimo Tutor/.test(el('pKicker').textContent)", 5]],
  ['tratto-in-corso', ["/^Tutor in corso/.test(el('pKicker').textContent)", 5]],
  ['allarme', ["el('plate').className.includes('alarm')", 10]],
  ['fine-tratto', ["el('plate').className.includes('done')", 2]]
];

async function main(){
  if (!CHROME) throw new Error('Serve Chrome o Edge installato');
  rmSync(OUT, {recursive: true, force: true});
  mkdirSync(OUT, {recursive: true});
  const server = spawn(process.execPath, ['tools/serve.mjs'], {cwd: ROOT, env: {...process.env, PORT: String(PORT)}, stdio: 'ignore'});
  const profile = join(tmpdir(), 'schermi-profile');
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=' + DEBUG,
    '--user-data-dir=' + profile, '--no-first-run', 'about:blank'], {stdio: 'ignore'});
  const t0 = Date.now(), report = [];
  try {
    const target = await waitFor(async () => (await (await fetch('http://127.0.0.1:' + DEBUG + '/json/list')).json()).find(t => t.type === 'page'), 'avvio di Chrome');
    const c = cdp(target.webSocketDebuggerUrl);
    await c.ready;
    const ev = async expr => {
      const r = await c.send('Runtime.evaluate', {expression: expr, returnByValue: true, awaitPromise: true});
      if (r.exceptionDetails) throw new Error('Errore nella pagina: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
      return r.result.value;
    };
    const call = (fn, ...args) => ev('(' + fn.toString() + ')(...' + JSON.stringify(args) + ')');
    const scenarios = await (await waitFor(() => fetch('http://localhost:' + PORT + '/test/fixtures/scenarios.json'), 'server')).json();
    const fixes = scenarios.find(s => s.name === 'a1-sud-molto-veloce-con-galleria').fixes;

    // Pagina appena aperta: avviso da accettare oppure no, testo ingrandito se serve, GPS finto
    async function open(c0, accepted){
      await c.send('Page.navigate', {url: 'http://localhost:' + PORT + '/index.html'});
      await waitFor(() => ev('!!window.__tutor'), 'pagina');
      await ev(`localStorage.setItem('tutorA1.v1.settings', ${JSON.stringify(JSON.stringify(SETTINGS))}); localStorage.removeItem('tutorA1.v1.history');
        ${accepted ? `localStorage.setItem('${AKEY}', '${DISCLAIMER_VERSION}')` : `localStorage.removeItem('${AKEY}')`}; true`);
      await c.send('Page.reload');
      await waitFor(() => ev('!!window.__tutor && document.readyState === "complete"'), 'pagina ricaricata');
      await ev(zoomText(c0.zoom));
      await ev('document.fonts.ready.then(() => true)');
      await ev(SETUP);
    }
    async function shot(file){
      await sleep(60);
      const {data} = await c.send('Page.captureScreenshot', {format: 'jpeg', quality: 70});
      writeFileSync(OUT + file, Buffer.from(data, 'base64'));
      return file;
    }

    for (const c0 of cases()){
      await c.send('Emulation.setDeviceMetricsOverride', {width: c0.w, height: c0.h, deviceScaleFactor: 2, mobile: true,
        screenOrientation: {type: c0.orientation === 'verticale' ? 'portraitPrimary' : 'landscapePrimary', angle: c0.orientation === 'verticale' ? 0 : 90}});
      const row = {...c0, results: []};
      const add = async (what, kind, m, always) => {
        const r = judge(kind, m);
        row.results.push({what, ...r, shot: always || r.problems.length ? await shot(c0.id + '-' + what + '.jpg') : null});
      };

      // Fuori dalla guida: avviso, home, menù e pagine
      await open(c0, false);
      await add('avviso', 'pagina', {audit: await call(pageAudit)}, true);
      await ev(`document.getElementById('avvisoOk').click(); true`);
      await add('home', 'pagina', {audit: await call(pageAudit)}, true);
      for (const id of PAGES){
        await call(showScreen, id);
        await add(id, 'pagina', {audit: await call(pageAudit)});
      }

      // Guida col GPS (finto): cinque momenti del percorso
      await open(c0, true);
      await ev(`document.getElementById('btnDrive').click(); true`);
      let next = 0;
      for (const [what, until] of MOMENTS){
        if (until){
          next = await ev(`__feed(${JSON.stringify(fixes)}, ${next}, ${JSON.stringify(until[0])}, ${until[1]})`);
          if (next < 0) throw new Error(c0.id + ': momento mai raggiunto, ' + what);
        }
        await sleep(450); // transizioni dei colori e dell'arco
        const plate = {...await call(plateForm), ...await ev(`(() => { scrollTo(0, 300); const h = document.querySelector('.hud'); const r = {scroll: h.scrollHeight, view: h.clientHeight, y: Math.round(scrollY)}; scrollTo(0, 0); return r; })()`)};
        await add('guida-' + what, plate.form === 'orizzontale' ? 'guida-orizzontale' : 'guida-verticale', {audit: await call(pageAudit), plate},
          what === 'allarme');
      }
      await ev(`document.getElementById('hudExit').click(); true`);

      const p = row.results.reduce((n, r) => n + r.problems.length, 0), n = row.results.reduce((k, r) => k + r.notes.length, 0);
      console.log((p ? 'PROBLEMI' : 'OK      ') + '  ' + c0.orientation.padEnd(11) + ' testo ' + String(Math.round(c0.zoom*100)).padStart(3) + '%  '
        + (c0.w + '×' + c0.h).padEnd(10) + c0.size.name + (p ? '  (' + p + ' problemi)' : '') + (n ? '  ' + n + ' note' : ''));
      report.push(row);
    }
    c.close();
  } finally {
    chrome.kill(); server.kill();
    await sleep(500);
    try { rmSync(profile, {recursive: true, force: true}); } catch(e){}
  }
  writeFileSync(OUT + 'risultati.json', JSON.stringify(report, null, 1));
  writeFileSync(OUT + 'index.html', html(report));
  const bad = report.filter(r => r.results.some(x => x.problems.length));
  console.log('\n' + (bad.length ? bad.length + ' casi con problemi' : 'Nessun problema') + ' su ' + report.length + ', in ' + Math.round((Date.now() - t0)/1000) + ' s');
  console.log('Resoconto: device-check/schermi/index.html (npm run serve, poi http://localhost:5173/device-check/schermi/)');
}

const esc = t => String(t).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
function html(report){
  const groups = [...new Set(report.map(r => r.orientation + ', testo al ' + Math.round(r.zoom*100) + '%'))];
  const card = r => {
    const probs = r.results.filter(x => x.problems.length), notes = r.results.filter(x => x.notes.length);
    const shots = r.results.filter(x => x.shot).map(x => '<figure><img loading="lazy" src="' + esc(x.shot) + '" alt="' + esc(x.what) + '"><figcaption>' + esc(x.what) + '</figcaption></figure>').join('');
    const list = (xs, key) => xs.map(x => '<li><b>' + esc(x.what) + '</b>: ' + esc(x[key].join(' · ')) + '</li>').join('');
    return '<section class="card' + (probs.length ? ' bad' : '') + '"><h3>' + esc(r.size.name) + ' <small>' + r.w + '×' + r.h + '</small></h3>'
      + (probs.length ? '<ul class="p">' + list(probs, 'problems') + '</ul>' : '<p class="ok">Nessun problema</p>')
      + (notes.length ? '<details><summary>' + notes.length + ' note</summary><ul>' + list(notes, 'notes') + '</ul></details>' : '')
      + '<div class="shots">' + shots + '</div></section>';
  };
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Prova su più schermi</title><style>
:root{color-scheme:light dark; --bg:#EDF1EF; --panel:#fff; --ink:#13201A; --muted:#55655E; --bad:#C62828; --ok:#00794C}
@media (prefers-color-scheme: dark){:root{--bg:#0E1412; --panel:#151D1A; --ink:#E6EEEA; --muted:#9BAAA3; --bad:#FF7A70; --ok:#3DC48A}}
body{margin:0; padding:16px; background:var(--bg); color:var(--ink); font:15px/1.45 system-ui,sans-serif}
h1{margin:0 0 4px; font-size:22px} h2{margin:28px 0 10px; font-size:18px} .muted{color:var(--muted); margin:0}
.grid{display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,420px),1fr)); gap:12px}
.card{background:var(--panel); border-radius:12px; padding:12px 14px; border:2px solid transparent; min-width:0}
.card.bad{border-color:var(--bad)} .card h3{margin:0 0 6px; font-size:15px} .card small{color:var(--muted); font-weight:500}
.ok{color:var(--ok); margin:0; font-weight:600} ul{margin:4px 0; padding-left:18px; font-size:13px} .p{color:var(--bad)}
details{font-size:13px; color:var(--muted)} .shots{display:flex; gap:8px; overflow-x:auto; margin-top:8px}
figure{margin:0; flex:none} figure img{height:260px; border-radius:6px; display:block} figcaption{font-size:12px; color:var(--muted)}
</style></head><body><h1>Prova su più schermi</h1>
<p class="muted">${report.length} casi: ogni misura in verticale e in orizzontale, con il testo normale e ingrandito al 130% come nelle Impostazioni di Android.
Le schermate sono avviso, home e guida in allarme, più quelle con un problema. Chrome del computer, non la WebView del telefono.</p>
${groups.map(g => '<h2>' + esc(g[0].toUpperCase() + g.slice(1)) + '</h2><div class="grid">'
    + report.filter(r => r.orientation + ', testo al ' + Math.round(r.zoom*100) + '%' === g).map(card).join('') + '</div>').join('\n')}
</body></html>`;
}

main().catch(e => { console.error(e.message); process.exit(1); });
