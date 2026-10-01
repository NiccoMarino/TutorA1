// Differenze tra la pagina aperta nel browser e la stessa pagina dentro l'app Android (Capacitor)
export function isNativeApp(){
  try {
    const cap = typeof window !== 'undefined' && window.Capacitor;
    return !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  } catch (e) { return false; }
}

export function gpsDeniedMessage(){
  if (isNativeApp()) return 'La posizione è bloccata. Apri le impostazioni del telefono, vai su App &gt; Tutor A1 A4 &gt; Autorizzazioni &gt; Posizione e scegli <b>Consenti solo mentre l’app è in uso</b> o <b>Consenti sempre</b>. Intanto puoi usare la simulazione.';
  return 'La posizione è bloccata. Controlla che il browser abbia il permesso di usarla. Se stai usando l\'app dentro Claude, il visualizzatore può non concederla: scarica l\'app dalla sezione <b>Dati, precisione e uso fuori da Claude</b> e aprila dal browser del telefono. Intanto puoi usare la simulazione.';
}
