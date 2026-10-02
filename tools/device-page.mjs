// Funzioni che il collaudo sul telefono (tools/device-check.mjs) esegue dentro la pagina, tramite DevTools.
// Ognuna è autonoma (niente variabili esterne), perché viene copiata nella pagina come testo.
// Si possono provare anche nel browser del PC, sulla pagina servita da tools/serve.mjs:
//   const d = await import('/tools/device-page.mjs?' + Date.now()); d.pageAudit()

// Impronta degli script e dei dati: la stessa calcolata qui su www/index.html dice se l'app installata è l'ultima build
export function pageFingerprint(){
  const h = s => { let x = 2166136261; for (let i = 0; i < s.length; i++){ x ^= s.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; } return x.toString(16); };
  return [...document.querySelectorAll('script[data-keep]')].map(s => h(s.textContent.trim())).join(',');
}

// Cosa c'è di storto nella parte visibile: uscite dallo schermo, contrasto, testi rotti, pulsanti piccoli, testo tagliato
export function pageAudit(){
  const W = innerWidth, out = {overflowX: document.documentElement.scrollWidth > W + 1, outside: [], contrast: [], broken: [], small: [], clipped: [], tiny: []};
  const name = e => e.id ? '#' + e.id : e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/)[0] : '');
  const label = e => name(e) + ' "' + (e.textContent || e.getAttribute('aria-label') || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 28) + '"';
  const shown = e => { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false;
    for (let n = e; n; n = n.parentElement){ const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false; } return true; };
  const rgba = c => { const m = c.match(/[\d.]+/g); return m && m.length >= 3 ? [+m[0], +m[1], +m[2], m[3] == null ? 1 : +m[3]] : null; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v/12.92 : ((v + 0.055)/1.055)**2.4; }; return 0.2126*f(c[0]) + 0.7152*f(c[1]) + 0.0722*f(c[2]); };
  // sfondo pieno sotto l'elemento; null se c'è un'immagine o una sfumatura (lì il contrasto non si misura così)
  const bgOf = e => { for (let n = e; n; n = n.parentElement){ const cs = getComputedStyle(n); if (cs.backgroundImage !== 'none') return null; const c = rgba(cs.backgroundColor); if (c && c[3] > 0.6) return c; }
    return rgba(getComputedStyle(document.documentElement).backgroundColor) || [255, 255, 255, 1]; };
  const clipsX = e => { for (let n = e.parentElement; n && n !== document.body; n = n.parentElement){ const o = getComputedStyle(n).overflowX; if (o !== 'visible') return true; } return false; };
  for (const e of document.body.querySelectorAll('*')){
    if (e.closest('script,style,svg,#tutor-data')) continue;
    const text = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
    if (!text || !shown(e)) continue;
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    if ((r.right > W + 1 || r.left < -1) && !clipsX(e)) out.outside.push(label(e));
    if (/\b(NaN|undefined|null|Infinity)\b|\[object /.test(text)) out.broken.push(label(e));
    if (parseFloat(cs.fontSize) < 11) out.tiny.push(label(e) + ' ' + cs.fontSize);
    if ((cs.overflow.includes('hidden') || cs.textOverflow === 'ellipsis') && e.scrollWidth > e.clientWidth + 1) out.clipped.push(label(e));
    const bg = bgOf(e), fg = rgba(cs.color);
    if (bg && fg){
      const a = fg[3] * (+cs.opacity || 1), mix = [0, 1, 2].map(i => fg[i]*a + bg[i]*(1 - a));
      const L1 = lum(mix), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05)/(Math.min(L1, L2) + 0.05);
      const large = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.6 && +cs.fontWeight >= 700);
      if (ratio < (large ? 3 : 4.5)) out.contrast.push({what: label(e), ratio: Math.round(ratio*10)/10, bad: ratio < 3});
    }
  }
  for (const e of document.body.querySelectorAll('button, a[href], input, select, textarea, [role=button]')){
    const t = (e.type === 'checkbox' || e.type === 'radio') && e.closest('label') ? e.closest('label') : e;
    // i collegamenti dentro una frase sono alti quanto il testo, ed è normale
    if (!shown(t) || (t.tagName === 'A' && getComputedStyle(t).display === 'inline')) continue;
    const r = t.getBoundingClientRect();
    if (r.height < 40 || r.width < 40) out.small.push(label(t) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  return out;
}

// Apre una schermata partendo da quella iniziale, come farebbe una persona (tornare all'inizio passa dalla cronologia)
export async function showScreen(id, theme){
  const cur = () => document.querySelector('.screen:not([hidden])').id;
  const wait = async want => { for (let i = 0; i < 40 && cur() !== want; i++) await new Promise(r => setTimeout(r, 25)); };
  const chip = [...document.querySelectorAll('#setTheme .chip')].find(b => b.textContent === theme);
  if (chip) chip.click();
  if (cur() !== 'home'){ document.querySelector('#menu [data-go="home"]').click(); await wait('home'); }
  if (id === 'menu') document.getElementById('btnMenu').click();
  else if (id !== 'home') document.querySelector('#menu [data-go="' + id + '"]').click();
  window.scrollTo(0, 0);
  return {shown: cur(), theme: document.documentElement.dataset.theme || 'auto', bg: getComputedStyle(document.body).backgroundColor};
}

// Elenco dei tratti: per ogni autostrada il filtro mostra il numero di tratti annunciato; ogni riga apre la sua scheda
export function listCheck(){
  const sel = document.getElementById('filterRoad'), out = {roads: [], problems: []};
  const rows = () => document.querySelectorAll('#list .sec');
  for (const o of sel.options){
    sel.value = o.value; sel.dispatchEvent(new Event('change'));
    const n = rows().length, want = o.value === 'all' ? window.__tutor.SECS.length : +(o.textContent.match(/\((\d+) tratti\)/) || [])[1];
    out.roads.push(o.value + ':' + n);
    if (n !== want) out.problems.push(o.textContent + ': ' + n + ' righe invece di ' + want);
  }
  for (const f of ['pos', 'neg', 'all']){
    const chip = document.querySelector('#filter [data-f="' + f + '"]');
    if (chip) chip.click();
  }
  sel.value = 'all'; sel.dispatchEvent(new Event('change'));
  if (rows().length !== window.__tutor.SECS.length) out.problems.push('dopo i filtri di direzione: ' + rows().length + ' righe');
  let opened = 0;
  for (const r of rows()){
    r.click();
    const d = r.nextElementSibling;
    if (!d || !d.classList.contains('sec-detail') || !d.querySelector('[data-simsec="' + r.dataset.id + '"]')) out.problems.push('scheda mancante: ' + r.textContent.slice(0, 40));
    else if (/\b(NaN|undefined|null)\b/.test(d.textContent)) out.problems.push('scheda con valori rotti: ' + d.textContent.slice(0, 60));
    else opened++;
    r.click();
  }
  out.opened = opened;
  out.openAfter = document.querySelectorAll('.sec-detail').length;
  return out;
}

// Un tratto guidato con il simulatore della pagina, partendo dal pulsante "Simula questo tratto" della sua scheda.
// Le posizioni passano dal tracker vero e ridisegnano la schermata vera; si guarda la schermata nei momenti importanti.
export function driveSection(id, kmh){
  const T = window.__tutor, el = i => document.getElementById(i);
  const row = document.querySelector('#list .sec[data-id="' + id + '"]');
  if (!row) return {err: 'riga non trovata nell\'elenco'};
  if (row.getAttribute('aria-expanded') !== 'true') row.click();
  const btn = document.querySelector('[data-simsec="' + id + '"]');
  if (!btn) return {err: 'pulsante "Simula questo tratto" mancante'};
  btn.click();
  T.simControls.stopTimer();
  T.sim.speed = kmh; T.sim.warp = 5;
  const events = [], off = T.tracker.on(e => { if (e.type !== 'position') events.push(e); });
  // gli annunci scritti sullo schermo, posizione per posizione (un avviso subito dopo coprirebbe quello di fine)
  const toasts = new MutationObserver(() => {});
  toasts.observe(el('toast'), {childList: true, characterData: true, subtree: true});
  let endToast = null;
  let vib = 0; const realVibrate = navigator.vibrate; navigator.vibrate = () => { vib++; return true; };
  const problems = [], seen = {};
  const inside = (a, b) => a.left >= b.left - 1 && a.right <= b.right + 1 && a.top >= b.top - 1 && a.bottom <= b.bottom + 1;
  function look(moment){
    const plate = el('plate').getBoundingClientRect(), vp = {left: 0, top: 0, right: innerWidth, bottom: innerHeight};
    const hudText = el('hud').innerText;
    if (!document.body.classList.contains('driving')) problems.push(moment + ': schermata di guida non aperta');
    if (!inside(plate, vp)) problems.push(moment + ': cartello fuori dallo schermo');
    if (!inside(el('pBig').getBoundingClientRect(), document.querySelector('.plate-in').getBoundingClientRect())) problems.push(moment + ': numero grande fuori dal cartello (' + el('pBig').textContent + ')');
    if (document.documentElement.scrollWidth > innerWidth + 1) problems.push(moment + ': la pagina scorre di lato');
    if (/\b(NaN|undefined|null|Infinity)\b/.test(hudText)) problems.push(moment + ': valori rotti: ' + hudText.replace(/\s+/g, ' ').slice(0, 90));
    seen[moment] = {plate: el('plate').className.replace(' flash', ''), kicker: el('pKicker').textContent, big: el('pBig').textContent,
                    toast: el('toast').textContent, titleCut: el('pTitle').scrollWidth > el('pTitle').clientWidth + 1};
  }
  let n = 0, ms = 0, maxMs = 0, fin = null, alarmBeforeFinish = false;
  for (let i = 0; i < 8000 && !fin; i++){
    const p = T.simulator.step();
    if (!p) break;
    const before = events.length, t0 = performance.now();
    T.tracker.pushPosition(p);
    const dt = performance.now() - t0; n++; ms += dt; maxMs = Math.max(maxMs, dt);
    const said = toasts.takeRecords().flatMap(r => r.type === 'characterData' ? [r.target.textContent] : [...r.addedNodes].map(x => x.textContent));
    for (const e of events.slice(before)){
      if (e.type === 'pre-alert' && e.sec.id === id && !seen.preavviso) look('preavviso');
      if (e.type === 'section-start' && e.sec.id === id) look('inizio');
      if (e.type === 'alarm' && !e.repeat && !seen.allarme){ alarmBeforeFinish = true; look('allarme'); }
      if (e.type === 'section-finish' && e.result.sec.id === id){ fin = e.result; endToast = said.find(t => t.startsWith('Fine Tutor')) || said.join(' / '); }
    }
  }
  if (fin){ look('fine'); seen.fine.toast = endToast; }
  el('hudExit').click();
  navigator.vibrate = realVibrate; off(); toasts.disconnect();
  return {n, avgMs: n ? ms/n : 0, maxMs, avg: fin ? fin.avg : null, mid: fin ? fin.partial : null, alarm: alarmBeforeFinish, vib, problems, seen,
          types: [...new Set(events.map(e => e.type))], stillDriving: document.body.classList.contains('driving') || T.st.running};
}
