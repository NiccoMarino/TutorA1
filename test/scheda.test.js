import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { check } from '../tools/check-scheda.mjs';

test('i testi della scheda del Play Store ci sono tutti e rispettano i limiti di Google', () => {
  const md = readFileSync(new URL('../docs/play-store/SCHEDA.md', import.meta.url), 'utf8');
  for (const r of check(md)){
    assert.ok(r.lunghezza != null, 'manca il campo ' + r.campo);
    assert.ok(r.lunghezza <= r.max, r.campo + ': ' + r.lunghezza + ' caratteri, massimo ' + r.max);
  }
});

test('un testo troppo lungo viene segnalato', () => {
  const r = check('<!-- campo: nome -->\n' + 'x'.repeat(31) + '\n## Altro');
  assert.equal(r.find(x => x.campo === 'nome').lunghezza, 31);
});
