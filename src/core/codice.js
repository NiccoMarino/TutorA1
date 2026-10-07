// Codice che sblocca il numero calcolato sopra il limite (impostazione per chi ha il codice).
// Nell'app c'è solo l'impronta PBKDF2 del codice (core/codice-dati.js, scritto da npm run codice): il codice non si
// legge, e con tanti giri provare tutte le combinazioni è lento. Non è una cassaforte: chi conosce il codice dell'app
// può comunque aggirare il blocco cambiando le impostazioni salvate.
export const CODE_ITER = 210000;

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const bytes = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));

export async function codeHash(code, salt, iter = CODE_ITER){
  const subtle = globalThis.crypto.subtle;
  const key = await subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveBits']);
  return hex(await subtle.deriveBits({name: 'PBKDF2', hash: 'SHA-256', salt: bytes(salt), iterations: iter}, key, 256));
}

// ref: {salt, iter, hash} da core/codice-dati.js; null se il codice non è ancora stato impostato
export async function checkCode(code, ref){
  const c = String(code || '').trim();
  if (!ref || !c) return false;
  return await codeHash(c, ref.salt, ref.iter) === ref.hash;
}
