// Pannello "Tratti percorsi"
import { esc, nf1 } from '../core/format.js';
import { verdictOf } from '../core/rules.js';
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
        ': media <span class="v ' + vc + '">' + (h.avg != null ? nf1.format(h.avg) + ' km/h' : 'n/d') + '</span>, ' + vt + ' (limite ' + h.lim + ')' +
        (h.partial ? ', misura parziale' : '') + (h.sim ? ', simulazione' : '');
      ul.appendChild(li);
    });
  }
  $('#histClear').addEventListener('click', () => { store.clearHistory(); render(); });
  render();
  return {render};
}
