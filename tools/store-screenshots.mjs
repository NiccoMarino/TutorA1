// Schermate per il Play Store (1080×1920): apre la pagina in Chrome senza finestra con la misura di un telefono,
// le passa i percorsi GPS di test/fixtures/scenarios.json come se arrivassero dal GPS e fotografa i momenti scelti.
// Uso: npm run build && node tools/store-screenshots.mjs   (scrive in docs/play-store/grafica/)
// Con --orizzontale fotografa anche la guida in orizzontale, in device-check/ (solo per controllo).
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = ROOT + 'docs/play-store/grafica/';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
                'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const PORT = 5199, DEBUG = 9339;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitFor(fn, what, ms = 15000){
  const end = Date.now() + ms;
  while (Date.now() < end){ try { const v = await fn(); if (v) return v; } catch(e){} await sleep(250); }
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
  const ready = new Promise(ok => { ws.onopen = ok; });
  return {ready, send, close: () => ws.close()};
}

// Codice eseguito nella pagina: GPS finto e funzione che consegna le posizioni di un percorso fino a una condizione
const SETUP = `(() => {
  let deliver = null;
  Object.defineProperty(navigator, 'geolocation', {configurable: true, value: {
    watchPosition(ok){ deliver = ok; return 1; }, clearWatch(){}, getCurrentPosition(){} }});
  Object.defineProperty(navigator, 'vibrate', {configurable: true, value: () => true});
  window.__feed = (fixes, from, until, extra) => {
    const el = id => document.getElementById(id);
    let i = from, hit = -1;
    for (; i < fixes.length; i++){
      const f = fixes[i];
      deliver({coords: {latitude: f.lat, longitude: f.lon, accuracy: f.accuracy, speed: f.speed, heading: f.heading}, timestamp: Date.now() - (fixes.length - i)*1000});
      if (hit < 0 && new Function('el', 'return ' + until)(el)) hit = i;
      if (hit >= 0 && i >= hit + extra) return i + 1;
    }
    return -1;
  };
  return true;
})()`;

async function main(){
  if (!CHROME) throw new Error('Serve Chrome o Edge installato');
  mkdirSync(OUT, {recursive: true});
  const server = spawn(process.execPath, ['tools/serve.mjs'], {cwd: ROOT, env: {...process.env, PORT: String(PORT)}, stdio: 'ignore'});
  const profile = join(tmpdir(), 'store-shots-profile');
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=' + DEBUG,
    '--user-data-dir=' + profile, '--no-first-run', 'about:blank'], {stdio: 'ignore'});
  try {
    const target = await waitFor(async () => {
      const list = await (await fetch('http://127.0.0.1:' + DEBUG + '/json/list')).json();
      return list.find(t => t.type === 'page');
    }, 'avvio di Chrome');
    const c = cdp(target.webSocketDebuggerUrl);
    await c.ready;
    const ev = async expr => (await c.send('Runtime.evaluate', {expression: expr, returnByValue: true, awaitPromise: true})).result.value;
    await c.send('Emulation.setDeviceMetricsOverride', {width: 360, height: 640, deviceScaleFactor: 3, mobile: true});
    await c.send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: 'light'}]});
    const scenarios = await (await waitFor(() => fetch('http://localhost:' + PORT + '/test/fixtures/scenarios.json'), 'server')).json();
    const sc = name => scenarios.find(s => s.name === name).fixes;

    async function open(){
      await c.send('Page.navigate', {url: 'http://localhost:' + PORT + '/index.html'});
      await waitFor(() => ev('!!window.__tutor'), 'pagina');
      // Impostazioni come al primo avvio, ma senza voce (in Chrome senza finestra non serve)
      await ev(`localStorage.setItem('tutorA1.v1.settings', JSON.stringify({limit:130, margin:2, preAlert:1, voice:false, beep:false, instWarn:true})); localStorage.removeItem('tutorA1.v1.history'); true`);
      await c.send('Page.reload');
      await waitFor(() => ev('!!window.__tutor'), 'pagina ricaricata');
      await ev(SETUP);
    }
    async function shot(name, wait = 2500){
      await sleep(wait);
      const {data} = await c.send('Page.captureScreenshot', {format: 'png'});
      writeFileSync(OUT + name, Buffer.from(data, 'base64'));
      console.log('docs/play-store/grafica/' + name);
    }
    async function feed(fixes, until, extra = 0, from = 0){
      const next = await ev(`__feed(${JSON.stringify(fixes)}, ${from}, ${JSON.stringify(until)}, ${extra})`);
      if (next < 0) throw new Error('Condizione mai raggiunta: ' + until);
      return next;
    }

    // 1. Schermata iniziale con i due cartelli
    await open();
    await shot('schermata-1-home.png', 1500);

    // 2. In avvicinamento: "Prossimo Tutor" con la distanza dal portale
    await ev(`document.getElementById('btnDrive').click(); true`);
    const a = sc('a1-sud-tratti-consecutivi');
    let next = await feed(a, `/Prossimo Tutor/.test(el('pKicker').textContent)`, 20);
    await shot('schermata-2-prossimo-tutor.png');

    // 3. Dentro il tratto, media sotto la soglia
    next = await feed(a, `/^Tutor in corso/.test(el('pKicker').textContent)`, 240, next);
    await shot('schermata-3-tratto-in-corso.png');

    // 4. Media oltre la soglia: allarme
    await ev(`document.getElementById('hudExit').click(); true`);
    await open();
    await ev(`document.getElementById('btnDrive').click(); true`);
    await feed(sc('a1-sud-allarme-e-rientro'), `el('plate').className.includes('alarm')`, 15);
    await shot('schermata-4-allarme.png');

    // 5. Storico dopo alcuni tratti
    await ev(`document.getElementById('hudExit').click(); true`);
    await open();
    // Tre viaggi, ognuno con guida avviata e chiusa: il percorso intero, la condizione non serve
    for (const name of ['a1-sud-tratti-consecutivi', 'a1-sud-allarme-e-rientro', 'a4-ovest-due-tratti']){
      await ev(`document.getElementById('btnDrive').click(); true`);
      await feed(sc(name), `false`, 0).catch(() => {});
      await ev(`document.getElementById('hudExit').click(); true`);
    }
    await ev(`document.getElementById('btnMenu').click(); document.querySelector('[data-go="pHist"]').click(); true`);
    await shot('schermata-5-storico.png', 1500);

    // 6. Pagina Simulazione con l'elenco dei tratti e la scheda di uno aperta
    await open();
    await ev(`document.getElementById('btnSimOpen').click(); document.querySelector('.sec[data-id]').click();
      const d = document.querySelector('.tratti'); scrollTo(0, d.getBoundingClientRect().top + scrollY - 70); true`);
    await shot('schermata-6-tratti.png', 1500);

    // Solo per controllo (non per lo store): guida con il telefono in orizzontale
    if (process.argv.includes('--orizzontale')){
      await c.send('Emulation.setDeviceMetricsOverride', {width: 800, height: 360, deviceScaleFactor: 2, mobile: true});
      await ev(`document.getElementById('btnDrive').click(); true`);
      await feed(sc('a1-sud-allarme-e-rientro'), `el('plate').className.includes('alarm')`, 15);
      const {data} = await c.send('Page.captureScreenshot', {format: 'png'});
      mkdirSync(ROOT + 'device-check', {recursive: true});
      writeFileSync(ROOT + 'device-check/controllo-orizzontale.png', Buffer.from(data, 'base64'));
      console.log('device-check/controllo-orizzontale.png (solo controllo)');
    }
    c.close();
  } finally {
    chrome.kill(); server.kill();
    await sleep(500);
    try { rmSync(profile, {recursive: true, force: true}); } catch(e){}
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
