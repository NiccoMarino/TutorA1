// Mappa stradale di sfondo. Con la chiave CARTO (gratuita, da https://carto.com/basemaps/apikey/) usa le
// mappe CARTO, adatte a un'app distribuita e con una versione scura vera. Senza chiave resta
// OpenStreetMap, i cui server non sono pensati per le app: va bene per prove e uso personale.
export const CARTO_KEY = '';

const OSM_ATTR = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

export function tileSource(dark, key = CARTO_KEY){
  if (key){
    const k = '?key=' + encodeURIComponent(key);
    const style = dark ? 'dark_all' : 'rastertiles/voyager';
    return {
      url: 'https://{s}.basemaps.cartocdn.com/' + style + '/{z}/{x}/{y}{r}.png' + k,
      subdomains: 'abcd',
      className: '',
      attribution: 'Mappa ' + OSM_ATTR + ', © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
      probe: 'https://a.basemaps.cartocdn.com/rastertiles/voyager/6/34/23.png' + k
    };
  }
  return {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: '',
    // Nel tema scuro le tile chiare di OpenStreetMap sono scurite con un filtro CSS
    className: dark ? 'tiles-dark' : '',
    attribution: 'Mappa ' + OSM_ATTR,
    probe: 'https://tile.openstreetmap.org/6/34/23.png'
  };
}
