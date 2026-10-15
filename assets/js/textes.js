// Libellés partagés entre les vues : régimes temporels, logiques de
// regroupement, rôle des familles d'acteurs (d'après le brief, section 3).

export const REGIMES = {
  evenementiel: {
    nom: "Événementiel",
    court: "pic",
    definition: "le jour de pic vaut au moins 7 fois la médiane quotidienne, ou concentre au moins 15 % des images",
  },
  semaine: {
    nom: "Jours ouvrés",
    court: "semaine",
    definition: "un jour de week-end produit moins de la moitié d'un jour ouvré",
  },
  weekend: {
    nom: "Week-end",
    court: "week-end",
    definition: "un jour de week-end produit au moins 1,8 fois un jour ouvré",
  },
  continu: {
    nom: "Continu",
    court: "continu",
    definition: "production régulière sur le mois, sans pic marqué ni rythme de semaine",
  },
};
export const ORDRE_REGIMES = ["evenementiel", "semaine", "weekend", "continu"];

export const LOGIQUES = {
  sujet: { nom: "sujet", definition: "CLIP regroupe une scène photographiée : on voit de quoi parle l'image." },
  genre: { nom: "genre", definition: "CLIP regroupe un type de document (capture d'écran, graphique, carton, affiche…), quel qu'en soit le sujet." },
  gabarit: { nom: "gabarit", definition: "CLIP regroupe la charte graphique d'un éditeur : bandeau, logo, typographie. C'est un flux, pas un sujet." },
};

export const ROLES = {
  Media: "Rédactions nationales et régionales, chaînes, agences, pure players. Elles fabriquent le bruit de fond visuel : vignettes d'articles, photos d'agence, unes.",
  Officials: "Élus et partis, institutions, groupes d'intérêt. Communication codifiée : déplacements, pupitres, cérémonies, communiqués.",
  Vectors: "Militants, comptes partisans, agrégateurs d'opinion. Ils véhiculent et reformulent : un contenu repris par eux passe de l'information à l'argumentation.",
  Influencers: "Créateurs de contenu à large audience, hors médias et hors politique. Petite famille, visuels les plus hétérogènes du corpus.",
};

export function mot(n, singulier, pluriel) {
  return n >= 2 ? pluriel : singulier;
}
