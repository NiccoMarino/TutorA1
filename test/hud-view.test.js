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

test('sulle autostrade nuove la riga della strada dice il nome e la direzione giusti', () => {
  const st = {...emptyState, fix:{v:120/3.6, acc:5, t:0}, onRoad:true, ram:'A14', km:70.25, sign:1};
  const v = hudView(st, {limit:130, margin:2, preAlert:1});
  assert.equal(v.road.title, 'A14, km 70,3');
  assert.equal(v.road.sub, 'verso Taranto, precisione GPS 5 m');
  assert.equal(v.plate.kicker, 'Nessun Tutor più avanti');
  assert.equal(hudView({...st, ram:'A10', sign:-1}, {limit:130, margin:2, preAlert:1}).road.sub, 'verso Genova, precisione GPS 5 m');
});

test('fuori dalle autostrade seguite', () => {
  const v = hudView({...emptyState, fix:{v:20, acc:12, t:0}}, {limit:130, margin:2, preAlert:1});
  assert.equal(v.road.title, 'Fuori dalle autostrade seguite');
  assert.equal(v.plate.title, 'Il monitoraggio parte quando entri in un\'autostrada dell\'elenco');
  assert.equal(v.stats.inst, '72');
});
