import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tileSource } from '../src/tiles.js';

test('senza chiave CARTO resta OpenStreetMap, scurita con il filtro nel tema scuro', () => {
  const light = tileSource(false, '');
  assert.equal(light.url, 'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
  assert.equal(light.className, '');
  assert.equal(tileSource(true, '').className, 'tiles-dark');
  assert.match(light.attribution, /OpenStreetMap/);
  assert.match(light.probe, /^https:\/\/tile\.openstreetmap\.org\/6\/34\/23\.png$/);
});

test('con la chiave CARTO usa Voyager di giorno e Dark Matter di notte, senza filtro', () => {
  const light = tileSource(false, 'k1');
  const dark = tileSource(true, 'k1');
  assert.equal(light.url, 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=k1');
  assert.equal(dark.url, 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=k1');
  assert.equal(light.subdomains, 'abcd');
  assert.equal(dark.className, '');
  assert.match(light.attribution, /OpenStreetMap/);
  assert.match(light.attribution, /CARTO/);
  assert.equal(light.probe, 'https://a.basemaps.cartocdn.com/rastertiles/voyager/6/34/23.png?key=k1');
});

test('la chiave va nell\'indirizzo codificata', () => {
  assert.match(tileSource(false, 'a b&c').url, /\?key=a%20b%26c$/);
});
