// Rete autostradale: tratti Tutor, linee del tracciato e aggancio di una posizione GPS alla strada
import { clamp } from './format.js';
import { D2R, bearing, angDiff } from './geo.js';

export const RAMS = {
  A01:{name:'A1', plus:'verso Napoli', minus:'verso Milano'},
  D18:{name:'A1 Diramazione Roma Nord', plus:'verso Roma', minus:'verso la A1'},
  D19:{name:'A1 Diramazione Roma Sud', plus:'verso Roma', minus:'verso la A1'},
  VAR:{name:'A1 Variante di Valico', plus:'verso Firenze', minus:'verso Bologna'},
  A04:{name:'A4', plus:'verso Trieste', minus:'verso Torino'}
};
export const GROUPS = ['A1 Milano-Bologna','A1 Bologna-Firenze','A1 Variante di Valico','A1 Firenze-Roma','A1 Diramazione Roma Nord','A1 Roma-Napoli','A1 Diramazione Roma Sud','A4 Milano-Brescia','A4 Venezia-Trieste'];
export const isPos = d => d === 'Sud' || d === 'Est';
export const roadOf = s => s.r === 'A04' ? 'A4' : 'A1';
export const secRel = (s, km) => (km - s.ka) * s.sign;

// [id, ramo, chiave in data.ch, verso fisso (+1, -1, 0 = entrambi), distanza massima dall'asse in metri]
const LINE_DEFS = [
  ['A01S','A01','S',+1,55], ['A01N','A01','N',-1,55],
  ['D18','D18','D18',0,320], ['D19','D19','D19',0,220], ['VAR','VAR','VAR',0,260],
  ['A04E','A04','AE',+1,55], ['A04W','A04','AW',-1,55]
];

function makeLine(id, ram, pts, fixedSign, maxDist){
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++){
    const a = pts[i], b = pts[i+1];
    const kx = Math.cos((a[0]+b[0])/2*D2R)*111320, ky = 110574;
    segs.push({a, b, kx, ky, minLat:Math.min(a[0],b[0]), maxLat:Math.max(a[0],b[0]), minLon:Math.min(a[1],b[1]), maxLon:Math.max(a[1],b[1]), brg:bearing(a[0],a[1],b[0],b[1])});
  }
  return {id, ram, pts, segs, fixedSign, maxDist};
}

export function buildNetwork(data){
  const secs = data.secs.map(s => Object.assign({}, s, {sign: Math.sign(s.kb - s.ka)}));
  secs.forEach(s => { s.towards = s.sign > 0 ? RAMS[s.r].plus : RAMS[s.r].minus; s.name = s.da + ' → ' + s.a; s.pos = isPos(s.d); s.cls = s.pos ? 'sud' : 'nord'; });
  const lines = LINE_DEFS.map(([id, ram, key, fixedSign, maxDist]) => makeLine(id, ram, data.ch[key], fixedSign, maxDist));
  return {secs, lines};
}

export function matchPoint(lines, lat, lon, heading, speedMs, acc, trendSign, curRam){
  const hasHeading = heading != null && !isNaN(heading) && speedMs != null && speedMs > 4;
  const out = [];
  for (const L of lines){
    const lim = L.maxDist + Math.min(acc || 25, 60);
    const pad = lim/90000 + 0.0004;
    let best = null;
    for (let i = 0; i < L.segs.length; i++){
      const s = L.segs[i];
      if (lat < s.minLat - pad || lat > s.maxLat + pad || lon < s.minLon - pad*1.45 || lon > s.maxLon + pad*1.45) continue;
      const ax = s.a[1]*s.kx, ay = s.a[0]*s.ky, bx = s.b[1]*s.kx, by = s.b[0]*s.ky, px = lon*s.kx, py = lat*s.ky;
      const dx = bx-ax, dy = by-ay, L2 = dx*dx + dy*dy;
      const t = L2 ? clamp(((px-ax)*dx + (py-ay)*dy)/L2, 0, 1) : 0;
      const d = Math.hypot(px - (ax + t*dx), py - (ay + t*dy));
      if (d <= lim && (!best || d < best.d)) best = {d, i, t};
    }
    if (!best) continue;
    const s = L.segs[best.i];
    const km = s.a[2] + best.t*(s.b[2]-s.a[2]);
    let sign = L.fixedSign, pen = 0;
    if (hasHeading){
      const hd = angDiff(heading, s.brg);
      if (L.fixedSign){ if (hd > 55) pen = 1e6; }
      else if (hd <= 65) sign = +1; else if (hd >= 115) sign = -1; else pen = 1e6;
    } else if (trendSign){
      if (L.fixedSign && L.fixedSign !== trendSign) pen = 90;
      if (!L.fixedSign) sign = trendSign;
    }
    if (pen >= 1e6) continue;
    out.push({line:L, ram:L.ram, d:best.d, km, sign, score:best.d + pen + (L.fixedSign ? 0 : 35) - (curRam && curRam === L.ram ? 50 : 0)});
  }
  out.sort((a, b) => a.score - b.score);
  return out[0] || null;
}

export function pointAtKm(L, km){
  const P = L.pts, inc = P[P.length-1][2] > P[0][2];
  for (let i = 0; i < P.length - 1; i++){
    const a = P[i][2], b = P[i+1][2];
    if (inc ? (km >= a && km <= b) : (km <= a && km >= b)){
      const t = b === a ? 0 : (km - a)/(b - a);
      return {lat:P[i][0] + t*(P[i+1][0]-P[i][0]), lon:P[i][1] + t*(P[i+1][1]-P[i][1]), brg:L.segs[i].brg};
    }
  }
  return null;
}
