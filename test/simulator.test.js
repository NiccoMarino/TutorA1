import { test } from 'node:test';
import assert from 'node:assert/strict';
import { network } from './helpers.js';
import { createSimulator } from '../src/core/simulator.js';
import { pointAtKm } from '../src/core/network.js';

const {secs, lines} = network();
const make = () => createSimulator({secs, lines, random: () => 0.5});

test('si parte 2,2 km prima del tratto scelto, sulla carreggiata giusta', () => {
  const s = make();
  assert.equal(s.setup(12, 120, 1000), true);
  assert.equal(s.sim.line.id, 'A01S');
  assert.ok(Math.abs(s.sim.km - 10.1) < 1e-9);
  assert.equal(s.sim.speed, 120);
});

test('tratto inesistente', () => {
  assert.equal(make().setup(9999, 120, 1000), false);
});

test('ogni passo avanza di mezzo secondo alla velocità impostata', () => {
  const s = make();
  s.setup(12, 120, 1000);
  const p = s.step();
  const want = pointAtKm(s.sim.line, s.sim.km);
  assert.ok(Math.abs(s.sim.km - (10.1 + 120/3600*0.5)) < 1e-9);
  assert.equal(p.timestamp, 1000500);
  assert.ok(Math.abs(p.coords.latitude - want.lat) < 1e-12);
  assert.ok(Math.abs(p.coords.speed - 120/3.6) < 1e-12);
  assert.equal(p.coords.heading, want.brg);
});

test('il tempo accelerato allunga il passo', () => {
  const s = make();
  s.setup(12, 120, 1000);
  s.sim.warp = 15;
  s.step();
  assert.ok(Math.abs(s.sim.km - (10.1 + 120/3600*7.5)) < 1e-9);
});

test('prossimo Tutor e salto a 1,4 km dal portale', () => {
  const s = make();
  s.setup(12, 120, 1000);
  const n = s.nextSection();
  assert.equal(n.id, 12);
  s.jumpBefore(n);
  assert.ok(Math.abs(s.sim.km - 10.9) < 1e-9);
});

test('a fine tracciato step() restituisce null', () => {
  const s = make();
  s.setup(12, 120, 1000);
  s.sim.km = 761.5;
  assert.equal(s.step(), null);
});

// Il pulsante "Simula questo tratto" c'è per tutti i tratti: la simulazione deve arrivare al portale e chiudere la misura
test('ogni tratto si può simulare dall\'inizio alla fine, anche a tempo accelerato', async () => {
  const { createTracker } = await import('../src/core/tracker.js');
  const { DEFAULT_SETTINGS } = await import('../src/core/store.js');
  for (const sec of secs){
    const s = createSimulator({secs, lines, random: () => 0.5});
    assert.equal(s.setup(sec.id, 125, 1790000000), true, sec.id + ' ' + sec.name);
    s.sim.warp = 5;
    const tracker = createTracker({secs, lines, settings: {...DEFAULT_SETTINGS}});
    let start = null, end = null;
    tracker.on(e => {
      if (e.type === 'section-start' && e.sec.id === sec.id) start = e;
      if (e.type === 'section-finish' && e.result.sec.id === sec.id) end = e.result;
    });
    tracker.start('sim');
    for (let i = 0; i < 20000 && !end; i++){ const p = s.step(); if (!p) break; tracker.pushPosition(p); }
    assert.ok(start && !start.mid, sec.id + ' ' + sec.name + ': il tratto non parte dal portale');
    assert.ok(end && Math.abs(end.avg - 125) < 2, sec.id + ' ' + sec.name + ': media ' + (end && end.avg));
  }
});

test('"prossimo Tutor" su un\'autostrada nuova, con i chilometri decrescenti (A14 verso Bologna)', () => {
  const s = make();
  const first = secs.find(x => x.r === 'A14' && x.da === 'Valle del Rubicone' && x.sign === -1);
  s.setup(first.id, 120, 1000);
  s.sim.km = first.kb - 1;
  const n = s.nextSection();
  assert.equal(n.r, 'A14');
  assert.equal(n.sign, -1);
  assert.ok(n.ka < first.kb, n.name);
});
