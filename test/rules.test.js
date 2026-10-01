import { test } from 'node:test';
import assert from 'node:assert/strict';
import { thresholdFor, thrText, verdictOf, LIMITS } from '../src/core/rules.js';

test('soglia: +5 km/h fino a 100, poi riduzione del 5%', () => {
  assert.equal(thresholdFor(90), 95);
  assert.equal(thresholdFor(95), 100);
  assert.ok(Math.abs(thresholdFor(96) - 96/0.95) < 1e-9);
  assert.ok(Math.abs(thresholdFor(130) - 136.8421) < 1e-4);
});

test('soglia mostrata troncata a un decimale', () => {
  assert.equal(thrText(130), '136,8');
  assert.equal(thrText(110), '115,7');
  assert.equal(thrText(100), '105,2');
});

test('esito di un tratto', () => {
  assert.deepEqual(verdictOf(null, 130), ['n/d', '']);
  assert.deepEqual(verdictOf(130, 130), ['in regola', 'ok']);
  assert.deepEqual(verdictOf(136.84, 130), ['sopra il limite, entro la tolleranza', 'tol']);
  assert.deepEqual(verdictOf(136.85, 130), ['oltre la soglia di sanzione', 'bad']);
});

test('limiti proposti', () => {
  assert.deepEqual(LIMITS.map(l => l[0]), [130, 110, 100, 90, 80]);
});
