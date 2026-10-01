// Collaudo del riquadro Picture-in-Picture nel browser del PC. Finge di essere dentro l'app (Capacitor finto
// e ponte nativo), guida i percorsi di scenarios.json con la pagina in modalità riquadro e, a ogni cambio di
// cartello, misura cosa si vede. Controlla anche che la X del riquadro (evento tutorpipclosed) termini la guida.
// Uso: apri http://localhost:5173/www/index.html (dopo npm run build o npm run sync), porta la finestra alla
// misura del riquadro data da tools/device-check.mjs, poi nella console:
//   (await import('/tools/pip-harness.mjs?' + Date.now())).run('pip-layout.json')
import { GOLDEN_SETTINGS } from './golden-harness.mjs';

export async function run(name = 'pip-layout.json'){
  if (!window.__tutor) throw new Error('window.__tutor mancante: la pagina non si è avviata');
  if (JSON.stringify(window.__tutor.settings) !== JSON.stringify(GOLDEN_SETTINGS)){
    localStorage.setItem('tutorA1.v1.settings', JSON.stringify(GOLDEN_SETTINGS));
    location.reload();
    return 'Impostazioni del collaudo salvate e pagina ricaricata: esegui di nuovo run().';
  }
  if (!(window.Capacitor && window.Capacitor.finto)){
    const plugin = () => new Proxy({}, {get: (_, m) => m === 'then' ? undefined : () => Promise.resolve(m === 'isSupported' ? {supported: true} : {})});
    window.Capacitor = {finto: true, isNativePlatform: () => true, registerPlugin: plugin};
    await new Promise((ok, ko) => { const s = document.createElement('script'); s.src = 'tutor-native.js?finto'; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
    document.dispatchEvent(new Event('DOMContentLoaded'));
  }
  const scenarios = await (await fetch('/test/fixtures/scenarios.json')).json();
  let deliver = null;
  Object.defineProperty(navigator, 'geolocation', {configurable: true, value: {
    watchPosition(ok){ deliver = ok; return 1; }, clearWatch(){}, getCurrentPosition(){}
  }});
  Object.defineProperty(navigator, 'vibrate', {configurable: true, value: () => true});
  const el = id => document.getElementById(id);
  const vis = sel => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== 'none' && r.width > 0 && r.height > 0; };
  const inside = (r, b) => r.left >= b.left - 1 && r.right <= b.right + 1 && r.top >= b.top - 1 && r.bottom <= b.bottom + 1;
  const cut = id => el(id).scrollWidth > el(id).clientWidth + 1;
  const measure = () => ({
    visible: ['.mapwrap', '.side', '.hud-top', '.stats', '.advice', '.hud-limits', '.simbar', '.toast'].filter(vis),
    plateInside: inside(el('plate').getBoundingClientRect(), {left: 0, top: 0, right: innerWidth, bottom: innerHeight}),
    bigInside: inside(el('pBig').getBoundingClientRect(), document.querySelector('.plate-in').getBoundingClientRect()),
    titleCut: cut('pTitle'), subCut: cut('pSub'),
    bigPx: Math.round(parseFloat(getComputedStyle(el('pBig')).fontSize))
  });

  window.dispatchEvent(new CustomEvent('tutorpip', {detail: true}));
  const out = [];
  for (const sc of scenarios){
    el('histClear').click();
    el('btnDrive').click();
    const frames = [];
    let last = null;
    sc.fixes.forEach((f, i) => {
      deliver({coords: {latitude: f.lat, longitude: f.lon, accuracy: f.accuracy, speed: f.speed, heading: f.heading}, timestamp: f.t});
      const kicker = el('pKicker').textContent, title = el('pTitle').textContent;
      if (kicker + '|' + title === last) return;
      last = kicker + '|' + title;
      frames.push(Object.assign({fix: i, kicker, title}, measure()));
    });
    // la X del riquadro: il ponte nativo riceve "tutorpipclosed" e deve terminare la guida
    window.dispatchEvent(new Event('tutorpipclosed'));
    const closedByX = !window.__tutor.st.running && !document.body.classList.contains('driving');
    window.dispatchEvent(new Event('tutorpipclosed'));
    const idleCloseHarmless = !window.__tutor.st.running && !document.body.classList.contains('driving');
    out.push({name: sc.name, size: {w: innerWidth, h: innerHeight}, frames, closedByX, idleCloseHarmless});
  }
  window.dispatchEvent(new CustomEvent('tutorpip', {detail: false}));
  const res = await fetch('/__save/' + name, {method: 'PUT', body: JSON.stringify(out)});
  return res.status + ' ' + out.map(o => o.name + ': ' + o.frames.length + ' cartelli' + (o.closedByX ? '' : ', X NON termina la guida')).join('; ');
}
