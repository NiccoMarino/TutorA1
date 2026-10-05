import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMetrics, adviceText, keepText } from '../src/core/metrics.js';

// Tratto finto di 10 km dal km 0, verso crescente; limite 130, margine 2 (allarme a 134,8)
const sec = {ka:0, L:10, sign:1};
const active = {sec, tStart:0, odoStart:0, relStart:0};
const settings = {limit:130, margin:2};
const at = (km, seconds, kmh) => computeMetrics(active, {t:seconds, odo:km*1000, v:kmh == null ? null : kmh/3.6}, km, settings);

test('media sotto il limite: tutto bene', () => {
  const m = at(5, 150, 120);
  assert.ok(Math.abs(m.avg - 120) < 1e-9);
  assert.ok(Math.abs(m.proj - 120) < 1e-9);
  assert.equal(m.status, 'ok');
  assert.equal(m.remKm, 5);
  assert.equal(adviceText(m), 'Fino al portale puoi tenere 141 km/h: la media resta entro 130.');
});

test('media sopra il limite ma sotto la soglia di allarme: avviso', () => {
  const m = at(5, 135, 133.3);
  assert.equal(m.status, 'warn');
  assert.equal(adviceText(m), 'Per chiudere entro il limite resta sotto 126 km/h fino al portale.');
});

test('media oltre la soglia: allarme e velocità massima per rientrare', () => {
  const m = at(5, 120, 150);
  assert.equal(m.status, 'alarm');
  assert.equal(adviceText(m), 'Media oltre la soglia: rallenta e resta sotto 114 km/h fino al portale.');
});

test('allarme a fine tratto, quando non basta più rallentare un po\'', () => {
  const m = at(9.5, 200, 150);
  assert.equal(m.status, 'alarm');
  assert.equal(adviceText(m), 'Media oltre la soglia: rallenta, più tempo resti sotto il limite più la media scende.');
});

test('nei primi secondi la media non è ancora affidabile', () => {
  const m = at(0.3, 10, 108);
  assert.equal(m.settled, false);
  assert.ok(Math.abs(m.avg - 108) < 1e-9);
  assert.equal(m.status, 'ok');
  assert.equal(adviceText(m), 'Calcolo della media in corso. Limite 130.');
});

test('subito dopo il portale si mostra la velocità istantanea, o niente se manca', () => {
  assert.ok(Math.abs(at(0.02, 2, 120).avg - 120) < 1e-9);
  assert.equal(at(0.02, 2, null).avg, null);
});

// Velocità da non superare nei km che mancano per chiudere il tratto con la media entro il limite. Può essere sopra
// il limite: dice fin dove si può andare senza rischiare la multa del Tutor.
const keep = m => keepText(m);
test('velocità da tenere: in regola può essere sopra il limite', () => {
  assert.deepEqual(keep(at(5, 150, 120)), {label:'per chiudere entro 130', value:'≤ 141'});
});

test('velocità da tenere: sopra il limite va rallentato quanto serve', () => {
  assert.deepEqual(keep(at(5, 135, 133.3)), {label:'per chiudere entro 130', value:'≤ 126'});
  assert.deepEqual(keep(at(5, 120, 150)), {label:'per chiudere entro 130', value:'≤ 114'});
});

test('velocità da tenere: andando piano la media resta entro il limite a qualunque velocità', () => {
  const m = at(8, 300, 100);
  assert.deepEqual(keep(m), {label:'tratto ormai', value:'in regola'});
  assert.equal(adviceText(m), 'Rispettando il limite di 130 chiudi il tratto in regola.');
});

test('velocità da tenere: quando entro il limite non si rientra più, quella per restare in tolleranza', () => {
  const m = at(9.8, 259, 120);
  assert.deepEqual(keep(m), {label:'per restare in tolleranza', value:'≤ 176'});
  assert.equal(adviceText(m), 'Entro il limite non rientri più: per restare in tolleranza resta sotto 176 km/h fino al portale.');
  const t = at(9.9, 269, 120);
  assert.deepEqual(keep(t), {label:'tratto ormai', value:'in tolleranza'});
  assert.equal(adviceText(t), 'Media sopra 130 ma entro la tolleranza fino al portale.');
});

test('velocità da tenere: a fine tratto con la media troppo alta resta solo rallentare', () => {
  assert.deepEqual(keep(at(9.5, 200, 150)), {label:'non rientri più', value:'rallenta'});
});

test('velocità da tenere: nei primi secondi vale il limite', () => {
  assert.deepEqual(keep(at(0.3, 10, 108)), {label:'per chiudere entro 130', value:'≤ 130'});
});

test('consiglio e velocità da tenere dicono lo stesso numero', () => {
  for (const m of [at(5, 150, 120), at(5, 135, 133.3), at(5, 120, 150), at(4, 100, 150), at(7, 190, 140), at(9.8, 259, 120)]){
    const n = keepText(m).value.replace('≤ ', '');
    assert.ok(adviceText(m).includes(' ' + n + ' km/h'), adviceText(m) + ' / ' + n);
  }
});

// Il giallo dipende solo dalla media sopra il limite, non dalla velocità di adesso
test('giallo solo con la media sopra il limite', () => {
  assert.equal(at(5, 144, 170).status, 'ok', 'media 125 andando a 170: resta verde');
  assert.equal(at(5, 137.4, 100).status, 'warn', 'media 131 andando a 100: giallo');
  assert.equal(at(5, 150, 130).status, 'ok', 'media esattamente 120: verde');
});
