// Impostazioni di guida: pannello laterale, limiti nella schermata di guida, pulsante Audio
import { nf1 } from '../core/format.js';
import { LIMITS, thresholdFor, thrText } from '../core/rules.js';
import { $ } from './dom.js';

export function createSettingsPanel({settings, save, onChange, say}){
  function renderLimitChips(){
    const box = $('#setLimits'); box.innerHTML = '';
    const hbox = $('#hudLimits'); hbox.querySelectorAll('.hchip').forEach(x => x.remove());
    LIMITS.forEach(([v, lab]) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chip';
      b.setAttribute('aria-pressed', String(settings.limit === v));
      b.textContent = lab ? v + ' ' + lab : String(v);
      b.addEventListener('click', () => setLimit(v));
      box.appendChild(b);
      const h = document.createElement('button'); h.type = 'button'; h.className = 'hchip';
      h.setAttribute('aria-pressed', String(settings.limit === v)); h.textContent = v;
      h.addEventListener('click', () => { setLimit(v); say('Limite impostato a ' + v, null, true); });
      hbox.appendChild(h);
    });
  }
  function setLimit(v){ settings.limit = v; save(); renderLimitChips(); renderMargin(); onChange(); }
  function renderMargin(){
    $('#setMargin').value = settings.margin;
    $('#marginOut').textContent = settings.margin + ' km/h';
    $('#marginHelp').textContent = 'Con limite ' + settings.limit + ' la soglia di sanzione è ' + thrText(settings.limit) + ' km/h: l\'allarme scatta quando la media arriva a ' + nf1.format(thresholdFor(settings.limit) - settings.margin) + ' km/h. Sopra ' + settings.limit + ' la schermata diventa gialla.';
  }
  function renderMute(){
    const on = settings.voice || settings.beep, b = $('#hudMute');
    b.textContent = on ? 'Audio sì' : 'Audio no';
    b.setAttribute('aria-pressed', String(!on));
  }
  $('#setMargin').addEventListener('input', e => { settings.margin = +e.target.value; save(); renderMargin(); onChange(); });
  $('#setPre').value = String(settings.preAlert);
  $('#setPre').addEventListener('change', e => { settings.preAlert = +e.target.value; save(); });
  [['#setVoice','voice'],['#setBeep','beep'],['#setInst','instWarn']].forEach(([id, k]) => {
    const el = $(id); el.checked = !!settings[k];
    el.addEventListener('change', () => { settings[k] = el.checked; save(); renderMute(); });
  });
  $('#hudMute').addEventListener('click', () => {
    const on = settings.voice || settings.beep;
    settings.voice = !on; settings.beep = !on; save();
    $('#setVoice').checked = settings.voice; $('#setBeep').checked = settings.beep; renderMute();
  });
  renderLimitChips(); renderMargin(); renderMute();
}
