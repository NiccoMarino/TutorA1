import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { isNativeApp, gpsDeniedMessage } from '../src/platform.js';

afterEach(() => { delete globalThis.window; });

test("nel browser il messaggio di GPS negato parla dei permessi del browser", () => {
  globalThis.window = {};
  assert.equal(isNativeApp(), false);
  assert.match(gpsDeniedMessage(), /permesso di usarla/);
});

test("nell'app il messaggio di GPS negato spiega dove trovare l'autorizzazione nel telefono", () => {
  globalThis.window = {Capacitor: {isNativePlatform: () => true}};
  assert.equal(isNativeApp(), true);
  assert.match(gpsDeniedMessage(), /Autorizzazioni &gt; Posizione/);
});

test('senza window (o con Capacitor rotto) si comporta come il browser', () => {
  assert.equal(isNativeApp(), false);
  globalThis.window = {Capacitor: {isNativePlatform(){ throw new Error('rotto'); }}};
  assert.equal(isNativeApp(), false);
});
