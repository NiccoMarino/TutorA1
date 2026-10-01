import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyTheme, THEMES } from '../src/ui/theme.js';

const fakeRoot = () => ({dataset: {}});

test('tre scelte di tema: come il telefono, chiaro, scuro', () => {
  assert.deepEqual(THEMES.map(t => t[0]), ['auto', 'light', 'dark']);
});

test('chiaro e scuro forzano il tema sulla pagina', () => {
  const root = fakeRoot();
  applyTheme(root, 'dark');
  assert.equal(root.dataset.theme, 'dark');
  applyTheme(root, 'light');
  assert.equal(root.dataset.theme, 'light');
});

test('"come il telefono" toglie la scelta forzata', () => {
  const root = fakeRoot();
  applyTheme(root, 'dark');
  applyTheme(root, 'auto');
  assert.equal('theme' in root.dataset, false);
});

test('un valore sconosciuto salvato per sbaglio vale come "come il telefono"', () => {
  const root = fakeRoot();
  applyTheme(root, 'viola');
  assert.equal('theme' in root.dataset, false);
});
