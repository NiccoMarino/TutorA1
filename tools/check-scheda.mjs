// Conta i caratteri dei testi della scheda del Play Store (docs/play-store/SCHEDA.md) rispetto ai limiti di Google.
// Ogni campo è il testo tra il commento <!-- campo: nome --> e il titolo ## successivo.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const LIMITS = {nome: 30, breve: 80, completa: 4000, note: 500};

export function fields(md){
  const out = {};
  for (const m of md.replace(/\r\n/g, '\n').matchAll(/<!-- campo: (\w+) -->\n([\s\S]*?)(?=\n## |$)/g)) out[m[1]] = m[2].trim();
  return out;
}

export function check(md){
  const f = fields(md);
  return Object.entries(LIMITS).map(([k, max]) => ({campo: k, lunghezza: f[k] == null ? null : [...f[k]].length, max}));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href){
  const rows = check(readFileSync(new URL('../docs/play-store/SCHEDA.md', import.meta.url), 'utf8'));
  for (const r of rows) console.log(r.campo.padEnd(9) + String(r.lunghezza).padStart(5) + ' / ' + r.max + (r.lunghezza == null || r.lunghezza > r.max ? '  <-- DA SISTEMARE' : ''));
  if (rows.some(r => r.lunghezza == null || r.lunghezza > r.max)) process.exit(1);
}
