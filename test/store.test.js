import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, SKEY, HKEY, DEFAULT_SETTINGS } from '../src/core/store.js';

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
test('cancella tutti i dati: storico e impostazioni spariscono dal telefono', () => {
  const removed = [];
  const storage = {...memoryStorage({[SKEY]: JSON.stringify({limit:110}), [HKEY]: JSON.stringify([{sec:'x'}])}), removeItem: k => removed.push(k)};
  const s = createStore(storage);
  s.clearAll();
  assert.deepEqual(removed.sort(), [HKEY, SKEY].sort());
  assert.deepEqual(s.history, []);
  assert.deepEqual(s.settings, DEFAULT_SETTINGS);
});
