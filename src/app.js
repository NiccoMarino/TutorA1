(function(){
'use strict';
var PRISTINE = null;
try { PRISTINE = '<!DOCTYPE html>\n' + document.documentElement.outerHTML; } catch(e) {}

function boot(){
const $ = (s, r) => (r || document).querySelector(s);
const DATA = JSON.parse(document.getElementById('tutor-data').textContent);

/* ================= formatting ================= */
const nf1 = new Intl.NumberFormat('it-IT', {minimumFractionDigits:1, maximumFractionDigits:1});
const nf0 = new Intl.NumberFormat('it-IT', {maximumFractionDigits:0});
const nfKm = new Intl.NumberFormat('it-IT', {maximumFractionDigits:3});
const nfL = new Intl.NumberFormat('it-IT', {maximumFractionDigits:2});
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function fmtDur(s){ s = Math.max(0, Math.round(s)); const m = Math.floor(s/60), r = s % 60; return m ? m + ' min ' + String(r).padStart(2,'0') + ' s' : r + ' s'; }
function fmtDist(km){ return km < 0.95 ? nf0.format(Math.max(10, Math.round(km*100)*10)) + ' m' : nf1.format(km) + ' km'; }
function speakDist(km){ if (km < 0.95) return (Math.max(100, Math.round(km*10)*100)) + ' metri'; const r = Math.round(km*2)/2; return r === 1 ? 'un chilometro' : nfL.format(r) + ' chilometri'; }
function spk(n){ return String(n).replace(/All\. /g, 'allacciamento ').replace(/Dir\. /g, 'diramazione ').replace(/S\. Maria/g, 'Santa Maria').replace(/\((nord|sud)\)/g, 'lato $1').replace(/A(\d+)/g, 'A $1'); }
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* ================= rules ================= */
// Art. 345 Reg. CdS: riduzione del 5% sulla velocità misurata, minimo 5 km/h.
function thresholdFor(limit){ const v = limit + 5; return v <= 100 ? v : limit / 0.95; }
function thrText(limit){ return nf1.format(Math.floor(thresholdFor(limit)*10)/10); }

/* ================= storage ================= */
const LS = {
  get(k, d){ try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
};
const SKEY = 'tutorA1.v1.settings', HKEY = 'tutorA1.v1.history';
const settings = Object.assign({limit:130, margin:2, preAlert:1, voice:true, beep:true, instWarn:true}, LS.get(SKEY, {}) || {});
const saveSettings = () => LS.set(SKEY, settings);
let history = LS.get(HKEY, []); if (!Array.isArray(history)) history = [];
const LIMITS = [[130,''],[110,'pioggia'],[100,'neopatentati'],[90,''],[80,'rimorchio']];

/* ================= roads & sections ================= */
const RAMS = {
  A01:{name:'A1', plus:'verso Napoli', minus:'verso Milano'},
  D18:{name:'A1 Diramazione Roma Nord', plus:'verso Roma', minus:'verso la A1'},
  D19:{name:'A1 Diramazione Roma Sud', plus:'verso Roma', minus:'verso la A1'},
  VAR:{name:'A1 Variante di Valico', plus:'verso Firenze', minus:'verso Bologna'},
  A04:{name:'A4', plus:'verso Trieste', minus:'verso Torino'}
};
const isPos = d => d === 'Sud' || d === 'Est';
const roadOf = s => s.r === 'A04' ? 'A4' : 'A1';
const SECS = DATA.secs.map(s => Object.assign({}, s, {sign: Math.sign(s.kb - s.ka)}));
SECS.forEach(s => { s.towards = s.sign > 0 ? RAMS[s.r].plus : RAMS[s.r].minus; s.name = s.da + ' → ' + s.a; s.pos = isPos(s.d); s.cls = s.pos ? 'sud' : 'nord'; });
const GROUPS = ['A1 Milano-Bologna','A1 Bologna-Firenze','A1 Variante di Valico','A1 Firenze-Roma','A1 Diramazione Roma Nord','A1 Roma-Napoli','A1 Diramazione Roma Sud','A4 Milano-Brescia','A4 Venezia-Trieste'];

const D2R = Math.PI/180;
function hav(la1, lo1, la2, lo2){
  const a = Math.sin((la2-la1)*D2R/2)**2 + Math.cos(la1*D2R)*Math.cos(la2*D2R)*Math.sin((lo2-lo1)*D2R/2)**2;
  return 2*6371008.8*Math.asin(Math.sqrt(a));
}
function bearing(la1, lo1, la2, lo2){
  const y = Math.sin((lo2-lo1)*D2R)*Math.cos(la2*D2R);
  const x = Math.cos(la1*D2R)*Math.sin(la2*D2R) - Math.sin(la1*D2R)*Math.cos(la2*D2R)*Math.cos((lo2-lo1)*D2R);
  return (Math.atan2(y, x)/D2R + 360) % 360;
}
function angDiff(a, b){ const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }

const LINES = [];
function addLine(id, ram, pts, fixedSign, maxDist){
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++){
    const a = pts[i], b = pts[i+1];
    const kx = Math.cos((a[0]+b[0])/2*D2R)*111320, ky = 110574;
    segs.push({a, b, kx, ky, minLat:Math.min(a[0],b[0]), maxLat:Math.max(a[0],b[0]), minLon:Math.min(a[1],b[1]), maxLon:Math.max(a[1],b[1]), brg:bearing(a[0],a[1],b[0],b[1])});
  }
  LINES.push({id, ram, pts, segs, fixedSign, maxDist});
}
addLine('A01S','A01',DATA.ch.S,+1,55);
addLine('A01N','A01',DATA.ch.N,-1,55);
addLine('D18','D18',DATA.ch.D18,0,320);
addLine('D19','D19',DATA.ch.D19,0,220);
addLine('VAR','VAR',DATA.ch.VAR,0,260);
addLine('A04E','A04',DATA.ch.AE,+1,55);
addLine('A04W','A04',DATA.ch.AW,-1,55);

function matchPoint(lat, lon, heading, speedMs, acc, trendSign, curRam){
  const hasHeading = heading != null && !isNaN(heading) && speedMs != null && speedMs > 4;
  const out = [];
  for (const L of LINES){
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
function pointAtKm(L, km){
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
const secRel = (s, km) => (km - s.ka) * s.sign;

/* ================= map ================= */
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const map = L.map('map', {preferCanvas:true, zoomControl:false, minZoom:5, maxZoom:17, zoomSnap:0.5, zoomDelta:0.5, wheelPxPerZoomLevel:90});
L.control.zoom({position:'topright', zoomInTitle:'Ingrandisci', zoomOutTitle:'Riduci'}).addTo(map);
map.attributionControl.setPrefix(false);
map.attributionControl.addAttribution('Tracciato © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>, tratti Tutor da autostrade.it e infoviaggiando.it');

const regions = L.polygon(DATA.reg.map(r => [r]), {interactive:false, weight:1, fillOpacity:1});
regions.addTo(map);
const allRoad = [DATA.ch.S, DATA.ch.N, DATA.ch.D18, DATA.ch.D19, DATA.ch.VAR, DATA.ch.AE, DATA.ch.AW].map(p => p.map(q => [q[0], q[1]]));
const roadCase = L.polyline(allRoad, {interactive:false, weight:6, lineCap:'round', lineJoin:'round'}).addTo(map);
const roadLine = L.polyline(allRoad, {interactive:false, weight:2.2, lineCap:'round', lineJoin:'round'}).addTo(map);

const secLayer = {};
function secStyle(s, hi){
  const pos = s.pos;
  return {color: css(pos ? '--sud' : '--nord'), weight: (pos ? 9 : 4.5) + (hi ? 5 : 0), opacity: hi ? 1 : 0.92, lineCap:'round', lineJoin:'round'};
}
const drawOrder = SECS.slice().sort((a, b) => (a.pos ? 0 : 1) - (b.pos ? 0 : 1));
const gateLayers = [];
const gatesGroup = L.layerGroup(), casGroup = L.layerGroup();
drawOrder.forEach(s => {
  const pl = L.polyline(s.g, secStyle(s, false)).addTo(map);
  pl.on('click', ev => { selectSection(s, false, ev.latlng); });
  secLayer[s.id] = pl;
});
drawOrder.forEach(s => {
  const st = L.circleMarker(s.g[0], {radius:6.5, weight:2.5, fillOpacity:1});
  const en = L.circleMarker(s.g[s.g.length-1], {radius:5, weight:3, fillOpacity:1});
  st.bindTooltip('Inizio: ' + esc(s.da) + ', km ' + nfKm.format(s.ka), {direction:'top'});
  en.bindTooltip('Fine: ' + esc(s.a) + ', km ' + nfKm.format(s.kb), {direction:'top'});
  st.on('click', ev => selectSection(s, false, ev.latlng)); en.on('click', ev => selectSection(s, false, ev.latlng));
  gatesGroup.addLayer(st); gatesGroup.addLayer(en);
  gateLayers.push({s, st, en});
});
DATA.cas.forEach(c => {
  L.circleMarker([c.la, c.lo], {radius:3, weight:1, color:'#fff', fillColor:'#6b7772', fillOpacity:1, interactive:false})
   .bindTooltip(esc(c.n), {permanent:true, direction:'right', offset:[5,0], className:'lbl lbl-cas', interactive:false}).addTo(casGroup);
});
[['A01S',750],['A04E',500]].forEach(([id, max]) => { const ln = LINES.find(l => l.id === id); for (let k = 50; k <= max; k += 50){
  const p = pointAtKm(ln, k);
  if (p) L.circleMarker([p.lat, p.lon], {radius:0.1, opacity:0, fillOpacity:0, interactive:false})
    .bindTooltip((id === 'A04E' ? 'A4 ' : 'A1 ') + 'km ' + k, {permanent:true, direction:'left', offset:[-6,0], className:'lbl lbl-km', interactive:false}).addTo(map);
} });
[['Milano',45.4642,9.19],['Lodi',45.314,9.503],['Piacenza',45.0526,9.693],['Parma',44.8015,10.3279],['Reggio Emilia',44.6983,10.6312],['Modena',44.6471,10.9252],['Bologna',44.4949,11.3426],['Firenze',43.7696,11.2558],['Arezzo',43.4633,11.8796],['Orvieto',42.7185,12.1107],['Roma',41.9028,12.4964],['Frosinone',41.64,13.351],['Cassino',41.492,13.831],['Caserta',41.0726,14.3323],['Napoli',40.8518,14.2681],['Torino',45.0703,7.6869],['Novara',45.4469,8.6219],['Bergamo',45.6983,9.6773],['Brescia',45.5416,10.2118],['Verona',45.4384,10.9916],['Vicenza',45.5455,11.5354],['Padova',45.4064,11.8768],['Venezia',45.4408,12.3155],['Udine',46.0711,13.2346],['Trieste',45.6495,13.7768]]
  .forEach(c => L.marker([c[1], c[2]], {interactive:false, keyboard:false, icon:L.divIcon({className:'', html:'<div class="city">' + c[0] + '</div>', iconSize:[0,0]})}).addTo(map));

function applyMapTheme(){
  regions.setStyle({color:css('--region'), fillColor:css('--land'), fillOpacity:1, opacity:1});
  if (typeof setTiles === 'function') setTiles();
  roadCase.setStyle({color:css('--road-case')});
  roadLine.setStyle({color:css('--road')});
  SECS.forEach(s => secLayer[s.id].setStyle(secStyle(s, s === hiSec)));
  gateLayers.forEach(g => {
    const col = css(g.s.pos ? '--sud' : '--nord');
    g.st.setStyle({color:'#fff', fillColor:col});
    g.en.setStyle({color:col, fillColor:'#fff'});
  });
}
let hiSec = null;
function highlight(s){
  if (hiSec && hiSec !== s) secLayer[hiSec.id].setStyle(secStyle(hiSec, false));
  hiSec = s || null;
  if (s){ secLayer[s.id].setStyle(secStyle(s, true)); secLayer[s.id].bringToFront(); bringGates(s); }
}
function bringGates(s){
  const g = gateLayers.find(x => x.s === s);
  if (g && map.hasLayer(gatesGroup)){ g.st.bringToFront(); g.en.bringToFront(); }
}
function zoomClass(){
  const z = map.getZoom(), c = map.getContainer().classList;
  c.toggle('z-lo', z < 8.5); c.toggle('z-mid', z >= 8.5 && z < 10.5);
  const show = z >= 8.5;
  if (show && !map.hasLayer(gatesGroup)){ casGroup.addTo(map); gatesGroup.addTo(map); }
  if (!show && map.hasLayer(gatesGroup)){ map.removeLayer(gatesGroup); map.removeLayer(casGroup); }
  if (hiSec) bringGates(hiSec);
}
map.on('zoomend', zoomClass);
const A1_BOUNDS = L.latLngBounds(allRoad[0].concat(allRoad[5]));
function fitAll(){ map.fitBounds(A1_BOUNDS, {padding:[24,24]}); }
fitAll(); zoomClass(); applyMapTheme();
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyMapTheme); } catch(e){}
new MutationObserver(applyMapTheme).observe(document.documentElement, {attributes:true, attributeFilter:['data-theme','class']});

// Mappa stradale di sfondo (OpenStreetMap; nel tema scuro è scurita con un filtro CSS). Nel visualizzatore di Claude le immagini
// esterne sono bloccate: in quel caso resta la mappa vettoriale disegnata qui sotto.
var tileLayer = null, tileDark = null, tilesOk = false;
const isDark = () => {
  const t = document.documentElement.getAttribute('data-theme');
  if (t) return t === 'dark';
  try { return matchMedia('(prefers-color-scheme: dark)').matches; } catch(e){ return false; }
};
function tileUrl(){ return 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'; }
function setTiles(){
  if (!tilesOk) return;
  const dark = isDark();
  if (tileLayer && tileDark === dark) return;
  if (tileLayer) map.removeLayer(tileLayer);
  tileDark = dark;
  let errors = 0, loads = 0;
  tileLayer = L.tileLayer(tileUrl(), {maxZoom:19, className: dark ? 'tiles-dark' : '', attribution:'Mappa © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'});
  tileLayer.on('tileload', () => { loads++; });
  tileLayer.on('tileerror', () => { errors++; if (errors > 12 && loads === 0 && tileLayer){ map.removeLayer(tileLayer); tileLayer = null; tilesOk = false; document.body.classList.remove('has-tiles'); } });
  tileLayer.addTo(map).bringToBack();
  document.body.classList.add('has-tiles');
}
(function probeTiles(){
  const img = new Image(); let done = false;
  img.onload = () => { if (done) return; done = true; if (img.naturalWidth >= 200){ tilesOk = true; setTiles(); } };
  img.onerror = () => { done = true; };
  setTimeout(() => { done = true; }, 8000);
  img.src = 'https://tile.openstreetmap.org/6/34/23.png';
})();

// user marker
const meIcon = L.divIcon({className:'', iconSize:[40,40], iconAnchor:[20,20],
  html:'<div class="me"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3 L33 35 L20 27.5 L7 35 Z" fill="#0B57D0" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/></svg></div>'});
let meMarker = null, meAcc = null, follow = true;
function updateMe(f){
  const ll = [f.lat, f.lon];
  if (!meMarker){
    meAcc = L.circle(ll, {radius:f.acc || 20, weight:1, color:'#0B57D0', fillColor:'#0B57D0', fillOpacity:.12, interactive:false}).addTo(map);
    meMarker = L.marker(ll, {icon:meIcon, keyboard:false, interactive:false, zIndexOffset:1000}).addTo(map);
  } else { meMarker.setLatLng(ll); meAcc.setLatLng(ll).setRadius(f.acc || 20); }
  const svg = meMarker.getElement() && meMarker.getElement().querySelector('svg');
  if (svg && f.heading != null) svg.style.transform = 'rotate(' + f.heading + 'deg)';
  if (follow) map.setView(ll, Math.max(map.getZoom(), 12.5), {animate:true, duration:0.6});
}
map.on('dragstart', () => { if (st.running){ follow = false; $('#btnFollow').hidden = false; } });
$('#btnFollow').addEventListener('click', () => { follow = true; $('#btnFollow').hidden = true; if (st.fix) map.setView([st.fix.lat, st.fix.lon], Math.max(map.getZoom(), 13)); });
$('#btnFit').addEventListener('click', () => { follow = false; if (st.running) $('#btnFollow').hidden = false; fitAll(); });

/* ================= sidebar: list, popups ================= */
const nA1 = SECS.filter(s => roadOf(s) === 'A1').length, nA4 = SECS.length - nA1;
$('#lede').textContent = SECS.length + ' tratti con controllo della velocità media: ' + nA1 + ' sulla A1 da Milano a Napoli, con diramazioni di Roma e Variante di Valico, e ' + nA4 + ' sulla A4 tra Milano e Brescia e tra Venezia e Trieste.';
let filterDir = 'all', filterRoad = 'all';
function minTimeText(s, v){ return fmtDur(s.L / v * 3600); }
function popupHTML(s){
  const lim = settings.limit;
  return '<div class="pop"><h4>' + esc(s.name) + '</h4>' +
    '<p class="muted">' + esc(s.t) + ', direzione ' + s.d + ' (' + esc(s.towards) + ')</p>' +
    '<p>Portale di inizio al km ' + nfKm.format(s.ka) + ', fine al km ' + nfKm.format(s.kb) + '</p>' +
    '<p>Lunghezza <b>' + nfL.format(s.L) + ' km</b></p>' +
    '<p>A ' + lim + ' km/h servono almeno <b>' + minTimeText(s, lim) + '</b>. Alla soglia di ' + thrText(lim) + ' km/h: ' + minTimeText(s, thresholdFor(lim)) + '.</p>' +
    '<button class="btn btn-small" type="button" data-simsec="' + s.id + '">Simula questo tratto</button></div>';
}
function selectSection(s, zoom, at){
  highlight(s);
  document.querySelectorAll('.sec.on').forEach(e => e.classList.remove('on'));
  const row = document.querySelector('.sec[data-id="' + s.id + '"]'); if (row) row.classList.add('on');
  const pl = secLayer[s.id];
  if (zoom) map.fitBounds(pl.getBounds(), {paddingTopLeft:[40,230], paddingBottomRight:[40,40], maxZoom:13});
  const mid = s.g[Math.floor(s.g.length/2)];
  L.popup({maxWidth:300, autoPanPadding:[30,30]}).setLatLng(at || mid).setContent(popupHTML(s)).openOn(map);
}
map.getContainer().addEventListener('click', e => {
  const b = e.target.closest('[data-simsec]'); if (!b) return;
  map.closePopup(); startSim(+b.getAttribute('data-simsec'), 125);
});
function renderList(){
  const box = $('#list'); box.innerHTML = '';
  GROUPS.forEach(g => {
    const items = SECS.filter(s => s.t === g && (filterRoad === 'all' || roadOf(s) === filterRoad) && (filterDir === 'all' || (filterDir === 'pos') === s.pos));
    if (!items.length) return;
    const wrap = document.createElement('div'); wrap.className = 'group';
    wrap.innerHTML = '<h2>' + esc(g) + '</h2>';
    [...new Set(items.map(s => s.d))].sort((x, y) => isPos(y) - isPos(x)).forEach(d => {
      const list = items.filter(s => s.d === d).sort((a, b) => (a.ka - b.ka) * a.sign);
      if (!list.length) return;
      const h = document.createElement('h3');
      h.innerHTML = '<i class="dot ' + list[0].cls + '"></i>Direzione ' + d + ', ' + esc(list[0].towards);
      wrap.appendChild(h);
      list.forEach(s => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'sec ' + s.cls; b.dataset.id = s.id;
        b.innerHTML = '<span class="nm">' + esc(s.name) + '</span><span class="len">' + nfL.format(s.L) + ' km</span><span class="meta">dal km ' + nfKm.format(s.ka) + ' al km ' + nfKm.format(s.kb) + '</span>';
        b.addEventListener('click', () => { selectSection(s, true); if (innerWidth <= 820) $('.mapwrap').scrollIntoView({behavior:'smooth', block:'start'}); });
        wrap.appendChild(b);
      });
    });
    box.appendChild(wrap);
  });
}
$('#filter').addEventListener('click', e => {
  const b = e.target.closest('[data-f]'); if (!b) return;
  filterDir = b.dataset.f;
  document.querySelectorAll('#filter .chip').forEach(c => c.setAttribute('aria-pressed', String(c === b)));
  renderList();
});
$('#filterRoad').addEventListener('click', e => {
  const b = e.target.closest('[data-r]'); if (!b) return;
  filterRoad = b.dataset.r;
  document.querySelectorAll('#filterRoad .chip').forEach(c => c.setAttribute('aria-pressed', String(c === b)));
  renderList();
});
renderList();

/* ================= settings UI ================= */
function renderLimitChips(){
  const box = $('#setLimits'); box.innerHTML = '';
  const hbox = $('#hudLimits'); hbox.querySelectorAll('.hchip').forEach(x => x.remove());
  LIMITS.forEach(([v, lab]) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip';
    b.setAttribute('aria-pressed', String(settings.limit === v));
    b.textContent = lab ? v + ' ' + lab : String(v);
    b.addEventListener('click', () => setLimit(v));
    box.appendChild(b);
    const h = document.createElement('button'); h.type = 'button'; h.className = 'hchip';
    h.setAttribute('aria-pressed', String(settings.limit === v)); h.textContent = v;
    h.addEventListener('click', () => { setLimit(v); say('Limite impostato a ' + v, null, true); });
    hbox.appendChild(h);
  });
}
function setLimit(v){ settings.limit = v; saveSettings(); renderLimitChips(); renderMargin(); renderHUD(); }
function renderMargin(){
  $('#setMargin').value = settings.margin;
  $('#marginOut').textContent = settings.margin + ' km/h';
  $('#marginHelp').textContent = 'Con limite ' + settings.limit + ' la soglia di sanzione è ' + thrText(settings.limit) + ' km/h: l\'allarme scatta quando la media arriva a ' + nf1.format(thresholdFor(settings.limit) - settings.margin) + ' km/h. Sopra ' + settings.limit + ' la schermata diventa gialla.';
}
$('#setMargin').addEventListener('input', e => { settings.margin = +e.target.value; saveSettings(); renderMargin(); renderHUD(); });
$('#setPre').value = String(settings.preAlert);
$('#setPre').addEventListener('change', e => { settings.preAlert = +e.target.value; saveSettings(); });
[['#setVoice','voice'],['#setBeep','beep'],['#setInst','instWarn']].forEach(([id, k]) => {
  const el = $(id); el.checked = !!settings[k];
  el.addEventListener('change', () => { settings[k] = el.checked; saveSettings(); renderMute(); });
});
renderLimitChips(); renderMargin();

/* ================= history ================= */
function verdictOf(avg, lim){ if (avg == null) return ['n/d','']; if (avg <= lim) return ['in regola','ok']; if (avg <= thresholdFor(lim)) return ['sopra il limite, entro la tolleranza','tol']; return ['oltre la soglia di sanzione','bad']; }
function renderHistory(){
  const ul = $('#hist'); ul.innerHTML = '';
  if (!history.length){ ul.innerHTML = '<li>Qui compariranno i tratti che percorri con la modalità guida, con la media rilevata.</li>'; return; }
  history.slice(0, 30).forEach(h => {
    const d = new Date(h.t);
    const [vt, vc] = verdictOf(h.avg, h.lim);
    const li = document.createElement('li');
    li.innerHTML = '<b>' + esc(h.da + ' → ' + h.a) + '</b><br>' + d.toLocaleDateString('it-IT', {day:'numeric', month:'short'}) + ', ' + d.toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'}) +
      ': media <span class="v ' + vc + '">' + (h.avg != null ? nf1.format(h.avg) + ' km/h' : 'n/d') + '</span>, ' + vt + ' (limite ' + h.lim + ')' +
      (h.partial ? ', misura parziale' : '') + (h.sim ? ', simulazione' : '');
    ul.appendChild(li);
  });
}
$('#histClear').addEventListener('click', () => { history = []; LS.set(HKEY, history); renderHistory(); });
renderHistory();

/* ================= audio & voice ================= */
let actx = null;
function initAudio(){
  try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch(e){ actx = null; }
  try { if (window.speechSynthesis) speechSynthesis.getVoices(); } catch(e){}
}
function tones(seq){
  if (!settings.beep || !actx) return;
  let t = actx.currentTime + 0.02;
  seq.forEach(([f, d]) => {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + d + 0.02); t += d + 0.06;
  });
}
const TONES = {pre:[[660,.16],[880,.22]], start:[[880,.12],[880,.12],[1175,.28]], alarm:[[1320,.14],[1320,.14],[1320,.14],[990,.3]], end:[[880,.16],[660,.16],[523,.3]], soft:[[740,.18]], inst:[[1175,.12],[1175,.12]]};
let itVoice = null;
function pickVoice(){ try { const vs = speechSynthesis.getVoices(); itVoice = vs.find(v => /^it(-|_)IT/i.test(v.lang)) || vs.find(v => /^it/i.test(v.lang)) || null; } catch(e){} }
try { speechSynthesis.onvoiceschanged = pickVoice; pickVoice(); } catch(e){}
function say(text, kind, silentVoice){
  $('#toast').textContent = text;
  if (kind) tones(TONES[kind]);
  if (!settings.voice || silentVoice || !window.speechSynthesis) return;
  try {
    if (kind === 'alarm' || kind === 'start' || kind === 'end') speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = 'it-IT'; if (itVoice) u.voice = itVoice; u.rate = 1.03;
    setTimeout(() => speechSynthesis.speak(u), kind ? 700 : 0);
  } catch(e){}
}
function vibrate(p){ try { if (navigator.vibrate) navigator.vibrate(p); } catch(e){} }
function renderMute(){ const on = settings.voice || settings.beep; const b = $('#hudMute'); b.textContent = on ? 'Audio sì' : 'Audio no'; b.setAttribute('aria-pressed', String(!on)); }
$('#hudMute').addEventListener('click', () => {
  const on = settings.voice || settings.beep;
  settings.voice = !on; settings.beep = !on; saveSettings();
  $('#setVoice').checked = settings.voice; $('#setBeep').checked = settings.beep; renderMute();
});
renderMute();

/* ================= drive state ================= */
const st = {running:false, source:null, watchId:null, fix:null, prevFix:null, odo:0,
  onRoad:false, matchStreak:0, missStreak:0, ram:null, km:null, sign:0, trendSign:0, trendKm:null,
  active:null, next:null, alerted:new Set(), result:null, instSince:null, lastInst:0, wake:null, lastWall:0, endMsg:null, dog:null};

function resetState(){
  Object.assign(st, {endMsg:null, lastWall:0, fix:null, prevFix:null, odo:0, onRoad:false, matchStreak:0, missStreak:0, ram:null, km:null, sign:0, trendSign:0, trendKm:null, active:null, next:null, result:null, instSince:null, lastInst:0});
  st.alerted = new Set();
}
async function keepAwake(){ try { if ('wakeLock' in navigator && document.visibilityState === 'visible') st.wake = await navigator.wakeLock.request('screen'); } catch(e){} }
document.addEventListener('visibilitychange', () => { if (st.running && document.visibilityState === 'visible') keepAwake(); });

function enterDrive(source){
  initAudio();
  resetState();
  st.running = true; st.source = source; follow = true;
  document.body.classList.add('driving');
  $('#btnFollow').hidden = true;
  $('#simBar').hidden = source !== 'sim';
  map.closePopup();
  setTimeout(() => map.invalidateSize(), 60);
  keepAwake(); renderHUD();
  window.scrollTo(0, 0);
  if (st.dog) clearInterval(st.dog);
  st.dog = setInterval(watchdog, 1000);
}
function stopDrive(){
  if (st.watchId != null){ try { navigator.geolocation.clearWatch(st.watchId); } catch(e){} st.watchId = null; }
  if (sim.timer){ clearInterval(sim.timer); sim.timer = null; }
  if (st.active) abortActive(null);
  st.running = false;
  if (st.dog){ clearInterval(st.dog); st.dog = null; }
  try { if (st.wake) st.wake.release(); } catch(e){} st.wake = null;
  try { speechSynthesis.cancel(); } catch(e){}
  document.body.classList.remove('driving');
  highlight(null);
  setTimeout(() => { map.invalidateSize(); }, 60);
}
$('#hudExit').addEventListener('click', stopDrive);

function gpsNote(html, good){ const n = $('#gpsNote'); n.innerHTML = html; n.hidden = !html; n.classList.toggle('good', !!good); }
$('#btnDrive').addEventListener('click', () => {
  gpsNote('');
  if (!('geolocation' in navigator)){ gpsNote('Questo browser non offre la posizione GPS. Prova un altro browser oppure usa la simulazione.'); return; }
  enterDrive('gps');
  try {
    st.watchId = navigator.geolocation.watchPosition(onPosition, onGpsError, {enableHighAccuracy:true, maximumAge:0, timeout:20000});
  } catch(e){ onGpsError({code:2, message:String(e)}); }
});
function onGpsError(e){
  if (e && e.code === 1){
    stopDrive();
    gpsNote('La posizione è bloccata. Controlla che il browser abbia il permesso di usarla. Se stai usando l\'app dentro Claude, il visualizzatore può non concederla: scarica l\'app dalla sezione <b>Dati, precisione e uso fuori da Claude</b> e aprila dal browser del telefono. Intanto puoi usare la simulazione.');
    $('#side').scrollTo && $('#side').scrollTo(0, 0);
  } else if (st.running){
    $('#hudRoad').firstChild.textContent = e && e.code === 3 ? 'Segnale GPS lento ad arrivare' : 'GPS non disponibile al momento';
  }
}

/* ================= core: every position ================= */
function onPosition(p){
  if (!st.running) return;
  const c = p.coords, t = (p.timestamp || Date.now())/1000;
  const fix = {lat:c.latitude, lon:c.longitude, acc:c.accuracy || 30, t,
    heading:(c.heading != null && !isNaN(c.heading)) ? c.heading : null,
    v:(c.speed != null && !isNaN(c.speed) && c.speed >= 0) ? c.speed : null};
  const prev = st.fix;
  if (prev && t <= prev.t) return;
  st.lastWall = Date.now()/1000;
  if (prev){
    const dt = t - prev.t, dPos = hav(prev.lat, prev.lon, fix.lat, fix.lon);
    // scarta i salti di posizione impossibili (oltre 270 km/h), salvo che si ripetano
    if (dt > 0 && dPos/dt > 75 && dPos > 150){
      st.jumps = (st.jumps || 0) + 1;
      if (st.jumps < 3) return;
      st.jumps = 0; st.fix = null; st.prevFix = null; st.matchStreak = 0;
      if (st.active) abortActive('Segnale GPS instabile: misura del tratto interrotta.');
      return;
    }
    st.jumps = 0;
    if (fix.v == null) fix.v = dt > 0 ? dPos/dt : 0;
    if (fix.v > 75) fix.v = prev.v != null ? prev.v : 0;
    if (fix.heading == null && dPos > 8) fix.heading = bearing(prev.lat, prev.lon, fix.lat, fix.lon);
    st.odo += (dt <= 10 && prev.v != null) ? (prev.v + fix.v)/2*dt : dPos;
  }
  fix.odo = st.odo;
  st.prevFix = prev; st.fix = fix;

  const m = matchPoint(fix.lat, fix.lon, fix.heading, fix.v, fix.acc, st.trendSign, st.onRoad ? st.ram : null);
  if (m){
    if (st.trendKm != null && st.ram === m.ram){ const dk = m.km - st.trendKm; if (Math.abs(dk) > 0.05){ st.trendSign = Math.sign(dk); st.trendKm = m.km; } }
    else st.trendKm = m.km;
    const prevKm = st.ram === m.ram ? st.km : null, prevSign = st.sign;
    st.missStreak = 0; st.matchStreak++;
    st.ram = m.ram; st.km = m.km; st.sign = m.sign || st.trendSign || 0;
    st.onRoad = st.matchStreak >= 2;
    if (st.onRoad && st.sign) updateSections(prevKm, prevSign);
  } else {
    st.missStreak++; st.matchStreak = 0;
    if (st.missStreak >= 6){
      if (st.active) abortActive('Sei uscito dal tracciato: misura del tratto interrotta.');
      st.onRoad = false; st.ram = null; st.km = null; st.sign = 0; st.next = null; st.trendKm = null; st.trendSign = 0;
      st.alerted.clear();
    }
  }
  checkInstant(fix);
  updateMe(fix);
  renderHUD();
}

function updateSections(prevKm, prevSign){
  const f = st.fix, pf = st.prevFix, km = st.km, sign = st.sign;
  if (st.active){
    const a = st.active, s = a.sec;
    if (s.r !== st.ram || s.sign !== sign) abortActive('Direzione cambiata: misura del tratto interrotta.');
    else {
      const rel = secRel(s, km);
      if (rel >= s.L){
        let tEnd = f.t, odoEnd = f.odo;
        if (prevKm != null && pf){
          const r0 = secRel(s, prevKm);
          if (rel !== r0){ const fr = clamp((s.L - r0)/(rel - r0), 0, 1); tEnd = pf.t + fr*(f.t - pf.t); odoEnd = pf.odo + fr*(f.odo - pf.odo); }
        }
        finishActive(tEnd, odoEnd);
      }
    }
  }
  const cands = SECS.filter(s => s.r === st.ram && s.sign === sign);
  if (!st.active){
    const inside = cands.find(s => { const r = secRel(s, km); return r >= 0 && r < s.L - 0.05; });
    if (inside && !(st.result && st.result.sec === inside)){
      let tStart = f.t, odoStart = f.odo, mid = true;
      if (prevKm != null && pf && prevSign === sign){
        const r0 = secRel(inside, prevKm), r1 = secRel(inside, km);
        if (r0 < 0 && r1 >= 0 && r1 > r0){ const fr = clamp(-r0/(r1 - r0), 0, 1); tStart = pf.t + fr*(f.t - pf.t); odoStart = pf.odo + fr*(f.odo - pf.odo); mid = false; }
      }
      startActive(inside, tStart, odoStart, mid);
    }
  }
  let next = null, best = Infinity;
  cands.forEach(s => { const r = secRel(s, km); if (r < 0 && -r < best){ best = -r; next = s; } });
  st.next = next ? {sec:next, dist:best} : null;
  if (st.endMsg){ say(st.endMsg, 'end'); st.endMsg = null; }
  if (!st.active && next && best <= settings.preAlert + 0.05 && !st.alerted.has(next.id)){
    st.alerted.add(next.id);
    say('Tra ' + speakDist(best) + ' inizia il Tutor, da ' + spk(next.da) + ' a ' + spk(next.a) + ', ' + speakDist(next.L) + '. Limite ' + settings.limit + '.', 'pre');
    flashPlate();
  }
}
function startActive(s, tStart, odoStart, mid){
  st.active = {sec:s, tStart, odoStart, mid, status:'ok', lastAlarm:0, relStart: mid ? clamp(secRel(s, st.km), 0, s.L) : 0};
  st.result = null; st.alerted.delete(s.id);
  highlight(s);
  if (st.endMsg){ say(st.endMsg + ' Subito dopo inizia il Tutor fino a ' + spk(s.a) + ', ' + speakDist(s.L) + '.', 'start'); st.endMsg = null; }
  else if (mid) say('Sei dentro il tratto Tutor da ' + spk(s.da) + ' a ' + spk(s.a) + '. Media calcolata da qui.', 'soft');
  else say('Inizio Tutor. ' + speakDist(s.L) + ' fino a ' + spk(s.a) + '.', 'start');
  flashPlate(); vibrate(120);
}
function finishActive(tEnd, odoEnd){
  const a = st.active, s = a.sec, dt = tEnd - a.tStart, dist = odoEnd - a.odoStart;
  const avg = dt > 5 ? dist/dt*3.6 : null, lim = settings.limit;
  history.unshift({t:Date.now(), id:s.id, da:s.da, a:s.a, avg, lim, partial:a.mid, sim:st.source === 'sim', dur:dt});
  history = history.slice(0, 60); LS.set(HKEY, history); renderHistory();
  st.result = {sec:s, avg, lim, dur:dt, until:st.fix.t + 25, partial:a.mid};
  st.active = null; st.alerted.clear();
  const [vt] = verdictOf(avg, lim);
  st.endMsg = 'Fine Tutor. Media ' + (avg != null ? Math.round(avg) + ' chilometri orari, ' + vt : 'non disponibile') + '.';
  flashPlate();
}
function abortActive(msg){
  st.active = null; highlight(null);
  if (msg) say(msg, 'soft');
}
function checkInstant(f){
  if (!settings.instWarn || !st.onRoad || f.v == null) { st.instSince = null; return; }
  const v = f.v*3.6, thr = thresholdFor(settings.limit);
  if (v > thr){
    if (st.instSince == null) st.instSince = f.t;
    if (f.t - st.instSince >= 3 && f.t - st.lastInst > 25){ st.lastInst = f.t; say('Velocità oltre ' + settings.limit, 'inst', !!(st.active && st.active.status === 'alarm')); }
  } else st.instSince = null;
}

function watchdog(){
  if (!st.running || st.source !== 'gps' || !st.fix) return;
  const gap = Date.now()/1000 - st.lastWall;
  if (gap > 6){
    const sub = $('#hudRoad small');
    if (sub) sub.textContent = 'Segnale GPS assente da ' + Math.round(gap) + ' s, forse sei in galleria';
    if (st.active) $('#advice').textContent = 'Senza GPS la media si aggiorna all\'uscita della galleria. Mantieni il limite di ' + settings.limit + '.';
  }
}
/* ================= live metrics ================= */
function metrics(){
  const a = st.active, f = st.fix, s = a.sec;
  const elapsed = Math.max(0, f.t - a.tStart), dist = Math.max(0, f.odo - a.odoStart);
  const rel = clamp(secRel(s, st.km), 0, s.L), remKm = Math.max(0, s.L - rel);
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
  else if (settled && (avg > lim || (proj != null && proj >= warnAt))) status = 'warn';
  return {elapsed, dist, rel, remKm, vNow, avg, lim, thr, warnAt, vMaxRest, proj, status, settled};
}
function adviceText(m){
  const lim = m.lim;
  if (!m.settled) return 'Calcolo della media in corso. Limite ' + lim + '.';
  if (m.status === 'alarm'){
    if (isFinite(m.vMaxRest) && m.vMaxRest >= 60) return 'Media oltre la soglia: rallenta e resta sotto ' + Math.floor(Math.min(m.vMaxRest, lim)) + ' km/h fino al portale.';
    return 'Media oltre la soglia: rallenta, più tempo resti sotto il limite più la media scende.';
  }
  if (!isFinite(m.vMaxRest) || m.vMaxRest >= lim) return m.avg > lim ? 'Media sopra ' + lim + ' ma entro la tolleranza. Rispetta il limite fino al portale.' : 'Rispettando il limite di ' + lim + ' chiudi il tratto in regola.';
  return 'Per chiudere sotto la soglia resta sotto ' + Math.floor(m.vMaxRest) + ' km/h fino al portale.';
}

/* ================= HUD render ================= */
function setPlate(cls, kicker, title, big, unit, sub){
  const p = $('#plate'); p.className = 'plate ' + cls + (p.classList.contains('flash') ? ' flash' : '');
  $('#pKicker').textContent = kicker; $('#pTitle').textContent = title;
  $('#pBig').textContent = big; $('#pUnit').textContent = unit; $('#pSub').textContent = sub;
}
let flashT = null;
function flashPlate(){ const p = $('#plate'); p.classList.remove('flash'); void p.offsetWidth; p.classList.add('flash'); clearTimeout(flashT); flashT = setTimeout(() => p.classList.remove('flash'), 2000); }
function renderHUD(){
  if (!st.running) return;
  const f = st.fix, lim = settings.limit;
  $('#sLim').textContent = lim; $('#sThr').textContent = thrText(lim);
  $('#sThrL').textContent = settings.margin ? 'soglia, allarme a ' + nf1.format(thresholdFor(lim) - settings.margin) : 'soglia con tolleranza';
  const vNow = f && f.v != null ? f.v*3.6 : null;
  $('#sInst').textContent = vNow != null ? nf0.format(vNow) : '–';
  $('#stInst').classList.toggle('hot', vNow != null && vNow > thresholdFor(lim));
  $('#hudLimits').querySelectorAll('.hchip').forEach(h => h.setAttribute('aria-pressed', String(+h.textContent === lim)));
  const simTag = st.source === 'sim' ? '<span class="pill">Simulazione</span>' : '';
  const road = $('#hudRoad');
  if (!f){ road.innerHTML = 'In attesa del segnale GPS' + simTag + '<small>Tieni il telefono con vista del cielo</small>'; }
  else if (st.onRoad && st.ram){
    road.innerHTML = esc(RAMS[st.ram].name) + ', km ' + nf1.format(st.km) + simTag + '<small>' + (st.sign ? esc(st.sign > 0 ? RAMS[st.ram].plus : RAMS[st.ram].minus) : 'direzione da determinare') + ', precisione GPS ' + nf0.format(f.acc) + ' m</small>';
  } else road.innerHTML = 'Fuori da A1 e A4' + simTag + '<small>Precisione GPS ' + nf0.format(f.acc) + ' m</small>';

  const prog = $('#pProg'); let advice = '';
  if (st.active){
    const a = st.active, s = a.sec, m = metrics();
    if (m.status !== a.status){
      if (m.status === 'alarm'){ say('Attenzione, media oltre la soglia. Rallenta.', 'alarm'); vibrate([220,100,220]); a.lastAlarm = st.fix.t; }
      else if (a.status === 'alarm') say('Media rientrata sotto la soglia.', 'soft');
      a.status = m.status;
    } else if (m.status === 'alarm' && st.fix.t - a.lastAlarm > 30){ a.lastAlarm = st.fix.t; say('Media ancora oltre la soglia.', 'alarm'); vibrate([220,100,220]); }
    setPlate(m.status, a.mid ? 'Tutor in corso, media parziale' : 'Tutor in corso', s.name,
      m.avg != null ? nf0.format(m.avg) : '–', 'km/h di media',
      nf1.format(m.dist/1000) + ' km percorsi in ' + fmtDur(m.elapsed) + (m.proj != null && m.settled ? ', a questo ritmo chiudi a ' + nf0.format(m.proj) : ''));
    prog.hidden = false;
    $('#pFill').style.width = (m.rel / s.L * 100).toFixed(1) + '%';
    $('#pFrom').textContent = 'km ' + nfKm.format(s.ka);
    $('#pTo').textContent = 'mancano ' + fmtDist(m.remKm);
    advice = adviceText(m);
  } else if (st.result && f && f.t < st.result.until){
    const r = st.result, [vt, vc] = verdictOf(r.avg, r.lim);
    setPlate(vc === 'ok' ? 'done-ok' : vc === 'tol' ? 'done-tol' : 'done-bad', 'Tratto concluso' + (r.partial ? ', misura parziale' : ''), r.sec.name,
      r.avg != null ? nf1.format(r.avg) : '–', 'km/h di media', vt.charAt(0).toUpperCase() + vt.slice(1) + ', tempo ' + fmtDur(r.dur));
    prog.hidden = true;
    advice = st.next ? 'Prossimo Tutor tra ' + fmtDist(st.next.dist) + '.' : '';
  } else if (!f){
    setPlate('', 'Avvio', 'Sto cercando la tua posizione', '–', '', 'Il monitoraggio parte appena il GPS ti trova sulla A1 o sulla A4.'); prog.hidden = true;
  } else if (!st.onRoad){
    setPlate('', 'Fuori da A1 e A4', 'Il monitoraggio parte quando entri in una delle due autostrade', vNow != null ? nf0.format(vNow) : '–', 'km/h', ''); prog.hidden = true;
  } else if (!st.sign){
    setPlate('', 'Sulla ' + RAMS[st.ram].name, 'Sto capendo in che direzione vai', vNow != null ? nf0.format(vNow) : '–', 'km/h', ''); prog.hidden = true;
  } else if (st.next){
    const n = st.next, near = n.dist <= settings.preAlert + 0.05;
    const eta = vNow && vNow > 20 ? ', circa ' + fmtDur(n.dist/vNow*3600) : '';
    const meters = n.dist < 0.95;
    const big = meters ? nf0.format(Math.max(10, Math.round(n.dist*100)*10)) : nf1.format(n.dist);
    setPlate(near ? 'go' : '', near ? 'Il Tutor sta per iniziare' : 'Prossimo Tutor', n.sec.name, big, meters ? 'm al portale' : 'km al portale',
      'Tratto di ' + nfL.format(n.sec.L) + ' km' + eta);
    prog.hidden = true;
    highlight(n.sec);
    advice = near ? 'Limite ' + lim + ': al portale di inizio parte il calcolo della media.' : '';
  } else {
    setPlate('', 'Nessun Tutor più avanti', 'In questa direzione non ci sono altri tratti controllati', vNow != null ? nf0.format(vNow) : '–', 'km/h', ''); prog.hidden = true;
    highlight(null);
  }
  $('#advice').textContent = advice;
}

/* ================= simulation ================= */
const sim = {timer:null, line:null, km:0, sign:1, speed:125, warp:1, t:0};
const simSel = $('#simSec');
GROUPS.forEach(g => {
  const og = document.createElement('optgroup'); og.label = g;
  SECS.filter(s => s.t === g).sort((a, b) => (b.pos - a.pos) || (a.ka - b.ka) * a.sign).forEach(s => { const o = document.createElement('option'); o.value = s.id; o.textContent = s.name + ' (Dir. ' + s.d + ')'; og.appendChild(o); });
  simSel.appendChild(og);
});
$('#btnSimOpen').addEventListener('click', () => { const box = $('#simSetup'); box.hidden = !box.hidden; $('#btnSimOpen').setAttribute('aria-expanded', String(!box.hidden)); });
$('#btnSimStart').addEventListener('click', () => startSim(+simSel.value, clamp(+$('#simV').value || 125, 50, 170)));
[1,5,15].forEach(w => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'hchip'; b.textContent = '×' + w; b.dataset.w = w;
  b.setAttribute('aria-pressed', String(w === 1)); b.title = 'Tempo accelerato ' + w + ' volte';
  b.addEventListener('click', () => { sim.warp = w; document.querySelectorAll('#simWarp .hchip').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
  $('#simWarp').appendChild(b);
});
$('#simSpeed').addEventListener('input', e => { sim.speed = +e.target.value; $('#simSpeedOut').textContent = sim.speed + ' km/h'; });
$('#simJump').addEventListener('click', () => {
  if (!sim.line) return;
  const cands = SECS.filter(s => s.r === sim.line.ram && s.sign === sim.sign && secRel(s, sim.km) < -0.3).sort((a, b) => secRel(b, sim.km) - secRel(a, sim.km));
  const n = cands[0]; if (!n) { say('Nessun altro Tutor in questa direzione.', null, true); return; }
  if (st.active) abortActive(null);
  sim.km = n.ka - n.sign*1.4; st.fix = null; st.prevFix = null; st.matchStreak = 0; st.trendKm = null; st.result = null; st.alerted.clear();
  follow = true; $('#btnFollow').hidden = true;
});
function startSim(id, v){
  const s = SECS.find(x => x.id === id); if (!s) return;
  const line = LINES.find(l => l.ram === s.r && (l.fixedSign === s.sign || l.fixedSign === 0));
  const P = line.pts, kmin = Math.min(P[0][2], P[P.length-1][2]), kmax = Math.max(P[0][2], P[P.length-1][2]);
  Object.assign(sim, {line, sign:s.sign, speed:v, km:clamp(s.ka - s.sign*2.2, kmin + 0.01, kmax - 0.01), t:Date.now()/1000});
  $('#simSpeed').value = v; $('#simSpeedOut').textContent = v + ' km/h';
  enterDrive('sim');
  if (sim.timer) clearInterval(sim.timer);
  sim.timer = setInterval(simTick, 500);
  simTick();
}
function simTick(){
  const dt = 0.5*sim.warp;
  sim.t += dt;
  const v = Math.max(0, sim.speed + (Math.random() - 0.5)*1.6);
  sim.km += sim.sign * v/3600 * dt;
  const p = pointAtKm(sim.line, sim.km);
  if (!p){ clearInterval(sim.timer); sim.timer = null; say('Fine del percorso simulato.', 'soft'); return; }
  const inc = sim.line.pts[sim.line.pts.length-1][2] > sim.line.pts[0][2];
  const along = (sim.sign > 0) === inc;
  const heading = along ? p.brg : (p.brg + 180) % 360;
  const j = () => (Math.random() - 0.5)*0.00005;
  onPosition({coords:{latitude:p.lat + j(), longitude:p.lon + j(), accuracy:6, speed:v/3.6, heading}, timestamp:sim.t*1000});
}

/* ================= download a standalone copy ================= */
let dlCap = null, dlProbe = false;
function probeDownloads(){
  if (dlProbe) return; 
  const c = window.claude;
  if (c && typeof c.use === 'function'){
    dlProbe = true;
    c.use('downloads').then(ns => { dlCap = ns || null; }).catch(() => { dlCap = null; });
  }
}
probeDownloads(); setTimeout(probeDownloads, 1500);
function exportHTML(){
  if (!PRISTINE) return null;
  try {
    const doc = new DOMParser().parseFromString(PRISTINE, 'text/html');
    doc.querySelectorAll('script:not([data-keep])').forEach(s => s.remove());
    return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
  } catch(e){ return PRISTINE; }
}
$('#btnDownload').addEventListener('click', async () => {
  const msg = $('#dlMsg'); const html = exportHTML();
  if (!html){ msg.hidden = false; msg.textContent = 'Non riesco a preparare il file in questa vista.'; return; }
  probeDownloads();
  if (window.claude && typeof window.claude.use === 'function'){
    const ns = dlCap || await window.claude.use('downloads').catch(() => null);
    if (ns){
      try { await ns.save({filename:'tutor-a1.html', data:html}); msg.hidden = false; msg.textContent = 'File tutor-a1.html pronto. Caricalo su Netlify Drop o GitHub Pages e aprilo dal telefono.'; }
      catch(e){ if (!e || e.code !== 'declined'){ msg.hidden = false; msg.textContent = 'Il download non è disponibile in questa vista.'; } }
      return;
    }
  }
  const blob = new Blob([html], {type:'text/html'}); const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'tutor-a1.html'; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  msg.hidden = false; msg.textContent = 'File tutor-a1.html scaricato.';
});

window.__tutor = {st, sim, SECS, LINES, thresholdFor, settings};
}

function start(){
  if (window.L) { boot(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
  s.onload = boot;
  s.onerror = () => { const m = document.getElementById('map'); if (m) m.innerHTML = '<p style="padding:20px">La libreria della mappa non si è caricata. Controlla la connessione e ricarica la pagina.</p>'; };
  document.head.appendChild(s);
}
start();
})();

