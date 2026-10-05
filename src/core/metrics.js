// Media nel tratto in corso, proiezione all'arrivo e consiglio di velocità
import { clamp } from './format.js';
import { thresholdFor, overLimit } from './rules.js';
import { secRel } from './network.js';

export function computeMetrics(a, f, km, settings){
  const s = a.sec;
  const elapsed = Math.max(0, f.t - a.tStart), dist = Math.max(0, f.odo - a.odoStart);
  const rel = clamp(secRel(s, km), 0, s.L), remKm = Math.max(0, s.L - rel);
  const Leff = Math.max(0.1, s.L - a.relStart);
  const vNow = f.v != null ? f.v*3.6 : null;
  const settled = elapsed >= 12 && dist >= 250;
  const avg = settled || (elapsed >= 4 && dist > 60) ? dist/elapsed*3.6 : vNow;
  const lim = settings.limit, thr = thresholdFor(lim), warnAt = thr - settings.margin;
  // Velocità da non superare nei km che mancano per chiudere con la media entro `target`
  const restFor = target => { const t = Leff/target*3600 - elapsed; return t > 0 ? remKm/t*3600 : Infinity; };
  const vLimRest = restFor(lim), vThrRest = restFor(thr);
  const proj = vNow && vNow > 10 && elapsed > 0 ? (dist/1000 + remKm)/((elapsed + remKm/vNow*3600)/3600) : null;
  let status = 'ok';
  if (settled && avg >= warnAt) status = 'alarm';
  else if (settled && (overLimit(avg, lim) || (proj != null && proj >= warnAt))) status = 'warn';
  return {elapsed, dist, rel, remKm, vNow, avg, lim, thr, warnAt, vLimRest, vThrRest, proj, status, settled};
}

export function adviceText(m){
  const lim = m.lim;
  if (!m.settled) return 'Calcolo della media in corso. Limite ' + lim + '.';
  // lo stesso numero del cartello (keepText)
  const k = keepText(m), n = k.value.replace('≤ ', '');
  if (m.status === 'alarm'){
    if (k.value !== 'rallenta') return 'Media oltre la soglia: rallenta e resta sotto ' + n + ' km/h fino al portale.';
    return 'Media oltre la soglia: rallenta, più tempo resti sotto il limite più la media scende.';
  }
  if (+n >= lim) return overLimit(m.avg, lim) ? 'Media sopra ' + lim + ' ma entro la tolleranza. Rispetta il limite fino al portale.' : 'Rispettando il limite di ' + lim + ' chiudi il tratto in regola.';
  return 'Per chiudere entro il limite resta sotto ' + n + ' km/h fino al portale.';
}

// Velocità da tenere fino al portale, mai sopra il limite: per chiudere entro il limite, se non si può più almeno
// entro la tolleranza. Sotto i 50 km/h non è un consiglio sensato in autostrada.
export function keepText(m){
  const lim = m.lim, below = v => '≤ ' + Math.floor(Math.min(v, lim));
  if (!m.settled || m.vLimRest >= 50) return {label:'per chiudere entro ' + lim, value: m.settled ? below(m.vLimRest) : '≤ ' + lim};
  if (m.vThrRest >= 50) return {label:'per restare in tolleranza', value: below(m.vThrRest)};
  return {label:'non rientri più', value:'rallenta'};
}
