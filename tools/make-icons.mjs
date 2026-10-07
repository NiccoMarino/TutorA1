// Genera icona dell'app, schermata di avvio e grafica del Play Store a partire dal disegno qui sotto,
// facendo le foto con Chrome senza finestra. Uso: node tools/make-icons.mjs
// Scrive in android/app/src/main/res/ (mipmap-*, drawable*/splash.png) e in docs/play-store/grafica/.
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
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
// Fondo dell'icona (anche in android/app/src/main/res/values/ic_launcher_background.xml)
export const ICON_BG = '#0B0B0C';

// Disegno dell'utente (ottobre 2026): quadrante con la strada, arco verde, zona rossa, lancetta e "Ø MEDIA km/h".
// Le coordinate sono quelle misurate sulla sua immagine (1375×768): il gruppo le porta nella griglia 108×108 delle
// icone adattive di Android, con quadrante e scritte dentro il cerchio sicuro di raggio 33.
const C = [686, 536], D2R = Math.PI/180;
const pt = (r, a) => [C[0] + r*Math.cos(a*D2R), C[1] + r*Math.sin(a*D2R)].map(v => +v.toFixed(1));
const arc = (r, a0, a1) => { const [x0, y0] = pt(r, a0), [x1, y1] = pt(r, a1), span = ((a1 - a0) % 360 + 360) % 360;
  return `M${x0} ${y0} A${r} ${r} 0 ${span > 180 ? 1 : 0} 1 ${x1} ${y1}`; };
const TICKS = [150, 180, 210, 240, 270, 300].map(a => { const [x0, y0] = pt(172, a), [x1, y1] = pt(188, a); return `M${x0} ${y0} L${x1} ${y1}`; }).join(' ');
const PIVOT = [775, 455], TIP = [836, 391];
const NEEDLE = (() => { const l = Math.hypot(TIP[0] - PIVOT[0], TIP[1] - PIVOT[1]), n = [-(TIP[1] - PIVOT[1])/l, (TIP[0] - PIVOT[0])/l];
  return [[PIVOT[0] + n[0]*5.5, PIVOT[1] + n[1]*5.5], TIP, [PIVOT[0] - n[0]*5.5, PIVOT[1] - n[1]*5.5]].map(p => p.map(v => v.toFixed(1)).join(',')).join(' '); })();
// Nelle immagini SVG il browser non usa i caratteri della pagina: Figtree va dentro il disegno
const FONT = [400, 500].map(w => '@font-face{font-family:"Figtree";font-weight:' + w + ';src:url(data:font/woff2;base64,'
  + readFileSync(ROOT + 'node_modules/@fontsource/figtree/files/figtree-latin-' + w + '-normal.woff2').toString('base64') + ') format("woff2")}').join('');
export function art({font = true} = {}){
  return (font ? '<style>' + FONT + '</style>' : '') + `<g transform="translate(54 54) scale(0.13) translate(-686 -445)">
  <g fill="#FFFFFF"><polygon points="660,263 667,265 577,336 565,330"/><polygon points="705,265 712,263 807,330 795,336"/>
    <polygon points="683,262 689,262 689,272 683,272"/><polygon points="682,281 690,281 690,294 682,294"/><polygon points="681,302 691,302 691,317 681,317"/>
    <polygon points="470,452 479,458 437,523 425,515"/><polygon points="902,452 893,458 935,523 947,515"/></g>
  <path d="${TICKS}" stroke="#8A8A8A" stroke-width="4" stroke-linecap="round" fill="none"/>
  <path d="${arc(208, 153, 310)}" stroke="#3F9C48" stroke-width="15" stroke-linecap="round" fill="none"/>
  <path d="${arc(200, 321, 26)}" stroke="#D93230" stroke-width="15" stroke-linecap="round" fill="none"/>
  <path d="${arc(178, 331, 19)}" stroke="#D93230" stroke-width="4" stroke-linecap="round" fill="none"/>
  <polygon points="${NEEDLE}" fill="#D93230"/>
  <circle cx="${PIVOT[0]}" cy="${PIVOT[1]}" r="10" fill="#111111" stroke="#D93230" stroke-width="6"/>
  <g font-family="Figtree" text-anchor="middle" fill="#FFFFFF"><text x="686" y="490" font-size="100" font-weight="500">Ø</text>
    <text x="686" y="574" font-size="74" font-weight="500" letter-spacing="2.5">MEDIA</text>
    <text x="686" y="624" font-size="45" font-weight="400" fill="#9B9B9B">km/h</text></g>
</g>`;
}
export const GLYPH = art();

// shape: 'none' (solo disegno, sfondo trasparente), 'square', 'rounded', 'circle'; view: porzione della griglia
function iconSvg({shape, view = '0 0 108 108'}){
  const [x, y, w] = view.split(' ').map(Number);
  const bg = shape === 'none' ? ''
    : shape === 'circle' ? `<circle cx="54" cy="54" r="${w/2}" fill="${ICON_BG}"/>`
    : `<rect x="${x}" y="${y}" width="${w}" height="${w}" rx="${shape === 'rounded' ? w*0.22 : 0}" fill="${ICON_BG}"/>`;
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
    // Icone per Android 7 (senza icone adattive): il disegno ingrandito sul fondo nero
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
      <div><div style="font-size:96px;font-weight:700;letter-spacing:-1px">TutOK</div>
      <div style="font-size:38px;margin-top:14px;line-height:1.25;color:#C9D6D0">La tua velocità media nei tratti Tutor in autostrada</div></div>
    </div>`, `radial-gradient(ellipse at 30% 40%, #2E3032, ${ICON_BG})`), 1024, 500, STORE + 'grafica-1024x500.png');
  rmSync(TMP, {recursive: true, force: true});
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
