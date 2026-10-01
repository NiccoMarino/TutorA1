import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isNativeApp, gpsDeniedMessage, APP_NAME } from '../src/platform.js';

afterEach(() => { delete globalThis.window; });

test("nel browser il messaggio di GPS negato parla dei permessi del browser, non di Claude", () => {
  globalThis.window = {};
  assert.equal(isNativeApp(), false);
  assert.match(gpsDeniedMessage(), /permesso di usarla/);
  assert.doesNotMatch(gpsDeniedMessage(), /Claude/);
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

test("il messaggio dell'app usa lo stesso nome che Android mostra in Impostazioni > App", () => {
  const xml = readFileSync(new URL('../android/app/src/main/res/values/strings.xml', import.meta.url), 'utf8');
  const label = xml.match(/<string name="app_name">([^<]+)<\/string>/)[1];
  assert.equal(APP_NAME, label);
  globalThis.window = {Capacitor: {isNativePlatform: () => true}};
  assert.ok(gpsDeniedMessage().includes('App &gt; ' + label + ' &gt; Autorizzazioni'));
});
