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
  Finché non è accettato, l'app parte dall'avviso `#pAvviso` (`createNav({start})`); l'accettazione è nella chiave
  `tutorA1.v1.avviso` con il numero `DISCLAIMER_VERSION` di `core/store.js`, da aumentare se cambia il testo.
- Autovelox fissi: elenco in `tools/autovelox.json` (istruzioni in `tools/autovelox.md`). `make-tratti` scrive in
  `tutor-data.json` la lista `velox` (ramo, km, verso). Il tracker emette `velox-alert` a 500 m e `velox-over`
  oltre il limite (`updateVelox`). La vista `velox` va nella riga in alto e nell'etichetta `#pVelox` del cerchio.
  `settings.veloxOff` li spegne.
  Un elemento con `data-go="id"` apre quella schermata, `data-back` torna indietro; la cronologia è in
  `ui/nav.js`. Il tasto Indietro di Android chiede prima alla pagina (`window.tutorBack`, da `MainActivity.java`).
- Tema: `settings.theme` (`auto`, `light`, `dark`), applicato da `ui/theme.js` con `data-theme` su `<html>`;
  i colori sono in cima a `styles/app.css`. La schermata di guida resta scura in entrambi i temi.
  Il carattere Figtree è dentro la pagina (`scripts/build.mjs`), quindi l'app non si collega a internet.
- Versione: `package.json`; la build la scrive nella pagina, `android/app/build.gradle` ne ricava versionName e versionCode.
- Icona, avvio e immagini dello store: `tools/make-icons.mjs` e `tools/store-screenshots.mjs` (`npm run grafica`).
- Cartello di guida e sue tre forme (verticale, orizzontale, riquadro): sezione "Il cartello di guida" qui sotto.
- Colori del cartello scelti dall'utente (giallo da, rosso e allarme da): `colorLimits` in `core/rules.js`,
  menù in `ui/settings-panel.js`.
- Pagine legali: `privacy.html` e `termini.html` nella radice (servite da GitHub Pages, linkate dall'app);
  verifica dei 20 punti e bozza dell'abbonamento in `docs/legale/`. Le licenze nell'app (Privacy e diritti)
  le genera la build (`licensesHtml` in `scripts/build.mjs`) dai file LICENSE delle librerie; per aggiungere una
  libreria all'app va aggiunta a `LICENSED`. "Cancella storico e impostazioni": `clearAll` in `core/store.js`.
- Ottimizzazioni: l'aggancio alla strada (`matchPoint`) scorre tutti i segmenti con un filtro per
  riquadro; se servisse più velocità, un indice spaziale va costruito in `buildNetwork`.

## Il cartello di guida
Un solo markup (`#plate` in `src/index.html`) per tre forme, scelte solo dallo stile:

| Forma | Quando | Stile |
|---|---|---|
| verticale: nome del tratto sopra, cerchio colorato con arco aperto, media al centro, velocità da tenere nell'apertura | telefono dritto, computer | `styles/cartello.css` |
| orizzontale: cartello a tutto schermo, nome a sinistra, anello intero con la media, velocità da tenere e km mancanti a destra | telefono girato (altezza fino a 560 px) | `styles/orizzontale.css` |
| riquadro: solo il cerchio, trasparente intorno | riquadro sopra Maps (classe `pip` su `<html>`) | `styles/pip.css` |

- Guidando col GPS (telefono dritto, tablet, computer) la schermata è ferma e alta quanto lo schermo (fondo di
  `styles/cartello.css`): il cerchio prende lo spazio che resta, al massimo 46vh e mai più della larghezza, almeno 150px;
  se non ci sta neanche così scorre solo la guida. Sotto i 640px di altezza spariscono la frase sotto il cerchio e il
  consiglio scritto sotto i numeri (ripete la velocità da tenere del cerchio); in verticale sotto i 560px (4") i numeri
  vanno su due colonne senza "limite impostato", gli spazi si stringono e l'ultimo messaggio sta su una riga; sotto i
  340px di larghezza sparisce la parola "Limite". In simulazione la pagina scorre, per i comandi sotto. Misure diverse dal
  telefono di prova: `npm run schermi` (`tools/schermi.mjs`, casi e giudizio in `tools/schermi-casi.mjs`).
- Testi e numeri: `core/hud-view.js` (`plate`, `keep`, `gauge`, `progress`); `ui/hud.js` (`renderPlate`) li scrive.
- Velocità da tenere: `keepText` in `core/metrics.js`.
  - È la velocità che fa chiudere il tratto con la media entro il limite; se non basta più, quella per restare in
    tolleranza; da 200 km/h in su il tratto è "ormai in regola".
  - Non va mai sopra il limite ("≤ 130" anche quando il calcolo darebbe 141), perché il limite vale in ogni momento
    (`docs/legale/VERIFICA.md`, punto 12). Il consiglio scritto (`adviceText`) usa lo stesso numero, e sopra il
    limite dice "Con il limite di 130 chiudi in regola".
  - Il numero calcolato anche sopra il limite si vede solo con `settings.keepReal`: l'opzione in Impostazioni di guida
    è spenta, e per accenderla si passa sempre dall'avviso `#pOltre` ("la responsabilità è tua"), da accettare con
    "Ho capito, attiva" (`ui/settings-panel.js`).
- Riquadro trasparente: `MainActivity` rende trasparenti finestra, vista principale e WebView nel riquadro, e lo
  rifà a ogni cambio di configurazione perché il plugin SystemBars di Capacitor rimette lo sfondo pieno.
- Nella pagina lo stile arriva senza commenti (`stripCssComments` in `scripts/build.mjs`): nei sorgenti restano.

## Contratto con il ponte nativo
`native/tutor-native.js` usa `#hudExit`, `#hudMute`, la classe `driving` sul body e mette la classe
`pip` su `<html>` (stile in `src/styles/pip.css`). Un test in `test/build.test.js` controlla gli id.

## Collaudo sul telefono e del riquadro sopra Maps
- Sul telefono: `./gradlew installDebug -Pprova=true` installa "Tutor prova" accanto all'app normale, poi
  `npm run device-check`. Tre fasi, che vanno avanti anche se una fallisce:
  - `pagina` (solo JavaScript tramite DevTools, un paio di minuti): l'app installata è l'ultima build, ogni
    schermata in tema chiaro e scuro (niente fuori schermo, contrasto, valori come NaN), elenco e filtri,
    impostazioni che restano dopo il riavvio, guida simulata in tutti i tratti a 125, 131, 137,5 e 200 km/h
    nella WebView vera (inizio dal portale, allarmi, media, annuncio di fine, tempi), storico.
  - `rotazione`: guida simulata con il telefono girato (`wm user-rotation`): in orizzontale cartello a tutto
    schermo con anello e velocità da tenere a destra, statistiche nascoste, niente fuori schermo, guida che continua
    senza ricaricare la pagina; poi di nuovo dritto. La rotazione torna com'era anche se il collaudo si interrompe.
  - `uscite`: Home e Indietro fuori e dentro la guida, pulsante Riquadro, riquadro sopra Google Maps che si
    aggiorna e passa all'allarme con lo schermo acceso, ritorno a schermo intero, X del riquadro che termina la guida.
  `-- --solo pagina` (o `rotazione`, `uscite`) per una fase sola, `-- --gps` per provare anche il GPS vero, `-- --completo`
  per aspettare anche il tempo di spegnimento dello schermo. Gli errori JavaScript della pagina sono raccolti
  per tutto il collaudo, con la fase in cui sono comparsi (", riavvio" se durante il riavvio della pagina fatto dal
  collaudo: lì un errore di Capacitor sulle barre di sistema è solo una nota). Schermate (anche una per ogni errore) e risultati in `device-check/`.
  Le funzioni che girano dentro la pagina sono in `tools/device-page.mjs`: si possono provare anche nel browser.
  La X si tocca in una posizione misurata sul menu del riquadro di One UI; su un altro telefono il collaudo
  ripiega sul trascinamento e lo scrive nel dettaglio del controllo.
- Nel browser: `tools/pip-harness.mjs` su `/www/index.html`, con la finestra grande come il riquadro
  (quadrato, 153×153 sul Samsung S25), misura il cerchio del cartello in ogni stato della guida e lo confronta
  con `test/fixtures/pip-layout.json`.

## Il golden
`test/fixtures/golden.json` è il comportamento dell'app registrato su 9 percorsi GPS fissi
(`test/fixtures/scenarios.json`): schermata, avvisi, vibrazioni e storico, posizione per posizione.
`test/golden.test.js` lo confronta con `core/`. Se cambi un comportamento di proposito, il test fallisce:
rigenera il golden e controlla che le differenze siano solo quelle volute.
1. `npm run build`, poi `npm run serve` e apri `http://localhost:5173/`.
2. Nella console: `(await import('/tools/golden-harness.mjs?' + Date.now())).run('golden-check.json')`
   (la prima volta ricarica la pagina con le impostazioni del collaudo: eseguilo di nuovo).
3. `node tools/compare-golden.mjs test/fixtures/golden.json test/fixtures/golden-check.json` mostra le differenze.
4. Se sono quelle volute: `run('golden.json')` e commit.
