// Prova su tante misure di schermo (tools/schermi.mjs): quali misure, come si ingrandisce il testo
// e quando un risultato è un problema. Qui niente browser, così si prova con npm test.

// Spazio per la pagina in px CSS, in verticale (senza barra di stato e barra di navigazione di Android)
export const SIZES = [
  {name: 'Telefono piccolo e vecchio (4")', w: 320, h: 520},
  {name: 'Android piccolo 16:9', w: 360, h: 592},
  {name: 'Galaxy S25 (telefono di prova)', w: 360, h: 734},
  {name: 'Galaxy S25+ / A grandi', w: 384, h: 780},
  {name: 'Pixel 8', w: 412, h: 860},
  {name: 'Telefono grande', w: 430, h: 880},
  {name: 'Tablet piccolo', w: 600, h: 900},
  {name: 'Tablet', w: 800, h: 1220}
];
// Dimensione del testo nelle Impostazioni di Android: normale e ingrandita (la WebView dell'app la segue)
export const ZOOMS = [1, 1.3];

export function cases(){
  const out = [];
  for (const zoom of ZOOMS) for (const orientation of ['verticale', 'orizzontale']) for (const size of SIZES){
    const [w, h] = orientation === 'verticale' ? [size.w, size.h] : [size.h, size.w];
    out.push({id: orientation + '-' + Math.round(zoom*100) + '-' + w + 'x' + h, size, orientation, zoom, w, h});
  }
  return out;
}

// Nuovo valore di font-size con il testo ingrandito; null se non va toccato
export function scaledFontSize(value, zoom){
  if (zoom === 1 || !value || /^(inherit|initial|unset|revert)/.test(value)) return null;
  return 'calc(' + value + ' * ' + zoom + ')';
}

// kind: 'pagina' (schermate fuori dalla guida), 'guida-verticale', 'guida-orizzontale'.
// audit è il risultato di pageAudit, plate quello di plateForm più scroll e view (tools/device-page.mjs)
export function judge(kind, {audit, plate, velox}){
  const problems = [], notes = [];
  const few = a => a.slice(0, 4).join('; ') + (a.length > 4 ? '; e altri ' + (a.length - 4) : '');
  if (audit.overflowX) problems.push('la pagina scorre di lato');
  if (audit.outside.length) problems.push('fuori dallo schermo: ' + few(audit.outside));
  if (audit.broken.length) problems.push('testo rotto: ' + few(audit.broken));
  if (audit.small.length) problems.push('da toccare sotto 48 px: ' + few(audit.small));
  const bad = audit.contrast.filter(c => c.bad), low = audit.contrast.filter(c => !c.bad);
  if (bad.length) problems.push('contrasto sotto 3: ' + few(bad.map(c => c.what + ' ' + c.ratio)));
  if (low.length) notes.push('contrasto sotto 4,5: ' + few(low.map(c => c.what + ' ' + c.ratio)));
  if (audit.clipped.length) notes.push('testo tagliato: ' + few(audit.clipped));
  if (audit.tiny.length) notes.push('testo sotto 11 px: ' + few(audit.tiny));
  if (kind !== 'pagina'){
    if (!plate.round) problems.push('il cerchio non è tondo');
    if (!plate.bigInside) problems.push('la media esce dal cerchio');
    if (!plate.keepInside) problems.push('la velocità da tenere esce dal suo spazio');
  }
  if (kind === 'guida-verticale'){
    if (plate.scroll > plate.view) problems.push('la guida scorre (' + plate.scroll + ' px su ' + plate.view + ')');
    if (plate.y > 0) problems.push('la pagina si sposta di ' + plate.y + ' px');
    if (plate.gaugeShare < 50) notes.push('cerchio piccolo: ' + plate.gaugeShare + '% della larghezza');
  }
  if (kind === 'guida-orizzontale' && !(plate.plateInside && plate.gaugeInside)) problems.push('il cartello esce dallo schermo');
  // etichetta dell'autovelox nel cerchio (solo nel momento in cui deve esserci)
  if (velox){
    if (!velox.shown) problems.push("manca l'etichetta dell'autovelox nel cerchio");
    else {
      if (!velox.inside) problems.push("l'etichetta dell'autovelox esce dal cerchio");
      if (velox.overlap) problems.push("l'etichetta dell'autovelox copre la media");
      if (velox.clipped) problems.push("la scritta della fascia è tagliata dal cerchio");
    }
  }
  return {problems, notes};
}
