import { nf1 } from './format.js';

// Art. 345 Reg. CdS: riduzione del 5% sulla velocità misurata, minimo 5 km/h.
export function thresholdFor(limit){ const v = limit + 5; return v <= 100 ? v : limit / 0.95; }
export function thrText(limit){ return nf1.format(Math.floor(thresholdFor(limit)*10)/10); }
export function verdictOf(avg, lim){ if (avg == null) return ['n/d','']; if (avg <= lim) return ['in regola','ok']; if (avg <= thresholdFor(lim)) return ['sopra il limite, entro la tolleranza','tol']; return ['oltre la soglia di sanzione','bad']; }
export const LIMITS = [[130,''],[110,'pioggia'],[100,'neopatentati'],[90,''],[80,'rimorchio']];
