import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, SKEY, HKEY, AKEY, DISCLAIMER_VERSION, DEFAULT_SETTINGS } from '../src/core/store.js';

function memoryStorage(init = {}){
  const m = new Map(Object.entries(init));
  return {getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => { m.set(k, String(v)); }};
}

test('le chiavi di localStorage non cambiano (ci sono i dati di chi usa già l\'app)', () => {
  assert.equal(SKEY, 'tutorA1.v1.settings');
  assert.equal(HKEY, 'tutorA1.v1.history');
});

test('senza dati salvati usa le impostazioni predefinite', () => {
  const s = createStore(memoryStorage());
  assert.deepEqual(s.settings, {limit:130, margin:2, preAlert:1, voice:true, beep:true, instWarn:true, theme:'auto'});
  assert.deepEqual(s.history, []);
});

test('le impostazioni salvate in parte si uniscono a quelle predefinite', () => {
  const s = createStore(memoryStorage({[SKEY]: JSON.stringify({limit:110, voice:false})}));
  assert.equal(s.settings.limit, 110);
  assert.equal(s.settings.voice, false);
  assert.equal(s.settings.margin, 2);
});

test('dati rovinati: si riparte dai valori predefiniti', () => {
  const s = createStore(memoryStorage({[SKEY]: '{rotto', [HKEY]: '"non una lista"'}));
  assert.deepEqual(s.settings, DEFAULT_SETTINGS);
  assert.deepEqual(s.history, []);
});

test('senza localStorage (null) funziona in memoria senza errori', () => {
  const s = createStore(null);
  s.settings.limit = 90;
  s.saveSettings();
  s.addHistory({id:1});
  assert.equal(s.history.length, 1);
});

test('modificare le impostazioni non tocca i valori predefiniti', () => {
  const s = createStore(memoryStorage());
  s.settings.limit = 80;
  assert.equal(DEFAULT_SETTINGS.limit, 130);
});

test('saveSettings scrive le impostazioni attuali', () => {
  const storage = memoryStorage();
  const s = createStore(storage);
  s.settings.margin = 4;
  s.saveSettings();
  assert.equal(JSON.parse(storage.getItem(SKEY)).margin, 4);
});

test('lo storico tiene gli ultimi 60 tratti, il più recente per primo, e li salva', () => {
  const storage = memoryStorage();
  const s = createStore(storage);
  for (let i = 1; i <= 61; i++) s.addHistory({id:i});
  assert.equal(s.history.length, 60);
  assert.equal(s.history[0].id, 61);
  assert.equal(JSON.parse(storage.getItem(HKEY)).length, 60);
  s.clearHistory();
  assert.deepEqual(s.history, []);
  assert.equal(storage.getItem(HKEY), '[]');
});

// Diritto alla cancellazione: tutto quello che l'app conserva è qui, e si cancella dall'app
test("cancella tutti i dati: storico, impostazioni e avviso accettato spariscono dal telefono", () => {
  const removed = [];
  const storage = {...memoryStorage({[SKEY]: JSON.stringify({limit:110}), [HKEY]: JSON.stringify([{sec:'x'}])}), removeItem: k => removed.push(k)};
  const s = createStore(storage);
  s.clearAll();
  assert.deepEqual(removed.sort(), [AKEY, HKEY, SKEY].sort());
  assert.deepEqual(s.history, []);
  assert.deepEqual(s.settings, DEFAULT_SETTINGS);
});

// Avviso alla prima apertura: si accetta una volta, ricompare se cambia il testo (DISCLAIMER_VERSION) o si cancellano i dati
test("l'avviso compare alla prima apertura e, accettato, non compare più", () => {
  const storage = memoryStorage();
  const s = createStore(storage);
  assert.equal(s.disclaimerAccepted(), false);
  s.acceptDisclaimer();
  assert.equal(s.disclaimerAccepted(), true);
  assert.equal(createStore(storage).disclaimerAccepted(), true);
});

test("l'avviso è salvato a parte: le impostazioni di guida non cambiano", () => {
  assert.equal(AKEY, 'tutorA1.v1.avviso');
  const s = createStore(memoryStorage());
  s.acceptDisclaimer();
  assert.deepEqual(s.settings, DEFAULT_SETTINGS);
});

test("se il testo dell'avviso cambia versione, ricompare una volta", () => {
  const s = createStore(memoryStorage({[AKEY]: String(DISCLAIMER_VERSION - 1)}));
  assert.equal(s.disclaimerAccepted(), false);
});

test("cancellare i dati fa ricomparire l'avviso", () => {
  const m = new Map(); const storage = {getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k)};
  const s = createStore(storage);
  s.acceptDisclaimer(); s.clearAll();
  assert.equal(s.disclaimerAccepted(), false);
  assert.equal(createStore(storage).disclaimerAccepted(), false);
});

test("senza localStorage l'avviso accettato vale finché l'app resta aperta", () => {
  const s = createStore(null);
  s.acceptDisclaimer();
  assert.equal(s.disclaimerAccepted(), true);
});

test("avviso iniziale alla versione 2: parla anche degli autovelox", () => {
  assert.equal(DISCLAIMER_VERSION, 2);
});
