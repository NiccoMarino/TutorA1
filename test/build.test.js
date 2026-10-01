import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPages, render } from '../scripts/build.mjs';

const saved = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('index.html nel repository è aggiornato rispetto a src/ (se fallisce: npm run build)', () => {
  const {web} = buildPages();
  assert.ok(web + '\n' === saved, 'index.html diverso da quello che produce la build');
});

test('la pagina per il browser non carica il ponte nativo e copre tutto lo schermo', () => {
  const {web} = buildPages();
  assert.ok(!web.includes('capacitor.js'));
  assert.ok(web.includes('viewport-fit=cover'));
});

test("la pagina per l'app carica il ponte nativo e lascia spazio alle barre di sistema", () => {
  const {app} = buildPages();
  assert.ok(app.includes('<script src="capacitor.js"></script>\n<script src="tutor-native.js"></script>'));
  assert.ok(!app.includes('viewport-fit=cover'));
});

test('un segnaposto con variabile sconosciuta ferma la build', () => {
  assert.throws(() => render('<p><!--@var boh--></p>', {}), /Variabile sconosciuta/);
});

test('un segnaposto scritto male ferma la build', () => {
  assert.throws(() => render('<p><!--@includi x--></p>', {}), /Segnaposto non risolto/);
});
