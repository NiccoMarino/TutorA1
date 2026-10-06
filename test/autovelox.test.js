import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RAMS } from '../src/core/network.js';

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
