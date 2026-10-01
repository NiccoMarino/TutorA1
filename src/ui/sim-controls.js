// Comandi della simulazione: scelta del tratto, velocità, tempo accelerato, salto al prossimo Tutor
import { clamp } from '../core/format.js';
import { GROUPS } from '../core/network.js';
import { $ } from './dom.js';

export function createSimControls({secs, simulator, enterDrive, pushPosition, resetPosition, say}){
  const sim = simulator.sim;
  let timer = null;

  const sel = $('#simSec');
  GROUPS.forEach(g => {
    const og = document.createElement('optgroup'); og.label = g;
    secs.filter(s => s.t === g).sort((a, b) => (b.pos - a.pos) || (a.ka - b.ka) * a.sign).forEach(s => {
      const o = document.createElement('option'); o.value = s.id; o.textContent = s.name + ' (Dir. ' + s.d + ')'; og.appendChild(o);
    });
    sel.appendChild(og);
  });
  $('#btnSimOpen').addEventListener('click', () => { const box = $('#simSetup'); box.hidden = !box.hidden; $('#btnSimOpen').setAttribute('aria-expanded', String(!box.hidden)); });
  $('#btnSimStart').addEventListener('click', () => start(+sel.value, clamp(+$('#simV').value || 125, 50, 170)));
  [1,5,15].forEach(w => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'hchip'; b.textContent = '×' + w; b.dataset.w = w;
    b.setAttribute('aria-pressed', String(w === 1)); b.title = 'Tempo accelerato ' + w + ' volte';
    b.addEventListener('click', () => { sim.warp = w; document.querySelectorAll('#simWarp .hchip').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
    $('#simWarp').appendChild(b);
  });
  $('#simSpeed').addEventListener('input', e => { sim.speed = +e.target.value; $('#simSpeedOut').textContent = sim.speed + ' km/h'; });
  $('#simJump').addEventListener('click', () => {
    if (!sim.line) return;
    const n = simulator.nextSection();
    if (!n){ say('Nessun altro Tutor in questa direzione.', null, true); return; }
    resetPosition();
    simulator.jumpBefore(n);
  });

  function stopTimer(){ if (timer){ clearInterval(timer); timer = null; } }
  function tick(){
    const p = simulator.step();
    if (!p){ stopTimer(); say('Fine del percorso simulato.', 'soft'); return; }
    pushPosition(p);
  }
  function start(id, v){
    if (!simulator.setup(id, v, Date.now()/1000)) return;
    $('#simSpeed').value = v; $('#simSpeedOut').textContent = v + ' km/h';
    enterDrive('sim');
    stopTimer();
    timer = setInterval(tick, 500);
    tick();
  }
  return {start, stopTimer};
}
