# Verifica legale e di correttezza (20 punti)

Controllo fatto il 5 ottobre 2026 sulla versione del ramo `tutte-le-autostrade`. Per ogni punto: cosa vuol dire
per TutOK, cosa c'è e cosa manca. Non è un parere legale: prima di vendere l'abbonamento è consigliata
una lettura di un avvocato (termini, abbonamento) e di un commercialista (tasse, partita IVA).

Stato: **Fatto**, **Non serve** (con il motivo), **Da fare** (serve una tua decisione o un tuo dato).

| # | Punto | Stato | Dove |
|---|---|---|---|
| 1 | Informativa privacy | Fatto | `privacy.html` |
| 2 | Termini d'uso | Fatto | `termini.html` |
| 3 | Rimborsi | Da fare quando si vende | `docs/legale/ABBONAMENTO-BOZZA.md` |
| 4 | Cookie policy | Fatto | sezione Cookie di `privacy.html` |
| 5 | Banner dei cookie | Non serve | nessun cookie, solo memoria tecnica |
| 6 | Consenso | Fatto | permessi chiesti da Android |
| 7 | Niente dati inutili | Fatto | permesso internet tolto |
| 8 | Librerie di terzi | Fatto | elenco qui sotto |
| 9 | Schemi ingannevoli | Fatto | nessuno; regole per l'abbonamento |
| 10 | Costi nascosti | Fatto | nessun costo; regole per l'abbonamento |
| 11 | Recensioni false | Fatto | nessuna |
| 12 | Promesse non dimostrabili | Fatto | scheda dello store, consiglio di guida |
| 13 | Testo alternativo | Fatto | test |
| 14 | Contrasto | Fatto | test e collaudo sul telefono |
| 15 | Tastiera | Fatto | test |
| 16 | Dati di chi pubblica | Fatto per ora | email; da rivedere quando si vende |
| 17 | Età | Fatto | 18 anni e oltre |
| 18 | Disiscrizione dalle email | Non serve | l'app non manda email |
| 19 | Licenze di caratteri e immagini | Fatto | app, Privacy e diritti, Licenze |
| 20 | Cancellazione dei dati | Fatto | pulsante nell'app |

## I punti uno per uno

**1. Informativa privacy.** C'era già (`privacy.html`, linkata da app e Play Store). Aggiunti cookie, sito su
GitHub Pages (GitHub registra gli IP per sicurezza) e il nuovo pulsante di cancellazione.

**2. Termini d'uso.** Nuovo `termini.html`: le stime non sono misure ufficiali e non garantiscono di evitare
sanzioni; la velocità da tenere non autorizza a superare il limite, che vale sempre; niente telefono in mano alla
guida (art. 173 del Codice della Strada); 18 anni; responsabilità nei limiti di legge, senza toccare i diritti dei
consumatori; legge italiana e giudice del consumatore. Linkati dall'app e dall'informativa.
Alla prima apertura l'app mostra l'avviso "Prima di partire" (`#pAvviso`) con i punti principali: non invita a
superare i limiti, portali e dati possono contenere errori, chi guida è l'unico responsabile e, nei limiti di legge,
l'app non risponde di multe e danni. Va accettato per usare l'app; si rilegge da Privacy e diritti. Se il testo
cambia, si aumenta `DISCLAIMER_VERSION` in `src/core/store.js` e ricompare una volta.
Autovelox: l'app segnala le postazioni fisse dell'elenco pubblico della Polizia Stradale (pagina articolo/175,
elenco del 7 ottobre 2025). Segnalarle è lecito: la Polizia le pubblica perché si rispettino i limiti, e il Codice
della Strada (art. 142, comma 6-bis) chiede che le postazioni siano segnalate e ben visibili. Avviso iniziale,
termini e Fonti dicono che l'elenco può non essere aggiornato; l'avviso iniziale è alla versione 2.

**3. Rimborsi.** Oggi non si vende niente, quindi pubblicare una politica di rimborso confonderebbe. La bozza è
pronta per l'abbonamento da 2 € all'anno: prezzo IVA inclusa, rinnovo, disdetta, recesso e rimborso entro 14 giorni.

**4-5. Cookie e banner.** Né l'app né il sito usano cookie. Impostazioni e storico stanno nella memoria del
telefono o del browser solo per far funzionare l'app: sono strumenti tecnici, per i quali le linee guida del
Garante non chiedono consenso, quindi niente banner. Un banner inutile sarebbe solo un fastidio. Un test controlla
che la pagina non scriva cookie. Se un giorno arrivano statistiche o pubblicità, il banner diventa obbligatorio.

**6. Consenso.** La posizione e le notifiche le chiede Android con le sue finestre, al primo "Avvia guida". Fuori
dalla guida la posizione non viene letta.

**7. Niente dati inutili.** L'app non raccoglie dati. Tolto il permesso INTERNET, che restava da Capacitor ma non
serviva: l'app non si collega a nessun server, e ora lo garantisce anche Android. Restano posizione, servizio in
primo piano per la posizione, notifica e vibrazione, tutti usati. Non chiede la posizione in background.

**8. Librerie di terzi.** Nessuna libreria di statistiche, pubblicità o crash report.

| Libreria | A cosa serve | Manda dati? |
|---|---|---|
| Capacitor (Ionic) | ponte tra pagina e Android | no |
| background-geolocation | posizione con lo schermo spento | no; usa i servizi di localizzazione di Google Play, come ogni app con il GPS |
| keep-awake | schermo acceso in guida | no |
| text-to-speech | avvisi vocali, con la voce del telefono | no |
| haptics | vibrazione | no |
| AndroidX | componenti standard di Android | no |

**9-10. Schemi ingannevoli e costi nascosti.** Nessuno oggi: niente acquisti, niente scelte già selezionate per
spingere qualcosa. Per l'abbonamento le regole sono nella bozza: prezzo e rinnovo accanto al pulsante, disdetta
facile, niente conti alla rovescia o funzioni tolte senza avviso.

**11. Recensioni false.** Nessuna recensione o valutazione nell'app, nella scheda o nelle immagini dello store.
Ai tester del test chiuso va chiesto un parere sincero, mai una recensione in cambio di qualcosa.

**12. Promesse non dimostrabili.**
- Nella scheda dello store "calcola la media come il Tutor" è diventato "stima la media con il GPS, con lo stesso
  metodo del Tutor".
- Aggiunto che le stime non garantiscono di evitare sanzioni e che il limite vale sempre.
- La precisione dei portali ora dice "di solito entro 100 metri".
- Il consiglio "Fino al portale puoi tenere 141 km/h" invitava a superare il limite, che vale in ogni momento
  (art. 142 del Codice della Strada). Ora il cartello mostra ancora "≤ 141", ma il consiglio dice "Con il limite di
  130 chiudi in regola". I termini d'uso dicono che la velocità da tenere non autorizza a superare il limite.

**13. Testo alternativo.** L'app non ha immagini `<img>`: icone e loghi sono disegni con `aria-hidden`, e i
pulsanti con solo l'icona hanno un nome (`aria-label`). Un test lo controlla a ogni build.

**14. Contrasto.** Testi ad almeno 4,5:1 in tema chiaro e scuro e sui quattro colori del cartello; pulsanti da
48 px. Lo controllano i test e il collaudo sul telefono, schermata per schermata.

**15. Tastiera.** Sul sito tutto quello che si tocca è un pulsante, un collegamento o un campo vero, quindi
raggiungibile con Tab; il bordo di messa a fuoco è visibile; nessun ordine di tabulazione forzato. Un test lo controlla.

**16. Dati di chi pubblica.** Pubblichi come persona, senza indirizzo né telefono. Finché l'app è gratuita
basta così: informativa, termini, app e scheda indicano lo sviluppatore e l'email di contatto.

Quando arriverà l'abbonamento, Google chiederà se sei un "operatore commerciale" (Digital Services Act). A chi lo è
fa mostrare nella scheda anche indirizzo e telefono. Una persona che vende un abbonamento in modo continuativo di
solito lo è: va valutato con il commercialista. Se sì, si può usare un indirizzo di domiciliazione o una casella
postale e un numero dedicato, invece di quelli di casa.

**17. Età.** App per chi guida, non rivolta ai minori di 18 anni: è scritto in informativa e termini, e nella
Play Console la fascia d'età è "18 anni e oltre" (`docs/play-store/MODULI.md`). Non ci sono account, quindi niente
consenso dei genitori da raccogliere.

**18. Disiscrizione dalle email.** L'app non manda email e non ha newsletter. Se un giorno ci sarà, ogni email
avrà il link per disiscriversi e servirà il consenso prima dell'iscrizione.

**19. Licenze.**
- **Carattere:** Figtree, SIL Open Font License.
- **Software:** Capacitor e plugin con licenza MIT, AndroidX con Apache 2.0.
- **Testi completi:** sono dentro l'app, in Privacy e diritti, Licenze. La build li prende dalle librerie
  installate e un test controlla che ci siano.
- **Tracciati:** © contributori OpenStreetMap, con licenza ODbL. I dati derivati sono pubblici nel repository, con la
  stessa licenza: va bene finché il repository resta pubblico.
- **Immagini:** icona e grafica sono fatte da noi (`tools/make-icons.mjs`).
- **Tratti e chilometri:** vengono dalle pagine pubbliche di Autostrade per l'Italia e di Autostrade Alto Adriatico,
  citate come fonti. Sono dati di fatto, ma se un giorno la vendita crescesse conviene chiedere un parere sull'uso
  di questi dati in un'app a pagamento.

**20. Cancellazione dei dati.** Tutto quello che l'app conserva è sul telefono. Nuovo pulsante "Cancella storico e
impostazioni" in Privacy e diritti, con conferma, oltre a "Cancella lo storico" e alla disinstallazione. Lo
sviluppatore non ha dati di nessuno da cancellare; resta l'email per qualsiasi richiesta.
