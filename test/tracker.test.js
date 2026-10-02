import { test } from 'node:test';
import assert from 'node:assert/strict';
import { network, along } from './helpers.js';
import { pointAtKm } from '../src/core/network.js';
import { createTracker, toHistoryEntry } from '../src/core/tracker.js';
import { DEFAULT_SETTINGS } from '../src/core/store.js';

const {secs, lines} = network();
const A01S = lines.find(l => l.id === 'A01S');
const make = () => {
  const settings = {...DEFAULT_SETTINGS};
  const tracker = createTracker({secs, lines, settings});
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
