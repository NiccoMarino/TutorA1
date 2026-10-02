# Come è fatto il Tutor A1/A4

## In breve
La pagina è un solo file HTML, ma i sorgenti sono divisi in `src/`. `npm run build` li ricompone in
`index.html` (browser, GitHub Pages) e in `www/` (app Android con Capacitor). Non modificare
`index.html` a mano: viene riscritto dalla build.

## Le due metà
- `src/core/`: il calcolo. Niente `document` o `window`: si prova con `npm test`.
- `src/ui/`: la pagina. Mostra quello che decide `core/`, senza calcolare.
- `src/main.js` è l'unico file che le conosce entrambe e le collega.

## Da una posizione GPS allo schermo
1. Il GPS (o `core/simulator.js`) produce una posizione.
2. `core/tracker.js` la aggancia alla strada (`core/network.js`), segue i tratti e la media
   (`core/metrics.js`) ed emette eventi: `pre-alert`, `section-start`, `section-finish`, `section-end`,
   `section-abort`, `instant-over`, `alarm`, `alarm-cleared`, `position`.
3. `main.js` riceve gli eventi: chiede a `core/messages.js` cosa dire (testo, segnale, vibrazione)
   e lo passa a `ui/audio.js` e `ui/hud.js`; salva lo storico (`core/store.js`).
4. A ogni `position`, `core/hud-view.js` calcola cosa mostrare e `ui/hud.js` lo scrive nella pagina.

## Dove mettere le mani
- Nuovo avviso vocale: un evento in `tracker.js`, il testo in `messages.js`, un test in
  `test/messages.test.js` e uno in `test/tracker.test.js`.
- Cambiare un testo della schermata di guida: `hud-view.js`.
- Regole sulla tolleranza: `rules.js` (con `test/rules.test.js`).
- Nuovi tratti o tracciati: `src/data/tutor-data.json`; nuove linee in `LINE_DEFS` di `network.js` e il ramo in `RAMS`.
  Le autostrade dopo la A4 (A7 … A30) le scrive `node tools/make-tratti.mjs` dall'elenco `tools/tratti-autostrade.json`:
  scarica il tracciato da OpenStreetMap e i chilometri di webcam, aree di servizio e caselli dai dati di viabilità di
  Autostrade per l'Italia (in `tools/.cache/`), interpola il chilometro lungo le due carreggiate e stampa per ogni tratto
  quanto sono lontani i punti di riferimento. A1 e A4 restano come sono.
- Differenze browser/app: `src/platform.js`. Il ponte nativo è `native/tutor-native.js`.
- Niente mappa (tolta a ottobre 2026): i tratti sono un elenco (`ui/sidebar.js`, nella pagina Simulazione),
  la guida usa tutto lo schermo.
- Schermate fuori dalla guida: la schermata iniziale (`#home`, due cartelli: "Avvia guida" e "Prova in
  simulazione"), il menù (`#menu`) e una pagina per voce (`#pSettings`, `#pSim`, `#pHist`, `#pHow`, `#pInfo`).
  Un elemento con `data-go="id"` apre quella schermata, `data-back` torna indietro; la cronologia è in
  `ui/nav.js`. Il tasto Indietro di Android chiede prima alla pagina (`window.tutorBack`, da `MainActivity.java`).
- Tema: `settings.theme` (`auto`, `light`, `dark`), applicato da `ui/theme.js` con `data-theme` su `<html>`;
  i colori sono in cima a `styles/app.css`. La schermata di guida resta scura in entrambi i temi.
  Il carattere Overpass è dentro la pagina (`scripts/build.mjs`), quindi l'app non si collega a internet.
- Versione: `package.json`; la build la scrive nella pagina, `android/app/build.gradle` ne ricava versionName e versionCode.
- Icona, avvio e immagini dello store: `tools/make-icons.mjs` e `tools/store-screenshots.mjs` (`npm run grafica`).
- Stile del riquadro Picture-in-Picture: `src/styles/pip.css`.
- Ottimizzazioni: l'aggancio alla strada (`matchPoint`) scorre tutti i segmenti con un filtro per
  riquadro; se servisse più velocità, un indice spaziale va costruito in `buildNetwork`.

## Contratto con il ponte nativo
`native/tutor-native.js` usa `#hudExit`, `#hudMute`, la classe `driving` sul body e mette la classe
`pip` su `<html>` (stile in `src/styles/pip.css`). Un test in `test/build.test.js` controlla gli id.

## Collaudi dell'uscita dall'app e del riquadro sopra Maps
- Sul telefono: `./gradlew installDebug -Pprova=true` installa "Tutor prova" accanto all'app normale, poi
  `npm run device-check` (aggiungi `-- --gps` per provare anche il GPS vero). Controlla Home e Indietro fuori
  e dentro la guida, il riquadro sopra Google Maps che si aggiorna con lo schermo acceso, il ritorno a schermo
  intero e la X del riquadro che termina la guida e spegne il GPS. Schermate in `device-check/`.
  La X si tocca in una posizione misurata sul menu del riquadro di One UI; su un altro telefono il collaudo
  ripiega sul trascinamento e lo scrive nel dettaglio del controllo.
- Nel browser: `tools/pip-harness.mjs` su `/www/index.html`, con la finestra grande come il riquadro
  (189×118 sul Samsung S25), misura il cartello in ogni stato della guida e lo confronta con
  `test/fixtures/pip-layout.json`.

## Il golden
`test/fixtures/golden.json` è il comportamento dell'app registrato su 7 percorsi GPS fissi
(`test/fixtures/scenarios.json`): schermata, avvisi, vibrazioni e storico, posizione per posizione.
`test/golden.test.js` lo confronta con `core/`. Se cambi un comportamento di proposito, il test fallisce:
rigenera il golden e controlla che le differenze siano solo quelle volute.
1. `npm run build`, poi `npm run serve` e apri `http://localhost:5173/`.
2. Nella console: `(await import('/tools/golden-harness.mjs?' + Date.now())).run('golden-check.json')`
   (la prima volta ricarica la pagina con le impostazioni del collaudo: eseguilo di nuovo).
3. `node tools/compare-golden.mjs test/fixtures/golden.json test/fixtures/golden-check.json` mostra le differenze.
4. Se sono quelle volute: `run('golden.json')` e commit.
