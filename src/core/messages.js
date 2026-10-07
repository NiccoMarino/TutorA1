// Cosa dire (e con quale segnale e vibrazione) per ogni evento del tracker.
// Restituisce {text, tone, silentVoice?, vibrate?} oppure null se l'evento non va annunciato.
import { speakDist, spk, nfL } from './format.js';
import { verdictOf, avgValue } from './rules.js';

const ALARM_VIBRATION = [220,100,220];
const ABORT_TEXT = {
  'direction': 'Direzione cambiata: misura del tratto interrotta.',
  'gps-unstable': 'Segnale GPS instabile: misura del tratto interrotta.',
  'off-road': 'Sei uscito dal tracciato: misura del tratto interrotta.'
};

export function endText(r){
  const [vt] = verdictOf(r.avg, r.lim);
  return 'Fine Tutor. Media ' + (r.avg != null ? nfL.format(avgValue(r.avg, r.lim, 0)) + ' chilometri orari, ' + vt : 'non disponibile') + '.';
}

export function announcementFor(ev){
  switch (ev.type){
    case 'pre-alert':
      return {text:'Tra ' + speakDist(ev.dist) + ' inizia il Tutor, da ' + spk(ev.sec.da) + ' a ' + spk(ev.sec.a) + ', ' + speakDist(ev.sec.L) + '. Limite ' + ev.limit + '.', tone:'pre'};
    case 'section-start': {
      const s = ev.sec;
      if (ev.after) return {text:endText(ev.after) + ' Subito dopo inizia il Tutor fino a ' + spk(s.a) + ', ' + speakDist(s.L) + '.', tone:'start', vibrate:120};
      if (ev.mid) return {text:'Sei dentro il tratto Tutor da ' + spk(s.da) + ' a ' + spk(s.a) + '. Media calcolata da qui.', tone:'soft', vibrate:120};
      return {text:'Inizio Tutor. ' + speakDist(s.L) + ' fino a ' + spk(s.a) + '.', tone:'start', vibrate:120};
    }
    case 'section-end':
      return {text:endText(ev.result), tone:'end'};
    case 'section-abort':
      return ev.reason ? {text:ABORT_TEXT[ev.reason], tone:'soft'} : null;
    case 'alarm':
      return {text: ev.repeat ? 'Media ancora oltre la soglia.' : 'Attenzione, media oltre la soglia. Rallenta.', tone:'alarm', vibrate:ALARM_VIBRATION};
    case 'alarm-cleared':
      return {text:'Media rientrata sotto la soglia.', tone:'soft'};
    case 'instant-over':
      return {text:'Velocità oltre ' + ev.limit, tone:'inst', silentVoice:ev.silentVoice};
    // senza numero: il limite nel punto dell'autovelox può essere diverso da quello impostato (cantieri, pioggia, 110)
    case 'velox-alert':
      return ev.over
        ? {text:'Autovelox tra ' + speakDist(ev.dist) + ', rallenta.', tone:'alarm', vibrate:ALARM_VIBRATION}
        : {text:'Autovelox tra ' + speakDist(ev.dist) + '.', tone:'pre'};
    case 'velox-over':
      return {text:'Autovelox vicino, rallenta.', tone:'alarm', vibrate:ALARM_VIBRATION};
    default:
      return null;
  }
}
