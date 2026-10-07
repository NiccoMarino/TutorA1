// Guida oltre il limite, di poco e di tanto: allarmi, avvisi, esito del tratto e numeri mostrati o detti
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { network, along } from './helpers.js';
import { pointAtKm } from '../src/core/network.js';
import { createTracker } from '../src/core/tracker.js';
import { announcementFor } from '../src/core/messages.js';
import { hudView } from '../src/core/hud-view.js';
import { thresholdFor, verdictOf, avgValue } from '../src/core/rules.js';
import { DEFAULT_SETTINGS } from '../src/core/store.js';

const {secs, lines} = network();
const A01S = lines.find(l => l.id === 'A01S');
const lineOf = s => lines.find(l => l.ram === s.r && (l.fixedSign === s.sign || l.fixedSign === 0) && pointAtKm(l, s.ka) && pointAtKm(l, s.kb));
const num = t => Number(t.replace(',', '.'));

// Percorre a velocità costante (o a pezzi: legs = [[fino al km, km/h], ...]) e registra eventi, annunci e cartelli
// Di solito Frosinone → Ceprano (A1 verso sud, km 622,5-640,8): nessun altro tratto subito prima o subito dopo,
// così si vede anche il cartello "Tratto concluso"
const SEC = 49, START = 620.5, END = 642;
function drive(legs, {limit = 130, line = A01S, from = START, gapAt = null, gapSeconds = 0, extra = {}} = {}){
  const settings = {...DEFAULT_SETTINGS, limit, ...extra};
  const tracker = createTracker({secs, lines, settings});
  const events = [], texts = [], plates = [], bigs = [], keeps = [];
  tracker.on(e => {
    if (e.type === 'position'){
      if (tracker.st.active || tracker.st.result){ const v = hudView(tracker.st, settings); plates.push(v.plate.cls); bigs.push(v.plate.big); keeps.push(v.keep.value); }
      return;
    }
    events.push(e);
    const a = announcementFor(e);
    if (a) texts.push(a.text);
  });
  tracker.start('gps');
  let km = from, t = 1790000000000;
  for (const [to, kmh] of legs){
    const ps = along(line, km, to, kmh, t), dir = Math.sign(to - km);
    ps.forEach((p, i) => {
      // un buco del GPS (galleria): le posizioni di quei secondi non arrivano
      const pk = km + dir*i*kmh/3600;
      if (gapAt != null && pk >= gapAt && pk < gapAt + kmh/3600*gapSeconds) return;
      tracker.pushPosition(p);
    });
    t += ps.length*1000; km = to;
  }
  const fin = events.filter(e => e.type === 'section-finish').map(e => e.result);
  return {tracker, settings, events, texts, plates, bigs, keeps, fin, types: events.map(e => e.type)};
}
const firstSec = r => r.fin.find(x => x.sec.id === SEC);

test('esattamente al limite: niente allarmi né avvisi, in regola', () => {
  const r = drive([[END, 130]]);
  assert.ok(Math.abs(firstSec(r).avg - 130) < 0.05);
  assert.ok(!r.types.includes('alarm') && !r.types.includes('instant-over'));
  assert.ok(!r.plates.includes('warn'));
  assert.ok(r.texts.some(t => t.startsWith('Fine Tutor. Media 130 chilometri orari, in regola.')));
});

test('di pochissimo sopra il limite (130,4): cartello giallo, nessun allarme, e non si dice "130"', () => {
  const r = drive([[END, 130.4]]);
  assert.equal(verdictOf(firstSec(r).avg, 130)[1], 'tol');
  assert.ok(r.plates.includes('warn'));
  assert.ok(!r.types.includes('alarm') && !r.types.includes('instant-over'));
  const end = r.texts.find(t => t.startsWith('Fine Tutor'));
  assert.match(end, /^Fine Tutor\. Media 130,4 chilometri orari, sopra il limite, entro la tolleranza\./);
  // il numero grande sul cartello giallo non può dire 130
  assert.ok(r.bigs.filter((b, i) => r.plates[i] === 'warn').every(b => num(b) > 130), 'cartello giallo con media "130"');
});

test('poco sopra il limite ma sotto l\'allarme (133): avviso giallo, esito entro la tolleranza', () => {
  const r = drive([[END, 133]]);
  assert.ok(r.plates.includes('warn') && !r.plates.includes('alarm'));
  assert.ok(!r.types.includes('alarm') && !r.types.includes('instant-over'));
  assert.ok(r.texts.some(t => t.startsWith('Fine Tutor. Media 133 chilometri orari, sopra il limite, entro la tolleranza.')));
  assert.ok(r.plates.includes('done-tol'));
});

test('il margine anticipa l\'allarme: 134,5 niente, 135,2 allarme ma esito ancora entro la tolleranza', () => {
  assert.ok(!drive([[END, 134.5]]).types.includes('alarm'));
  const r = drive([[END, 135.2]]);
  assert.equal(r.types.filter(t => t === 'alarm').length >= 1, true);
  assert.equal(verdictOf(firstSec(r).avg, 130)[1], 'tol');
  assert.ok(!r.types.includes('instant-over'));
});

test('appena oltre la soglia di sanzione (137,2): allarme, avviso di velocità e esito oltre la soglia', () => {
  const r = drive([[END, 137.2]]);
  assert.ok(r.types.includes('alarm') && r.types.includes('instant-over'));
  assert.ok(r.texts.some(t => t.startsWith('Fine Tutor. Media 137 chilometri orari, oltre la soglia di sanzione.')));
  assert.ok(r.plates.includes('done-bad'));
});

test('appena sotto la soglia (136,6): la voce non arrotonda a 137, che sarebbe oltre la soglia', () => {
  const r = drive([[END, 136.6]]);
  assert.equal(verdictOf(firstSec(r).avg, 130)[1], 'tol');
  assert.match(r.texts.find(t => t.startsWith('Fine Tutor')), /^Fine Tutor\. Media 136,6 chilometri orari, sopra il limite, entro la tolleranza\./);
});

for (const kmh of [180, 250, 300]){
  test('di tanto, ' + kmh + ' km/h: media giusta, allarme ripetuto ogni 30 s, avviso di velocità ogni 25 s', () => {
    const r = drive([[END, kmh]]);
    const res = firstSec(r);
    assert.ok(Math.abs(res.avg - kmh) < 0.5, 'media ' + res.avg);
    assert.ok(r.plates.includes('alarm') && r.plates.includes('done-bad'));
    assert.ok(!r.types.includes('section-abort'));
    const alarms = r.events.filter(e => e.type === 'alarm');
    assert.equal(alarms[0].repeat, false);
    assert.ok(alarms.slice(1).every(e => e.repeat));
    // un allarme ogni 30 s circa, finché dura il tratto
    const expected = Math.floor((res.dur - 12)/30);
    assert.ok(Math.abs(alarms.length - 1 - expected) <= 1, alarms.length + ' allarmi in ' + res.dur + ' s');
    // durante l'allarme l'avviso di velocità suona ma non parla sopra l'allarme
    const inst = r.events.filter(e => e.type === 'instant-over');
    assert.ok(inst.length >= 2);
    assert.ok(inst.some(e => e.silentVoice));
  });
}

// La velocità da tenere sul cartello non supera mai il limite; solo chi ha sbloccato col codice vede il numero calcolato
const keepNums = r => r.keeps.filter(k => k.startsWith('≤ ')).map(k => num(k.slice(2)));
for (const limit of [130, 110, 90]){
  test('limite ' + limit + ', andando piano: il cartello non indica mai una velocità sopra il limite', () => {
    const r = drive([[END, limit - 15]], {limit});
    assert.ok(keepNums(r).length > 0);
    assert.ok(keepNums(r).every(n => n <= limit), 'velocità da tenere sopra ' + limit + ': ' + Math.max(...keepNums(r)));
    assert.ok(!r.texts.some(t => new RegExp('\b(1[3-9]\d|' + (limit + 1) + ')\b').test(t) && /tenere|resta sotto/.test(t)));
  });
}

test('con il codice il cartello mostra il numero calcolato, anche sopra il limite', () => {
  const r = drive([[END, 115]], {extra: {keepReal: true}});
  assert.ok(keepNums(r).some(n => n > 130), 'mai sopra 130: ' + Math.max(...keepNums(r)));
});

test('accelerando da 260 a 300 km/h la velocità mostrata è 300, non quella di prima', () => {
  const r = drive([[617, 260], [619, 300]]);
  const v = hudView(r.tracker.st, r.settings);
  assert.equal(v.stats.inst, '300');
});

test('a 300 km/h un buco del GPS di 3 s (galleria) non interrompe la misura', () => {
  const r = drive([[END, 300]], {gapAt: 629, gapSeconds: 3});
  assert.ok(!r.types.includes('section-abort'), r.texts.join(' | '));
  assert.ok(Math.abs(firstSec(r).avg - 300) < 1);
});

test('un vero salto del GPS (5 km in un secondo) a 300 km/h viene ancora scartato', () => {
  const settings = {...DEFAULT_SETTINGS};
  const tracker = createTracker({secs, lines, settings});
  tracker.start('gps');
  const ps = along(A01S, 124, 125, 300);
  ps.forEach(tracker.pushPosition);
  const last = tracker.st.fix;
  const far = pointAtKm(A01S, 130);
  tracker.pushPosition({coords: {latitude: far.lat, longitude: far.lon, accuracy: 6, speed: 300/3.6, heading: far.brg}, timestamp: ps.at(-1).timestamp + 1000});
  assert.equal(tracker.st.fix, last);
});

test('una breve accelerata (20 s a 170) fa suonare l\'avviso di velocità, ma la media resta in regola', () => {
  const r = drive([[627, 125], [627 + 170/3600*20, 170], [END, 125]]);
  assert.ok(!r.types.includes('alarm'));
  assert.equal(r.types.filter(t => t === 'instant-over').length, 1);
  assert.equal(verdictOf(firstSec(r).avg, 130)[1], 'ok');
});

test('oltre la soglia per meno di 3 secondi: nessun avviso di velocità', () => {
  const r = drive([[627, 125], [627 + 170/3600*2, 170], [END, 125]]);
  assert.ok(!r.types.includes('instant-over'));
});

test('allarme e poi si rallenta: la media rientra e il tratto finisce in regola', () => {
  const r = drive([[626.5, 150], [END, 100]]);
  const i = r.types.indexOf('alarm'), j = r.types.indexOf('alarm-cleared');
  assert.ok(i >= 0 && j > i, r.types.join(','));
  assert.ok(r.texts.includes('Media rientrata sotto la soglia.'));
  assert.equal(verdictOf(firstSec(r).avg, 130)[1], 'ok');
});

test('entrando a metà tratto molto veloce: allarme sulla media parziale', () => {
  const r = drive([[END, 190]], {from: 627});
  const start = r.events.find(e => e.type === 'section-start');
  assert.equal(start.mid, true);
  assert.ok(r.types.includes('alarm'));
  assert.equal(firstSec(r).partial, true);
});

// Per ogni limite: appena sotto la soglia è "entro la tolleranza", appena sopra è "oltre la soglia";
// e il numero detto a voce o mostrato non contraddice mai l'esito
for (const limit of [130, 110, 100, 90, 80]){
  test('limite ' + limit + ': appena sotto e appena sopra la soglia di ' + thresholdFor(limit).toFixed(2), () => {
    const thr = thresholdFor(limit);
    for (const [kmh, want] of [[limit - 0.3, 'ok'], [limit + 0.3, 'tol'], [thr - 0.3, 'tol'], [thr + 0.3, 'bad']]){
      const r = drive([[END, kmh]], {limit});
      const res = firstSec(r);
      assert.equal(verdictOf(res.avg, limit)[1], want, limit + ' a ' + kmh + ': media ' + res.avg);
      assert.equal(r.types.includes('alarm'), kmh >= thr - 2, limit + ' a ' + kmh + ': allarme');
      const said = num(r.texts.find(t => t.startsWith('Fine Tutor')).match(/Media ([\d,]+)/)[1]);
      assert.equal(verdictOf(said, limit)[1], want, limit + ' a ' + kmh + ': detto ' + said);
      const shown = r.bigs[r.plates.indexOf('done-' + want)];
      assert.equal(verdictOf(num(shown), limit)[1], want, limit + ' a ' + kmh + ': mostrato ' + shown);
    }
  });
}

test('avgValue: arrotonda, ma senza passare dall\'altra parte del limite o della soglia', () => {
  assert.equal(avgValue(125.4, 130, 0), 125);
  assert.equal(avgValue(129.6, 130, 0), 130);
  assert.equal(avgValue(130.4, 130, 0), 130.4);
  assert.equal(avgValue(130.04, 130, 0), 130.1);
  assert.equal(avgValue(136.6, 130, 0), 136.6);
  assert.equal(avgValue(136.9, 130, 0), 137);
  assert.equal(avgValue(136.86, 130, 1), 136.9);
  assert.equal(avgValue(130.0000004, 130, 0), 130);
  assert.equal(avgValue(136.849, 130, 1), 136.85);
  assert.equal(avgValue(130.04, 130, 1), 130.04);
  assert.equal(avgValue(null, 130, 0), null);
});

// Tutti i tratti, di poco e di tanto oltre il limite
for (const [kmh, want, alarm] of [[131, 'tol', false], [200, 'bad', true]]){
  test('ogni tratto di ogni autostrada a ' + kmh + ' km/h: esito ' + want + (alarm ? ' con allarme' : ' senza allarme'), () => {
    for (const s of secs){
      const L = lineOf(s);
      const lo = Math.min(L.pts[0][2], L.pts[L.pts.length-1][2]) + 0.01, hi = Math.max(L.pts[0][2], L.pts[L.pts.length-1][2]) - 0.01;
      const from = Math.min(hi, Math.max(lo, s.ka - 1.5*s.sign)), to = Math.min(hi, Math.max(lo, s.kb + 0.3*s.sign));
      const r = drive([[to, kmh]], {line: L, from});
      const res = r.fin.find(x => x.sec.id === s.id);
      assert.ok(res && Math.abs(res.avg - kmh) < 1.5, s.id + ' ' + s.name + ': media ' + (res && res.avg));
      assert.equal(verdictOf(res.avg, 130)[1], want, s.id + ' ' + s.name);
      const alarms = r.events.filter(e => e.type === 'alarm' && r.events.indexOf(e) < r.events.findIndex(f => f.type === 'section-finish' && f.result.sec.id === s.id));
      assert.equal(alarms.length > 0, alarm, s.id + ' ' + s.name + ': allarme');
    }
  });
}
