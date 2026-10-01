// Confronta due golden (atteso, trovato) e stampa le prime differenze.
// Vale per golden.json e per pip-layout.json: [{name, frames:[...], ...altri campi}].
// Uso: node tools/compare-golden.mjs test/fixtures/golden.json test/fixtures/golden-check.json
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

const [want, got] = process.argv.slice(2).map(f => JSON.parse(readFileSync(f, 'utf8')));
let diffs = 0;
for (const a of want){
  const b = got.find(x => x.name === a.name);
  if (!b){ console.log('Manca lo scenario', a.name); diffs++; continue; }
  if (a.frames.length !== b.frames.length){ console.log(a.name, 'numero di posizioni diverso:', a.frames.length, b.frames.length); diffs++; }
  a.frames.forEach((fa, i) => {
    if (isDeepStrictEqual(fa, b.frames[i])) return;
    if (diffs++ < 5) console.log(a.name, 'posizione', i, '\n  atteso: ', JSON.stringify(fa), '\n  trovato:', JSON.stringify(b.frames[i]));
  });
  const {frames: fa, ...restA} = a, {frames: fb, ...restB} = b;
  // la misura della finestra emulata nel browser può variare di un pixel per arrotondamento
  if (restA.size && restB.size && Math.abs(restA.size.w - restB.size.w) <= 2 && Math.abs(restA.size.h - restB.size.h) <= 2){ delete restA.size; delete restB.size; }
  if (!isDeepStrictEqual(restA, restB)){ diffs++; console.log(a.name, 'altri campi diversi (storico, riquadro)\n  atteso: ', JSON.stringify(restA), '\n  trovato:', JSON.stringify(restB)); }
}
console.log(diffs ? diffs + ' differenze' : 'Identico');
process.exit(diffs ? 1 : 0);
