import { test } from 'node:test';
import assert from 'node:assert/strict';
import { network, along } from './helpers.js';
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
