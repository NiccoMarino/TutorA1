import { nf1 } from './format.js';

// Art. 345 Reg. CdS: riduzione del 5% sulla velocità misurata, minimo 5 km/h.
export function thresholdFor(limit){ const v = limit + 5; return v <= 100 ? v : limit / 0.95; }
export function thrText(limit){ return nf1.format(Math.floor(thresholdFor(limit)*10)/10); }
// Una media di 130,0000004 (errore di calcolo con i decimali) vale 130: si confronta con un millesimo di tolleranza
const EPS = 1e-3;
export const overLimit = (avg, lim) => avg > lim + EPS;
export function verdictOf(avg, lim){ if (avg == null) return ['n/d','']; if (!overLimit(avg, lim)) return ['in regola','ok']; if (avg <= thresholdFor(lim) + EPS) return ['sopra il limite, entro la tolleranza','tol']; return ['oltre la soglia di sanzione','bad']; }
export const LIMITS = [[130,''],[110,'pioggia'],[100,'neopatentati'],[90,''],[80,'rimorchio']];
// Media da dire o mostrare: arrotondata a quei decimali, ma senza passare dall'altra parte del limite o della soglia
// (130,4 detto "130" sembrerebbe in regola): in quel caso c'è un decimale in più, arrotondato verso il valore vero.
export function avgValue(avg, lim, decimals){
  if (avg == null) return null;
  const k = 10**decimals, r = Math.round(avg*k)/k;
  if (verdictOf(r, lim)[1] === verdictOf(avg, lim)[1]) return r;
  const k1 = k*10;
  return r > avg ? Math.floor(avg*k1 + 1e-9)/k1 : Math.ceil(avg*k1 - 1e-9)/k1;
}

// Colori del cartello, scelti nelle impostazioni. Giallo quando la media supera limite + yellowOff (di base il limite);
// rosso, con l'allarme, quando arriva a limite + redOff oppure, se redOff manca, alla soglia meno `margin`
// (di base 2 km/h sotto la soglia). Le scelte sono relative al limite, così seguono il cambio di limite.
export function colorLimits(settings){
  const lim = settings.limit;
  return {yellow: lim + (settings.yellowOff || 0),
          red: settings.redOff != null ? lim + settings.redOff : thresholdFor(lim) - (settings.margin || 0)};
}
const sotto = (n, what) => n === 0 ? what : n + ' ' + (n > 0 ? 'sopra' : 'sotto') + ' ' + what;
// Scelte per il giallo: {value: yellowOff, kmh, label}, dalla più alta. Etichette brevi, senza "km/h" (è nel titolo
// del campo nelle impostazioni): i menù sono larghi quanto lo schermo
export const YELLOW_CHOICES = lim => [0, -1, -2, -3, -5, -10, -15].map(off =>
  ({value: off, kmh: lim + off, label: (lim + off) + ' (' + (off ? sotto(off, 'il limite').replace(/^-/, '') : 'il limite') + ')'}));
// Scelte per il rosso: {key: "m:<km/h sotto la soglia>" o "l:<scarto dal limite>", kmh, label}, dalla più alta,
// senza doppioni (con limite fino a 100 la soglia è limite + 5 e alcune coincidono). La scelta attuale (`currentKey`,
// anche un margine della versione precedente come "m:4") resta sempre nell'elenco.
export function RED_CHOICES(lim, currentKey){
  const thr = thresholdFor(lim), out = [];
  const choice = key => {
    const [kind, v] = key.split(':'), n = +v;
    if (kind === 'l') return {key, kmh: lim + n, label: (lim + n) + ' (' + (n ? sotto(n, 'il limite').replace(/^-/, '') : 'il limite') + ')'};
    return {key, kmh: thr - n, label: nf1.format(thr - n) + ' (' + (n === 2 ? 'consigliato' : n ? n + ' sotto la soglia' : 'la soglia') + ')'};
  };
  const add = key => { const c = choice(key); if (c.kmh <= thr + 1e-6 && !out.some(o => o.key === key || Math.abs(o.kmh - c.kmh) < 0.05)) out.push(c); };
  if (currentKey) add(currentKey);
  ['m:2', 'm:0', 'l:3', 'l:2', 'l:1', 'l:0', 'l:-2', 'l:-5', 'l:-10'].forEach(add);
  return out.sort((a, b) => b.kmh - a.kmh);
}
