// Petits graphiques en SVG produits comme chaînes : courbes des 29 jours dans le
// tableau et les fiches. Une seule teinte, l'encre ; le pic est marqué.

import { estWeekend } from "../format.js";

/**
 * serie : 29 valeurs (1er au 29 septembre).
 * options.max : échelle commune (sinon le max de la série) ;
 * options.jours : jours d'événements à marquer d'un trait sous l'axe.
 */
export function courbe(serie, { largeur = 116, hauteur = 22, max = null, jours = [], weekend = false, pic = true } = {}) {
  const n = serie.length;
  const haut = max ?? Math.max(...serie, 1);
  const pas = largeur / (n - 1);
  const y = (v) => hauteur - 2 - (v / haut) * (hauteur - 4);
  let d = "";
  serie.forEach((v, i) => { d += `${i ? "L" : "M"}${(i * pas).toFixed(1)},${y(v).toFixed(1)}`; });
  const aire = `${d}L${largeur},${hauteur}L0,${hauteur}Z`;
  let fonds = "";
  if (weekend) {
    for (let i = 0; i < n; i++) {
      if (estWeekend(i)) fonds += `<rect x="${(i * pas - pas / 2).toFixed(1)}" y="0" width="${pas.toFixed(1)}" height="${hauteur}" fill="#ece8df"/>`;
    }
  }
  let marques = "";
  for (const j of jours) {
    marques += `<line x1="${(j * pas).toFixed(1)}" x2="${(j * pas).toFixed(1)}" y1="${hauteur}" y2="${hauteur + 4}" stroke="#1b1a17" stroke-width="1"/>`;
  }
  let point = "";
  if (pic) {
    const i = serie.indexOf(Math.max(...serie));
    point = `<circle cx="${(i * pas).toFixed(1)}" cy="${y(serie[i]).toFixed(1)}" r="2.2" fill="#1b1a17"/>`;
  }
  return `<svg class="sparkline" width="${largeur}" height="${hauteur + (jours.length ? 5 : 0)}" viewBox="0 0 ${largeur} ${hauteur + (jours.length ? 5 : 0)}" aria-hidden="true">${fonds}<path d="${aire}" fill="rgba(27,26,23,0.08)"/><path d="${d}" fill="none" stroke="#1b1a17" stroke-width="1.2" stroke-linejoin="round"/>${marques}${point}</svg>`;
}
