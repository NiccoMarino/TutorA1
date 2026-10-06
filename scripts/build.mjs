// Costruisce le pagine a partire da src/:
//   index.html   pagina per il browser (GitHub Pages): un solo file con tutto dentro
//   www/         pagina per l'app Capacitor, con il ponte nativo (capacitor.js e tutor-native.js)
// Il modello src/index.html contiene i segnaposto <!--@include percorso--> (un file di src/)
// e <!--@var nome--> (testo diverso tra browser e app). Un segnaposto sconosciuto ferma la build.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildSync } from 'esbuild';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = ROOT + 'src/';

const NOTICE = '\n<!-- Pagina generata da scripts/build.mjs: i sorgenti sono in src/ -->';
// La versione è una sola, in package.json: la usano la pagina e l'app Android (android/app/build.gradle)
const VERSION = JSON.parse(readFileSync(ROOT + 'package.json', 'utf8')).version;
// Carattere Figtree dentro la pagina (licenza SIL OFL), così l'app non scarica niente da internet
const FONT_WEIGHTS = [400, 600, 700, 800, 900];
const FONTS = FONT_WEIGHTS.map(w => {
  const file = ROOT + 'node_modules/@fontsource/figtree/files/figtree-latin-' + w + '-normal.woff2';
  return '@font-face{font-family:"Figtree";font-style:normal;font-weight:' + w + ';font-display:swap;' +
    'src:url(data:font/woff2;base64,' + readFileSync(file).toString('base64') + ') format("woff2")}';
}).join('\n');
// Licenze del software incluso nell'app, con i testi presi dalle librerie installate: le licenze chiedono che
// copyright e testo accompagnino il software (pagina Privacy e diritti, sezione Licenze)
const esc = t => t.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const pkgLicense = pkg => readFileSync(ROOT + 'node_modules/' + pkg + '/LICENSE', 'utf8').replace(/\r\n/g, '\n').trim();
export const LICENSED = [
  ['Carattere Figtree', '@fontsource/figtree', 'SIL Open Font License 1.1'],
  ['Capacitor', '@capacitor/core', 'MIT'], ['Capacitor per Android', '@capacitor/android', 'MIT'],
  ['Posizione in secondo piano', '@capacitor-community/background-geolocation', 'MIT'],
  ['Schermo acceso', '@capacitor-community/keep-awake', 'MIT'],
  ['Sintesi vocale', '@capacitor-community/text-to-speech', 'MIT'], ['Vibrazione', '@capacitor/haptics', 'MIT']
];
export function licensesHtml(){
  const items = LICENSED.map(([what, pkg, lic]) =>
    '<details><summary>' + what + ' (' + pkg + '), ' + lic + '</summary><pre class="lic">' + esc(pkgLicense(pkg)) + '</pre></details>');
  items.push('<details><summary>Librerie Android: AndroidX (Apache License 2.0) e Google Play services per la posizione '
    + '(termini di Google per le API Android)</summary><pre class="lic">' + esc(readSource('legal/apache-2.0.txt')) + '</pre></details>');
  return items.join('\n');
}
const LICENSES = licensesHtml();
const VARS = {
  web: {viewportFit: ', viewport-fit=cover', bridge: '', notice: NOTICE, version: VERSION, fonts: FONTS, licenses: LICENSES},
  // Senza viewport-fit=cover Capacitor lascia spazio a barra di stato e barra di navigazione,
  // così la pagina (che non usa i margini safe-area) non finisce sotto l'ora e la batteria
  app: {viewportFit: '', bridge: '\n<script src="capacitor.js"></script>\n<script src="tutor-native.js"></script>', notice: NOTICE, version: VERSION, fonts: FONTS, licenses: LICENSES}
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

// Lo stile senza commenti: nei sorgenti spiegano dove sono le cose, nella pagina sarebbero solo peso
export function stripCssComments(css){
  return css.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => l.trim()).join('\n');
}

export function buildPages(){
  const main = bundleMain();
  const include = path => path === 'main.js' ? main : path.endsWith('.css') ? stripCssComments(readSource(path)) : readSource(path);
  const template = readSource('index.html');
  const web = render(template, VARS.web, include);
  const app = render(template, VARS.app, include);
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
