// Schermata di guida: applica alla pagina la vista calcolata da core/hud-view.js. Nessun calcolo qui.
import { esc } from '../core/format.js';
import { $ } from './dom.js';

export function createHud(){
  let flashT = null;
  return {
    render(v){
      $('#sLim').textContent = v.stats.lim; $('#sThr').textContent = v.stats.thr; $('#sThrL').textContent = v.stats.thrLabel;
      $('#sInst').textContent = v.stats.inst;
      $('#stInst').classList.toggle('hot', v.stats.instHot);
      $('#hudLimits').querySelectorAll('.hchip').forEach(h => h.setAttribute('aria-pressed', String(+h.textContent === v.stats.lim)));
      $('#hudRoad').innerHTML = esc(v.road.title) + (v.road.sim ? '<span class="pill">Simulazione</span>' : '') + '<small>' + esc(v.road.sub) + '</small>';
      const p = $('#plate'), pl = v.plate;
      p.className = 'plate ' + pl.cls + (p.classList.contains('flash') ? ' flash' : '');
      $('#pKicker').textContent = pl.kicker; $('#pTitle').textContent = pl.title;
      $('#pBig').textContent = pl.big; $('#pUnit').textContent = pl.unit; $('#pSub').textContent = pl.sub;
      const prog = $('#pProg');
      prog.hidden = !v.progress;
      if (v.progress){
        $('#pFill').style.width = v.progress.fill;
        $('#pFrom').textContent = v.progress.from;
        $('#pTo').textContent = v.progress.to;
      }
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
      if (sub) sub.textContent = 'Segnale GPS assente da ' + Math.round(gap) + ' s, forse sei in galleria';
      if (inSection) $('#advice').textContent = 'Senza GPS la media si aggiorna all\'uscita della galleria. Mantieni il limite di ' + limit + '.';
    },
    gpsTrouble(text){ $('#hudRoad').firstChild.textContent = text; }
  };
}
