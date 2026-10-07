import { test } from 'node:test';
import assert from 'node:assert/strict';
import { network, along } from './helpers.js';
import { pointAtKm } from '../src/core/network.js';
import { createTracker, toHistoryEntry } from '../src/core/tracker.js';
import { DEFAULT_SETTINGS } from '../src/core/store.js';

const {secs, lines, velox} = network();
const A01S = lines.find(l => l.id === 'A01S'), A01N = lines.find(l => l.id === 'A01N');
const make = (extra = {}) => {
  const settings = {...DEFAULT_SETTINGS, ...extra};
  const tracker = createTracker({secs, lines, settings, velox});
  const events = [];
  tracker.on(e => events.push(e));
  return {tracker, settings, events};
};

test('senza start() le posizioni vengono ignorate', () => {
  const {tracker, events} = make();
  along(A01S, 15, 15.1, 120).forEach(tracker.pushPosition);
  assert.deepEqual(events, []);
  assert.equal(tracker.st.fix, null);
});

test('abbassare il limite durante il tratto fa scattare subito l\'allarme', () => {
  const {tracker, settings, events} = make();
  tracker.start('gps');
  along(A01S, 12.0, 15.0, 125).forEach(tracker.pushPosition);
  assert.equal(tracker.st.active.sec.id, 12);
  assert.ok(!events.some(e => e.type === 'alarm'));
  settings.limit = 100;
  tracker.refresh();
  assert.deepEqual(events.at(-1), {type:'alarm', repeat:false});
});

test('Esci durante un tratto: misura interrotta senza annuncio', () => {
  const {tracker, events} = make();
  tracker.start('gps');
  along(A01S, 12.0, 13.0, 125).forEach(tracker.pushPosition);
  tracker.stop();
  assert.deepEqual(events.at(-1), {type:'section-abort', reason:null});
  assert.equal(tracker.st.active, null);
  assert.equal(tracker.st.running, false);
});

test('una nuova guida riparte da zero', () => {
  const {tracker} = make();
  tracker.start('gps');
  along(A01S, 12.0, 13.0, 125).forEach(tracker.pushPosition);
  tracker.start('sim');
  assert.equal(tracker.st.fix, null);
  assert.equal(tracker.st.odo, 0);
  assert.equal(tracker.st.jumps, 0);
  assert.equal(tracker.st.source, 'sim');
});

test('voce dello storico con gli stessi campi di prima', () => {
  const r = {sec:{id:12, da:'Milano Sud', a:'Lodi'}, avg:120.5, lim:130, dur:266, partial:false, sim:true};
  assert.deepEqual(toHistoryEntry(r, 5), {t:5, id:12, da:'Milano Sud', a:'Lodi', avg:120.5, lim:130, partial:false, sim:true, dur:266});
});

test('ogni tratto di ogni autostrada viene misurato da un portale all\'altro', () => {
  for (const s of secs){
    const L = lines.find(l => l.ram === s.r && (l.fixedSign === s.sign || l.fixedSign === 0) && pointAtKm(l, s.ka) && pointAtKm(l, s.kb));
    const lo = Math.min(L.pts[0][2], L.pts[L.pts.length-1][2]) + 0.01, hi = Math.max(L.pts[0][2], L.pts[L.pts.length-1][2]) - 0.01;
    const {tracker, events} = make();
    tracker.start('gps');
    along(L, Math.min(hi, Math.max(lo, s.ka - 1.5*s.sign)), Math.min(hi, Math.max(lo, s.kb + 0.3*s.sign)), 120).forEach(tracker.pushPosition);
    const start = events.find(e => e.type === 'section-start' && e.sec.id === s.id);
    const end = events.find(e => e.type === 'section-finish' && e.result.sec.id === s.id);
    assert.ok(start, s.id + ' ' + s.name + ': il tratto non è iniziato');
    assert.ok(end && Math.abs(end.result.avg - 120) < 1.5, s.id + ' ' + s.name + ': media ' + (end && end.result.avg));
  }
});

// Autovelox della A1 al km 305,5 verso Nord (Bagno a Ripoli): sulla carreggiata Nord i km scendono
const vx = events => events.filter(e => e.type.startsWith('velox'));
const lastT = ps => ps.at(-1).timestamp + 1000;

test('autovelox: un avviso a 500 m, con il limite', () => {
  const {tracker, events} = make();
  tracker.start('gps');
  along(A01N, 307, 305.7, 120).forEach(tracker.pushPosition);
  const v = vx(events);
  assert.equal(v.length, 1);
  assert.equal(v[0].type, 'velox-alert');
  assert.equal(v[0].velox.comune, 'Bagno a Ripoli');
  assert.ok(v[0].dist <= 0.5 && v[0].dist > 0.45, 'distanza ' + v[0].dist);
  assert.equal(v[0].limit, 130);
  assert.equal(v[0].over, false);
  assert.ok(tracker.st.veloxNext && tracker.st.veloxNext.v.id === v[0].velox.id);
});

test('autovelox: nel verso opposto niente', () => {
  const {tracker, events} = make();
  tracker.start('gps');
  along(A01S, 304, 306.5, 120).forEach(tracker.pushPosition);
  assert.deepEqual(vx(events), []);
  assert.equal(tracker.st.veloxNext, null);
});

test('autovelox: niente avvisi ripetuti, e dopo averlo superato sparisce', () => {
  const {tracker, events} = make();
  tracker.start('gps');
  const a = along(A01N, 306.2, 305.8, 120);
  a.forEach(tracker.pushPosition);
  along(A01N, 305.8, 305.0, 120, lastT(a)).forEach(tracker.pushPosition);
  assert.equal(vx(events).length, 1);
  assert.equal(tracker.st.veloxNext, null);
});

test('autovelox: partendo a 300 m un solo avviso, con la distanza vera', () => {
  const {tracker, events} = make();
  tracker.start('gps');
  along(A01N, 305.8, 305.6, 120).forEach(tracker.pushPosition);
  const v = vx(events);
  assert.equal(v.length, 1);
  assert.ok(v[0].dist < 0.32, 'distanza ' + v[0].dist);
});

test('autovelox: oltre il limite all\'avviso, avviso forte subito e non ripetuto', () => {
  const {tracker, events} = make();
  tracker.start('gps');
  along(A01N, 307, 305.6, 140).forEach(tracker.pushPosition);
  const v = vx(events);
  assert.deepEqual(v.map(e => [e.type, e.over]), [['velox-alert', true]]);
});

test('autovelox: si supera il limite dopo l\'avviso, un avviso forte', () => {
  const {tracker, events} = make();
  tracker.start('gps');
  const a = along(A01N, 307, 305.9, 120);
  a.forEach(tracker.pushPosition);
  along(A01N, 305.9, 305.6, 140, lastT(a)).forEach(tracker.pushPosition);
  assert.deepEqual(vx(events).map(e => e.type), ['velox-alert', 'velox-over']);
  assert.equal(vx(events)[1].limit, 130);
});

test('autovelox: con gli avvisi spenti niente eventi e niente distanza', () => {
  const {tracker, events} = make({veloxOff: true});
  tracker.start('gps');
  along(A01N, 307, 305.6, 140).forEach(tracker.pushPosition);
  assert.deepEqual(vx(events), []);
  assert.equal(tracker.st.veloxNext, null);
});

test('autovelox: il GPS che oscilla dopo il passaggio non ripete l\'avviso', () => {
  const {tracker, events} = make();
  tracker.start('gps');
  const a = along(A01N, 306.2, 305.4, 120);
  a.forEach(tracker.pushPosition);
  // un punto GPS sbagliato 60 m prima della postazione (dopo 3 s, così non è scartato come salto impossibile)
  const b = along(A01N, 305.56, 305.55, 120, lastT(a) + 2000);
  b.forEach(tracker.pushPosition);
  assert.equal(tracker.st.km.toFixed(2), '305.56', 'il punto sbagliato deve essere accettato');
  along(A01N, 305.4, 305.0, 120, lastT(b) + 2000).forEach(tracker.pushPosition);
  assert.equal(vx(events).length, 1);
});
