import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// privacy.html è l'informativa linkata dal Play Store e dalla pagina: https://niccomarino.github.io/TutorA1/privacy.html
const html = readFileSync(new URL('../privacy.html', import.meta.url), 'utf8');

test("l'informativa dice dove resta la posizione e chi contattare", () => {
  assert.match(html, /<title>[^<]+<\/title>/);
  assert.match(html, /posizione/i);
  assert.match(html, /mailto:niccofantini2000@gmail\.com/);
  assert.match(html, /MediaVelocità/);
});

test("l'informativa è una pagina statica senza script esterni", () => {
  assert.ok(!/<script/i.test(html));
});

test('la pagina dell\'app porta all\'informativa', () => {
  assert.ok(readFileSync(new URL('../src/index.html', import.meta.url), 'utf8').includes('https://niccomarino.github.io/TutorA1/privacy.html'));
});
