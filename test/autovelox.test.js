import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RAMS } from '../src/core/network.js';
import { veloxEntries } from '../tools/make-tratti.mjs';
import { DATA } from './helpers.js';

const LIST = JSON.parse(readFileSync(new URL('../tools/autovelox.json', import.meta.url), 'utf8'));

test('elenco autovelox: fonte della Polizia con la data', () => {
  assert.match(LIST.fonte.url, /^https:\/\/www\.poliziadistato\.it\//);
  assert.match(LIST.fonte.data, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(LIST.fonte.titolo && LIST.fonte.ente && LIST.fonte.file);
});

test('elenco autovelox: ogni postazione ha i campi giusti', () => {
  assert.equal(LIST.postazioni.length, 27, 'le postazioni del PDF del 7 ottobre 2025');
  for (const p of LIST.postazioni){
    const what = JSON.stringify(p);
    assert.ok(p.strada === null || RAMS[p.strada], 'strada sconosciuta: ' + what);
    assert.ok(['Nord', 'Sud', 'Est', 'Ovest', 'Italia'].includes(p.direzione), 'direzione: ' + what);
    assert.ok(p.nome && p.comune && /^[A-Z]{2}$/.test(p.prov), 'nome, comune o provincia: ' + what);
    assert.ok(p.km === null ? p.strada === null : p.km > 0, 'chilometro: ' + what);
  }
});

test('elenco autovelox: 13 postazioni sulle autostrade che l\'app segue', () => {
  const followed = LIST.postazioni.filter(p => p.strada);
  assert.equal(followed.length, 13);
  assert.deepEqual([...new Set(followed.map(p => p.strada))].sort(), ['A01', 'A04', 'A11', 'A14']);
});

const SECS = [{r:'A11', d:'Ovest', ka:10, kb:20}, {r:'A11', d:'Est', ka:20, kb:10}, {r:'A01', d:'Nord', ka:30, kb:20}];
const CH = {A11O:[[0, 0, 5], [0, 0, 40]], A11E:[[0, 0, 40], [0, 0, 5]], N:[[0, 0, 50], [0, 0, 1]]};
const P = (strada, km, direzione) => ({strada, nome:'x', km, direzione, comune:'C', prov:'XX'});

test('veloxEntries: verso dai tratti della stessa strada e direzione, strade non seguite escluse', () => {
  assert.deepEqual(veloxEntries([P('A11', 35.5, 'Ovest'), P(null, 3, 'Est'), P('A11', 30, 'Est'), P('A01', 25, 'Nord')], SECS, CH), [
    {id:1, r:'A11', km:35.5, sign:1, comune:'C'}, {id:2, r:'A11', km:30, sign:-1, comune:'C'}, {id:3, r:'A01', km:25, sign:-1, comune:'C'}]);
});

test('veloxEntries: postazione fuori dal tracciato o senza verso: errore chiaro', () => {
  assert.throws(() => veloxEntries([P('A11', 40.5, 'Ovest')], SECS, CH), /fuori dal tracciato/);
  // i 600 m prima della postazione devono essere sul tracciato (l'avviso parte a 500 m)
  assert.throws(() => veloxEntries([P('A11', 5.3, 'Ovest')], SECS, CH), /fuori dal tracciato/);
  assert.throws(() => veloxEntries([P('A11', 30, 'Nord')], SECS, CH), /verso/);
});

test('dati: ogni autovelox seguito è nei dati, con il verso giusto e dentro la sua carreggiata', () => {
  assert.equal(DATA.velox.length, 13);
  assert.deepEqual(DATA.veloxFonte, LIST.fonte);
  const SIGN = {A01:{Nord:-1, Sud:1}, A04:{Est:1, Ovest:-1}, A11:{Ovest:1, Est:-1}, A14:{Sud:1, Nord:-1}};
  LIST.postazioni.filter(p => p.strada).forEach((p, i) => {
    const v = DATA.velox[i];
    assert.deepEqual([v.r, v.km, v.sign, v.comune], [p.strada, p.km, SIGN[p.strada][p.direzione], p.comune]);
  });
});
