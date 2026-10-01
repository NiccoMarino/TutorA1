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
