import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hudView } from '../src/core/hud-view.js';

const emptyState = {fix:null, source:'gps', active:null, result:null, onRoad:false, ram:null, km:null, sign:0, next:null};

test('prima del primo segnale GPS', () => {
  const v = hudView(emptyState, {limit:130, margin:2, preAlert:1});
  assert.equal(v.road.title, 'In attesa del segnale GPS');
  assert.equal(v.plate.kicker, 'Avvio');
  assert.equal(v.progress, null);
  assert.equal(v.stats.inst, '–');
});

test('soglia e margine nelle statistiche', () => {
  assert.equal(hudView(emptyState, {limit:130, margin:2, preAlert:1}).stats.thrLabel, 'soglia, allarme a 134,8');
  assert.equal(hudView(emptyState, {limit:130, margin:0, preAlert:1}).stats.thrLabel, 'soglia con tolleranza');
  assert.equal(hudView(emptyState, {limit:130, margin:0, preAlert:1}).stats.thr, '136,8');
});

test('in simulazione la riga della strada lo segnala', () => {
  assert.equal(hudView({...emptyState, source:'sim'}, {limit:130, margin:2, preAlert:1}).road.sim, true);
});
