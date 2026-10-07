// Nome dell'app (TutOK) e icona: dappertutto lo stesso nome, l'icona è il quadrante dell'utente su fondo nero
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPages } from '../scripts/build.mjs';
import { APP_NAME } from '../src/platform.js';
import { GLYPH, ICON_BG } from '../tools/make-icons.mjs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('il nome dell\'app è TutOK dappertutto', () => {
  assert.equal(APP_NAME, 'TutOK');
  const xml = read('android/app/src/main/res/values/strings.xml');
  assert.match(xml, /<string name="app_name">TutOK<\/string>/);
  assert.match(xml, /<string name="title_activity_main">TutOK<\/string>/);
  assert.equal(JSON.parse(read('capacitor.config.json')).appName, 'TutOK');
  const {app, web} = buildPages();
  for (const page of [app, web]){
    assert.match(page, /<title>TutOK: /);
    assert.match(page, /<h1 class="appname">TutOK<\/h1>/);
  }
});

test('il vecchio nome MediaVelocità non è rimasto da nessuna parte', () => {
  const {app, web} = buildPages();
  const files = {app, web};
  for (const p of ['privacy.html', 'termini.html', 'README.md', 'package.json', 'CLAUDE.md', 'tools/make-icons.mjs',
    'docs/play-store/SCHEDA.md', 'docs/play-store/PUBBLICAZIONE.md', 'docs/legale/VERIFICA.md', 'docs/legale/ABBONAMENTO-BOZZA.md'])
    files[p] = read(p);
  for (const [p, text] of Object.entries(files)) assert.ok(!/MediaVelocit/.test(text), 'MediaVelocità è ancora in ' + p);
});

test('si dice ancora che non è un\'app ufficiale e che Tutor è dei suoi titolari', () => {
  const {app} = buildPages();
  assert.match(app, /Non è un'app ufficiale di Autostrade per l'Italia/);
  assert.match(read('termini.html'), /"Tutor" e i nomi delle società citate appartengono ai rispettivi titolari/);
  assert.match(read('docs/play-store/SCHEDA.md'), /TutOK non è un'app ufficiale di Autostrade per l'Italia/);
});

test('icona: il quadrante dell\'utente (strada, archi verde e rosso, lancetta, Ø MEDIA km/h) su fondo nero', () => {
  assert.equal(ICON_BG, '#0B0B0C');
  assert.match(read('android/app/src/main/res/values/ic_launcher_background.xml'), /<color name="ic_launcher_background">#0B0B0C<\/color>/);
  for (const t of ['>Ø<', '>MEDIA<', '>km/h<', '#3F9C48', '#D93230']) assert.ok(GLYPH.includes(t), "nel disegno dell'icona manca " + t);
  // la scritta si disegna con Figtree dentro l'SVG: nelle immagini SVG il browser non usa i caratteri esterni
  assert.match(GLYPH, /@font-face\{font-family:"Figtree";font-weight:500;src:url\(data:font\/woff2;base64,/);
});

test('logo in alto nella pagina e icona del browser: lo stesso quadrante su fondo nero', () => {
  const {app} = buildPages();
  const logo = app.match(/<svg class="logo"[\s\S]*?<\/svg>/)[0];
  assert.ok(logo.includes('fill="#0B0B0C"') && logo.includes('#3F9C48') && logo.includes('>MEDIA<'), 'logo della pagina vecchio');
  const fav = decodeURIComponent(app.match(/<link rel="icon" href="data:image\/svg\+xml,([^"]+)"/)[1]);
  assert.ok(fav.includes('#0B0B0C') && fav.includes('#3F9C48'), 'icona del browser vecchia');
});
