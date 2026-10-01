// "Scarica l'app come file HTML": salva la pagina com'era all'avvio, senza gli script esterni
import { $ } from './dom.js';

export function setupDownload(PRISTINE){
  let dlCap = null, dlProbe = false;
  function probeDownloads(){
    if (dlProbe) return;
    const c = window.claude;
    if (c && typeof c.use === 'function'){
      dlProbe = true;
      c.use('downloads').then(ns => { dlCap = ns || null; }).catch(() => { dlCap = null; });
    }
  }
  probeDownloads(); setTimeout(probeDownloads, 1500);
  function exportHTML(){
    if (!PRISTINE) return null;
    try {
      const doc = new DOMParser().parseFromString(PRISTINE, 'text/html');
      doc.querySelectorAll('script:not([data-keep])').forEach(s => s.remove());
      return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
    } catch(e){ return PRISTINE; }
  }
  $('#btnDownload').addEventListener('click', async () => {
    const msg = $('#dlMsg'); const html = exportHTML();
    if (!html){ msg.hidden = false; msg.textContent = 'Non riesco a preparare il file in questa vista.'; return; }
    probeDownloads();
    if (window.claude && typeof window.claude.use === 'function'){
      const ns = dlCap || await window.claude.use('downloads').catch(() => null);
      if (ns){
        try { await ns.save({filename:'tutor-a1.html', data:html}); msg.hidden = false; msg.textContent = 'File tutor-a1.html pronto. Caricalo su Netlify Drop o GitHub Pages e aprilo dal telefono.'; }
        catch(e){ if (!e || e.code !== 'declined'){ msg.hidden = false; msg.textContent = 'Il download non è disponibile in questa vista.'; } }
        return;
      }
    }
    const blob = new Blob([html], {type:'text/html'}); const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'tutor-a1.html'; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    msg.hidden = false; msg.textContent = 'File tutor-a1.html scaricato.';
  });
}
