# MediaVelocità: Tutor A1, A4 e altre autostrade

Pagina web e app Android che seguono i tratti con controllo della velocità media (Tutor) su 14 autostrade
e calcolano la tua media nel tratto, come fa il Tutor.

**Apri l'app:** https://niccomarino.github.io/TutorA1/

## Cosa fa
- Elenca i 186 tratti Tutor, con portali, lunghezza e tempi minimi: 59 sulla A1 da Milano a Napoli, con le diramazioni di
  Roma e la Variante di Valico, 24 sulla A4 tra Milano e Brescia e tra Venezia e Trieste, e 103 su A7, A8, A9, A10,
  A11, A13, A14, A16, A23, A26, A27 e A30 (tutti quelli indicati da Autostrade per l'Italia).
- In guida segue la posizione GPS. Avvisa prima del portale di inizio e calcola la media mentre sei
  nel tratto. Dice a quanto puoi andare per chiuderlo con la media entro il limite e allarma con voce,
  suoni e vibrazione se la media supera la soglia.
- Schermata di guida con un cartello circolare: media al centro, arco di avanzamento nel tratto e velocità da
  tenere in basso. Con il telefono in orizzontale il cartello prende tutto lo schermo.
- Tiene lo storico dei tratti percorsi, con la media e l'esito.
- Ha una simulazione per provarla senza guidare.
- Nell'app Android, quando esci per usare Maps o Waze resta un riquadro con il solo cerchio del cartello
  (Picture-in-Picture, trasparente intorno al cerchio), e il GPS continua anche a schermo spento.

## Come si usa
- **Dal browser del telefono:** apri il link qui sopra e premi "Avvia guida". Il GPS funziona solo
  sulle pagine https, quindi non aprendo il file dalla memoria del telefono.
- **App Android (MediaVelocità):** si compila da questo repository (vedi sotto). La pubblicazione sul Play Store
  è in preparazione: guida in [docs/play-store/PUBBLICAZIONE.md](docs/play-store/PUBBLICAZIONE.md).

## Come calcola
- Come il Tutor, divide la strada percorsa dal portale di inizio per il tempo trascorso.
- Sulla velocità misurata la legge applica una riduzione del 5%, e comunque non meno di 5 km/h. Con
  limite 130 la soglia di sanzione è quindi 136,8 km/h, con 110 è 115,7, con 90 è 95. È una
  tolleranza per gli errori di misura, non un margine garantito.
- Se entri dopo il portale di inizio o esci prima di quello di fine, la media è segnata come parziale.

## Attenzione
- È uno strumento di aiuto: valgono sempre i cartelli e il limite indicato sulla strada.
- L'accensione del Tutor dipende dalla Polizia Stradale: un tratto segnato qui può essere spento.
- La posizione dei portali è ricavata dal chilometro ufficiale: su A1 e A4 l'errore tipico è di circa 100 metri,
  fino a 250, e sulle diramazioni di Roma e sulla Variante di Valico la stima è meno precisa. Sulle altre autostrade
  il chilometro è interpolato tra webcam, aree di servizio e caselli di posizione nota: di solito l'errore resta
  sotto i 100 metri, di più dove questi punti sono lontani tra loro.

## Privacy
La posizione resta sul telefono e lo storico è salvato solo lì: [informativa](https://niccomarino.github.io/TutorA1/privacy.html).

## Fonti dei dati
- Tratti della rete di Autostrade per l'Italia: autostrade.it, pagina "Il Tutor" (consultata il
  29 settembre 2026 per A1 e A4 Milano–Brescia, il 2 ottobre 2026 per le altre autostrade).
- Tratti della A4 Venezia–Trieste: infoviaggiando.it di Autostrade Alto Adriatico (consultata il
  30 settembre 2026).
- Tracciato delle carreggiate, usato per riconoscere strada e direzione: © contributori OpenStreetMap (ODbL).
- Carattere Overpass (SIL Open Font License), incluso nella pagina: l'app non si collega a internet.
- Chilometriche di caselli, cantieri, webcam e aree di servizio: dati di viabilità di Autostrade per l'Italia.
  `node tools/make-tratti.mjs` le scarica insieme al tracciato e ricostruisce le autostrade dopo la A4.

## Per chi sviluppa
Serve Node 22. Per l'app Android servono anche Android Studio (SDK) e Java 21.

```bash
npm ci
npm test
npm run build
```

- `npm test` esegue i test, compreso il "golden": il comportamento registrato su 9 percorsi GPS
  fissi, che ogni modifica deve riprodurre identico.
- `npm run build` ricostruisce `index.html` (la pagina di GitHub Pages) e `www/` (l'app) da `src/`.
  Non modificare `index.html` a mano.
- `npm run serve` apre un server su http://localhost:5173 per provare la pagina.
- `npm run sync` prepara l'app Android. Poi, dalla cartella `android/`, `./gradlew installDebug`
  la installa sul telefono collegato via USB. Con `-Pprova=true` si installa invece una copia
  separata, "Tutor prova", accanto all'app normale.
- `npm run device-check` collauda sul telefono le schermate, la guida simulata in tutti i tratti, l'uscita
  dall'app e il riquadro sopra Maps.
- `npm run bundle` crea l'AAB firmato per il Play Store (serve `android/keystore.properties`).
- `npm run grafica` rifà icona, schermata di avvio e immagini per lo store.

Il codice è diviso tra `src/core/` (calcolo, provato con i test, senza pagina) e `src/ui/` (pagina). Struttura, flusso dei dati e dove fare le modifiche: [docs/ARCHITETTURA.md](docs/ARCHITETTURA.md).
Difetti noti e idee: [NOTE-MIGLIORIE.md](NOTE-MIGLIORIE.md).
