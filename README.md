# Tutor A1 e A4

Pagina web e app Android che seguono i tratti con controllo della velocità media (Tutor) sulla A1 e
sulla A4 e calcolano la tua media nel tratto, come fa il Tutor.

**Apri l'app:** https://niccomarino.github.io/TutorA1/

## Cosa fa
- Mostra su una mappa gli 83 tratti Tutor: 59 sulla A1 da Milano a Napoli, con le diramazioni di
  Roma e la Variante di Valico, e 24 sulla A4 tra Milano e Brescia e tra Venezia e Trieste.
- In guida segue la posizione GPS. Avvisa prima del portale di inizio e calcola la media mentre sei
  nel tratto. Dice a quanto puoi andare per chiuderlo sotto la soglia e allarma con voce, suoni e
  vibrazione se la media la supera.
- Tiene lo storico dei tratti percorsi, con la media e l'esito.
- Ha una simulazione per provarla senza guidare.
- Nell'app Android, quando esci per usare Maps o Waze resta un riquadro con il cartello del Tutor
  (Picture-in-Picture), e il GPS continua anche a schermo spento.

## Come si usa
- **Dal browser del telefono:** apri il link qui sopra e premi "Avvia guida". Il GPS funziona solo
  sulle pagine https, quindi non aprendo il file dalla memoria del telefono.
- **App Android:** si compila da questo repository (vedi sotto). Non è sul Play Store.

## Come calcola
- Come il Tutor, divide la strada percorsa dal portale di inizio per il tempo trascorso.
- Sulla velocità misurata la legge applica una riduzione del 5%, e comunque non meno di 5 km/h. Con
  limite 130 la soglia di sanzione è quindi 136,8 km/h, con 110 è 115,7, con 90 è 95. È una
  tolleranza per gli errori di misura, non un margine garantito.
- Se entri dopo il portale di inizio o esci prima di quello di fine, la media è segnata come parziale.

## Attenzione
- È uno strumento di aiuto: valgono sempre i cartelli e il limite indicato sulla strada.
- L'accensione del Tutor dipende dalla Polizia Stradale: un tratto segnato qui può essere spento.
- La posizione dei portali è ricavata dal chilometro ufficiale: l'errore tipico è di circa 100 metri,
  fino a 250. Sulle diramazioni di Roma e sulla Variante di Valico la stima è meno precisa.

## Fonti dei dati
- Tratti della A1 e della A4 Milano–Brescia: autostrade.it, pagina "Il Tutor" (consultata il
  29 settembre 2026).
- Tratti della A4 Venezia–Trieste: infoviaggiando.it di Autostrade Alto Adriatico (consultata il
  30 settembre 2026).
- Tracciato delle carreggiate e mappa di sfondo: © contributori OpenStreetMap (ODbL).
- Chilometriche di caselli e cantieri: dati di viabilità di Autostrade per l'Italia.

## Per chi sviluppa
Serve Node 22. Per l'app Android servono anche Android Studio (SDK) e Java 21.

```bash
npm ci
npm test
npm run build
```

- `npm test` esegue i test, compreso il "golden": il comportamento registrato su 7 percorsi GPS
  fissi, che ogni modifica deve riprodurre identico.
- `npm run build` ricostruisce `index.html` (la pagina di GitHub Pages) e `www/` (l'app) da `src/`.
  Non modificare `index.html` a mano.
- `npm run serve` apre un server su http://localhost:5173 per provare la pagina.
- `npm run sync` prepara l'app Android. Poi, dalla cartella `android/`, `./gradlew installDebug`
  la installa sul telefono collegato via USB. Con `-Pprova=true` si installa invece una copia
  separata, "Tutor prova", accanto all'app normale.
- `npm run device-check` collauda sul telefono l'uscita dall'app e il riquadro sopra Maps.

Il codice è diviso tra `src/core/` (calcolo, provato con i test, senza pagina) e `src/ui/` (pagina e
mappa). Struttura, flusso dei dati e dove fare le modifiche: [docs/ARCHITETTURA.md](docs/ARCHITETTURA.md).
Difetti noti e idee: [NOTE-MIGLIORIE.md](NOTE-MIGLIORIE.md).
