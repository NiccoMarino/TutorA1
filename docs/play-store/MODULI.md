# Risposte ai moduli di Play Console (Monitora e migliora > Norme > Contenuti dell'app)

Risposte per la versione 1.0.0: gratis, senza pubblicità, senza account. Se aggiungi la pubblicità
cambiano le sezioni **Annunci** e **Sicurezza dei dati**, e va aggiornato `privacy.html`.
I nomi delle voci possono essere leggermente diversi nella console: conta il significato.

## Norme sulla privacy
URL: `https://niccomarino.github.io/TutorA1/privacy.html`
(la pagina è nel repository, `privacy.html`, e va online quando il ramo è su `main`).

## Accesso alle app
**Tutte le funzionalità sono disponibili senza limitazioni di accesso.**
Se chiede istruzioni per i revisori: "Nessun account. Per provare la guida lontano dall'autostrada:
Prova in simulazione > scegli un tratto > Avvia simulazione."

## Annunci
**No, l'app non contiene annunci.**

## Classificazione dei contenuti (questionario IARC)
- Email: niccofantini2000@gmail.com
- Categoria: **Tutte le altre tipologie di app** (utility, produttività, comunicazione o altro).
- A tutte le domande su violenza, sesso, linguaggio, droghe, gioco d'azzardo: **No**.
- Interazione tra utenti / contenuti generati dagli utenti: **No**.
- Condivide la posizione fisica dell'utente con altri utenti: **No**.
- Acquisti digitali: **No**.
Risultato atteso: PEGI 3 / "Tutti".

## Destinatari e contenuti
- Fascia d'età: **solo 18 anni e oltre** (l'app è per chi guida).
- L'app potrebbe attirare involontariamente i bambini: **No**.

## Sicurezza dei dati
Domande generali:
- L'app raccoglie o condivide dati utente dei tipi richiesti? **Sì** (vedi sotto, per la mappa di sfondo).
- Tutti i dati raccolti sono criptati in transito? **Sì** (solo richieste https).
- Offri agli utenti un modo per richiedere l'eliminazione dei dati? **No**: l'app non conserva dati fuori dal
  telefono (lo storico si cancella dall'app o disinstallandola).

Tipi di dati:
- **Posizione > Posizione approssimativa: raccolta, non condivisa.**
  - Elaborata in modo temporaneo: **Sì**.
  - Obbligatoria (gli utenti non possono scegliere): **Sì**.
  - Scopo: **Funzionalità dell'app**.
  - Perché: per disegnare la mappa l'app scarica da CARTO o OpenStreetMap le immagini della zona visualizzata,
    quindi chi le fornisce vede quella zona. Non è la posizione GPS e non viene conservata dall'app.
- **Posizione precisa: non dichiararla.** È letta e usata solo sul telefono, senza mai essere inviata
  (Google non considera "raccolti" i dati elaborati solo sul dispositivo).
- Tutto il resto (informazioni personali, foto, contatti, identificatori, attività nelle app, dati sulle
  prestazioni e diagnostica): **non raccolti**.

Nota: è la dichiarazione prudente. Molte app con mappe non dichiarano le immagini della mappa; dichiararle
non costa nulla e protegge da contestazioni.

## App governative / Funzionalità finanziarie / Salute / App di notizie
**No** a tutte.

## Autorizzazioni per i servizi in primo piano (obbligatorio, l'app usa FOREGROUND_SERVICE_LOCATION)
- Tipo di servizio: **Posizione**.
- Caso d'uso: **Navigazione** (se c'è solo un elenco, scegli quello più vicino a "navigazione" o "Altro").
- Descrizione da incollare:
  > Durante la guida l'utente avvia il monitoraggio con "Avvia guida". Il servizio in primo piano legge la
  > posizione GPS per seguire i tratti con controllo della velocità media (Tutor) e avvisare con la voce se la
  > media supera la soglia, anche quando l'utente passa al navigatore o spegne lo schermo. Il servizio mostra
  > una notifica fissa e si ferma con "Esci" o chiudendo il riquadro. Fuori dalla guida non è attivo.
- **Video** (link YouTube "non in elenco", 30-60 secondi, registrato con la registrazione schermo del telefono):
  1. apri l'app e premi "Avvia guida" (o "Prova in simulazione" > "Avvia simulazione");
  2. mostra la notifica fissa abbassando la tendina;
  3. premi Home: compare il riquadro con il cartello, apri un navigatore;
  4. torna all'app e premi "Esci": la notifica sparisce.

## Autorizzazione di accesso alla posizione in background
Non dovrebbe essere richiesta: l'app non chiede `ACCESS_BACKGROUND_LOCATION` (usa il servizio in primo piano
avviato con l'app aperta). Se la console la chiede comunque, usa la stessa descrizione e lo stesso video.
