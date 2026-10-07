// Pannello "Tratti percorsi"
import { esc, nf12 } from '../core/format.js';
import { verdictOf, avgValue } from '../core/rules.js';
import { $ } from './dom.js';

export function createHistoryPanel(store){
  function render(){
    const ul = $('#hist'); ul.innerHTML = '';
    const history = store.history;
    if (!history.length){ ul.innerHTML = '<li>Qui compariranno i tratti che percorri con la modalità guida, con la media rilevata.</li>'; return; }
    history.slice(0, 30).forEach(h => {
      const d = new Date(h.t);
      const [vt, vc] = verdictOf(h.avg, h.lim);
      const li = document.createElement('li');
      li.innerHTML = '<b>' + esc(h.da + ' → ' + h.a) + '</b><br>' + d.toLocaleDateString('it-IT', {day:'numeric', month:'short'}) + ', ' + d.toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'}) +
        ': media <span class="v ' + vc + '">' + (h.avg != null ? nf12.format(avgValue(h.avg, h.lim, 1)) + ' km/h' : 'n/d') + '</span>, ' + vt + ' (limite ' + h.lim + ')' +
        (h.partial ? ', misura parziale' : '') + (h.sim ? ', simulazione' : '');
      ul.appendChild(li);
    });
  }
  // Cancella subito (anche per i collaudi automatici, che toccano il pulsante una volta) e per 10 secondi si può
  // annullare: lo storico tolto resta in memoria finché non scade o si esce dalla pagina
  let undo = null, undoT = null;
  function endUndo(){ clearTimeout(undoT); undo = null; $('#histUndo').hidden = true; $('#histMsg').textContent = ''; }
  $('#histClear').addEventListener('click', () => {
    const old = store.history.slice();
    store.clearHistory(); render();
    if (!old.length) return;
    endUndo(); undo = old;
    $('#histUndo').hidden = false; $('#histMsg').textContent = 'Storico cancellato.';
    undoT = setTimeout(endUndo, 10000);
  });
  $('#histUndo').addEventListener('click', () => {
    if (undo) store.restoreHistory(undo);
    endUndo(); render(); $('#histMsg').textContent = 'Storico ripristinato.';
  });
  render();
  return {render};
}
