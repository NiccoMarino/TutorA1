// npm run codice: imposta il codice che sblocca, in Impostazioni di guida, il numero calcolato anche sopra il limite.
// Il codice lo scrivi tu qui (non si vede mentre lo scrivi); in src/core/codice-dati.js finisce solo l'impronta.
// npm run codice -- --togli: toglie il codice (la sezione sparisce dalle impostazioni).
// Dopo: npm run build, commit, e per l'app npm run sync e reinstallazione.
import { writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { codeHash, CODE_ITER } from '../src/core/codice.js';

const OUT = new URL('../src/core/codice-dati.js', import.meta.url);
const MIN = 8;

export function codiceFile(ref){
  return '// Scritto da npm run codice (tools/codice.mjs): impronta del codice per chi ha il codice. Non modificare a mano.\n'
    + '// null: codice non impostato, la sezione non compare nelle impostazioni.\n'
    + 'export const CODICE = ' + (ref ? JSON.stringify(ref) : 'null') + ';\n';
}

// Legge una riga senza mostrarla (asterischi al posto dei caratteri)
function askHidden(question){
  const input = process.stdin;
  if (!input.isTTY){
    console.log('Attenzione: il terminale non permette di nascondere il codice, si vedrà mentre lo scrivi.');
    const rl = createInterface({input, output: process.stdout});
    return new Promise(res => rl.question(question, a => { rl.close(); res(a); }));
  }
  return new Promise((res, rej) => {
    let text = '';
    process.stdout.write(question);
    input.setRawMode(true); input.resume(); input.setEncoding('utf8');
    const onData = chunk => {
      for (const ch of chunk){
        if (ch === '\r' || ch === '\n'){ done(); return res(text); }
        if (ch === '\u0003'){ done(); return rej(new Error('annullato')); }
        if (ch === '\u007f' || ch === '\b'){ if (text){ text = text.slice(0, -1); process.stdout.write('\b \b'); } continue; }
        text += ch; process.stdout.write('*');
      }
    };
    const done = () => { input.off('data', onData); input.setRawMode(false); input.pause(); process.stdout.write('\n'); };
    input.on('data', onData);
  });
}

async function main(){
  if (process.argv.includes('--togli')){
    writeFileSync(OUT, codiceFile(null));
    console.log('Codice tolto. Ora npm run build.');
    return;
  }
  console.log('Scegli il codice da dare a chi ti fidi: almeno ' + MIN + ' caratteri, meglio lettere, numeri e un segno.');
  const code = (await askHidden('Codice: ')).trim();
  if (code.length < MIN){ console.log('Troppo corto: almeno ' + MIN + ' caratteri. Niente è cambiato.'); process.exitCode = 1; return; }
  if ((await askHidden('Ripeti il codice: ')).trim() !== code){ console.log('I due codici sono diversi. Niente è cambiato.'); process.exitCode = 1; return; }
  const salt = randomBytes(16).toString('hex');
  writeFileSync(OUT, codiceFile({salt, iter: CODE_ITER, hash: await codeHash(code, salt)}));
  console.log('Fatto: in src/core/codice-dati.js c\'è solo l\'impronta. Ora npm run build (e npm run sync per l\'app).');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(e => { console.log(e.message); process.exitCode = 1; });
