// Calcoli sulla sfera terrestre: distanza (metri), direzione (gradi da nord), differenza tra direzioni
export const D2R = Math.PI/180;
export function hav(la1, lo1, la2, lo2){
  const a = Math.sin((la2-la1)*D2R/2)**2 + Math.cos(la1*D2R)*Math.cos(la2*D2R)*Math.sin((lo2-lo1)*D2R/2)**2;
  return 2*6371008.8*Math.asin(Math.sqrt(a));
}
export function bearing(la1, lo1, la2, lo2){
  const y = Math.sin((lo2-lo1)*D2R)*Math.cos(la2*D2R);
  const x = Math.cos(la1*D2R)*Math.sin(la2*D2R) - Math.sin(la1*D2R)*Math.cos(la2*D2R)*Math.cos((lo2-lo1)*D2R);
  return (Math.atan2(y, x)/D2R + 360) % 360;
}
export function angDiff(a, b){ const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }
