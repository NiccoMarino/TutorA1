import { test } from 'node:test';
import assert from 'node:assert/strict';
import { network } from './helpers.js';
import { matchPoint, pointAtKm, secRel, roadOf, RAMS, GROUPS, ROADS } from '../src/core/network.js';

const {secs, lines} = network();
const byId = id => secs.find(s => s.id === id);
const line = id => lines.find(l => l.id === id);

test('186 tratti e 31 linee, nell\'ordine usato per gli spareggi (le prime 7 sono A1 e A4)', () => {
  assert.equal(secs.length, 186);
  assert.deepEqual(lines.map(l => l.id), ['A01S', 'A01N', 'D18', 'D19', 'VAR', 'A04E', 'A04W',
    'A07S', 'A07N', 'A08N', 'A08S', 'A09N', 'A09S', 'A10O', 'A10E', 'A13N', 'A13S', 'A11O', 'A11E', 'A14S', 'A14N',
    'A16E', 'A16O', 'A23N', 'A23S', 'A26N', 'A26S', 'A27N', 'A27S', 'A30S', 'A30N']);
});

test('ogni tratto ha un gruppo nell\'elenco e un\'autostrada con le due direzioni', () => {
  for (const s of secs){
    assert.ok(GROUPS.includes(s.t), s.t);
    assert.ok(RAMS[s.r] && RAMS[s.r].plus && RAMS[s.r].minus, s.r);
  }
});

test('ai portali di ogni tratto la posizione viene agganciata alla sua autostrada, nel suo verso', () => {
  for (const s of secs){
    const L = lines.find(l => l.ram === s.r && (l.fixedSign === s.sign || l.fixedSign === 0) && pointAtKm(l, s.ka) && pointAtKm(l, s.kb));
    assert.ok(L, s.id + ' ' + s.name + ': nessuna linea copre i due portali');
    for (const km of [s.ka, (s.ka + s.kb)/2, s.kb]){
      const p = pointAtKm(L, km), inc = L.pts[L.pts.length-1][2] > L.pts[0][2];
      const m = matchPoint(lines, p.lat, p.lon, (s.sign > 0) === inc ? p.brg : (p.brg + 180) % 360, 35, 6, 0, s.r);
      assert.ok(m && m.ram === s.r && m.sign === s.sign && Math.abs(m.km - km) < 0.1,
        s.id + ' ' + s.name + ' al km ' + km + ': ' + (m && m.ram + ' ' + m.sign + ' km ' + m.km));
    }
  }
});

test('tratto Faenza-Forlì della A14 verso sud', () => {
  const s = secs.find(x => x.r === 'A14' && x.da === 'Faenza' && x.a === 'Forlì');
  assert.equal(s.t, 'A14 Bologna-Ancona');
  assert.equal(s.sign, 1);
  assert.equal(s.towards, 'verso Taranto');
  assert.equal(s.L, 17.3);
  assert.equal(roadOf(s), 'A14');
});

test('le diramazioni di Roma e la Variante di Valico fanno parte della A1', () => {
  assert.deepEqual(['D18', 'D19', 'VAR'].map(r => roadOf({r})), ['A1', 'A1', 'A1']);
  assert.deepEqual(ROADS.slice(0, 4), ['A1', 'A4', 'A7', 'A8']);
  assert.equal(ROADS.length, 14);
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
