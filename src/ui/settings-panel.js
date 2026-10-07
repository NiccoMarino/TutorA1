// Impostazioni: pagina Impostazioni di guida (con il tema), limiti nella schermata di guida, pulsante Audio
import { nf1 } from '../core/format.js';
import { LIMITS, thrText, colorLimits, YELLOW_CHOICES, RED_CHOICES } from '../core/rules.js';
import { $ } from './dom.js';
import { THEMES, applyTheme } from './theme.js';

export function createSettingsPanel({settings, save, onChange, say, go, back}){
  // Limiti: pulsanti nella pagina Impostazioni e, in guida, una scelta che si apre dal pulsante "Limite 130" (chiusa,
  // così non si cambia il limite con un tocco per sbaglio). Stesse scritte in tutti e due i posti ("110 pioggia").
  const limBtn = $('#hudLimBtn'), limBox = $('#hudLimChoice');
  function openLimits(open){ limBox.hidden = !open; limBtn.setAttribute('aria-expanded', String(open)); }
  limBtn.addEventListener('click', () => openLimits(limBox.hidden));
  function renderLimitChips(){
    const box = $('#setLimits'); box.innerHTML = ''; limBox.innerHTML = '';
    LIMITS.forEach(([v, lab]) => {
      const text = lab ? v + ' ' + lab : String(v);
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chip';
      b.setAttribute('aria-pressed', String(settings.limit === v)); b.textContent = text;
      b.addEventListener('click', () => setLimit(v));
      box.appendChild(b);
      const h = document.createElement('button'); h.type = 'button'; h.className = 'hchip lim'; h.dataset.v = v;
      h.setAttribute('aria-pressed', String(settings.limit === v)); h.textContent = text;
      h.addEventListener('click', () => { setLimit(v); openLimits(false); limBtn.focus(); say('Limite impostato a ' + v, null, true); });
      limBox.appendChild(h);
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
  // Il pulsante dice lo stato ("Audio sì/no"), il suggerimento cosa succede toccandolo. Niente aria-pressed: con la
  // scritta che cambia, "Audio no, premuto" si capiva al contrario
  function renderMute(){
    const on = settings.voice || settings.beep, b = $('#hudMute');
    b.textContent = on ? 'Audio sì' : 'Audio no';
    b.title = on ? 'Tocca per spegnere voce e suoni' : 'Tocca per riaccendere voce e suoni';
  }
  $('#setPre').value = String(settings.preAlert);
  $('#setPre').addEventListener('change', e => { settings.preAlert = +e.target.value; save(); });
  [['#setVoice','voice'],['#setBeep','beep'],['#setInst','instWarn']].forEach(([id, k]) => {
    const el = $(id); el.checked = !!settings[k];
    el.addEventListener('change', () => { settings[k] = el.checked; save(); renderMute(); });
  });
  // Avvisi autovelox: accesi salvo settings.veloxOff (chiave facoltativa, così le impostazioni predefinite non cambiano)
  const sv = $('#setVelox');
  sv.checked = !settings.veloxOff;
  sv.addEventListener('change', () => { if (sv.checked) delete settings.veloxOff; else settings.veloxOff = true; save(); onChange(); });
  // Numero calcolato anche sopra il limite (settings.keepReal, facoltativa): per accenderlo si passa sempre
  // dall'avviso #pOltre e lo si accetta; Annulla o Indietro lo lasciano spento. Spegnerlo non chiede niente.
  const kr = $('#setKeepReal');
  kr.checked = !!settings.keepReal;
  kr.addEventListener('change', () => {
    if (kr.checked){ kr.checked = false; go('pOltre'); return; }
    delete settings.keepReal; save(); onChange();
  });
  $('#oltreOk').addEventListener('click', () => { settings.keepReal = true; kr.checked = true; save(); onChange(); back(); });
  $('#oltreNo').addEventListener('click', () => back());
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
