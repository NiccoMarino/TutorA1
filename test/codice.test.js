// Codice per sbloccare il numero calcolato sopra il limite: nell'app c'è solo l'impronta (PBKDF2), mai il codice
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codeHash, checkCode, CODE_ITER } from '../src/core/codice.js';
import { codiceFile } from '../tools/codice.mjs';

const SALT = '00112233445566778899aabbccddeeff';

test('impronta: sempre la stessa per lo stesso codice, diversa per un codice o un sale diversi', async () => {
  const a = await codeHash('fiducia-2026', SALT, 1000);
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(await codeHash('fiducia-2026', SALT, 1000), a);
  assert.notEqual(await codeHash('fiducia-2027', SALT, 1000), a);
  assert.notEqual(await codeHash('fiducia-2026', 'ff' + SALT.slice(2), 1000), a);
});

test('codice giusto sì, sbagliato o vuoto no; spazi prima e dopo non contano', async () => {
  const ref = {salt: SALT, iter: 1000, hash: await codeHash('fiducia-2026', SALT, 1000)};
  assert.equal(await checkCode('fiducia-2026', ref), true);
  assert.equal(await checkCode('  fiducia-2026 ', ref), true);
  assert.equal(await checkCode('Fiducia-2026', ref), false);
  assert.equal(await checkCode('', ref), false);
});

test('senza codice impostato non si sblocca niente', async () => {
  assert.equal(await checkCode('qualsiasi', null), false);
});

test('il file scritto da npm run codice contiene sale, giri e impronta, non il codice', async () => {
  const ref = {salt: SALT, iter: CODE_ITER, hash: 'ab'.repeat(32)};
  const text = codiceFile(ref);
  assert.match(text, /export const CODICE = \{"salt":"0011[0-9a-f]+","iter":\d+,"hash":"(ab){32}"\};/);
  assert.equal(codiceFile(null).includes('export const CODICE = null;'), true);
  assert.ok(CODE_ITER >= 100000, 'troppo pochi giri: provare tutti i codici sarebbe veloce');
});

test('il codice impostato è valido (o non c\'è ancora)', async () => {
  const { CODICE } = await import('../src/core/codice-dati.js');
  if (CODICE === null) return;
  assert.match(CODICE.salt, /^[0-9a-f]{32}$/);
  assert.match(CODICE.hash, /^[0-9a-f]{64}$/);
  assert.ok(CODICE.iter >= 100000);
  assert.ok(!/codice:|password/i.test(readFileSync(new URL('../src/core/codice-dati.js', import.meta.url), 'utf8').split('\n').slice(2).join('\n')));
});
