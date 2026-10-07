// Differenze tra la pagina aperta nel browser e la stessa pagina dentro l'app Android (Capacitor)
export function isNativeApp(){
  try {
    const cap = typeof window !== 'undefined' && window.Capacitor;
    return !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  } catch (e) { return false; }
}

// Nome dell'app come lo mostra Android (android/app/src/main/res/values/strings.xml, app_name)
export const APP_NAME = 'TutOK';

export function gpsDeniedMessage(){
  if (isNativeApp()) return 'La posizione è bloccata. Apri le impostazioni del telefono, vai su App &gt; ' + APP_NAME + ' &gt; Autorizzazioni &gt; Posizione e scegli <b>Consenti solo mentre l’app è in uso</b> o <b>Consenti sempre</b>. Intanto puoi usare la simulazione.';
  return 'La posizione è bloccata. Controlla che il browser abbia il permesso di usarla (di solito nel lucchetto accanto all\'indirizzo) e che la pagina sia aperta da un indirizzo https. Intanto puoi usare la simulazione.';
}
