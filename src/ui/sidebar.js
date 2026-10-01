// Pannello laterale: elenco dei tratti con filtri e scheda del tratto sulla mappa
import { esc, nfKm, nfL, fmtDur } from '../core/format.js';
import { thresholdFor, thrText } from '../core/rules.js';
import { GROUPS, isPos, roadOf } from '../core/network.js';
import { $ } from './dom.js';

export function createSidebar({secs, settings, mapView, onSimulate}){
  const nA1 = secs.filter(s => roadOf(s) === 'A1').length, nA4 = secs.length - nA1;
  $('#lede').textContent = secs.length + ' tratti con controllo della velocità media: ' + nA1 + ' sulla A1 da Milano a Napoli, con diramazioni di Roma e Variante di Valico, e ' + nA4 + ' sulla A4 tra Milano e Brescia e tra Venezia e Trieste.';
  let filterDir = 'all', filterRoad = 'all';

  function minTimeText(s, v){ return fmtDur(s.L / v * 3600); }
  function popupHTML(s){
    const lim = settings.limit;
    return '<div class="pop"><h4>' + esc(s.name) + '</h4>' +
      '<p class="muted">' + esc(s.t) + ', direzione ' + s.d + ' (' + esc(s.towards) + ')</p>' +
      '<p>Portale di inizio al km ' + nfKm.format(s.ka) + ', fine al km ' + nfKm.format(s.kb) + '</p>' +
      '<p>Lunghezza <b>' + nfL.format(s.L) + ' km</b></p>' +
      '<p>A ' + lim + ' km/h servono almeno <b>' + minTimeText(s, lim) + '</b>. Alla soglia di ' + thrText(lim) + ' km/h: ' + minTimeText(s, thresholdFor(lim)) + '.</p>' +
      '<button class="btn btn-small" type="button" data-simsec="' + s.id + '">Simula questo tratto</button></div>';
  }
  function selectSection(s, zoom, at){
    mapView.highlight(s);
    document.querySelectorAll('.sec.on').forEach(e => e.classList.remove('on'));
    const row = document.querySelector('.sec[data-id="' + s.id + '"]'); if (row) row.classList.add('on');
    if (zoom) mapView.fitSection(s);
    mapView.showPopup(at || s.g[Math.floor(s.g.length/2)], popupHTML(s));
  }
  mapView.map.getContainer().addEventListener('click', e => {
    const b = e.target.closest('[data-simsec]'); if (!b) return;
    mapView.map.closePopup(); onSimulate(+b.getAttribute('data-simsec'), 125);
  });

  function renderList(){
    const box = $('#list'); box.innerHTML = '';
    GROUPS.forEach(g => {
      const items = secs.filter(s => s.t === g && (filterRoad === 'all' || roadOf(s) === filterRoad) && (filterDir === 'all' || (filterDir === 'pos') === s.pos));
      if (!items.length) return;
      const wrap = document.createElement('div'); wrap.className = 'group';
      wrap.innerHTML = '<h2>' + esc(g) + '</h2>';
      [...new Set(items.map(s => s.d))].sort((x, y) => isPos(y) - isPos(x)).forEach(d => {
        const list = items.filter(s => s.d === d).sort((a, b) => (a.ka - b.ka) * a.sign);
        if (!list.length) return;
        const h = document.createElement('h3');
        h.innerHTML = '<i class="dot ' + list[0].cls + '"></i>Direzione ' + d + ', ' + esc(list[0].towards);
        wrap.appendChild(h);
        list.forEach(s => {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'sec ' + s.cls; b.dataset.id = s.id;
          b.innerHTML = '<span class="nm">' + esc(s.name) + '</span><span class="len">' + nfL.format(s.L) + ' km</span><span class="meta">dal km ' + nfKm.format(s.ka) + ' al km ' + nfKm.format(s.kb) + '</span>';
          b.addEventListener('click', () => { selectSection(s, true); if (innerWidth <= 820) $('.mapwrap').scrollIntoView({behavior:'smooth', block:'start'}); });
          wrap.appendChild(b);
        });
      });
      box.appendChild(wrap);
    });
  }
  $('#filter').addEventListener('click', e => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    filterDir = b.dataset.f;
    document.querySelectorAll('#filter .chip').forEach(c => c.setAttribute('aria-pressed', String(c === b)));
    renderList();
  });
  $('#filterRoad').addEventListener('click', e => {
    const b = e.target.closest('[data-r]'); if (!b) return;
    filterRoad = b.dataset.r;
    document.querySelectorAll('#filterRoad .chip').forEach(c => c.setAttribute('aria-pressed', String(c === b)));
    renderList();
  });
  renderList();
  return {selectSection};
}
