import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, fmtDur, fmtDist, speakDist, spk, esc, nfKm, nfL } from '../src/core/format.js';

test('clamp', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(clamp(2, 0, 3), 2);
});

test('fmtDur: secondi e minuti', () => {
  assert.equal(fmtDur(0), '0 s');
  assert.equal(fmtDur(59.4), '59 s');
  assert.equal(fmtDur(61), '1 min 01 s');
  assert.equal(fmtDur(-5), '0 s');
});

test('fmtDist: metri sotto 950 m, poi km con un decimale', () => {
  assert.equal(fmtDist(0.004), '10 m');
  assert.equal(fmtDist(0.456), '460 m');
  assert.equal(fmtDist(3), '3,0 km');
  assert.equal(fmtDist(12.34), '12,3 km');
});

test('speakDist: distanze dette a voce', () => {
  assert.equal(speakDist(0.04), '100 metri');
  assert.equal(speakDist(0.43), '400 metri');
  assert.equal(speakDist(1.2), 'un chilometro');
  assert.equal(speakDist(2.3), '2,5 chilometri');
  assert.equal(speakDist(2.8), '3 chilometri');
});

test('spk: abbreviazioni lette per esteso', () => {
  assert.equal(spk('All. A15 (nord)'), 'allacciamento A 15 lato nord');
  assert.equal(spk('Dir. Roma Nord'), 'diramazione Roma Nord');
  assert.equal(spk('S. Maria Capua Vetere'), 'Santa Maria Capua Vetere');
});

test('esc: caratteri speciali HTML', () => {
  assert.equal(esc('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
});

test('formati numerici italiani', () => {
  assert.equal(nfKm.format(12.05), '12,05');
  assert.equal(nfL.format(11.95), '11,95');
});
