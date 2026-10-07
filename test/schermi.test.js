import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIZES, ZOOMS, cases, scaledFontSize, judge } from '../tools/schermi-casi.mjs';

const cleanAudit = {overflowX: false, outside: [], contrast: [], broken: [], small: [], clipped: [], tiny: []};
const goodPlate = {scroll: 700, view: 734, round: true, bigInside: true, keepInside: true, gaugeInside: true, plateInside: true, gaugeShare: 80};

test('misure di schermo: dal telefono piccolo al tablet, compreso il tuo (360×734)', () => {
  const widths = SIZES.map(s => s.w);
  assert.ok(Math.min(...widths) <= 320, 'manca un telefono piccolo');
  assert.ok(Math.max(...widths) >= 800, 'manca un tablet');
  assert.ok(SIZES.some(s => s.w === 360 && s.h === 734), 'manca il telefono di prova');
  for (const s of SIZES) assert.ok(s.name && s.h > s.w, 'misura senza nome o non in verticale: ' + JSON.stringify(s));
});

test('ogni misura in verticale e in orizzontale, con il testo al 100% e al 130%', () => {
  assert.deepEqual(ZOOMS, [1, 1.3]);
  const all = cases();
  assert.equal(all.length, SIZES.length * 2 * ZOOMS.length);
  const land = all.find(c => c.orientation === 'orizzontale' && c.size.name === SIZES[0].name && c.zoom === 1);
  assert.deepEqual([land.w, land.h], [SIZES[0].h, SIZES[0].w], 'in orizzontale larghezza e altezza si scambiano');
  assert.equal(new Set(all.map(c => c.id)).size, all.length, 'nomi dei casi ripetuti');
});

// Il testo ingrandito di Android fa crescere le scritte, non i riquadri: si moltiplicano solo le dimensioni dei caratteri
test('testo ingrandito: moltiplica la dimensione del carattere, lascia stare inherit', () => {
  assert.equal(scaledFontSize('15px', 1.3), 'calc(15px * 1.3)');
  assert.equal(scaledFontSize('clamp(17px, 5.4vw, 22px)', 1.3), 'calc(clamp(17px, 5.4vw, 22px) * 1.3)');
  assert.equal(scaledFontSize('inherit', 1.3), null);
  assert.equal(scaledFontSize('', 1.3), null);
  assert.equal(scaledFontSize('15px', 1), null, 'al 100% non cambia niente');
});

test('pagina a posto: nessun problema', () => {
  assert.deepEqual(judge('pagina', {audit: cleanAudit}), {problems: [], notes: []});
});

test('pagina che scorre di lato, testo fuori schermo, pulsante piccolo: problemi', () => {
  const r = judge('pagina', {audit: {...cleanAudit, overflowX: true, outside: ['#x "a"'], small: ['button "b" 40x40'], broken: ['#y "NaN"']}});
  assert.equal(r.problems.length, 4);
  assert.match(r.problems.join(' '), /scorre di lato/);
});

test('testo tagliato con i puntini e contrasto appena basso: solo note', () => {
  const r = judge('pagina', {audit: {...cleanAudit, clipped: ['#hudRoad "A1"'], contrast: [{what: 'p "x"', ratio: 4.2, bad: false}]}});
  assert.deepEqual(r.problems, []);
  assert.equal(r.notes.length, 2);
});

test('contrasto sotto 3: problema', () => {
  const r = judge('pagina', {audit: {...cleanAudit, contrast: [{what: 'p "x"', ratio: 2.1, bad: true}]}});
  assert.equal(r.problems.length, 1);
});

test('guida in verticale: deve restare ferma, cerchio tondo con media e velocità da tenere dentro', () => {
  assert.deepEqual(judge('guida-verticale', {audit: cleanAudit, plate: goodPlate}), {problems: [], notes: []});
  const r = judge('guida-verticale', {audit: cleanAudit, plate: {...goodPlate, scroll: 800, round: false, bigInside: false, keepInside: false}});
  assert.equal(r.problems.length, 4);
  assert.match(r.problems.join(' '), /scorre/);
});

test('guida in verticale: anche la pagina intera non deve spostarsi', () => {
  const r = judge('guida-verticale', {audit: cleanAudit, plate: {...goodPlate, y: 12}});
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0], /pagina si sposta/);
});

test('guida in verticale con il cerchio sotto metà larghezza: nota, non problema', () => {
  const r = judge('guida-verticale', {audit: cleanAudit, plate: {...goodPlate, gaugeShare: 42}});
  assert.deepEqual(r.problems, []);
  assert.match(r.notes.join(' '), /cerchio piccolo/);
});

test('guida in orizzontale: cartello e cerchio dentro lo schermo', () => {
  const r = judge('guida-orizzontale', {audit: cleanAudit, plate: {...goodPlate, scroll: 900, plateInside: false}});
  assert.equal(r.problems.length, 1, 'in orizzontale conta il cartello dentro lo schermo, non lo scorrimento');
  assert.match(r.problems[0], /cartello/);
});

test('etichetta autovelox: deve vedersi dentro il cerchio senza coprire la media', () => {
  const ok = judge('guida-verticale', {audit: cleanAudit, plate: goodPlate, velox: {shown: true, inside: true, overlap: false}});
  assert.deepEqual(ok.problems, []);
  const r = judge('guida-verticale', {audit: cleanAudit, plate: goodPlate, velox: {shown: true, inside: false, overlap: true}});
  assert.equal(r.problems.length, 2);
  assert.match(judge('guida-verticale', {audit: cleanAudit, plate: goodPlate, velox: {shown: false}}).problems.join(' '), /manca/);
});

test('fascia autovelox: la scritta tagliata dal cerchio è un problema', () => {
  const r = judge('guida-verticale', {audit: cleanAudit, plate: goodPlate, velox: {shown: true, inside: true, overlap: false, clipped: true}});
  assert.match(r.problems.join(' '), /tagliata dal cerchio/);
});
