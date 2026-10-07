# Pubblicare TutOK sul Play Store

Guida passo passo. Le parti già pronte nel repository:

| Cosa | Dove |
|---|---|
| App con nome, icona, versione 1.0.0 e firma configurabile | `android/`, `package.json` |
| Informativa sulla privacy | `privacy.html` → https://niccomarino.github.io/TutorA1/privacy.html |
| Testi della scheda dello store | `docs/play-store/SCHEDA.md` |
| Icona, grafica di primo piano, 5 schermate | `docs/play-store/grafica/` |
| Risposte ai moduli (privacy, contenuti, servizio in primo piano) | `docs/play-store/MODULI.md` |

Tempi da mettere in conto: verifica dell'account Google qualche giorno, test chiuso **almeno 14 giorni**,
revisione di Google da qualche ora a una settimana.

---

## 1. Mettere online l'informativa
Unisci il ramo `play-store` a `main` con una pull request, come per il README. Dopo un paio di minuti
https://niccomarino.github.io/TutorA1/privacy.html deve aprirsi: Google la controlla.

## 2. Creare la chiave di firma (una volta sola)
La chiave firma ogni versione che carichi. **Non va mai su GitHub** (il repository la ignora già) e va salvata
anche altrove (chiavetta, cloud personale). Se la perdi, con la firma gestita da Google (passo 6) puoi
chiederne una nuova al supporto, ma è una perdita di tempo.

In PowerShell (ti chiede una password: sceglila tu e conservala):
```powershell
New-Item -ItemType Directory -Force C:\Users\Nicco\chiavi
& "C:\Program Files\Java\jdk-21\bin\keytool.exe" -genkeypair -v -keystore C:\Users\Nicco\chiavi\mediavelocita-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```
Poi copia `android/keystore.properties.example` in `android/keystore.properties` e scrivi le due password
(la stessa due volte, se a keytool hai dato una sola password).

## 3. Creare il pacchetto per Google (AAB)
```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"; npm run bundle
```
Il file è `android/app/build/outputs/bundle/release/app-release.aab`.
Per ogni aggiornamento successivo: `npm version patch` (1.0.0 → 1.0.1) e di nuovo `npm run bundle`.
Google rifiuta un AAB con lo stesso numero di versione di uno già caricato.

## 4. Account sviluppatore
1. https://play.google.com/console → crea un account **personale**. Costo: 25 $ una volta sola.
2. Completa la verifica dell'identità (documento) e del telefono. Può richiedere qualche giorno.
3. Indirizzo di contatto per gli utenti: niccofantini2000@gmail.com.

## 5. Creare l'app nella console
"Crea app": nome **TutOK**, lingua predefinita **Italiano – it-IT**, **App**, **Gratuita**, accetta le
dichiarazioni. Attenzione: una volta pubblicata come gratuita non può avere un prezzo d'acquisto, ma può vendere
un abbonamento dentro l'app (Google Play Billing): per l'abbonamento annuale pensato resta **Gratuita**.
Prima di vendere leggi `docs/legale/ABBONAMENTO-BOZZA.md` e `docs/legale/VERIFICA.md` (dati del venditore
pubblicati da Google, condizioni, rimborsi).

## 6. Compilare la console
1. **Contenuti dell'app**: tutte le sezioni, con le risposte di `MODULI.md`. Per il servizio in primo piano
   serve un breve video su YouTube "non in elenco" (istruzioni in `MODULI.md`).
2. **Scheda dello store principale**: testi di `SCHEDA.md` e immagini di `grafica/`.
3. **Impostazioni dello store**: categoria Mappe e navigazione, email di contatto.
4. Alla prima release accetta **Firma dell'app di Play** (Google conserva la chiave definitiva, tu quella di
   caricamento del passo 2).

## 7. Test chiuso (obbligatorio per gli account personali)
Google chiede almeno **12 tester iscritti per 14 giorni di fila** prima di aprire l'app a tutti.
1. Test > **Test chiuso** > crea una traccia, carica `app-release.aab`, paesi: Italia.
2. Tester: crea un elenco con le email Google (quelle usate sul Play Store) di **almeno 15 persone**, così
   resti sopra 12 se qualcuno esce. Chi esce e rientra fa ripartire i suoi 14 giorni.
3. Manda a tutti il **link di partecipazione**: devono accettare e installare l'app dal Play Store.
4. Chiedi di usarla davvero (anche in simulazione) e di scriverti un commento: dopo Google chiede come è
   andato il test.

## 8. Produzione
1. Dopo 14 giorni: Dashboard > **Richiedi l'accesso alla produzione** e rispondi al questionario sul test.
2. Quando arriva l'ok: Produzione > crea release > usa lo stesso AAB (o uno nuovo), note di
   `SCHEDA.md`, paesi: Italia > invia per la revisione.

## 9. Sul tuo telefono
L'app "Tutor A1 A4" installata dal PC ha lo stesso identificativo ma un'altra firma: prima di installare
TutOK dal Play Store va **disinstallata** (lo storico dei tratti si perde). "Tutor prova" è separata
e può restare.

---

## Se cambi qualcosa più avanti
- **Nome**: `android/app/src/main/res/values/strings.xml`, `capacitor.config.json`, `APP_NAME` in
  `src/platform.js` (un test controlla che coincidano), `privacy.html`, `SCHEDA.md`, il testo della grafica in
  `tools/make-icons.mjs` (poi `npm run grafica`). Nel Play Store il nome si cambia con un aggiornamento della scheda.
- **Pubblicità**: account AdMob, sezioni "Annunci" e "Sicurezza dei dati" da rifare, `privacy.html` da
  aggiornare prima.
- **Mappa**: è stata tolta (versione senza mappa, ottobre 2026). Rimetterla vuol dire riprendere Leaflet e un
  fornitore di mappe con chiave (dal ramo `play-store` prima del commit "Via la mappa"), e rifare privacy e moduli.
- **Icona o schermate**: modifica `tools/make-icons.mjs` o `tools/store-screenshots.mjs`, poi `npm run grafica`.

## Da sapere
- Le posizioni dei Tutor sono pubblicate da Autostrade e dalla Polizia di Stato e le mostrano anche i
  navigatori; Google Play ammette le app che le segnalano. Per un dubbio legale specifico serve un avvocato.
- Il nome "Tutor" è usato solo per descrivere il sistema; nella scheda è scritto che l'app non è ufficiale.
- Prima di uscire, prova l'AAB sul telefono con il test chiuso: è la prima volta che gira una versione
  "release", firmata e senza strumenti di debug.
