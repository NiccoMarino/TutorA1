// Collaudo "golden": guida la pagina aperta con 5 percorsi GPS fissi e registra, posizione per posizione,
// la schermata di guida, gli avvisi e le vibrazioni; alla fine lo storico. Salva in test/fixtures/<nome>.
// Uso nel browser integrato, sulla pagina servita da tools/serve.mjs:
//   (await import('/tools/golden-harness.mjs?' + Date.now())).run('golden.json')
export const GOLDEN_SETTINGS = {limit:130, margin:2, preAlert:1, voice:false, beep:false, instWarn:true};

export async function run(name = 'golden.json'){
  const SKEY = 'tutorA1.v1.settings';
  if (!window.__tutor) throw new Error('window.__tutor mancante: la pagina non si è avviata');
  if (JSON.stringify(window.__tutor.settings) !== JSON.stringify(GOLDEN_SETTINGS)){
    localStorage.setItem(SKEY, JSON.stringify(GOLDEN_SETTINGS));
    location.reload();
    return 'Impostazioni del collaudo salvate e pagina ricaricata: esegui di nuovo run().';
  }
  const scenarios = await (await fetch('/test/fixtures/scenarios.json')).json();
  let deliver = null;
  Object.defineProperty(navigator, 'geolocation', {configurable: true, value: {
    watchPosition(ok){ deliver = ok; return 1; }, clearWatch(){}, getCurrentPosition(){}
  }});
  const vib = [];
  Object.defineProperty(navigator, 'vibrate', {configurable: true, value: p => { vib.push(p); return true; }});
  const el = id => document.getElementById(id);
  const toastObs = new MutationObserver(() => {});
  toastObs.observe(el('toast'), {childList: true});

  const out = [];
  for (const sc of scenarios){
    el('histClear').click();
    el('btnDrive').click();
    toastObs.takeRecords();
    const frames = sc.fixes.map(f => {
      vib.length = 0;
      deliver({coords: {latitude: f.lat, longitude: f.lon, accuracy: f.accuracy, speed: f.speed, heading: f.heading}, timestamp: f.t});
      const prog = !el('pProg').hidden;
      return {
        pKicker: el('pKicker').textContent, pTitle: el('pTitle').textContent, pBig: el('pBig').textContent,
        pUnit: el('pUnit').textContent, pSub: el('pSub').textContent, advice: el('advice').textContent,
        hudRoad: el('hudRoad').textContent, sInst: el('sInst').textContent, sLim: el('sLim').textContent,
        sThr: el('sThr').textContent, sThrL: el('sThrL').textContent,
        plate: el('plate').className.replace(' flash', ''), prog,
        fill: prog ? el('pFill').style.width : null, pFrom: prog ? el('pFrom').textContent : null, pTo: prog ? el('pTo').textContent : null,
        toasts: toastObs.takeRecords().flatMap(r => [...r.addedNodes].map(n => n.textContent)),
        vib: vib.slice()
      };
    });
    el('hudExit').click();
    const history = JSON.parse(localStorage.getItem('tutorA1.v1.history') || '[]').map(({t, ...h}) => h).reverse();
    out.push({name: sc.name, frames, history});
  }
  const res = await fetch('/__save/' + name, {method: 'PUT', body: JSON.stringify(out)});
  return res.status + ' ' + out.map(o => o.name + ': ' + o.frames.length + ' posizioni, ' + o.history.length + ' tratti').join('; ');
}
