// Impostazioni: pagina Impostazioni di guida (con il tema), limiti nella schermata di guida, pulsante Audio
import { nf1 } from '../core/format.js';
import { LIMITS, thrText, colorLimits, YELLOW_CHOICES, RED_CHOICES } from '../core/rules.js';
import { $ } from './dom.js';
import { THEMES, applyTheme } from './theme.js';

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
  function setLimit(v){ settings.limit = v; save(); renderLimitChips(); renderColors(); onChange(); }
  // Colori del cartello: giallo da, rosso (e allarme) da. Le scelte sono relative al limite (core/rules.js)
  const fmt = v => Number.isInteger(v) ? String(v) : nf1.format(v);
  const redKey = () => settings.redOff != null ? 'l:' + settings.redOff : 'm:' + (settings.margin || 0);
  function fill(sel, choices, cur){
    sel.innerHTML = '';
    for (const c of choices){ const o = document.createElement('option'); o.value = c.key; o.textContent = c.label; sel.appendChild(o); }
    sel.value = cur;
  }
  function renderColors(){
    const lim = settings.limit, {yellow, red} = colorLimits(settings), key = redKey();
    fill($('#setYellow'), YELLOW_CHOICES(lim).map(c => ({...c, key: String(c.value)})), String(settings.yellowOff || 0));
    fill($('#setRed'), RED_CHOICES(lim, key), key);
    $('#marginHelp').textContent = 'Con limite ' + lim + ' la soglia di sanzione è ' + thrText(lim) + ' km/h. Il cartello diventa giallo sopra '
      + fmt(yellow) + ' km/h di media e rosso, con l\'allarme, da ' + fmt(red) + ' km/h.'
      + (yellow >= red ? ' Il giallo parte dopo il rosso, quindi si vedrà solo il rosso.' : '');
  }
  $('#setYellow').addEventListener('change', e => {
    const off = +e.target.value; if (off) settings.yellowOff = off; else delete settings.yellowOff;
    save(); renderColors(); onChange();
  });
  $('#setRed').addEventListener('change', e => {
    const [kind, v] = e.target.value.split(':');
    if (kind === 'l') settings.redOff = +v; else { settings.margin = +v; delete settings.redOff; }
    save(); renderColors(); onChange();
  });
  function renderMute(){
    const on = settings.voice || settings.beep, b = $('#hudMute');
    b.textContent = on ? 'Audio sì' : 'Audio no';
    b.setAttribute('aria-pressed', String(!on));
  }
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
  function renderTheme(){
    const box = $('#setTheme'); box.innerHTML = '';
    const cur = THEMES.some(t => t[0] === settings.theme) ? settings.theme : 'auto';
    THEMES.forEach(([v, lab]) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chip';
      b.setAttribute('aria-pressed', String(cur === v)); b.textContent = lab;
      b.addEventListener('click', () => { settings.theme = v; save(); applyTheme(document.documentElement, v); renderTheme(); });
      box.appendChild(b);
    });
  }
  renderLimitChips(); renderColors(); renderMute(); renderTheme();
}
