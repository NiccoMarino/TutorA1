// Ricostruisce in src/data/tutor-data.json le autostrade di tools/tratti-autostrade.json (tutto tranne A1 e A4,
// che restano come sono): per ogni autostrada le due carreggiate con il chilometro a ogni punto, e i tratti.
//   node tools/make-tratti.mjs            scarica quello che manca in tools/.cache e scrive i dati
//   node tools/make-tratti.mjs --check    come sopra ma lascia stare i dati: scrive in tools/.cache/check-data.json
//                                         (o in TRATTI_OUT) e stampa il controllo di qualità
// Fonti: tracciato delle carreggiate da OpenStreetMap (Overpass); chilometri ufficiali di webcam, aree di servizio
// e caselli dai dati di viabilità di Autostrade per l'Italia. Il chilometro di ogni punto del tracciato è
// interpolato tra questi punti, scartando quelli che non sono coerenti con la lunghezza della strada.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const CACHE = new URL('tools/.cache/', ROOT);
const OVERPASS = 'https://overpass.openstreetmap.fr/api/interpreter';
const ASPI = 'https://viabilita.autostrade.it/json/';
const MARGIN = 5;          // km di tracciato prima e dopo i tratti di ogni autostrada
const SIMPLIFY = 10;        // metri: tolleranza della semplificazione del tracciato
const D2R = Math.PI/180;
export const RATIO = [0.8, 1.25];    // km ufficiali per km di strada ammessi tra due punti di riferimento

export const dist = (a, b) => Math.hypot((b[1]-a[1])*Math.cos((a[0]+b[0])/2*D2R)*111320, (b[0]-a[0])*110574);

function segProj(p, a, b){
  const kx = Math.cos(p[0]*D2R)*111320, ky = 110574;
  const ax = a[1]*kx, ay = a[0]*ky, dx = b[1]*kx - ax, dy = b[0]*ky - ay, L2 = dx*dx + dy*dy;
  const t = L2 ? Math.max(0, Math.min(1, ((p[1]*kx - ax)*dx + (p[0]*ky - ay)*dy)/L2)) : 0;
  return {t, d:Math.hypot(p[1]*kx - ax - t*dx, p[0]*ky - ay - t*dy)};
}

// Punto più vicino di una linea [{p, s}]: distanza d in metri e progressiva s in metri
export function project(line, p){
  let best = null;
  for (let i = 0; i < line.length - 1; i++){
    const {t, d} = segProj(p, line[i].p, line[i+1].p);
    if (!best || d < best.d) best = {d, s:line[i].s + t*(line[i+1].s - line[i].s)};
  }
  return best;
}

// La catena più pesante di punti in cui il chilometro ufficiale avanza come la strada (±12%):
// i punti fuori posto (webcam spostate, km sbagliati, caselli lontani) restano fuori.
export function fitChain(pts, sign){
  pts = [...pts].sort((a, b) => a.s - b.s);
  const best = pts.map(p => p.w), prev = pts.map(() => -1);
  for (let i = 0; i < pts.length; i++) for (let j = 0; j < i; j++){
    const ds = (pts[i].s - pts[j].s)/1000, dk = (pts[i].km - pts[j].km)*sign;
    const ok = ds > 0.05 ? dk/ds > RATIO[0] && dk/ds < RATIO[1] : Math.abs(dk - ds) < 0.06;
    if (ok && best[j] + pts[i].w > best[i]){ best[i] = best[j] + pts[i].w; prev[i] = j; }
  }
  let i = best.indexOf(Math.max(...best)); const chain = [];
  while (i >= 0){ chain.push(pts[i]); i = prev[i]; }
  return chain.reverse();
}

// Chilometro alla progressiva s: interpolato tra i punti della catena, oltre gli estremi un km per km
export function kmAt(chain, s, sign){
  const first = chain[0], last = chain[chain.length-1];
  if (s <= first.s) return first.km - sign*(first.s - s)/1000;
  if (s >= last.s) return last.km + sign*(s - last.s)/1000;
  for (let i = 0; i < chain.length - 1; i++){
    const a = chain[i], b = chain[i+1];
    if (s <= b.s) return a.km + (b.km - a.km)*(s - a.s)/(b.s - a.s);
  }
}

// Douglas-Peucker sui punti [lat, lon, ...]: tiene il primo, l'ultimo e quelli che si scostano più di tol metri
export function simplify(pts, tol){
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length-1] = 1;
  const stack = [[0, pts.length-1]];
  while (stack.length){
    const [i, j] = stack.pop(); let m = -1, md = tol;
    for (let k = i + 1; k < j; k++){ const {d} = segProj(pts[k], pts[i], pts[j]); if (d > md){ md = d; m = k; } }
    if (m >= 0){ keep[m] = 1; stack.push([i, m], [m, j]); }
  }
  return pts.filter((_, k) => keep[k]);
}

// Tratto della linea [[lat, lon, km]] tra due chilometri, con i due estremi interpolati
export function cut(line, k1, k2){
  const at = km => { for (let i = 0; i < line.length - 1; i++){ const a = line[i], b = line[i+1];
    if ((km - a[2])*(km - b[2]) <= 0){ const t = b[2] === a[2] ? 0 : (km - a[2])/(b[2] - a[2]); return [a[0] + t*(b[0]-a[0]), a[1] + t*(b[1]-a[1]), km]; } } return null; };
  const lo = Math.min(k1, k2), hi = Math.max(k1, k2), A = at(k1), B = at(k2);
  if (!A || !B) return null;
  return [A, ...line.filter(p => p[2] > lo && p[2] < hi), B];
}

async function cached(name, url, body){
  mkdirSync(CACHE, {recursive:true});
  const f = new URL(name, CACHE);
  if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf8'));
  const r = await fetch(url, body ? {method:'POST', headers:{'User-Agent':'TutOK-dati/1.0', 'Content-Type':'application/x-www-form-urlencoded'}, body:'data=' + encodeURIComponent(body)} : {});
  if (!r.ok) throw new Error(url + ': ' + r.status);
  const j = await r.json(); writeFileSync(f, JSON.stringify(j)); return j;
}

// Punti con chilometro ufficiale di un'autostrada (codice ASPI, es. A14), con la distanza massima dal tracciato
async function anchors(code){
  const [cams, ads, cas] = await Promise.all(['webcams', 'adss', 'caselli'].map(n => cached('aspi-' + n + '.json', ASPI + n + '.json')));
  const out = [], add = (km, lat, lon, kind, tol, w) => { if (isFinite(km) && lat && lon) out.push({km, p:[lat, lon], kind, tol, w}); };
  cams.webcams.filter(x => x.c_ram === code).forEach(x => add(x.n_prg_km, x.n_crd_lat, x.n_crd_lon, 'webcam', 120, 3));
  ads.adss.filter(x => x.c_str === code).forEach(x => add(x.n_prg_km, x.lat, x.lon, 'area', 350, 2));
  cas.results.filter(x => x.c_ram === code).forEach(x => (x.tollingIntersections || []).forEach(t => add(x.n_prg_km, t.lat, t.lon, 'casello', 700, 1)));
  return out;
}

function dijkstra(adj, sources, targets){
  const d = new Map(), prev = new Map(), done = new Set(), heap = [];
  const push = (n, v) => { heap.push([v, n]); let i = heap.length - 1; while (i){ const p = (i-1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length){ heap[0] = last; let i = 0; for (;;){ const l = 2*i+1, r = l+1; let m = i;
    if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  sources.forEach(s => { d.set(s, 0); push(s, 0); });
  while (heap.length){
    const [v, n] = pop(); if (done.has(n)) continue; done.add(n);
    if (targets.has(n)){ const path = [n]; let c = n; while (prev.has(c)){ c = prev.get(c); path.push(c); } return path.reverse(); }
    for (const [m, w] of adj.get(n) || []){ const nv = v + w; if (nv < (d.get(m) ?? Infinity)){ d.set(m, nv); prev.set(m, n); push(m, nv); } }
  }
  return null;
}

// Le due carreggiate di un'autostrada tra i km k0 e k1: percorso più breve sulle vie "motorway" di OpenStreetMap
// con quel numero (le vie senza numero costano di più), rispettando i sensi unici; poi i chilometri.
export async function carriageways(code, k0, k1){
  const pts = (await anchors(code)).filter(a => a.km >= k0 - 3 && a.km <= k1 + 3);
  const lats = pts.map(a => a.p[0]), lons = pts.map(a => a.p[1]), m = 0.04;
  const bbox = [Math.min(...lats)-m, Math.min(...lons)-m, Math.max(...lats)+m, Math.max(...lons)+m].map(v => v.toFixed(4)).join(',');
  const re = '(^|;) *A ?' + +code.slice(1) + ' *($|;)';
  const q = `[out:json][timeout:240];way["highway"="motorway"](${bbox})->.all;(way.all["ref"~"${re}"];way.all[!"ref"];)->.w;.w out body;.w >;out skel qt;`;
  const osm = await cached('osm-' + code + '-' + k0 + '-' + k1 + '.json', OVERPASS, q);
  const node = new Map(), adj = new Map(), radj = new Map();
  osm.elements.filter(e => e.type === 'node').forEach(e => node.set(e.id, [e.lat, e.lon]));
  const edge = (a, b, f) => { const w = dist(node.get(a), node.get(b))*f;
    if (!adj.has(a)) adj.set(a, []); adj.get(a).push([b, w, f]); if (!radj.has(b)) radj.set(b, []); radj.get(b).push([a, w, f]); };
  osm.elements.filter(e => e.type === 'way').forEach(w => {
    const f = w.tags.ref ? 1 : 1.6, ow = w.tags.oneway === 'no' ? 0 : w.tags.oneway === '-1' ? -1 : 1;
    for (let i = 0; i < w.nodes.length - 1; i++){ const a = w.nodes[i], b = w.nodes[i+1]; if (ow >= 0) edge(a, b, f); if (ow <= 0) edge(b, a, f); }
  });
  // estremi del percorso: le webcam o aree più vicine a k0 e k1; si parte e si arriva sugli archi a meno di 300 m.
  // Si saltano i punti senza archi vicini: alcune aree hanno le coordinate fuori strada (oltre Lucca sulla A11)
  const around = (p, end) => { const out = new Set(); for (const [a, es] of adj) for (const [b] of es) if (segProj(p, node.get(a), node.get(b)).d < 300) out.add(end ? b : a); return out; };
  const near = km => pts.filter(a => a.kind !== 'casello').sort((a, b) => Math.abs(a.km - km) - Math.abs(b.km - km)).find(a => around(a.p, false).size);
  const brg = (a, b) => Math.atan2((b[1]-a[1])*Math.cos(a[0]*D2R), b[0]-a[0]);
  const turn = (x, y) => { const d = Math.abs(x - y) % (2*Math.PI); return d > Math.PI ? 2*Math.PI - d : d; };
  function extend(graph, path, back){
    const out = [], seen = new Set(path); let cur = back ? path[0] : path.at(-1), prv = back ? path[1] : path.at(-2), len = 0;
    while (len < (MARGIN + 4)*1000){
      const dir = brg(node.get(prv), node.get(cur));
      const nx = (graph.get(cur) || []).filter(([n, , f]) => f === 1 && !seen.has(n))
        .map(([n]) => [n, turn(dir, brg(node.get(cur), node.get(n)))]).filter(([, t]) => t < Math.PI/3).sort((a, b) => a[1] - b[1])[0];
      if (!nx) break;
      len += dist(node.get(cur), node.get(nx[0])); seen.add(nx[0]); out.push(nx[0]); prv = cur; cur = nx[0];
    }
    return out;
  }
  const res = {};
  for (const [key, from, to, sign] of [['plus', near(k0), near(k1), 1], ['minus', near(k1), near(k0), -1]]){
    const found = dijkstra(adj, [...around(from.p, false)], around(to.p, true));
    if (!found) throw new Error(code + ': nessun percorso ' + (sign > 0 ? 'nel verso dei km crescenti' : 'nel verso dei km decrescenti'));
    // i punti di riferimento possono finire prima dei portali: si allunga il percorso ai due capi, sulle vie
    // con il numero dell'autostrada e scegliendo sempre la prosecuzione più diritta
    const path = [...extend(radj, found, true).reverse(), ...found, ...extend(adj, found, false)];
    const line = []; let s = 0;
    path.forEach((id, i) => { const p = node.get(id); if (i) s += dist(line[i-1].p, p); line.push({p, s}); });
    const near2 = pts.map(a => ({...a, ...project(line, a.p)})).filter(a => a.d <= a.tol && a.s > 0 && a.s < s);
    const chain = fitChain(near2, sign);
    const full = line.map(v => [v.p[0], v.p[1], kmAt(chain, v.s, sign)]);
    // solo il pezzo tra k0 e k1, poi semplificato
    const cutLine = cut(full, sign > 0 ? Math.max(k0, full[0][2]) : Math.min(k1, full[0][2]), sign > 0 ? Math.min(k1, full.at(-1)[2]) : Math.max(k0, full.at(-1)[2]));
    res[key] = {sign, line:simplify(cutLine, SIMPLIFY), chain, candidates:near2.length};
  }
  return res;
}

// Autovelox di tools/autovelox.json sulle autostrade seguite: il verso viene dai tratti con la stessa direzione,
// la carreggiata deve contenere la postazione e i 600 m prima (l'avviso parte a 500 m)
const LINE_KEY = {A01: s => s > 0 ? 'S' : 'N', A04: s => s > 0 ? 'AE' : 'AW'};
export function veloxEntries(postazioni, secs, ch){
  return postazioni.filter(p => p.strada).map((p, i) => {
    const s = secs.find(x => x.r === p.strada && x.d === p.direzione);
    if (!s) throw new Error('Autovelox ' + p.strada + ' km ' + p.km + ' ' + p.direzione + ': nessun tratto in quella direzione, verso sconosciuto');
    const sign = Math.sign(s.kb - s.ka), key = LINE_KEY[p.strada] ? LINE_KEY[p.strada](sign) : p.strada + p.direzione[0];
    const line = ch[key], kms = line ? [line[0][2], line.at(-1)[2]] : [];
    const from = p.km - sign*0.6;
    if (!line || Math.min(from, p.km) < Math.min(...kms) || Math.max(from, p.km) > Math.max(...kms))
      throw new Error('Autovelox ' + p.strada + ' km ' + p.km + ' ' + p.direzione + ': fuori dal tracciato (' + key + ')');
    return {id:i + 1, r:p.strada, km:p.km, sign, comune:p.comune};
  });
}

const r5 = v => Math.round(v*1e5)/1e5, r3 = v => Math.round(v*1e3)/1e3;
const roundLine = l => l.map(p => [r5(p[0]), r5(p[1]), r3(p[2])]);

async function main(){
  const check = process.argv.includes('--check');
  const list = JSON.parse(readFileSync(new URL('tools/tratti-autostrade.json', ROOT), 'utf8'));
  const dataUrl = new URL('src/data/tutor-data.json', ROOT);
  const data = JSON.parse(readFileSync(dataUrl, 'utf8'));
  const autovelox = JSON.parse(readFileSync(new URL('tools/autovelox.json', ROOT), 'utf8'));
  const codes = [...new Set(list.map(x => x.r))];
  // il tracciato di ogni tratto (g) serviva solo alla mappa, tolta: non si salva più
  const kept = data.secs.filter(s => !codes.includes(s.r)).map(({g, ...s}) => s);
  let id = Math.max(...kept.map(s => s.id));
  const secs = [...kept], ch = {...data.ch}, report = [];
  for (const code of codes){
    // il tracciato copre i tratti e gli autovelox della strada, più MARGIN km
    const mine = list.filter(x => x.r === code);
    const kms = [...mine.flatMap(x => [x.ka, x.kb]), ...autovelox.postazioni.filter(p => p.strada === code).map(p => p.km)];
    const k0 = Math.max(0, Math.floor(Math.min(...kms) - MARGIN)), k1 = Math.ceil(Math.max(...kms) + MARGIN);
    const cw = await carriageways(code, k0, k1);
    for (const key of ['plus', 'minus']){
      const {sign, line, chain, candidates} = cw[key];
      const dir = mine.find(x => Math.sign(x.kb - x.ka) === sign).d, lineId = code + dir[0];
      ch[lineId] = roundLine(line);
      report.push(lineId + ': km ' + r3(line[0][2]) + ' → ' + r3(line.at(-1)[2]) + ', ' + line.length + ' punti, ' + chain.length + ' punti di riferimento su ' + candidates);
      for (const x of mine.filter(x => Math.sign(x.kb - x.ka) === sign)){
        if (!cut(line, x.ka, x.kb)) throw new Error(code + ' ' + x.da + ' → ' + x.a + ': fuori dal tracciato');
        const gap = k => Math.min(...chain.map(c => Math.abs(c.km - k)));
        report.push('  ' + x.da + ' → ' + x.a + ': riferimenti più vicini a ' + gap(x.ka).toFixed(1) + ' e ' + gap(x.kb).toFixed(1) + ' km dai portali');
        secs.push({id:++id, t:x.t, r:x.r, d:x.d, da:x.da, ka:x.ka, a:x.a, kb:x.kb, L:r3(Math.abs(x.kb - x.ka))});
      }
    }
  }
  const velox = veloxEntries(autovelox.postazioni, secs, ch);
  report.push(velox.length + ' autovelox sulle autostrade seguite');
  console.log(report.join('\n'));
  console.log(secs.length + ' tratti, ' + Object.keys(ch).length + ' carreggiate');
  writeFileSync(check ? new URL(process.env.TRATTI_OUT || "tools/.cache/check-data.json", ROOT) : dataUrl, JSON.stringify({ch, secs, velox, veloxFonte:autovelox.fonte}));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) await main();
