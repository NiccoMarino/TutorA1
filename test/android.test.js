import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// Barra di stato: lo sfondo viene dal tema all'avvio, il colore delle icone dal tema del momento. Se il tema del
// telefono cambia con l'app aperta i due non vanno d'accordo (icone bianche su bianco): li fissiamo entrambi.
test('la barra di stato è sempre scura con icone chiare, qualunque sia il tema del telefono', () => {
  const cap = JSON.parse(read('capacitor.config.json'));
  assert.equal(cap.plugins && cap.plugins.SystemBars && cap.plugins.SystemBars.style, 'DARK');
  const styles = read('android/app/src/main/res/values/styles.xml');
  const noActionBar = styles.match(/<style name="AppTheme\.NoActionBar"[\s\S]*?<\/style>/)[0];
  assert.match(noActionBar, /<item name="android:windowBackground">@color\/barre_sistema<\/item>/);
  assert.match(noActionBar, /<item name="android:statusBarColor">@color\/barre_sistema<\/item>/);
  assert.match(noActionBar, /<item name="android:windowLightStatusBar">false<\/item>/);
  assert.match(read('android/app/src/main/res/values/colors.xml'), /<color name="barre_sistema">#0E1412<\/color>/);
});
