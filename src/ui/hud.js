// Schermata di guida: applica alla pagina la vista calcolata da core/hud-view.js. Nessun calcolo qui.
import { esc } from '../core/format.js';
import { $ } from './dom.js';

// Cartello (#plate): testi, numero grande, velocità da tenere e arco di avanzamento. La forma (verticale, orizzontale,
// riquadro) la decide solo lo stile: styles/cartello.css, orizzontale.css, pip.css.
function renderPlate(v){
  const p = $('#plate'), pl = v.plate;
  p.className = 'plate ' + pl.cls + (p.classList.contains('flash') ? ' flash' : '');
  $('#pKicker').textContent = pl.kicker; $('#pTitle').textContent = pl.title;
  $('#pBig').textContent = pl.big; $('#pUnit').textContent = pl.unit; $('#pSub').textContent = pl.sub;
  // il numero si rimpicciolisce quando è lungo ("136,75") per restare dentro il cerchio
  $('#pBigBox').dataset.len = String(Math.min(6, Math.max(3, pl.big.length)));
  // velocità da tenere: dentro il cerchio (verticale, riquadro) e a destra (orizzontale)
  p.querySelectorAll('.keep').forEach(k => {
    k.querySelector('.kl').textContent = v.keep.label; k.querySelector('.kv').textContent = v.keep.value;
  });
  // arco aperto (270°) e anello intero: con pathLength 100 la parte piena è in centesimi del giro.
  // L'anello ha un decimale come la percentuale del tratto, che il collaudo golden legge da qui.
  const frac = v.gauge ? Math.max(0, Math.min(1, v.gauge.frac)) : 0;
  $('#pArc').style.strokeDasharray = (frac*75).toFixed(2) + ' 100';
  $('#pRing').style.strokeDasharray = (frac*100).toFixed(1) + ' 100';
  p.querySelector('.gauge').classList.toggle('noarc', frac === 0);
  // autovelox entro 500 m: etichetta in alto nel cerchio
  $('#pVelox').hidden = !v.velox;
  if (v.velox) $('#pVeloxD').textContent = v.velox.short;
  $('#pProg').hidden = !v.progress;
  if (v.progress){ $('#pFrom').textContent = v.progress.from; $('#pTo').textContent = v.progress.to; }
}

export function createHud(){
  let flashT = null;
  return {
    render(v){
      $('#sLim').textContent = v.stats.lim; $('#sThr').textContent = v.stats.thr; $('#sThrL').textContent = v.stats.thrLabel;
      $('#sInst').textContent = v.stats.inst;
      $('#stInst').classList.toggle('hot', v.stats.instHot);
      $('#hudLimChoice').querySelectorAll('.hchip').forEach(h => h.setAttribute('aria-pressed', String(+h.dataset.v === v.stats.lim)));
      // con un autovelox entro 500 m la seconda riga dice quanto manca, al posto di direzione e precisione GPS
      const sub = v.velox ? '<small class="velox">' + esc(v.velox.text) + '</small>' : v.road.sub ? '<small>' + esc(v.road.sub) + '</small>' : '';
      $('#hudRoad').innerHTML = esc(v.road.title) + (v.road.sim ? '<span class="pill">Simulazione</span>' : '') + sub;
      renderPlate(v);
      $('#advice').textContent = v.advice;
    },
    toast(text){ $('#toast').textContent = text; },
    flash(){
      const p = $('#plate'); p.classList.remove('flash'); void p.offsetWidth; p.classList.add('flash');
      clearTimeout(flashT); flashT = setTimeout(() => p.classList.remove('flash'), 2000);
    },
    // GPS muto da qualche secondo (galleria): resta così fino alla prossima posizione
    signalLost(gap, limit, inSection){
      const sub = $('#hudRoad small');
      if (sub){ sub.className = ''; sub.textContent = 'Segnale GPS assente da ' + Math.round(gap) + ' s, forse sei in galleria'; }
      if (inSection) $('#advice').textContent = 'Senza GPS la media si aggiorna all\'uscita della galleria. Mantieni il limite di ' + limit + '.';
    },
    gpsTrouble(text){ $('#hudRoad').firstChild.textContent = text; }
  };
}
