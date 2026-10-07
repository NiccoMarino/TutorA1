import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// privacy.html è l'informativa linkata dal Play Store e dalla pagina: https://niccomarino.github.io/TutorA1/privacy.html
const html = readFileSync(new URL('../privacy.html', import.meta.url), 'utf8');

test("l'informativa dice dove resta la posizione e chi contattare", () => {
  assert.match(html, /<title>[^<]+<\/title>/);
  assert.match(html, /posizione/i);
  assert.match(html, /mailto:niccofantini2000@gmail\.com/);
  assert.match(html, /TutOK/);
});

test("l'informativa è una pagina statica senza script esterni", () => {
  assert.ok(!/<script/i.test(html));
});

test('la pagina dell\'app porta all\'informativa', () => {
  assert.ok(readFileSync(new URL('../src/index.html', import.meta.url), 'utf8').includes('https://niccomarino.github.io/TutorA1/privacy.html'));
});

// termini.html: termini d'uso, linkati dalla pagina dell'app e dall'informativa
const terms = readFileSync(new URL('../termini.html', import.meta.url), 'utf8');

test('i termini d\'uso dicono che le stime non sono misure ufficiali e che il limite vale sempre', () => {
  assert.ok(!/<script/i.test(terms));
  assert.match(terms, /non autorizza a superare il limite/);
  // l'opzione che mostra il numero sopra il limite è dichiarata nei termini, con la responsabilità di chi la accende
  assert.match(terms, /sopra il limite[\s\S]*?dopo aver letto e accettato un avviso[\s\S]*?nei limiti consentiti dalla legge/);
  assert.ok(!/codice personale/.test(terms));
  assert.match(terms, /non garantisce di evitare sanzioni/);
  assert.match(terms, /articolo 173 del Codice della Strada/);
  assert.match(terms, /minori di 18 anni/);
  assert.match(terms, /mailto:niccofantini2000@gmail\.com/);
  assert.ok(html.includes('termini.html'), 'l\'informativa porta ai termini');
});

test('cookie: nessun cookie e nessun banner, detto nell\'informativa; la pagina non scrive cookie', () => {
  assert.match(html, /<h2>Cookie<\/h2>/);
  const src = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(!/document\.cookie/.test(src), 'la pagina usa i cookie');
});
