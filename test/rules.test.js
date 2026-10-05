import { test } from 'node:test';
import assert from 'node:assert/strict';
import { thresholdFor, thrText, verdictOf, LIMITS, colorLimits, YELLOW_CHOICES, RED_CHOICES } from '../src/core/rules.js';

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

// Colori del cartello scelti da chi guida: giallo da (limite + scarto), rosso da (sotto la soglia o rispetto al limite)
test('colori: di base giallo sopra il limite e rosso 2 km/h sotto la soglia', () => {
  assert.deepEqual(colorLimits({limit:130, margin:2}), {yellow:130, red:thresholdFor(130) - 2});
  assert.deepEqual(colorLimits({limit:130, margin:0}), {yellow:130, red:thresholdFor(130)});
});

test('colori: giallo da 125 e rosso da 130 con limite 130', () => {
  assert.deepEqual(colorLimits({limit:130, margin:2, yellowOff:-5, redOff:0}), {yellow:125, red:130});
});

test('colori: le scelte seguono il limite (giallo e rosso spostati con lui)', () => {
  assert.deepEqual(colorLimits({limit:110, margin:2, yellowOff:-5, redOff:0}), {yellow:105, red:110});
  assert.deepEqual(colorLimits({limit:110, margin:2}), {yellow:110, red:thresholdFor(110) - 2});
});

test('colori: elenco delle scelte, dalla più alta, con il valore di base tra quelle del rosso', () => {
  const y = YELLOW_CHOICES(130), r = RED_CHOICES(130);
  assert.equal(y[0].value, 0); assert.equal(y[0].kmh, 130);
  assert.ok(y.some(c => c.kmh === 125) && y.some(c => c.kmh === 120));
  assert.ok(r.some(c => c.key === 'm:2' && Math.abs(c.kmh - 134.84) < 0.01));
  assert.ok(r.some(c => c.key === 'l:0' && c.kmh === 130));
  for (const list of [y, r]) for (let i = 1; i < list.length; i++) assert.ok(list[i].kmh < list[i - 1].kmh);
});

test('colori: la scelta attuale resta nell\'elenco, anche un margine della versione precedente', () => {
  assert.ok(RED_CHOICES(130, 'm:4').some(c => c.key === 'm:4' && c.label === '132,8 (4 sotto la soglia)'));
  assert.equal(RED_CHOICES(130, 'l:0').find(c => c.key === 'l:0').label, '130 (il limite)');
  // con limite 90 la soglia è 95: "3 sopra il limite" e "2 sotto la soglia" sono lo stesso 93
  const r90 = RED_CHOICES(90, 'l:3');
  assert.ok(r90.some(c => c.key === 'l:3') && !r90.some(c => c.key === 'm:2'));
});

// I menù sono larghi quanto lo schermo: voci brevi (a 360 px ne stanno circa 38 caratteri), senza "km/h" (è nel titolo del campo)
test('colori: voci dei menù brevi', () => {
  for (const lim of [130, 110, 90]){
    for (const c of [...YELLOW_CHOICES(lim), ...RED_CHOICES(lim, 'm:4')]) assert.ok(c.label.length <= 30, c.label);
  }
  assert.equal(RED_CHOICES(130).find(c => c.key === 'm:2').label, '134,8 (consigliato)');
  assert.equal(RED_CHOICES(130).find(c => c.key === 'm:0').label, '136,8 (la soglia)');
  assert.equal(YELLOW_CHOICES(130).find(c => c.value === -5).label, '125 (5 sotto il limite)');
});
