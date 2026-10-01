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

## Da sistemare, in ordine di importanza

1. **Barra di stato in tema chiaro**: con il telefono in tema chiaro, ora e batteria sono
   bianchi su sfondo bianco (illeggibili). Serve impostare colore e stile della barra di
   stato (plugin `@capacitor/status-bar` o stile nativo) in modo coerente con l'HUD scuro.
2. **Mappa a rischio con OpenStreetMap**: i server `tile.openstreetmap.org` non sono pensati
   per un'app distribuita (regole d'uso, possibili blocchi). Per uso personale va bene;
   per diffonderla serve un fornitore di tile con chiave (MapTiler, Stadia, ecc.).
   Inoltre il controllo "le tile funzionano?" avviene una sola volta all'avvio: se parti
   senza rete, la mappa resta quella vettoriale finché non riavvii. Meglio riprovare
   periodicamente.
3. **Testo obsoleto nell'app**: il pannello "Dati, precisione e uso fuori da Claude" parla
   di Claude e GitHub Pages, e il pulsante "Scarica l'app come file HTML" non ha senso
   dentro l'app (e il download di un file blob nella WebView di Android probabilmente non
   funziona, da verificare). Anche il messaggio di permesso GPS negato in `index.html`
   cita Claude (la build lo sostituisce, ma conviene pulire la sorgente).
4. **Schermo orizzontale**: il cartello è tagliato in basso, statistiche e limiti non si
   vedono. Se si usa il telefono in orizzontale sul supporto, serve un layout dedicato.
5. **Carattere grande (accessibilità)**: con scala 1,4 il pulsante "Audio" esce dallo
   schermo e statistiche e limiti finiscono nascosti sotto la mappa. Inoltre cambiare la
   dimensione del carattere durante la guida ricrea l'activity e perde la guida
   (manca `fontScale` in `configChanges` nel manifest).
6. **Riquadro PiP, stato "fuori dalla A1/A4"**: il titolo "Il monitoraggio parte quando entri
   in una delle…" viene tagliato. Serve un testo breve per il riquadro. Da controllare a
   occhio anche i tratti con nomi molto lunghi.

## Piccole cose
- Favicon mancante: 404 in console (`https://localhost/favicon.ico`). Basta un
  `<link rel="icon" href="data:,">` nella build.
- Icona e schermata di avvio sono quelle predefinite di Capacitor.
- Vista completa della mappa: i nomi delle città si sovrappongono (Novara/Milano/Lodi,
  Reggio/Modena) e la legenda è tagliata in basso dalla riga delle fonti.
- Da fermo e senza segnale buono (in casa, precisione 100 m) l'app mostra 12-15 km/h
  invece di 0. Idea: ignorare la velocità sotto i 3 km/h oppure quando la precisione è
  oltre 50 m.
- `android:allowBackup="true"`: lo storico dei tratti finirebbe nei backup di Google.
  Decidere se va bene.
- `indexA1.html` è una copia più vecchia (solo A1) che l'app non usa: tenerla allineata o
  toglierla.
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
- **Pubblicazione**: ora l'APK è di debug. Per distribuirlo servono una chiave di firma, un
  numero di versione da aumentare e un APK/AAB "release". Se si va sul Play Store: scheda
  con spiegazione dell'uso della posizione e valutazione delle regole sulle app di
  controllo velocità.
- **Android 8-11**: il riquadro usa `onUserLeaveHint` invece dell'apertura automatica;
  non è stato provato.
- **Spazio su disco**: il disco C: del PC è quasi pieno (circa 5 GB liberi), l'emulatore
  non parte per questo.

## Come ho collaudato (per ripeterlo)
Con il telefono collegato via USB: `adb forward tcp:9333 localabstract:webview_devtools_remote_<pid>`
permette di leggere e comandare la pagina dentro l'app (stato in `window.__tutor`).
Per compilare serve Java 21 (non quello di Android Studio) e va tenuto AGP 8.13.0 / Gradle 8.14.3.
