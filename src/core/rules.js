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
