// Avvio dell'app: crea i pezzi di core/ (calcolo) e ui/ (pagina) e li collega.
// È l'unico file che conosce entrambi: vedi docs/ARCHITETTURA.md.
import { buildNetwork } from './core/network.js';
import { thresholdFor } from './core/rules.js';
import { createStore } from './core/store.js';
import { createTracker, toHistoryEntry } from './core/tracker.js';
import { announcementFor } from './core/messages.js';
import { hudView } from './core/hud-view.js';
import { createSimulator } from './core/simulator.js';
import { gpsDeniedMessage } from './platform.js';
import { $ } from './ui/dom.js';
import { createSidebar } from './ui/sidebar.js';
import { createSettingsPanel } from './ui/settings-panel.js';
import { createHistoryPanel } from './ui/history-panel.js';
import { createHud } from './ui/hud.js';
import { createAudio } from './ui/audio.js';
import { createSimControls } from './ui/sim-controls.js';
import { createNav } from './ui/nav.js';
import { applyTheme } from './ui/theme.js';

function boot(){
  const DATA = JSON.parse(document.getElementById('tutor-data').textContent);
  const {secs, lines} = buildNetwork(DATA);
  let storage = null;
  try { storage = window.localStorage; } catch(e){}
  const store = createStore(storage);
  const settings = store.settings;
  applyTheme(document.documentElement, settings.theme);
  const tracker = createTracker({secs, lines, settings});
  const st = tracker.st;
  const simulator = createSimulator({secs, lines});
  const hud = createHud();
  const audio = createAudio(settings);

  // Un avviso: testo sullo schermo, segnale acustico e (se non muto) voce
  function say(text, kind, silentVoice){
    hud.toast(text);
    if (kind) audio.tones(kind);
    if (!silentVoice) audio.speak(text, kind);
  }
  function announce(a){
    if (!a) return;
    say(a.text, a.tone, a.silentVoice);
    if (a.vibrate) audio.vibrate(a.vibrate);
  }
  function render(){
    if (!st.running) return;
    const v = hudView(st, settings);
    hud.render(v);
  }

  /* ---------- schermate fuori dalla guida ---------- */
  const nav = createNav({win: window, show: id => document.querySelectorAll('.screen').forEach(s => { s.hidden = s.id !== id; })});
  document.addEventListener('click', e => {
    const go = e.target.closest('[data-go]');
    if (go){ nav.go(go.dataset.go); return; }
    if (e.target.closest('[data-back]')) nav.back();
  });
  // Tasto Indietro di Android (MainActivity.java): true se la pagina ha chiuso il menù o una pagina
  window.tutorBack = () => !document.body.classList.contains('driving') && nav.back();

  createSidebar({secs, settings, onSimulate: (id, v) => simControls.start(id, v)});
  createSettingsPanel({settings, save: () => store.saveSettings(), onChange: () => { tracker.refresh(); render(); }, say});
  const historyPanel = createHistoryPanel(store);

  tracker.on(ev => {
    switch (ev.type){
      case 'section-start': hud.flash(); break;
      case 'section-finish': store.addHistory(toHistoryEntry(ev.result, Date.now())); historyPanel.render(); hud.flash(); break;
      case 'pre-alert': hud.flash(); break;
      case 'position': render(); break;
    }
    announce(announcementFor(ev));
  });

  /* ---------- guida ---------- */
  const run = {watchId:null, wake:null, dog:null};
  async function keepAwake(){ try { if ('wakeLock' in navigator && document.visibilityState === 'visible') run.wake = await navigator.wakeLock.request('screen'); } catch(e){} }
  document.addEventListener('visibilitychange', () => { if (st.running && document.visibilityState === 'visible') keepAwake(); });

  function enterDrive(source){
    audio.init();
    tracker.start(source);
    document.body.classList.add('driving');
    $('#simBar').hidden = source !== 'sim';
    keepAwake(); render();
    window.scrollTo(0, 0);
    if (run.dog) clearInterval(run.dog);
    run.dog = setInterval(watchdog, 1000);
  }
  function stopDrive(){
    if (run.watchId != null){ try { navigator.geolocation.clearWatch(run.watchId); } catch(e){} run.watchId = null; }
    simControls.stopTimer();
    tracker.stop();
    if (run.dog){ clearInterval(run.dog); run.dog = null; }
    try { if (run.wake) run.wake.release(); } catch(e){} run.wake = null;
    audio.cancel();
    document.body.classList.remove('driving');
  }
  $('#hudExit').addEventListener('click', stopDrive);

  function gpsNote(html, good){ const n = $('#gpsNote'); n.innerHTML = html; n.hidden = !html; n.classList.toggle('good', !!good); }
  $('#btnDrive').addEventListener('click', () => {
    gpsNote('');
    if (!('geolocation' in navigator)){ gpsNote('Questo browser non offre la posizione GPS. Prova un altro browser oppure usa la simulazione.'); return; }
    enterDrive('gps');
    try {
      run.watchId = navigator.geolocation.watchPosition(tracker.pushPosition, onGpsError, {enableHighAccuracy:true, maximumAge:0, timeout:20000});
    } catch(e){ onGpsError({code:2, message:String(e)}); }
  });
  function onGpsError(e){
    if (e && e.code === 1){
      stopDrive();
      gpsNote(gpsDeniedMessage());
      nav.home();
    } else if (st.running){
      hud.gpsTrouble(e && e.code === 3 ? 'Segnale GPS lento ad arrivare' : 'GPS non disponibile al momento');
    }
  }
  function watchdog(){
    if (!st.running || st.source !== 'gps' || !st.fix) return;
    const gap = Date.now()/1000 - st.lastWall;
    if (gap > 6) hud.signalLost(gap, settings.limit, !!st.active);
  }

  const simControls = createSimControls({secs, simulator, enterDrive, pushPosition: tracker.pushPosition,
    resetPosition: tracker.resetPosition, say});

  window.__tutor = {st, sim: simulator.sim, SECS: secs, LINES: lines, thresholdFor, settings, tracker};
}

boot();
