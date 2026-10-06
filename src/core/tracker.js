// La guida: riceve le posizioni GPS (o simulate) e segue strada, tratti Tutor, media e allarmi.
// Non tocca la pagina e non parla: comunica con eventi (testi in messages.js). Vedi docs/ARCHITETTURA.md.
import { clamp } from './format.js';
import { hav, bearing } from './geo.js';
import { thresholdFor } from './rules.js';
import { matchPoint, secRel } from './network.js';
import { computeMetrics } from './metrics.js';

// Distanza in km a cui parte l'avviso di un autovelox; la postazione si può riavvisare solo 200 m dopo averla superata
export const VELOX_KM = 0.5;
const VELOX_RESET_KM = 0.2;

export function toHistoryEntry(r, t){
  return {t, id:r.sec.id, da:r.sec.da, a:r.sec.a, avg:r.avg, lim:r.lim, partial:r.partial, sim:r.sim, dur:r.dur};
}

export function createTracker({secs, lines, settings, velox = []}){
  const st = {running:false, source:null, fix:null, prevFix:null, odo:0, jumps:0,
    onRoad:false, matchStreak:0, missStreak:0, ram:null, km:null, sign:0, trendSign:0, trendKm:null,
    active:null, next:null, alerted:new Set(), result:null, instSince:null, lastInst:0, lastWall:0,
    veloxNext:null, veloxAlerted:new Set(), veloxOver:new Set()};
  const listeners = [];
  const emit = (type, data) => { const ev = Object.assign({type}, data); listeners.forEach(fn => fn(ev)); };

  function reset(){
    Object.assign(st, {fix:null, prevFix:null, odo:0, jumps:0, onRoad:false, matchStreak:0, missStreak:0, ram:null, km:null,
      sign:0, trendSign:0, trendKm:null, active:null, next:null, result:null, instSince:null, lastInst:0, lastWall:0, veloxNext:null});
    st.alerted = new Set(); st.veloxAlerted = new Set(); st.veloxOver = new Set();
  }

  function pushPosition(p){
    if (!st.running) return;
    const c = p.coords, t = (p.timestamp || Date.now())/1000;
    const fix = {lat:c.latitude, lon:c.longitude, acc:c.accuracy || 30, t,
      heading:(c.heading != null && !isNaN(c.heading)) ? c.heading : null,
      v:(c.speed != null && !isNaN(c.speed) && c.speed >= 0) ? c.speed : null};
    const prev = st.fix;
    if (prev && t <= prev.t) return;
    st.lastWall = Date.now()/1000;
    if (prev){
      const dt = t - prev.t, dPos = hav(prev.lat, prev.lon, fix.lat, fix.lon);
      // scarta i salti di posizione impossibili (oltre 270 km/h, o ben oltre la velocità data dal GPS), salvo che si ripetano
      const vMax = Math.max(75, fix.v != null ? fix.v*1.3 : 0);
      if (dt > 0 && dPos/dt > vMax && dPos > 150){
        st.jumps++;
        if (st.jumps < 3) return;
        st.jumps = 0; st.fix = null; st.prevFix = null; st.matchStreak = 0;
        if (st.active) abort('gps-unstable');
        return;
      }
      st.jumps = 0;
      // senza la velocità del GPS la si ricava dallo spostamento, scartando i valori impossibili
      if (fix.v == null){ fix.v = dt > 0 ? dPos/dt : 0; if (fix.v > 75) fix.v = prev.v != null ? prev.v : 0; }
      if (fix.heading == null && dPos > 8) fix.heading = bearing(prev.lat, prev.lon, fix.lat, fix.lon);
      st.odo += (dt <= 10 && prev.v != null) ? (prev.v + fix.v)/2*dt : dPos;
    }
    fix.odo = st.odo;
    st.prevFix = prev; st.fix = fix;

    const m = matchPoint(lines, fix.lat, fix.lon, fix.heading, fix.v, fix.acc, st.trendSign, st.onRoad ? st.ram : null);
    if (m){
      if (st.trendKm != null && st.ram === m.ram){ const dk = m.km - st.trendKm; if (Math.abs(dk) > 0.05){ st.trendSign = Math.sign(dk); st.trendKm = m.km; } }
      else st.trendKm = m.km;
      const prevKm = st.ram === m.ram ? st.km : null, prevSign = st.sign;
      st.missStreak = 0; st.matchStreak++;
      st.ram = m.ram; st.km = m.km; st.sign = m.sign || st.trendSign || 0;
      st.onRoad = st.matchStreak >= 2;
      if (st.onRoad && st.sign){ updateSections(prevKm, prevSign); updateVelox(); } else st.veloxNext = null;
    } else {
      st.missStreak++; st.matchStreak = 0;
      if (st.missStreak >= 6){
        if (st.active) abort('off-road');
        st.onRoad = false; st.ram = null; st.km = null; st.sign = 0; st.next = null; st.trendKm = null; st.trendSign = 0;
        st.alerted.clear();
        st.veloxNext = null; st.veloxAlerted.clear(); st.veloxOver.clear();
      }
    }
    checkInstant(fix);
    evaluateAlarm();
    emit('position', {fix});
  }

  function updateSections(prevKm, prevSign){
    const f = st.fix, pf = st.prevFix, km = st.km, sign = st.sign;
    let ended = null;
    if (st.active){
      const a = st.active, s = a.sec;
      if (s.r !== st.ram || s.sign !== sign) abort('direction');
      else {
        const rel = secRel(s, km);
        if (rel >= s.L){
          let tEnd = f.t, odoEnd = f.odo;
          if (prevKm != null && pf){
            const r0 = secRel(s, prevKm);
            if (rel !== r0){ const fr = clamp((s.L - r0)/(rel - r0), 0, 1); tEnd = pf.t + fr*(f.t - pf.t); odoEnd = pf.odo + fr*(f.odo - pf.odo); }
          }
          ended = finishSection(tEnd, odoEnd);
        }
      }
    }
    const cands = secs.filter(s => s.r === st.ram && s.sign === sign);
    if (!st.active){
      const inside = cands.find(s => { const r = secRel(s, km); return r >= 0 && r < s.L - 0.05; });
      if (inside && !(st.result && st.result.sec === inside)){
        let tStart = f.t, odoStart = f.odo, mid = true;
        if (prevKm != null && pf && prevSign === sign){
          const r0 = secRel(inside, prevKm), r1 = secRel(inside, km);
          if (r0 < 0 && r1 >= 0 && r1 > r0){ const fr = clamp(-r0/(r1 - r0), 0, 1); tStart = pf.t + fr*(f.t - pf.t); odoStart = pf.odo + fr*(f.odo - pf.odo); mid = false; }
        }
        startSection(inside, tStart, odoStart, mid, ended);
        ended = null;
      }
    }
    let next = null, best = Infinity;
    cands.forEach(s => { const r = secRel(s, km); if (r < 0 && -r < best){ best = -r; next = s; } });
    st.next = next ? {sec:next, dist:best} : null;
    if (ended) emit('section-end', {result:ended});
    if (!st.active && next && best <= settings.preAlert + 0.05 && !st.alerted.has(next.id)){
      st.alerted.add(next.id);
      emit('pre-alert', {sec:next, dist:best, limit:settings.limit});
    }
  }

  // Autovelox davanti (stesso ramo, stesso verso) entro VELOX_KM: un avviso per postazione, e uno forte se si va
  // oltre il limite impostato. Conta la velocità del momento, non la media.
  function updateVelox(){
    st.veloxNext = null;
    if (settings.veloxOff) return;
    for (const v of velox){
      if (v.r !== st.ram || v.sign !== st.sign) continue;
      const d = (v.km - st.km)*v.sign;
      if (d < -VELOX_RESET_KM){ st.veloxAlerted.delete(v.id); st.veloxOver.delete(v.id); }
      if (d >= 0 && d <= VELOX_KM && (!st.veloxNext || d < st.veloxNext.dist)) st.veloxNext = {v, dist:d};
    }
    if (!st.veloxNext) return;
    const {v, dist} = st.veloxNext, over = st.fix.v != null && st.fix.v*3.6 > settings.limit;
    if (!st.veloxAlerted.has(v.id)){
      st.veloxAlerted.add(v.id);
      if (over) st.veloxOver.add(v.id);
      emit('velox-alert', {velox:v, dist, limit:settings.limit, over});
    } else if (over && !st.veloxOver.has(v.id)){
      st.veloxOver.add(v.id);
      emit('velox-over', {velox:v, limit:settings.limit});
    }
  }

  function startSection(s, tStart, odoStart, mid, after){
    st.active = {sec:s, tStart, odoStart, mid, status:'ok', lastAlarm:0, relStart: mid ? clamp(secRel(s, st.km), 0, s.L) : 0};
    st.result = null; st.alerted.delete(s.id);
    emit('section-start', {sec:s, mid, after});
  }

  function finishSection(tEnd, odoEnd){
    const a = st.active, s = a.sec, dt = tEnd - a.tStart, dist = odoEnd - a.odoStart;
    const avg = dt > 5 ? dist/dt*3.6 : null;
    st.result = {sec:s, avg, lim:settings.limit, dur:dt, until:st.fix.t + 25, partial:a.mid, sim:st.source === 'sim'};
    st.active = null; st.alerted.clear();
    emit('section-finish', {result:st.result});
    return st.result;
  }

  function abort(reason){
    st.active = null;
    emit('section-abort', {reason});
  }

  function checkInstant(f){
    if (!settings.instWarn || !st.onRoad || f.v == null){ st.instSince = null; return; }
    const v = f.v*3.6, thr = thresholdFor(settings.limit);
    if (v > thr){
      if (st.instSince == null) st.instSince = f.t;
      if (f.t - st.instSince >= 3 && f.t - st.lastInst > 25){
        st.lastInst = f.t;
        emit('instant-over', {limit:settings.limit, silentVoice:!!(st.active && st.active.status === 'alarm')});
      }
    } else st.instSince = null;
  }

  // Passaggi di stato dell'allarme sulla media (prima stava in renderHUD)
  function evaluateAlarm(){
    const a = st.active;
    if (!st.running || !a) return;
    const m = computeMetrics(a, st.fix, st.km, settings);
    if (m.status !== a.status){
      if (m.status === 'alarm'){ a.lastAlarm = st.fix.t; emit('alarm', {repeat:false}); }
      else if (a.status === 'alarm') emit('alarm-cleared', {});
      a.status = m.status;
    } else if (m.status === 'alarm' && st.fix.t - a.lastAlarm > 30){
      a.lastAlarm = st.fix.t;
      emit('alarm', {repeat:true});
    }
  }

  return {
    st,
    on(fn){ listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
    start(source){ reset(); st.running = true; st.source = source; },
    stop(){ if (st.active) abort(null); st.running = false; },
    pushPosition,
    // Da chiamare quando cambiano limite o margine: l'allarme può scattare o rientrare subito
    refresh(){ evaluateAlarm(); },
    // Salto della simulazione al prossimo Tutor: si riparte senza posizione precedente
    resetPosition(){
      if (st.active) abort(null);
      st.fix = null; st.prevFix = null; st.matchStreak = 0; st.trendKm = null; st.result = null; st.alerted.clear();
      st.veloxNext = null; st.veloxAlerted.clear(); st.veloxOver.clear();
    }
  };
}
