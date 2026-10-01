// Genera icona dell'app, schermata di avvio e grafica del Play Store a partire dal disegno qui sotto,
// facendo le foto con Chrome senza finestra. Uso: node tools/make-icons.mjs
// Scrive in android/app/src/main/res/ (mipmap-*, drawable*/splash.png) e in docs/play-store/grafica/.
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RES = ROOT + 'android/app/src/main/res/';
const STORE = ROOT + 'docs/play-store/grafica/';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
                'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);

export const GREEN = '#00794C', DARK = '#0E1412', RED = '#FF6B61';

// Disegno nella griglia 108×108 delle icone adattive di Android: tutto dentro il cerchio sicuro di raggio 33.
// Contachilometri con la zona rossa in fondo e sotto un tratto con i due portali (inizio e fine).
const GLYPH = `
  <path d="M36.68 62 A20 20 0 0 1 71.32 42" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
  <path d="M71.32 42 A20 20 0 0 1 71.32 62" fill="none" stroke="${RED}" stroke-width="6" stroke-linecap="round"/>
  <path d="M54 52 L64.6 41.4" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>
  <circle cx="54" cy="52" r="4.5" fill="#fff"/>
  <path d="M41 77 H67" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M41 72.5 V81.5 M67 72.5 V81.5" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>`;

// shape: 'none' (solo disegno, sfondo trasparente), 'square', 'rounded', 'circle'; view: porzione della griglia
function iconSvg({shape, view = '0 0 108 108'}){
  const [x, y, w] = view.split(' ').map(Number);
  const bg = shape === 'none' ? ''
    : shape === 'circle' ? `<circle cx="54" cy="54" r="${w/2}" fill="${GREEN}"/>`
    : `<rect x="${x}" y="${y}" width="${w}" height="${w}" rx="${shape === 'rounded' ? w*0.22 : 0}" fill="${GREEN}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}" width="100%" height="100%">${bg}${GLYPH}</svg>`;
}

function page(body, bg = 'transparent'){
  return `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${bg}}
  body{display:flex;align-items:center;justify-content:center;font-family:"Segoe UI",Roboto,Arial,sans-serif}</style>${body}`;
}

const TMP = join(tmpdir(), 'make-icons');
let n = 0;
function shoot(html, w, h, out){
  mkdirSync(TMP, {recursive: true});
  const file = join(TMP, 'p' + (n++) + '.html');
  writeFileSync(file, html);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--default-background-color=00000000', '--window-size=' + w + ',' + h, '--screenshot=' + out, pathToFileURL(file).href],
    {stdio: 'ignore'});
  console.log(out.replace(ROOT, '') + ' ' + w + '×' + h);
}

// Le finestre di Chrome senza schermo non scendono sotto i 500 pixel circa: le immagini piccole si disegnano su un
// canvas di misura esatta (con la trasparenza) e si leggono dal DOM
function draw({svg, w, h, bg = null, size = Math.min(w, h)}, out){
  mkdirSync(TMP, {recursive: true});
  const file = join(TMP, 'c' + (n++) + '.html');
  const data = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  writeFileSync(file, `<!doctype html><body><script>
    const c = document.createElement('canvas'); c.width = ${w}; c.height = ${h};
    const g = c.getContext('2d'); const img = new Image();
    img.onload = () => { ${bg ? `g.fillStyle = '${bg}'; g.fillRect(0, 0, ${w}, ${h});` : ''}
      g.drawImage(img, ${(w - size)/2}, ${(h - size)/2}, ${size}, ${size});
      document.body.textContent = 'PNG:' + c.toDataURL('image/png').split(',')[1] + ':FINE'; };
    img.src = '${data}';
  </script>`);
  const dom = execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--virtual-time-budget=5000', '--dump-dom',
    pathToFileURL(file).href], {encoding: 'utf8', maxBuffer: 64*1024*1024});
  const m = dom.match(/PNG:([A-Za-z0-9+/=]+):FINE/);
  if (!m) throw new Error('Disegno non riuscito: ' + out);
  writeFileSync(out, Buffer.from(m[1], 'base64'));
  console.log(out.replace(ROOT, '') + ' ' + w + '×' + h);
}

const sized = svg => svg.replace('width="100%" height="100%"', 'width="1024" height="1024"');

function main(){
  if (!CHROME) throw new Error('Serve Chrome o Edge installato');
  const dens = {mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4};
  for (const [d, k] of Object.entries(dens)){
    const dir = RES + 'mipmap-' + d + '/';
    draw({svg: sized(iconSvg({shape: 'none'})), w: 108*k, h: 108*k}, dir + 'ic_launcher_foreground.png');
    // Icone per Android 7 (senza icone adattive): il disegno ingrandito sul fondo verde
    draw({svg: sized(iconSvg({shape: 'rounded', view: '17 17 74 74'})), w: 48*k, h: 48*k}, dir + 'ic_launcher.png');
    draw({svg: sized(iconSvg({shape: 'circle', view: '17 17 74 74'})), w: 48*k, h: 48*k}, dir + 'ic_launcher_round.png');
  }
  // Schermata di avvio per Android 7-11 (da Android 12 il sistema usa l'icona e il colore del tema)
  const splash = {mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920]};
  const round = sized(iconSvg({shape: 'circle', view: '17 17 74 74'}));
  for (const [d, [w, h]] of Object.entries(splash)){
    const size = Math.round(Math.min(w, h)*0.32);
    draw({svg: round, w, h, bg: DARK, size}, RES + 'drawable-port-' + d + '/splash.png');
    draw({svg: round, w: h, h: w, bg: DARK, size}, RES + 'drawable-land-' + d + '/splash.png');
  }
  draw({svg: round, w: 480, h: 320, bg: DARK, size: 102}, RES + 'drawable/splash.png');
  mkdirSync(STORE, {recursive: true});
  // Icona del Play Store: 512×512 a tutto quadrato (gli angoli li arrotonda Google)
  draw({svg: sized(iconSvg({shape: 'square', view: '12 12 84 84'})), w: 512, h: 512}, STORE + 'icona-512.png');
  // Grafica in evidenza 1024×500
  shoot(page(`<div style="display:flex;align-items:center;gap:56px;padding:0 72px;color:#fff">
      <div style="width:300px;height:300px;flex:none">${iconSvg({shape: 'circle', view: '17 17 74 74'})}</div>
      <div><div style="font-size:84px;font-weight:700;letter-spacing:-1px">MediaVelocità</div>
      <div style="font-size:38px;margin-top:14px;line-height:1.25;color:#CFE9DD">La tua velocità media nei tratti Tutor di A1 e A4</div></div>
    </div>`, `linear-gradient(135deg, ${GREEN}, #004D30)`), 1024, 500, STORE + 'grafica-1024x500.png');
  rmSync(TMP, {recursive: true, force: true});
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
