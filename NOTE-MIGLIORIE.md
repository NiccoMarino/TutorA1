# Note di collaudo e miglioramenti

Collaudo del 1 ottobre 2026 sul Samsung SM-S931B (Android 15), branch `app-sopra-maps`
(commit `fb76ab8`). Provato con la simulazione, il GPS vero (da fermo, in casa), il riquadro
Picture-in-Picture e alcune impostazioni del telefono. Non provato: strada vera, voce di Maps o
Waze insieme alla nostra, consumo della batteria, Android 8-11.

## Cosa funziona
- Calcolo della media: in simulazione a 145 km/h il tratto si chiude a 144,9 km/h.
- Allarmi, storico dei tratti, tratto parziale, "Prossimo Tutor": nessuna eccezione JavaScript.
- GPS vero: il servizio in primo piano parte (tipo "posizione") e si ferma con "Esci".
- Riquadro PiP: si apre da solo con Home, si aggiorna, torna a schermo intero senza zoom
  (bug dello zoom risolto in `fb76ab8`).
- Rotazione schermo e tema chiaro/scuro: nessun crash, la pagina resta larga quanto lo schermo.

## Risolti (stesso giorno, commit successivo al collaudo)
- **Tasto Indietro in guida**: ora non chiude l'app né ferma il GPS, apre il riquadro (come Home);
  se il telefono non lo supporta manda l'app in secondo piano. Fuori dalla guida Indietro
  funziona come prima (non verificato sul telefono dopo la modifica).
- **Notifica del servizio GPS**: il permesso notifiche (Android 13+) viene chiesto all'avvio della
  guida, prima di quello della posizione. Verificato: concesso il permesso, la notifica fissa è visibile.
- **X sul riquadro**: chiudere la finestrella termina la guida (come "Esci") e il GPS si ferma.
  Verificato: espandere il riquadro o spegnere lo schermo con il riquadro aperto NON ferma la guida.

## Risolti preparando il Play Store (ramo `play-store`)
- Testo obsoleto: tolti Claude, GitHub Pages e "Scarica l'app come file HTML"; il pannello ora è
  "Dati, precisione e privacy", con link all'informativa e la versione.
- Mappa tolta: niente fornitori di mappe da gestire, l'app non si collega a internet (carattere incluso)
  e pesa 349 kB invece di 528. I tratti sono un elenco con la scheda di ognuno.
- `fontScale` in `configChanges`: cambiare la dimensione del carattere non interrompe più la guida.
- Icona e schermata di avvio proprie al posto di quelle di Capacitor.
- Barra di stato sempre scura con icone chiare: prima, cambiando tema ad app aperta, ora e batteria
  diventavano dello stesso colore dello sfondo. Verificata sul telefono in tema scuro; con il tema chiaro
  è uguale per costruzione (colori fissi), da guardare una volta con il telefono in tema chiaro.
- Schermo orizzontale: in guida cartello a sinistra e numeri a destra, niente più tagliato.

## Cartello circolare (ramo `tutte-le-autostrade`)
- Verticale: cerchio colorato con arco di avanzamento (proposta C3), più grande, niente metà schermo vuota.
- Orizzontale: cartello a tutto schermo con anello (proposta 4); statistiche, consiglio e scelta del limite
  restano nella schermata verticale.
- Riquadro: quadrato, solo il cerchio, trasparente intorno. Resta un'ombra leggera disegnata da Android.
- Velocità da tenere per chiudere entro il limite, sul cartello e nel consiglio, anche sopra il limite. Da provare in autostrada.
- Il collaudo sul telefono gira lo schermo (fase `rotazione`) e poi lo rimette com'era.

## Nuova schermata iniziale (ramo `nuova-home`)
- Schermata iniziale con due cartelli stradali ("Avvia guida" verde, "Prova in simulazione" blu) su una corsia
  disegnata; nome al centro, logo a sinistra, menù a destra.
- Menù con Home, Impostazioni di guida, Simulazione (con l'elenco dei tratti), Storico, Come funziona,
  Privacy e diritti. Indietro (anche quello di Android) richiude pagina e menù in ordine.
- Tema chiaro e scuro con colori "asfalto"; nelle impostazioni: come il telefono, chiaro o scuro.

## Tutte le autostrade di Autostrade per l'Italia (ramo `tutte-le-autostrade`)
- 103 tratti in più, presi dalla pagina "Il Tutor" di autostrade.it il 2 ottobre 2026: A7, A8, A9, A10, A11, A13,
  A14, A16, A23, A26, A27 e A30. In tutto 186 tratti su 14 autostrade.
- Dati ricavati da `tools/make-tratti.mjs`: tracciato da OpenStreetMap, chilometri interpolati tra webcam, aree di
  servizio e caselli di Autostrade per l'Italia. Provato sulla A1, dove i dati c'erano già: stessi portali entro 80 m
  di mediana (massimo 290 m, al portale di Lodi, dove il nuovo metodo ha una webcam proprio al km 24).
- Da controllare su strada: i tratti dove i punti di riferimento sono più lontani dai portali (il controllo li
  stampa): A14 tra Foggia e Cerignola (fino a 7 km), Bari Sud, Predosa sulla A26, Padova Zona Industriale.
- Elenco: il filtro per autostrada è un menù a tendina. Tolto il tracciato di ogni tratto (`g`), che serviva
  solo alla mappa: la pagina resta sotto i 450 kB.

## Da sistemare, in ordine di importanza

1. **Carattere grande (accessibilità)**: con scala 1,4 il pulsante "Audio" usciva dallo
   schermo (da riprovare ora che la guida usa tutto lo schermo). Cambiare la dimensione del carattere
   durante la guida ricreava l'activity (risolto, da riprovare sul telefono).
2. **Riquadro PiP, stato "fuori dalle autostrade seguite"**: il titolo "Il monitoraggio parte quando entri
   in un'autostrada…" viene tagliato. Serve un testo breve per il riquadro. Confermato dal
   collaudo del riquadro (`test/fixtures/pip-layout.json`, `titleCut: true`): a 189×118 sono
   tagliati anche i tratti con nomi lunghi (es. "Casalpusterlengo → Piacenza Nord") e il
   titolo di "Nessun Tutor più avanti".

## Piccole cose
- Favicon mancante: 404 in console (`https://localhost/favicon.ico`). Basta un
  `<link rel="icon" href="data:,">` nella build.
- Da fermo e senza segnale buono (in casa, precisione 100 m) l'app mostra 12-15 km/h
  invece di 0. Idea: ignorare la velocità sotto i 3 km/h oppure quando la precisione è
  oltre 50 m.
- `android:allowBackup="true"`: lo storico dei tratti finirebbe nei backup di Google.
  Decidere se va bene.
- `npm audit`: 3 avvisi moderati, solo nel CLI di Capacitor (strumento di sviluppo, non
  finisce nell'app).

## Idee e aggiornamenti sensati
- **Voce e Maps/Waze**: la nostra voce non chiede il "focus audio", quindi può parlare sopra
  la voce di Maps. Provare con navigazione attiva e valutare l'abbassamento del volume
  (ducking) o la coda dei messaggi.
- **Notifica "live"** con prossimo portale e media nel tratto (alternativa o aggiunta al
  riquadro), con il pulsante "Termina guida".
- **Overlay fluttuante** vero (permesso "mostra sopra altre app"): più pratico del PiP ma
  più invasivo; Android 12+ ha limiti su questi overlay.
- **Prova su strada**: GPS vero, gallerie (il controllo "segnale assente" c'è ma non è stato
  provato), consumo di batteria in 1 ora di guida, voce e vibrazione.
- **Pubblicazione**: preparata, vedi `docs/play-store/PUBBLICAZIONE.md`.
- **Android 8-11**: il riquadro usa `onUserLeaveHint` invece dell'apertura automatica;
  non è stato provato.
- **Spazio su disco**: il disco C: del PC è quasi pieno (circa 5 GB liberi), l'emulatore
  non parte per questo.

## Come ho collaudato (per ripeterlo)
Con il telefono collegato via USB: `adb forward tcp:9333 localabstract:webview_devtools_remote_<pid>`
permette di leggere e comandare la pagina dentro l'app (stato in `window.__tutor`).
Per compilare serve Java 21 (non quello di Android Studio) e va tenuto AGP 8.13.0 / Gradle 8.14.3.
