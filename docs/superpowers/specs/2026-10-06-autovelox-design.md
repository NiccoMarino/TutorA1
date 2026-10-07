# Autovelox fissi oltre ai Tutor: progetto

Data: 6 ottobre 2026. Ramo: `tutte-le-autostrade`.

## Cosa vuole l'utente

Oltre ai tratti Tutor, l'app avvisa degli autovelox fissi sulle autostrade che segue, con voce, suono e scritte
sullo schermo, anche dentro il cerchio. L'elenco deve essere facile da aggiornare.

Detto dall'utente:
- usare l'elenco ufficiale della Polizia (ottobre 2025), non il PDF del 2009;
- avviso con voce e scritta;
- allungare il tracciato di A11 e A14 per coprire anche i due autovelox fuori dal tracciato attuale;
- una scritta anche dentro il cerchio;
- un README per modificare l'elenco.

Scelte mie, approvate nel progetto in chat:
- avviso a 500 m;
- avviso più forte se si va oltre il limite;
- interruttore nelle Impostazioni;
- scritta nella riga in alto.

## Fonte

"Elenco delle postazioni autovelox fisse sulla rete autostradale", Ministero dell'Interno, Servizio Polizia
Stradale. PDF `mvpostazionefissaaut_07102025.pdf`, 7 ottobre 2025, dalla pagina
https://www.poliziadistato.it/articolo/175. Ogni riga ha regione, autostrada, chilometro, direzione, comune e
provincia.

Le postazioni sulle autostrade che l'app segue sono 13:

| Strada | km | Direzione | Comune |
|---|---|---|---|
| A1 | 305,500 | Nord | Bagno a Ripoli (FI) |
| A1 | 362,500 | Sud | Civitella in Val di Chiana (AR) |
| A11 | 35,500 | Ovest | Serravalle Pistoiese (PT) |
| A11 | 71,000 | Est | Lucca (LU), fuori dal tracciato attuale |
| A14 | 154,060 | Sud | Pesaro (PU) |
| A14 | 254,340 | Nord | Potenza Picena (MC) |
| A14 | 290,540 | Nord | Campofilone (FM) |
| A14 | 683,397 | Sud | Bitritto (BA) |
| A14 | 689,715 | Nord | Sannicandro di Bari (BA), fuori dal tracciato attuale |
| A4 | 423,850 | Ovest | Noventa di Piave (VE) |
| A4 | 417,900 | Ovest | Meolo (VE) |
| A4 | 406,950 | Est | Quarto d'Altino (VE) |
| A4 | 417,350 | Est | Meolo (VE) |

Il file contiene anche le postazioni che l'app non segue, marcate come tali, così resta la copia completa
dell'elenco:
- trafori, tangenziali di Torino;
- A12 Livorno–Rosignano, A15 Parma–La Spezia;
- Ascoli–Mare, Avellino–Salerno;
- raccordi di Perugia e Benevento.

## 1. Dati

**Fonte modificabile.** È il file `tools/autovelox.json`:

```json
{
  "fonte": {"titolo": "...", "ente": "Polizia di Stato, Servizio Polizia Stradale", "url": "...", "data": "2025-10-07"},
  "postazioni": [
    {"strada": "A01", "km": 305.5, "direzione": "Nord", "comune": "Bagno a Ripoli", "prov": "FI"},
    {"strada": null, "nome": "Tangenziale Sud di Torino", "km": 15.68, "direzione": "Sud", "comune": "Nichelino", "prov": "TO"}
  ]
}
```

- `strada` è il codice del ramo di `RAMS` (`src/core/network.js`); `null` vuol dire una strada che l'app non segue.
- `km` è il chilometro della Polizia (`305+500` diventa `305.5`).

**Istruzioni.** `tools/autovelox.md` è il README:
- che cosa sono i campi;
- dove si scarica l'elenco nuovo;
- come trascriverlo;
- che il verso si ricava da solo;
- quali comandi lanciare: `node tools/make-tratti.mjs`, `npm run build`, `npm test`;
- che cosa controllare;
- che, se la fonte cambia data, si aggiornano il testo delle Fonti e `DISCLAIMER_VERSION` solo se cambia l'avviso.

**Costruzione.** `tools/make-tratti.mjs` legge `tools/autovelox.json`:
- **tracciato**: il tratto di carreggiata che scarica per ogni autostrada va dal primo all'ultimo chilometro fra i tratti Tutor *e* gli autovelox di quella strada, più 5 km. A11 arriva così al km 76 e A14 al km 695;
- **verso**: per ogni postazione seguita ricava il segno (+1 chilometri crescenti, -1 decrescenti) dai tratti della stessa strada con la stessa direzione. Per A1 e A4, che `make-tratti` non ricostruisce, usa i tratti già in `tutor-data.json`. Se una postazione ha una strada seguita ma il verso non si ricava, oppure il suo chilometro è fuori dal tracciato, la costruzione si ferma con un errore chiaro;
- **risultato**: scrive in `src/data/tutor-data.json` una lista `velox`, con un elemento per ogni postazione seguita: `{"id": 1, "r": "A01", "km": 305.5, "sign": -1, "comune": "Bagno a Ripoli"}`. Aggiunge anche `veloxFonte` con titolo, ente, url e data, per il testo delle Fonti.

**Controlli.**
- La ricostruzione cambia solo le carreggiate di A11 e A14 e aggiunge `velox`/`veloxFonte`: si confronta con il dato precedente.
- La pagina resta sotto i 550 kB, con il test che c'è già.

## 2. Calcolo (`src/core/`)

- **`buildNetwork`** restituisce anche `velox`, la lista dei dati; ogni elemento riceve anche `name`, cioè "Autovelox di Bagno a Ripoli".
- **`createTracker`** riceve anche `velox` e, a ogni posizione sulla strada con il verso noto, calcola:
  - `st.veloxNext`: l'autovelox più vicino davanti, sullo stesso ramo e nello stesso verso, `{v, dist}` in km. È `null` se non ce n'è uno entro 0,5 km. La distanza è `(v.km - km) * sign` e deve essere maggiore di 0.
  - quando `dist <= 0.5` e l'avviso per quella postazione non è ancora stato dato: `emit('velox-alert', {velox, dist, limit})`. Le postazioni avvisate stanno in `st.veloxAlerted` e si tolgono quando la si supera (`dist < 0`) o si esce dalla strada. Così si avvisa di nuovo solo ripassando.
  - quando `st.veloxNext` esiste, la velocità del momento è sopra `settings.limit` e l'avviso forte per quella postazione non è ancora stato dato: `emit('velox-over', {velox, limit})`. Vale una volta per postazione per passaggio.
  - con `settings.veloxOff === true` niente eventi e `st.veloxNext = null`. L'impostazione è facoltativa e manca quando gli avvisi sono accesi, così `DEFAULT_SETTINGS` e le impostazioni dei collaudi non cambiano.
- **`announcementFor`**, in `messages.js`:
  - `velox-alert`: "Autovelox tra 500 metri, limite 130.", con suono `pre`;
  - `velox-over`: "Autovelox vicino, rallenta: limite 130.", con suono `alarm` e vibrazione `[220,100,220]`.
- **`hudView`** aggiunge `view.velox`: `{text: 'Autovelox tra 420 m', short: '420 m'}` oppure `null`. La distanza scende a passi di 10 m e sotto i 50 m diventa "Autovelox ora".

## 3. Pagina (`src/ui/`, `src/index.html`, stili)

> **Aggiornato durante il lavoro.** L'utente ha scelto la prova 5 di 10 (canvas delle prove): una fascia gialla da
> bordo a bordo del cerchio, con la telecamera, AUTOVELOX e i metri, sopra la velocità da tenere. Ha i bordi scuri
> sopra e sotto, e il numero sale un po' quando la fascia c'è. Sostituisce l'etichetta in alto descritta qui sotto.
> La riga in alto dice "Velox 420 m", perché sul telefono ha 98 px e "Autovelox 420 m" non ci sta.
> Il tracciato: gli estremi saltano i punti di riferimento che non hanno la strada vicina (vedi il registro del lavoro).

- **Riga in alto**: con `view.velox` presente, la seconda riga di `#hudRoad` mostra `view.velox.text` in giallo (classe `velox`) al posto di direzione e precisione GPS.
- **Nel cerchio**: un elemento nuovo, `<div class="velox-in" id="pVelox" hidden>`, dentro `.gauge`, in alto e sopra il numero grande. Il testo è "AUTOVELOX" su una riga e i metri sotto.
  - **Stile**: fondo giallo `#F2B21E`, testo scuro, angoli tondi, dimensione in `cqw` con un minimo di 11 px, fuori dal riquadro come le altre scritte del cerchio.
  - **Dove si vede**: in verticale, col telefono girato (anello intero) e nel riquadro (`pip.css`, dimensione adatta al cerchio piccolo).
  - **Leggibilità**: non deve coprire il numero grande. Va controllato con `npm run schermi` e con `device-check` per il riquadro.
- **Impostazioni di guida**: un interruttore "Avvisi autovelox" (`#setVelox`), come quelli di voce e suoni. Spento vuol dire `settings.veloxOff = true`; acceso vuol dire che la chiave viene tolta.
- **"Come funziona"**: un paragrafo su che cosa fa l'avviso, che vale la velocità del momento e non la media, e che l'elenco è quello della Polizia.
- **"Fonti e precisione"**: l'elenco della Polizia con la data, preso da `veloxFonte`, e il fatto che le postazioni possono cambiare o essere spente.
- **Avviso iniziale**: si aggiunge che anche le posizioni degli autovelox possono essere sbagliate o non aggiornate, e `DISCLAIMER_VERSION` passa a 2.
- Gli id usati da `native/tutor-native.js` e le chiavi di localStorage non cambiano.

## 4. Testi legali

- **`termini.html`**: nella parte "Stime, non misure ufficiali" si aggiunge che anche gli autovelox segnalati vengono da un elenco pubblico che può non essere aggiornato, e che il limite vale sempre.
- **`privacy.html`**: niente da cambiare sui dati, perché non c'è niente di nuovo da salvare a parte l'impostazione. Si aggiorna solo la data se si tocca.
- **`docs/legale/VERIFICA.md`**: una nota sugli autovelox. Segnalare le postazioni fisse è lecito: le pubblica la Polizia stessa, e il Codice della Strada (art. 142) chiede che siano segnalate. C'è la fonte con la data, e il punto 12 "promesse non dimostrabili" vale anche qui.

## 5. Prove

- **`test/tracker.test.js`**, con posizioni sul tracciato della A1 vicino al km 305,5 in direzione Nord:
  - c'è un `velox-alert` a 500 m;
  - nessun avviso nel verso opposto;
  - nessun secondo avviso finché non lo si supera;
  - c'è `velox-over` sopra il limite, una sola volta;
  - nessun evento con `veloxOff`.
- **`test/messages.test.js`**: i due testi.
- **`test/hud-view.test.js`**: `view.velox` (testo, arrotondamento, "ora").
- **`test/build.test.js`**:
  - `#pVelox` e `#setVelox` sono nella pagina;
  - la fonte della Polizia è citata con la data;
  - l'avviso iniziale parla degli autovelox.
- **Dati** (un test nuovo):
  - ogni postazione di `tools/autovelox.json` con strada seguita compare in `velox`, con il verso giusto e il chilometro dentro il tracciato della sua carreggiata;
  - le strade non seguite non compaiono.
- **Golden**: gli eventi nuovi non devono cambiare medie ed esiti. Se un percorso registrato passa vicino a un autovelox e gli avvisi cambiano, si ricontrolla e si registra di nuovo, motivandolo.
- **`npm run schermi`** e **`device-check`** sul telefono, con una simulazione sul tratto della A1 vicino a Firenze, in verticale, girato e nel riquadro.

## Fuori da questo lavoro

- Autovelox mobili: la Polizia pubblica ogni settimana, regione per regione, le strade e i giorni, non il punto.
- Postazioni su strade che l'app non segue.
- Censimento del Ministero (velox.mit.gov.it): non dà la posizione.
