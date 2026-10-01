// Genera test/fixtures/scenarios.json: percorsi GPS finti ma realistici lungo i tracciati veri,
// usati dal collaudo "golden" (tools/golden-harness.mjs nel browser e test/golden.test.js in Node).
// Rigeneralo solo per cambiare gli scenari: dopo serve un nuovo golden.json dal browser.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

function loadData(){
  if (existsSync('src/data/tutor-data.json')) return JSON.parse(readFileSync('src/data/tutor-data.json', 'utf8'));
  const m = readFileSync('index.html', 'utf8').match(/<script data-keep type="application\/json" id="tutor-data">([\s\S]*?)<\/script>/);
  return JSON.parse(m[1]);
}
const data = loadData();
const D2R = Math.PI/180;
const T0 = 1790000000000;

function bearing(la1, lo1, la2, lo2){
  const y = Math.sin((lo2-lo1)*D2R)*Math.cos(la2*D2R);
  const x = Math.cos(la1*D2R)*Math.sin(la2*D2R) - Math.sin(la1*D2R)*Math.cos(la2*D2R)*Math.cos((lo2-lo1)*D2R);
  return (Math.atan2(y, x)/D2R + 360) % 360;
}
function pointAt(pts, km){
  const inc = pts[pts.length-1][2] > pts[0][2];
  for (let i = 0; i < pts.length - 1; i++){
    const a = pts[i][2], b = pts[i+1][2];
    if (inc ? (km >= a && km <= b) : (km <= a && km >= b)){
      const t = b === a ? 0 : (km - a)/(b - a);
      return {lat: pts[i][0] + t*(pts[i+1][0]-pts[i][0]), lon: pts[i][1] + t*(pts[i+1][1]-pts[i][1]),
              brg: bearing(pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1]), inc};
    }
  }
  throw new Error('km ' + km + ' fuori dal tracciato');
}
function offset(lat, lon, brg, meters){
  return [lat + meters*Math.cos(brg*D2R)/110574, lon + meters*Math.sin(brg*D2R)/(111320*Math.cos(lat*D2R))];
}
const r6 = x => Math.round(x*1e6)/1e6;

// Una posizione al secondo. legs: pezzi a velocità costante fino al km "to".
// jumpAt: al km indicato arrivano 3 posizioni sballate di 5,5 km (GPS impazzito).
// exitSeconds: alla fine si esce di lato dalla strada a 108 km/h per questi secondi.
function scenario(name, line, from, legs, {jumpAt = null, exitSeconds = 0} = {}){
  const pts = data.ch[line];
  const fixes = [];
  let t = T0, km = from, jumped = false, last = null;
  const push = (lat, lon, kmh, heading) => {
    fixes.push({lat: r6(lat), lon: r6(lon), speed: Math.round(kmh/3.6*1000)/1000, heading: Math.round(heading*10)/10, accuracy: 6, t});
    t += 1000;
  };
  for (const leg of legs){
    const dir = Math.sign(leg.to - km);
    while ((leg.to - km)*dir > 0){
      const p = pointAt(pts, km);
      const heading = ((dir > 0) === p.inc) ? p.brg : (p.brg + 180) % 360;
      if (jumpAt != null && !jumped && (km - jumpAt)*dir >= 0){
        jumped = true;
        for (let k = 0; k < 3; k++){ const [la, lo] = offset(p.lat, p.lon, 0, 5500); push(la, lo, leg.kmh, heading); }
      }
      push(p.lat, p.lon, leg.kmh, heading);
      last = {lat: p.lat, lon: p.lon, heading};
      km += dir*leg.kmh/3600;
    }
  }
  for (let k = 1; k <= exitSeconds; k++){
    const side = (last.heading + 90) % 360;
    const [la, lo] = offset(last.lat, last.lon, side, 30*k);
    push(la, lo, 108, side);
  }
  return {name, fixes};
}

const scenarios = [
  // preavviso, inizio, fine di Milano Sud-Lodi agganciata all'inizio di Lodi-Casalpusterlengo
  scenario('a1-sud-tratti-consecutivi', 'S', 9.0, [{to: 24.0, kmh: 125}]),
  // ingresso a metà tratto, allarme, ripetizione dell'allarme, velocità istantanea, rientro sotto soglia
  scenario('a1-sud-allarme-e-rientro', 'S', 70.0, [{to: 80.0, kmh: 150}, {to: 89.5, kmh: 95}]),
  // 3 posizioni sballate durante il tratto All. A21-Fiorenzuola: misura interrotta
  scenario('a1-sud-salto-gps', 'S', 55.0, [{to: 68.0, kmh: 120}], {jumpAt: 65.0}),
  // si esce dal tracciato dentro All. A15-Parma: misura interrotta
  scenario('a1-sud-uscita-dal-tracciato', 'S', 103.0, [{to: 106.0, kmh: 120}], {exitSeconds: 20}),
  // A4 verso Torino (chilometri decrescenti): Ospitaletto-Rovato e Rovato-Palazzolo
  scenario('a4-ovest-due-tratti', 'AW', 210.0, [{to: 196.0, kmh: 130}])
];
mkdirSync('test/fixtures', {recursive: true});
writeFileSync('test/fixtures/scenarios.json', JSON.stringify(scenarios));
console.log(scenarios.map(s => s.name + ': ' + s.fixes.length + ' posizioni').join('\n'));
