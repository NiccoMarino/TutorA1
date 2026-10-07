# Elenco degli autovelox fissi

`tools/autovelox.json` è la copia dell'elenco ufficiale "Elenco delle postazioni autovelox fisse sulla rete
autostradale" della Polizia Stradale. Si trova sulla pagina https://www.poliziadistato.it/articolo/175, fra i
documenti a destra, alla voce "Autostrade".

L'app avvisa delle postazioni che stanno sulle autostrade che segue. Le altre restano nel file con
`"strada": null`: così il file è l'elenco completo e il confronto con un elenco nuovo è facile.

## Campi

- `fonte`: titolo, ente, nome del PDF, pagina e data dell'elenco (`AAAA-MM-GG`). La data compare nell'app, in
  Privacy e diritti, Fonti e precisione.
- `postazioni`: una per riga del PDF, con questi campi.
  - `strada`: codice del ramo come in `RAMS` di `src/core/network.js` (`A01`, `A04`, `A11`, `A14`, …), oppure
    `null` se l'app non segue quella strada.
  - `nome`: il nome della strada nel PDF, per ritrovarla.
  - `km`: il chilometro con il punto decimale. `305+500` diventa `305.5`, `35,500` diventa `35.5`.
  - `direzione`: `Nord`, `Sud`, `Est` o `Ovest` come nel PDF. `Italia` si usa solo per il traforo.
  - `comune`, `prov`: comune e sigla della provincia.

Il verso, cioè chilometri crescenti o decrescenti, non si scrive. Lo ricava `tools/make-tratti.mjs` dai tratti Tutor
della stessa strada con la stessa direzione. Per esempio "Ovest" sulla A11 è verso Pisa, a chilometri crescenti.

## Aggiornare l'elenco

1. Scaricare il PDF nuovo dalla pagina della Polizia e confrontarlo con il file: postazioni nuove, postazioni tolte,
   chilometri cambiati.
2. Aggiornare `postazioni`, poi `fonte` con il nome del file e la data.
3. Per una postazione nuova su un'autostrada che l'app segue, scrivere il codice in `strada`. Per le altre, `null`.
4. Ricostruire i dati con `node tools/make-tratti.mjs`. Allunga da solo il tracciato delle autostrade che
   ricostruisce (tutte tranne A1 e A4) per coprire le postazioni. Si ferma con un errore in due casi:
   - una postazione è fuori dal tracciato, per esempio una nuova sulla A1 oltre i tratti;
   - il verso non si ricava.
5. Lanciare `npm run build` e `npm test`. I test controllano l'elenco, i dati e che la data della fonte nell'app sia
   quella del file.
6. Se cambia il numero delle postazioni segnalate, aggiornare a mano il testo delle Fonti in `src/index.html`.
7. Provare sul telefono con `npm run device-check -- --solo rotazione`.

`DISCLAIMER_VERSION`, in `src/core/store.js`, si aumenta solo se cambia il testo dell'avviso iniziale. Un elenco
nuovo non basta.
