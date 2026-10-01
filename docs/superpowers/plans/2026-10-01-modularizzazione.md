# Modularizzazione del Tutor A1/A4: piano di implementazione

> **Per chi esegue (agenti):** SOTTO-SKILL OBBLIGATORIA: usa superpowers:subagent-driven-development oppure superpowers:executing-plans per eseguire il piano un compito alla volta. I passi usano le caselle (`- [ ]`) per tenere traccia dell'avanzamento.

**Obiettivo:** dividere il monolite `index.html` (1213 righe, 500 KB) in moduli piccoli e testati, separando il calcolo (Node, senza pagina) dall'interfaccia, **senza cambiare il comportamento dell'app**.

**Architettura:** i sorgenti vanno in `src/` come moduli ES. `src/core/` contiene solo logica pura (formati, regole, rete autostradale, calcolo della guida, testi degli annunci, vista dell'HUD, simulazione, salvataggio) ed è testata con `node --test`. `src/ui/` applica alla pagina quello che decide `core/`. `scripts/build.mjs` ricompone un file HTML unico (esbuild per il JavaScript, segnaposto espliciti per il resto) sia per il browser (`index.html` alla radice, servito da GitHub Pages) sia per l'app (`www/`). Prima di toccare il codice si registra un "golden master": il comportamento dell'app originale su 5 percorsi GPS fissi, che poi ogni passo deve riprodurre identico. Si registra anche come si comporta il riquadro Picture-in-Picture. Un collaudo automatico sul telefono controlla l'uscita dall'app (Home, Indietro, X del riquadro) e il riquadro acceso sopra Maps durante la navigazione, con lo schermo che resta acceso. Tutto avviene in una cartella separata (`Fancuolo_tutor-refactor`). Sul telefono si installa una copia di prova accanto all'app normale.

**Tecnologie:** JavaScript (moduli ES), Leaflet 1.9.4 (copia locale, come oggi), esbuild 0.28.2 (solo sviluppo), test runner integrato di Node 22, Capacitor 8 (invariato).

**Specifica:** non c'è un documento separato. La richiesta è nel messaggio dell'utente del 2026-10-01: valutazione del codice (logica in un'unica funzione con stato condiviso, calcolo mescolato all'interfaccia, `say()` che fa tre cose, nessun test, build che cerca pezzi di testo, `indexA1.html` inutilizzato) e obiettivo "rendere il codice molto più modulabile e ottimizzabile per i prossimi aggiornamenti".

## Vincoli globali

- Node 22 o superiore (c'è la v22.21.0). Test con `node --test`, nessuna libreria di test.
- Nessuna nuova dipendenza nell'app. Unica dipendenza di sviluppo nuova: `esbuild` 0.28.2, versione esatta.
- Il comportamento non cambia: il golden master registrato al Compito 0 deve restare identico fino alla fine. Unica eccezione voluta: il contatore dei salti GPS (`st.jumps`) si azzera all'avvio di ogni guida.
- Chiavi di `localStorage` invariate: `tutorA1.v1.settings` e `tutorA1.v1.history`, con la stessa forma dei dati.
- Id e classi dell'HTML invariati (li usano il CSS e `native/tutor-native.js`).
- `window.__tutor` continua a esporre `st`, `sim`, `SECS`, `LINES`, `thresholdFor`, `settings` (serve al collaudo via Chrome DevTools sul telefono).
- `index.html` alla radice resta un file unico e funzionante: lo serve GitHub Pages (`https://niccomarino.github.io/TutorA1/`, risponde 200). Diventa un file generato da `npm run build` e va committato.
- Android: non toccare AGP 8.13.0 / Gradle 8.14.3; per compilare serve Java 21 (`C:\Program Files\Java\jdk-21`).
- Testi dell'interfaccia, commenti e messaggi di commit in italiano. Ogni commit termina con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `npm test` deve passare alla fine di ogni compito.
- Si lavora solo in `C:\Users\Nicco\Desktop\Fancuolo_tutor-refactor`: è un git worktree sul branch `refactor-moduli`, creato da `app-sopra-maps` (già fatto il 2026-10-01). La cartella `Fancuolo_tutor` originale non si tocca. Niente merge in `app-sopra-maps` o `main` senza chiedere all'utente: GitHub Pages serve `main`.
- Sul telefono si installa solo la copia di prova: `./gradlew installDebug -Pprova=true`, pacchetto `it.niccomarino.tutora1a4.prova`, nome "Tutor prova". L'app normale `it.niccomarino.tutora1a4` resta com'è, con i suoi dati.
- Collaudi sul telefono senza toccare le impostazioni di sistema (schermo, carattere, rotazione): si leggono soltanto.

## Punti da sorvegliare in revisione

1. **Dati salvati di chi usa già l'app**: dopo l'aggiornamento impostazioni e storico devono ricomparire. Test: `test/store.test.js` fissa i nomi delle chiavi e la lettura di dati vecchi o rovinati (Compito 5).
2. **Uscita dall'app e riquadro sopra Maps**: in guida, Home o Indietro devono aprire il riquadro, non chiudere l'app né fermare il GPS. Nel riquadro deve restare solo il cartello, leggibile e aggiornato, con lo schermo acceso. La X deve terminare la guida e spegnere il GPS. Il ponte nativo dipende da `#hudExit`, `#hudMute`, dalla classe `driving` e dallo stile `html.pip`: se uno cambia, tutto questo smette di funzionare senza errori. Test: `tools/device-check.mjs` sul telefono e `tools/pip-harness.mjs` nel browser (Compito 0B, ripetuti ai Compiti 2, 10, 11, 12); `test/build.test.js` sugli id (Compito 11).
3. **GitHub Pages e "Scarica l'app come file HTML"**: la pagina per il browser deve restare un file unico, aggiornato rispetto a `src/`, con tutti gli script in linea marcati `data-keep` (altrimenti la copia scaricata perde il codice). Test: `test/build.test.js` (Compiti 1 e 2).
4. **Messaggio "posizione bloccata" nell'app**: oggi la build lo sostituisce cercando il testo; esbuild riscrive le stringhe e la ricerca fallirebbe senza errori. Test: `test/platform.test.js` (Compito 2).
5. **Pagina rotta da un `</script>` nel codice o da un errore di sintassi**: l'app si bloccherebbe all'avvio. Test: `test/build.test.js` su `checkInlineScript` (Compito 2).

---

## Struttura dei file alla fine

```
src/
  index.html               modello della pagina: markup + segnaposto <!--@include ...--> e <!--@var ...-->
  main.js                  avvio: collega core/ e ui/ (unico punto in cui si incontrano)
  platform.js              differenze browser / app (messaggio GPS negato)
  styles/app.css           stile della pagina
  styles/pip.css           stile del riquadro Picture-in-Picture (spostato dal ponte nativo)
  vendor/leaflet.css       Leaflet 1.9.4, invariato
  vendor/leaflet.js        Leaflet 1.9.4, invariato
  data/tutor-data.json     tracciati, tratti, caselli, regioni
  core/                    LOGICA PURA: niente document, window, Leaflet
    format.js              numeri, distanze, durate, nomi per la voce, escape HTML
    rules.js               soglia di tolleranza (art. 345), esito di un tratto, limiti
    geo.js                 distanza, direzione, differenza di angoli
    network.js             rete autostradale: tratti, linee, aggancio di un punto alla strada
    store.js               impostazioni e storico (localStorage o altro)
    metrics.js             media in corso, proiezione, consiglio di velocità
    tracker.js             la guida: posizioni -> tratti, media, allarmi, come eventi
    messages.js            testo, suono e vibrazione per ogni evento
    hud-view.js            cosa mostrare nella schermata di guida
    simulator.js           posizioni simulate lungo un tracciato
  ui/                      PAGINA: applica le decisioni di core/
    dom.js, map.js, sidebar.js, settings-panel.js, history-panel.js,
    hud.js, audio.js, sim-controls.js, download.js
scripts/build.mjs          costruisce index.html (browser) e www/ (app)
tools/serve.mjs            server locale per provare la pagina e salvare i golden
tools/make-scenarios.mjs   genera i percorsi GPS di prova
tools/golden-harness.mjs   registra il golden nel browser
tools/compare-golden.mjs   confronta due golden (anche quelli del riquadro)
tools/pip-harness.mjs      misura il cartello nel riquadro PiP, nel browser del PC
tools/device-check.mjs     collaudo sul telefono: uscita dall'app, riquadro sopra Maps, schermo acceso, X
test/*.test.js             test Node
test/helpers.js            funzioni comuni ai test
test/fixtures/             scenarios.json, golden.json, pip-layout.json
docs/ARCHITETTURA.md       come è fatto e dove aggiungere le cose
```

Flusso dei dati dopo il refactoring:

```
GPS / simulatore ──posizione──> core/tracker ──eventi──> main.js ──> core/messages ──> ui/audio, ui/hud.toast
                                     │                       └──> store (storico), ui/map (evidenzia)
                                     └──stato──> core/hud-view ──vista──> ui/hud
```

---

### Compito 0: rete di sicurezza (server locale, percorsi di prova, golden master)

Registra cosa fa OGGI l'app su 5 percorsi GPS fissi: per ogni posizione il contenuto della schermata di guida, gli avvisi (testo del toast), le vibrazioni, e alla fine lo storico. Non si modifica il codice dell'app.

**File:**
- Crea: `tools/serve.mjs`, `tools/make-scenarios.mjs`, `tools/golden-harness.mjs`, `tools/compare-golden.mjs`, `.claude/launch.json`
- Crea (generati): `test/fixtures/scenarios.json`, `test/fixtures/golden.json`
- Modifica: `.gitignore`, `.gitattributes`

**Interfacce:**
- Produce: `test/fixtures/scenarios.json` = `[{name, fixes:[{lat, lon, speed, heading, accuracy, t}]}]` (t in ms, speed in m/s). `test/fixtures/golden.json` = `[{name, frames:[Frame], history:[{id, da, a, avg, lim, partial, sim, dur}]}]` con `Frame = {pKicker, pTitle, pBig, pUnit, pSub, advice, hudRoad, sInst, sLim, sThr, sThrL, plate, prog, fill, pFrom, pTo, toasts:[string], vib:[number|number[]]}` (`fill`, `pFrom`, `pTo` sono `null` quando la barra è nascosta). Impostazioni del golden: `{limit:130, margin:2, preAlert:1, voice:false, beep:false, instWarn:true}`.

- [ ] **Passo 1: prepara la cartella separata** (cartella e branch esistono già)

```bash
cd /c/Users/Nicco/Desktop/Fancuolo_tutor-refactor && git branch --show-current && npm ci
```

Atteso: `refactor-moduli`, dipendenze installate. `android/local.properties` è già stato copiato dalla cartella originale.

- [ ] **Passo 2: scrivi il server locale `tools/serve.mjs`**

```js
// Server locale per provare la pagina nel browser: serve i file del progetto
// e permette all'harness di collaudo di salvare i risultati in test/fixtures/.
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize, basename } from 'node:path';

const root = process.cwd();
const port = Number(process.env.PORT) || 5173;
const TYPES = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.png':'image/png', '.svg':'image/svg+xml', '.ico':'image/x-icon'
};

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'PUT' && url.pathname.startsWith('/__save/')){
      const name = basename(url.pathname);
      if (!/^[\w.-]+\.json$/.test(name)){ res.writeHead(400).end('nome non valido'); return; }
      const chunks = [];
      for await (const c of req) chunks.push(c);
      await writeFile(join(root, 'test', 'fixtures', name), Buffer.concat(chunks));
      res.writeHead(200).end('salvato ' + name);
      return;
    }
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(root, path));
    if (!file.startsWith(root)){ res.writeHead(403).end(); return; }
    const body = await readFile(file);
    res.writeHead(200, {'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store'}).end(body);
  } catch (e) {
    res.writeHead(404).end('non trovato');
  }
}).listen(port, '127.0.0.1', () => console.log('http://localhost:' + port + '/'));
```

- [ ] **Passo 3: scrivi `.claude/launch.json`** (per aprire la pagina nel browser integrato con `preview_start`)

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "tutor", "runtimeExecutable": "node", "runtimeArgs": ["tools/serve.mjs"], "port": 5173 }
  ]
}
```

- [ ] **Passo 4: scrivi il generatore dei percorsi `tools/make-scenarios.mjs`**

```js
// Genera test/fixtures/scenarios.json: percorsi GPS finti ma realistici lungo i tracciati veri,
// usati dal collaudo "golden" (tools/golden-harness.mjs nel browser e test/golden.test.js in Node).
// Rigeneralo solo per cambiare gli scenari: dopo serve un nuovo golden.json dal browser.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

function loadData(){
  if (existsSync('src/data/tutor-data.json')) return JSON.parse(readFileSync('src/data/tutor-data.json', 'utf8'));
  const m = readFileSync('index.html', 'utf8').match(/<script data-keep type="application\/json" id="tutor-data">([\s\S]*?)<\/script>/);
  return JSON.parse(m[1]);
}
const data = loadData();
const D2R = Math.PI/180;
const T0 = 1790000000000;

function bearing(la1, lo1, la2, lo2){
  const y = Math.sin((lo2-lo1)*D2R)*Math.cos(la2*D2R);
  const x = Math.cos(la1*D2R)*Math.sin(la2*D2R) - Math.sin(la1*D2R)*Math.cos(la2*D2R)*Math.cos((lo2-lo1)*D2R);
  return (Math.atan2(y, x)/D2R + 360) % 360;
}
function pointAt(pts, km){
  const inc = pts[pts.length-1][2] > pts[0][2];
  for (let i = 0; i < pts.length - 1; i++){
    const a = pts[i][2], b = pts[i+1][2];
    if (inc ? (km >= a && km <= b) : (km <= a && km >= b)){
      const t = b === a ? 0 : (km - a)/(b - a);
      return {lat: pts[i][0] + t*(pts[i+1][0]-pts[i][0]), lon: pts[i][1] + t*(pts[i+1][1]-pts[i][1]),
              brg: bearing(pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1]), inc};
    }
  }
  throw new Error('km ' + km + ' fuori dal tracciato');
}
function offset(lat, lon, brg, meters){
  return [lat + meters*Math.cos(brg*D2R)/110574, lon + meters*Math.sin(brg*D2R)/(111320*Math.cos(lat*D2R))];
}
const r6 = x => Math.round(x*1e6)/1e6;

// Una posizione al secondo. legs: pezzi a velocità costante fino al km "to".
// jumpAt: al km indicato arrivano 3 posizioni sballate di 5,5 km (GPS impazzito).
// exitSeconds: alla fine si esce di lato dalla strada a 108 km/h per questi secondi.
function scenario(name, line, from, legs, {jumpAt = null, exitSeconds = 0} = {}){
  const pts = data.ch[line];
  const fixes = [];
  let t = T0, km = from, jumped = false, last = null;
  const push = (lat, lon, kmh, heading) => {
    fixes.push({lat: r6(lat), lon: r6(lon), speed: Math.round(kmh/3.6*1000)/1000, heading: Math.round(heading*10)/10, accuracy: 6, t});
    t += 1000;
  };
  for (const leg of legs){
    const dir = Math.sign(leg.to - km);
    while ((leg.to - km)*dir > 0){
      const p = pointAt(pts, km);
      const heading = ((dir > 0) === p.inc) ? p.brg : (p.brg + 180) % 360;
      if (jumpAt != null && !jumped && (km - jumpAt)*dir >= 0){
        jumped = true;
        for (let k = 0; k < 3; k++){ const [la, lo] = offset(p.lat, p.lon, 0, 5500); push(la, lo, leg.kmh, heading); }
      }
      push(p.lat, p.lon, leg.kmh, heading);
      last = {lat: p.lat, lon: p.lon, heading};
      km += dir*leg.kmh/3600;
    }
  }
  for (let k = 1; k <= exitSeconds; k++){
    const side = (last.heading + 90) % 360;
    const [la, lo] = offset(last.lat, last.lon, side, 30*k);
    push(la, lo, 108, side);
  }
  return {name, fixes};
}

const scenarios = [
  // preavviso, inizio, fine di Milano Sud-Lodi agganciata all'inizio di Lodi-Casalpusterlengo
  scenario('a1-sud-tratti-consecutivi', 'S', 9.0, [{to: 24.0, kmh: 125}]),
  // ingresso a metà tratto, allarme, ripetizione dell'allarme, velocità istantanea, rientro sotto soglia
  scenario('a1-sud-allarme-e-rientro', 'S', 70.0, [{to: 80.0, kmh: 150}, {to: 89.5, kmh: 95}]),
  // 3 posizioni sballate durante il tratto All. A21-Fiorenzuola: misura interrotta
  scenario('a1-sud-salto-gps', 'S', 55.0, [{to: 68.0, kmh: 120}], {jumpAt: 65.0}),
  // si esce dal tracciato dentro All. A15-Parma: misura interrotta
  scenario('a1-sud-uscita-dal-tracciato', 'S', 103.0, [{to: 106.0, kmh: 120}], {exitSeconds: 20}),
  // A4 verso Torino (chilometri decrescenti): Ospitaletto-Rovato e Rovato-Palazzolo
  scenario('a4-ovest-due-tratti', 'AW', 210.0, [{to: 196.0, kmh: 130}])
];
mkdirSync('test/fixtures', {recursive: true});
writeFileSync('test/fixtures/scenarios.json', JSON.stringify(scenarios));
console.log(scenarios.map(s => s.name + ': ' + s.fixes.length + ' posizioni').join('\n'));
```

- [ ] **Passo 5: genera i percorsi**

Esegui: `node tools/make-scenarios.mjs`
Atteso: 5 righe, circa 433, 601, 394, 111, 389 posizioni.

- [ ] **Passo 6: scrivi l'harness del browser `tools/golden-harness.mjs`**

```js
// Collaudo "golden": guida la pagina aperta con 5 percorsi GPS fissi e registra, posizione per posizione,
// la schermata di guida, gli avvisi e le vibrazioni; alla fine lo storico. Salva in test/fixtures/<nome>.
// Uso nel browser integrato, sulla pagina servita da tools/serve.mjs:
//   (await import('/tools/golden-harness.mjs?' + Date.now())).run('golden.json')
export const GOLDEN_SETTINGS = {limit:130, margin:2, preAlert:1, voice:false, beep:false, instWarn:true};

export async function run(name = 'golden.json'){
  const SKEY = 'tutorA1.v1.settings';
  if (!window.__tutor) throw new Error('window.__tutor mancante: la pagina non si è avviata');
  if (JSON.stringify(window.__tutor.settings) !== JSON.stringify(GOLDEN_SETTINGS)){
    localStorage.setItem(SKEY, JSON.stringify(GOLDEN_SETTINGS));
    location.reload();
    return 'Impostazioni del collaudo salvate e pagina ricaricata: esegui di nuovo run().';
  }
  const scenarios = await (await fetch('/test/fixtures/scenarios.json')).json();
  let deliver = null;
  Object.defineProperty(navigator, 'geolocation', {configurable: true, value: {
    watchPosition(ok){ deliver = ok; return 1; }, clearWatch(){}, getCurrentPosition(){}
  }});
  const vib = [];
  Object.defineProperty(navigator, 'vibrate', {configurable: true, value: p => { vib.push(p); return true; }});
  const el = id => document.getElementById(id);
  const toastObs = new MutationObserver(() => {});
  toastObs.observe(el('toast'), {childList: true});

  const out = [];
  for (const sc of scenarios){
    el('histClear').click();
    el('btnDrive').click();
    toastObs.takeRecords();
    const frames = sc.fixes.map(f => {
      vib.length = 0;
      deliver({coords: {latitude: f.lat, longitude: f.lon, accuracy: f.accuracy, speed: f.speed, heading: f.heading}, timestamp: f.t});
      const prog = !el('pProg').hidden;
      return {
        pKicker: el('pKicker').textContent, pTitle: el('pTitle').textContent, pBig: el('pBig').textContent,
        pUnit: el('pUnit').textContent, pSub: el('pSub').textContent, advice: el('advice').textContent,
        hudRoad: el('hudRoad').textContent, sInst: el('sInst').textContent, sLim: el('sLim').textContent,
        sThr: el('sThr').textContent, sThrL: el('sThrL').textContent,
        plate: el('plate').className.replace(' flash', ''), prog,
        fill: prog ? el('pFill').style.width : null, pFrom: prog ? el('pFrom').textContent : null, pTo: prog ? el('pTo').textContent : null,
        toasts: toastObs.takeRecords().flatMap(r => [...r.addedNodes].map(n => n.textContent)),
        vib: vib.slice()
      };
    });
    el('hudExit').click();
    const history = JSON.parse(localStorage.getItem('tutorA1.v1.history') || '[]').map(({t, ...h}) => h).reverse();
    out.push({name: sc.name, frames, history});
  }
  const res = await fetch('/__save/' + name, {method: 'PUT', body: JSON.stringify(out)});
  return res.status + ' ' + out.map(o => o.name + ': ' + o.frames.length + ' posizioni, ' + o.history.length + ' tratti').join('; ');
}
```

- [ ] **Passo 7: scrivi `tools/compare-golden.mjs`**

```js
// Confronta due golden (atteso, trovato) e stampa le prime differenze.
// Vale per golden.json e per pip-layout.json: [{name, frames:[...], ...altri campi}].
// Uso: node tools/compare-golden.mjs test/fixtures/golden.json test/fixtures/golden-check.json
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

const [want, got] = process.argv.slice(2).map(f => JSON.parse(readFileSync(f, 'utf8')));
let diffs = 0;
for (const a of want){
  const b = got.find(x => x.name === a.name);
  if (!b){ console.log('Manca lo scenario', a.name); diffs++; continue; }
  if (a.frames.length !== b.frames.length){ console.log(a.name, 'numero di posizioni diverso:', a.frames.length, b.frames.length); diffs++; }
  a.frames.forEach((fa, i) => {
    if (isDeepStrictEqual(fa, b.frames[i])) return;
    if (diffs++ < 5) console.log(a.name, 'posizione', i, '\n  atteso: ', JSON.stringify(fa), '\n  trovato:', JSON.stringify(b.frames[i]));
  });
  const {frames: fa, ...restA} = a, {frames: fb, ...restB} = b;
  if (!isDeepStrictEqual(restA, restB)){ diffs++; console.log(a.name, 'altri campi diversi (storico, riquadro)\n  atteso: ', JSON.stringify(restA), '\n  trovato:', JSON.stringify(restB)); }
}
console.log(diffs ? diffs + ' differenze' : 'Identico');
process.exit(diffs ? 1 : 0);
```

- [ ] **Passo 8: registra il golden dall'app originale**

Avvia il server con `preview_start` (nome `tutor`), apri `http://localhost:5173/`, poi con `javascript_tool`:

```js
(await import('/tools/golden-harness.mjs?' + Date.now())).run('golden.json')
```

La prima volta risponde "Impostazioni del collaudo salvate e pagina ricaricata": aspetta il caricamento ed eseguilo di nuovo.
Atteso: `200 a1-sud-tratti-consecutivi: 433 posizioni, 1 tratti; ...` e il file `test/fixtures/golden.json` creato.

- [ ] **Passo 9: controlla che gli scenari provino davvero quello che devono**

Esegui:

```bash
node -e "const g=require('./test/fixtures/golden.json');for(const s of g)console.log(s.name+'\n  '+[...new Set(s.frames.flatMap(f=>f.toasts))].join('\n  '))"
```

Atteso, in ordine di scenario, che compaiano almeno: "Tra un chilometro inizia il Tutor", "Inizio Tutor.", "Subito dopo inizia il Tutor" (scenario 1); "Sei dentro il tratto Tutor", "Velocità oltre 130", "Attenzione, media oltre la soglia. Rallenta.", "Media ancora oltre la soglia.", "Media rientrata sotto la soglia." (scenario 2); "Segnale GPS instabile: misura del tratto interrotta." (scenario 3); "Sei uscito dal tracciato: misura del tratto interrotta." (scenario 4); "Inizio Tutor." (scenario 5). Se manca qualcosa, cambia i km dello scenario in `tools/make-scenarios.mjs` e ripeti dal Passo 5.

- [ ] **Passo 10: controlla che la registrazione sia ripetibile**

Esegui `run('golden-check.json')` nel browser, poi:

```bash
node tools/compare-golden.mjs test/fixtures/golden.json test/fixtures/golden-check.json
```

Atteso: `Identico`. Se no, l'harness dipende da qualcosa di casuale: correggilo prima di andare avanti.

- [ ] **Passo 11: aggiorna `.gitignore` e `.gitattributes`, poi commit**

Aggiungi a `.gitignore`:

```
test/fixtures/golden-check.json
```

Aggiungi a `.gitattributes`:

```
test/fixtures/*.json -diff
```

```bash
git add tools .claude/launch.json test/fixtures/scenarios.json test/fixtures/golden.json .gitignore .gitattributes
git commit -m "Collaudo golden: percorsi GPS fissi e comportamento registrato dell'app attuale"
```

---

### Compito 0B: collaudo dell'uscita dall'app e del riquadro sopra Maps

Il caso d'uso: si naviga con Maps o Waze e del Tutor resta acceso solo il riquadro con il cartello, con lo schermo acceso. Due collaudi, registrati ora sull'app attuale e ripetuti dopo ogni passo importante:
- **sul telefono** (`tools/device-check.mjs`): controlli veri su Android tramite adb e DevTools della WebView;
- **nel browser del PC** (`tools/pip-harness.mjs`): finge l'app e misura il cartello nel riquadro in tutti gli stati della guida, posizione per posizione. Serve a confrontare prima e dopo, soprattutto quando lo stile del riquadro si sposta (Compito 11).

**File:**
- Modifica: `android/app/build.gradle`, `android/app/src/main/AndroidManifest.xml` (copia di prova solo con `-Pprova=true`, la build normale non cambia)
- Crea: `tools/device-check.mjs`, `tools/pip-harness.mjs`
- Crea (generato): `test/fixtures/pip-layout.json`
- Modifica: `.gitignore`

**Interfacce:**
- Consuma: `GOLDEN_SETTINGS` da `tools/golden-harness.mjs`, `test/fixtures/scenarios.json`, `tools/compare-golden.mjs` (Compito 0).
- Produce: `node tools/device-check.mjs [--gps] [--out cartella]` → stampa un controllo per riga (`OK`, `ERRORE`, `NOTA`), salva `risultati.json` e le schermate in `device-check/`, esce con 1 se un controllo fallisce. `run(name)` in `tools/pip-harness.mjs` → salva `[{name, size:{w,h}, frames:[{fix, kicker, title, visible, plateInside, bigInside, titleCut, subCut, bigPx}], closedByX, idleCloseHarmless}]`.

- [ ] **Passo 1: copia di prova installabile accanto all'app normale**

In `android/app/build.gradle`, dentro `defaultConfig { ... }` dopo `versionName "1.0"`, aggiungi:

```groovy
        manifestPlaceholders = [appLabel: "@string/app_name"]
```

e sostituisci il blocco `buildTypes { ... }` con:

```groovy
    buildTypes {
        // Con -Pprova=true si installa una copia separata ("Tutor prova") accanto all'app normale, per i collaudi
        debug {
            if (project.findProperty('prova') == 'true') {
                applicationIdSuffix ".prova"
                manifestPlaceholders = [appLabel: "Tutor prova"]
            }
        }
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
```

In `android/app/src/main/AndroidManifest.xml` sostituisci `android:label="@string/app_name"` (nel tag `application`) e `android:label="@string/title_activity_main"` (nel tag `activity`) con `android:label="${appLabel}"`. Le due stringhe valgono entrambe "Tutor A1 A4", quindi la build normale non cambia.

- [ ] **Passo 2: installa la copia di prova con il codice di oggi**

```bash
cd /c/Users/Nicco/Desktop/Fancuolo_tutor-refactor && npm run sync && cd android && JAVA_HOME="/c/Program Files/Java/jdk-21" ./gradlew installDebug -Pprova=true
```

Poi controlla: `"$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe" shell pm list packages tutora1a4`
Atteso: sia `package:it.niccomarino.tutora1a4` (l'app normale, non toccata) sia `package:it.niccomarino.tutora1a4.prova`. Sul telefono compare l'icona "Tutor prova".

- [ ] **Passo 3: controlla che la build normale non sia cambiata**

```bash
cd /c/Users/Nicco/Desktop/Fancuolo_tutor-refactor/android && JAVA_HOME="/c/Program Files/Java/jdk-21" ./gradlew :app:processDebugMainManifest -q && grep -rho 'package="[^"]*"\|android:label="[^"]*"' app/build/intermediates/merged_manifest/debug/ | sort -u
```

Atteso: `package="it.niccomarino.tutora1a4"` e `android:label="Tutor A1 A4"` (o `@string/app_name`), nessun `.prova`.

- [ ] **Passo 4: scrivi `tools/device-check.mjs`**

```js
// Collaudo sul telefono collegato via USB: uscita dall'app (Home, Indietro, X del riquadro),
// riquadro Picture-in-Picture sopra Google Maps durante la guida, schermo che resta acceso.
// Usa la copia di prova "Tutor prova" (it.niccomarino.tutora1a4.prova): l'app normale non viene toccata.
// Non cambia impostazioni del telefono. Uso: node tools/device-check.mjs [--gps] [--out cartella]
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

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
  if (i < 0) return {mode: 'nessuno', visible: false, bounds: null};
  let bounds = null;
  for (let k = i + 1; k < Math.min(lines.length, i + 8); k++){
    const m = lines[k].match(/bounds=\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    if (m){ bounds = m.slice(1).map(Number); break; }
  }
  return {mode: (lines[i].match(/mode=([\w-]+)/) || [])[1], visible: /visible=true/.test(lines[i]), bounds};
}
async function waitTask(pred, ms = 6000){
  const t0 = Date.now(); let t = task();
  while (!pred(t) && Date.now() - t0 < ms){ await sleep(400); t = task(); }
  return t;
}
function keepsScreenOn(){
  const blocks = adb('shell', 'dumpsys', 'window', 'windows').split(/\n(?=  Window #)/);
  const mine = blocks.find(b => b.includes(PKG + '/it.niccomarino.tutora1a4.MainActivity'));
  return !!mine && /KEEP_SCREEN_ON/.test(mine);
}
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
// Tocca il riquadro per mostrare i comandi e preme la X; se non la trova, trascina il riquadro sulla chiusura in basso
async function closePip(){
  const t = task();
  if (t.mode !== 'pinned' || !t.bounds) return 'nessun riquadro';
  const [l, tp, r, b] = t.bounds, cx = (l + r) >> 1, cy = (tp + b) >> 1;
  adb('shell', 'input', 'tap', String(cx), String(cy));
  await sleep(1500);
  for (let i = 0; i < 3; i++){
    try {
      adb('shell', 'uiautomator', 'dump', '/sdcard/tutor-ui.xml');
      const xml = adb('shell', 'cat', '/sdcard/tutor-ui.xml');
      const node = (xml.match(/<node [^>]*>/g) || []).find(n => /content-desc="(Chiudi|Close|Ignora|Dismiss)/i.test(n) || /resource-id="[^"]*(dismiss|close)[^"]*"/i.test(n));
      if (node){
        const m = node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
        adb('shell', 'input', 'tap', String((+m[1] + +m[3]) >> 1), String((+m[2] + +m[4]) >> 1));
        return 'pulsante X';
      }
    } catch(e){}
    await sleep(800);
  }
  const [sw, sh] = screenSize();
  adb('shell', 'input', 'swipe', String(cx), String(cy), String(sw >> 1), String(Math.round(sh*0.96)), '1200');
  return 'trascinamento sulla chiusura';
}
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

main().catch(e => check('Collaudo interrotto', false, e.message)).finally(() => {
  try { adb('shell', 'rm', '-f', '/sdcard/tutor-ui.xml'); } catch(e){}
  try { adb('shell', 'am', 'force-stop', PKG); } catch(e){}
  try { adb('forward', '--remove', 'tcp:' + PORT); } catch(e){}
  try { if (ws) ws.close(); } catch(e){}
  try { adb('shell', 'input', 'keyevent', 'KEYCODE_HOME'); } catch(e){}
  writeFileSync(join(outDir, 'risultati.json'), JSON.stringify(results, null, 1));
  const bad = results.filter(r => r.ok === false).length;
  console.log(bad ? bad + ' controlli non superati' : 'Tutti i controlli superati');
  process.exit(bad ? 1 : 0);
});
```

- [ ] **Passo 5: esegui il collaudo sull'app di oggi**

Telefono sbloccato, collegato via USB, Google Maps installato:

```bash
cd /c/Users/Nicco/Desktop/Fancuolo_tutor-refactor && node tools/device-check.mjs && node tools/device-check.mjs --gps
```

Atteso: tutte le righe `OK` (i `NOTA` sono informazioni). Guarda `device-check/riquadro-sopra-maps.png`: il cartello deve essere leggibile sopra Maps. Annota la misura del riquadro stampata (es. `254x159`).
Se un controllo dà `ERRORE` già sull'app di oggi, è un difetto esistente, non del refactoring. Correggi il collaudo se è il collaudo a sbagliare (per esempio la X non trovata: guarda l'XML di `uiautomator`). Se invece è un difetto vero, aggiungilo a `NOTE-MIGLIORIE.md` e chiedi all'utente se va sistemato a parte. Nel resto del piano quel controllo conta come "difetto noto".

- [ ] **Passo 6: scrivi `tools/pip-harness.mjs`**

```js
// Collaudo del riquadro Picture-in-Picture nel browser del PC. Finge di essere dentro l'app (Capacitor finto
// e ponte nativo), guida i percorsi di scenarios.json con la pagina in modalità riquadro e, a ogni cambio di
// cartello, misura cosa si vede. Controlla anche che la X del riquadro (evento tutorpipclosed) termini la guida.
// Uso: apri http://localhost:5173/www/index.html (dopo npm run build o npm run sync), porta la finestra alla
// misura del riquadro data da tools/device-check.mjs, poi nella console:
//   (await import('/tools/pip-harness.mjs?' + Date.now())).run('pip-layout.json')
import { GOLDEN_SETTINGS } from './golden-harness.mjs';

export async function run(name = 'pip-layout.json'){
  if (!window.__tutor) throw new Error('window.__tutor mancante: la pagina non si è avviata');
  if (JSON.stringify(window.__tutor.settings) !== JSON.stringify(GOLDEN_SETTINGS)){
    localStorage.setItem('tutorA1.v1.settings', JSON.stringify(GOLDEN_SETTINGS));
    location.reload();
    return 'Impostazioni del collaudo salvate e pagina ricaricata: esegui di nuovo run().';
  }
  if (!(window.Capacitor && window.Capacitor.finto)){
    const plugin = () => new Proxy({}, {get: (_, m) => m === 'then' ? undefined : () => Promise.resolve(m === 'isSupported' ? {supported: true} : {})});
    window.Capacitor = {finto: true, isNativePlatform: () => true, registerPlugin: plugin};
    await new Promise((ok, ko) => { const s = document.createElement('script'); s.src = 'tutor-native.js?finto'; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
    document.dispatchEvent(new Event('DOMContentLoaded'));
  }
  const scenarios = await (await fetch('/test/fixtures/scenarios.json')).json();
  let deliver = null;
  Object.defineProperty(navigator, 'geolocation', {configurable: true, value: {
    watchPosition(ok){ deliver = ok; return 1; }, clearWatch(){}, getCurrentPosition(){}
  }});
  Object.defineProperty(navigator, 'vibrate', {configurable: true, value: () => true});
  const el = id => document.getElementById(id);
  const vis = sel => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== 'none' && r.width > 0 && r.height > 0; };
  const inside = (r, b) => r.left >= b.left - 1 && r.right <= b.right + 1 && r.top >= b.top - 1 && r.bottom <= b.bottom + 1;
  const cut = id => el(id).scrollWidth > el(id).clientWidth + 1;
  const measure = () => ({
    visible: ['.mapwrap', '.side', '.hud-top', '.stats', '.advice', '.hud-limits', '.simbar', '.toast'].filter(vis),
    plateInside: inside(el('plate').getBoundingClientRect(), {left: 0, top: 0, right: innerWidth, bottom: innerHeight}),
    bigInside: inside(el('pBig').getBoundingClientRect(), document.querySelector('.plate-in').getBoundingClientRect()),
    titleCut: cut('pTitle'), subCut: cut('pSub'),
    bigPx: Math.round(parseFloat(getComputedStyle(el('pBig')).fontSize))
  });

  window.dispatchEvent(new CustomEvent('tutorpip', {detail: true}));
  const out = [];
  for (const sc of scenarios){
    el('histClear').click();
    el('btnDrive').click();
    const frames = [];
    let last = null;
    sc.fixes.forEach((f, i) => {
      deliver({coords: {latitude: f.lat, longitude: f.lon, accuracy: f.accuracy, speed: f.speed, heading: f.heading}, timestamp: f.t});
      const kicker = el('pKicker').textContent, title = el('pTitle').textContent;
      if (kicker + '|' + title === last) return;
      last = kicker + '|' + title;
      frames.push(Object.assign({fix: i, kicker, title}, measure()));
    });
    // la X del riquadro: il ponte nativo riceve "tutorpipclosed" e deve terminare la guida
    window.dispatchEvent(new Event('tutorpipclosed'));
    const closedByX = !window.__tutor.st.running && !document.body.classList.contains('driving');
    window.dispatchEvent(new Event('tutorpipclosed'));
    const idleCloseHarmless = !window.__tutor.st.running && !document.body.classList.contains('driving');
    out.push({name: sc.name, size: {w: innerWidth, h: innerHeight}, frames, closedByX, idleCloseHarmless});
  }
  window.dispatchEvent(new CustomEvent('tutorpip', {detail: false}));
  const res = await fetch('/__save/' + name, {method: 'PUT', body: JSON.stringify(out)});
  return res.status + ' ' + out.map(o => o.name + ': ' + o.frames.length + ' cartelli' + (o.closedByX ? '' : ', X NON termina la guida')).join('; ');
}
```

- [ ] **Passo 7: registra il riquadro dell'app di oggi**

Nel browser integrato apri `http://localhost:5173/www/index.html` (la cartella `www/` è stata creata al Passo 2). Porta la finestra alla misura annotata al Passo 5 con `resize_window` (`width`, `height`). Esegui `run('pip-layout.json')`, due volte se ricarica le impostazioni. Poi `run('pip-check.json')` e:

```bash
node tools/compare-golden.mjs test/fixtures/pip-layout.json test/fixtures/pip-check.json
```

Atteso: `Identico`. Controlla in `pip-layout.json` che tutti i `frames` abbiano `visible: []`, `plateInside: true` e `bigInside: true`, e che ogni scenario abbia `closedByX: true`. Annota i cartelli con `titleCut: true` (titolo tagliato con i puntini): sono il difetto noto n. 6 di `NOTE-MIGLIORIE.md`. Rimetti la finestra con `resize_window` `preset: 'desktop'`.

- [ ] **Passo 8: commit**

Aggiungi a `.gitignore`:

```
device-check/
test/fixtures/pip-check.json
```

```bash
git add android/app/build.gradle android/app/src/main/AndroidManifest.xml tools/device-check.mjs tools/pip-harness.mjs test/fixtures/pip-layout.json .gitignore
git commit -m "Collaudi dell'uscita dall'app e del riquadro sopra Maps; copia di prova installabile con -Pprova=true"
```

---

### Compito 1: sorgenti in `src/` e build che li ricompone identici

Si divide `index.html` in file separati senza cambiare un solo carattere del risultato: la nuova build deve ricostruire esattamente l'`index.html` di oggi.

**File:**
- Crea: `scripts/build.mjs`, `tools/split-index.mjs` (usato una volta e poi cancellato), `test/build.test.js`
- Crea (generati dallo split): `src/index.html`, `src/styles/app.css`, `src/vendor/leaflet.css`, `src/vendor/leaflet.js`, `src/data/tutor-data.json`, `src/app.js`
- Modifica: `package.json`, `.gitattributes`
- Cancella: `scripts/build-www.mjs`

**Interfacce:**
- Produce: `scripts/build.mjs` esporta `readSource(path) -> string`, `render(template, vars, include = readSource) -> string`, `buildPages() -> {web, app}`. Segnaposto nel modello: `<!--@include percorso-->` (file di `src/`, ultimo a capo tolto) e `<!--@var nome-->` (variabili: `viewportFit`, `bridge`).

- [ ] **Passo 1: scrivi `scripts/build.mjs`**

```js
// Costruisce le pagine a partire da src/:
//   index.html   pagina per il browser (GitHub Pages): un solo file con tutto dentro
//   www/         pagina per l'app Capacitor, con il ponte nativo (capacitor.js e tutor-native.js)
// Il modello src/index.html contiene i segnaposto <!--@include percorso--> (un file di src/)
// e <!--@var nome--> (testo diverso tra browser e app). Un segnaposto sconosciuto ferma la build.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = ROOT + 'src/';

const VARS = {
  web: {viewportFit: ', viewport-fit=cover', bridge: ''},
  // Senza viewport-fit=cover Capacitor lascia spazio a barra di stato e barra di navigazione,
  // così la pagina (che non usa i margini safe-area) non finisce sotto l'ora e la batteria
  app: {viewportFit: '', bridge: '\n<script src="capacitor.js"></script>\n<script src="tutor-native.js"></script>'}
};

export function readSource(path){
  return readFileSync(SRC + path, 'utf8').replace(/\r\n/g, '\n').replace(/\n$/, '');
}

export function render(template, vars, include = readSource){
  let out = template.replace(/<!--@include ([\w./-]+)-->/g, (_, path) => include(path));
  out = out.replace(/<!--@var (\w+)-->/g, (_, name) => {
    if (!(name in vars)) throw new Error('Variabile sconosciuta nel modello: ' + name);
    return vars[name];
  });
  const left = out.indexOf('<!--@');
  if (left >= 0) throw new Error('Segnaposto non risolto: ' + out.slice(left, left + 60));
  return out;
}

// Controllo di sintassi degli script della pagina, per non installare un'app che si blocca all'avvio
function checkScripts(html){
  for (const [, code] of html.matchAll(/<script data-keep>([\s\S]*?)<\/script>/g)){
    try { new Function(code); } catch (e) { throw new Error('Errore di sintassi JavaScript nella pagina: ' + e.message); }
  }
}

// Nell'app il messaggio "permesso negato" deve parlare delle impostazioni del telefono, non del browser
// (provvisorio: al Compito 2 lo sostituisce src/platform.js)
function nativeGpsMessage(html){
  const gpsDenied = /gpsNote\('La posizione è bloccata\.[^\n]*?'\);/;
  if (!gpsDenied.test(html)){ console.warn('Attenzione: messaggio di GPS bloccato non trovato, lasciato com\'è.'); return html; }
  return html.replace(gpsDenied, () => "gpsNote('La posizione è bloccata. Apri le impostazioni del telefono, vai su App &gt; Tutor A1 A4 &gt; Autorizzazioni &gt; Posizione e scegli <b>Consenti solo mentre l’app è in uso</b> o <b>Consenti sempre</b>. Intanto puoi usare la simulazione.');");
}

export function buildPages(){
  const template = readSource('index.html');
  const web = render(template, VARS.web);
  const app = nativeGpsMessage(render(template, VARS.app));
  checkScripts(web);
  checkScripts(app);
  return {web, app};
}

function main(){
  const {web, app} = buildPages();
  writeFileSync(ROOT + 'index.html', web + '\n');
  mkdirSync(ROOT + 'www', {recursive: true});
  writeFileSync(ROOT + 'www/index.html', app + '\n');
  copyFileSync(ROOT + 'node_modules/@capacitor/core/dist/capacitor.js', ROOT + 'www/capacitor.js');
  copyFileSync(ROOT + 'native/tutor-native.js', ROOT + 'www/tutor-native.js');
  console.log('Pronte: index.html (browser) e www/ (app)');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
```

- [ ] **Passo 2: aggiorna `package.json`**

Aggiungi `"type": "module",` dopo `"private": true,` e sostituisci il blocco `scripts` con:

```json
  "scripts": {
    "build": "node scripts/build.mjs",
    "test": "node --test \"test/*.test.js\"",
    "serve": "node tools/serve.mjs",
    "device-check": "node tools/device-check.mjs",
    "sync": "npm run build && npx cap sync",
    "android": "npm run sync && npx cap open android",
    "apk": "npm run sync && cd android && gradlew assembleDebug"
  },
```

- [ ] **Passo 3: scrivi lo split una tantum `tools/split-index.mjs`**

```js
// Una tantum: divide index.html nei sorgenti di src/ e verifica che la build li ricomponga identici.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { render, readSource } from '../scripts/build.mjs';

const original = readFileSync('index.html', 'utf8').replace(/\r\n/g, '\n');
let template = original;
const files = {};

function cut(name, re){
  const m = re.exec(template);
  if (!m) throw new Error('Pezzo non trovato: ' + name);
  const [s, e] = m.indices[1];
  files[name] = template.slice(s, e);
  template = template.slice(0, s) + '<!--@include ' + name + '-->' + template.slice(e);
}
function swap(from, to){
  if (template.split(from).length !== 2) throw new Error('Atteso una sola volta nel modello: ' + from);
  template = template.replace(from, () => to);
}

cut('vendor/leaflet.css', /<style>( \.leaflet-pane[^]*?)<\/style>/d);
cut('styles/app.css', /<style>\n([^]*?)\n<\/style>/d);
cut('vendor/leaflet.js', /<script data-keep>\n(\/\* @preserve[^]*?)\n<\/script>/d);
cut('data/tutor-data.json', /<script data-keep type="application\/json" id="tutor-data">([^]*?)<\/script>/d);
cut('app.js', /<script data-keep>\n(\(function\(\)\{[^]*?)\n<\/script>/d);
swap(', viewport-fit=cover', '<!--@var viewportFit-->');
swap('<meta charset="utf-8">', '<meta charset="utf-8"><!--@var bridge-->');

for (const [name, text] of Object.entries(files)){
  mkdirSync(dirname('src/' + name), {recursive: true});
  writeFileSync('src/' + name, text + '\n');
}
writeFileSync('src/index.html', template);

const rebuilt = render(readSource('index.html'), {viewportFit: ', viewport-fit=cover', bridge: ''}) + '\n';
if (rebuilt !== original){
  let i = 0; while (rebuilt[i] === original[i]) i++;
  throw new Error('Ricostruzione diversa al carattere ' + i + ': ' + JSON.stringify(original.slice(i - 40, i + 40)));
}
console.log('src/ pronta, ricostruzione identica (' + original.length + ' caratteri)');
```

- [ ] **Passo 4: esegui lo split**

Esegui: `node tools/split-index.mjs`
Atteso: `src/ pronta, ricostruzione identica (...)`. Se la ricostruzione differisce solo per l'a capo finale, correggi la riga `const rebuilt` togliendo o aggiungendo `'\n'` e ripeti.

- [ ] **Passo 5: scrivi i test della build `test/build.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPages, render } from '../scripts/build.mjs';

const saved = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('index.html nel repository è aggiornato rispetto a src/ (se fallisce: npm run build)', () => {
  const {web} = buildPages();
  assert.ok(web + '\n' === saved, 'index.html diverso da quello che produce la build');
});

test('la pagina per il browser non carica il ponte nativo e copre tutto lo schermo', () => {
  const {web} = buildPages();
  assert.ok(!web.includes('capacitor.js'));
  assert.ok(web.includes('viewport-fit=cover'));
});

test("la pagina per l'app carica il ponte nativo e lascia spazio alle barre di sistema", () => {
  const {app} = buildPages();
  assert.ok(app.includes('<script src="capacitor.js"></script>\n<script src="tutor-native.js"></script>'));
  assert.ok(!app.includes('viewport-fit=cover'));
});

test('un segnaposto con variabile sconosciuta ferma la build', () => {
  assert.throws(() => render('<p><!--@var boh--></p>', {}), /Variabile sconosciuta/);
});

test('un segnaposto scritto male ferma la build', () => {
  assert.throws(() => render('<p><!--@includi x--></p>', {}), /Segnaposto non risolto/);
});
```

- [ ] **Passo 6: esegui i test**

Esegui: `npm test`
Atteso: 5 test superati.

- [ ] **Passo 7: verifica che la build non cambi `index.html`**

Esegui: `npm run build` poi `git diff --ignore-cr-at-eol --stat index.html`
Atteso: nessuna differenza.

- [ ] **Passo 8: rendi leggibili i diff e pulisci**

Aggiungi a `.gitattributes`:

```
src/vendor/** -diff
src/data/** -diff
index.html -diff
```

Cancella `scripts/build-www.mjs` e `tools/split-index.mjs` (restano nella storia di git).

- [ ] **Passo 9: commit**

```bash
git add -A src scripts tools test package.json .gitattributes index.html
git commit -m "Sorgenti in src/ e build con segnaposto espliciti: index.html ricostruito identico"
```

---

### Compito 2: JavaScript come moduli ES con esbuild, messaggio GPS senza ricerca di testo

Da qui il codice dell'app può importare altri file. Si toglie l'ultima sostituzione basata sul testo.

**File:**
- Rinomina: `src/app.js` -> `src/main.js`
- Crea: `src/platform.js`, `test/platform.test.js`
- Modifica: `scripts/build.mjs`, `src/index.html`, `src/main.js`, `test/build.test.js`, `package.json`

**Interfacce:**
- Consuma: `render`, `readSource`, `buildPages` (Compito 1).
- Produce: `src/platform.js` esporta `isNativeApp() -> boolean`, `gpsDeniedMessage() -> string` (HTML). `scripts/build.mjs` esporta in più `checkInlineScript(code) -> code` (lancia un errore se `code` contiene `</script`). Nuova variabile del modello: `notice`.

- [ ] **Passo 1: installa esbuild**

```bash
npm install --save-dev --save-exact esbuild@0.28.2
```

- [ ] **Passo 2: scrivi il test di `platform.js` (fallisce)**

`test/platform.test.js`:

```js
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { isNativeApp, gpsDeniedMessage } from '../src/platform.js';

afterEach(() => { delete globalThis.window; });

test("nel browser il messaggio di GPS negato parla dei permessi del browser", () => {
  globalThis.window = {};
  assert.equal(isNativeApp(), false);
  assert.match(gpsDeniedMessage(), /permesso di usarla/);
});

test("nell'app il messaggio di GPS negato spiega dove trovare l'autorizzazione nel telefono", () => {
  globalThis.window = {Capacitor: {isNativePlatform: () => true}};
  assert.equal(isNativeApp(), true);
  assert.match(gpsDeniedMessage(), /Autorizzazioni &gt; Posizione/);
});

test('senza window (o con Capacitor rotto) si comporta come il browser', () => {
  assert.equal(isNativeApp(), false);
  globalThis.window = {Capacitor: {isNativePlatform(){ throw new Error('rotto'); }}};
  assert.equal(isNativeApp(), false);
});
```

Esegui: `npm test` — Atteso: FAIL, `Cannot find module '.../src/platform.js'`.

- [ ] **Passo 3: scrivi `src/platform.js`**

```js
// Differenze tra la pagina aperta nel browser e la stessa pagina dentro l'app Android (Capacitor)
export function isNativeApp(){
  try {
    const cap = typeof window !== 'undefined' && window.Capacitor;
    return !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  } catch (e) { return false; }
}

export function gpsDeniedMessage(){
  if (isNativeApp()) return 'La posizione è bloccata. Apri le impostazioni del telefono, vai su App &gt; Tutor A1 A4 &gt; Autorizzazioni &gt; Posizione e scegli <b>Consenti solo mentre l’app è in uso</b> o <b>Consenti sempre</b>. Intanto puoi usare la simulazione.';
  return 'La posizione è bloccata. Controlla che il browser abbia il permesso di usarla. Se stai usando l\'app dentro Claude, il visualizzatore può non concederla: scarica l\'app dalla sezione <b>Dati, precisione e uso fuori da Claude</b> e aprila dal browser del telefono. Intanto puoi usare la simulazione.';
}
```

Esegui: `npm test` — Atteso: i 3 test di `platform.test.js` passano.

- [ ] **Passo 4: usa `platform.js` in `main.js`**

```bash
git mv src/app.js src/main.js
```

In `src/main.js` aggiungi come prima riga del file:

```js
import { gpsDeniedMessage } from './platform.js';
```

e nella funzione `onGpsError` sostituisci la riga che inizia con `gpsNote('La posizione è bloccata.` con:

```js
    gpsNote(gpsDeniedMessage());
```

- [ ] **Passo 5: scrivi i nuovi test della build (falliscono)**

In `test/build.test.js` cambia l'import in `import { buildPages, render, checkInlineScript } from '../scripts/build.mjs';` e aggiungi:

```js
test('un </script> dentro il codice ferma la build (romperebbe la pagina)', () => {
  assert.throws(() => checkInlineScript('const s = "</script>";'), /<\/script/);
  assert.equal(checkInlineScript('const s = 1;'), 'const s = 1;');
});

test('tutti gli script in linea hanno data-keep (servono alla copia "Scarica l\'app come file HTML")', () => {
  const {web} = buildPages();
  const inline = [...web.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)].map(m => m[1]);
  assert.ok(inline.length >= 3);
  for (const attrs of inline) assert.match(attrs, /data-keep/);
});
```

Esegui: `npm test` — Atteso: FAIL, `checkInlineScript` non esportata.

- [ ] **Passo 6: aggiorna `scripts/build.mjs` per esbuild**

Aggiungi l'import in cima: `import { buildSync } from 'esbuild';`

Aggiungi a entrambe le variabili in `VARS` la chiave `notice` (stesso valore):

```js
const NOTICE = '\n<!-- Pagina generata da scripts/build.mjs: i sorgenti sono in src/ -->';
const VARS = {
  web: {viewportFit: ', viewport-fit=cover', bridge: '', notice: NOTICE},
  // Senza viewport-fit=cover Capacitor lascia spazio a barra di stato e barra di navigazione,
  // così la pagina (che non usa i margini safe-area) non finisce sotto l'ora e la batteria
  app: {viewportFit: '', bridge: '\n<script src="capacitor.js"></script>\n<script src="tutor-native.js"></script>', notice: NOTICE}
};
```

Cancella la funzione `nativeGpsMessage` e sostituisci `buildPages` con:

```js
export function checkInlineScript(code){
  if (/<\/script/i.test(code)) throw new Error('Il codice contiene "</script": chiuderebbe lo script a metà pagina');
  return code;
}

// Tutti i moduli di src/ partendo da main.js, in un unico script da mettere nella pagina
function bundleMain(){
  const r = buildSync({entryPoints: [SRC + 'main.js'], bundle: true, format: 'iife', charset: 'utf8',
                       legalComments: 'inline', write: false, logLevel: 'silent'});
  return checkInlineScript(r.outputFiles[0].text.replace(/\n$/, ''));
}

export function buildPages(){
  const main = bundleMain();
  const include = path => path === 'main.js' ? main : readSource(path);
  const template = readSource('index.html');
  const web = render(template, VARS.web, include);
  const app = render(template, VARS.app, include);
  checkScripts(web);
  checkScripts(app);
  return {web, app};
}
```

- [ ] **Passo 7: aggiorna il modello `src/index.html`**

Sostituisci `<!--@include app.js-->` con `<!--@include main.js-->`. Sostituisci la riga `<html lang="it">` con `<html lang="it"><!--@var notice-->`.

- [ ] **Passo 8: ricostruisci ed esegui i test**

Esegui: `npm run build` poi `npm test`
Atteso: tutti i test passano.

- [ ] **Passo 9: golden nel browser**

Ricarica `http://localhost:5173/` nel browser integrato, esegui `run('golden-check.json')` (due volte se ricarica le impostazioni), poi:

```bash
node tools/compare-golden.mjs test/fixtures/golden.json test/fixtures/golden-check.json
```

Atteso: `Identico`. Controlla anche `read_console_messages` con `onlyErrors: true`: nessun errore.

Poi il riquadro: apri `http://localhost:5173/www/index.html`, porta la finestra alla misura del riquadro (Compito 0B) ed esegui `(await import('/tools/pip-harness.mjs?' + Date.now())).run('pip-check.json')`, poi:

```bash
node tools/compare-golden.mjs test/fixtures/pip-layout.json test/fixtures/pip-check.json
```

Atteso: `Identico`. Rimetti la finestra con `preset: 'desktop'`.

- [ ] **Passo 10: commit**

```bash
git add -A src scripts test package.json package-lock.json index.html
git commit -m "Moduli ES con esbuild; messaggio GPS negato scelto da platform.js invece che dalla build"
```

---

### Compito 3: `core/format.js`, `core/rules.js`, `core/geo.js`

Funzioni pure copiate così come sono da `src/main.js` (sezioni "formatting", "rules", la funzione `verdictOf` dello storico, `LIMITS`, e `hav`/`bearing`/`angDiff`). In questo compito `main.js` non cambia: le copie lì dentro verranno tolte al Compito 10, quando `main.js` viene riscritto.

**File:**
- Crea: `src/core/format.js`, `src/core/rules.js`, `src/core/geo.js`, `test/format.test.js`, `test/rules.test.js`, `test/geo.test.js`

**Interfacce:**
- Produce: `format.js`: `nf1, nf0, nfKm, nfL` (Intl.NumberFormat it-IT), `clamp(x, a, b)`, `fmtDur(seconds) -> string`, `fmtDist(km) -> string`, `speakDist(km) -> string`, `spk(name) -> string`, `esc(s) -> string`. `rules.js`: `thresholdFor(limit) -> number`, `thrText(limit) -> string`, `verdictOf(avg|null, limit) -> [testo, classe]`, `LIMITS`. `geo.js`: `D2R`, `hav(la1, lo1, la2, lo2) -> metri`, `bearing(la1, lo1, la2, lo2) -> gradi`, `angDiff(a, b) -> gradi`.

- [ ] **Passo 1: scrivi i test (falliscono)**

`test/format.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, fmtDur, fmtDist, speakDist, spk, esc, nfKm, nfL } from '../src/core/format.js';

test('clamp', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(clamp(2, 0, 3), 2);
});

test('fmtDur: secondi e minuti', () => {
  assert.equal(fmtDur(0), '0 s');
  assert.equal(fmtDur(59.4), '59 s');
  assert.equal(fmtDur(61), '1 min 01 s');
  assert.equal(fmtDur(-5), '0 s');
});

test('fmtDist: metri sotto 950 m, poi km con un decimale', () => {
  assert.equal(fmtDist(0.004), '10 m');
  assert.equal(fmtDist(0.456), '460 m');
  assert.equal(fmtDist(3), '3,0 km');
  assert.equal(fmtDist(12.34), '12,3 km');
});

test('speakDist: distanze dette a voce', () => {
  assert.equal(speakDist(0.04), '100 metri');
  assert.equal(speakDist(0.43), '400 metri');
  assert.equal(speakDist(1.2), 'un chilometro');
  assert.equal(speakDist(2.3), '2,5 chilometri');
  assert.equal(speakDist(2.8), '3 chilometri');
});

test('spk: abbreviazioni lette per esteso', () => {
  assert.equal(spk('All. A15 (nord)'), 'allacciamento A 15 lato nord');
  assert.equal(spk('Dir. Roma Nord'), 'diramazione Roma Nord');
  assert.equal(spk('S. Maria Capua Vetere'), 'Santa Maria Capua Vetere');
});

test('esc: caratteri speciali HTML', () => {
  assert.equal(esc('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
});

test('formati numerici italiani', () => {
  assert.equal(nfKm.format(12.05), '12,05');
  assert.equal(nfL.format(11.95), '11,95');
});
```

`test/rules.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { thresholdFor, thrText, verdictOf, LIMITS } from '../src/core/rules.js';

test('soglia: +5 km/h fino a 100, poi riduzione del 5%', () => {
  assert.equal(thresholdFor(90), 95);
  assert.equal(thresholdFor(95), 100);
  assert.ok(Math.abs(thresholdFor(96) - 96/0.95) < 1e-9);
  assert.ok(Math.abs(thresholdFor(130) - 136.8421) < 1e-4);
});

test('soglia mostrata troncata a un decimale', () => {
  assert.equal(thrText(130), '136,8');
  assert.equal(thrText(110), '115,7');
  assert.equal(thrText(100), '105,2');
});

test('esito di un tratto', () => {
  assert.deepEqual(verdictOf(null, 130), ['n/d', '']);
  assert.deepEqual(verdictOf(130, 130), ['in regola', 'ok']);
  assert.deepEqual(verdictOf(136.84, 130), ['sopra il limite, entro la tolleranza', 'tol']);
  assert.deepEqual(verdictOf(136.85, 130), ['oltre la soglia di sanzione', 'bad']);
});

test('limiti proposti', () => {
  assert.deepEqual(LIMITS.map(l => l[0]), [130, 110, 100, 90, 80]);
});
```

`test/geo.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hav, bearing, angDiff } from '../src/core/geo.js';

test('distanza Milano-Roma in linea d\'aria', () => {
  assert.ok(Math.abs(hav(45.4642, 9.19, 41.9028, 12.4964) - 476885) < 1);
});

test('direzione verso nord ed est', () => {
  assert.ok(Math.abs(bearing(45, 9, 46, 9)) < 1e-9);
  assert.ok(Math.abs(bearing(45, 9, 45, 10) - 90) < 1);
});

test('differenza tra angoli', () => {
  assert.equal(angDiff(350, 10), 20);
  assert.equal(angDiff(0, 180), 180);
  assert.equal(angDiff(90, 450), 0);
});
```

Esegui: `npm test` — Atteso: FAIL, moduli non trovati.

- [ ] **Passo 2: scrivi `src/core/format.js`**

```js
// Formattazione di numeri, distanze e durate in italiano, e nomi adatti alla voce
export const nf1 = new Intl.NumberFormat('it-IT', {minimumFractionDigits:1, maximumFractionDigits:1});
export const nf0 = new Intl.NumberFormat('it-IT', {maximumFractionDigits:0});
export const nfKm = new Intl.NumberFormat('it-IT', {maximumFractionDigits:3});
export const nfL = new Intl.NumberFormat('it-IT', {maximumFractionDigits:2});
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export function fmtDur(s){ s = Math.max(0, Math.round(s)); const m = Math.floor(s/60), r = s % 60; return m ? m + ' min ' + String(r).padStart(2,'0') + ' s' : r + ' s'; }
export function fmtDist(km){ return km < 0.95 ? nf0.format(Math.max(10, Math.round(km*100)*10)) + ' m' : nf1.format(km) + ' km'; }
export function speakDist(km){ if (km < 0.95) return (Math.max(100, Math.round(km*10)*100)) + ' metri'; const r = Math.round(km*2)/2; return r === 1 ? 'un chilometro' : nfL.format(r) + ' chilometri'; }
export function spk(n){ return String(n).replace(/All\. /g, 'allacciamento ').replace(/Dir\. /g, 'diramazione ').replace(/S\. Maria/g, 'Santa Maria').replace(/\((nord|sud)\)/g, 'lato $1').replace(/A(\d+)/g, 'A $1'); }
export function esc(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
```

- [ ] **Passo 3: scrivi `src/core/rules.js`**

```js
import { nf1 } from './format.js';

// Art. 345 Reg. CdS: riduzione del 5% sulla velocità misurata, minimo 5 km/h.
export function thresholdFor(limit){ const v = limit + 5; return v <= 100 ? v : limit / 0.95; }
export function thrText(limit){ return nf1.format(Math.floor(thresholdFor(limit)*10)/10); }
export function verdictOf(avg, lim){ if (avg == null) return ['n/d','']; if (avg <= lim) return ['in regola','ok']; if (avg <= thresholdFor(lim)) return ['sopra il limite, entro la tolleranza','tol']; return ['oltre la soglia di sanzione','bad']; }
export const LIMITS = [[130,''],[110,'pioggia'],[100,'neopatentati'],[90,''],[80,'rimorchio']];
```

- [ ] **Passo 4: scrivi `src/core/geo.js`**

```js
// Calcoli sulla sfera terrestre: distanza (metri), direzione (gradi da nord), differenza tra direzioni
export const D2R = Math.PI/180;
export function hav(la1, lo1, la2, lo2){
  const a = Math.sin((la2-la1)*D2R/2)**2 + Math.cos(la1*D2R)*Math.cos(la2*D2R)*Math.sin((lo2-lo1)*D2R/2)**2;
  return 2*6371008.8*Math.asin(Math.sqrt(a));
}
export function bearing(la1, lo1, la2, lo2){
  const y = Math.sin((lo2-lo1)*D2R)*Math.cos(la2*D2R);
  const x = Math.cos(la1*D2R)*Math.sin(la2*D2R) - Math.sin(la1*D2R)*Math.cos(la2*D2R)*Math.cos((lo2-lo1)*D2R);
  return (Math.atan2(y, x)/D2R + 360) % 360;
}
export function angDiff(a, b){ const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }
```

- [ ] **Passo 5: esegui i test**

Esegui: `npm test` — Atteso: tutti passano.

- [ ] **Passo 6: commit**

```bash
git add src/core test
git commit -m "core: formati, regole sulla soglia e geometria in moduli testati"
```

---

### Compito 4: `core/network.js` (tratti, linee, aggancio alla strada)

**File:**
- Crea: `src/core/network.js`, `test/helpers.js`, `test/network.test.js`

**Interfacce:**
- Consuma: `clamp` (format.js), `D2R`, `bearing`, `angDiff` (geo.js).
- Produce: `RAMS`, `GROUPS`, `isPos(d)`, `roadOf(sec) -> 'A1'|'A4'`, `secRel(sec, km) -> km dall'inizio del tratto nel verso di marcia`, `buildNetwork(data) -> {secs, lines}`, `matchPoint(lines, lat, lon, heading, speedMs, acc, trendSign, curRam) -> {line, ram, d, km, sign, score} | null`, `pointAtKm(line, km) -> {lat, lon, brg} | null`. Ogni `sec` ha i campi dei dati (`id, t, r, d, da, ka, a, kb, L, g`) più `sign, towards, name, pos, cls`. Ogni `line` ha `{id, ram, pts, segs, fixedSign, maxDist}`; l'ordine delle linee è `A01S, A01N, D18, D19, VAR, A04E, A04W` (conta per gli spareggi in `matchPoint`).
- Produce (test): `test/helpers.js` esporta `DATA`, `loadFixture(name)`, `network()`, `toPosition(fix)`, `along(line, fromKm, toKm, kmh, t0)`.

- [ ] **Passo 1: scrivi `test/helpers.js`**

```js
// Funzioni comuni ai test
import { readFileSync } from 'node:fs';
import { buildNetwork, pointAtKm } from '../src/core/network.js';

export const DATA = JSON.parse(readFileSync(new URL('../src/data/tutor-data.json', import.meta.url), 'utf8'));
export const loadFixture = name => JSON.parse(readFileSync(new URL('./fixtures/' + name, import.meta.url), 'utf8'));
export const network = () => buildNetwork(DATA);

// Posizione del browser (GeolocationPosition) a partire da una posizione di scenarios.json
export const toPosition = f => ({coords: {latitude: f.lat, longitude: f.lon, accuracy: f.accuracy, speed: f.speed, heading: f.heading}, timestamp: f.t});

// Posizioni una al secondo lungo una linea, a velocità costante
export function along(line, fromKm, toKm, kmh, t0 = 1790000000000){
  const out = [], dir = Math.sign(toKm - fromKm), inc = line.pts[line.pts.length-1][2] > line.pts[0][2];
  for (let km = fromKm, t = t0; (toKm - km)*dir > 0; km += dir*kmh/3600, t += 1000){
    const p = pointAtKm(line, km);
    out.push({coords: {latitude: p.lat, longitude: p.lon, accuracy: 6, speed: kmh/3.6,
              heading: (dir > 0) === inc ? p.brg : (p.brg + 180) % 360}, timestamp: t});
  }
  return out;
}
```

- [ ] **Passo 2: scrivi `test/network.test.js` (fallisce)**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { network } from './helpers.js';
import { matchPoint, pointAtKm, secRel, roadOf } from '../src/core/network.js';

const {secs, lines} = network();
const byId = id => secs.find(s => s.id === id);
const line = id => lines.find(l => l.id === id);

test('83 tratti e 7 linee, nell\'ordine usato per gli spareggi', () => {
  assert.equal(secs.length, 83);
  assert.deepEqual(lines.map(l => l.id), ['A01S', 'A01N', 'D18', 'D19', 'VAR', 'A04E', 'A04W']);
});

test('tratto Milano Sud-Lodi verso sud', () => {
  const s = byId(12);
  assert.equal(s.name, 'Milano Sud → Lodi');
  assert.equal(s.sign, 1);
  assert.equal(s.towards, 'verso Napoli');
  assert.equal(s.pos, true);
  assert.equal(s.cls, 'sud');
  assert.equal(roadOf(s), 'A1');
});

test('tratto Ospitaletto-Rovato verso ovest, chilometri decrescenti', () => {
  const s = byId(75);
  assert.equal(s.sign, -1);
  assert.equal(s.towards, 'verso Torino');
  assert.equal(s.pos, false);
  assert.equal(s.cls, 'nord');
  assert.equal(roadOf(s), 'A4');
});

test('secRel misura i km dall\'inizio del tratto nel verso di marcia', () => {
  assert.equal(secRel(byId(12), 12.3), 0);
  assert.ok(Math.abs(secRel(byId(12), 21.2) - 8.9) < 1e-9);
  assert.ok(Math.abs(secRel(byId(75), 202.3) - 4.67) < 1e-9);
});

test('un punto sulla A1 verso sud viene agganciato alla carreggiata sud', () => {
  const p = pointAtKm(line('A01S'), 15);
  const m = matchPoint(lines, p.lat, p.lon, p.brg, 35, 6, 0, null);
  assert.equal(m.ram, 'A01');
  assert.equal(m.sign, 1);
  assert.ok(Math.abs(m.km - 15) < 0.05);
});

test('stesso punto con direzione opposta: carreggiata nord', () => {
  const p = pointAtKm(line('A01S'), 15);
  const m = matchPoint(lines, p.lat, p.lon, (p.brg + 180) % 360, 35, 6, 0, null);
  assert.equal(m.ram, 'A01');
  assert.equal(m.sign, -1);
  assert.ok(Math.abs(m.km - 15) < 0.5);
});

test('un punto lontano dalle autostrade non viene agganciato', () => {
  assert.equal(matchPoint(lines, 40.0, 9.0, 0, 30, 6, 0, null), null);
});

test('pointAtKm fuori dal tracciato restituisce null', () => {
  assert.equal(pointAtKm(line('A01S'), 9999), null);
});
```

Esegui: `npm test` — Atteso: FAIL, `network.js` non trovato.

- [ ] **Passo 3: scrivi `src/core/network.js`**

```js
// Rete autostradale: tratti Tutor, linee del tracciato e aggancio di una posizione GPS alla strada
import { clamp } from './format.js';
import { D2R, bearing, angDiff } from './geo.js';

export const RAMS = {
  A01:{name:'A1', plus:'verso Napoli', minus:'verso Milano'},
  D18:{name:'A1 Diramazione Roma Nord', plus:'verso Roma', minus:'verso la A1'},
  D19:{name:'A1 Diramazione Roma Sud', plus:'verso Roma', minus:'verso la A1'},
  VAR:{name:'A1 Variante di Valico', plus:'verso Firenze', minus:'verso Bologna'},
  A04:{name:'A4', plus:'verso Trieste', minus:'verso Torino'}
};
export const GROUPS = ['A1 Milano-Bologna','A1 Bologna-Firenze','A1 Variante di Valico','A1 Firenze-Roma','A1 Diramazione Roma Nord','A1 Roma-Napoli','A1 Diramazione Roma Sud','A4 Milano-Brescia','A4 Venezia-Trieste'];
export const isPos = d => d === 'Sud' || d === 'Est';
export const roadOf = s => s.r === 'A04' ? 'A4' : 'A1';
export const secRel = (s, km) => (km - s.ka) * s.sign;

// [id, ramo, chiave in data.ch, verso fisso (+1, -1, 0 = entrambi), distanza massima dall'asse in metri]
const LINE_DEFS = [
  ['A01S','A01','S',+1,55], ['A01N','A01','N',-1,55],
  ['D18','D18','D18',0,320], ['D19','D19','D19',0,220], ['VAR','VAR','VAR',0,260],
  ['A04E','A04','AE',+1,55], ['A04W','A04','AW',-1,55]
];

function makeLine(id, ram, pts, fixedSign, maxDist){
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++){
    const a = pts[i], b = pts[i+1];
    const kx = Math.cos((a[0]+b[0])/2*D2R)*111320, ky = 110574;
    segs.push({a, b, kx, ky, minLat:Math.min(a[0],b[0]), maxLat:Math.max(a[0],b[0]), minLon:Math.min(a[1],b[1]), maxLon:Math.max(a[1],b[1]), brg:bearing(a[0],a[1],b[0],b[1])});
  }
  return {id, ram, pts, segs, fixedSign, maxDist};
}

export function buildNetwork(data){
  const secs = data.secs.map(s => Object.assign({}, s, {sign: Math.sign(s.kb - s.ka)}));
  secs.forEach(s => { s.towards = s.sign > 0 ? RAMS[s.r].plus : RAMS[s.r].minus; s.name = s.da + ' → ' + s.a; s.pos = isPos(s.d); s.cls = s.pos ? 'sud' : 'nord'; });
  const lines = LINE_DEFS.map(([id, ram, key, fixedSign, maxDist]) => makeLine(id, ram, data.ch[key], fixedSign, maxDist));
  return {secs, lines};
}

export function matchPoint(lines, lat, lon, heading, speedMs, acc, trendSign, curRam){
  const hasHeading = heading != null && !isNaN(heading) && speedMs != null && speedMs > 4;
  const out = [];
  for (const L of lines){
    const lim = L.maxDist + Math.min(acc || 25, 60);
    const pad = lim/90000 + 0.0004;
    let best = null;
    for (let i = 0; i < L.segs.length; i++){
      const s = L.segs[i];
      if (lat < s.minLat - pad || lat > s.maxLat + pad || lon < s.minLon - pad*1.45 || lon > s.maxLon + pad*1.45) continue;
      const ax = s.a[1]*s.kx, ay = s.a[0]*s.ky, bx = s.b[1]*s.kx, by = s.b[0]*s.ky, px = lon*s.kx, py = lat*s.ky;
      const dx = bx-ax, dy = by-ay, L2 = dx*dx + dy*dy;
      const t = L2 ? clamp(((px-ax)*dx + (py-ay)*dy)/L2, 0, 1) : 0;
      const d = Math.hypot(px - (ax + t*dx), py - (ay + t*dy));
      if (d <= lim && (!best || d < best.d)) best = {d, i, t};
    }
    if (!best) continue;
    const s = L.segs[best.i];
    const km = s.a[2] + best.t*(s.b[2]-s.a[2]);
    let sign = L.fixedSign, pen = 0;
    if (hasHeading){
      const hd = angDiff(heading, s.brg);
      if (L.fixedSign){ if (hd > 55) pen = 1e6; }
      else if (hd <= 65) sign = +1; else if (hd >= 115) sign = -1; else pen = 1e6;
    } else if (trendSign){
      if (L.fixedSign && L.fixedSign !== trendSign) pen = 90;
      if (!L.fixedSign) sign = trendSign;
    }
    if (pen >= 1e6) continue;
    out.push({line:L, ram:L.ram, d:best.d, km, sign, score:best.d + pen + (L.fixedSign ? 0 : 35) - (curRam && curRam === L.ram ? 50 : 0)});
  }
  out.sort((a, b) => a.score - b.score);
  return out[0] || null;
}

export function pointAtKm(L, km){
  const P = L.pts, inc = P[P.length-1][2] > P[0][2];
  for (let i = 0; i < P.length - 1; i++){
    const a = P[i][2], b = P[i+1][2];
    if (inc ? (km >= a && km <= b) : (km <= a && km >= b)){
      const t = b === a ? 0 : (km - a)/(b - a);
      return {lat:P[i][0] + t*(P[i+1][0]-P[i][0]), lon:P[i][1] + t*(P[i+1][1]-P[i][1]), brg:L.segs[i].brg};
    }
  }
  return null;
}
```

- [ ] **Passo 4: esegui i test**

Esegui: `npm test` — Atteso: tutti passano.

- [ ] **Passo 5: commit**

```bash
git add src/core/network.js test
git commit -m "core: rete autostradale e aggancio della posizione alla strada, con test sui dati veri"
```

---

### Compito 5: `core/store.js` (impostazioni e storico)

**File:**
- Crea: `src/core/store.js`, `test/store.test.js`

**Interfacce:**
- Produce: `SKEY = 'tutorA1.v1.settings'`, `HKEY = 'tutorA1.v1.history'`, `DEFAULT_SETTINGS`, `createStore(storage|null) -> {settings, saveSettings(), history (getter, dal più recente), addHistory(entry), clearHistory()}`. `settings` è un oggetto modificato sul posto: chi lo riceve vede sempre i valori attuali. `storage` è qualsiasi oggetto con `getItem`/`setItem` (o `null`): gli errori di lettura e scrittura vengono ignorati come oggi.

- [ ] **Passo 1: scrivi `test/store.test.js` (fallisce)**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, SKEY, HKEY, DEFAULT_SETTINGS } from '../src/core/store.js';

function memoryStorage(init = {}){
  const m = new Map(Object.entries(init));
  return {getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => { m.set(k, String(v)); }};
}

test('le chiavi di localStorage non cambiano (ci sono i dati di chi usa già l\'app)', () => {
  assert.equal(SKEY, 'tutorA1.v1.settings');
  assert.equal(HKEY, 'tutorA1.v1.history');
});

test('senza dati salvati usa le impostazioni predefinite', () => {
  const s = createStore(memoryStorage());
  assert.deepEqual(s.settings, {limit:130, margin:2, preAlert:1, voice:true, beep:true, instWarn:true});
  assert.deepEqual(s.history, []);
});

test('le impostazioni salvate in parte si uniscono a quelle predefinite', () => {
  const s = createStore(memoryStorage({[SKEY]: JSON.stringify({limit:110, voice:false})}));
  assert.equal(s.settings.limit, 110);
  assert.equal(s.settings.voice, false);
  assert.equal(s.settings.margin, 2);
});

test('dati rovinati: si riparte dai valori predefiniti', () => {
  const s = createStore(memoryStorage({[SKEY]: '{rotto', [HKEY]: '"non una lista"'}));
  assert.deepEqual(s.settings, DEFAULT_SETTINGS);
  assert.deepEqual(s.history, []);
});

test('senza localStorage (null) funziona in memoria senza errori', () => {
  const s = createStore(null);
  s.settings.limit = 90;
  s.saveSettings();
  s.addHistory({id:1});
  assert.equal(s.history.length, 1);
});

test('modificare le impostazioni non tocca i valori predefiniti', () => {
  const s = createStore(memoryStorage());
  s.settings.limit = 80;
  assert.equal(DEFAULT_SETTINGS.limit, 130);
});

test('saveSettings scrive le impostazioni attuali', () => {
  const storage = memoryStorage();
  const s = createStore(storage);
  s.settings.margin = 4;
  s.saveSettings();
  assert.equal(JSON.parse(storage.getItem(SKEY)).margin, 4);
});

test('lo storico tiene gli ultimi 60 tratti, il più recente per primo, e li salva', () => {
  const storage = memoryStorage();
  const s = createStore(storage);
  for (let i = 1; i <= 61; i++) s.addHistory({id:i});
  assert.equal(s.history.length, 60);
  assert.equal(s.history[0].id, 61);
  assert.equal(JSON.parse(storage.getItem(HKEY)).length, 60);
  s.clearHistory();
  assert.deepEqual(s.history, []);
  assert.equal(storage.getItem(HKEY), '[]');
});
```

Esegui: `npm test` — Atteso: FAIL, `store.js` non trovato.

- [ ] **Passo 2: scrivi `src/core/store.js`**

```js
// Impostazioni e storico dei tratti, salvati in localStorage (o in un oggetto simile; null = solo in memoria).
// Le chiavi non vanno cambiate: contengono i dati di chi usa già l'app.
export const SKEY = 'tutorA1.v1.settings', HKEY = 'tutorA1.v1.history';
export const DEFAULT_SETTINGS = {limit:130, margin:2, preAlert:1, voice:true, beep:true, instWarn:true};

export function createStore(storage){
  const get = (k, d) => { try { const v = storage.getItem(k); return v == null ? d : JSON.parse(v); } catch(e){ return d; } };
  const set = (k, v) => { try { storage.setItem(k, JSON.stringify(v)); } catch(e){} };
  const settings = Object.assign({}, DEFAULT_SETTINGS, get(SKEY, {}) || {});
  let history = get(HKEY, []);
  if (!Array.isArray(history)) history = [];
  return {
    settings,
    saveSettings(){ set(SKEY, settings); },
    get history(){ return history; },
    addHistory(entry){ history.unshift(entry); history = history.slice(0, 60); set(HKEY, history); },
    clearHistory(){ history = []; set(HKEY, history); }
  };
}
```

- [ ] **Passo 3: esegui i test**

Esegui: `npm test` — Atteso: tutti passano.

- [ ] **Passo 4: commit**

```bash
git add src/core/store.js test/store.test.js
git commit -m "core: impostazioni e storico con chiavi di localStorage invariate"
```

---

### Compito 6: `core/metrics.js` (media in corso e consiglio)

**File:**
- Crea: `src/core/metrics.js`, `test/metrics.test.js`

**Interfacce:**
- Consuma: `clamp` (format.js), `thresholdFor` (rules.js), `secRel` (network.js).
- Produce: `computeMetrics(active, fix, km, settings) -> {elapsed, dist, rel, remKm, vNow, avg, lim, thr, warnAt, vMaxRest, proj, status, settled}` dove `active = {sec, tStart, odoStart, relStart}` (secondi, metri, km), `fix = {t, odo, v}` (secondi, metri, m/s o null), `status` è `'ok' | 'warn' | 'alarm'`. `adviceText(metrics) -> string`.

- [ ] **Passo 1: scrivi `test/metrics.test.js` (fallisce)**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMetrics, adviceText } from '../src/core/metrics.js';

// Tratto finto di 10 km dal km 0, verso crescente; limite 130, margine 2 (allarme a 134,8)
const sec = {ka:0, L:10, sign:1};
const active = {sec, tStart:0, odoStart:0, relStart:0};
const settings = {limit:130, margin:2};
const at = (km, seconds, kmh) => computeMetrics(active, {t:seconds, odo:km*1000, v:kmh == null ? null : kmh/3.6}, km, settings);

test('media sotto il limite: tutto bene', () => {
  const m = at(5, 150, 120);
  assert.ok(Math.abs(m.avg - 120) < 1e-9);
  assert.ok(Math.abs(m.proj - 120) < 1e-9);
  assert.equal(m.status, 'ok');
  assert.equal(m.remKm, 5);
  assert.equal(adviceText(m), 'Rispettando il limite di 130 chiudi il tratto in regola.');
});

test('media sopra il limite ma sotto la soglia di allarme: avviso', () => {
  const m = at(5, 135, 133.3);
  assert.equal(m.status, 'warn');
  assert.equal(adviceText(m), 'Media sopra 130 ma entro la tolleranza. Rispetta il limite fino al portale.');
});

test('media oltre la soglia: allarme e velocità massima per rientrare', () => {
  const m = at(5, 120, 150);
  assert.equal(m.status, 'alarm');
  assert.equal(adviceText(m), 'Media oltre la soglia: rallenta e resta sotto 122 km/h fino al portale.');
});

test('allarme a fine tratto, quando non basta più rallentare un po\'', () => {
  const m = at(9.5, 200, 150);
  assert.equal(m.status, 'alarm');
  assert.equal(adviceText(m), 'Media oltre la soglia: rallenta, più tempo resti sotto il limite più la media scende.');
});

test('nei primi secondi la media non è ancora affidabile', () => {
  const m = at(0.3, 10, 108);
  assert.equal(m.settled, false);
  assert.ok(Math.abs(m.avg - 108) < 1e-9);
  assert.equal(m.status, 'ok');
  assert.equal(adviceText(m), 'Calcolo della media in corso. Limite 130.');
});

test('subito dopo il portale si mostra la velocità istantanea, o niente se manca', () => {
  assert.equal(at(0.02, 2, 120).avg, 120);
  assert.equal(at(0.02, 2, null).avg, null);
});
```

Esegui: `npm test` — Atteso: FAIL, `metrics.js` non trovato.

- [ ] **Passo 2: scrivi `src/core/metrics.js`**

```js
// Media nel tratto in corso, proiezione all'arrivo e consiglio di velocità
import { clamp } from './format.js';
import { thresholdFor } from './rules.js';
import { secRel } from './network.js';

export function computeMetrics(a, f, km, settings){
  const s = a.sec;
  const elapsed = Math.max(0, f.t - a.tStart), dist = Math.max(0, f.odo - a.odoStart);
  const rel = clamp(secRel(s, km), 0, s.L), remKm = Math.max(0, s.L - rel);
  const Leff = Math.max(0.1, s.L - a.relStart);
  const vNow = f.v != null ? f.v*3.6 : null;
  const settled = elapsed >= 12 && dist >= 250;
  const avg = settled || (elapsed >= 4 && dist > 60) ? dist/elapsed*3.6 : vNow;
  const lim = settings.limit, thr = thresholdFor(lim), warnAt = thr - settings.margin;
  const tLeft = Leff/warnAt*3600 - elapsed;
  const vMaxRest = tLeft > 0 ? remKm/tLeft*3600 : Infinity;
  const proj = vNow && vNow > 10 && elapsed > 0 ? (dist/1000 + remKm)/((elapsed + remKm/vNow*3600)/3600) : null;
  let status = 'ok';
  if (settled && avg >= warnAt) status = 'alarm';
  else if (settled && (avg > lim || (proj != null && proj >= warnAt))) status = 'warn';
  return {elapsed, dist, rel, remKm, vNow, avg, lim, thr, warnAt, vMaxRest, proj, status, settled};
}

export function adviceText(m){
  const lim = m.lim;
  if (!m.settled) return 'Calcolo della media in corso. Limite ' + lim + '.';
  if (m.status === 'alarm'){
    if (isFinite(m.vMaxRest) && m.vMaxRest >= 60) return 'Media oltre la soglia: rallenta e resta sotto ' + Math.floor(Math.min(m.vMaxRest, lim)) + ' km/h fino al portale.';
    return 'Media oltre la soglia: rallenta, più tempo resti sotto il limite più la media scende.';
  }
  if (!isFinite(m.vMaxRest) || m.vMaxRest >= lim) return m.avg > lim ? 'Media sopra ' + lim + ' ma entro la tolleranza. Rispetta il limite fino al portale.' : 'Rispettando il limite di ' + lim + ' chiudi il tratto in regola.';
  return 'Per chiudere sotto la soglia resta sotto ' + Math.floor(m.vMaxRest) + ' km/h fino al portale.';
}
```

- [ ] **Passo 3: esegui i test**

Esegui: `npm test` — Atteso: tutti passano.

- [ ] **Passo 4: commit**

```bash
git add src/core/metrics.js test/metrics.test.js
git commit -m "core: calcolo della media nel tratto e consiglio di velocità, con test"
```

---

### Compito 7: `core/tracker.js` e `core/messages.js` (il cuore, verificato col golden)

Il tracker riceve le posizioni e decide tratti, media e allarmi, ma non parla e non tocca la pagina: emette eventi. `messages.js` trasforma ogni evento in testo, suono e vibrazione. Così `say()` non mescola più tre cose.

**File:**
- Crea: `src/core/tracker.js`, `src/core/messages.js`, `test/messages.test.js`, `test/tracker.test.js`, `test/golden.test.js`

**Interfacce:**
- Consuma: `clamp`, `speakDist`, `spk` (format.js), `hav`, `bearing` (geo.js), `thresholdFor`, `verdictOf` (rules.js), `matchPoint`, `secRel` (network.js), `computeMetrics` (metrics.js), `DEFAULT_SETTINGS` (store.js), helpers dei test.
- Produce: `createTracker({secs, lines, settings}) -> {st, on(fn) -> stacca, start(source), stop(), pushPosition(position), refresh(), resetPosition()}`. `st` mantiene i nomi di oggi (`running, source, fix, prevFix, odo, jumps, onRoad, matchStreak, missStreak, ram, km, sign, trendSign, trendKm, active, next, alerted, result, instSince, lastInst, lastWall`). `st.result = {sec, avg, lim, dur, until, partial, sim}`. Eventi (`{type, ...}`), nell'ordine in cui avvengono per ogni posizione:
  - `section-abort {reason: 'direction'|'gps-unstable'|'off-road'|null}` (null = senza annuncio: Esci o salto della simulazione)
  - `section-finish {result}` (va nello storico)
  - `section-start {sec, mid, after}` (`after` = risultato del tratto appena chiuso se questo comincia subito dopo, altrimenti null)
  - `section-end {result}` (fine annunciata da sola)
  - `pre-alert {sec, dist, limit}`
  - `instant-over {limit, silentVoice}`
  - `alarm {repeat}`, `alarm-cleared {}`
  - `position {fix}` (posizione elaborata: ridisegnare)
- Produce: `toHistoryEntry(result, t) -> {t, id, da, a, avg, lim, partial, sim, dur}`.
- Produce: `announcementFor(event) -> {text, tone, silentVoice?, vibrate?} | null`, `endText(result) -> string`. `tone` è una chiave di `TONES` in `ui/audio.js`: `pre, start, alarm, end, soft, inst`.

- [ ] **Passo 1: scrivi `test/messages.test.js` (fallisce)**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { announcementFor, endText } from '../src/core/messages.js';

const sec = {da:'All. A21', a:'Fiorenzuola', L:10.5};

test('preavviso', () => {
  assert.deepEqual(announcementFor({type:'pre-alert', sec, dist:1.0, limit:130}),
    {text:'Tra un chilometro inizia il Tutor, da allacciamento A 21 a Fiorenzuola, 10,5 chilometri. Limite 130.', tone:'pre'});
});

test('inizio tratto dal portale', () => {
  assert.deepEqual(announcementFor({type:'section-start', sec, mid:false, after:null}),
    {text:'Inizio Tutor. 10,5 chilometri fino a Fiorenzuola.', tone:'start', vibrate:120});
});

test('ingresso a metà tratto', () => {
  assert.deepEqual(announcementFor({type:'section-start', sec, mid:true, after:null}),
    {text:'Sei dentro il tratto Tutor da allacciamento A 21 a Fiorenzuola. Media calcolata da qui.', tone:'soft', vibrate:120});
});

test('fine di un tratto e inizio del successivo in un solo annuncio', () => {
  assert.deepEqual(announcementFor({type:'section-start', sec, mid:false, after:{avg:128.4, lim:130}}),
    {text:'Fine Tutor. Media 128 chilometri orari, in regola. Subito dopo inizia il Tutor fino a Fiorenzuola, 10,5 chilometri.', tone:'start', vibrate:120});
});

test('fine tratto da sola, anche senza media', () => {
  assert.deepEqual(announcementFor({type:'section-end', result:{avg:null, lim:130}}), {text:'Fine Tutor. Media non disponibile.', tone:'end'});
  assert.equal(endText({avg:140, lim:130}), 'Fine Tutor. Media 140 chilometri orari, oltre la soglia di sanzione.');
});

test('misura interrotta, con e senza annuncio', () => {
  assert.deepEqual(announcementFor({type:'section-abort', reason:'direction'}), {text:'Direzione cambiata: misura del tratto interrotta.', tone:'soft'});
  assert.deepEqual(announcementFor({type:'section-abort', reason:'gps-unstable'}), {text:'Segnale GPS instabile: misura del tratto interrotta.', tone:'soft'});
  assert.deepEqual(announcementFor({type:'section-abort', reason:'off-road'}), {text:'Sei uscito dal tracciato: misura del tratto interrotta.', tone:'soft'});
  assert.equal(announcementFor({type:'section-abort', reason:null}), null);
});

test('allarmi', () => {
  assert.deepEqual(announcementFor({type:'alarm', repeat:false}), {text:'Attenzione, media oltre la soglia. Rallenta.', tone:'alarm', vibrate:[220,100,220]});
  assert.deepEqual(announcementFor({type:'alarm', repeat:true}), {text:'Media ancora oltre la soglia.', tone:'alarm', vibrate:[220,100,220]});
  assert.deepEqual(announcementFor({type:'alarm-cleared'}), {text:'Media rientrata sotto la soglia.', tone:'soft'});
});

test('velocità istantanea, muta se è già in corso l\'allarme della media', () => {
  assert.deepEqual(announcementFor({type:'instant-over', limit:130, silentVoice:true}), {text:'Velocità oltre 130', tone:'inst', silentVoice:true});
});

test('gli altri eventi non si annunciano', () => {
  assert.equal(announcementFor({type:'position', fix:{}}), null);
  assert.equal(announcementFor({type:'section-finish', result:{}}), null);
});
```

Esegui: `npm test` — Atteso: FAIL, `messages.js` non trovato.

- [ ] **Passo 2: scrivi `src/core/messages.js`**

```js
// Cosa dire (e con quale segnale e vibrazione) per ogni evento del tracker.
// Restituisce {text, tone, silentVoice?, vibrate?} oppure null se l'evento non va annunciato.
import { speakDist, spk } from './format.js';
import { verdictOf } from './rules.js';

const ALARM_VIBRATION = [220,100,220];
const ABORT_TEXT = {
  'direction': 'Direzione cambiata: misura del tratto interrotta.',
  'gps-unstable': 'Segnale GPS instabile: misura del tratto interrotta.',
  'off-road': 'Sei uscito dal tracciato: misura del tratto interrotta.'
};

export function endText(r){
  const [vt] = verdictOf(r.avg, r.lim);
  return 'Fine Tutor. Media ' + (r.avg != null ? Math.round(r.avg) + ' chilometri orari, ' + vt : 'non disponibile') + '.';
}

export function announcementFor(ev){
  switch (ev.type){
    case 'pre-alert':
      return {text:'Tra ' + speakDist(ev.dist) + ' inizia il Tutor, da ' + spk(ev.sec.da) + ' a ' + spk(ev.sec.a) + ', ' + speakDist(ev.sec.L) + '. Limite ' + ev.limit + '.', tone:'pre'};
    case 'section-start': {
      const s = ev.sec;
      if (ev.after) return {text:endText(ev.after) + ' Subito dopo inizia il Tutor fino a ' + spk(s.a) + ', ' + speakDist(s.L) + '.', tone:'start', vibrate:120};
      if (ev.mid) return {text:'Sei dentro il tratto Tutor da ' + spk(s.da) + ' a ' + spk(s.a) + '. Media calcolata da qui.', tone:'soft', vibrate:120};
      return {text:'Inizio Tutor. ' + speakDist(s.L) + ' fino a ' + spk(s.a) + '.', tone:'start', vibrate:120};
    }
    case 'section-end':
      return {text:endText(ev.result), tone:'end'};
    case 'section-abort':
      return ev.reason ? {text:ABORT_TEXT[ev.reason], tone:'soft'} : null;
    case 'alarm':
      return {text: ev.repeat ? 'Media ancora oltre la soglia.' : 'Attenzione, media oltre la soglia. Rallenta.', tone:'alarm', vibrate:ALARM_VIBRATION};
    case 'alarm-cleared':
      return {text:'Media rientrata sotto la soglia.', tone:'soft'};
    case 'instant-over':
      return {text:'Velocità oltre ' + ev.limit, tone:'inst', silentVoice:ev.silentVoice};
    default:
      return null;
  }
}
```

Esegui: `npm test` — Atteso: i test di `messages.test.js` passano.

- [ ] **Passo 3: scrivi `test/golden.test.js` (fallisce)**

```js
// Il tracker deve riprodurre esattamente quello che faceva l'app originale (registrato in golden.json)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { network, loadFixture, toPosition } from './helpers.js';
import { createTracker, toHistoryEntry } from '../src/core/tracker.js';
import { announcementFor } from '../src/core/messages.js';

export const GOLDEN_SETTINGS = {limit:130, margin:2, preAlert:1, voice:false, beep:false, instWarn:true};
const scenarios = loadFixture('scenarios.json');
const golden = loadFixture('golden.json');

for (const sc of scenarios){
  test('golden ' + sc.name + ': annunci, vibrazioni e storico', () => {
    const g = golden.find(x => x.name === sc.name);
    const {secs, lines} = network();
    const tracker = createTracker({secs, lines, settings: {...GOLDEN_SETTINGS}});
    let toasts = [], vib = [];
    const history = [];
    tracker.on(ev => {
      if (ev.type === 'section-finish'){ const {t, ...h} = toHistoryEntry(ev.result, 0); history.push(h); }
      const a = announcementFor(ev);
      if (a){ toasts.push(a.text); if (a.vibrate) vib.push(a.vibrate); }
    });
    tracker.start('gps');
    sc.fixes.forEach((f, i) => {
      toasts = []; vib = [];
      tracker.pushPosition(toPosition(f));
      assert.deepEqual(toasts, g.frames[i].toasts, sc.name + ', posizione ' + i + ': annunci');
      assert.deepEqual(vib, g.frames[i].vib, sc.name + ', posizione ' + i + ': vibrazioni');
    });
    tracker.stop();
    assert.deepEqual(history, g.history, sc.name + ': storico');
  });
}
```

Esegui: `npm test` — Atteso: FAIL, `tracker.js` non trovato.

- [ ] **Passo 4: scrivi `src/core/tracker.js`**

```js
// La guida: riceve le posizioni GPS (o simulate) e segue strada, tratti Tutor, media e allarmi.
// Non tocca la pagina e non parla: comunica con eventi (testi in messages.js). Vedi docs/ARCHITETTURA.md.
import { clamp } from './format.js';
import { hav, bearing } from './geo.js';
import { thresholdFor } from './rules.js';
import { matchPoint, secRel } from './network.js';
import { computeMetrics } from './metrics.js';

export function toHistoryEntry(r, t){
  return {t, id:r.sec.id, da:r.sec.da, a:r.sec.a, avg:r.avg, lim:r.lim, partial:r.partial, sim:r.sim, dur:r.dur};
}

export function createTracker({secs, lines, settings}){
  const st = {running:false, source:null, fix:null, prevFix:null, odo:0, jumps:0,
    onRoad:false, matchStreak:0, missStreak:0, ram:null, km:null, sign:0, trendSign:0, trendKm:null,
    active:null, next:null, alerted:new Set(), result:null, instSince:null, lastInst:0, lastWall:0};
  const listeners = [];
  const emit = (type, data) => { const ev = Object.assign({type}, data); listeners.forEach(fn => fn(ev)); };

  function reset(){
    Object.assign(st, {fix:null, prevFix:null, odo:0, jumps:0, onRoad:false, matchStreak:0, missStreak:0, ram:null, km:null,
      sign:0, trendSign:0, trendKm:null, active:null, next:null, result:null, instSince:null, lastInst:0, lastWall:0});
    st.alerted = new Set();
  }

  function pushPosition(p){
    if (!st.running) return;
    const c = p.coords, t = (p.timestamp || Date.now())/1000;
    const fix = {lat:c.latitude, lon:c.longitude, acc:c.accuracy || 30, t,
      heading:(c.heading != null && !isNaN(c.heading)) ? c.heading : null,
      v:(c.speed != null && !isNaN(c.speed) && c.speed >= 0) ? c.speed : null};
    const prev = st.fix;
    if (prev && t <= prev.t) return;
    st.lastWall = Date.now()/1000;
    if (prev){
      const dt = t - prev.t, dPos = hav(prev.lat, prev.lon, fix.lat, fix.lon);
      // scarta i salti di posizione impossibili (oltre 270 km/h), salvo che si ripetano
      if (dt > 0 && dPos/dt > 75 && dPos > 150){
        st.jumps++;
        if (st.jumps < 3) return;
        st.jumps = 0; st.fix = null; st.prevFix = null; st.matchStreak = 0;
        if (st.active) abort('gps-unstable');
        return;
      }
      st.jumps = 0;
      if (fix.v == null) fix.v = dt > 0 ? dPos/dt : 0;
      if (fix.v > 75) fix.v = prev.v != null ? prev.v : 0;
      if (fix.heading == null && dPos > 8) fix.heading = bearing(prev.lat, prev.lon, fix.lat, fix.lon);
      st.odo += (dt <= 10 && prev.v != null) ? (prev.v + fix.v)/2*dt : dPos;
    }
    fix.odo = st.odo;
    st.prevFix = prev; st.fix = fix;

    const m = matchPoint(lines, fix.lat, fix.lon, fix.heading, fix.v, fix.acc, st.trendSign, st.onRoad ? st.ram : null);
    if (m){
      if (st.trendKm != null && st.ram === m.ram){ const dk = m.km - st.trendKm; if (Math.abs(dk) > 0.05){ st.trendSign = Math.sign(dk); st.trendKm = m.km; } }
      else st.trendKm = m.km;
      const prevKm = st.ram === m.ram ? st.km : null, prevSign = st.sign;
      st.missStreak = 0; st.matchStreak++;
      st.ram = m.ram; st.km = m.km; st.sign = m.sign || st.trendSign || 0;
      st.onRoad = st.matchStreak >= 2;
      if (st.onRoad && st.sign) updateSections(prevKm, prevSign);
    } else {
      st.missStreak++; st.matchStreak = 0;
      if (st.missStreak >= 6){
        if (st.active) abort('off-road');
        st.onRoad = false; st.ram = null; st.km = null; st.sign = 0; st.next = null; st.trendKm = null; st.trendSign = 0;
        st.alerted.clear();
      }
    }
    checkInstant(fix);
    evaluateAlarm();
    emit('position', {fix});
  }

  function updateSections(prevKm, prevSign){
    const f = st.fix, pf = st.prevFix, km = st.km, sign = st.sign;
    let ended = null;
    if (st.active){
      const a = st.active, s = a.sec;
      if (s.r !== st.ram || s.sign !== sign) abort('direction');
      else {
        const rel = secRel(s, km);
        if (rel >= s.L){
          let tEnd = f.t, odoEnd = f.odo;
          if (prevKm != null && pf){
            const r0 = secRel(s, prevKm);
            if (rel !== r0){ const fr = clamp((s.L - r0)/(rel - r0), 0, 1); tEnd = pf.t + fr*(f.t - pf.t); odoEnd = pf.odo + fr*(f.odo - pf.odo); }
          }
          ended = finishSection(tEnd, odoEnd);
        }
      }
    }
    const cands = secs.filter(s => s.r === st.ram && s.sign === sign);
    if (!st.active){
      const inside = cands.find(s => { const r = secRel(s, km); return r >= 0 && r < s.L - 0.05; });
      if (inside && !(st.result && st.result.sec === inside)){
        let tStart = f.t, odoStart = f.odo, mid = true;
        if (prevKm != null && pf && prevSign === sign){
          const r0 = secRel(inside, prevKm), r1 = secRel(inside, km);
          if (r0 < 0 && r1 >= 0 && r1 > r0){ const fr = clamp(-r0/(r1 - r0), 0, 1); tStart = pf.t + fr*(f.t - pf.t); odoStart = pf.odo + fr*(f.odo - pf.odo); mid = false; }
        }
        startSection(inside, tStart, odoStart, mid, ended);
        ended = null;
      }
    }
    let next = null, best = Infinity;
    cands.forEach(s => { const r = secRel(s, km); if (r < 0 && -r < best){ best = -r; next = s; } });
    st.next = next ? {sec:next, dist:best} : null;
    if (ended) emit('section-end', {result:ended});
    if (!st.active && next && best <= settings.preAlert + 0.05 && !st.alerted.has(next.id)){
      st.alerted.add(next.id);
      emit('pre-alert', {sec:next, dist:best, limit:settings.limit});
    }
  }

  function startSection(s, tStart, odoStart, mid, after){
    st.active = {sec:s, tStart, odoStart, mid, status:'ok', lastAlarm:0, relStart: mid ? clamp(secRel(s, st.km), 0, s.L) : 0};
    st.result = null; st.alerted.delete(s.id);
    emit('section-start', {sec:s, mid, after});
  }

  function finishSection(tEnd, odoEnd){
    const a = st.active, s = a.sec, dt = tEnd - a.tStart, dist = odoEnd - a.odoStart;
    const avg = dt > 5 ? dist/dt*3.6 : null;
    st.result = {sec:s, avg, lim:settings.limit, dur:dt, until:st.fix.t + 25, partial:a.mid, sim:st.source === 'sim'};
    st.active = null; st.alerted.clear();
    emit('section-finish', {result:st.result});
    return st.result;
  }

  function abort(reason){
    st.active = null;
    emit('section-abort', {reason});
  }

  function checkInstant(f){
    if (!settings.instWarn || !st.onRoad || f.v == null){ st.instSince = null; return; }
    const v = f.v*3.6, thr = thresholdFor(settings.limit);
    if (v > thr){
      if (st.instSince == null) st.instSince = f.t;
      if (f.t - st.instSince >= 3 && f.t - st.lastInst > 25){
        st.lastInst = f.t;
        emit('instant-over', {limit:settings.limit, silentVoice:!!(st.active && st.active.status === 'alarm')});
      }
    } else st.instSince = null;
  }

  // Passaggi di stato dell'allarme sulla media (prima stava in renderHUD)
  function evaluateAlarm(){
    const a = st.active;
    if (!st.running || !a) return;
    const m = computeMetrics(a, st.fix, st.km, settings);
    if (m.status !== a.status){
      if (m.status === 'alarm'){ a.lastAlarm = st.fix.t; emit('alarm', {repeat:false}); }
      else if (a.status === 'alarm') emit('alarm-cleared', {});
      a.status = m.status;
    } else if (m.status === 'alarm' && st.fix.t - a.lastAlarm > 30){
      a.lastAlarm = st.fix.t;
      emit('alarm', {repeat:true});
    }
  }

  return {
    st,
    on(fn){ listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
    start(source){ reset(); st.running = true; st.source = source; },
    stop(){ if (st.active) abort(null); st.running = false; },
    pushPosition,
    // Da chiamare quando cambiano limite o margine: l'allarme può scattare o rientrare subito
    refresh(){ evaluateAlarm(); },
    // Salto della simulazione al prossimo Tutor: si riparte senza posizione precedente
    resetPosition(){
      if (st.active) abort(null);
      st.fix = null; st.prevFix = null; st.matchStreak = 0; st.trendKm = null; st.result = null; st.alerted.clear();
    }
  };
}
```

- [ ] **Passo 5: esegui il golden**

Esegui: `npm test`
Atteso: i 5 test `golden ...` passano. Se uno fallisce, il messaggio indica scenario e posizione: confronta riga per riga la funzione corrispondente in `src/main.js` (onPosition, updateSections, startActive, finishActive, abortActive, checkInstant, renderHUD) e correggi `tracker.js`, non il golden.

- [ ] **Passo 6: scrivi `test/tracker.test.js` per i casi fuori dal golden**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { network, along } from './helpers.js';
import { createTracker, toHistoryEntry } from '../src/core/tracker.js';
import { DEFAULT_SETTINGS } from '../src/core/store.js';

const {secs, lines} = network();
const A01S = lines.find(l => l.id === 'A01S');
const make = () => {
  const settings = {...DEFAULT_SETTINGS};
  const tracker = createTracker({secs, lines, settings});
  const events = [];
  tracker.on(e => events.push(e));
  return {tracker, settings, events};
};

test('senza start() le posizioni vengono ignorate', () => {
  const {tracker, events} = make();
  along(A01S, 15, 15.1, 120).forEach(tracker.pushPosition);
  assert.deepEqual(events, []);
  assert.equal(tracker.st.fix, null);
});

test('abbassare il limite durante il tratto fa scattare subito l\'allarme', () => {
  const {tracker, settings, events} = make();
  tracker.start('gps');
  along(A01S, 12.0, 15.0, 125).forEach(tracker.pushPosition);
  assert.equal(tracker.st.active.sec.id, 12);
  assert.ok(!events.some(e => e.type === 'alarm'));
  settings.limit = 100;
  tracker.refresh();
  assert.deepEqual(events.at(-1), {type:'alarm', repeat:false});
});

test('Esci durante un tratto: misura interrotta senza annuncio', () => {
  const {tracker, events} = make();
  tracker.start('gps');
  along(A01S, 12.0, 13.0, 125).forEach(tracker.pushPosition);
  tracker.stop();
  assert.deepEqual(events.at(-1), {type:'section-abort', reason:null});
  assert.equal(tracker.st.active, null);
  assert.equal(tracker.st.running, false);
});

test('una nuova guida riparte da zero', () => {
  const {tracker} = make();
  tracker.start('gps');
  along(A01S, 12.0, 13.0, 125).forEach(tracker.pushPosition);
  tracker.start('sim');
  assert.equal(tracker.st.fix, null);
  assert.equal(tracker.st.odo, 0);
  assert.equal(tracker.st.jumps, 0);
  assert.equal(tracker.st.source, 'sim');
});

test('voce dello storico con gli stessi campi di prima', () => {
  const r = {sec:{id:12, da:'Milano Sud', a:'Lodi'}, avg:120.5, lim:130, dur:266, partial:false, sim:true};
  assert.deepEqual(toHistoryEntry(r, 5), {t:5, id:12, da:'Milano Sud', a:'Lodi', avg:120.5, lim:130, partial:false, sim:true, dur:266});
});
```

Esegui: `npm test` — Atteso: tutti passano.

- [ ] **Passo 7: commit**

```bash
git add src/core/tracker.js src/core/messages.js test
git commit -m "core: tracker della guida a eventi e testi degli annunci, verificati sul golden"
```

---

### Compito 8: `core/hud-view.js` (cosa mostrare nella schermata di guida)

**File:**
- Crea: `src/core/hud-view.js`, `test/hud-view.test.js`
- Modifica: `test/golden.test.js`

**Interfacce:**
- Consuma: `nf0, nf1, nfKm, nfL, fmtDur, fmtDist` (format.js), `thresholdFor, thrText, verdictOf` (rules.js), `RAMS` (network.js), `computeMetrics, adviceText` (metrics.js), `st` del tracker.
- Produce: `hudView(st, settings) -> {stats:{lim, thr, thrLabel, inst, instHot}, road:{title, sim, sub}, plate:{cls, kicker, title, big, unit, sub}, progress:{fill, from, to}|null, advice, highlight}`. `highlight`: `undefined` = non cambiare l'evidenziazione sulla mappa, `null` = togliere, un tratto = evidenziarlo.

- [ ] **Passo 1: aggiungi il confronto della schermata al golden (fallisce)**

In `test/golden.test.js` aggiungi l'import `import { hudView } from '../src/core/hud-view.js';`, la funzione:

```js
// Gli stessi campi che l'harness legge dalla pagina. Chrome scrive "45%" per una larghezza "45.0%".
function snapshot(v){
  return {
    pKicker:v.plate.kicker, pTitle:v.plate.title, pBig:v.plate.big, pUnit:v.plate.unit, pSub:v.plate.sub, advice:v.advice,
    hudRoad:v.road.title + (v.road.sim ? 'Simulazione' : '') + v.road.sub,
    sInst:v.stats.inst, sLim:String(v.stats.lim), sThr:v.stats.thr, sThrL:v.stats.thrLabel,
    plate:'plate ' + v.plate.cls, prog:!!v.progress,
    fill:v.progress ? parseFloat(v.progress.fill) + '%' : null,
    pFrom:v.progress ? v.progress.from : null, pTo:v.progress ? v.progress.to : null
  };
}
```

e un secondo test per scenario, dopo il primo `for`:

```js
for (const sc of scenarios){
  test('golden ' + sc.name + ': schermata di guida', () => {
    const g = golden.find(x => x.name === sc.name);
    const {secs, lines} = network();
    const settings = {...GOLDEN_SETTINGS};
    const tracker = createTracker({secs, lines, settings});
    let rendered = false, last = null;
    tracker.on(ev => { if (ev.type === 'position') rendered = true; });
    tracker.start('gps');
    sc.fixes.forEach((f, i) => {
      rendered = false;
      tracker.pushPosition(toPosition(f));
      // la pagina si ridisegna solo quando la posizione è stata elaborata: altrimenti resta quella di prima
      if (rendered) last = snapshot(hudView(tracker.st, settings));
      const {toasts, vib, ...want} = g.frames[i];
      assert.deepEqual(last, want, sc.name + ', posizione ' + i + ': schermata');
    });
  });
}
```

Esegui: `npm test` — Atteso: FAIL, `hud-view.js` non trovato.

- [ ] **Passo 2: scrivi `src/core/hud-view.js`**

```js
// Cosa mostrare nella schermata di guida, calcolato dallo stato del tracker. Non tocca la pagina:
// ui/hud.js applica la vista. highlight: undefined = lascia com'è, null = togli, tratto = evidenzia.
import { nf0, nf1, nfKm, nfL, fmtDur, fmtDist } from './format.js';
import { thresholdFor, thrText, verdictOf } from './rules.js';
import { RAMS } from './network.js';
import { computeMetrics, adviceText } from './metrics.js';

export function hudView(st, settings){
  const f = st.fix, lim = settings.limit, thr = thresholdFor(lim);
  const vNow = f && f.v != null ? f.v*3.6 : null;
  const speed = vNow != null ? nf0.format(vNow) : '–';
  const sim = st.source === 'sim';
  const view = {
    stats: {lim, thr:thrText(lim), thrLabel: settings.margin ? 'soglia, allarme a ' + nf1.format(thr - settings.margin) : 'soglia con tolleranza',
            inst:speed, instHot: vNow != null && vNow > thr},
    road: !f ? {title:'In attesa del segnale GPS', sim, sub:'Tieni il telefono con vista del cielo'}
      : st.onRoad && st.ram ? {title:RAMS[st.ram].name + ', km ' + nf1.format(st.km), sim,
          sub:(st.sign ? (st.sign > 0 ? RAMS[st.ram].plus : RAMS[st.ram].minus) : 'direzione da determinare') + ', precisione GPS ' + nf0.format(f.acc) + ' m'}
      : {title:'Fuori da A1 e A4', sim, sub:'Precisione GPS ' + nf0.format(f.acc) + ' m'},
    plate: null, progress: null, advice: '', highlight: undefined
  };
  const plate = (cls, kicker, title, big, unit, sub) => { view.plate = {cls, kicker, title, big, unit, sub}; };

  if (st.active){
    const a = st.active, s = a.sec, m = computeMetrics(a, f, st.km, settings);
    plate(m.status, a.mid ? 'Tutor in corso, media parziale' : 'Tutor in corso', s.name,
      m.avg != null ? nf0.format(m.avg) : '–', 'km/h di media',
      nf1.format(m.dist/1000) + ' km percorsi in ' + fmtDur(m.elapsed) + (m.proj != null && m.settled ? ', a questo ritmo chiudi a ' + nf0.format(m.proj) : ''));
    view.progress = {fill:(m.rel / s.L * 100).toFixed(1) + '%', from:'km ' + nfKm.format(s.ka), to:'mancano ' + fmtDist(m.remKm)};
    view.advice = adviceText(m);
  } else if (st.result && f && f.t < st.result.until){
    const r = st.result, [vt, vc] = verdictOf(r.avg, r.lim);
    plate(vc === 'ok' ? 'done-ok' : vc === 'tol' ? 'done-tol' : 'done-bad', 'Tratto concluso' + (r.partial ? ', misura parziale' : ''), r.sec.name,
      r.avg != null ? nf1.format(r.avg) : '–', 'km/h di media', vt.charAt(0).toUpperCase() + vt.slice(1) + ', tempo ' + fmtDur(r.dur));
    view.advice = st.next ? 'Prossimo Tutor tra ' + fmtDist(st.next.dist) + '.' : '';
  } else if (!f){
    plate('', 'Avvio', 'Sto cercando la tua posizione', '–', '', 'Il monitoraggio parte appena il GPS ti trova sulla A1 o sulla A4.');
  } else if (!st.onRoad){
    plate('', 'Fuori da A1 e A4', 'Il monitoraggio parte quando entri in una delle due autostrade', speed, 'km/h', '');
  } else if (!st.sign){
    plate('', 'Sulla ' + RAMS[st.ram].name, 'Sto capendo in che direzione vai', speed, 'km/h', '');
  } else if (st.next){
    const n = st.next, near = n.dist <= settings.preAlert + 0.05;
    const eta = vNow && vNow > 20 ? ', circa ' + fmtDur(n.dist/vNow*3600) : '';
    const meters = n.dist < 0.95;
    const big = meters ? nf0.format(Math.max(10, Math.round(n.dist*100)*10)) : nf1.format(n.dist);
    plate(near ? 'go' : '', near ? 'Il Tutor sta per iniziare' : 'Prossimo Tutor', n.sec.name, big, meters ? 'm al portale' : 'km al portale',
      'Tratto di ' + nfL.format(n.sec.L) + ' km' + eta);
    view.highlight = n.sec;
    view.advice = near ? 'Limite ' + lim + ': al portale di inizio parte il calcolo della media.' : '';
  } else {
    plate('', 'Nessun Tutor più avanti', 'In questa direzione non ci sono altri tratti controllati', speed, 'km/h', '');
    view.highlight = null;
  }
  return view;
}
```

- [ ] **Passo 3: scrivi `test/hud-view.test.js` per i casi fuori dal golden**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hudView } from '../src/core/hud-view.js';

const emptyState = {fix:null, source:'gps', active:null, result:null, onRoad:false, ram:null, km:null, sign:0, next:null};

test('prima del primo segnale GPS', () => {
  const v = hudView(emptyState, {limit:130, margin:2, preAlert:1});
  assert.equal(v.road.title, 'In attesa del segnale GPS');
  assert.equal(v.plate.kicker, 'Avvio');
  assert.equal(v.progress, null);
  assert.equal(v.highlight, undefined);
  assert.equal(v.stats.inst, '–');
});

test('soglia e margine nelle statistiche', () => {
  assert.equal(hudView(emptyState, {limit:130, margin:2, preAlert:1}).stats.thrLabel, 'soglia, allarme a 134,8');
  assert.equal(hudView(emptyState, {limit:130, margin:0, preAlert:1}).stats.thrLabel, 'soglia con tolleranza');
  assert.equal(hudView(emptyState, {limit:130, margin:0, preAlert:1}).stats.thr, '136,8');
});

test('in simulazione la riga della strada lo segnala', () => {
  assert.equal(hudView({...emptyState, source:'sim'}, {limit:130, margin:2, preAlert:1}).road.sim, true);
});
```

- [ ] **Passo 4: esegui i test**

Esegui: `npm test` — Atteso: tutti passano, compresi i 5 `golden ...: schermata di guida`.

- [ ] **Passo 5: commit**

```bash
git add src/core/hud-view.js test
git commit -m "core: vista della schermata di guida separata dal disegno, verificata sul golden"
```

---

### Compito 9: `core/simulator.js`

**File:**
- Crea: `src/core/simulator.js`, `test/simulator.test.js`

**Interfacce:**
- Consuma: `clamp` (format.js), `pointAtKm`, `secRel` (network.js).
- Produce: `createSimulator({secs, lines, random = Math.random}) -> {sim, setup(secId, kmh, nowSec) -> boolean, step() -> position|null, nextSection() -> sec|null, jumpBefore(sec)}`. `sim = {line, km, sign, speed, warp, t}`; `sim.speed` e `sim.warp` si cambiano dall'interfaccia. `step()` avanza di 0,5 s × warp e restituisce una posizione come quella del browser, `null` a fine tracciato.

- [ ] **Passo 1: scrivi `test/simulator.test.js` (fallisce)**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { network } from './helpers.js';
import { createSimulator } from '../src/core/simulator.js';
import { pointAtKm } from '../src/core/network.js';

const {secs, lines} = network();
const make = () => createSimulator({secs, lines, random: () => 0.5});

test('si parte 2,2 km prima del tratto scelto, sulla carreggiata giusta', () => {
  const s = make();
  assert.equal(s.setup(12, 120, 1000), true);
  assert.equal(s.sim.line.id, 'A01S');
  assert.ok(Math.abs(s.sim.km - 10.1) < 1e-9);
  assert.equal(s.sim.speed, 120);
});

test('tratto inesistente', () => {
  assert.equal(make().setup(9999, 120, 1000), false);
});

test('ogni passo avanza di mezzo secondo alla velocità impostata', () => {
  const s = make();
  s.setup(12, 120, 1000);
  const p = s.step();
  const want = pointAtKm(s.sim.line, s.sim.km);
  assert.ok(Math.abs(s.sim.km - (10.1 + 120/3600*0.5)) < 1e-9);
  assert.equal(p.timestamp, 1000500);
  assert.ok(Math.abs(p.coords.latitude - want.lat) < 1e-12);
  assert.ok(Math.abs(p.coords.speed - 120/3.6) < 1e-12);
  assert.equal(p.coords.heading, want.brg);
});

test('il tempo accelerato allunga il passo', () => {
  const s = make();
  s.setup(12, 120, 1000);
  s.sim.warp = 15;
  s.step();
  assert.ok(Math.abs(s.sim.km - (10.1 + 120/3600*7.5)) < 1e-9);
});

test('prossimo Tutor e salto a 1,4 km dal portale', () => {
  const s = make();
  s.setup(12, 120, 1000);
  const n = s.nextSection();
  assert.equal(n.id, 12);
  s.jumpBefore(n);
  assert.ok(Math.abs(s.sim.km - 10.9) < 1e-9);
});

test('a fine tracciato step() restituisce null', () => {
  const s = make();
  s.setup(12, 120, 1000);
  s.sim.km = 761.5;
  assert.equal(s.step(), null);
});
```

Esegui: `npm test` — Atteso: FAIL, `simulator.js` non trovato.

- [ ] **Passo 2: scrivi `src/core/simulator.js`**

```js
// Simulazione di guida: posizioni lungo un tracciato a velocità impostata, senza timer né pagina.
// random si può sostituire nei test per avere posizioni sempre uguali.
import { clamp } from './format.js';
import { pointAtKm, secRel } from './network.js';

export function createSimulator({secs, lines, random = Math.random}){
  const sim = {line:null, km:0, sign:1, speed:125, warp:1, t:0};
  return {
    sim,
    setup(id, v, nowSec){
      const s = secs.find(x => x.id === id);
      if (!s) return false;
      const line = lines.find(l => l.ram === s.r && (l.fixedSign === s.sign || l.fixedSign === 0));
      const P = line.pts, kmin = Math.min(P[0][2], P[P.length-1][2]), kmax = Math.max(P[0][2], P[P.length-1][2]);
      Object.assign(sim, {line, sign:s.sign, speed:v, km:clamp(s.ka - s.sign*2.2, kmin + 0.01, kmax - 0.01), t:nowSec});
      return true;
    },
    step(){
      const dt = 0.5*sim.warp;
      sim.t += dt;
      const v = Math.max(0, sim.speed + (random() - 0.5)*1.6);
      sim.km += sim.sign * v/3600 * dt;
      const p = pointAtKm(sim.line, sim.km);
      if (!p) return null;
      const inc = sim.line.pts[sim.line.pts.length-1][2] > sim.line.pts[0][2];
      const along = (sim.sign > 0) === inc;
      const heading = along ? p.brg : (p.brg + 180) % 360;
      const j = () => (random() - 0.5)*0.00005;
      return {coords:{latitude:p.lat + j(), longitude:p.lon + j(), accuracy:6, speed:v/3.6, heading}, timestamp:sim.t*1000};
    },
    nextSection(){
      const cands = secs.filter(s => s.r === sim.line.ram && s.sign === sim.sign && secRel(s, sim.km) < -0.3)
        .sort((a, b) => secRel(b, sim.km) - secRel(a, sim.km));
      return cands[0] || null;
    },
    jumpBefore(n){ sim.km = n.ka - n.sign*1.4; }
  };
}
```

- [ ] **Passo 3: esegui i test**

Esegui: `npm test` — Atteso: tutti passano.

- [ ] **Passo 4: commit**

```bash
git add src/core/simulator.js test/simulator.test.js
git commit -m "core: simulatore di guida senza timer, con test deterministici"
```

---

### Compito 10: interfaccia in `src/ui/` e nuovo `main.js`

Si sostituisce il vecchio `main.js` (il monolite) con moduli dell'interfaccia e un `main.js` che li collega. È il passo in cui l'app comincia a usare `core/`.

**File:**
- Crea: `src/ui/dom.js`, `src/ui/map.js`, `src/ui/sidebar.js`, `src/ui/settings-panel.js`, `src/ui/history-panel.js`, `src/ui/hud.js`, `src/ui/audio.js`, `src/ui/sim-controls.js`, `src/ui/download.js`
- Riscrivi: `src/main.js`

**Interfacce:**
- Consuma: tutto `core/` (Compiti 3-9), `gpsDeniedMessage` (platform.js), `L` globale di Leaflet.
- Produce:
  - `ui/dom.js`: `$(selettore, radice?)`.
  - `ui/map.js`: `createMapView({data, secs, lines, isDriving, currentFix, onSectionClick}) -> {map, highlight(sec|null), fitAll(), fitSection(sec), showPopup(latlng, html), updateMe(fix), setFollow(on)}`.
  - `ui/sidebar.js`: `createSidebar({secs, settings, mapView, onSimulate}) -> {selectSection(sec, zoom, at)}`.
  - `ui/settings-panel.js`: `createSettingsPanel({settings, save, onChange, say})`.
  - `ui/history-panel.js`: `createHistoryPanel(store) -> {render()}`.
  - `ui/hud.js`: `createHud() -> {render(view), toast(text), flash(), signalLost(gapSeconds, limit, inSection), gpsTrouble(text)}`.
  - `ui/audio.js`: `createAudio(settings) -> {init(), tones(kind), speak(text, kind), cancel(), vibrate(pattern)}`.
  - `ui/sim-controls.js`: `createSimControls({secs, simulator, enterDrive, pushPosition, resetPosition, say, onJump}) -> {start(secId, kmh), stopTimer()}`.
  - `ui/download.js`: `setupDownload(pristineHtml|null)`.

- [ ] **Passo 1: scrivi `src/ui/dom.js`**

```js
export const $ = (s, r) => (r || document).querySelector(s);
```

- [ ] **Passo 2: scrivi `src/ui/map.js`**

```js
/* global L */
// Mappa Leaflet: tracciato, tratti Tutor, portali, città, mappa di sfondo e posizione dell'utente.
import { esc, nfKm } from '../core/format.js';
import { pointAtKm } from '../core/network.js';
import { $ } from './dom.js';

const CITIES = [['Milano',45.4642,9.19],['Lodi',45.314,9.503],['Piacenza',45.0526,9.693],['Parma',44.8015,10.3279],['Reggio Emilia',44.6983,10.6312],['Modena',44.6471,10.9252],['Bologna',44.4949,11.3426],['Firenze',43.7696,11.2558],['Arezzo',43.4633,11.8796],['Orvieto',42.7185,12.1107],['Roma',41.9028,12.4964],['Frosinone',41.64,13.351],['Cassino',41.492,13.831],['Caserta',41.0726,14.3323],['Napoli',40.8518,14.2681],['Torino',45.0703,7.6869],['Novara',45.4469,8.6219],['Bergamo',45.6983,9.6773],['Brescia',45.5416,10.2118],['Verona',45.4384,10.9916],['Vicenza',45.5455,11.5354],['Padova',45.4064,11.8768],['Venezia',45.4408,12.3155],['Udine',46.0711,13.2346],['Trieste',45.6495,13.7768]];
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const isDark = () => {
  const t = document.documentElement.getAttribute('data-theme');
  if (t) return t === 'dark';
  try { return matchMedia('(prefers-color-scheme: dark)').matches; } catch(e){ return false; }
};

export function createMapView({data, secs, lines, isDriving, currentFix, onSectionClick}){
  const map = L.map('map', {preferCanvas:true, zoomControl:false, minZoom:5, maxZoom:17, zoomSnap:0.5, zoomDelta:0.5, wheelPxPerZoomLevel:90});
  L.control.zoom({position:'topright', zoomInTitle:'Ingrandisci', zoomOutTitle:'Riduci'}).addTo(map);
  map.attributionControl.setPrefix(false);
  map.attributionControl.addAttribution('Tracciato © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>, tratti Tutor da autostrade.it e infoviaggiando.it');

  const regions = L.polygon(data.reg.map(r => [r]), {interactive:false, weight:1, fillOpacity:1});
  regions.addTo(map);
  const allRoad = [data.ch.S, data.ch.N, data.ch.D18, data.ch.D19, data.ch.VAR, data.ch.AE, data.ch.AW].map(p => p.map(q => [q[0], q[1]]));
  const roadCase = L.polyline(allRoad, {interactive:false, weight:6, lineCap:'round', lineJoin:'round'}).addTo(map);
  const roadLine = L.polyline(allRoad, {interactive:false, weight:2.2, lineCap:'round', lineJoin:'round'}).addTo(map);

  const secLayer = {};
  function secStyle(s, hi){
    const pos = s.pos;
    return {color: css(pos ? '--sud' : '--nord'), weight: (pos ? 9 : 4.5) + (hi ? 5 : 0), opacity: hi ? 1 : 0.92, lineCap:'round', lineJoin:'round'};
  }
  const drawOrder = secs.slice().sort((a, b) => (a.pos ? 0 : 1) - (b.pos ? 0 : 1));
  const gateLayers = [];
  const gatesGroup = L.layerGroup(), casGroup = L.layerGroup();
  drawOrder.forEach(s => {
    const pl = L.polyline(s.g, secStyle(s, false)).addTo(map);
    pl.on('click', ev => onSectionClick(s, ev.latlng));
    secLayer[s.id] = pl;
  });
  drawOrder.forEach(s => {
    const st = L.circleMarker(s.g[0], {radius:6.5, weight:2.5, fillOpacity:1});
    const en = L.circleMarker(s.g[s.g.length-1], {radius:5, weight:3, fillOpacity:1});
    st.bindTooltip('Inizio: ' + esc(s.da) + ', km ' + nfKm.format(s.ka), {direction:'top'});
    en.bindTooltip('Fine: ' + esc(s.a) + ', km ' + nfKm.format(s.kb), {direction:'top'});
    st.on('click', ev => onSectionClick(s, ev.latlng)); en.on('click', ev => onSectionClick(s, ev.latlng));
    gatesGroup.addLayer(st); gatesGroup.addLayer(en);
    gateLayers.push({s, st, en});
  });
  data.cas.forEach(c => {
    L.circleMarker([c.la, c.lo], {radius:3, weight:1, color:'#fff', fillColor:'#6b7772', fillOpacity:1, interactive:false})
     .bindTooltip(esc(c.n), {permanent:true, direction:'right', offset:[5,0], className:'lbl lbl-cas', interactive:false}).addTo(casGroup);
  });
  [['A01S',750],['A04E',500]].forEach(([id, max]) => {
    const ln = lines.find(l => l.id === id);
    for (let k = 50; k <= max; k += 50){
      const p = pointAtKm(ln, k);
      if (p) L.circleMarker([p.lat, p.lon], {radius:0.1, opacity:0, fillOpacity:0, interactive:false})
        .bindTooltip((id === 'A04E' ? 'A4 ' : 'A1 ') + 'km ' + k, {permanent:true, direction:'left', offset:[-6,0], className:'lbl lbl-km', interactive:false}).addTo(map);
    }
  });
  CITIES.forEach(c => L.marker([c[1], c[2]], {interactive:false, keyboard:false, icon:L.divIcon({className:'', html:'<div class="city">' + c[0] + '</div>', iconSize:[0,0]})}).addTo(map));

  // Mappa stradale di sfondo (OpenStreetMap; nel tema scuro è scurita con un filtro CSS). Nel visualizzatore di Claude le immagini
  // esterne sono bloccate: in quel caso resta la mappa vettoriale disegnata qui sopra.
  let tileLayer = null, tileDark = null, tilesOk = false;
  function setTiles(){
    if (!tilesOk) return;
    const dark = isDark();
    if (tileLayer && tileDark === dark) return;
    if (tileLayer) map.removeLayer(tileLayer);
    tileDark = dark;
    let errors = 0, loads = 0;
    tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19, className: dark ? 'tiles-dark' : '', attribution:'Mappa © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'});
    tileLayer.on('tileload', () => { loads++; });
    tileLayer.on('tileerror', () => { errors++; if (errors > 12 && loads === 0 && tileLayer){ map.removeLayer(tileLayer); tileLayer = null; tilesOk = false; document.body.classList.remove('has-tiles'); } });
    tileLayer.addTo(map).bringToBack();
    document.body.classList.add('has-tiles');
  }

  let hiSec = null;
  function applyMapTheme(){
    regions.setStyle({color:css('--region'), fillColor:css('--land'), fillOpacity:1, opacity:1});
    setTiles();
    roadCase.setStyle({color:css('--road-case')});
    roadLine.setStyle({color:css('--road')});
    secs.forEach(s => secLayer[s.id].setStyle(secStyle(s, s === hiSec)));
    gateLayers.forEach(g => {
      const col = css(g.s.pos ? '--sud' : '--nord');
      g.st.setStyle({color:'#fff', fillColor:col});
      g.en.setStyle({color:col, fillColor:'#fff'});
    });
  }
  function bringGates(s){
    const g = gateLayers.find(x => x.s === s);
    if (g && map.hasLayer(gatesGroup)){ g.st.bringToFront(); g.en.bringToFront(); }
  }
  function highlight(s){
    if (hiSec && hiSec !== s) secLayer[hiSec.id].setStyle(secStyle(hiSec, false));
    hiSec = s || null;
    if (s){ secLayer[s.id].setStyle(secStyle(s, true)); secLayer[s.id].bringToFront(); bringGates(s); }
  }
  function zoomClass(){
    const z = map.getZoom(), c = map.getContainer().classList;
    c.toggle('z-lo', z < 8.5); c.toggle('z-mid', z >= 8.5 && z < 10.5);
    const show = z >= 8.5;
    if (show && !map.hasLayer(gatesGroup)){ casGroup.addTo(map); gatesGroup.addTo(map); }
    if (!show && map.hasLayer(gatesGroup)){ map.removeLayer(gatesGroup); map.removeLayer(casGroup); }
    if (hiSec) bringGates(hiSec);
  }
  map.on('zoomend', zoomClass);
  const A1_BOUNDS = L.latLngBounds(allRoad[0].concat(allRoad[5]));
  function fitAll(){ map.fitBounds(A1_BOUNDS, {padding:[24,24]}); }
  fitAll(); zoomClass(); applyMapTheme();
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyMapTheme); } catch(e){}
  new MutationObserver(applyMapTheme).observe(document.documentElement, {attributes:true, attributeFilter:['data-theme','class']});
  (function probeTiles(){
    const img = new Image(); let done = false;
    img.onload = () => { if (done) return; done = true; if (img.naturalWidth >= 200){ tilesOk = true; setTiles(); } };
    img.onerror = () => { done = true; };
    setTimeout(() => { done = true; }, 8000);
    img.src = 'https://tile.openstreetmap.org/6/34/23.png';
  })();

  // posizione dell'utente
  const meIcon = L.divIcon({className:'', iconSize:[40,40], iconAnchor:[20,20],
    html:'<div class="me"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3 L33 35 L20 27.5 L7 35 Z" fill="#0B57D0" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/></svg></div>'});
  let meMarker = null, meAcc = null, follow = true;
  function updateMe(f){
    const ll = [f.lat, f.lon];
    if (!meMarker){
      meAcc = L.circle(ll, {radius:f.acc || 20, weight:1, color:'#0B57D0', fillColor:'#0B57D0', fillOpacity:.12, interactive:false}).addTo(map);
      meMarker = L.marker(ll, {icon:meIcon, keyboard:false, interactive:false, zIndexOffset:1000}).addTo(map);
    } else { meMarker.setLatLng(ll); meAcc.setLatLng(ll).setRadius(f.acc || 20); }
    const svg = meMarker.getElement() && meMarker.getElement().querySelector('svg');
    if (svg && f.heading != null) svg.style.transform = 'rotate(' + f.heading + 'deg)';
    if (follow) map.setView(ll, Math.max(map.getZoom(), 12.5), {animate:true, duration:0.6});
  }
  // Seguire la posizione: si smette spostando la mappa, si riprende con "Ricentra su di me"
  function setFollow(on){
    follow = on;
    if (on) $('#btnFollow').hidden = true;
    else if (isDriving()) $('#btnFollow').hidden = false;
  }
  map.on('dragstart', () => { if (isDriving()) setFollow(false); });
  $('#btnFollow').addEventListener('click', () => {
    setFollow(true);
    const f = currentFix();
    if (f) map.setView([f.lat, f.lon], Math.max(map.getZoom(), 13));
  });
  $('#btnFit').addEventListener('click', () => { setFollow(false); fitAll(); });

  return {
    map, highlight, fitAll, updateMe, setFollow,
    fitSection(s){ map.fitBounds(secLayer[s.id].getBounds(), {paddingTopLeft:[40,230], paddingBottomRight:[40,40], maxZoom:13}); },
    showPopup(at, html){ L.popup({maxWidth:300, autoPanPadding:[30,30]}).setLatLng(at).setContent(html).openOn(map); }
  };
}
```

- [ ] **Passo 3: scrivi `src/ui/sidebar.js`**

```js
// Pannello laterale: elenco dei tratti con filtri e scheda del tratto sulla mappa
import { esc, nfKm, nfL, fmtDur } from '../core/format.js';
import { thresholdFor, thrText } from '../core/rules.js';
import { GROUPS, isPos, roadOf } from '../core/network.js';
import { $ } from './dom.js';

export function createSidebar({secs, settings, mapView, onSimulate}){
  const nA1 = secs.filter(s => roadOf(s) === 'A1').length, nA4 = secs.length - nA1;
  $('#lede').textContent = secs.length + ' tratti con controllo della velocità media: ' + nA1 + ' sulla A1 da Milano a Napoli, con diramazioni di Roma e Variante di Valico, e ' + nA4 + ' sulla A4 tra Milano e Brescia e tra Venezia e Trieste.';
  let filterDir = 'all', filterRoad = 'all';

  function minTimeText(s, v){ return fmtDur(s.L / v * 3600); }
  function popupHTML(s){
    const lim = settings.limit;
    return '<div class="pop"><h4>' + esc(s.name) + '</h4>' +
      '<p class="muted">' + esc(s.t) + ', direzione ' + s.d + ' (' + esc(s.towards) + ')</p>' +
      '<p>Portale di inizio al km ' + nfKm.format(s.ka) + ', fine al km ' + nfKm.format(s.kb) + '</p>' +
      '<p>Lunghezza <b>' + nfL.format(s.L) + ' km</b></p>' +
      '<p>A ' + lim + ' km/h servono almeno <b>' + minTimeText(s, lim) + '</b>. Alla soglia di ' + thrText(lim) + ' km/h: ' + minTimeText(s, thresholdFor(lim)) + '.</p>' +
      '<button class="btn btn-small" type="button" data-simsec="' + s.id + '">Simula questo tratto</button></div>';
  }
  function selectSection(s, zoom, at){
    mapView.highlight(s);
    document.querySelectorAll('.sec.on').forEach(e => e.classList.remove('on'));
    const row = document.querySelector('.sec[data-id="' + s.id + '"]'); if (row) row.classList.add('on');
    if (zoom) mapView.fitSection(s);
    mapView.showPopup(at || s.g[Math.floor(s.g.length/2)], popupHTML(s));
  }
  mapView.map.getContainer().addEventListener('click', e => {
    const b = e.target.closest('[data-simsec]'); if (!b) return;
    mapView.map.closePopup(); onSimulate(+b.getAttribute('data-simsec'), 125);
  });

  function renderList(){
    const box = $('#list'); box.innerHTML = '';
    GROUPS.forEach(g => {
      const items = secs.filter(s => s.t === g && (filterRoad === 'all' || roadOf(s) === filterRoad) && (filterDir === 'all' || (filterDir === 'pos') === s.pos));
      if (!items.length) return;
      const wrap = document.createElement('div'); wrap.className = 'group';
      wrap.innerHTML = '<h2>' + esc(g) + '</h2>';
      [...new Set(items.map(s => s.d))].sort((x, y) => isPos(y) - isPos(x)).forEach(d => {
        const list = items.filter(s => s.d === d).sort((a, b) => (a.ka - b.ka) * a.sign);
        if (!list.length) return;
        const h = document.createElement('h3');
        h.innerHTML = '<i class="dot ' + list[0].cls + '"></i>Direzione ' + d + ', ' + esc(list[0].towards);
        wrap.appendChild(h);
        list.forEach(s => {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'sec ' + s.cls; b.dataset.id = s.id;
          b.innerHTML = '<span class="nm">' + esc(s.name) + '</span><span class="len">' + nfL.format(s.L) + ' km</span><span class="meta">dal km ' + nfKm.format(s.ka) + ' al km ' + nfKm.format(s.kb) + '</span>';
          b.addEventListener('click', () => { selectSection(s, true); if (innerWidth <= 820) $('.mapwrap').scrollIntoView({behavior:'smooth', block:'start'}); });
          wrap.appendChild(b);
        });
      });
      box.appendChild(wrap);
    });
  }
  $('#filter').addEventListener('click', e => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    filterDir = b.dataset.f;
    document.querySelectorAll('#filter .chip').forEach(c => c.setAttribute('aria-pressed', String(c === b)));
    renderList();
  });
  $('#filterRoad').addEventListener('click', e => {
    const b = e.target.closest('[data-r]'); if (!b) return;
    filterRoad = b.dataset.r;
    document.querySelectorAll('#filterRoad .chip').forEach(c => c.setAttribute('aria-pressed', String(c === b)));
    renderList();
  });
  renderList();
  return {selectSection};
}
```

- [ ] **Passo 4: scrivi `src/ui/settings-panel.js`**

```js
// Impostazioni di guida: pannello laterale, limiti nella schermata di guida, pulsante Audio
import { nf1 } from '../core/format.js';
import { LIMITS, thresholdFor, thrText } from '../core/rules.js';
import { $ } from './dom.js';

export function createSettingsPanel({settings, save, onChange, say}){
  function renderLimitChips(){
    const box = $('#setLimits'); box.innerHTML = '';
    const hbox = $('#hudLimits'); hbox.querySelectorAll('.hchip').forEach(x => x.remove());
    LIMITS.forEach(([v, lab]) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chip';
      b.setAttribute('aria-pressed', String(settings.limit === v));
      b.textContent = lab ? v + ' ' + lab : String(v);
      b.addEventListener('click', () => setLimit(v));
      box.appendChild(b);
      const h = document.createElement('button'); h.type = 'button'; h.className = 'hchip';
      h.setAttribute('aria-pressed', String(settings.limit === v)); h.textContent = v;
      h.addEventListener('click', () => { setLimit(v); say('Limite impostato a ' + v, null, true); });
      hbox.appendChild(h);
    });
  }
  function setLimit(v){ settings.limit = v; save(); renderLimitChips(); renderMargin(); onChange(); }
  function renderMargin(){
    $('#setMargin').value = settings.margin;
    $('#marginOut').textContent = settings.margin + ' km/h';
    $('#marginHelp').textContent = 'Con limite ' + settings.limit + ' la soglia di sanzione è ' + thrText(settings.limit) + ' km/h: l\'allarme scatta quando la media arriva a ' + nf1.format(thresholdFor(settings.limit) - settings.margin) + ' km/h. Sopra ' + settings.limit + ' la schermata diventa gialla.';
  }
  function renderMute(){
    const on = settings.voice || settings.beep, b = $('#hudMute');
    b.textContent = on ? 'Audio sì' : 'Audio no';
    b.setAttribute('aria-pressed', String(!on));
  }
  $('#setMargin').addEventListener('input', e => { settings.margin = +e.target.value; save(); renderMargin(); onChange(); });
  $('#setPre').value = String(settings.preAlert);
  $('#setPre').addEventListener('change', e => { settings.preAlert = +e.target.value; save(); });
  [['#setVoice','voice'],['#setBeep','beep'],['#setInst','instWarn']].forEach(([id, k]) => {
    const el = $(id); el.checked = !!settings[k];
    el.addEventListener('change', () => { settings[k] = el.checked; save(); renderMute(); });
  });
  $('#hudMute').addEventListener('click', () => {
    const on = settings.voice || settings.beep;
    settings.voice = !on; settings.beep = !on; save();
    $('#setVoice').checked = settings.voice; $('#setBeep').checked = settings.beep; renderMute();
  });
  renderLimitChips(); renderMargin(); renderMute();
}
```

- [ ] **Passo 5: scrivi `src/ui/history-panel.js`**

```js
// Pannello "Tratti percorsi"
import { esc, nf1 } from '../core/format.js';
import { verdictOf } from '../core/rules.js';
import { $ } from './dom.js';

export function createHistoryPanel(store){
  function render(){
    const ul = $('#hist'); ul.innerHTML = '';
    const history = store.history;
    if (!history.length){ ul.innerHTML = '<li>Qui compariranno i tratti che percorri con la modalità guida, con la media rilevata.</li>'; return; }
    history.slice(0, 30).forEach(h => {
      const d = new Date(h.t);
      const [vt, vc] = verdictOf(h.avg, h.lim);
      const li = document.createElement('li');
      li.innerHTML = '<b>' + esc(h.da + ' → ' + h.a) + '</b><br>' + d.toLocaleDateString('it-IT', {day:'numeric', month:'short'}) + ', ' + d.toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'}) +
        ': media <span class="v ' + vc + '">' + (h.avg != null ? nf1.format(h.avg) + ' km/h' : 'n/d') + '</span>, ' + vt + ' (limite ' + h.lim + ')' +
        (h.partial ? ', misura parziale' : '') + (h.sim ? ', simulazione' : '');
      ul.appendChild(li);
    });
  }
  $('#histClear').addEventListener('click', () => { store.clearHistory(); render(); });
  render();
  return {render};
}
```

- [ ] **Passo 6: scrivi `src/ui/hud.js`**

```js
// Schermata di guida: applica alla pagina la vista calcolata da core/hud-view.js. Nessun calcolo qui.
import { esc } from '../core/format.js';
import { $ } from './dom.js';

export function createHud(){
  let flashT = null;
  return {
    render(v){
      $('#sLim').textContent = v.stats.lim; $('#sThr').textContent = v.stats.thr; $('#sThrL').textContent = v.stats.thrLabel;
      $('#sInst').textContent = v.stats.inst;
      $('#stInst').classList.toggle('hot', v.stats.instHot);
      $('#hudLimits').querySelectorAll('.hchip').forEach(h => h.setAttribute('aria-pressed', String(+h.textContent === v.stats.lim)));
      $('#hudRoad').innerHTML = esc(v.road.title) + (v.road.sim ? '<span class="pill">Simulazione</span>' : '') + '<small>' + esc(v.road.sub) + '</small>';
      const p = $('#plate'), pl = v.plate;
      p.className = 'plate ' + pl.cls + (p.classList.contains('flash') ? ' flash' : '');
      $('#pKicker').textContent = pl.kicker; $('#pTitle').textContent = pl.title;
      $('#pBig').textContent = pl.big; $('#pUnit').textContent = pl.unit; $('#pSub').textContent = pl.sub;
      const prog = $('#pProg');
      prog.hidden = !v.progress;
      if (v.progress){
        $('#pFill').style.width = v.progress.fill;
        $('#pFrom').textContent = v.progress.from;
        $('#pTo').textContent = v.progress.to;
      }
      $('#advice').textContent = v.advice;
    },
    toast(text){ $('#toast').textContent = text; },
    flash(){
      const p = $('#plate'); p.classList.remove('flash'); void p.offsetWidth; p.classList.add('flash');
      clearTimeout(flashT); flashT = setTimeout(() => p.classList.remove('flash'), 2000);
    },
    // GPS muto da qualche secondo (galleria): resta così fino alla prossima posizione
    signalLost(gap, limit, inSection){
      const sub = $('#hudRoad small');
      if (sub) sub.textContent = 'Segnale GPS assente da ' + Math.round(gap) + ' s, forse sei in galleria';
      if (inSection) $('#advice').textContent = 'Senza GPS la media si aggiorna all\'uscita della galleria. Mantieni il limite di ' + limit + '.';
    },
    gpsTrouble(text){ $('#hudRoad').firstChild.textContent = text; }
  };
}
```

- [ ] **Passo 7: scrivi `src/ui/audio.js`**

```js
// Segnali acustici, voce e vibrazione. Legge le impostazioni (voice, beep) a ogni chiamata.
const TONES = {pre:[[660,.16],[880,.22]], start:[[880,.12],[880,.12],[1175,.28]], alarm:[[1320,.14],[1320,.14],[1320,.14],[990,.3]], end:[[880,.16],[660,.16],[523,.3]], soft:[[740,.18]], inst:[[1175,.12],[1175,.12]]};

export function createAudio(settings){
  let actx = null, itVoice = null;
  function pickVoice(){ try { const vs = speechSynthesis.getVoices(); itVoice = vs.find(v => /^it(-|_)IT/i.test(v.lang)) || vs.find(v => /^it/i.test(v.lang)) || null; } catch(e){} }
  try { speechSynthesis.onvoiceschanged = pickVoice; pickVoice(); } catch(e){}

  return {
    // Va chiamata da un tocco dell'utente (Avvia guida, simulazione): i browser bloccano l'audio partito da soli
    init(){
      try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch(e){ actx = null; }
      try { if (window.speechSynthesis) speechSynthesis.getVoices(); } catch(e){}
    },
    tones(kind){
      const seq = TONES[kind];
      if (!seq || !settings.beep || !actx) return;
      let t = actx.currentTime + 0.02;
      seq.forEach(([f, d]) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g).connect(actx.destination); o.start(t); o.stop(t + d + 0.02); t += d + 0.06;
      });
    },
    speak(text, kind){
      if (!settings.voice || !window.speechSynthesis) return;
      try {
        if (kind === 'alarm' || kind === 'start' || kind === 'end') speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text); u.lang = 'it-IT'; if (itVoice) u.voice = itVoice; u.rate = 1.03;
        setTimeout(() => speechSynthesis.speak(u), kind ? 700 : 0);
      } catch(e){}
    },
    cancel(){ try { speechSynthesis.cancel(); } catch(e){} },
    vibrate(p){ try { if (navigator.vibrate) navigator.vibrate(p); } catch(e){} }
  };
}
```

- [ ] **Passo 8: scrivi `src/ui/sim-controls.js`**

```js
// Comandi della simulazione: scelta del tratto, velocità, tempo accelerato, salto al prossimo Tutor
import { clamp } from '../core/format.js';
import { GROUPS } from '../core/network.js';
import { $ } from './dom.js';

export function createSimControls({secs, simulator, enterDrive, pushPosition, resetPosition, say, onJump}){
  const sim = simulator.sim;
  let timer = null;

  const sel = $('#simSec');
  GROUPS.forEach(g => {
    const og = document.createElement('optgroup'); og.label = g;
    secs.filter(s => s.t === g).sort((a, b) => (b.pos - a.pos) || (a.ka - b.ka) * a.sign).forEach(s => {
      const o = document.createElement('option'); o.value = s.id; o.textContent = s.name + ' (Dir. ' + s.d + ')'; og.appendChild(o);
    });
    sel.appendChild(og);
  });
  $('#btnSimOpen').addEventListener('click', () => { const box = $('#simSetup'); box.hidden = !box.hidden; $('#btnSimOpen').setAttribute('aria-expanded', String(!box.hidden)); });
  $('#btnSimStart').addEventListener('click', () => start(+sel.value, clamp(+$('#simV').value || 125, 50, 170)));
  [1,5,15].forEach(w => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'hchip'; b.textContent = '×' + w; b.dataset.w = w;
    b.setAttribute('aria-pressed', String(w === 1)); b.title = 'Tempo accelerato ' + w + ' volte';
    b.addEventListener('click', () => { sim.warp = w; document.querySelectorAll('#simWarp .hchip').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
    $('#simWarp').appendChild(b);
  });
  $('#simSpeed').addEventListener('input', e => { sim.speed = +e.target.value; $('#simSpeedOut').textContent = sim.speed + ' km/h'; });
  $('#simJump').addEventListener('click', () => {
    if (!sim.line) return;
    const n = simulator.nextSection();
    if (!n){ say('Nessun altro Tutor in questa direzione.', null, true); return; }
    resetPosition();
    simulator.jumpBefore(n);
    onJump();
  });

  function stopTimer(){ if (timer){ clearInterval(timer); timer = null; } }
  function tick(){
    const p = simulator.step();
    if (!p){ stopTimer(); say('Fine del percorso simulato.', 'soft'); return; }
    pushPosition(p);
  }
  function start(id, v){
    if (!simulator.setup(id, v, Date.now()/1000)) return;
    $('#simSpeed').value = v; $('#simSpeedOut').textContent = v + ' km/h';
    enterDrive('sim');
    stopTimer();
    timer = setInterval(tick, 500);
    tick();
  }
  return {start, stopTimer};
}
```

- [ ] **Passo 9: scrivi `src/ui/download.js`** (stesso codice della sezione "download a standalone copy" di oggi)

```js
// "Scarica l'app come file HTML": salva la pagina com'era all'avvio, senza gli script esterni
import { $ } from './dom.js';

export function setupDownload(PRISTINE){
  let dlCap = null, dlProbe = false;
  function probeDownloads(){
    if (dlProbe) return;
    const c = window.claude;
    if (c && typeof c.use === 'function'){
      dlProbe = true;
      c.use('downloads').then(ns => { dlCap = ns || null; }).catch(() => { dlCap = null; });
    }
  }
  probeDownloads(); setTimeout(probeDownloads, 1500);
  function exportHTML(){
    if (!PRISTINE) return null;
    try {
      const doc = new DOMParser().parseFromString(PRISTINE, 'text/html');
      doc.querySelectorAll('script:not([data-keep])').forEach(s => s.remove());
      return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
    } catch(e){ return PRISTINE; }
  }
  $('#btnDownload').addEventListener('click', async () => {
    const msg = $('#dlMsg'); const html = exportHTML();
    if (!html){ msg.hidden = false; msg.textContent = 'Non riesco a preparare il file in questa vista.'; return; }
    probeDownloads();
    if (window.claude && typeof window.claude.use === 'function'){
      const ns = dlCap || await window.claude.use('downloads').catch(() => null);
      if (ns){
        try { await ns.save({filename:'tutor-a1.html', data:html}); msg.hidden = false; msg.textContent = 'File tutor-a1.html pronto. Caricalo su Netlify Drop o GitHub Pages e aprilo dal telefono.'; }
        catch(e){ if (!e || e.code !== 'declined'){ msg.hidden = false; msg.textContent = 'Il download non è disponibile in questa vista.'; } }
        return;
      }
    }
    const blob = new Blob([html], {type:'text/html'}); const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'tutor-a1.html'; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    msg.hidden = false; msg.textContent = 'File tutor-a1.html scaricato.';
  });
}
```

- [ ] **Passo 10: riscrivi `src/main.js`**

Sostituisci tutto il contenuto con:

```js
// Avvio dell'app: crea i pezzi di core/ (calcolo) e ui/ (pagina) e li collega.
// È l'unico file che conosce entrambi: vedi docs/ARCHITETTURA.md.
import { buildNetwork } from './core/network.js';
import { thresholdFor } from './core/rules.js';
import { createStore } from './core/store.js';
import { createTracker, toHistoryEntry } from './core/tracker.js';
import { announcementFor } from './core/messages.js';
import { hudView } from './core/hud-view.js';
import { createSimulator } from './core/simulator.js';
import { gpsDeniedMessage } from './platform.js';
import { $ } from './ui/dom.js';
import { createMapView } from './ui/map.js';
import { createSidebar } from './ui/sidebar.js';
import { createSettingsPanel } from './ui/settings-panel.js';
import { createHistoryPanel } from './ui/history-panel.js';
import { createHud } from './ui/hud.js';
import { createAudio } from './ui/audio.js';
import { createSimControls } from './ui/sim-controls.js';
import { setupDownload } from './ui/download.js';

// Copia della pagina com'era al caricamento, per "Scarica l'app come file HTML"
let PRISTINE = null;
try { PRISTINE = '<!DOCTYPE html>\n' + document.documentElement.outerHTML; } catch(e) {}

function boot(){
  const DATA = JSON.parse(document.getElementById('tutor-data').textContent);
  const {secs, lines} = buildNetwork(DATA);
  let storage = null;
  try { storage = window.localStorage; } catch(e){}
  const store = createStore(storage);
  const settings = store.settings;
  const tracker = createTracker({secs, lines, settings});
  const st = tracker.st;
  const simulator = createSimulator({secs, lines});
  const hud = createHud();
  const audio = createAudio(settings);

  // Un avviso: testo sullo schermo, segnale acustico e (se non muto) voce
  function say(text, kind, silentVoice){
    hud.toast(text);
    if (kind) audio.tones(kind);
    if (!silentVoice) audio.speak(text, kind);
  }
  function announce(a){
    if (!a) return;
    say(a.text, a.tone, a.silentVoice);
    if (a.vibrate) audio.vibrate(a.vibrate);
  }
  function render(){
    if (!st.running) return;
    const v = hudView(st, settings);
    hud.render(v);
    if (v.highlight !== undefined) mapView.highlight(v.highlight);
  }

  const mapView = createMapView({data:DATA, secs, lines, isDriving: () => st.running, currentFix: () => st.fix,
    onSectionClick: (s, at) => sidebar.selectSection(s, false, at)});
  const sidebar = createSidebar({secs, settings, mapView, onSimulate: (id, v) => simControls.start(id, v)});
  createSettingsPanel({settings, save: () => store.saveSettings(), onChange: () => { tracker.refresh(); render(); }, say});
  const historyPanel = createHistoryPanel(store);

  tracker.on(ev => {
    switch (ev.type){
      case 'section-start': mapView.highlight(ev.sec); hud.flash(); break;
      case 'section-finish': store.addHistory(toHistoryEntry(ev.result, Date.now())); historyPanel.render(); hud.flash(); break;
      case 'pre-alert': hud.flash(); break;
      case 'section-abort': mapView.highlight(null); break;
      case 'position': mapView.updateMe(ev.fix); render(); break;
    }
    announce(announcementFor(ev));
  });

  /* ---------- guida ---------- */
  const run = {watchId:null, wake:null, dog:null};
  async function keepAwake(){ try { if ('wakeLock' in navigator && document.visibilityState === 'visible') run.wake = await navigator.wakeLock.request('screen'); } catch(e){} }
  document.addEventListener('visibilitychange', () => { if (st.running && document.visibilityState === 'visible') keepAwake(); });

  function enterDrive(source){
    audio.init();
    tracker.start(source);
    mapView.setFollow(true);
    document.body.classList.add('driving');
    $('#simBar').hidden = source !== 'sim';
    mapView.map.closePopup();
    setTimeout(() => mapView.map.invalidateSize(), 60);
    keepAwake(); render();
    window.scrollTo(0, 0);
    if (run.dog) clearInterval(run.dog);
    run.dog = setInterval(watchdog, 1000);
  }
  function stopDrive(){
    if (run.watchId != null){ try { navigator.geolocation.clearWatch(run.watchId); } catch(e){} run.watchId = null; }
    simControls.stopTimer();
    tracker.stop();
    if (run.dog){ clearInterval(run.dog); run.dog = null; }
    try { if (run.wake) run.wake.release(); } catch(e){} run.wake = null;
    audio.cancel();
    document.body.classList.remove('driving');
    mapView.highlight(null);
    setTimeout(() => mapView.map.invalidateSize(), 60);
  }
  $('#hudExit').addEventListener('click', stopDrive);

  function gpsNote(html, good){ const n = $('#gpsNote'); n.innerHTML = html; n.hidden = !html; n.classList.toggle('good', !!good); }
  $('#btnDrive').addEventListener('click', () => {
    gpsNote('');
    if (!('geolocation' in navigator)){ gpsNote('Questo browser non offre la posizione GPS. Prova un altro browser oppure usa la simulazione.'); return; }
    enterDrive('gps');
    try {
      run.watchId = navigator.geolocation.watchPosition(tracker.pushPosition, onGpsError, {enableHighAccuracy:true, maximumAge:0, timeout:20000});
    } catch(e){ onGpsError({code:2, message:String(e)}); }
  });
  function onGpsError(e){
    if (e && e.code === 1){
      stopDrive();
      gpsNote(gpsDeniedMessage());
      $('#side').scrollTo && $('#side').scrollTo(0, 0);
    } else if (st.running){
      hud.gpsTrouble(e && e.code === 3 ? 'Segnale GPS lento ad arrivare' : 'GPS non disponibile al momento');
    }
  }
  function watchdog(){
    if (!st.running || st.source !== 'gps' || !st.fix) return;
    const gap = Date.now()/1000 - st.lastWall;
    if (gap > 6) hud.signalLost(gap, settings.limit, !!st.active);
  }

  const simControls = createSimControls({secs, simulator, enterDrive, pushPosition: tracker.pushPosition,
    resetPosition: tracker.resetPosition, say, onJump: () => mapView.setFollow(true)});

  setupDownload(PRISTINE);

  window.__tutor = {st, sim: simulator.sim, SECS: secs, LINES: lines, thresholdFor, settings, tracker};
}

function start(){
  if (window.L) { boot(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
  s.onload = boot;
  s.onerror = () => { const m = document.getElementById('map'); if (m) m.innerHTML = '<p style="padding:20px">La libreria della mappa non si è caricata. Controlla la connessione e ricarica la pagina.</p>'; };
  document.head.appendChild(s);
}
start();
```

- [ ] **Passo 11: ricostruisci ed esegui i test**

Esegui: `npm run build` poi `npm test`
Atteso: la build non dà errori; tutti i test passano.

- [ ] **Passo 12: golden nel browser**

Ricarica `http://localhost:5173/`, esegui `run('golden-check.json')` (due volte se serve), poi:

```bash
node tools/compare-golden.mjs test/fixtures/golden.json test/fixtures/golden-check.json
```

Atteso: `Identico`. Una differenza qui (con i test Node verdi) indica un errore nel collegamento in `main.js` o in `ui/hud.js`.

Ripeti il collaudo del riquadro: `pip-harness` su `/www/index.html` alla misura del riquadro e `compare-golden` con `pip-layout.json`, come al Compito 2, Passo 9. Atteso: `Identico`.

- [ ] **Passo 12b: collaudo sul telefono**

```bash
npm run sync && cd android && JAVA_HOME="/c/Program Files/Java/jdk-21" ./gradlew installDebug -Pprova=true && cd .. && node tools/device-check.mjs && node tools/device-check.mjs --gps
```

Atteso: gli stessi `OK` del Compito 0B, Passo 5 (eccetto i difetti noti annotati lì). Guarda `device-check/riquadro-sopra-maps.png`.

- [ ] **Passo 13: prova a mano nel browser integrato**

Su `http://localhost:5173/` (dopo `localStorage.clear()` e ricarica), controlla:
1. `read_console_messages` con `onlyErrors: true`: nessun errore.
2. Il testo introduttivo dice "83 tratti con controllo della velocità media: ...".
3. "Solo A4" mostra solo i gruppi A4; "Nord o Ovest" filtra la direzione.
4. Tocca un tratto dell'elenco: la mappa zooma, si apre la scheda; "Simula questo tratto" avvia la simulazione con la schermata di guida.
5. In simulazione: ×15 accelera; "Vai al prossimo Tutor" salta; il cursore della velocità cambia la velocità; a fine tratto compare "Tratto concluso" e la voce nello storico.
6. Durante la guida tocca il limite 110 nella schermata: compare "Limite impostato a 110"; ricarica la pagina: il limite resta 110.
7. "Esci" torna alla mappa; "Cancella lo storico" svuota l'elenco.
8. Con `resize_window` `colorScheme: 'dark'` la mappa cambia colori senza errori; poi ripristina.
9. `Object.keys(window.__tutor)` contiene `st, sim, SECS, LINES, thresholdFor, settings`.

Non premere "Scarica l'app come file HTML" (avvierebbe un download): il codice di `ui/download.js` è identico all'originale.

- [ ] **Passo 14: commit**

```bash
git add -A src index.html
git commit -m "Interfaccia in moduli ui/ e main.js che collega calcolo e pagina; golden identico"
```

---

### Compito 11: pulizia della build e del ponte nativo

**File:**
- Crea: `src/styles/pip.css`
- Modifica: `src/index.html`, `src/vendor/leaflet.css`, `src/styles/app.css`, `native/tutor-native.js`, `test/build.test.js`, `NOTE-MIGLIORIE.md`
- Cancella: `indexA1.html`

**Interfacce:**
- Consuma: `buildPages` (Compito 2).
- Produce: nessuna nuova funzione. Il ponte nativo non inietta più CSS; il riquadro PiP usa `src/styles/pip.css`, che vale solo quando `<html>` ha la classe `pip`.

- [ ] **Passo 1: scrivi i test del contratto col ponte nativo (il secondo fallisce)**

In `test/build.test.js` aggiungi:

```js
test('ogni id cercato dal ponte nativo esiste nella pagina dell\'app', () => {
  const bridge = readFileSync(new URL('../native/tutor-native.js', import.meta.url), 'utf8');
  const ids = [...bridge.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]);
  assert.ok(ids.includes('hudExit') && ids.includes('hudMute'));
  const {app} = buildPages();
  for (const id of ids) assert.ok(app.includes('id="' + id + '"'), 'manca id="' + id + '"');
});

test('lo stile del riquadro PiP è nella pagina e non più nel ponte nativo', () => {
  const {app} = buildPages();
  assert.ok(app.includes('html.pip .plate'));
  const bridge = readFileSync(new URL('../native/tutor-native.js', import.meta.url), 'utf8');
  assert.ok(!bridge.includes('html.pip .plate'));
});
```

Esegui: `npm test` — Atteso: il primo passa, il secondo FAIL.

- [ ] **Passo 2: sposta lo stile PiP in `src/styles/pip.css`**

Crea `src/styles/pip.css`:

```css
/* Riquadro Picture-in-Picture dell'app Android: la classe "pip" su <html> la mette native/tutor-native.js */
html.pip body.driving .app{display:block; height:100vh; min-height:0}
html.pip body.driving .mapwrap, html.pip .side, html.pip .hud-top, html.pip .stats, html.pip .advice,
  html.pip .hud-limits, html.pip .simbar, html.pip .toast{display:none !important}
html.pip .hud{padding:0; gap:0; height:100vh; overflow:hidden}
html.pip .plate{height:100vh; box-sizing:border-box; border-radius:0; padding:3px}
html.pip .plate-in{height:100%; box-sizing:border-box; min-height:0; padding:5px 8px; gap:0; border-width:2px; border-radius:8px; align-content:center}
html.pip .plate .kicker{font-size:10px}
html.pip .plate .title, html.pip .plate .sub{white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
html.pip .plate .title{font-size:12.5px}
html.pip .plate .title{line-height:1.25}
html.pip .plate .big{margin-top:4px; gap:5px}
html.pip .plate .big b{font-size:min(36vh,22vw); letter-spacing:-1px}
/* dentro il tratto la barra di avanzamento basta: la riga descrittiva non ci sta */
html.pip .plate-in:has(#pProg:not([hidden])) .sub{display:none}
html.pip .plate .big span{font-size:10.5px; max-width:10ch}
html.pip .plate .sub{font-size:10px}
html.pip .progress{margin-top:3px}
html.pip .bar{height:5px}
html.pip .plabels{font-size:9px; margin-top:2px}
```

In `src/index.html`, subito dopo la riga `</style>` che chiude `<!--@include styles/app.css-->`, aggiungi:

```html
<style>
<!--@include styles/pip.css-->
</style>
```

In `native/tutor-native.js`: cancella il blocco `var css = document.createElement('style'); css.textContent = [ ... ].join('\n');` (righe 134-155 di oggi) e la riga `document.head.appendChild(css);` dentro `DOMContentLoaded`. Cambia il commento del blocco in:

```js
  /* ---------- Riquadro Picture-in-Picture ----------
   * Durante la guida, uscendo dall'app (per aprire Maps o Waze) resta una finestrella
   * con il cartello del Tutor: prossimo tratto e km al portale, oppure la media nel tratto.
   * Lo stile del riquadro è in src/styles/pip.css (attivo con la classe "pip" su <html>). */
```

- [ ] **Passo 3: Leaflet senza aggiunte nostre**

In `src/vendor/leaflet.css` cancella la regola `.tiles-dark { filter: invert(1) hue-rotate(180deg) brightness(.9) contrast(.9) saturate(.6); }` (con lo spazio che la precede). In fondo a `src/styles/app.css` aggiungi:

```css
/* Mappa di sfondo OpenStreetMap nel tema scuro (classe messa da ui/map.js) */
.tiles-dark { filter: invert(1) hue-rotate(180deg) brightness(.9) contrast(.9) saturate(.6); }
```

Così `src/vendor/` contiene solo Leaflet e si può aggiornare sostituendo i due file.

- [ ] **Passo 4: togli la copia vecchia**

```bash
git rm indexA1.html
```

In `NOTE-MIGLIORIE.md`, sezione "Piccole cose", cancella il punto su `indexA1.html` e nella sezione "Da sistemare", punto 3, cancella la frase "Anche il messaggio di permesso GPS negato in `index.html` cita Claude (la build lo sostituisce, ma conviene pulire la sorgente)." sostituendola con "Il messaggio di permesso GPS negato nel browser cita ancora Claude (`src/platform.js`)."

- [ ] **Passo 5: ricostruisci, test e golden**

Esegui: `npm run build` poi `npm test` — Atteso: tutti passano.
Nel browser: ricarica, `run('golden-check.json')`, `node tools/compare-golden.mjs test/fixtures/golden.json test/fixtures/golden-check.json` — Atteso: `Identico`. Con `resize_window` `colorScheme: 'dark'` verifica che lo sfondo OpenStreetMap sia scuro (regola `.tiles-dark` ancora attiva).

Questo compito sposta lo stile del riquadro: il collaudo del riquadro è il controllo principale. Esegui `pip-harness` su `/www/index.html` alla misura del riquadro, poi `node tools/compare-golden.mjs test/fixtures/pip-layout.json test/fixtures/pip-check.json`. Atteso: `Identico`. Poi sul telefono:

```bash
npm run sync && cd android && JAVA_HOME="/c/Program Files/Java/jdk-21" ./gradlew installDebug -Pprova=true && cd .. && node tools/device-check.mjs
```

Atteso: gli stessi `OK` del Compito 0B.

- [ ] **Passo 6: commit**

```bash
git add -A src native test NOTE-MIGLIORIE.md index.html
git commit -m "Stile del riquadro PiP nella pagina, Leaflet senza aggiunte, rimossa la copia indexA1.html"
```

---

### Compito 12: documentazione e prova sul telefono

**File:**
- Crea: `docs/ARCHITETTURA.md`, `CLAUDE.md`

**Interfacce:**
- Consuma: tutto il resto.
- Produce: documentazione per i prossimi aggiornamenti.

- [ ] **Passo 1: scrivi `docs/ARCHITETTURA.md`**

```markdown
# Come è fatto il Tutor A1/A4

## In breve
La pagina è un solo file HTML, ma i sorgenti sono divisi in `src/`. `npm run build` li ricompone in
`index.html` (browser, GitHub Pages) e in `www/` (app Android con Capacitor). Non modificare
`index.html` a mano: viene riscritto dalla build.

## Le due metà
- `src/core/`: il calcolo. Niente `document`, `window` o Leaflet: si prova con `npm test`.
- `src/ui/`: la pagina. Mostra quello che decide `core/`, senza calcolare.
- `src/main.js` è l'unico file che le conosce entrambe e le collega.

## Da una posizione GPS allo schermo
1. Il GPS (o `core/simulator.js`) produce una posizione.
2. `core/tracker.js` la aggancia alla strada (`core/network.js`), segue i tratti e la media
   (`core/metrics.js`) ed emette eventi: `pre-alert`, `section-start`, `section-finish`, `section-end`,
   `section-abort`, `instant-over`, `alarm`, `alarm-cleared`, `position`.
3. `main.js` riceve gli eventi: chiede a `core/messages.js` cosa dire (testo, segnale, vibrazione)
   e lo passa a `ui/audio.js` e `ui/hud.js`; salva lo storico (`core/store.js`).
4. A ogni `position`, `core/hud-view.js` calcola cosa mostrare e `ui/hud.js` lo scrive nella pagina.

## Dove mettere le mani
- Nuovo avviso vocale: un evento in `tracker.js`, il testo in `messages.js`, un test in
  `test/messages.test.js` e uno in `test/tracker.test.js`.
- Cambiare un testo della schermata di guida: `hud-view.js`.
- Regole sulla tolleranza: `rules.js` (con `test/rules.test.js`).
- Nuovi tratti o tracciati: `src/data/tutor-data.json`; nuove linee in `LINE_DEFS` di `network.js`.
- Differenze browser/app: `src/platform.js`. Il ponte nativo è `native/tutor-native.js`.
- Ottimizzazioni: l'aggancio alla strada (`matchPoint`) scorre tutti i segmenti con un filtro per
  riquadro; se servisse più velocità, un indice spaziale va costruito in `buildNetwork`.

## Contratto con il ponte nativo
`native/tutor-native.js` usa `#hudExit`, `#hudMute`, la classe `driving` sul body e mette la classe
`pip` su `<html>` (stile in `src/styles/pip.css`). Un test in `test/build.test.js` controlla gli id.

## Collaudi dell'uscita dall'app e del riquadro sopra Maps
- Sul telefono: `./gradlew installDebug -Pprova=true` installa "Tutor prova" accanto all'app normale, poi
  `npm run device-check` (aggiungi `-- --gps` per provare anche il GPS vero). Controlla Home e Indietro fuori
  e dentro la guida, il riquadro sopra Google Maps che si aggiorna con lo schermo acceso, il ritorno a schermo
  intero e la X del riquadro che termina la guida e spegne il GPS. Schermate in `device-check/`.
- Nel browser: `tools/pip-harness.mjs` su `/www/index.html`, con la finestra grande come il riquadro, misura il
  cartello in ogni stato della guida e lo confronta con `test/fixtures/pip-layout.json`.

## Il golden
`test/fixtures/golden.json` è il comportamento dell'app registrato su 5 percorsi GPS fissi
(`test/fixtures/scenarios.json`): schermata, avvisi, vibrazioni e storico, posizione per posizione.
`test/golden.test.js` lo confronta con `core/`. Se cambi un comportamento di proposito, il test fallisce:
rigenera il golden e controlla che le differenze siano solo quelle volute.
1. `npm run build`, poi `npm run serve` (o `preview_start` con `tutor`) e apri `http://localhost:5173/`.
2. Nella console: `(await import('/tools/golden-harness.mjs?' + Date.now())).run('golden-check.json')`
   (la prima volta ricarica la pagina con le impostazioni del collaudo: eseguilo di nuovo).
3. `node tools/compare-golden.mjs test/fixtures/golden.json test/fixtures/golden-check.json` mostra le differenze.
4. Se sono quelle volute: `run('golden.json')` e commit.
```

- [ ] **Passo 2: scrivi `CLAUDE.md`**

```markdown
# Tutor A1/A4

App (pagina web + app Android Capacitor) che segue i tratti Tutor di A1 e A4 e la velocità media.
Struttura e flusso dei dati: `docs/ARCHITETTURA.md`. Difetti noti e idee: `NOTE-MIGLIORIE.md`.

## Comandi
- `npm test`: test Node (`test/*.test.js`), compreso il golden su `core/`.
- `npm run build`: ricostruisce `index.html` (browser, GitHub Pages) e `www/` (app). Da committare.
- `npm run serve`: server su http://localhost:5173 per provare la pagina e registrare il golden.
- `npm run sync`: build + `npx cap sync`. Poi `cd android && ./gradlew installDebug -Pprova=true` con Java 21
  (`JAVA_HOME="/c/Program Files/Java/jdk-21"`): installa la copia "Tutor prova" senza toccare l'app normale.
- `npm run device-check`: collaudo sul telefono di uscita dall'app e riquadro sopra Maps (`-- --gps` per il GPS vero).

## Regole
- Non modificare `index.html` a mano: si modifica `src/` e si esegue `npm run build`.
- `src/core/` non usa `document`, `window` né Leaflet.
- Non cambiare le chiavi di localStorage né gli id usati da `native/tutor-native.js`.
- Testi, commenti e commit in italiano.
```

- [ ] **Passo 3: prova finale sul telefono**

Con il Samsung collegato via USB e sbloccato:

```bash
npm run sync && cd android && JAVA_HOME="/c/Program Files/Java/jdk-21" ./gradlew installDebug -Pprova=true && cd .. && node tools/device-check.mjs && node tools/device-check.mjs --gps
```

Atteso: gli stessi `OK` del Compito 0B. Poi, a mano su "Tutor prova": (1) "Prova in simulazione" con ×15 chiude un tratto con la media, e voce e suoni funzionano; (2) "Audio" spegne voce e suoni; (3) con Maps in navigazione vera, Home apre il riquadro con il cartello e la voce del Tutor si sente. L'app normale "Tutor A1 A4" resta installata com'era. Nessuna impostazione del telefono va cambiata.

- [ ] **Passo 4: test finali e commit**

Esegui: `npm test` — Atteso: tutti passano.

```bash
git add docs/ARCHITETTURA.md CLAUDE.md
git commit -m "Documentazione dell'architettura e delle regole per i prossimi aggiornamenti"
```

---

## Alla fine

Il branch `refactor-moduli` resta nella cartella `Fancuolo_tutor-refactor`. Prima di unirlo ad `app-sopra-maps` o a `main` si chiede all'utente: `main` è quello che serve GitHub Pages. Prima dell'unione si decide anche se tenere l'opzione `-Pprova=true`. Non cambia la build normale, quindi si può tenere.

## Fuori da questo piano (restano in `NOTE-MIGLIORIE.md`)

Barra di stato in tema chiaro, fornitore di tile per la distribuzione, testi che citano Claude, layout orizzontale, carattere grande e `fontScale`, testo breve per il riquadro fuori dalla A1/A4, favicon, velocità da fermo con segnale scarso, `allowBackup`. Dopo il refactoring ognuno tocca pochi file: per esempio la velocità da fermo è una riga in `core/tracker.js` più un test.
