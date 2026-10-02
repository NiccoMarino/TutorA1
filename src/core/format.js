// Formattazione di numeri, distanze e durate in italiano, e nomi adatti alla voce
export const nf1 = new Intl.NumberFormat('it-IT', {minimumFractionDigits:1, maximumFractionDigits:1});
// Medie a fine tratto: almeno un decimale, due quando servono (136,85 oltre la soglia di 136,84)
export const nf12 = new Intl.NumberFormat('it-IT', {minimumFractionDigits:1, maximumFractionDigits:2});
export const nf0 = new Intl.NumberFormat('it-IT', {maximumFractionDigits:0});
export const nfKm = new Intl.NumberFormat('it-IT', {maximumFractionDigits:3});
export const nfL = new Intl.NumberFormat('it-IT', {maximumFractionDigits:2});
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export function fmtDur(s){ s = Math.max(0, Math.round(s)); const m = Math.floor(s/60), r = s % 60; return m ? m + ' min ' + String(r).padStart(2,'0') + ' s' : r + ' s'; }
export function fmtDist(km){ return km < 0.95 ? nf0.format(Math.max(10, Math.round(km*100)*10)) + ' m' : nf1.format(km) + ' km'; }
export function speakDist(km){ if (km < 0.95) return (Math.max(100, Math.round(km*10)*100)) + ' metri'; const r = Math.round(km*2)/2; return r === 1 ? 'un chilometro' : nfL.format(r) + ' chilometri'; }
export function spk(n){ return String(n).replace(/All\. /g, 'allacciamento ').replace(/Dir\. /g, 'diramazione ').replace(/S\. Maria/g, 'Santa Maria').replace(/\((nord|sud)\)/g, 'lato $1').replace(/A(\d+)/g, 'A $1'); }
export function esc(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
