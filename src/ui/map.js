/* global L */
// Mappa Leaflet: tracciato, tratti Tutor, portali, città, mappa di sfondo e posizione dell'utente.
import { esc, nfKm } from '../core/format.js';
import { pointAtKm } from '../core/network.js';
import { $ } from './dom.js';
import { tileSource } from '../tiles.js';

const CITIES = [['Milano',45.4642,9.19],['Lodi',45.314,9.503],['Piacenza',45.0526,9.693],['Parma',44.8015,10.3279],['Reggio Emilia',44.6983,10.6312],['Modena',44.6471,10.9252],['Bologna',44.4949,11.3426],['Firenze',43.7696,11.2558],['Arezzo',43.4633,11.8796],['Orvieto',42.7185,12.1107],['Roma',41.9028,12.4964],['Frosinone',41.64,13.351],['Cassino',41.492,13.831],['Caserta',41.0726,14.3323],['Napoli',40.8518,14.2681],['Torino',45.0703,7.6869],['Novara',45.4469,8.6219],['Bergamo',45.6983,9.6773],['Brescia',45.5416,10.2118],['Verona',45.4384,10.9916],['Vicenza',45.5455,11.5354],['Padova',45.4064,11.8768],['Venezia',45.4408,12.3155],['Udine',46.0711,13.2346],['Trieste',45.6495,13.7768]];
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const isDark = () => {
  const t = document.documentElement.getAttribute('data-theme');
  if (t) return t === 'dark';
  try { return matchMedia('(prefers-color-scheme: dark)').matches; } catch(e){ return false; }
};

export function createMapView({data, secs, lines, isDriving, currentFix, onSectionClick}){
  const map = L.map('map', {preferCanvas:true, zoomControl:false, minZoom:5, maxZoom:17, zoomSnap:0.5, zoomDelta:0.5, wheelPxPerZoomLevel:90});
  L.control.zoom({position:'topright', zoomInTitle:'Ingrandisci', zoomOutTitle:'Riduci'}).addTo(map);
  map.attributionControl.setPrefix(false);
  map.attributionControl.addAttribution('Tracciato © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>, tratti Tutor da autostrade.it e infoviaggiando.it');

  const regions = L.polygon(data.reg.map(r => [r]), {interactive:false, weight:1, fillOpacity:1});
  regions.addTo(map);
  const allRoad = [data.ch.S, data.ch.N, data.ch.D18, data.ch.D19, data.ch.VAR, data.ch.AE, data.ch.AW].map(p => p.map(q => [q[0], q[1]]));
  const roadCase = L.polyline(allRoad, {interactive:false, weight:6, lineCap:'round', lineJoin:'round'}).addTo(map);
  const roadLine = L.polyline(allRoad, {interactive:false, weight:2.2, lineCap:'round', lineJoin:'round'}).addTo(map);

  const secLayer = {};
  function secStyle(s, hi){
    const pos = s.pos;
    return {color: css(pos ? '--sud' : '--nord'), weight: (pos ? 9 : 4.5) + (hi ? 5 : 0), opacity: hi ? 1 : 0.92, lineCap:'round', lineJoin:'round'};
  }
  const drawOrder = secs.slice().sort((a, b) => (a.pos ? 0 : 1) - (b.pos ? 0 : 1));
  const gateLayers = [];
  const gatesGroup = L.layerGroup(), casGroup = L.layerGroup();
  drawOrder.forEach(s => {
    const pl = L.polyline(s.g, secStyle(s, false)).addTo(map);
    pl.on('click', ev => onSectionClick(s, ev.latlng));
    secLayer[s.id] = pl;
  });
  drawOrder.forEach(s => {
    const st = L.circleMarker(s.g[0], {radius:6.5, weight:2.5, fillOpacity:1});
    const en = L.circleMarker(s.g[s.g.length-1], {radius:5, weight:3, fillOpacity:1});
    st.bindTooltip('Inizio: ' + esc(s.da) + ', km ' + nfKm.format(s.ka), {direction:'top'});
    en.bindTooltip('Fine: ' + esc(s.a) + ', km ' + nfKm.format(s.kb), {direction:'top'});
    st.on('click', ev => onSectionClick(s, ev.latlng)); en.on('click', ev => onSectionClick(s, ev.latlng));
    gatesGroup.addLayer(st); gatesGroup.addLayer(en);
    gateLayers.push({s, st, en});
  });
  data.cas.forEach(c => {
    L.circleMarker([c.la, c.lo], {radius:3, weight:1, color:'#fff', fillColor:'#6b7772', fillOpacity:1, interactive:false})
     .bindTooltip(esc(c.n), {permanent:true, direction:'right', offset:[5,0], className:'lbl lbl-cas', interactive:false}).addTo(casGroup);
  });
  [['A01S',750],['A04E',500]].forEach(([id, max]) => {
    const ln = lines.find(l => l.id === id);
    for (let k = 50; k <= max; k += 50){
      const p = pointAtKm(ln, k);
      if (p) L.circleMarker([p.lat, p.lon], {radius:0.1, opacity:0, fillOpacity:0, interactive:false})
        .bindTooltip((id === 'A04E' ? 'A4 ' : 'A1 ') + 'km ' + k, {permanent:true, direction:'left', offset:[-6,0], className:'lbl lbl-km', interactive:false}).addTo(map);
    }
  });
  CITIES.forEach(c => L.marker([c[1], c[2]], {interactive:false, keyboard:false, icon:L.divIcon({className:'', html:'<div class="city">' + c[0] + '</div>', iconSize:[0,0]})}).addTo(map));

  // Mappa stradale di sfondo (fonte in tiles.js). Senza rete resta la mappa vettoriale disegnata qui sopra.
  let tileLayer = null, tileDark = null, tilesOk = false;
  function setTiles(){
    if (!tilesOk) return;
    const dark = isDark();
    if (tileLayer && tileDark === dark) return;
    if (tileLayer) map.removeLayer(tileLayer);
    tileDark = dark;
    let errors = 0, loads = 0;
    const src = tileSource(dark);
    tileLayer = L.tileLayer(src.url, {maxZoom:19, subdomains: src.subdomains || 'abc', className: src.className, attribution: src.attribution});
    tileLayer.on('tileload', () => { loads++; });
    tileLayer.on('tileerror', () => { errors++; if (errors > 12 && loads === 0 && tileLayer){ map.removeLayer(tileLayer); tileLayer = null; tilesOk = false; document.body.classList.remove('has-tiles'); probeTiles(); } });
    tileLayer.addTo(map).bringToBack();
    document.body.classList.add('has-tiles');
  }

  let hiSec = null;
  function applyMapTheme(){
    regions.setStyle({color:css('--region'), fillColor:css('--land'), fillOpacity:1, opacity:1});
    setTiles();
    roadCase.setStyle({color:css('--road-case')});
    roadLine.setStyle({color:css('--road')});
    secs.forEach(s => secLayer[s.id].setStyle(secStyle(s, s === hiSec)));
    gateLayers.forEach(g => {
      const col = css(g.s.pos ? '--sud' : '--nord');
      g.st.setStyle({color:'#fff', fillColor:col});
      g.en.setStyle({color:col, fillColor:'#fff'});
    });
  }
  function bringGates(s){
    const g = gateLayers.find(x => x.s === s);
    if (g && map.hasLayer(gatesGroup)){ g.st.bringToFront(); g.en.bringToFront(); }
  }
  function highlight(s){
    if (hiSec && hiSec !== s) secLayer[hiSec.id].setStyle(secStyle(hiSec, false));
    hiSec = s || null;
    if (s){ secLayer[s.id].setStyle(secStyle(s, true)); secLayer[s.id].bringToFront(); bringGates(s); }
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
  // Prova a scaricare una tile: se non ci riesce (per esempio si parte senza rete) riprova ogni minuto
  let probeTimer = null;
  function probeTiles(){
    if (probeTimer) return;
    const img = new Image(); let done = false;
    const retry = () => { probeTimer = setTimeout(() => { probeTimer = null; probeTiles(); }, 60000); };
    img.onload = () => { if (done) return; done = true; if (img.naturalWidth >= 200){ tilesOk = true; setTiles(); } else retry(); };
    img.onerror = () => { if (done) return; done = true; retry(); };
    setTimeout(() => { if (done) return; done = true; retry(); }, 8000);
    img.src = tileSource(false).probe;
  }
  probeTiles();

  // posizione dell'utente
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
  // Seguire la posizione: si smette spostando la mappa, si riprende con "Ricentra su di me"
  function setFollow(on){
    follow = on;
    if (on) $('#btnFollow').hidden = true;
    else if (isDriving()) $('#btnFollow').hidden = false;
  }
  map.on('dragstart', () => { if (isDriving()) setFollow(false); });
  $('#btnFollow').addEventListener('click', () => {
    setFollow(true);
    const f = currentFix();
    if (f) map.setView([f.lat, f.lon], Math.max(map.getZoom(), 13));
  });
  $('#btnFit').addEventListener('click', () => { setFollow(false); fitAll(); });

  return {
    map, highlight, fitAll, updateMe, setFollow,
    fitSection(s){ map.fitBounds(secLayer[s.id].getBounds(), {paddingTopLeft:[40,230], paddingBottomRight:[40,40], maxZoom:13}); },
    showPopup(at, html){ L.popup({maxWidth:300, autoPanPadding:[30,30]}).setLatLng(at).setContent(html).openOn(map); }
  };
}
