// Cosa mostrare nella schermata di guida, calcolato dallo stato del tracker. Non tocca la pagina:
// ui/hud.js applica la vista.
import { nf0, nf1, nf12, nfKm, nfL, fmtDur, fmtDist } from './format.js';
import { thresholdFor, thrText, verdictOf, avgValue, colorLimits } from './rules.js';
import { RAMS } from './network.js';
import { computeMetrics, adviceText, keepText } from './metrics.js';

export function hudView(st, settings){
  const f = st.fix, lim = settings.limit, thr = thresholdFor(lim), {red} = colorLimits(settings);
  const vNow = f && f.v != null ? f.v*3.6 : null;
  const speed = vNow != null ? nf0.format(vNow) : '–';
  const sim = st.source === 'sim';
  const view = {
    stats: {lim, thr:thrText(lim), thrLabel: Math.abs(red - thr) > 1e-6 ? 'soglia, allarme a ' + (Number.isInteger(red) ? red : nf1.format(red)) : 'soglia con tolleranza',
            inst:speed, instHot: vNow != null && vNow > thr},
    road: !f ? {title:'In attesa del segnale GPS', sim, sub:''}
      : st.onRoad && st.ram ? {title:RAMS[st.ram].name + ', km ' + nf1.format(st.km), sim,
          sub:(st.sign ? (st.sign > 0 ? RAMS[st.ram].plus : RAMS[st.ram].minus) : 'direzione da determinare') + ', precisione GPS ' + nf0.format(f.acc) + ' m'}
      : {title:'Fuori dalle autostrade seguite', sim, sub:'Precisione GPS ' + nf0.format(f.acc) + ' m'},
    plate: null, progress: null, advice: '',
    gauge: null, keep: {label:'', value:''},
    // autovelox entro 500 m: riga in alto e etichetta nel cerchio (ui/hud.js)
    velox: st.veloxNext ? veloxText(st.veloxNext.dist) : null
  };
  const keep = (label, value = '') => { view.keep = {label, value}; };
  const plate = (cls, kicker, title, big, unit, sub) => { view.plate = {cls, kicker, title, big, unit, sub}; };

  if (st.active){
    const a = st.active, s = a.sec, m = computeMetrics(a, f, st.km, settings);
    plate(m.status, a.mid ? 'Tutor in corso, media parziale' : 'Tutor in corso', s.name,
      m.avg != null ? nfL.format(avgValue(m.avg, lim, 0)) : '–', 'km/h di media',
      nf1.format(m.dist/1000) + ' km percorsi in ' + fmtDur(m.elapsed) + (m.proj != null && m.settled ? ', a questo ritmo chiudi a ' + nf0.format(m.proj) : ''));
    view.progress = {from:'km ' + nfKm.format(s.ka), to:'mancano ' + fmtDist(m.remKm)};
    view.advice = adviceText(m);
    view.gauge = {frac: m.rel / s.L};
    view.keep = keepText(m);
  } else if (st.result && f && f.t < st.result.until){
    const r = st.result, [vt, vc] = verdictOf(r.avg, r.lim);
    plate(vc === 'ok' ? 'done-ok' : vc === 'tol' ? 'done-tol' : 'done-bad', 'Tratto concluso' + (r.partial ? ', misura parziale' : ''), r.sec.name,
      r.avg != null ? nf12.format(avgValue(r.avg, r.lim, 1)) : '–', 'km/h di media', vt.charAt(0).toUpperCase() + vt.slice(1) + ', tempo ' + fmtDur(r.dur));
    view.gauge = {frac: 1};
    keep('tratto concluso', vc === 'ok' ? 'in regola' : vc === 'tol' ? 'in tolleranza' : 'oltre la soglia');
    view.advice = st.next ? 'Prossimo Tutor tra ' + fmtDist(st.next.dist) + '.' : '';
  } else if (!f){
    plate('', 'Avvio', 'Sto cercando la tua posizione', '–', '', 'Il monitoraggio parte appena il GPS ti trova su un\'autostrada dell\'elenco.');
    keep('cerco il GPS');
  } else if (!st.onRoad){
    plate('', 'Fuori dalle autostrade seguite', 'Il monitoraggio parte quando entri in un\'autostrada dell\'elenco', speed, 'km/h', '');
    keep('fuori autostrada');
  } else if (!st.sign){
    plate('', 'Sulla ' + RAMS[st.ram].name, 'Sto capendo in che direzione vai', speed, 'km/h', '');
    keep('cerco la direzione');
  } else if (st.next){
    const n = st.next, near = n.dist <= settings.preAlert + 0.05;
    const eta = vNow && vNow > 20 ? ', circa ' + fmtDur(n.dist/vNow*3600) : '';
    const meters = n.dist < 0.95;
    const big = meters ? nf0.format(Math.max(10, Math.round(n.dist*100)*10)) : nf1.format(n.dist);
    plate(near ? 'go' : '', near ? 'Il Tutor sta per iniziare' : 'Prossimo Tutor', n.sec.name, big, meters ? 'm al portale' : 'km al portale',
      'Tratto di ' + nfL.format(n.sec.L) + ' km' + eta);
    keep('limite', String(lim));
    view.advice = near ? 'Limite ' + lim + ': al portale di inizio parte il calcolo della media.' : '';
  } else {
    plate('', 'Nessun Tutor più avanti', 'In questa direzione non ci sono altri tratti controllati', speed, 'km/h', '');
    keep('nessun Tutor avanti');
  }
  return view;
}

function veloxText(dist){
  const m = Math.round(dist*100)*10;
  // text per la riga in alto (stretta sul telefono), short per la fascia nel cerchio, che dice già AUTOVELOX
  return m < 50 ? {text:'Velox ora', short:'ora'} : {text:'Velox ' + m + ' m', short:m + ' m'};
}
