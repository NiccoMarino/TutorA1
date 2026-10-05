// Il tracker deve riprodurre esattamente quello che faceva l'app originale (registrato in golden.json)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { network, loadFixture, toPosition } from './helpers.js';
import { createTracker, toHistoryEntry } from '../src/core/tracker.js';
import { announcementFor } from '../src/core/messages.js';
import { hudView } from '../src/core/hud-view.js';

export const GOLDEN_SETTINGS = {limit:130, margin:2, preAlert:1, voice:false, beep:false, instWarn:true};
const scenarios = loadFixture('scenarios.json');
const golden = loadFixture('golden.json');

// Gli stessi campi che l'harness legge dalla pagina. Chrome scrive "45%" per una larghezza "45.0%".
function snapshot(v){
  return {
    pKicker:v.plate.kicker, pTitle:v.plate.title, pBig:v.plate.big, pUnit:v.plate.unit, pSub:v.plate.sub, advice:v.advice,
    hudRoad:v.road.title + (v.road.sim ? 'Simulazione' : '') + v.road.sub,
    sInst:v.stats.inst, sLim:String(v.stats.lim), sThr:v.stats.thr, sThrL:v.stats.thrLabel,
    plate:'plate ' + v.plate.cls, prog:!!v.progress,
    // avanzamento nel tratto: l'anello del cartello, in centesimi con un decimale (ui/hud.js)
    fill:v.progress ? parseFloat((v.gauge.frac*100).toFixed(1)) + '%' : null,
    pFrom:v.progress ? v.progress.from : null, pTo:v.progress ? v.progress.to : null
  };
}

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

for (const sc of scenarios){
  test('golden ' + sc.name + ': schermata di guida', () => {
    const g = golden.find(x => x.name === sc.name);
    const {secs, lines} = network();
    const settings = {...GOLDEN_SETTINGS};
    const tracker = createTracker({secs, lines, settings});
    let rendered = false, last = null;
    tracker.on(ev => { if (ev.type === 'position') rendered = true; });
    tracker.start('gps');
    sc.fixes.forEach((f, i) => {
      rendered = false;
      tracker.pushPosition(toPosition(f));
      // la pagina si ridisegna solo quando la posizione è stata elaborata: altrimenti resta quella di prima
      if (rendered) last = snapshot(hudView(tracker.st, settings));
      const {toasts, vib, ...want} = g.frames[i];
      assert.deepEqual(last, want, sc.name + ', posizione ' + i + ': schermata');
    });
  });
}
