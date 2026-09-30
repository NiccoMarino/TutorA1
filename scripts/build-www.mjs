// Prepara la cartella www/ che Capacitor impacchetta nell'app:
// copia index.html aggiungendo i due script del ponte nativo, più capacitor.js e tutor-native.js.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';

const out = 'www';
mkdirSync(out, { recursive: true });

let html = readFileSync('index.html', 'utf8');

const bridge = '<script src="capacitor.js"></script>\n<script src="tutor-native.js"></script>\n';
if (!html.includes('<meta charset="utf-8">')) throw new Error('index.html: <meta charset="utf-8"> non trovato, non so dove inserire il ponte nativo');
html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n' + bridge);

// Senza viewport-fit=cover Capacitor lascia spazio a barra di stato e barra di navigazione,
// così la pagina (che non usa i margini safe-area) non finisce sotto l'ora e la batteria
html = html.replace(', viewport-fit=cover', '');

// Nell'app il messaggio "permesso negato" deve parlare delle impostazioni del telefono, non del browser
const gpsDenied = /gpsNote\('La posizione è bloccata\.[^\n]*?'\);/;
if (gpsDenied.test(html)) {
  html = html.replace(gpsDenied, "gpsNote('La posizione è bloccata. Apri le impostazioni del telefono, vai su App &gt; Tutor A1 A4 &gt; Autorizzazioni &gt; Posizione e scegli <b>Consenti solo mentre l’app è in uso</b> o <b>Consenti sempre</b>. Intanto puoi usare la simulazione.');");
} else {
  console.warn('Attenzione: messaggio di GPS bloccato non trovato in index.html, lasciato com\'è.');
}

// Controllo di sintassi degli script della pagina, per non installare un'app che si blocca all'avvio
for (const [, code] of html.matchAll(/<script data-keep>([\s\S]*?)<\/script>/g)) {
  try { new Function(code); } catch (e) { throw new Error('Errore di sintassi JavaScript in www/index.html: ' + e.message); }
}

writeFileSync(`${out}/index.html`, html);
copyFileSync('node_modules/@capacitor/core/dist/capacitor.js', `${out}/capacitor.js`);
copyFileSync('native/tutor-native.js', `${out}/tutor-native.js`);
console.log('www/ pronta');
