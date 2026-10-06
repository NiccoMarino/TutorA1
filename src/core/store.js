// Impostazioni e storico dei tratti, salvati in localStorage (o in un oggetto simile; null = solo in memoria).
// Le chiavi non vanno cambiate: contengono i dati di chi usa già l'app.
export const SKEY = 'tutorA1.v1.settings', HKEY = 'tutorA1.v1.history';
// Avviso alla prima apertura (schermata pAvviso di index.html): si salva il numero della versione accettata.
// Se si cambia il testo dell'avviso, si aumenta DISCLAIMER_VERSION e l'avviso ricompare una volta a tutti.
export const AKEY = 'tutorA1.v1.avviso', DISCLAIMER_VERSION = 2;
export const DEFAULT_SETTINGS = {limit:130, margin:2, preAlert:1, voice:true, beep:true, instWarn:true, theme:'auto'};

export function createStore(storage){
  const get = (k, d) => { try { const v = storage.getItem(k); return v == null ? d : JSON.parse(v); } catch(e){ return d; } };
  const set = (k, v) => { try { storage.setItem(k, JSON.stringify(v)); } catch(e){} };
  const settings = Object.assign({}, DEFAULT_SETTINGS, get(SKEY, {}) || {});
  let history = get(HKEY, []);
  if (!Array.isArray(history)) history = [];
  let accepted = get(AKEY, 0);
  return {
    settings,
    saveSettings(){ set(SKEY, settings); },
    get history(){ return history; },
    addHistory(entry){ history.unshift(entry); history = history.slice(0, 60); set(HKEY, history); },
    clearHistory(){ history = []; set(HKEY, history); },
    disclaimerAccepted(){ return accepted === DISCLAIMER_VERSION; },
    acceptDisclaimer(){ accepted = DISCLAIMER_VERSION; set(AKEY, accepted); },
    // Cancella tutto quello che l'app conserva (storico e impostazioni): torna come appena installata
    clearAll(){
      for (const k of [SKEY, HKEY, AKEY]){ try { storage.removeItem(k); } catch(e){} }
      history = []; accepted = 0;
      for (const k of Object.keys(settings)) delete settings[k];
      Object.assign(settings, DEFAULT_SETTINGS);
    }
  };
}
