import { test } from 'node:test';
import assert from 'node:assert/strict';
import { announcementFor, endText } from '../src/core/messages.js';

const sec = {da:'All. A21', a:'Fiorenzuola', L:10.5};

test('preavviso', () => {
  assert.deepEqual(announcementFor({type:'pre-alert', sec, dist:1.0, limit:130}),
    {text:'Tra un chilometro inizia il Tutor, da allacciamento A 21 a Fiorenzuola, 10,5 chilometri. Limite 130.', tone:'pre'});
});

test('inizio tratto dal portale', () => {
  assert.deepEqual(announcementFor({type:'section-start', sec, mid:false, after:null}),
    {text:'Inizio Tutor. 10,5 chilometri fino a Fiorenzuola.', tone:'start', vibrate:120});
});

test('ingresso a metà tratto', () => {
  assert.deepEqual(announcementFor({type:'section-start', sec, mid:true, after:null}),
    {text:'Sei dentro il tratto Tutor da allacciamento A 21 a Fiorenzuola. Media calcolata da qui.', tone:'soft', vibrate:120});
});

test('fine di un tratto e inizio del successivo in un solo annuncio', () => {
  assert.deepEqual(announcementFor({type:'section-start', sec, mid:false, after:{avg:128.4, lim:130}}),
    {text:'Fine Tutor. Media 128 chilometri orari, in regola. Subito dopo inizia il Tutor fino a Fiorenzuola, 10,5 chilometri.', tone:'start', vibrate:120});
});

test('fine tratto da sola, anche senza media', () => {
  assert.deepEqual(announcementFor({type:'section-end', result:{avg:null, lim:130}}), {text:'Fine Tutor. Media non disponibile.', tone:'end'});
  assert.equal(endText({avg:140, lim:130}), 'Fine Tutor. Media 140 chilometri orari, oltre la soglia di sanzione.');
});

test('misura interrotta, con e senza annuncio', () => {
  assert.deepEqual(announcementFor({type:'section-abort', reason:'direction'}), {text:'Direzione cambiata: misura del tratto interrotta.', tone:'soft'});
  assert.deepEqual(announcementFor({type:'section-abort', reason:'gps-unstable'}), {text:'Segnale GPS instabile: misura del tratto interrotta.', tone:'soft'});
  assert.deepEqual(announcementFor({type:'section-abort', reason:'off-road'}), {text:'Sei uscito dal tracciato: misura del tratto interrotta.', tone:'soft'});
  assert.equal(announcementFor({type:'section-abort', reason:null}), null);
});

test('allarmi', () => {
  assert.deepEqual(announcementFor({type:'alarm', repeat:false}), {text:'Attenzione, media oltre la soglia. Rallenta.', tone:'alarm', vibrate:[220,100,220]});
  assert.deepEqual(announcementFor({type:'alarm', repeat:true}), {text:'Media ancora oltre la soglia.', tone:'alarm', vibrate:[220,100,220]});
  assert.deepEqual(announcementFor({type:'alarm-cleared'}), {text:'Media rientrata sotto la soglia.', tone:'soft'});
});

test('velocità istantanea, muta se è già in corso l\'allarme della media', () => {
  assert.deepEqual(announcementFor({type:'instant-over', limit:130, silentVoice:true}), {text:'Velocità oltre 130', tone:'inst', silentVoice:true});
});

test('gli altri eventi non si annunciano', () => {
  assert.equal(announcementFor({type:'position', fix:{}}), null);
  assert.equal(announcementFor({type:'section-finish', result:{}}), null);
});
