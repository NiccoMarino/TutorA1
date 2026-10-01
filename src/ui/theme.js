// Tema chiaro o scuro: all'inizio segue il telefono, poi vale la scelta fatta nelle impostazioni.
// Lo stile (styles/app.css) legge data-theme su <html>; senza, segue prefers-color-scheme.
export const THEMES = [['auto', 'Come il telefono'], ['light', 'Chiaro'], ['dark', 'Scuro']];

export function applyTheme(root, theme){
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;
}
