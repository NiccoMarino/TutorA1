import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hudView } from '../src/core/hud-view.js';

const emptyState = {fix:null, source:'gps', active:null, result:null, onRoad:false, ram:null, km:null, sign:0, next:null};

test('prima del primo segnale GPS', () => {
  const v = hudView(emptyState, {limit:130, margin:2, preAlert:1});
  assert.equal(v.road.title, 'In attesa del segnale GPS');
  assert.equal(v.road.sub, '', 'niente seconda riga sotto "In attesa del segnale GPS"');
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

// Anello di avanzamento e velocità da tenere (cartello circolare, riquadro e schermata orizzontale)
const S130 = {limit:130, margin:2, preAlert:1};
const sec10 = {name:'Prova', L:10, ka:0, sign:1};

test('nel tratto: anello di avanzamento e velocità da tenere', () => {
  const st = {...emptyState, fix:{v:133.3/3.6, acc:5, t:135, odo:5000}, onRoad:true, ram:'A01', km:5, sign:1,
    active:{sec:sec10, tStart:0, odoStart:0, relStart:0, mid:false}};
  const v = hudView(st, S130);
  assert.equal(v.gauge.frac, 0.5);
  assert.deepEqual(v.keep, {label:'per chiudere entro 130', value:'≤ 126'});
});

test('prima del Tutor: niente anello, il limite al posto della velocità da tenere', () => {
  const st = {...emptyState, fix:{v:120/3.6, acc:5, t:0}, onRoad:true, ram:'A01', km:1, sign:1, next:{sec:sec10, dist:4.2}};
  const v = hudView(st, S130);
  assert.equal(v.gauge, null);
  assert.deepEqual(v.keep, {label:'limite', value:'130'});
});

test('tratto concluso: anello pieno e verdetto breve', () => {
  const st = {...emptyState, fix:{v:120/3.6, acc:5, t:10}, onRoad:true, ram:'A01', km:11, sign:1,
    result:{sec:sec10, avg:133, lim:130, dur:271, until:60}};
  const v = hudView(st, S130);
  assert.equal(v.gauge.frac, 1);
  assert.deepEqual(v.keep, {label:'tratto concluso', value:'in tolleranza'});
});

test('senza GPS, fuori autostrada e senza Tutor avanti: una riga che dice dove sei', () => {
  assert.deepEqual(hudView(emptyState, S130).keep, {label:'cerco il GPS', value:''});
  assert.deepEqual(hudView({...emptyState, fix:{v:20, acc:12, t:0}}, S130).keep, {label:'fuori autostrada', value:''});
  const end = {...emptyState, fix:{v:30, acc:5, t:0}, onRoad:true, ram:'A14', km:70, sign:1};
  assert.deepEqual(hudView(end, S130).keep, {label:'nessun Tutor avanti', value:''});
  assert.deepEqual(hudView({...end, sign:0}, S130).keep, {label:'cerco la direzione', value:''});
});

test('statistiche: l\'allarme segue il rosso scelto nelle impostazioni', () => {
  assert.equal(hudView(emptyState, {limit:130, margin:2, preAlert:1, yellowOff:-5, redOff:0}).stats.thrLabel, 'soglia, allarme a 130');
  assert.equal(hudView(emptyState, {limit:130, margin:3, preAlert:1}).stats.thrLabel, 'soglia, allarme a 133,8');
});
