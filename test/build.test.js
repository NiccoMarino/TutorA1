import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPages, render, checkInlineScript } from '../scripts/build.mjs';

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

test('un </script> dentro il codice ferma la build (romperebbe la pagina)', () => {
  assert.throws(() => checkInlineScript('const s = "</script>";'), /<\/script/);
  assert.equal(checkInlineScript('const s = 1;'), 'const s = 1;');
});

test('tutti gli script in linea hanno data-keep (la build controlla la sintassi solo di quelli)', () => {
  const {web} = buildPages();
  const inline = [...web.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)].map(m => m[1]);
  assert.ok(inline.length >= 2);
  for (const attrs of inline) assert.match(attrs, /data-keep/);
});

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

test('la pagina non parla più di Claude né offre di scaricarsi come file', () => {
  const {web, app} = buildPages();
  for (const page of [web, app]){
    assert.ok(!/claude/i.test(page), 'la pagina cita ancora Claude');
    assert.ok(!page.includes('btnDownload'));
  }
});

test('la pagina mostra la versione di package.json', () => {
  const {version} = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const {web, app} = buildPages();
  assert.ok(web.includes('Versione ' + version));
  assert.ok(app.includes('Versione ' + version));
});

test('niente mappa: né Leaflet né il riquadro della mappa', () => {
  const {web, app} = buildPages();
  for (const page of [web, app]){
    assert.ok(!page.includes('id="map"'));
    assert.ok(!/\bL\.(map|tileLayer)\(/.test(page));
    assert.ok(!/leaflet/i.test(page), 'la pagina contiene ancora Leaflet');
  }
});

test('la pagina non scarica niente da internet: script, stili e caratteri sono dentro', () => {
  const {web, app} = buildPages();
  for (const page of [web, app]){
    assert.ok(!/<(script|img|iframe)[^>]+src="https?:/i.test(page), 'script o immagine esterni');
    assert.ok(!/<link[^>]+href="https?:/i.test(page), 'stile o carattere esterno');
    assert.ok(!/url\(\s*['"]?https?:/i.test(page), 'url() esterno nello stile');
    assert.match(page, /@font-face\{font-family:"Overpass"/);
    assert.match(page, /font\/woff2;base64,/);
  }
});

test('la pagina resta leggera (sotto i 450 kB)', () => {
  const {app} = buildPages();
  assert.ok(Buffer.byteLength(app) < 450*1024, Math.round(Buffer.byteLength(app)/1024) + ' kB');
});

test('schermata iniziale con i due cartelli, menù e una pagina per ogni voce', () => {
  const {app} = buildPages();
  for (const id of ['home', 'btnMenu', 'btnDrive', 'btnSimOpen', 'menu', 'pSettings', 'pSim', 'pHist', 'pHow', 'pInfo'])
    assert.ok(app.includes('id="' + id + '"'), 'manca id="' + id + '"');
  for (const id of ['pSettings', 'pSim', 'pHist', 'pHow', 'pInfo'])
    assert.ok(app.includes('data-go="' + id + '"'), 'il menù non porta a ' + id);
  assert.ok(app.includes('data-go="home"'), 'il menù non ha la voce Home');
  assert.ok(app.includes('id="setTheme"'), 'manca la scelta del tema nelle impostazioni');
  assert.ok(!app.includes('class="side"'), 'è rimasta la vecchia colonna laterale');
});

test('tutte le autostrade: filtro a tendina e nessun testo rimasto a "A1 e A4"', () => {
  const {app} = buildPages();
  assert.match(app, /<select[^>]*id="filterRoad"/);
  assert.ok(!/Tutor di A1 e A4|Fuori da A1 e A4|A1 o sulla A4|delle due autostrade|Solo A1/.test(app), 'testo rimasto alle sole A1 e A4');
});
