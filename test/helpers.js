// Funzioni comuni ai test
import { readFileSync } from 'node:fs';
import { buildNetwork, pointAtKm } from '../src/core/network.js';

export const DATA = JSON.parse(readFileSync(new URL('../src/data/tutor-data.json', import.meta.url), 'utf8'));
export const loadFixture = name => JSON.parse(readFileSync(new URL('./fixtures/' + name, import.meta.url), 'utf8'));
export const network = () => buildNetwork(DATA);

// Posizione del browser (GeolocationPosition) a partire da una posizione di scenarios.json
export const toPosition = f => ({coords: {latitude: f.lat, longitude: f.lon, accuracy: f.accuracy, speed: f.speed, heading: f.heading}, timestamp: f.t});

// Posizioni una al secondo lungo una linea, a velocità costante
export function along(line, fromKm, toKm, kmh, t0 = 1790000000000){
  const out = [], dir = Math.sign(toKm - fromKm), inc = line.pts[line.pts.length-1][2] > line.pts[0][2];
  for (let km = fromKm, t = t0; (toKm - km)*dir > 0; km += dir*kmh/3600, t += 1000){
    const p = pointAtKm(line, km);
    out.push({coords: {latitude: p.lat, longitude: p.lon, accuracy: 6, speed: kmh/3.6,
              heading: (dir > 0) === inc ? p.brg : (p.brg + 180) % 360}, timestamp: t});
  }
  return out;
}
