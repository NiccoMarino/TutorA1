// Collaudo sul telefono collegato via USB, pensato per trovare più difetti possibile nel minor tempo.
// Usa la copia di prova "Tutor prova" (it.niccomarino.tutora1a4.prova): l'app normale non viene toccata.
// Non cambia impostazioni del telefono (solo quelle dell'app di prova).
//
// Fasi (ognuna va avanti anche se la precedente fallisce; gli errori JavaScript della pagina sono raccolti sempre):
//   pagina   versione installata, ogni schermata in tema chiaro e scuro (fuori schermo, contrasto, testi rotti),
//            elenco e filtri, impostazioni salvate, guida simulata in tutti i tratti a 125, 131, 137,5 e 200 km/h
//            nella WebView vera, storico. Solo JavaScript, niente gesti: un paio di minuti.
//   uscite   Home, Indietro, pulsante Riquadro, riquadro sopra Google Maps, ritorno a schermo intero, X del riquadro.
//   gps      (con --gps) GPS vero: il servizio della posizione si ferma chiudendo il riquadro.
// Uso: node tools/device-check.mjs [--solo pagina|uscite] [--gps] [--completo] [--out cartella]
//   --completo aspetta anche il tempo di spegnimento dello schermo (fino a un minuto in più).
// A ogni errore salva una schermata in <out>/errore-N.png; il riepilogo è in <out>/risultati.json.
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verdictOf } from '../src/core/rules.js';
import { pageFingerprint, pageAudit, showScreen, listCheck, driveSection } from './device-page.mjs';

const PKG = 'it.niccomarino.tutora1a4.prova';
const ACT = PKG + '/it.niccomarino.tutora1a4.MainActivity';
const MAPS = 'com.google.android.apps.maps/com.google.android.maps.MapsActivity';
const ADB = process.env.ADB || join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe');
const argv = process.argv.slice(2);
const arg = name => argv.includes(name) ? argv[argv.indexOf(name) + 1] : null;
const withGps = argv.includes('--gps'), complete = argv.includes('--completo');
const only = arg('--solo');
const outDir = arg('--out') || 'device-check';
const PORT = 9333;
const TEST_SETTINGS = {limit:130, margin:2, preAlert:1, voice:false, beep:false, instWarn:true, theme:'auto'};
// Velocità della guida simulata, a rotazione sui tratti: in regola, di poco sopra il limite,
// appena oltre la soglia di sanzione, di tanto
const SPEEDS = [125, 131, 137.5, 200];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const adb = (...a) => execFileSync(ADB, a, {encoding: 'utf8'}).trim();
const results = [];
let shots = 0;
function check(name, ok, detail = ''){
  results.push({name, ok: !!ok, detail});
  console.log((ok ? 'OK      ' : 'ERRORE  ') + name + (detail ? '  [' + detail + ']' : ''));
  if (!ok && shots < 10){ try { screenshot('errore-' + (++shots) + '.png'); console.log('        schermata: errore-' + shots + '.png'); } catch(e){} }
}
function note(name, detail){
  results.push({name, ok: null, detail});
  console.log('NOTA    ' + name + '  [' + detail + ']');
}
function screenshot(name){
  writeFileSync(join(outDir, name), execFileSync(ADB, ['exec-out', 'screencap', '-p'], {maxBuffer: 64 << 20}));
}
const list = (a, n = 6) => a.slice(0, n).join('; ') + (a.length > n ? '; e altri ' + (a.length - n) : '');

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
  while (!pred(t) && Date.now() - t0 < ms){ await sleep(300); t = task(); }
  return t;
}
// La finestra chiede di tenere acceso lo schermo (FLAG_KEEP_SCREEN_ON, messo da KeepAwake)
const keepsScreenOn = () => task().keepScreenOn;
const gpsServiceOn = () => /isForeground=true/.test(adb('shell', 'dumpsys', 'activity', 'services', PKG));
function screenSize(){ const m = adb('shell', 'wm', 'size').match(/(\d+)x(\d+)/); return m ? [+m[1], +m[2]] : [1080, 2340]; }

/* ---------- pagina, tramite DevTools della WebView ---------- */
let ws = null, msgId = 0;
const pending = new Map();
// Errori JavaScript e messaggi di errore nella console, per tutta la durata del collaudo
const pageErrors = new Map();
function onDevtools(m){
  if (m.id && pending.has(m.id)){ pending.get(m.id)(m); pending.delete(m.id); return; }
  let text = null;
  if (m.method === 'Runtime.exceptionThrown'){
    const d = m.params.exceptionDetails;
    text = (d.exception && d.exception.description || d.text || '').split('\n')[0] + (d.url ? ' (' + d.url.split('/').pop() + ':' + d.lineNumber + ')' : '');
  } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error'){
    text = 'console.error: ' + m.params.args.map(a => a.value != null ? a.value : a.description || '').join(' ');
  } else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error'){
    text = m.params.entry.text + (m.params.entry.url ? ' (' + m.params.entry.url + ')' : '');
  }
  if (text) pageErrors.set(text.slice(0, 200), (pageErrors.get(text.slice(0, 200)) || 0) + 1);
}
async function connect(){
  try { if (ws) ws.close(); } catch(e){}
  ws = null;
  for (let i = 0; i < 40 && !ws; i++){
    try {
      const pid = adb('shell', 'pidof', PKG).split(/\s+/)[0];
      if (pid){
        try { execFileSync(ADB, ['forward', '--remove', 'tcp:' + PORT], {stdio: 'ignore'}); } catch(e){}
        adb('forward', 'tcp:' + PORT, 'localabstract:webview_devtools_remote_' + pid);
        const pages = await (await fetch('http://127.0.0.1:' + PORT + '/json')).json();
        const page = pages.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
        if (page){
          const sock = new WebSocket(page.webSocketDebuggerUrl);
          await new Promise((ok, ko) => { sock.onopen = ok; sock.onerror = ko; });
          sock.onmessage = e => onDevtools(JSON.parse(e.data));
          ws = sock;
          for (const method of ['Runtime.enable', 'Log.enable']) ws.send(JSON.stringify({id: ++msgId, method}));
        }
      }
    } catch(e){}
    if (!ws) await sleep(300);
  }
  if (!ws) throw new Error('DevTools della WebView non raggiungibili');
}
async function js(expr, ms = 10000){
  const id = ++msgId;
  const reply = new Promise((ok, ko) => { pending.set(id, ok); setTimeout(() => ko(new Error('Nessuna risposta dalla pagina')), ms); });
  ws.send(JSON.stringify({id, method: 'Runtime.evaluate', params: {expression: expr, returnByValue: true, awaitPromise: true}}));
  const m = await reply;
  if (m.result.exceptionDetails) throw new Error('Errore nella pagina: ' + JSON.stringify(m.result.exceptionDetails).slice(0, 300));
  return m.result.result.value;
}
// Esegue nella pagina una funzione scritta qui (senza variabili esterne), con argomenti JSON
const call = (fn, ...args) => js('(' + fn.toString() + ')(...' + JSON.stringify(args) + ')', 30000);
async function waitFor(expr, ms = 8000){
  const t0 = Date.now();
  while (Date.now() - t0 < ms){ try { if (await js(expr)) return true; } catch(e){} await sleep(200); }
  return false;
}
const pageState = () => js(`(() => { const t = window.__tutor, f = t.st.fix; return {
  running: t.st.running, driving: document.body.classList.contains('driving'),
  pip: document.documentElement.classList.contains('pip'), fixT: f ? f.t : null,
  kicker: document.getElementById('pKicker').textContent, title: document.getElementById('pTitle').textContent,
  plate: document.getElementById('plate').className,
  w: innerWidth, h: innerHeight, scale: window.visualViewport ? visualViewport.scale : 1, origin: performance.timeOrigin}; })()`);
const pipLayout = () => js(`(() => {
  const el = id => document.getElementById(id);
  const vis = sel => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== 'none' && r.width > 0 && r.height > 0; };
  const inside = (r, b) => r.left >= b.left - 1 && r.right <= b.right + 1 && r.top >= b.top - 1 && r.bottom <= b.bottom + 1;
  const vp = {left: 0, top: 0, right: innerWidth, bottom: innerHeight};
  const g = document.querySelector('.gauge').getBoundingClientRect();
  const clear = e => getComputedStyle(e).backgroundColor === 'rgba(0, 0, 0, 0)';
  return {
    visible: ['.screen', '.hud-top', '.stats', '.advice', '.hud-limits', '.simbar', '.toast', '.ptext', '.pside'].filter(vis),
    plateInside: g.width > 0 && inside(g, vp) && Math.abs(g.width - Math.min(innerWidth, innerHeight)) <= 2,
    bigInside: inside(el('pBig').getBoundingClientRect(), g) && inside(document.querySelector('.keep-in').getBoundingClientRect(), g),
    transparent: [document.documentElement, document.body, document.querySelector('.hud')].every(clear)
  }; })()`);

async function launch(){
  adb('shell', 'am', 'start', '-W', '-n', ACT);
  await connect();
  if (!await waitFor('!!window.__tutor', 15000)) throw new Error('La pagina non si è avviata');
}
async function reload(){
  await js('location.reload(); true');
  await sleep(500);
  await connect();
  if (!await waitFor('!!window.__tutor && document.readyState === "complete"', 15000)) throw new Error('La pagina non si è ricaricata');
}
async function freshStart(){
  adb('shell', 'am', 'force-stop', PKG);
  await launch();
  await js(`localStorage.setItem('tutorA1.v1.settings', ${JSON.stringify(JSON.stringify(TEST_SETTINGS))}); true`);
  await reload();
}
async function startSim(kmh){
  await js(`(() => { document.getElementById('simSec').value = '12'; document.getElementById('simV').value = '${kmh}';
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
  // Il menu del riquadro è di sistema e uiautomator non lo vede: su One UI la X è l'ultima icona in alto a destra.
  // Aperto il menu il riquadro si allarga un po': posizione misurata dallo screenshot con il riquadro quadrato,
  // 84% della larghezza da sinistra e 13% della larghezza dall'alto
  const [ml, mt, mr] = task().bounds || [l, tp, r];
  adb('shell', 'input', 'tap', String(Math.round(ml + 0.84*(mr - ml))), String(Math.round(mt + 0.134*(mr - ml))));
  if ((await waitTask(t => t.mode !== 'pinned', 3000)).mode !== 'pinned') return 'pulsante X';
  const [sw, sh] = screenSize();
  adb('shell', 'input', 'swipe', String(cx), String(cy), String(sw >> 1), String(Math.round(sh*0.96)), '1200');
  return 'trascinamento sulla chiusura';
}
const home = () => adb('shell', 'input', 'keyevent', 'KEYCODE_HOME');
const back = () => adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');

/* ---------- fasi ---------- */

// Esito di pageAudit: errore se qualcosa esce dallo schermo, ha valori rotti, contrasto basso o è troppo piccolo da toccare
const auditProblems = (a, extra = []) => [...extra, ...(a.overflowX ? ['la pagina scorre di lato'] : []),
  ...a.outside.map(x => 'fuori schermo ' + x), ...a.broken.map(x => 'valore rotto ' + x),
  ...a.contrast.map(c => 'contrasto ' + c.ratio + ' ' + c.what), ...a.small.map(x => 'sotto 48 px ' + x)];
const auditOk = (a, extra) => !auditProblems(a, extra).length;
const auditText = (a, extra) => list(auditProblems(a, extra));

async function phasePage(){
  await freshStart();
  const www = readFileSync(join(process.cwd(), 'www', 'index.html'), 'utf8');
  const local = [...www.matchAll(/<script[^>]*\bdata-keep\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => {
    let x = 2166136261; const s = m[1].trim(); for (let i = 0; i < s.length; i++){ x ^= s.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; } return x.toString(16); }).join(',');
  const onPhone = await call(pageFingerprint);
  check('L\'app sul telefono è l\'ultima build (www/)', onPhone === local, onPhone === local ? '' : 'rifai npm run sync e ./gradlew installDebug -Pprova=true');
  const ua = await js('navigator.userAgent');
  note('WebView del telefono', (ua.match(/Chrome\/[\d.]+/) || [ua])[0] + ', ' + (ua.match(/Android [\d.]+/) || [''])[0]);
  const native = await js(`[...document.querySelectorAll('#hud .hbtn')].map(b => b.textContent).join(',')`);
  check('Nella guida c\'è il pulsante Riquadro (ponte nativo caricato)', /Riquadro/.test(native), native);

  // Ogni schermata, in tema chiaro e scuro
  const bgs = {};
  for (const theme of ['Chiaro', 'Scuro']){
    for (const id of ['home', 'menu', 'pSettings', 'pSim', 'pHist', 'pHow', 'pInfo']){
      const s = await call(showScreen, id, theme);
      bgs[theme] = s.bg;
      const a = await call(pageAudit);
      const where = id + ' (' + theme.toLowerCase() + ')';
      check('Schermata ' + where, auditOk(a, s.shown === id ? [] : ['si vede ' + s.shown]), auditText(a));
      if (a.clipped.length) note('Testo tagliato in ' + where, list(a.clipped));
      if (a.tiny.length) note('Testo sotto 11 px in ' + where, list(a.tiny));
    }
  }
  check('Il tema chiaro e quello scuro hanno sfondi diversi', bgs.Chiaro !== bgs.Scuro, bgs.Chiaro + ' / ' + bgs.Scuro);
  await call(showScreen, 'pSettings', 'Come il telefono');

  // Schermata di guida in tre momenti: prima del portale, in allarme, a fine tratto (simulazione a 160 km/h)
  await call(showScreen, 'pSim', 'Come il telefono');
  await js(`(() => { document.getElementById('simSec').value = '15'; document.getElementById('simV').value = '160';
    document.getElementById('btnSimStart').click(); window.__tutor.simControls.stopTimer(); return true; })()`);
  for (const [moment, until] of [['prima del portale', 'p === "go"'], ['in allarme', 'p === "alarm"'], ['a fine tratto', 'p.startsWith("done")']]){
    const reached = await js(`(() => { const T = window.__tutor, el = document.getElementById('plate');
      for (let i = 0; i < 3000; i++){ const p = el.className.replace(' flash', '').replace('plate ', ''); if (${until}) return true;
        const q = T.simulator.step(); if (!q) return false; T.tracker.pushPosition(q); } return false; })()`);
    const a = await call(pageAudit);
    check('Schermata di guida, ' + moment, reached && auditOk(a), reached ? auditText(a) : 'momento non raggiunto');
    if (a.clipped.length) note('Testo tagliato nella guida, ' + moment, list(a.clipped));
  }
  await js(`document.getElementById('hudExit').click(); true`);

  // Impostazioni: cambiano subito i testi e restano dopo il riavvio della pagina
  const set = await js(`(() => { const c = [...document.querySelectorAll('#setLimits .chip')].find(b => b.textContent.startsWith('110')); c.click();
    return {limit: window.__tutor.settings.limit, help: document.getElementById('marginHelp').textContent,
            saved: JSON.parse(localStorage.getItem('tutorA1.v1.settings')).limit}; })()`);
  check('Limite 110 dalle impostazioni: soglia e salvataggio', set.limit === 110 && set.saved === 110 && /115,7/.test(set.help), set.help.slice(0, 80));
  await reload();
  const after = await js(`({limit: window.__tutor.settings.limit, pressed: [...document.querySelectorAll('#setLimits .chip')].find(b => b.getAttribute('aria-pressed') === 'true').textContent})`);
  check('Dopo il riavvio il limite resta 110', after.limit === 110 && after.pressed.startsWith('110'), JSON.stringify(after));
  await js(`localStorage.setItem('tutorA1.v1.settings', ${JSON.stringify(JSON.stringify(TEST_SETTINGS))}); localStorage.setItem('tutorA1.v1.history', '[]'); true`);
  await reload();

  // Elenco dei tratti e filtri
  await call(showScreen, 'pSim', 'Come il telefono');
  const l = await call(listCheck);
  check('Elenco: ogni filtro mostra i tratti annunciati e ogni riga apre la sua scheda',
    !l.problems.length && l.opened === (await js('window.__tutor.SECS.length')) && l.openAfter === 0, list(l.problems) || l.opened + ' schede aperte e richiuse');

  // Guida simulata in tutti i tratti
  const secs = await js('window.__tutor.SECS.map(s => ({id: s.id, name: s.name}))');
  const t0 = Date.now(), fails = [], cut = [];
  let positions = 0, sumMs = 0, maxMs = 0, vib = 0;
  for (let i = 0; i < secs.length; i++){
    const s = secs[i], kmh = SPEEDS[i % SPEEDS.length];
    let r;
    try { r = await call(driveSection, s.id, kmh); } catch(e){ fails.push(s.id + ' ' + s.name + ': ' + e.message.slice(0, 80)); continue; }
    if (r.err){ fails.push(s.id + ' ' + s.name + ': ' + r.err); continue; }
    positions += r.n; sumMs += r.avgMs*r.n; maxMs = Math.max(maxMs, r.maxMs); vib += r.vib;
    const want = verdictOf(kmh, 130)[0], end = r.seen.fine;
    const said = end && (end.toast.match(/Media ([\d,]+) chilometri orari, ([^.]+)\./) || []);
    const p = [...r.problems];
    if (r.avg == null) p.push('il tratto non si è chiuso (' + r.types.join(',') + ')');
    else {
      if (Math.abs(r.avg - kmh) > 2) p.push('media ' + r.avg.toFixed(1) + ' a ' + kmh + ' km/h');
      if (r.mid) p.push('misura partita a metà tratto');
      if (!said || !said[1]) p.push('annuncio di fine mancante: "' + (end ? end.toast : '') + '"');
      else if (said[2] !== want || verdictOf(+said[1].replace(',', '.'), 130)[0] !== want) p.push('annuncio "' + said[0] + '" invece di ' + want);
    }
    if (r.alarm !== (kmh >= 134.84)) p.push(r.alarm ? 'allarme a ' + kmh + ' km/h' : 'nessun allarme a ' + kmh + ' km/h');
    if (r.stillDriving) p.push('dopo Esci la guida è ancora attiva');
    if (p.length) fails.push(s.id + ' ' + s.name + ' a ' + kmh + ': ' + p.join(', '));
    if (end && end.titleCut) cut.push(s.name);
  }
  check('Guida simulata in tutti i ' + secs.length + ' tratti (a ' + SPEEDS.join(', ') + ' km/h): inizio, allarmi, media e annuncio di fine',
    !fails.length, fails.length ? fails.length + ' tratti: ' + list(fails, 4) : positions + ' posizioni in ' + Math.round((Date.now() - t0)/1000) + ' s');
  for (const f of fails.slice(4, 30)) console.log('        ' + f);
  const avgMs = positions ? sumMs/positions : 0;
  check('Ogni posizione si elabora in fretta (sotto 50 ms, il GPS ne manda una al secondo)', maxMs < 50, 'media ' + avgMs.toFixed(1) + ' ms, massimo ' + maxMs.toFixed(1) + ' ms');
  check('Vibrazioni a inizio tratto e negli allarmi', vib >= secs.length, vib + ' vibrazioni');
  if (cut.length) note('Nome del tratto tagliato sul cartello a schermo intero', cut.length + ' tratti: ' + list(cut, 4));

  // Storico: pieno dopo la guida, resta dopo il riavvio, si svuota
  const h = await js(`(() => { const s = JSON.parse(localStorage.getItem('tutorA1.v1.history') || '[]'); return {saved: s.length, items: document.querySelectorAll('#hist li').length}; })()`);
  check('Storico: gli ultimi 60 tratti salvati, 30 mostrati', h.saved === Math.min(60, secs.length) && h.items === 30, JSON.stringify(h));
  await call(showScreen, 'pHist', 'Come il telefono');
  for (const theme of ['Chiaro', 'Scuro']){
    await call(showScreen, 'pHist', theme);
    const ha = await call(pageAudit);
    check('Storico pieno (' + theme.toLowerCase() + '): niente fuori schermo, valori rotti o medie poco leggibili', auditOk(ha), auditText(ha));
  }
  await call(showScreen, 'pHist', 'Come il telefono');
  await reload();
  const h2 = await js(`({saved: JSON.parse(localStorage.getItem('tutorA1.v1.history') || '[]').length, items: document.querySelectorAll('#hist li').length})`);
  check('Storico ancora lì dopo il riavvio della pagina', h2.saved === h.saved && h2.items === 30, JSON.stringify(h2));
  const h3 = await js(`(() => { document.getElementById('histClear').click(); return {saved: JSON.parse(localStorage.getItem('tutorA1.v1.history')).length, text: document.getElementById('hist').textContent}; })()`);
  check('Svuota storico', h3.saved === 0 && /Qui compariranno/.test(h3.text), JSON.stringify(h3).slice(0, 80));
}

async function phaseExits(){
  await freshStart();
  const full = await pageState();

  // Fuori dalla guida l'app si comporta come una app qualsiasi
  home();
  let t = await waitTask(t => !t.visible);
  check('Fuori dalla guida, Home: app in secondo piano, senza riquadro', !t.visible && t.mode !== 'pinned', 'mode=' + t.mode);
  await launch();
  // Indietro chiude prima la pagina, poi il menù; solo dalla schermata iniziale chiude l'app
  const screen = () => js(`document.querySelector('.screen:not([hidden])').id`);
  const waitScreen = async id => { const t0 = Date.now(); let s = await screen(); while (s !== id && Date.now() - t0 < 3000){ await sleep(150); s = await screen(); } return s; };
  await js(`document.getElementById('btnMenu').click(); document.querySelector('[data-go="pSettings"]').click(); true`);
  back();
  const p1 = await waitScreen('menu');
  back();
  const p2 = await waitScreen('home');
  t = task();
  check('Fuori dalla guida, Indietro da una pagina: torna al menù e poi alla schermata iniziale',
    p1 === 'menu' && p2 === 'home' && t.visible, p1 + ' -> ' + p2);
  back();
  t = await waitTask(t => !t.visible);
  check('Fuori dalla guida, Indietro dalla schermata iniziale: l\'app si chiude', !t.visible && t.mode !== 'pinned', 'mode=' + t.mode);
  await launch();

  // In guida (simulazione a 150 km/h: nel riquadro si vede anche l'allarme) l'uscita apre il riquadro
  check('Simulazione avviata', await startSim(150));
  // Il pulsante Riquadro della guida apre il riquadro anche senza uscire
  await js(`[...document.querySelectorAll('#hud .hbtn')].find(b => b.textContent === 'Riquadro').click(); true`);
  t = await waitTask(t => t.mode === 'pinned');
  check('Pulsante Riquadro: si apre il riquadro', t.mode === 'pinned', 'mode=' + t.mode);
  adb('shell', 'am', 'start', '-W', '-n', ACT);
  await waitTask(t => t.mode === 'fullscreen');
  await sleep(1500);
  home();
  t = await waitTask(t => t.mode === 'pinned');
  check('In guida, Home: si apre il riquadro', t.mode === 'pinned', 'mode=' + t.mode + ', ' + JSON.stringify(t.bounds));
  await waitFor('document.documentElement.classList.contains("pip")', 4000);
  await sleep(800);
  const s1 = await pageState();
  check('La pagina sa di essere nel riquadro', s1.pip);
  note('Misura del riquadro in CSS px (per tools/pip-harness.mjs)', s1.w + 'x' + s1.h);
  screenshot('riquadro-home.png');
  await sleep(2500);
  const s2 = await pageState();
  check('Nel riquadro la guida continua e si aggiorna', s2.running && s2.fixT > s1.fixT, s1.fixT + ' -> ' + s2.fixT);
  const lay = await pipLayout();
  check('Nel riquadro resta solo il cerchio del cartello', lay.visible.length === 0, lay.visible.join(', ') || 'nient\'altro visibile');
  check('Il cerchio riempie il riquadro e media e velocità da tenere ci stanno dentro', lay.plateInside && lay.bigInside, s2.kicker + ', ' + s2.plate);
  check('Intorno al cerchio la pagina è trasparente', lay.transparent);

  // Navigazione: Maps davanti, il riquadro resta sopra e lo schermo acceso
  adb('shell', 'am', 'start', '-W', '-n', MAPS);
  await sleep(2000);
  t = task();
  const s3 = await pageState();
  check('Con Maps aperto il riquadro resta visibile', t.mode === 'pinned' && t.visible && s3.running, 'mode=' + t.mode);
  await waitFor('/alarm/.test(document.getElementById("plate").className)', 15000);
  screenshot('riquadro-sopra-maps.png');
  const s4 = await pageState();
  check('Sopra Maps il cartello continua ad aggiornarsi', s4.fixT > s3.fixT, s3.fixT + ' -> ' + s4.fixT);
  check('Sopra Maps a 150 km/h il cartello passa all\'allarme', /alarm/.test(s4.plate), s4.kicker + ', ' + s4.plate);
  const lay2 = await pipLayout();
  check('Il cartello dell\'allarme sta tutto nel riquadro', lay2.plateInside && lay2.bigInside);
  check('La finestra del riquadro tiene lo schermo acceso (KEEP_SCREEN_ON)', keepsScreenOn());
  const timeout = Number(adb('shell', 'settings', 'get', 'system', 'screen_off_timeout'));
  if (complete && timeout > 0 && timeout <= 60000){
    await sleep(timeout + 10000);
    const awake = /mWakefulness=Awake/.test(adb('shell', 'dumpsys', 'power'));
    check('Passato il tempo di spegnimento (' + timeout/1000 + ' s) lo schermo è ancora acceso', awake);
    if (!awake) throw new Error('Schermo spento: sblocca il telefono e rilancia il collaudo');
  } else if (complete) note('Prova del tempo di spegnimento saltata', 'lo schermo si spegne dopo ' + timeout/1000 + ' s');

  // Ritorno a schermo intero
  adb('shell', 'am', 'start', '-W', '-n', ACT);
  t = await waitTask(t => t.mode === 'fullscreen');
  await waitFor('!document.documentElement.classList.contains("pip") && innerWidth === ' + full.w, 5000);
  await sleep(1500);   // MainActivity rimette lo zoom al 100% fino a 1,2 s dopo l'uscita dal riquadro
  const s5 = await pageState();
  check('Riaprendo l\'app torna a schermo intero', t.mode === 'fullscreen' && !s5.pip, 'mode=' + t.mode);
  check('A schermo intero larghezza e zoom come prima', s5.w === full.w && Math.abs(s5.scale - 1) < 0.02, s5.w + ' vs ' + full.w + ', scala ' + s5.scale);
  check('La guida è ancora in corso', s5.running && s5.driving);
  const fa = await call(pageAudit);
  check('Guida a schermo intero dopo il riquadro: niente fuori schermo, contrasto e pulsanti a posto', auditOk(fa), auditText(fa));

  // Indietro in guida
  back();
  t = await waitTask(t => t.mode === 'pinned');
  check('In guida, Indietro: si apre il riquadro invece di chiudere', t.mode === 'pinned' && (await pageState()).running, 'mode=' + t.mode);

  // X del riquadro
  const how = await closePip();
  await sleep(2000);
  await launch();
  const s6 = await pageState();
  // Vale solo se è la stessa pagina a fermare la guida: una pagina ricaricata parte comunque ferma
  const samePage = s6.origin === s5.origin;
  check('X sul riquadro: la guida finisce', samePage && !s6.running && !s6.driving,
    (samePage ? 'stessa pagina, ' : 'pagina ricaricata, non dimostrato, ') + 'chiuso con ' + how);
}

// Con il GPS vero: dopo la X il servizio della posizione non deve restare acceso
async function phaseGps(){
  await freshStart();
  await js(`document.getElementById('btnDrive').click(); true`);
  await waitFor('window.__tutor.st.running', 5000);
  await sleep(4000);
  check('Guida con GPS: servizio della posizione attivo', gpsServiceOn());
  home();
  const t = await waitTask(t => t.mode === 'pinned');
  check('Guida con GPS, Home: riquadro aperto e servizio ancora attivo', t.mode === 'pinned' && gpsServiceOn(), 'mode=' + t.mode);
  const how = await closePip();
  await sleep(2500);
  check('X sul riquadro: il servizio della posizione si ferma', !gpsServiceOn(), 'chiuso con ' + how);
}

async function main(){
  mkdirSync(outDir, {recursive: true});
  if (!adb('devices').split('\n').slice(1).some(l => /\tdevice$/.test(l))) throw new Error('Nessun telefono collegato');
  if (!adb('shell', 'pm', 'list', 'packages', PKG).split('\n').includes('package:' + PKG)) throw new Error('Copia di prova non installata: ./gradlew installDebug -Pprova=true');
  for (const p of ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'POST_NOTIFICATIONS']){ try { adb('shell', 'pm', 'grant', PKG, 'android.permission.' + p); } catch(e){} }
  // Lo schermo deve essere acceso e sbloccato, altrimenti i gesti non arrivano all'app
  if (!/mWakefulness=Awake/.test(adb('shell', 'dumpsys', 'power'))) throw new Error('Schermo spento: accendi e sblocca il telefono');
  const phases = [['pagina', phasePage], ['uscite', phaseExits], ...(withGps ? [['gps', phaseGps]] : [])].filter(([n]) => !only || n === only);
  for (const [name, fn] of phases){
    const t0 = Date.now();
    console.log('\n--- ' + name + ' ---');
    try { await fn(); } catch(e){ check('Fase ' + name + ' interrotta', false, e.message); }
    console.log('    (' + Math.round((Date.now() - t0)/1000) + ' s)');
  }
  const errs = [...pageErrors].map(([t, n]) => (n > 1 ? n + '× ' : '') + t);
  check('Nessun errore JavaScript nella pagina durante il collaudo', !errs.length, list(errs, 5));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href){
  const t0 = Date.now();
  main().catch(e => check('Collaudo interrotto', false, e.message)).finally(() => {
    try { adb('shell', 'am', 'force-stop', PKG); } catch(e){}
    try { adb('forward', '--remove', 'tcp:' + PORT); } catch(e){}
    try { if (ws) ws.close(); } catch(e){}
    try { adb('shell', 'input', 'keyevent', 'KEYCODE_HOME'); } catch(e){}
    writeFileSync(join(outDir, 'risultati.json'), JSON.stringify(results, null, 1));
    const bad = results.filter(r => r.ok === false).length, notes = results.filter(r => r.ok === null).length;
    console.log('\n' + (bad ? bad + ' controlli non superati' : 'Tutti i controlli superati') + ', ' + notes + ' note, in ' + Math.round((Date.now() - t0)/1000) + ' s');
    process.exit(bad ? 1 : 0);
  });
}
