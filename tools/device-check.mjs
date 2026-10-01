// Collaudo sul telefono collegato via USB: uscita dall'app (Home, Indietro, X del riquadro),
// riquadro Picture-in-Picture sopra Google Maps durante la guida, schermo che resta acceso.
// Usa la copia di prova "Tutor prova" (it.niccomarino.tutora1a4.prova): l'app normale non viene toccata.
// Non cambia impostazioni del telefono. Uso: node tools/device-check.mjs [--gps] [--out cartella]
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const PKG = 'it.niccomarino.tutora1a4.prova';
const ACT = PKG + '/it.niccomarino.tutora1a4.MainActivity';
const MAPS = 'com.google.android.apps.maps/com.google.android.maps.MapsActivity';
const ADB = process.env.ADB || join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe');
const argv = process.argv.slice(2);
const withGps = argv.includes('--gps');
const outDir = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'device-check';
const PORT = 9333;
const TEST_SETTINGS = {limit:130, margin:2, preAlert:1, voice:false, beep:false, instWarn:true};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const adb = (...a) => execFileSync(ADB, a, {encoding: 'utf8'}).trim();
const results = [];
function check(name, ok, detail = ''){
  results.push({name, ok: !!ok, detail});
  console.log((ok ? 'OK      ' : 'ERRORE  ') + name + (detail ? '  [' + detail + ']' : ''));
}
function note(name, detail){
  results.push({name, ok: null, detail});
  console.log('NOTA    ' + name + '  [' + detail + ']');
}
function screenshot(name){
  writeFileSync(join(outDir, name), execFileSync(ADB, ['exec-out', 'screencap', '-p'], {maxBuffer: 64 << 20}));
}

/* ---------- stato della finestra Android ---------- */
function task(){
  const lines = adb('shell', 'dumpsys', 'activity', 'activities').split('\n');
  const i = lines.findIndex(l => l.includes('* Task{') && l.includes(':' + PKG + ' '));
  if (i < 0) return {mode: 'nessuno', visible: false, bounds: null, keepScreenOn: false};
  // le righe del task fino al primo "* Hist" (la prima attività)
  const block = [];
  for (let k = i + 1; k < Math.min(lines.length, i + 20) && !lines[k].includes('* Hist'); k++) block.push(lines[k]);
  let bounds = null;
  for (const l of block){
    // a schermo intero o in multi-finestra "bounds=[l,t][r,b]", nel riquadro "mBounds=Rect(l, t - r, b)"
    const m = l.match(/bounds=\[(\d+),(\d+)\]\[(\d+),(\d+)\]/) || l.match(/mBounds=Rect\((\d+), (\d+) - (\d+), (\d+)\)/);
    if (m){ bounds = m.slice(1).map(Number); break; }
  }
  return {mode: (lines[i].match(/mode=([\w-]+)/) || [])[1], visible: /visible=true/.test(lines[i]), bounds,
          keepScreenOn: block.some(l => l.includes('mKeepScreenOn=true'))};
}
async function waitTask(pred, ms = 6000){
  const t0 = Date.now(); let t = task();
  while (!pred(t) && Date.now() - t0 < ms){ await sleep(400); t = task(); }
  return t;
}
// La finestra chiede di tenere acceso lo schermo (FLAG_KEEP_SCREEN_ON, messo da KeepAwake)
const keepsScreenOn = () => task().keepScreenOn;
const gpsServiceOn = () => /isForeground=true/.test(adb('shell', 'dumpsys', 'activity', 'services', PKG));
function screenSize(){ const m = adb('shell', 'wm', 'size').match(/(\d+)x(\d+)/); return m ? [+m[1], +m[2]] : [1080, 2340]; }

/* ---------- pagina, tramite DevTools della WebView ---------- */
let ws = null, msgId = 0;
const pending = new Map();
async function connect(){
  try { if (ws) ws.close(); } catch(e){}
  ws = null;
  for (let i = 0; i < 30 && !ws; i++){
    try {
      const pid = adb('shell', 'pidof', PKG).split(/\s+/)[0];
      if (pid){
        try { adb('forward', '--remove', 'tcp:' + PORT); } catch(e){}
        adb('forward', 'tcp:' + PORT, 'localabstract:webview_devtools_remote_' + pid);
        const list = await (await fetch('http://127.0.0.1:' + PORT + '/json')).json();
        const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
        if (page){
          const sock = new WebSocket(page.webSocketDebuggerUrl);
          await new Promise((ok, ko) => { sock.onopen = ok; sock.onerror = ko; });
          sock.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)){ pending.get(m.id)(m); pending.delete(m.id); } };
          ws = sock;
        }
      }
    } catch(e){}
    if (!ws) await sleep(500);
  }
  if (!ws) throw new Error('DevTools della WebView non raggiungibili');
}
async function js(expr){
  const id = ++msgId;
  const reply = new Promise((ok, ko) => { pending.set(id, ok); setTimeout(() => ko(new Error('Nessuna risposta dalla pagina')), 10000); });
  ws.send(JSON.stringify({id, method: 'Runtime.evaluate', params: {expression: expr, returnByValue: true, awaitPromise: true}}));
  const m = await reply;
  if (m.result.exceptionDetails) throw new Error('Errore nella pagina: ' + JSON.stringify(m.result.exceptionDetails).slice(0, 300));
  return m.result.result.value;
}
async function waitFor(expr, ms = 8000){
  const t0 = Date.now();
  while (Date.now() - t0 < ms){ try { if (await js(expr)) return true; } catch(e){} await sleep(300); }
  return false;
}
const pageState = () => js(`(() => { const t = window.__tutor, f = t.st.fix; return {
  running: t.st.running, driving: document.body.classList.contains('driving'),
  pip: document.documentElement.classList.contains('pip'), fixT: f ? f.t : null,
  kicker: document.getElementById('pKicker').textContent, title: document.getElementById('pTitle').textContent,
  w: innerWidth, h: innerHeight, scale: window.visualViewport ? visualViewport.scale : 1, origin: performance.timeOrigin}; })()`);
const pipLayout = () => js(`(() => {
  const el = id => document.getElementById(id);
  const vis = sel => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== 'none' && r.width > 0 && r.height > 0; };
  const inside = (r, b) => r.left >= b.left - 1 && r.right <= b.right + 1 && r.top >= b.top - 1 && r.bottom <= b.bottom + 1;
  const vp = {left: 0, top: 0, right: innerWidth, bottom: innerHeight};
  return {
    visible: ['.mapwrap', '.side', '.hud-top', '.stats', '.advice', '.hud-limits', '.simbar', '.toast'].filter(vis),
    plateInside: inside(el('plate').getBoundingClientRect(), vp),
    bigInside: inside(el('pBig').getBoundingClientRect(), document.querySelector('.plate-in').getBoundingClientRect()),
    titleCut: el('pTitle').scrollWidth > el('pTitle').clientWidth + 1
  }; })()`);

async function launch(){
  adb('shell', 'am', 'start', '-W', '-n', ACT);
  await sleep(1000);
  await connect();
  if (!await waitFor('!!window.__tutor', 15000)) throw new Error('La pagina non si è avviata');
}
async function startSim(){
  await js(`(() => { document.getElementById('simSec').value = '12'; document.getElementById('simV').value = '125';
    document.getElementById('btnSimStart').click(); document.querySelector('#simWarp [data-w="5"]').click(); return true; })()`);
  return waitFor('window.__tutor.st.running && document.body.classList.contains("driving")');
}
// Tocca il riquadro per mostrare i comandi e preme la X; se non si chiude, trascina il riquadro sulla chiusura in basso
async function closePip(){
  // durante l'animazione di apertura la posizione del riquadro può mancare ancora
  const t = await waitTask(t => t.mode === 'pinned' && t.bounds);
  if (t.mode !== 'pinned' || !t.bounds) return 'nessun riquadro';
  await sleep(1500);   // il riquadro appena aperto ignora i tocchi finché non si è assestato
  const [l, tp, r, b] = task().bounds || t.bounds, cx = (l + r) >> 1, cy = (tp + b) >> 1;
  adb('shell', 'input', 'tap', String(cx), String(cy));
  await sleep(600);
  // Il menu del riquadro è di sistema e uiautomator non lo vede: su One UI la X è l'ultima icona in alto a destra
  // (misurata dallo screenshot del menu: 85% della larghezza, 21% dell'altezza)
  adb('shell', 'input', 'tap', String(Math.round(l + 0.852*(r - l))), String(Math.round(tp + 0.21*(b - tp))));
  if ((await waitTask(t => t.mode !== 'pinned', 3000)).mode !== 'pinned') return 'pulsante X';
  const [sw, sh] = screenSize();
  adb('shell', 'input', 'swipe', String(cx), String(cy), String(sw >> 1), String(Math.round(sh*0.96)), '1200');
  return 'trascinamento sulla chiusura';
}
export { adb, task, waitTask, connect, js, waitFor, pageState, launch, startSim, keepsScreenOn, sleep };
const home = () => adb('shell', 'input', 'keyevent', 'KEYCODE_HOME');
const back = () => adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');

async function main(){
  mkdirSync(outDir, {recursive: true});
  if (!adb('devices').split('\n').slice(1).some(l => /\tdevice$/.test(l))) throw new Error('Nessun telefono collegato');
  if (!adb('shell', 'pm', 'list', 'packages', PKG).split('\n').includes('package:' + PKG)) throw new Error('Copia di prova non installata: ./gradlew installDebug -Pprova=true');
  for (const p of ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'POST_NOTIFICATIONS']){ try { adb('shell', 'pm', 'grant', PKG, 'android.permission.' + p); } catch(e){} }
  adb('shell', 'am', 'force-stop', PKG);
  await launch();
  await js(`localStorage.setItem('tutorA1.v1.settings', ${JSON.stringify(JSON.stringify(TEST_SETTINGS))}); location.reload(); true`);
  await sleep(1500);
  await connect();
  await waitFor('!!window.__tutor', 15000);
  const full = await pageState();

  // A. Fuori dalla guida l'app si comporta come una app qualsiasi
  home();
  let t = await waitTask(t => !t.visible);
  check('Fuori dalla guida, Home: app in secondo piano, senza riquadro', !t.visible && t.mode !== 'pinned', 'mode=' + t.mode);
  await launch();
  back();
  t = await waitTask(t => !t.visible);
  check('Fuori dalla guida, Indietro: l\'app si chiude', !t.visible && t.mode !== 'pinned', 'mode=' + t.mode);
  await launch();

  // B. In guida (simulazione) l'uscita apre il riquadro
  check('Simulazione avviata', await startSim());
  await sleep(3000);
  home();
  t = await waitTask(t => t.mode === 'pinned');
  check('In guida, Home: si apre il riquadro', t.mode === 'pinned', 'mode=' + t.mode + ', ' + JSON.stringify(t.bounds));
  await sleep(1500);
  const s1 = await pageState();
  check('La pagina sa di essere nel riquadro', s1.pip);
  note('Misura del riquadro in CSS px (per tools/pip-harness.mjs)', s1.w + 'x' + s1.h);
  screenshot('riquadro-home.png');
  await sleep(4000);
  const s2 = await pageState();
  check('Nel riquadro la guida continua e si aggiorna', s2.running && s2.fixT > s1.fixT, s1.fixT + ' -> ' + s2.fixT);
  const lay = await pipLayout();
  check('Nel riquadro resta solo il cartello', lay.visible.length === 0, lay.visible.join(', ') || 'nient\'altro visibile');
  check('Il cartello sta tutto nel riquadro', lay.plateInside && lay.bigInside);
  if (lay.titleCut) note('Titolo del cartello tagliato nel riquadro', s2.kicker + ': ' + s2.title);

  // Navigazione: Maps davanti, il riquadro resta sopra e lo schermo acceso
  adb('shell', 'am', 'start', '-W', '-n', MAPS);
  await sleep(3000);
  t = task();
  const s3 = await pageState();
  check('Con Maps aperto il riquadro resta visibile', t.mode === 'pinned' && t.visible && s3.running, 'mode=' + t.mode);
  screenshot('riquadro-sopra-maps.png');
  await sleep(4000);
  const s4 = await pageState();
  check('Sopra Maps il cartello continua ad aggiornarsi', s4.fixT > s3.fixT, s3.fixT + ' -> ' + s4.fixT);
  check('La finestra del riquadro tiene lo schermo acceso (KEEP_SCREEN_ON)', keepsScreenOn());
  const timeout = Number(adb('shell', 'settings', 'get', 'system', 'screen_off_timeout'));
  if (timeout > 0 && timeout <= 60000){
    await sleep(timeout + 10000);
    const awake = /mWakefulness=Awake/.test(adb('shell', 'dumpsys', 'power'));
    check('Passato il tempo di spegnimento (' + timeout/1000 + ' s) lo schermo è ancora acceso', awake);
    if (!awake) throw new Error('Schermo spento: sblocca il telefono e rilancia il collaudo');
  } else note('Prova del tempo di spegnimento saltata', 'lo schermo si spegne dopo ' + timeout/1000 + ' s');

  // Ritorno a schermo intero
  adb('shell', 'am', 'start', '-W', '-n', ACT);
  t = await waitTask(t => t.mode === 'fullscreen');
  await sleep(2000);
  const s5 = await pageState();
  check('Riaprendo l\'app torna a schermo intero', t.mode === 'fullscreen' && !s5.pip, 'mode=' + t.mode);
  check('A schermo intero larghezza e zoom come prima', s5.w === full.w && Math.abs(s5.scale - 1) < 0.02, s5.w + ' vs ' + full.w + ', scala ' + s5.scale);
  check('La guida è ancora in corso', s5.running && s5.driving);

  // Indietro in guida
  back();
  t = await waitTask(t => t.mode === 'pinned');
  check('In guida, Indietro: si apre il riquadro invece di chiudere', t.mode === 'pinned' && (await pageState()).running, 'mode=' + t.mode);

  // X del riquadro
  const how = await closePip();
  await sleep(2500);
  await launch();
  const s6 = await pageState();
  if (s6.origin !== s5.origin) note('Dopo la X la pagina è stata ricaricata', 'controllo della guida poco significativo');
  check('X sul riquadro: la guida finisce', !s6.running && !s6.driving, 'chiuso con ' + how);

  // C. Con il GPS vero: dopo la X il servizio della posizione non deve restare acceso
  if (withGps){
    await js(`document.getElementById('btnDrive').click(); true`);
    await waitFor('window.__tutor.st.running', 5000);
    await sleep(5000);
    check('Guida con GPS: servizio della posizione attivo', gpsServiceOn());
    home();
    t = await waitTask(t => t.mode === 'pinned');
    check('Guida con GPS, Home: riquadro aperto e servizio ancora attivo', t.mode === 'pinned' && gpsServiceOn(), 'mode=' + t.mode);
    const how2 = await closePip();
    await sleep(3000);
    check('X sul riquadro: il servizio della posizione si ferma', !gpsServiceOn(), 'chiuso con ' + how2);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(e => check('Collaudo interrotto', false, e.message)).finally(() => {
  try { adb('shell', 'am', 'force-stop', PKG); } catch(e){}
  try { adb('forward', '--remove', 'tcp:' + PORT); } catch(e){}
  try { if (ws) ws.close(); } catch(e){}
  try { adb('shell', 'input', 'keyevent', 'KEYCODE_HOME'); } catch(e){}
  writeFileSync(join(outDir, 'risultati.json'), JSON.stringify(results, null, 1));
  const bad = results.filter(r => r.ok === false).length;
  console.log(bad ? bad + ' controlli non superati' : 'Tutti i controlli superati');
  process.exit(bad ? 1 : 0);
});
