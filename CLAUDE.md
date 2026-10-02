# Tutor A1/A4

App (pagina web + app Android Capacitor) che segue i tratti Tutor di 14 autostrade (A1, A4 e le altre
di Autostrade per l'Italia) e la velocità media.
Struttura e flusso dei dati: `docs/ARCHITETTURA.md`. Difetti noti e idee: `NOTE-MIGLIORIE.md`.

## Comandi
- `npm test`: test Node (`test/*.test.js`), compreso il golden su `core/`.
- `npm run build`: ricostruisce `index.html` (browser, GitHub Pages) e `www/` (app). Da committare.
- `npm run serve`: server su http://localhost:5173 per provare la pagina e registrare il golden.
- `npm run sync`: build + `npx cap sync`. Poi `cd android && ./gradlew installDebug -Pprova=true` con Java 21
  (`JAVA_HOME="/c/Program Files/Java/jdk-21"`): installa la copia "Tutor prova" senza toccare l'app normale.
- `npm run device-check`: collaudo sul telefono (schermate, tutti i tratti, uscita dall'app, riquadro sopra Maps).
  `-- --solo pagina` o `-- --solo uscite` per una fase sola, `-- --gps` per il GPS vero.
- `npm run bundle`: AAB firmato per il Play Store (chiave in `android/keystore.properties`, mai in git).
- `npm run grafica`: icona, avvio e immagini dello store (`tools/make-icons.mjs`, `tools/store-screenshots.mjs`).
- Pubblicazione sul Play Store: `docs/play-store/PUBBLICAZIONE.md`.

## Regole
- Non modificare `index.html` a mano: si modifica `src/` e si esegue `npm run build`.
- `src/core/` non usa `document` né `window`.
- La pagina non scarica niente da internet (un test lo controlla): niente mappa, carattere incluso.
- Non cambiare le chiavi di localStorage né gli id usati da `native/tutor-native.js`.
- Testi, commenti e commit in italiano.
- La versione è solo in `package.json` (pagina e app la leggono da lì): `npm version patch` per ogni aggiornamento.
- Nome dell'app: MediaVelocità, in `strings.xml`, `capacitor.config.json` e `APP_NAME` di `src/platform.js`.
