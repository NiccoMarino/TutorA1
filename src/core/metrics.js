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
  const tLeft = Leff/warnAt*3600 - elapsed;
  const vMaxRest = tLeft > 0 ? remKm/tLeft*3600 : Infinity;
  const proj = vNow && vNow > 10 && elapsed > 0 ? (dist/1000 + remKm)/((elapsed + remKm/vNow*3600)/3600) : null;
  let status = 'ok';
  if (settled && avg >= warnAt) status = 'alarm';
  else if (settled && (overLimit(avg, lim) || (proj != null && proj >= warnAt))) status = 'warn';
  return {elapsed, dist, rel, remKm, vNow, avg, lim, thr, warnAt, vMaxRest, proj, status, settled};
}

export function adviceText(m){
  const lim = m.lim;
  if (!m.settled) return 'Calcolo della media in corso. Limite ' + lim + '.';
  if (m.status === 'alarm'){
    if (isFinite(m.vMaxRest) && m.vMaxRest >= 60) return 'Media oltre la soglia: rallenta e resta sotto ' + Math.floor(Math.min(m.vMaxRest, lim)) + ' km/h fino al portale.';
    return 'Media oltre la soglia: rallenta, più tempo resti sotto il limite più la media scende.';
  }
  if (!isFinite(m.vMaxRest) || m.vMaxRest >= lim) return overLimit(m.avg, lim) ? 'Media sopra ' + lim + ' ma entro la tolleranza. Rispetta il limite fino al portale.' : 'Rispettando il limite di ' + lim + ' chiudi il tratto in regola.';
  return 'Per chiudere sotto la soglia resta sotto ' + Math.floor(m.vMaxRest) + ' km/h fino al portale.';
}
