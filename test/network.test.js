import { test } from 'node:test';
import assert from 'node:assert/strict';
import { network } from './helpers.js';
import { matchPoint, pointAtKm, secRel, roadOf } from '../src/core/network.js';

const {secs, lines} = network();
const byId = id => secs.find(s => s.id === id);
const line = id => lines.find(l => l.id === id);

test('83 tratti e 7 linee, nell\'ordine usato per gli spareggi', () => {
  assert.equal(secs.length, 83);
  assert.deepEqual(lines.map(l => l.id), ['A01S', 'A01N', 'D18', 'D19', 'VAR', 'A04E', 'A04W']);
});

test('tratto Milano Sud-Lodi verso sud', () => {
  const s = byId(12);
  assert.equal(s.name, 'Milano Sud → Lodi');
  assert.equal(s.sign, 1);
  assert.equal(s.towards, 'verso Napoli');
  assert.equal(s.pos, true);
  assert.equal(s.cls, 'sud');
  assert.equal(roadOf(s), 'A1');
});

test('tratto Ospitaletto-Rovato verso ovest, chilometri decrescenti', () => {
  const s = byId(75);
  assert.equal(s.sign, -1);
  assert.equal(s.towards, 'verso Torino');
  assert.equal(s.pos, false);
  assert.equal(s.cls, 'nord');
  assert.equal(roadOf(s), 'A4');
});

test('secRel misura i km dall\'inizio del tratto nel verso di marcia', () => {
  assert.equal(secRel(byId(12), 12.3), 0);
  assert.ok(Math.abs(secRel(byId(12), 21.2) - 8.9) < 1e-9);
  assert.ok(Math.abs(secRel(byId(75), 202.3) - 4.67) < 1e-9);
});

test('un punto sulla A1 verso sud viene agganciato alla carreggiata sud', () => {
  const p = pointAtKm(line('A01S'), 15);
  const m = matchPoint(lines, p.lat, p.lon, p.brg, 35, 6, 0, null);
  assert.equal(m.ram, 'A01');
  assert.equal(m.sign, 1);
  assert.ok(Math.abs(m.km - 15) < 0.05);
});

test('stesso punto con direzione opposta: carreggiata nord', () => {
  const p = pointAtKm(line('A01S'), 15);
  const m = matchPoint(lines, p.lat, p.lon, (p.brg + 180) % 360, 35, 6, 0, null);
  assert.equal(m.ram, 'A01');
  assert.equal(m.sign, -1);
  assert.ok(Math.abs(m.km - 15) < 0.5);
});

test('un punto lontano dalle autostrade non viene agganciato', () => {
  assert.equal(matchPoint(lines, 40.0, 9.0, 0, 30, 6, 0, null), null);
});

test('pointAtKm fuori dal tracciato restituisce null', () => {
  assert.equal(pointAtKm(line('A01S'), 9999), null);
});
