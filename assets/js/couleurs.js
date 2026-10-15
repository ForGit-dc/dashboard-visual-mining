// Couleurs du dashboard. Chaque couleur fait un seul travail :
//   - les quatre familles : identité, réservée, partout la même ;
//   - les huit teintes du mode « par cluster » : séparer des voisins, sans sens ;
//   - deux rampes à une seule teinte : sur-représentation des Vectors (vermillon)
//     et résonance (encre : plus c'est repris, plus c'est noir).
// Palette des familles validée (daltonismes protan et deutan, toutes paires) :
// voir CONCEPTION.md.

export const FAMILLES = ["Media", "Officials", "Vectors", "Influencers"];
export const COULEUR_FAMILLE = {
  Media: "#2b6cb0",
  Officials: "#d69a16",
  Vectors: "#cf3d2e",
  Influencers: "#1b9e8f",
};
export const NOM_FAMILLE = {
  Media: "Media",
  Officials: "Officials",
  Vectors: "Vectors",
  Influencers: "Influencers",
};
export const BRUIT = "#a39d90";
export const GRIS_NEUTRE = "#cdc7bb";

const lab = (a, b) => d3.interpolateLab(a, b);

export function melange(a, b, t) {
  return d3.color(lab(a, b)(t)).formatHex();
}

// Sur-représentation des Vectors : rapport entre leur part dans le cluster et
// leur part dans le corpus (13,2 %). En dessous de 1, gris : pas de signal.
export const rampeVectors = d3.scaleLog()
  .domain([1, 2, 4, 6.2])
  .range(["#e3d6cf", "#e49a8b", "#cf3d2e", "#7f1f16"])
  .interpolate(d3.interpolateLab)
  .clamp(true);

export function couleurVectors(ratio) {
  return ratio <= 1 ? "#d9d3c8" : d3.color(rampeVectors(ratio)).formatHex();
}

// Résonance : médiane des engagements par post, sur une échelle log(1 + x)
// pour que les médianes nulles aient une place.
export const MAX_RESONANCE = 60;
export function couleurResonance(mediane) {
  const t = Math.min(1, Math.log10(1 + mediane) / Math.log10(1 + MAX_RESONANCE));
  return d3.color(lab("#dcd6ca", "#1b1a17")(t)).formatHex();
}

/** Couleur d'un cluster selon le mode de la carte. */
export function couleurCluster(fiche, mode) {
  if (fiche.id === -1) return BRUIT;
  switch (mode) {
    case "famille": {
      // Teinte = famille dominante ; intensité = part de cette famille.
      // Un cluster mélangé (35 %) tire vers le gris : c'est un sujet partagé.
      const t = Math.max(0.12, Math.min(1, (fiche.part_dominante - 0.3) / 0.65));
      return melange(GRIS_NEUTRE, COULEUR_FAMILLE[FAMILLES[fiche.dominante]], t);
    }
    case "vectors":
      return couleurVectors(fiche.ratios[2]);
    case "resonance":
      return couleurResonance(fiche.eng.mediane);
    default:
      return fiche.couleur;
  }
}

/** Barre de composition en HTML : quatre segments séparés par 2 px de papier. */
export function barreComposition(parts, { haute = false, titre = true } = {}) {
  const segments = FAMILLES.map((f, i) => {
    if (parts[i] <= 0) return "";
    const t = titre ? ` title="${f} : ${(parts[i] * 100).toFixed(1).replace(".", ",")} %"` : "";
    return `<span style="flex:${parts[i]};background:${COULEUR_FAMILLE[f]}"${t}></span>`;
  }).join("");
  return `<div class="compo${haute ? " compo--haute" : ""}" role="img" aria-label="Composition par famille d'acteurs">${segments}</div>`;
}
