// Simulazione di guida: posizioni lungo un tracciato a velocità impostata, senza timer né pagina.
// random si può sostituire nei test per avere posizioni sempre uguali.
import { clamp } from './format.js';
import { pointAtKm, secRel } from './network.js';

export function createSimulator({secs, lines, random = Math.random}){
  const sim = {line:null, km:0, sign:1, speed:125, warp:1, t:0};
  return {
    sim,
    setup(id, v, nowSec){
      const s = secs.find(x => x.id === id);
      if (!s) return false;
      const line = lines.find(l => l.ram === s.r && (l.fixedSign === s.sign || l.fixedSign === 0));
      const P = line.pts, kmin = Math.min(P[0][2], P[P.length-1][2]), kmax = Math.max(P[0][2], P[P.length-1][2]);
      Object.assign(sim, {line, sign:s.sign, speed:v, km:clamp(s.ka - s.sign*2.2, kmin + 0.01, kmax - 0.01), t:nowSec});
      return true;
    },
    step(){
      const dt = 0.5*sim.warp;
      sim.t += dt;
      const v = Math.max(0, sim.speed + (random() - 0.5)*1.6);
      sim.km += sim.sign * v/3600 * dt;
      const p = pointAtKm(sim.line, sim.km);
      if (!p) return null;
      const inc = sim.line.pts[sim.line.pts.length-1][2] > sim.line.pts[0][2];
      const along = (sim.sign > 0) === inc;
      const heading = along ? p.brg : (p.brg + 180) % 360;
      const j = () => (random() - 0.5)*0.00005;
      return {coords:{latitude:p.lat + j(), longitude:p.lon + j(), accuracy:6, speed:v/3.6, heading}, timestamp:sim.t*1000};
    },
    nextSection(){
      const cands = secs.filter(s => s.r === sim.line.ram && s.sign === sim.sign && secRel(s, sim.km) < -0.3)
        .sort((a, b) => secRel(b, sim.km) - secRel(a, sim.km));
      return cands[0] || null;
    },
    jumpBefore(n){ sim.km = n.ka - n.sign*1.4; }
  };
}
