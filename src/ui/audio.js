// Segnali acustici, voce e vibrazione. Legge le impostazioni (voice, beep) a ogni chiamata.
const TONES = {pre:[[660,.16],[880,.22]], start:[[880,.12],[880,.12],[1175,.28]], alarm:[[1320,.14],[1320,.14],[1320,.14],[990,.3]], end:[[880,.16],[660,.16],[523,.3]], soft:[[740,.18]], inst:[[1175,.12],[1175,.12]]};

export function createAudio(settings){
  let actx = null, itVoice = null;
  function pickVoice(){ try { const vs = speechSynthesis.getVoices(); itVoice = vs.find(v => /^it(-|_)IT/i.test(v.lang)) || vs.find(v => /^it/i.test(v.lang)) || null; } catch(e){} }
  try { speechSynthesis.onvoiceschanged = pickVoice; pickVoice(); } catch(e){}

  return {
    // Va chiamata da un tocco dell'utente (Avvia guida, simulazione): i browser bloccano l'audio partito da soli
    init(){
      try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch(e){ actx = null; }
      try { if (window.speechSynthesis) speechSynthesis.getVoices(); } catch(e){}
    },
    tones(kind){
      const seq = TONES[kind];
      if (!seq || !settings.beep || !actx) return;
      let t = actx.currentTime + 0.02;
      seq.forEach(([f, d]) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g).connect(actx.destination); o.start(t); o.stop(t + d + 0.02); t += d + 0.06;
      });
    },
    speak(text, kind){
      if (!settings.voice || !window.speechSynthesis) return;
      try {
        if (kind === 'alarm' || kind === 'start' || kind === 'end') speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text); u.lang = 'it-IT'; if (itVoice) u.voice = itVoice; u.rate = 1.03;
        setTimeout(() => speechSynthesis.speak(u), kind ? 700 : 0);
      } catch(e){}
    },
    cancel(){ try { speechSynthesis.cancel(); } catch(e){} },
    vibrate(p){ try { if (navigator.vibrate) navigator.vibrate(p); } catch(e){} }
  };
}
