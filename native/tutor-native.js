/*
 * Ponte tra la pagina web (index.html) e i servizi nativi del telefono.
 * Dentro l'app Capacitor sostituisce le API del browser che la WebView di Android
 * non offre o gestisce male, così index.html non va modificato:
 *   navigator.geolocation -> BackgroundGeolocation (GPS attivo anche a schermo spento)
 *   speechSynthesis       -> TextToSpeech (voce nativa)
 *   navigator.wakeLock    -> KeepAwake (schermo sempre acceso)
 *   navigator.vibrate     -> Haptics
 * Nel browser normale non fa nulla.
 */
(function () {
  var Cap = window.Capacitor;
  if (!Cap || !Cap.isNativePlatform || !Cap.isNativePlatform()) return;

  function define(obj, name, value) {
    try { Object.defineProperty(obj, name, { value: value, configurable: true, writable: true }); }
    catch (e) { try { obj[name] = value; } catch (e2) {} }
  }
  function ignore() {}

  // Plugin nostro (Picture-in-Picture e permesso notifiche), vedi TutorPipPlugin.java
  var Pip = Cap.registerPlugin('TutorPip');

  /* ---------- GPS ---------- */
  var BG = Cap.registerPlugin('BackgroundGeolocation');
  var watches = new Map();
  var seq = 0;

  function toPosition(l) {
    return {
      timestamp: l.time || Date.now(),
      coords: {
        latitude: l.latitude, longitude: l.longitude, accuracy: l.accuracy,
        altitude: l.altitude, altitudeAccuracy: l.altitudeAccuracy,
        heading: l.bearing, speed: l.speed
      }
    };
  }
  function toError(e) {
    var denied = e && e.code === 'NOT_AUTHORIZED';
    return { code: denied ? 1 : 2, message: (e && e.message) || String(e), PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };
  }
  // background = true mostra la notifica fissa di Android e tiene vivo il GPS a schermo spento
  function addWatch(ok, err, background) {
    var id = ++seq, entry = { nativeId: null, cancelled: false };
    watches.set(id, entry);
    var opts = { requestPermissions: true, stale: false, distanceFilter: 0 };
    if (background) {
      opts.backgroundTitle = 'Monitoraggio Tutor attivo';
      opts.backgroundMessage = 'Sto seguendo la posizione per calcolare la velocità media nei tratti.';
    }
    // Android 13+: prima il permesso per la notifica fissa, altrimenti il GPS gira senza che si veda
    var ready = background ? Pip.requestNotifications().catch(ignore) : Promise.resolve();
    ready.then(function () {
      if (entry.cancelled) return;
      return BG.addWatcher(opts, function (loc, e) {
        if (entry.cancelled) return;
        if (e) { if (err) err(toError(e)); return; }
        if (loc) ok(toPosition(loc));
      }).then(function (nativeId) {
        entry.nativeId = nativeId;
        if (entry.cancelled) BG.removeWatcher({ id: nativeId }).catch(ignore);
      });
    }).catch(function (e) { if (err) err(toError(e)); });
    return id;
  }
  var geo = {
    watchPosition: function (ok, err) { return addWatch(ok, err, true); },
    clearWatch: function (id) {
      var entry = watches.get(id);
      if (!entry) return;
      entry.cancelled = true;
      watches.delete(id);
      if (entry.nativeId) BG.removeWatcher({ id: entry.nativeId }).catch(ignore);
    },
    getCurrentPosition: function (ok, err) {
      var id = addWatch(function (p) { geo.clearWatch(id); ok(p); },
                        function (e) { geo.clearWatch(id); if (err) err(e); }, false);
    }
  };
  define(navigator, 'geolocation', geo);

  /* ---------- Voce ---------- */
  var TTS = Cap.registerPlugin('TextToSpeech');
  function Utterance(text) {
    this.text = text || ''; this.lang = 'it-IT'; this.rate = 1; this.pitch = 1; this.volume = 1; this.voice = null;
  }
  var voices = [{ name: 'Android', lang: 'it-IT', default: true, localService: true, voiceURI: 'android-it-IT' }];
  var synth = {
    speaking: false, pending: false, paused: false, onvoiceschanged: null,
    getVoices: function () { return voices; },
    speak: function (u) {
      synth.speaking = true;
      TTS.speak({ text: u.text, lang: u.lang || 'it-IT', rate: u.rate || 1, pitch: u.pitch || 1,
                  volume: u.volume == null ? 1 : u.volume, queueStrategy: 1 })
        .catch(ignore).then(function () { synth.speaking = false; });
    },
    cancel: function () { synth.speaking = false; TTS.stop().catch(ignore); },
    pause: ignore, resume: ignore,
    addEventListener: ignore, removeEventListener: ignore
  };
  define(window, 'SpeechSynthesisUtterance', Utterance);
  define(window, 'speechSynthesis', synth);

  /* ---------- Schermo acceso ---------- */
  var KeepAwake = Cap.registerPlugin('KeepAwake');
  define(navigator, 'wakeLock', {
    request: function () {
      return KeepAwake.keepAwake().then(function () {
        return {
          type: 'screen', released: false,
          release: function () { this.released = true; return KeepAwake.allowSleep(); },
          addEventListener: ignore, removeEventListener: ignore
        };
      });
    }
  });

  /* ---------- Vibrazione ---------- */
  var Haptics = Cap.registerPlugin('Haptics');
  define(navigator, 'vibrate', function (pattern) {
    var parts = Array.isArray(pattern) ? pattern : [pattern], t = 0;
    parts.forEach(function (d, i) {
      d = Number(d) || 0;
      if (i % 2 === 0 && d > 0) setTimeout(function () { Haptics.vibrate({ duration: d }).catch(ignore); }, t);
      t += d;
    });
    return true;
  });

  /* ---------- Riquadro Picture-in-Picture ----------
   * Durante la guida, uscendo dall'app (per aprire Maps o Waze) resta una finestrella
   * con il cartello del Tutor: prossimo tratto e km al portale, oppure la media nel tratto.
   * Lo stile del riquadro è in src/styles/pip.css (attivo con la classe "pip" su <html>). */

  window.addEventListener('tutorpip', function (e) {
    document.documentElement.classList.toggle('pip', !!e.detail);
    // Tornando a schermo intero la mappa deve ricalcolare le sue dimensioni
    if (!e.detail) setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 300);
  });

  // Chiusa la finestrella con la X: la guida finisce (come premere "Esci"), niente GPS acceso di nascosto
  window.addEventListener('tutorpipclosed', function () {
    var exit = document.getElementById('hudExit');
    if (document.body.classList.contains('driving') && exit) exit.click();
  });

  document.addEventListener('DOMContentLoaded', function () {
    // Il riquadro si attiva solo in modalità guida (classe "driving" sul body)
    var driving = null;
    function sync() {
      var now = document.body.classList.contains('driving');
      if (now === driving) return;
      driving = now;
      Pip.setEnabled({ enabled: now }).catch(ignore);
    }
    new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    sync();

    // Pulsante per aprire il riquadro a mano, accanto ad "Audio"
    Pip.isSupported().then(function (r) {
      var mute = document.getElementById('hudMute');
      if (!r.supported || !mute) return;
      var b = document.createElement('button');
      b.className = 'hbtn';
      b.type = 'button';
      b.textContent = 'Riquadro';
      b.title = 'Riduci a finestrella per usare Maps o Waze';
      b.addEventListener('click', function () { Pip.enter().catch(ignore); });
      mute.parentNode.insertBefore(b, mute);
    }).catch(ignore);
  });
})();
