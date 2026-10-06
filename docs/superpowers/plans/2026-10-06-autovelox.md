# Autovelox fissi: piano di lavoro

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** l'app avvisa degli autovelox fissi dell'elenco della Polizia (ottobre 2025) sulle autostrade che segue: voce e suono a 500 m, avviso più forte sopra il limite, scritta nella riga in alto e dentro il cerchio, interruttore nelle Impostazioni.

**Architecture:** l'elenco modificabile è `tools/autovelox.json` (con README). `tools/make-tratti.mjs` lo legge, allunga il tracciato di A11 e A14 e scrive in `src/data/tutor-data.json` la lista `velox` (ramo, km, verso). Il tracker (`src/core/tracker.js`) trova l'autovelox davanti con il chilometro, come fa per i portali, ed emette `velox-alert` / `velox-over`. `messages.js` dà i testi, `hud-view.js` la vista `velox`, `ui/hud.js` la scrive nella riga in alto e nel cerchio (`#pVelox`).

**Tech Stack:** JavaScript ES modules senza dipendenze, test con `node --test`, build con `scripts/build.mjs`, app Android Capacitor.

**Spec:** `docs/superpowers/specs/2026-10-06-autovelox-design.md`

## Global Constraints

- Testi, commenti e commit in italiano. I commit finiscono con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Non modificare `index.html` a mano: si modifica `src/` e si esegue `npm run build`.
- `src/core/` non usa `document` né `window`.
- Non cambiare le chiavi di localStorage (`tutorA1.v1.settings`, `tutorA1.v1.history`, `tutorA1.v1.avviso`) né gli id usati da `native/tutor-native.js` (`hudExit`, `hudMute`).
- La pagina non scarica niente da internet e resta sotto i 550 kB (test esistente).
- `DEFAULT_SETTINGS` non cambia: l'interruttore spento è la chiave facoltativa `settings.veloxOff = true`.
- La versione è solo in `package.json`: `npm version patch --no-git-tag-version` alla fine.
- Installare sul telefono solo la copia "Tutor prova": `cd android && JAVA_HOME="/c/Program Files/Java/jdk-21" ./gradlew installDebug -Pprova=true`.
- Ramo `autovelox`. Niente push, niente merge.

## Review Focus

1. **Ricostruzione di A11 e A14 con `make-tratti`.** Allungare il tracciato rifà la catena dei punti di riferimento. I chilometri dei tratti già esistenti non devono spostarsi: lo dicono il golden (scenario `a14-sud-di-poco-sopra-il-limite`) e il test "ogni tratto … misurato".
2. **GPS che oscilla intorno all'autovelox appena superato.** Non deve ripetere l'avviso: si rimette solo oltre 200 m dopo la postazione.
3. **Partire già dentro i 500 m**, per esempio con l'app avviata a 300 m. Un solo avviso, con la distanza vera ("tra 300 metri").
4. **Etichetta nel cerchio sul cartello giallo** (stato `warn`, fondo `#F2B21E`). L'etichetta è gialla, quindi serve il bordo scuro. Non deve coprire il numero grande, in nessuna delle tre forme.
5. **Interruttore spento a metà avvicinamento.** Scritta ed etichetta spariscono alla posizione dopo, e non parte nessun avviso.

---

### Task 1: Elenco autovelox e README

**Files:**
- Create: `tools/autovelox.json`
- Create: `tools/autovelox.md`
- Test: `test/autovelox.test.js`

**Interfaces:**
- Produces: `tools/autovelox.json` = `{fonte:{titolo, ente, file, url, data:'2025-10-07'}, postazioni:[{strada:string|null, nome, km:number|null, direzione, comune, prov}]}`. `strada` è un codice di `RAMS` (`A01`, `A04`, `A11`, `A14`) oppure `null`.

- [ ] **Step 1: Scrivere il test che fallisce**

`test/autovelox.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RAMS } from '../src/core/network.js';

const LIST = JSON.parse(readFileSync(new URL('../tools/autovelox.json', import.meta.url), 'utf8'));

test('elenco autovelox: fonte della Polizia con la data', () => {
  assert.match(LIST.fonte.url, /^https:\/\/www\.poliziadistato\.it\//);
  assert.match(LIST.fonte.data, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(LIST.fonte.titolo && LIST.fonte.ente && LIST.fonte.file);
});

test('elenco autovelox: ogni postazione ha i campi giusti', () => {
  assert.equal(LIST.postazioni.length, 27, 'le postazioni del PDF del 7 ottobre 2025');
  for (const p of LIST.postazioni){
    const what = JSON.stringify(p);
    assert.ok(p.strada === null || RAMS[p.strada], 'strada sconosciuta: ' + what);
    assert.ok(['Nord', 'Sud', 'Est', 'Ovest', 'Italia'].includes(p.direzione), 'direzione: ' + what);
    assert.ok(p.nome && p.comune && /^[A-Z]{2}$/.test(p.prov), 'nome, comune o provincia: ' + what);
    assert.ok(p.km === null ? p.strada === null : p.km > 0, 'chilometro: ' + what);
  }
});

test('elenco autovelox: 13 postazioni sulle autostrade che l\'app segue', () => {
  const followed = LIST.postazioni.filter(p => p.strada);
  assert.equal(followed.length, 13);
  assert.deepEqual([...new Set(followed.map(p => p.strada))].sort(), ['A01', 'A04', 'A11', 'A14']);
});
```

- [ ] **Step 2: Eseguire il test e vedere che fallisce**

Run: `node --test test/autovelox.test.js`
Expected: FAIL con `ENOENT` su `tools/autovelox.json`

- [ ] **Step 3: Scrivere l'elenco**

`tools/autovelox.json`, trascritto dal PDF `mvpostazionefissaaut_07102025.pdf`:

```json
{
  "fonte": {
    "titolo": "Elenco delle postazioni autovelox fisse sulla rete autostradale",
    "ente": "Ministero dell'Interno, Servizio Polizia Stradale",
    "file": "mvpostazionefissaaut_07102025.pdf",
    "url": "https://www.poliziadistato.it/articolo/175",
    "data": "2025-10-07"
  },
  "postazioni": [
    {"strada": null, "nome": "Traforo del Frejus (interno galleria)", "km": null, "direzione": "Italia", "comune": "Bardonecchia", "prov": "TO"},
    {"strada": null, "nome": "Tangenziale Nord di Torino", "km": 8.25, "direzione": "Nord", "comune": "Collegno", "prov": "TO"},
    {"strada": null, "nome": "Tangenziale Sud di Torino", "km": 15.68, "direzione": "Sud", "comune": "Nichelino", "prov": "TO"},
    {"strada": "A04", "nome": "A4 Torino-Trieste", "km": 423.85, "direzione": "Ovest", "comune": "Noventa di Piave", "prov": "VE"},
    {"strada": "A04", "nome": "A4 Torino-Trieste", "km": 417.9, "direzione": "Ovest", "comune": "Meolo", "prov": "VE"},
    {"strada": "A04", "nome": "A4 Torino-Trieste", "km": 406.95, "direzione": "Est", "comune": "Quarto d'Altino", "prov": "VE"},
    {"strada": "A04", "nome": "A4 Torino-Trieste", "km": 417.35, "direzione": "Est", "comune": "Meolo", "prov": "VE"},
    {"strada": "A01", "nome": "A1 Milano-Napoli", "km": 305.5, "direzione": "Nord", "comune": "Bagno a Ripoli", "prov": "FI"},
    {"strada": "A01", "nome": "A1 Milano-Napoli", "km": 362.5, "direzione": "Sud", "comune": "Civitella in Val di Chiana", "prov": "AR"},
    {"strada": "A11", "nome": "A11 Firenze-Pisa Nord", "km": 35.5, "direzione": "Ovest", "comune": "Serravalle Pistoiese", "prov": "PT"},
    {"strada": "A11", "nome": "A11 Firenze-Pisa Nord", "km": 71.0, "direzione": "Est", "comune": "Lucca", "prov": "LU"},
    {"strada": null, "nome": "A12 Livorno-Rosignano", "km": 196.5, "direzione": "Nord", "comune": "Rosignano Marittimo", "prov": "LI"},
    {"strada": null, "nome": "A12 Livorno-Rosignano", "km": 200.5, "direzione": "Sud", "comune": "Rosignano Marittimo", "prov": "LI"},
    {"strada": null, "nome": "A15 Parma-La Spezia", "km": 53.0, "direzione": "Nord", "comune": "Berceto", "prov": "PR"},
    {"strada": "A14", "nome": "A14 Bologna-Taranto", "km": 154.06, "direzione": "Sud", "comune": "Pesaro", "prov": "PU"},
    {"strada": "A14", "nome": "A14 Bologna-Taranto", "km": 254.34, "direzione": "Nord", "comune": "Potenza Picena", "prov": "MC"},
    {"strada": "A14", "nome": "A14 Bologna-Taranto", "km": 290.54, "direzione": "Nord", "comune": "Campofilone", "prov": "FM"},
    {"strada": null, "nome": "Raccordo Ascoli-Mare", "km": 3.8, "direzione": "Est", "comune": "Ascoli Piceno", "prov": "AP"},
    {"strada": null, "nome": "Raccordo Avellino-Salerno", "km": 17.825, "direzione": "Nord", "comune": "Solofra", "prov": "AV"},
    {"strada": null, "nome": "Raccordo Avellino-Salerno", "km": 27.196, "direzione": "Nord", "comune": "Cesinali", "prov": "AV"},
    {"strada": null, "nome": "Raccordo Avellino-Salerno", "km": 17.015, "direzione": "Sud", "comune": "Montoro", "prov": "AV"},
    {"strada": null, "nome": "Raccordo Avellino-Salerno", "km": 24.368, "direzione": "Sud", "comune": "Serino", "prov": "AV"},
    {"strada": null, "nome": "Raccordo di Benevento", "km": 10.48, "direzione": "Sud", "comune": "Benevento", "prov": "BN"},
    {"strada": null, "nome": "Raccordo di Benevento", "km": 11.02, "direzione": "Nord", "comune": "Benevento", "prov": "BN"},
    {"strada": null, "nome": "Raccordo Bettolle-Perugia", "km": 57.05, "direzione": "Est", "comune": "Perugia", "prov": "PG"},
    {"strada": "A14", "nome": "A14 Bologna-Taranto", "km": 683.397, "direzione": "Sud", "comune": "Bitritto", "prov": "BA"},
    {"strada": "A14", "nome": "A14 Bologna-Taranto", "km": 689.715, "direzione": "Nord", "comune": "Sannicandro di Bari", "prov": "BA"}
  ]
}
```

`tools/autovelox.md`:

```markdown
# Elenco degli autovelox fissi

`tools/autovelox.json` è la copia dell'elenco ufficiale "Elenco delle postazioni autovelox fisse sulla rete
autostradale" della Polizia Stradale, sulla pagina https://www.poliziadistato.it/articolo/175 (documenti a destra,
"Autostrade"). L'app avvisa delle postazioni sulle autostrade che segue. Le altre restano nel file con
`"strada": null`, così il file è l'elenco completo e il confronto con un elenco nuovo è facile.

## Campi

- `fonte`: titolo, ente, nome del PDF, pagina e data dell'elenco (`AAAA-MM-GG`). La data compare nell'app (Privacy e diritti, Fonti e precisione).
- `postazioni`, una per riga del PDF:
  - `strada`: codice del ramo come in `RAMS` di `src/core/network.js` (`A01`, `A04`, `A11`, `A14`, …), oppure `null` se l'app non segue quella strada.
  - `nome`: come la chiama il PDF, per ritrovarla.
  - `km`: chilometro con il punto decimale (`305+500` diventa `305.5`, `35,500` diventa `35.5`).
  - `direzione`: `Nord`, `Sud`, `Est` o `Ovest` come nel PDF; `Italia` solo per il traforo.
  - `comune`, `prov`: comune e sigla della provincia.

Il verso (chilometri crescenti o decrescenti) non si scrive. Lo ricava `tools/make-tratti.mjs` dai tratti Tutor della
stessa strada con la stessa direzione: per esempio "Ovest" sulla A11 è verso Pisa, chilometri crescenti.

## Aggiornare l'elenco

1. Scaricare il PDF nuovo dalla pagina della Polizia e confrontarlo con il file: postazioni nuove, tolte, chilometri cambiati.
2. Aggiornare `postazioni` e `fonte` (nome del file e data).
3. Se una postazione nuova è su un'autostrada che l'app segue, scrivere il suo codice in `strada`. Se l'autostrada non è seguita, `null`.
4. Ricostruire i dati: `node tools/make-tratti.mjs`. Allunga da solo il tracciato delle autostrade ricostruite (tutte tranne A1 e A4) per coprire le postazioni. Si ferma con un errore se una postazione è fuori dal tracciato, per esempio una nuova sulla A1 oltre i tratti, oppure se il verso non si ricava.
5. `npm run build` e `npm test`: i test controllano l'elenco e i dati, e che la data della fonte nell'app sia quella del file.
6. Aggiornare a mano il testo delle Fonti in `src/index.html` se cambia il numero delle postazioni segnalate.
7. Provare sul telefono con `npm run device-check -- --solo rotazione`.

`DISCLAIMER_VERSION` (`src/core/store.js`) si aumenta solo se cambia il testo dell'avviso iniziale, non per un elenco nuovo.
```

- [ ] **Step 4: Eseguire il test e vedere che passa**

Run: `node --test test/autovelox.test.js`
Expected: PASS, 3 test

- [ ] **Step 5: Commit**

```bash
git add tools/autovelox.json tools/autovelox.md test/autovelox.test.js
git commit -m "Elenco degli autovelox fissi della Polizia (ottobre 2025) con le istruzioni per aggiornarlo"
```

---

### Task 2: Autovelox nei dati (make-tratti)

**Files:**
- Modify: `tools/make-tratti.mjs` (import, `main`, nuova funzione esportata `veloxEntries`)
- Modify: `src/data/tutor-data.json` (rigenerato)
- Test: `test/autovelox.test.js`

**Interfaces:**
- Consumes: `tools/autovelox.json` (Task 1).
- Produces:
  - `export function veloxEntries(postazioni, secs, ch)` → `[{id:number, r:string, km:number, sign:1|-1, comune:string}]`. Lancia `Error` se il verso non si ricava o se il chilometro, con i 600 m prima, è fuori dalla carreggiata.
  - `tutor-data.json` contiene `velox` (13 elementi) e `veloxFonte` (= `fonte`).

- [ ] **Step 1: Scrivere i test che falliscono**

Aggiungere in fondo a `test/autovelox.test.js`:

```js
import { veloxEntries } from '../tools/make-tratti.mjs';
import { DATA } from './helpers.js';

const SECS = [{r:'A11', d:'Ovest', ka:10, kb:20}, {r:'A11', d:'Est', ka:20, kb:10}, {r:'A01', d:'Nord', ka:30, kb:20}];
const CH = {A11O:[[0, 0, 5], [0, 0, 40]], A11E:[[0, 0, 40], [0, 0, 5]], N:[[0, 0, 50], [0, 0, 1]]};
const P = (strada, km, direzione) => ({strada, nome:'x', km, direzione, comune:'C', prov:'XX'});

test('veloxEntries: verso dai tratti della stessa strada e direzione, strade non seguite escluse', () => {
  assert.deepEqual(veloxEntries([P('A11', 35.5, 'Ovest'), P(null, 3, 'Est'), P('A11', 30, 'Est'), P('A01', 25, 'Nord')], SECS, CH), [
    {id:1, r:'A11', km:35.5, sign:1, comune:'C'}, {id:2, r:'A11', km:30, sign:-1, comune:'C'}, {id:3, r:'A01', km:25, sign:-1, comune:'C'}]);
});

test('veloxEntries: postazione fuori dal tracciato o senza verso: errore chiaro', () => {
  assert.throws(() => veloxEntries([P('A11', 40.5, 'Ovest')], SECS, CH), /fuori dal tracciato/);
  // i 600 m prima della postazione devono essere sul tracciato (l'avviso parte a 500 m)
  assert.throws(() => veloxEntries([P('A11', 5.3, 'Ovest')], SECS, CH), /fuori dal tracciato/);
  assert.throws(() => veloxEntries([P('A11', 30, 'Nord')], SECS, CH), /verso/);
});

test('dati: ogni autovelox seguito è nei dati, con il verso giusto e dentro la sua carreggiata', () => {
  assert.equal(DATA.velox.length, 13);
  assert.deepEqual(DATA.veloxFonte, LIST.fonte);
  const SIGN = {A01:{Nord:-1, Sud:1}, A04:{Est:1, Ovest:-1}, A11:{Ovest:1, Est:-1}, A14:{Sud:1, Nord:-1}};
  LIST.postazioni.filter(p => p.strada).forEach((p, i) => {
    const v = DATA.velox[i];
    assert.deepEqual([v.r, v.km, v.sign, v.comune], [p.strada, p.km, SIGN[p.strada][p.direzione], p.comune]);
  });
});
```

- [ ] **Step 2: Eseguire i test e vedere che falliscono**

Run: `node --test test/autovelox.test.js`
Expected: FAIL. `veloxEntries` non è esportata (SyntaxError sull'import).

- [ ] **Step 3: Scrivere `veloxEntries` e usarla in `main`**

In `tools/make-tratti.mjs`, prima di `const r5 = …`:

```js
// Autovelox di tools/autovelox.json sulle autostrade seguite: il verso viene dai tratti con la stessa direzione,
// la carreggiata deve contenere la postazione e i 600 m prima (l'avviso parte a 500 m)
const LINE_KEY = {A01: s => s > 0 ? 'S' : 'N', A04: s => s > 0 ? 'AE' : 'AW'};
export function veloxEntries(postazioni, secs, ch){
  return postazioni.filter(p => p.strada).map((p, i) => {
    const s = secs.find(x => x.r === p.strada && x.d === p.direzione);
    if (!s) throw new Error('Autovelox ' + p.strada + ' km ' + p.km + ' ' + p.direzione + ': nessun tratto in quella direzione, verso sconosciuto');
    const sign = Math.sign(s.kb - s.ka), key = LINE_KEY[p.strada] ? LINE_KEY[p.strada](sign) : p.strada + p.direzione[0];
    const line = ch[key], kms = line ? [line[0][2], line.at(-1)[2]] : [];
    const from = p.km - sign*0.6;
    if (!line || Math.min(from, p.km) < Math.min(...kms) || Math.max(from, p.km) > Math.max(...kms))
      throw new Error('Autovelox ' + p.strada + ' km ' + p.km + ' ' + p.direzione + ': fuori dal tracciato (' + key + ')');
    return {id:i + 1, r:p.strada, km:p.km, sign, comune:p.comune};
  });
}
```

In `main()`:
- dopo `const data = …`, leggere l'elenco:

```js
  const autovelox = JSON.parse(readFileSync(new URL('tools/autovelox.json', ROOT), 'utf8'));
```

- nel ciclo `for (const code of codes)`, i chilometri usati per k0 e k1 comprendono gli autovelox della strada:

```js
    const mine = list.filter(x => x.r === code);
    const kms = [...mine.flatMap(x => [x.ka, x.kb]), ...autovelox.postazioni.filter(p => p.strada === code).map(p => p.km)];
```

- prima di `console.log(report.join('\n'))`:

```js
  const velox = veloxEntries(autovelox.postazioni, secs, ch);
  report.push(velox.length + ' autovelox sulle autostrade seguite');
```

- la scrittura salva anche `velox` e `veloxFonte`:

```js
  writeFileSync(check ? new URL(process.env.TRATTI_OUT || "tools/.cache/check-data.json", ROOT) : dataUrl, JSON.stringify({ch, secs, velox, veloxFonte:autovelox.fonte}));
```

- [ ] **Step 4: Eseguire i test di `veloxEntries`**

Run: `node --test --test-name-pattern veloxEntries test/autovelox.test.js`
Expected: PASS i 2 test di `veloxEntries`

- [ ] **Step 5: Ricostruire i dati in prova e confrontarli**

Run: `node tools/make-tratti.mjs --check` (scarica da OpenStreetMap solo A11 e A14, che hanno gli estremi nuovi).
Expected: il resoconto mostra `A11O: km … → 76`, `A14N: km 695 → …` e `13 autovelox sulle autostrade seguite`.

Poi il confronto:

```bash
node -e "
const a=require('./src/data/tutor-data.json'), b=require('./tools/.cache/check-data.json');
const same=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
console.log('tratti uguali:', same(a.secs,b.secs));
for (const k of Object.keys(b.ch)) if (!same(a.ch[k],b.ch[k])) console.log('carreggiata cambiata:', k);"
```

Expected: `tratti uguali: true`. Cambiano solo `A11O`, `A11E`, `A14S` e `A14N`. Se cambia altro, fermarsi e capire perché prima di scrivere i dati.

- [ ] **Step 6: Scrivere i dati e controllare**

Run: `node tools/make-tratti.mjs && npm run build && npm test`
Expected: tutto PASS. Il test "dati: ogni autovelox seguito…" passa, e così il golden (anche `a14-sud-di-poco-sopra-il-limite`), "ogni tratto di ogni autostrada viene misurato" e "la pagina resta leggera".

Se il golden di A14 o di A11 cambia, è il rischio 1 della Review Focus: confrontare i chilometri della carreggiata vecchia e nuova nei punti dello scenario e decidere con una Ruling.

- [ ] **Step 7: Commit**

```bash
git add tools/make-tratti.mjs src/data/tutor-data.json index.html test/autovelox.test.js
git commit -m "Autovelox nei dati: make-tratti legge l'elenco, allunga A11 e A14 e scrive verso e chilometro"
```

---

### Task 3: Il tracker trova l'autovelox davanti

**Files:**
- Modify: `src/core/network.js` (`buildNetwork` restituisce `velox`)
- Modify: `src/core/tracker.js`
- Test: `test/tracker.test.js`

**Interfaces:**
- Consumes: `DATA.velox` (Task 2).
- Produces:
  - `buildNetwork(data)` → `{secs, lines, velox}`, dove `velox = data.velox || []`;
  - `createTracker({secs, lines, settings, velox = []})`;
  - `export const VELOX_KM = 0.5`;
  - `st.veloxNext` = `{v, dist}` (km) oppure `null`;
  - eventi `velox-alert {velox, dist, limit, over}` e `velox-over {velox, limit}`.

- [ ] **Step 1: Scrivere i test che falliscono**

In `test/tracker.test.js`, cambiare l'inizio così:

```js
const {secs, lines, velox} = network();
const A01S = lines.find(l => l.id === 'A01S'), A01N = lines.find(l => l.id === 'A01N');
const make = (extra = {}) => {
  const settings = {...DEFAULT_SETTINGS, ...extra};
  const tracker = createTracker({secs, lines, settings, velox});
  const events = [];
  tracker.on(e => events.push(e));
  return {tracker, settings, events};
};
```

e aggiungere in fondo:

```js
// Autovelox della A1 al km 305,5 verso Nord (Bagno a Ripoli): sulla carreggiata Nord i km scendono
const vx = events => events.filter(e => e.type.startsWith('velox'));
const lastT = ps => ps.at(-1).timestamp + 1000;

test('autovelox: un avviso a 500 m, con il limite', () => {
  const {tracker, events} = make();
  tracker.start('gps');
  along(A01N, 307, 305.7, 120).forEach(tracker.pushPosition);
  const v = vx(events);
  assert.equal(v.length, 1);
  assert.equal(v[0].type, 'velox-alert');
  assert.equal(v[0].velox.comune, 'Bagno a Ripoli');
  assert.ok(v[0].dist <= 0.5 && v[0].dist > 0.45, 'distanza ' + v[0].dist);
  assert.equal(v[0].limit, 130);
  assert.equal(v[0].over, false);
  assert.ok(tracker.st.veloxNext && tracker.st.veloxNext.v.id === v[0].velox.id);
});

test('autovelox: nel verso opposto niente', () => {
  const {tracker, events} = make();
  tracker.start('gps');
  along(A01S, 304, 306.5, 120).forEach(tracker.pushPosition);
  assert.deepEqual(vx(events), []);
  assert.equal(tracker.st.veloxNext, null);
});

test('autovelox: niente avvisi ripetuti, e dopo averlo superato sparisce', () => {
  const {tracker, events} = make();
  tracker.start('gps');
  const a = along(A01N, 306.2, 305.8, 120);
  a.forEach(tracker.pushPosition);
  along(A01N, 305.8, 305.0, 120, lastT(a)).forEach(tracker.pushPosition);
  assert.equal(vx(events).length, 1);
  assert.equal(tracker.st.veloxNext, null);
});

test('autovelox: partendo a 300 m un solo avviso, con la distanza vera', () => {
  const {tracker, events} = make();
  tracker.start('gps');
  along(A01N, 305.8, 305.6, 120).forEach(tracker.pushPosition);
  const v = vx(events);
  assert.equal(v.length, 1);
  assert.ok(v[0].dist < 0.32, 'distanza ' + v[0].dist);
});

test('autovelox: oltre il limite all\'avviso, avviso forte subito e non ripetuto', () => {
  const {tracker, events} = make();
  tracker.start('gps');
  along(A01N, 307, 305.6, 140).forEach(tracker.pushPosition);
  const v = vx(events);
  assert.deepEqual(v.map(e => [e.type, e.over]), [['velox-alert', true]]);
});

test('autovelox: si supera il limite dopo l\'avviso, un avviso forte', () => {
  const {tracker, events} = make();
  tracker.start('gps');
  const a = along(A01N, 307, 305.9, 120);
  a.forEach(tracker.pushPosition);
  along(A01N, 305.9, 305.6, 140, lastT(a)).forEach(tracker.pushPosition);
  assert.deepEqual(vx(events).map(e => e.type), ['velox-alert', 'velox-over']);
  assert.equal(vx(events)[1].limit, 130);
});

test('autovelox: con gli avvisi spenti niente eventi e niente distanza', () => {
  const {tracker, events} = make({veloxOff: true});
  tracker.start('gps');
  along(A01N, 307, 305.6, 140).forEach(tracker.pushPosition);
  assert.deepEqual(vx(events), []);
  assert.equal(tracker.st.veloxNext, null);
});

test('autovelox: il GPS che oscilla dopo il passaggio non ripete l\'avviso', () => {
  const {tracker, events} = make();
  tracker.start('gps');
  const a = along(A01N, 306.2, 305.4, 120);
  a.forEach(tracker.pushPosition);
  // un punto GPS sbagliato 60 m prima della postazione (dopo 3 s, così non è scartato come salto impossibile)
  const b = along(A01N, 305.56, 305.55, 120, lastT(a) + 2000);
  b.forEach(tracker.pushPosition);
  assert.equal(tracker.st.km.toFixed(2), '305.56', 'il punto sbagliato deve essere accettato');
  along(A01N, 305.4, 305.0, 120, lastT(b) + 2000).forEach(tracker.pushPosition);
  assert.equal(vx(events).length, 1);
});
```

- [ ] **Step 2: Eseguire i test e vedere che falliscono**

Run: `node --test test/tracker.test.js`
Expected: FAIL nei test "autovelox" (nessun evento `velox-*`). Gli altri test passano.

- [ ] **Step 3: Scrivere il codice**

`src/core/network.js`, in `buildNetwork`:

```js
  return {secs, lines, velox: data.velox || []};
```

al posto di `return {secs, lines};`.

`src/core/tracker.js`:
- sotto gli import:

```js
// Distanza in km a cui parte l'avviso di un autovelox; la postazione si può riavvisare solo 200 m dopo averla superata
export const VELOX_KM = 0.5;
const VELOX_RESET_KM = 0.2;
```

- la firma diventa `export function createTracker({secs, lines, settings, velox = []}){`;
- in `st`, aggiungere `veloxNext:null, veloxAlerted:new Set(), veloxOver:new Set()`. In `reset()`, aggiungere `veloxNext:null` all'`Object.assign`, e `st.veloxAlerted = new Set(); st.veloxOver = new Set();` dopo `st.alerted = new Set();`;
- in `pushPosition`:
  - la riga `if (st.onRoad && st.sign) updateSections(prevKm, prevSign);` diventa:

```js
      if (st.onRoad && st.sign){ updateSections(prevKm, prevSign); updateVelox(); } else st.veloxNext = null;
```

  - nel ramo `missStreak >= 6`, dopo `st.alerted.clear();`:

```js
        st.veloxNext = null; st.veloxAlerted.clear(); st.veloxOver.clear();
```

- nuova funzione, dopo `updateSections`:

```js
  // Autovelox davanti (stesso ramo, stesso verso) entro VELOX_KM: un avviso per postazione, e uno forte se si va
  // oltre il limite impostato. Conta la velocità del momento, non la media.
  function updateVelox(){
    st.veloxNext = null;
    if (settings.veloxOff) return;
    for (const v of velox){
      if (v.r !== st.ram || v.sign !== st.sign) continue;
      const d = (v.km - st.km)*v.sign;
      if (d < -VELOX_RESET_KM){ st.veloxAlerted.delete(v.id); st.veloxOver.delete(v.id); }
      if (d >= 0 && d <= VELOX_KM && (!st.veloxNext || d < st.veloxNext.dist)) st.veloxNext = {v, dist:d};
    }
    if (!st.veloxNext) return;
    const {v, dist} = st.veloxNext, over = st.fix.v != null && st.fix.v*3.6 > settings.limit;
    if (!st.veloxAlerted.has(v.id)){
      st.veloxAlerted.add(v.id);
      if (over) st.veloxOver.add(v.id);
      emit('velox-alert', {velox:v, dist, limit:settings.limit, over});
    } else if (over && !st.veloxOver.has(v.id)){
      st.veloxOver.add(v.id);
      emit('velox-over', {velox:v, limit:settings.limit});
    }
  }
```

- in `resetPosition()`, dopo `st.alerted.clear();`:

```js
      st.veloxNext = null; st.veloxAlerted.clear(); st.veloxOver.clear();
```

- [ ] **Step 4: Eseguire i test e vedere che passano**

Run: `node --test test/tracker.test.js && npm test`
Expected: PASS tutti. Il golden non cambia: `test/golden.test.js` crea il tracker senza `velox`.

- [ ] **Step 5: Commit**

```bash
git add src/core/network.js src/core/tracker.js test/tracker.test.js
git commit -m "Tracker: avviso dell'autovelox a 500 m e avviso forte oltre il limite"
```

---

### Task 4: Testi degli avvisi e vista

**Files:**
- Modify: `src/core/messages.js`
- Modify: `src/core/hud-view.js`
- Test: `test/messages.test.js`, `test/hud-view.test.js`

**Interfaces:**
- Consumes: eventi `velox-alert {velox, dist, limit, over}` e `velox-over {velox, limit}`, `st.veloxNext` (Task 3).
- Produces: `announcementFor` per i due eventi; `hudView(st, settings).velox` = `{text, short}` oppure `null`.

- [ ] **Step 1: Scrivere i test che falliscono**

In fondo a `test/messages.test.js` (l'import di `announcementFor` c'è già):

```js
test('autovelox: avviso a 500 metri con il limite', () => {
  assert.deepEqual(announcementFor({type:'velox-alert', velox:{comune:'Meolo'}, dist:0.5, limit:130, over:false}),
    {text:'Autovelox tra 500 metri, limite 130.', tone:'pre'});
  assert.equal(announcementFor({type:'velox-alert', velox:{}, dist:0.28, limit:110, over:false}).text, 'Autovelox tra 300 metri, limite 110.');
});

test('autovelox oltre il limite: avviso forte con vibrazione', () => {
  assert.deepEqual(announcementFor({type:'velox-alert', velox:{}, dist:0.5, limit:130, over:true}),
    {text:'Autovelox tra 500 metri, rallenta: limite 130.', tone:'alarm', vibrate:[220,100,220]});
  assert.deepEqual(announcementFor({type:'velox-over', velox:{}, limit:130}),
    {text:'Autovelox vicino, rallenta: limite 130.', tone:'alarm', vibrate:[220,100,220]});
});
```

In fondo a `test/hud-view.test.js`:

```js
test('autovelox davanti: distanza a passi di 10 m, sotto i 50 m "ora"', () => {
  const st = {...emptyState, veloxNext:{v:{comune:'Meolo'}, dist:0.423}};
  assert.deepEqual(hudView(st, {limit:130, margin:2, preAlert:1}).velox, {text:'Autovelox tra 420 m', short:'420 m'});
  assert.deepEqual(hudView({...st, veloxNext:{v:{}, dist:0.04}}, {limit:130, margin:2, preAlert:1}).velox, {text:'Autovelox ora', short:'ora'});
  assert.equal(hudView(emptyState, {limit:130, margin:2, preAlert:1}).velox, null);
});
```

- [ ] **Step 2: Eseguire i test e vedere che falliscono**

Run: `node --test test/messages.test.js test/hud-view.test.js`
Expected: FAIL. `announcementFor` dà `null` e `velox` è `undefined`.

- [ ] **Step 3: Scrivere il codice**

In `src/core/messages.js`, nello `switch` di `announcementFor`, prima di `default:`:

```js
    case 'velox-alert':
      return ev.over
        ? {text:'Autovelox tra ' + speakDist(ev.dist) + ', rallenta: limite ' + ev.limit + '.', tone:'alarm', vibrate:ALARM_VIBRATION}
        : {text:'Autovelox tra ' + speakDist(ev.dist) + ', limite ' + ev.limit + '.', tone:'pre'};
    case 'velox-over':
      return {text:'Autovelox vicino, rallenta: limite ' + ev.limit + '.', tone:'alarm', vibrate:ALARM_VIBRATION};
```

(`speakDist(0.5)` dà "500 metri", `speakDist(0.28)` dà "300 metri".)

In `src/core/hud-view.js`, nell'oggetto `view`, accanto a `gauge: null, keep: …`:

```js
    gauge: null, keep: {label:'', value:''},
    // autovelox entro 500 m: riga in alto e etichetta nel cerchio (ui/hud.js)
    velox: st.veloxNext ? veloxText(st.veloxNext.dist) : null
```

e in fondo al file:

```js
function veloxText(dist){
  const m = Math.round(dist*100)*10;
  return m < 50 ? {text:'Autovelox ora', short:'ora'} : {text:'Autovelox tra ' + m + ' m', short:m + ' m'};
}
```

- [ ] **Step 4: Eseguire i test e vedere che passano**

Run: `node --test test/messages.test.js test/hud-view.test.js && npm test`
Expected: PASS tutti

- [ ] **Step 5: Commit**

```bash
git add src/core/messages.js src/core/hud-view.js test/messages.test.js test/hud-view.test.js
git commit -m "Testi dell'avviso autovelox e distanza nella vista di guida"
```

---

### Task 5: Pagina: riga in alto, etichetta nel cerchio, interruttore

**Files:**
- Modify: `src/index.html` (markup `#pVelox` nel cerchio, interruttore `#setVelox`)
- Modify: `src/ui/hud.js`, `src/ui/settings-panel.js`, `src/main.js`
- Modify: `src/styles/cartello.css`, `src/styles/pip.css`, `src/styles/app.css`
- Test: `test/build.test.js`

**Interfaces:**
- Consumes: `view.velox` (Task 4), `buildNetwork().velox` (Task 3).
- Produces:
  - id `pVelox` e `pVeloxD` (etichetta nel cerchio), `setVelox` (interruttore);
  - classe `velox` su `#hudRoad small`.

- [ ] **Step 1: Scrivere il test che fallisce**

In `test/build.test.js`, prima di `test('tutte le autostrade: filtro`:

```js
test('autovelox nella pagina: etichetta nel cerchio, riga in alto, interruttore', () => {
  const {app} = buildPages();
  const gauge = app.match(/<div class="gauge">[\s\S]*?<div class="pside">/)[0];
  assert.match(gauge, /<div class="velox-in" id="pVelox" hidden><b>Autovelox<\/b><span id="pVeloxD"><\/span><\/div>/, "manca l'etichetta nel cerchio");
  assert.match(app, /<label class="switch">Avvisi autovelox <input type="checkbox" id="setVelox"><\/label>/);
  // gialla con il bordo scuro, così si vede anche sul cartello giallo; mai sotto 11 px fuori dal riquadro
  assert.match(app, /\.velox-in\{[^}]*background:#F2B21E[^}]*box-shadow:0 0 0 [^}]*#161100/);
  assert.match(app, /html:not\(\.pip\) \.velox-in b,html:not\(\.pip\) \.velox-in span\{font-size:max\(11px, *4\.6cqw\)\}/);
  assert.match(app, /html\.pip \.velox-in b,html\.pip \.velox-in span\{font-size:7cqw\}/);
  assert.match(app, /\.hud-top \.road small\.velox\{[^}]*color:#F2B21E/);
  // il gancio dei collaudi e l'avvio passano gli autovelox al tracker
  assert.match(app, /createTracker\(\{secs, lines, settings, velox\}\)/);
});
```

- [ ] **Step 2: Eseguire il test e vedere che fallisce**

Run: `node --test test/build.test.js`
Expected: FAIL con "manca l'etichetta nel cerchio"

- [ ] **Step 3: Markup, stile e codice**

`src/index.html`, nel `.gauge`, dopo `<div class="keep keep-in">…</div>`:

```html
          <div class="velox-in" id="pVelox" hidden><b>Autovelox</b><span id="pVeloxD"></span></div>
```

e nelle Impostazioni di guida, dopo la riga di `setInst`:

```html
        <label class="switch">Avvisi autovelox <input type="checkbox" id="setVelox"></label>
```

`src/styles/cartello.css`, prima di `/* Sotto il cerchio */`:

```css
/* Autovelox entro 500 m: etichetta gialla in alto nel cerchio, sopra il numero grande. Il bordo scuro la stacca
   anche dal cartello giallo; nel riquadro ha una misura sua (pip.css) */
.velox-in{position:absolute; top:9%; left:50%; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center;
  background:#F2B21E; color:#161100; box-shadow:0 0 0 .6cqw #161100; border-radius:3cqw; padding:.8cqw 3cqw; line-height:1.05;
  font-variant-numeric:tabular-nums; white-space:nowrap}
.velox-in b{font-size:4.6cqw; font-weight:900; letter-spacing:.04em; text-transform:uppercase}
.velox-in span{font-size:4.6cqw; font-weight:800}
html:not(.pip) .velox-in b,html:not(.pip) .velox-in span{font-size:max(11px, 4.6cqw)}
```

`src/styles/pip.css`, in fondo:

```css
/* etichetta dell'autovelox: più grande del resto, il cerchio del riquadro è piccolo */
html.pip .velox-in b,html.pip .velox-in span{font-size:7cqw}
```

`src/styles/app.css`, dopo la regola `.hud-top .road,.hud-top .road small{…}`:

```css
.hud-top .road small.velox{color:#F2B21E; font-weight:800}
```

`src/ui/hud.js`:
- in `renderPlate`, prima di `$('#pProg').hidden = !v.progress;`:

```js
  // autovelox entro 500 m: etichetta in alto nel cerchio
  $('#pVelox').hidden = !v.velox;
  if (v.velox) $('#pVeloxD').textContent = v.velox.short;
```

- in `render`, la riga di `#hudRoad` diventa:

```js
      const sub = v.velox ? '<small class="velox">' + esc(v.velox.text) + '</small>' : v.road.sub ? '<small>' + esc(v.road.sub) + '</small>' : '';
      $('#hudRoad').innerHTML = esc(v.road.title) + (v.road.sim ? '<span class="pill">Simulazione</span>' : '') + sub;
```

`src/ui/settings-panel.js`, dopo il ciclo `[['#setVoice','voice'], …].forEach(…)`:

```js
  // Avvisi autovelox: accesi salvo settings.veloxOff (chiave facoltativa, così le impostazioni predefinite non cambiano)
  const sv = $('#setVelox');
  sv.checked = !settings.veloxOff;
  sv.addEventListener('change', () => { if (sv.checked) delete settings.veloxOff; else settings.veloxOff = true; save(); onChange(); });
```

`src/main.js`:

```js
  const {secs, lines, velox} = buildNetwork(DATA);
```

al posto di `const {secs, lines} = buildNetwork(DATA);`, e

```js
  const tracker = createTracker({secs, lines, settings, velox});
```

al posto di `createTracker({secs, lines, settings})`.

- [ ] **Step 4: Eseguire build e test**

Run: `npm run build && npm test`
Expected: PASS tutti, compreso "la pagina resta leggera" e quelli di accessibilità. L'interruttore è una `label.switch` come le altre.

- [ ] **Step 5: Commit**

```bash
git add src/index.html src/ui/hud.js src/ui/settings-panel.js src/main.js src/styles/cartello.css src/styles/pip.css src/styles/app.css test/build.test.js index.html
git commit -m "Autovelox sullo schermo: riga in alto, etichetta nel cerchio e interruttore nelle impostazioni"
```

---

### Task 6: Testi dell'app e parte legale

**Files:**
- Modify: `src/index.html` (pagine "Come funziona", "Fonti e precisione" e avviso iniziale)
- Modify: `src/core/store.js` (`DISCLAIMER_VERSION = 2`)
- Modify: `termini.html`, `docs/legale/VERIFICA.md`, `docs/ARCHITETTURA.md`, `CLAUDE.md`
- Test: `test/build.test.js`

**Interfaces:**
- Consumes: `tools/autovelox.json` → `fonte.data` (Task 1).
- Produces: `DISCLAIMER_VERSION` vale 2.

**Ruling di progetto:** il testo delle Fonti resta scritto in `src/index.html`, come le altre fonti, invece di essere generato da `veloxFonte`. Un test controlla che la data sia quella di `tools/autovelox.json`. `veloxFonte` resta nei dati per i collaudi. Costo se sbagliato: un elenco nuovo richiede di toccare a mano una frase, e lo ricorda il README.

- [ ] **Step 1: Scrivere il test che fallisce**

In `test/build.test.js`, dopo il test "avviso alla prima apertura…":

```js
test('autovelox nei testi: fonte con la data dell\'elenco, come funziona, avviso iniziale', () => {
  const {app} = buildPages();
  const fonte = JSON.parse(readFileSync(new URL('../tools/autovelox.json', import.meta.url), 'utf8')).fonte;
  const MESI = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
  const [y, m, d] = fonte.data.split('-').map(Number);
  const info = app.match(/<section[^>]*id="pInfo"[\s\S]*?<\/section>/)[0];
  assert.ok(info.includes('aggiornato al ' + d + ' ' + MESI[m - 1] + ' ' + y), 'data della fonte degli autovelox diversa da tools/autovelox.json');
  assert.ok(info.includes(fonte.url), 'manca il collegamento alla pagina della Polizia');
  const how = app.match(/<section[^>]*id="pHow"[\s\S]*?<\/section>/)[0];
  assert.match(how, /autovelox/i);
  const avviso = app.match(/<section[^>]*id="pAvviso"[\s\S]*?<\/section>/)[0];
  assert.match(avviso, /autovelox/);
});
```

E in `test/store.test.js` aggiungere:

```js
test("avviso iniziale alla versione 2: parla anche degli autovelox", () => {
  assert.equal(DISCLAIMER_VERSION, 2);
});
```

- [ ] **Step 2: Eseguire i test e vedere che falliscono**

Run: `node --test test/build.test.js test/store.test.js`
Expected: FAIL. Manca la data della fonte e `DISCLAIMER_VERSION` vale 1.

- [ ] **Step 3: Scrivere i testi**

`src/index.html`:

- nella sezione `#pHow`, dopo il paragrafo sull'accensione del Tutor:

```html
        <p>Autovelox fissi: a 500 metri da una postazione dell'elenco della Polizia l'app avvisa con un segnale e con la voce, e mostra la distanza nella riga in alto e dentro il cerchio. Qui conta la velocità del momento, non la media: se in quel momento vai oltre il limite impostato l'avviso è più forte. Gli avvisi si spengono nelle Impostazioni di guida.</p>
```

- nella sezione `#pInfo`, card "Fonti e precisione", dopo il primo paragrafo:

```html
        <p>Autovelox fissi: <a href="https://www.poliziadistato.it/articolo/175" target="_blank" rel="noopener">elenco delle postazioni sulla rete autostradale della Polizia Stradale</a>, aggiornato al 7 ottobre 2025. L'app segnala le 13 postazioni che si trovano sulle autostrade che segue. Una postazione può essere spenta, spostata o nuova rispetto all'elenco.</p>
```

- nella sezione `#pAvviso`, il paragrafo "I dati possono contenere errori." diventa:

```html
        <p><b>I dati possono contenere errori.</b> La posizione dei portali e degli autovelox, i limiti e i tratti attivi sono ricavati da fonti pubbliche e possono essere sbagliati o non aggiornati: un Tutor può essere spostato, acceso dove l'app non lo indica o spento dove lo indica, un autovelox può essere stato tolto o aggiunto. Anche il GPS del telefono può sbagliare, per esempio in galleria.</p>
```

`src/core/store.js`: `DISCLAIMER_VERSION = 2` (resta il commento sopra).

`termini.html`:
- la data diventa `Ultimo aggiornamento: 6 ottobre 2026 (avviso alla prima apertura, autovelox)`;
- nella lista "Stime, non misure ufficiali", dopo il primo `<li>`:

```html
  <li>Gli autovelox segnalati vengono dall'elenco pubblico delle postazioni fisse della Polizia Stradale, che può non
    essere aggiornato: una postazione può mancare o non esserci più. L'avviso non sostituisce i cartelli, e il limite
    vale in ogni momento.</li>
```

`docs/legale/VERIFICA.md`, nel punto 2 (Termini d'uso), in fondo al paragrafo:

```markdown
Autovelox: l'app segnala le postazioni fisse dell'elenco pubblico della Polizia Stradale (pagina articolo/175,
elenco del 7 ottobre 2025). Segnalarle è lecito: la Polizia le pubblica perché si rispettino i limiti, e il Codice
della Strada (art. 142, comma 6-bis) chiede che le postazioni siano segnalate e ben visibili. Avviso iniziale,
termini e Fonti dicono che l'elenco può non essere aggiornato; l'avviso iniziale è alla versione 2.
```

`docs/ARCHITETTURA.md`, sotto la riga sull'avviso iniziale `#pAvviso`:

```markdown
- Autovelox fissi: elenco in `tools/autovelox.json` (istruzioni in `tools/autovelox.md`). `make-tratti` scrive in
  `tutor-data.json` la lista `velox` (ramo, km, verso). Il tracker emette `velox-alert` a 500 m e `velox-over`
  oltre il limite (`updateVelox`). La vista `velox` va nella riga in alto e nell'etichetta `#pVelox` del cerchio.
  `settings.veloxOff` li spegne.
```

`CLAUDE.md`, nella sezione Comandi, dopo la riga di `npm run schermi`:

```markdown
- Autovelox fissi: elenco della Polizia in `tools/autovelox.json`, come aggiornarlo in `tools/autovelox.md`.
```

- [ ] **Step 4: Build e test**

Run: `npm run build && npm test`
Expected: PASS tutti

- [ ] **Step 5: Commit**

```bash
git add src/index.html src/core/store.js termini.html docs/legale/VERIFICA.md docs/ARCHITETTURA.md CLAUDE.md test/build.test.js test/store.test.js index.html
git commit -m "Autovelox nei testi: come funziona, fonti, avviso iniziale (versione 2), termini e verifica legale"
```

---

### Task 7: Prove sugli schermi e sul telefono, versione

**Files:**
- Modify: `tools/schermi.mjs` (momento "autovelox"), `tools/schermi-casi.mjs` (giudizio dell'etichetta)
- Modify: `tools/device-check.mjs` (controllo nella fase rotazione)
- Modify: `package.json` (versione)
- Test: `test/schermi.test.js`

**Interfaces:**
- Consumes: `#pVelox`, `window.__tutor.LINES`, la simulazione del tratto 81 (A4 San Stino → San Donà, verso Ovest, che prosegue fino all'autovelox di Noventa al km 423,85).
- Produces: `judge(kind, {audit, plate, velox})`, dove `velox = {shown, inside, overlap}` facoltativo.

- [ ] **Step 1: Scrivere il test che fallisce**

In fondo a `test/schermi.test.js`:

```js
test('etichetta autovelox: deve vedersi dentro il cerchio senza coprire la media', () => {
  const ok = judge('guida-verticale', {audit: cleanAudit, plate: goodPlate, velox: {shown: true, inside: true, overlap: false}});
  assert.deepEqual(ok.problems, []);
  const r = judge('guida-verticale', {audit: cleanAudit, plate: goodPlate, velox: {shown: true, inside: false, overlap: true}});
  assert.equal(r.problems.length, 2);
  assert.match(judge('guida-verticale', {audit: cleanAudit, plate: goodPlate, velox: {shown: false}}).problems.join(' '), /manca/);
});
```

- [ ] **Step 2: Eseguire il test e vedere che fallisce**

Run: `node --test test/schermi.test.js`
Expected: FAIL (`problems` vuoto per l'etichetta mancante)

- [ ] **Step 3: Giudizio, momento nella prova sugli schermi e controllo sul telefono**

`tools/schermi-casi.mjs`, in `judge`, la firma diventa `export function judge(kind, {audit, plate, velox}){`. Prima di `return {problems, notes};`:

```js
  if (velox){
    if (!velox.shown) problems.push("manca l'etichetta dell'autovelox nel cerchio");
    else {
      if (!velox.inside) problems.push("l'etichetta dell'autovelox esce dal cerchio");
      if (velox.overlap) problems.push("l'etichetta dell'autovelox copre la media");
    }
  }
```

`tools/schermi.mjs`:
- in `SETUP`, prima di `return true;`, la guida lungo una carreggiata a velocità costante:

```js
  // guida lungo una carreggiata (id di window.__tutor.LINES) da un km all'altro, una posizione al secondo
  window.__drive = (id, from, to, kmh) => {
    const P = window.__tutor.LINES.find(l => l.id === id).pts;
    const at = km => { for (let i = 0; i < P.length - 1; i++){ const a = P[i], b = P[i+1];
      if (a[2] !== b[2] && (km - a[2])*(km - b[2]) <= 0){ const f = (km - a[2])/(b[2] - a[2]); return [a[0] + f*(b[0] - a[0]), a[1] + f*(b[1] - a[1])]; } } return null; };
    const dir = Math.sign(to - from); let prev = null, t = Date.now() - 600000;
    for (let km = from; (to - km)*dir > 0; km += dir*kmh/3600){
      const p = at(km); if (!p) return false;
      const hd = prev ? (Math.atan2((p[1] - prev[1])*Math.cos(p[0]*Math.PI/180), p[0] - prev[0])*180/Math.PI + 360) % 360 : null;
      deliver({coords: {latitude: p[0], longitude: p[1], accuracy: 6, speed: kmh/3.6, heading: hd}, timestamp: t += 1000});
      prev = p;
    }
    return true;
  };
```

- dopo il ciclo dei `MOMENTS` e il click su `hudExit`, un momento in più: A1 verso Nord, 420 m prima dell'autovelox di Bagno a Ripoli (km 305,5):

```js
      // Autovelox: A1 verso Nord fino a 420 m dalla postazione di Bagno a Ripoli (km 305,5)
      await open(c0, true);
      await ev(`document.getElementById('btnDrive').click(); true`);
      if (!await ev(`__drive('A01N', 307.2, 305.92, 120)`)) throw new Error(c0.id + ': guida verso l\'autovelox non riuscita');
      await sleep(450);
      const plateV = {...await call(plateForm), ...await ev(`(() => { const h = document.querySelector('.hud'); return {scroll: h.scrollHeight, view: h.clientHeight, y: Math.round(scrollY)}; })()`)};
      const velox = await ev(`(() => { const e = document.getElementById('pVelox'), g = document.querySelector('.gauge').getBoundingClientRect(), b = document.getElementById('pBig').getBoundingClientRect();
        if (e.hidden) return {shown: false}; const r = e.getBoundingClientRect();
        return {shown: true, inside: r.left >= g.left && r.right <= g.right && r.top >= g.top && r.bottom <= g.bottom,
          overlap: r.bottom > b.top + 1 && r.top < b.bottom - 1 && r.right > b.left && r.left < b.right}; })()`);
      await add('guida-autovelox', plateV.form === 'orizzontale' ? 'guida-orizzontale' : 'guida-verticale', {audit: await call(pageAudit), plate: plateV, velox}, true);
      await ev(`document.getElementById('hudExit').click(); true`);
```

`tools/device-check.mjs`, in `phaseRotation`, prima di `// gira a sinistra (rotazione 1)`:

```js
  // Autovelox con la simulazione: tratto 81 (A4 verso Venezia), poi la postazione di Noventa di Piave al km 423,85
  await js(`(() => { document.getElementById('hudExit').click(); document.getElementById('simSec').value = '81'; document.getElementById('simV').value = '125';
    document.getElementById('btnSimStart').click(); window.__tutor.simControls.stopTimer(); return true; })()`);
  const seen = await stepUntil(`!document.getElementById('pVelox').hidden`);
  const vx = await js(`(() => { const e = document.getElementById('pVelox').getBoundingClientRect(), g = document.querySelector('.gauge').getBoundingClientRect();
    return {inside: e.top >= g.top && e.bottom <= g.bottom && e.left >= g.left && e.right <= g.right, road: document.querySelector('#hudRoad small').textContent,
      toast: document.getElementById('toast').textContent}; })()`);
  check('Autovelox (A4, Noventa di Piave): etichetta nel cerchio, riga in alto e avviso', seen && vx.inside && /^Autovelox tra \d+ m$/.test(vx.road)
    && /^Autovelox tra \d+ metri/.test(vx.toast), JSON.stringify(vx));
  screenshot('guida-autovelox.png');
  await js(`(() => { document.getElementById('hudExit').click(); document.getElementById('simSec').value = '15'; document.getElementById('simV').value = '160';
    document.getElementById('btnSimStart').click(); window.__tutor.simControls.stopTimer(); return true; })()`);
  await stepUntil('p === "alarm"');
```

(Si torna al tratto 15 in allarme perché i controlli dopo, col telefono girato, si aspettano quello stato.)

- [ ] **Step 4: Eseguire test, prova sugli schermi e collaudo sul telefono**

Run: `node --test test/schermi.test.js && npm test`
Expected: PASS tutti

Run: `npm run schermi`
Expected: nessun problema nuovo. In ogni caso c'è `guida-autovelox` senza problemi; restano solo i casi già noti dei telefoni piccoli. Guardare nel resoconto le schermate `guida-autovelox` di 320×520, 360×734 e un orizzontale: l'etichetta deve stare sopra il numero e leggersi.

Run: `npm version patch --no-git-tag-version && npm run sync && (cd android && JAVA_HOME="/c/Program Files/Java/jdk-21" ./gradlew installDebug -Pprova=true) && npm run device-check`
Expected: `Tutti i controlli superati`, compreso "Autovelox (A4, Noventa di Piave)…". Guardare `device-check/guida-autovelox.png`.

- [ ] **Step 5: Commit**

```bash
git add tools/schermi.mjs tools/schermi-casi.mjs tools/device-check.mjs test/schermi.test.js package.json package-lock.json index.html
git commit -m "Prove dell'autovelox su tutti gli schermi e sul telefono; versione 1.0.4"
```
