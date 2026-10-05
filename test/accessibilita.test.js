// Leggibilità e comodità al tocco, controllate sullo stile (src/styles/app.css) in tutti e due i temi.
// Il collaudo sul telefono (npm run device-check) misura lo stesso sulla pagina vera.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/app.css', import.meta.url), 'utf8');
const vars = block => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)].map(m => [m[1], m[2]]));
const light = vars(css.match(/:root\{([^}]*)\}/)[1]);
const dark = {...light, ...vars(css.match(/:root\[data-theme="dark"\]\{([^}]*)\}/)[1])};
const lum = hex => { const f = v => { v /= 255; return v <= 0.03928 ? v/12.92 : ((v + 0.055)/1.055)**2.4; };
  const n = parseInt(hex.slice(1), 16); return 0.2126*f(n >> 16) + 0.7152*f((n >> 8) & 255) + 0.0722*f(n & 255); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05)/(Math.min(x, y) + 0.05); };

// testo su sfondo, come li usa lo stile
const PAIRS = [['ink', 'bg'], ['ink', 'panel'], ['ink', 'panel-2'], ['muted', 'bg'], ['muted', 'panel'], ['muted', 'panel-2'],
  ['on-brand', 'brand'], ['on-brand', 'brand-2'], ['bg', 'ink'],
  ['ok', 'panel'], ['warn', 'panel'], ['bad', 'panel']];

for (const [name, theme] of [['chiaro', light], ['scuro', dark]]){
  test('tema ' + name + ': ogni testo ha contrasto almeno 4,5 con il suo sfondo', () => {
    const bad = PAIRS.filter(([fg, bg]) => ratio(theme[fg], theme[bg]) < 4.5)
      .map(([fg, bg]) => fg + ' su ' + bg + ' ' + ratio(theme[fg], theme[bg]).toFixed(2));
    assert.deepEqual(bad, []);
  });
}

test('il tema scuro è davvero diverso da quello chiaro (le variabili ci sono tutte e due le volte)', () => {
  const block = css.match(/@media \(prefers-color-scheme: dark\)\{\s*:root:not\(\[data-theme="light"\]\)\{([^}]*)\}/)[1];
  assert.deepEqual(vars(block), vars(css.match(/:root\[data-theme="dark"\]\{([^}]*)\}/)[1]));
});

// Android consiglia almeno 48 dp per tutto quello che si tocca
test('pulsanti, scelte, menù a tendina e cursori alti almeno 48 px', () => {
  const rule = sel => {
    const i = css.indexOf('\n' + sel + '{');
    assert.ok(i >= 0, 'manca la regola ' + sel);
    return css.slice(i, css.indexOf('}', i));
  };
  const small = [];
  for (const sel of ['.btn', '.btn-small', '.chip', '.hbtn', '.hchip', 'select.sel', '.simsetup select,.simsetup input[type=number]', 'input[type=range]', '.iconbtn']){
    const r = rule(sel), h = r.match(/(?:min-)?height:(\d+)px/);
    if (!h || +h[1] < 48) small.push(sel + ' ' + (h ? h[1] : '?') + ' px');
  }
  // le scelte con un numero solo ("90", "×1") sarebbero più strette di 48 px; le righe con l'interruttore si toccano tutte
  for (const sel of ['.chip', '.hchip']){ const w = rule(sel).match(/min-width:(\d+)px/); if (!w || +w[1] < 48) small.push(sel + ' larghezza ' + (w ? w[1] : '?') + ' px'); }
  const sw = rule('.switch').match(/min-height:(\d+)px/);
  if (!sw || +sw[1] < 48) small.push('.switch ' + (sw ? sw[1] : '?') + ' px');
  assert.deepEqual(small, []);
});

// Cartello di guida: testo e arco sul colore di ogni stato (i colori sono fissi, uguali nei due temi)
test('cartello: testo leggibile su ogni colore (verde, giallo, rosso, neutro)', () => {
  const cart = readFileSync(new URL('../src/styles/cartello.css', import.meta.url), 'utf8');
  const tones = [...cart.matchAll(/--pc:(#[0-9A-Fa-f]{6}); --pf:(#[0-9A-Fa-f]{6})/g)].map(m => [m[1], m[2]]);
  assert.equal(tones.length, 4);
  const bad = tones.filter(([bg, fg]) => ratio(fg, bg) < 4.5).map(([bg, fg]) => fg + ' su ' + bg + ' ' + ratio(fg, bg).toFixed(2));
  assert.deepEqual(bad, []);
});
