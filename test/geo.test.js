import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hav, bearing, angDiff } from '../src/core/geo.js';

test('distanza Milano-Roma in linea d\'aria', () => {
  assert.ok(Math.abs(hav(45.4642, 9.19, 41.9028, 12.4964) - 476885) < 1);
});

test('direzione verso nord ed est', () => {
  assert.ok(Math.abs(bearing(45, 9, 46, 9)) < 1e-9);
  assert.ok(Math.abs(bearing(45, 9, 45, 10) - 90) < 1);
});

test('differenza tra angoli', () => {
  assert.equal(angDiff(350, 10), 20);
  assert.equal(angDiff(0, 180), 180);
  assert.equal(angDiff(90, 450), 0);
});
