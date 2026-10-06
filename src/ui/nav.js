// Schermate fuori dalla guida: la schermata iniziale, il menù e le sue pagine, una sopra l'altra.
// Ogni apertura è una voce nella cronologia del browser, così il tasto Indietro (del browser, o di Android
// tramite window.tutorBack in main.js) le richiude in ordine. show(id) mostra la schermata con quell'id.
// start è la prima schermata: di solito home, l'avviso (pAvviso) finché non è stato accettato.
export function createNav({win, show, start = 'home'}){
  let depth = 0, cur = 'home';
  function display(id){ cur = id; show(id); win.scrollTo(0, 0); }

  win.history.replaceState({screen: start, depth: 0}, '');
  win.addEventListener('popstate', e => {
    const s = e.state || {screen: 'home', depth: 0};
    depth = s.depth || 0;
    display(s.screen || 'home');
  });
  display(start);

  return {
    current: () => cur,
    go(id){
      if (id === cur) return;
      if (id === 'home') return this.home();
      depth++;
      win.history.pushState({screen: id, depth}, '');
      display(id);
    },
    // true se ha chiuso qualcosa; false sulla schermata iniziale (lì Indietro esce dall'app)
    back(){
      if (depth === 0) return false;
      win.history.back();
      return true;
    },
    home(){ if (depth > 0) win.history.go(-depth); },
    // Sostituisce la schermata in fondo alla cronologia (dall'avviso alla schermata iniziale)
    replace(id){
      win.history.replaceState({screen: id, depth}, '');
      display(id);
    }
  };
}
