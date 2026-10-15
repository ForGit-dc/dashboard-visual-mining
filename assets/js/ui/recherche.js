// Recherche sur les clusters, avec opérateurs.
//
//   pape visite            les deux mots (ET implicite)
//   pape OU football       l'un ou l'autre (OU, OR)
//   -football  NON foot    exclusion (NON, NOT, -)
//   "faits divers"         expression exacte
//   famille:vectors        famille dominante (media, officials, vectors, influencers)
//   logique:gabarit        sujet, genre, gabarit
//   regime:evenementiel    evenementiel, semaine, weekend, continu
//   pic:25                 jour de pic (25 ou 25/09)
//   images>1000  mediane>=20  vectors>2  melange>0.8  posts<500  jours<29
//
// La recherche ignore accents et majuscules et porte sur le nom, la lecture
// (« ce qu'on voit ») et la note de chaque cluster.

import { plie } from "../format.js";
import { FAMILLES } from "../couleurs.js";

const NUMERIQUES = {
  images: (f) => f.n,
  posts: (f) => f.posts,
  mediane: (f) => f.eng.mediane,
  decile: (f) => f.eng.q90,
  vectors: (f) => f.ratios[2],
  officials: (f) => f.ratios[1],
  media: (f) => f.ratios[0],
  influencers: (f) => f.ratios[3],
  melange: (f) => f.entropie,
  jours: (f) => f.jours_actifs,
  pic: (f) => f.pic + 1,
  concentration: (f) => f.pct_pic,
  id: (f) => f.id,
};

function decoupe(texte) {
  const jetons = [];
  const re = /\s*(-?"[^"]*"|\S+)/g;
  let m;
  while ((m = re.exec(texte))) jetons.push(m[1]);
  return jetons;
}

function clause(jeton) {
  let neg = false;
  let t = jeton;
  if (t.startsWith("-") && t.length > 1) { neg = true; t = t.slice(1); }
  if (t.startsWith('"')) return { neg, type: "texte", valeur: plie(t.replace(/"/g, "")) };
  const comparaison = t.match(/^([a-zé]+)(>=|<=|>|<|=)(-?[\d.,]+)$/i);
  if (comparaison && NUMERIQUES[plie(comparaison[1])]) {
    return { neg, type: "compare", champ: plie(comparaison[1]), op: comparaison[2], valeur: Number(comparaison[3].replace(",", ".")) };
  }
  const champ = t.match(/^([a-zé]+):(.+)$/i);
  if (champ) return { neg, type: "champ", champ: plie(champ[1]), valeur: plie(champ[2]) };
  return { neg, type: "texte", valeur: plie(t) };
}

/** Analyse la requête en groupes OU de clauses ET. Renvoie aussi les erreurs lisibles. */
export function analyse(requete) {
  const groupes = [[]];
  const erreurs = [];
  let negSuivant = false;
  for (const j of decoupe(requete.trim())) {
    const mot = plie(j);
    if (mot === "ou" || mot === "or" || mot === "|") { if (groupes[groupes.length - 1].length) groupes.push([]); continue; }
    if (mot === "et" || mot === "and" || mot === "&") continue;
    if (mot === "non" || mot === "not") { negSuivant = true; continue; }
    const c = clause(j);
    if (negSuivant) { c.neg = !c.neg; negSuivant = false; }
    if (c.type === "champ" && !["famille", "logique", "regime", "pic", "id"].includes(c.champ)) {
      erreurs.push(`champ inconnu « ${c.champ} »`);
      continue;
    }
    groupes[groupes.length - 1].push(c);
  }
  return { groupes: groupes.filter((g) => g.length), erreurs };
}

function vrai(c, f) {
  switch (c.type) {
    case "texte":
      return plie(`${f.id} ${f.label} ${f.voit ?? ""} ${f.note ?? ""}`).includes(c.valeur);
    case "champ":
      if (c.champ === "famille") return plie(FAMILLES[f.dominante]).startsWith(c.valeur);
      if (c.champ === "logique") return plie(f.logique ?? "").startsWith(c.valeur);
      if (c.champ === "regime") return plie(f.regime ?? "").startsWith(c.valeur.replace("-", ""));
      if (c.champ === "pic") return f.pic + 1 === parseInt(c.valeur, 10);
      if (c.champ === "id") return f.id === parseInt(c.valeur, 10);
      return false;
    case "compare": {
      const v = NUMERIQUES[c.champ](f);
      switch (c.op) {
        case ">": return v > c.valeur;
        case ">=": return v >= c.valeur;
        case "<": return v < c.valeur;
        case "<=": return v <= c.valeur;
        default: return Math.abs(v - c.valeur) < 1e-9;
      }
    }
    default:
      return true;
  }
}

/** Filtre une liste de fiches. Requête vide : tout passe. */
export function filtre(fiches, requete) {
  const { groupes, erreurs } = analyse(requete);
  if (!groupes.length) return { resultats: fiches, erreurs };
  const resultats = fiches.filter((f) => groupes.some((g) => g.every((c) => vrai(c, f) !== c.neg)));
  return { resultats, erreurs };
}
