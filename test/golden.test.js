// Il tracker deve riprodurre esattamente quello che faceva l'app originale (registrato in golden.json)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { network, loadFixture, toPosition } from './helpers.js';
import { createTracker, toHistoryEntry } from '../src/core/tracker.js';
import { announcementFor } from '../src/core/messages.js';

export const GOLDEN_SETTINGS = {limit:130, margin:2, preAlert:1, voice:false, beep:false, instWarn:true};
const scenarios = loadFixture('scenarios.json');
const golden = loadFixture('golden.json');

for (const sc of scenarios){
  test('golden ' + sc.name + ': annunci, vibrazioni e storico', () => {
    const g = golden.find(x => x.name === sc.name);
    const {secs, lines} = network();
    const tracker = createTracker({secs, lines, settings: {...GOLDEN_SETTINGS}});
    let toasts = [], vib = [];
    const history = [];
    tracker.on(ev => {
      if (ev.type === 'section-finish'){ const {t, ...h} = toHistoryEntry(ev.result, 0); history.push(h); }
      const a = announcementFor(ev);
      if (a){ toasts.push(a.text); if (a.vibrate) vib.push(a.vibrate); }
    });
    tracker.start('gps');
    sc.fixes.forEach((f, i) => {
      toasts = []; vib = [];
      tracker.pushPosition(toPosition(f));
      assert.deepEqual(toasts, g.frames[i].toasts, sc.name + ', posizione ' + i + ': annunci');
      assert.deepEqual(vib, g.frames[i].vib, sc.name + ', posizione ' + i + ': vibrazioni');
    });
    tracker.stop();
    assert.deepEqual(history, g.history, sc.name + ': storico');
  });
}
