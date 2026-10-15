// État de l'interface et permaliens.
//
// Tout ce qui définit ce que l'analyste voit vit ici, et se reflète dans l'URL
// (#/vue?cle=valeur). Copier l'adresse suffit pour envoyer exactement le même
// écran à un collègue. Seules les valeurs différentes du défaut sont écrites,
// pour que les liens restent courts.

const VUES = ["carte", "temps", "familles", "resonance", "planches", "clusters", "limites", "methode"];

// clé d'état -> [clé courte dans l'URL, type, défaut]
const SCHEMA = {
  couleur:   ["c", "texte", "cluster"],    // cluster | famille | vectors | resonance
  bruit:     ["b", "bool", false],
  noms:      ["n", "bool", true],
  certitude: ["p", "nombre", 0],           // probabilité HDBSCAN minimale affichée
  iso:       ["iso", "liste", []],         // clusters isolés sur la carte
  sel:       ["sel", "entier", null],      // cluster ouvert dans la fiche
  t:         ["t", "entier", null],        // minute courante de la séquence, null = tout le mois
  trainee:   ["tr", "bool", true],
  vitesse:   ["v", "entier", 2],           // 1 lent, 2 normal, 3 rapide
  cadrage:   ["z", "cadrage", null],       // [x, y, zoom] ; null = carte entière
  planche:   ["pl", "entier", null],
  colonnes:  ["col", "entier", 6],
  triPlanche:["tp", "texte", "certitude"],
  avantApres:["aa", "bool", false],
  q:         ["q", "texte", ""],
  tri:       ["tri", "texte", "n"],
  sens:      ["s", "texte", "desc"],
  avecBruit: ["ab", "bool", false],
  focus:     ["f", "entier", null],        // cluster détaillé dans la vue Temps
  triMatrice:["tm", "texte", "Vectors"],
  parcours:  ["etape", "entier", null],
};

function defauts() {
  const d = { vue: "carte" };
  for (const [cle, [, , defaut]] of Object.entries(SCHEMA)) {
    d[cle] = Array.isArray(defaut) ? [...defaut] : defaut;
  }
  return d;
}

function lit(type, brut) {
  switch (type) {
    case "bool": return brut === "1";
    case "nombre": { const v = Number(brut); return Number.isFinite(v) ? v : undefined; }
    case "entier": { const v = parseInt(brut, 10); return Number.isFinite(v) ? v : undefined; }
    case "liste": return brut.split(",").map(Number).filter(Number.isFinite);
    case "cadrage": {
      const v = brut.split(",").map(Number);
      return v.length === 3 && v.every(Number.isFinite) ? v : undefined;
    }
    default: return brut;
  }
}

function ecrit(type, valeur) {
  switch (type) {
    case "bool": return valeur ? "1" : "0";
    case "liste": return valeur.join(",");
    case "cadrage": return valeur.map((v, i) => (i < 2 ? v.toFixed(2) : v.toFixed(3))).join(",");
    case "nombre": return String(Math.round(valeur * 100) / 100);
    default: return String(valeur);
  }
}

function egal(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return a === b;
}

export function depuisURL(hash = location.hash) {
  const etat = defauts();
  const [chemin, requete = ""] = hash.replace(/^#\/?/, "").split("?");
  const vue = chemin.split("/")[0];
  if (VUES.includes(vue)) etat.vue = vue;
  const params = new URLSearchParams(requete);
  for (const [cle, [court, type]] of Object.entries(SCHEMA)) {
    if (params.has(court)) {
      const v = lit(type, params.get(court));
      if (v !== undefined) etat[cle] = v;
    }
  }
  return etat;
}

export function versURL(etat) {
  const d = defauts();
  const params = new URLSearchParams();
  for (const [cle, [court, type]] of Object.entries(SCHEMA)) {
    const v = etat[cle];
    if (v === null || v === undefined || egal(v, d[cle])) continue;
    params.set(court, ecrit(type, v));
  }
  const requete = params.toString().replace(/%2C/g, ",");
  return `#/${etat.vue}${requete ? `?${requete}` : ""}`;
}

class Etat {
  constructor() {
    this.valeurs = depuisURL();
    this.abonnes = [];
    this.minuteur = null;
    window.addEventListener("hashchange", () => {
      if (location.hash === this.dernierHash) return;
      const nouveau = depuisURL();
      const changees = Object.keys(nouveau).filter((k) => !egal(nouveau[k], this.valeurs[k]));
      this.valeurs = nouveau;
      this.notifie(changees);
    });
  }

  get(cle) {
    return this.valeurs[cle];
  }

  /**
   * Modifie l'état. `historique: true` crée une entrée d'historique (changement
   * de vue) ; sinon l'URL est remplacée, avec un léger délai pour ne pas
   * saturer l'historique pendant un zoom ou une lecture.
   */
  change(patch, { historique = false } = {}) {
    const changees = [];
    for (const [cle, v] of Object.entries(patch)) {
      if (!egal(this.valeurs[cle], v)) {
        this.valeurs[cle] = Array.isArray(v) ? [...v] : v;
        changees.push(cle);
      }
    }
    if (!changees.length) return;
    this.ecritURL(historique);
    this.notifie(changees);
  }

  ecritURL(historique) {
    clearTimeout(this.minuteur);
    const pousse = () => {
      const url = versURL(this.valeurs);
      if (url === location.hash) return;
      this.dernierHash = url;
      if (historique) history.pushState(null, "", url);
      else history.replaceState(null, "", url);
    };
    if (historique) pousse();
    else this.minuteur = setTimeout(pousse, 180);
  }

  /** Abonne `fn` aux changements des clés listées (ou de toutes si `cles` est vide). */
  ecoute(cles, fn) {
    this.abonnes.push({ cles: new Set(cles), fn });
  }

  notifie(changees) {
    for (const { cles, fn } of this.abonnes) {
      if (!cles.size || changees.some((c) => cles.has(c))) fn(changees, this.valeurs);
    }
  }

  lienAbsolu() {
    return `${location.origin}${location.pathname}${versURL(this.valeurs)}`;
  }
}

export const etat = new Etat();
export { VUES };
