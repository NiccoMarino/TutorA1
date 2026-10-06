import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNav } from '../src/ui/nav.js';

// Finta cronologia del browser: come quella vera, back() e go() avvisano con popstate
function fakeWindow(){
  const entries = [null]; let i = 0; const listeners = [];
  const fire = () => listeners.forEach(f => f({state: entries[i]}));
  return {
    history: {
      get state(){ return entries[i]; },
      replaceState(s){ entries[i] = s; },
      pushState(s){ entries.splice(i + 1); entries.push(s); i++; },
      back(){ if (i > 0){ i--; fire(); } },
      go(n){ const j = Math.max(0, i + n); if (j !== i){ i = j; fire(); } }
    },
    addEventListener(type, f){ if (type === 'popstate') listeners.push(f); },
    scrollTo(){}
  };
}
function make(start){
  const win = fakeWindow(), shown = [];
  const nav = createNav({win, show: id => shown.push(id), start});
  return {win, nav, shown, current: () => shown[shown.length - 1]};
}

test("all'avvio mostra la schermata iniziale", () => {
  const {nav, current} = make();
  assert.equal(current(), 'home');
  assert.equal(nav.current(), 'home');
});

test('menù e pagine si aprono uno sopra l\'altro e Indietro li richiude in ordine', () => {
  const {nav, current} = make();
  nav.go('menu'); nav.go('pSettings');
  assert.equal(current(), 'pSettings');
  assert.equal(nav.back(), true); assert.equal(current(), 'menu');
  assert.equal(nav.back(), true); assert.equal(current(), 'home');
});

test('dalla schermata iniziale Indietro non fa niente (lo gestisce il telefono: chiude l\'app)', () => {
  const {nav, current} = make();
  assert.equal(nav.back(), false);
  assert.equal(current(), 'home');
});

test('"Home" dal fondo di una pagina torna alla schermata iniziale in un colpo solo', () => {
  const {nav, current} = make();
  nav.go('menu'); nav.go('pHist');
  nav.home();
  assert.equal(current(), 'home');
  assert.equal(nav.back(), false);
});

test('aprire la pagina già aperta non la mette due volte nella cronologia', () => {
  const {nav, current} = make();
  nav.go('pSim'); nav.go('pSim');
  nav.back();
  assert.equal(current(), 'home');
});

test('il tasto Indietro del browser (popstate) segue la stessa strada', () => {
  const {win, nav, current} = make();
  nav.go('menu'); nav.go('pHow');
  win.history.back();
  assert.equal(current(), 'menu');
  win.history.back();
  assert.equal(current(), 'home');
});

// Avviso alla prima apertura: è la prima schermata, Indietro non lo salta, accettato si passa alla schermata iniziale
test("con l'avviso da accettare parte da lì e Indietro non lo salta", () => {
  const {nav, current} = make('pAvviso');
  assert.equal(current(), 'pAvviso');
  assert.equal(nav.back(), false);
  assert.equal(current(), 'pAvviso');
});

test("accettato l'avviso si passa alla schermata iniziale, che resta il fondo della cronologia", () => {
  const {win, nav, current} = make('pAvviso');
  nav.replace('home');
  assert.equal(current(), 'home');
  nav.go('menu');
  win.history.back();
  assert.equal(current(), 'home');
  assert.equal(nav.back(), false);
});
