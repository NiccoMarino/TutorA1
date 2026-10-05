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

// Senza questo, Indietro dal menù o da una pagina chiuderebbe l'app invece di tornare alla schermata iniziale
test('il tasto Indietro di Android chiede prima alla pagina (window.tutorBack)', () => {
  const main = read('android/app/src/main/java/it/niccomarino/tutora1a4/MainActivity.java');
  assert.match(main, /tutorBack/);
  const page = read('src/main.js');
  assert.match(page, /window\.tutorBack\s*=/);
});

// Il riquadro mostra solo il cartello circolare: finestra quadrata e trasparente fuori dal cerchio
test('il riquadro è quadrato e trasparente intorno al cerchio', () => {
  const main = read('android/app/src/main/java/it/niccomarino/tutora1a4/MainActivity.java');
  assert.match(main, /setAspectRatio\(new Rational\(1, 1\)\)/);
  assert.match(main, /setPipTransparent\(isInPictureInPictureMode\)/);
  assert.match(main, /wv\.setBackgroundColor\(on \? Color\.TRANSPARENT/);
  assert.match(main, /PixelFormat\.TRANSLUCENT/);
  const pip = read('src/styles/pip.css');
  assert.match(pip, /html\.pip, html\.pip body\{background:transparent/);
});

// L'app non si collega a nessun server: il permesso internet resta tolto, anche se una libreria lo chiede
test('niente permesso INTERNET nell\'app', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  assert.match(manifest, /<uses-permission android:name="android\.permission\.INTERNET" tools:node="remove" \/>/);
  assert.ok(!/<uses-permission android:name="android\.permission\.INTERNET" \/>/.test(manifest));
});
