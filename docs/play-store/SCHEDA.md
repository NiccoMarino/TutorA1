# Scheda dello store (Play Console > Presenza nello store > Scheda principale)

Testi pronti da copiare. Lingua: italiano (it-IT). I limiti di lunghezza sono quelli di Google e i testi
qui sotto li rispettano (`node tools/check-scheda.mjs` li conta).

## Nome dell'app (max 30)
<!-- campo: nome -->
MediaVelocità

## Descrizione breve (max 80)
<!-- campo: breve -->
La tua velocità media nei tratti Tutor in autostrada, con avvisi vocali

## Descrizione completa (max 4000)
<!-- campo: completa -->
MediaVelocità ti dice qual è la tua velocità media nei tratti controllati dal Tutor in autostrada, mentre guidi, e ti avvisa prima che superi la soglia.

COSA FA
• Riconosce da sola l'autostrada, la direzione e il prossimo tratto controllato.
• Ti avvisa prima del portale di inizio e ti dice quanto è lungo il tratto.
• Nel tratto stima la media con il GPS, con lo stesso metodo del Tutor: strada percorsa dal portale di inizio diviso il tempo trascorso.
• Ti indica la velocità da tenere fino al portale per chiudere il tratto con la media entro il limite.
• Il cartello diventa giallo e poi rosso alle soglie che scegli tu; in rosso ti avvisa anche con voce, suoni e vibrazione.
• Tiene lo storico dei tratti percorsi, con media ed esito.

USALA INSIEME AL NAVIGATORE
Durante la guida puoi passare al tuo navigatore: MediaVelocità resta visibile in un piccolo riquadro sopra le altre app, con il cartello del tratto e la media, e continua a funzionare anche a schermo spento.

186 TRATTI SU 14 AUTOSTRADE
A1 da Milano a Napoli (con le diramazioni di Roma e la Variante di Valico), A4 tra Milano e Brescia e tra Venezia e Trieste, A7, A8, A9, A10, A11, A13, A14, A16, A23, A26, A27 e A30: tutti i tratti indicati da Autostrade per l'Italia. Si impostano il limite (130, 110, 100, 90, 80 km/h) e le soglie del giallo e del rosso.

PROVALA SENZA GUIDARE
Con "Prova in simulazione" scegli un tratto e una velocità e vedi come si comporta l'app.

PRIVACY
La posizione resta sul telefono: l'app non la invia a nessuno e funziona anche senza internet. Niente account, niente pubblicità, niente statistiche di utilizzo.

DA SAPERE
• La soglia di sanzione tiene conto della riduzione del 5% prevista dalla legge (minimo 5 km/h): con limite 130 è 136,8 km/h. È una tolleranza per gli errori di misura, non un margine garantito.
• Valgono sempre i cartelli e il limite indicato sulla strada. L'accensione dei Tutor dipende dalla Polizia Stradale: un tratto indicato può essere spento.
• Media e velocità da tenere sono stime fatte con il GPS del telefono: possono differire da quelle del Tutor e non garantiscono di evitare sanzioni. Il limite vale in ogni momento, non solo come media.
• La posizione dei portali è ricavata dal chilometro ufficiale, di solito entro 100 metri.
• Non usare il telefono mentre guidi: fissalo a un supporto e lascia che ti avvisi con la voce.

MediaVelocità non è un'app ufficiale di Autostrade per l'Italia, di Autostrade Alto Adriatico né della Polizia di Stato. Fonti dei tratti: autostrade.it e infoviaggiando.it. Tracciato delle autostrade: © contributori OpenStreetMap.

## Note sulla versione 1.0.0 (max 500)
<!-- campo: note -->
Prima versione: 186 tratti Tutor su 14 autostrade, media in tempo reale, avvisi vocali, riquadro sopra il navigatore, storico dei tratti e simulazione. Funziona senza internet.

## Altri campi
- **Categoria:** App > Mappe e navigazione
- **Tag:** navigazione, auto, viaggi (scegli quelli proposti più vicini)
- **Email di contatto:** niccofantini2000@gmail.com
- **Sito web:** https://niccomarino.github.io/TutorA1/
- **Informativa sulla privacy:** https://niccomarino.github.io/TutorA1/privacy.html
- **Termini d'uso** (non c'è un campo nella console; sono linkati nell'app e nell'informativa): https://niccomarino.github.io/TutorA1/termini.html

## Grafica (cartella `docs/play-store/grafica/`)
| Campo di Play Console | File | Misura |
|---|---|---|
| Icona dell'app | `icona-512.png` | 512×512 |
| Grafica di primo piano | `grafica-1024x500.png` | 1024×500 |
| Screenshot del telefono (da 2 a 8) | `schermata-1-home.png` … `schermata-6-tratti.png` | 1080×1920 |

Se cambi l'aspetto dell'app, rifalle con `npm run grafica`. Per tablet non servono schermate se non la pubblichi come app per tablet.
