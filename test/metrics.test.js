import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMetrics, adviceText } from '../src/core/metrics.js';

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
  assert.equal(adviceText(m), 'Rispettando il limite di 130 chiudi il tratto in regola.');
});

test('media sopra il limite ma sotto la soglia di allarme: avviso', () => {
  const m = at(5, 135, 133.3);
  assert.equal(m.status, 'warn');
  assert.equal(adviceText(m), 'Media sopra 130 ma entro la tolleranza. Rispetta il limite fino al portale.');
});

test('media oltre la soglia: allarme e velocità massima per rientrare', () => {
  const m = at(5, 120, 150);
  assert.equal(m.status, 'alarm');
  assert.equal(adviceText(m), 'Media oltre la soglia: rallenta e resta sotto 122 km/h fino al portale.');
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
