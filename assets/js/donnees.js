// Chargement et décodage des données générées par scripts/build_data.py.
//
// points.bin est un fichier colonnaire : chaque colonne est un tableau typé
// placé à un décalage multiple de 8 octets (voir meta.json). On le lit sans
// aucun parsing : de simples vues sur le même ArrayBuffer.

const TYPES = {
  uint8: Uint8Array, int8: Int8Array, uint16: Uint16Array, int16: Int16Array,
  uint32: Uint32Array, int32: Int32Array, uint64: BigUint64Array, float32: Float32Array,
};

export class ErreurDonnees extends Error {
  constructor(fichier, cause) {
    super(`${fichier} : ${cause}`);
    this.fichier = fichier;
    this.cause = cause;
  }
}

async function recupere(fichier, { surProgression, tailleAttendue } = {}) {
  let reponse;
  try {
    reponse = await fetch(`data/${fichier}`, { cache: "default" });
  } catch (e) {
    throw new ErreurDonnees(fichier, location.protocol === "file:" ? "fichier-local" : "reseau");
  }
  if (!reponse.ok) throw new ErreurDonnees(fichier, `HTTP ${reponse.status}`);
  if (!surProgression || !reponse.body) return reponse;

  // Lecture en flux pour afficher une progression réelle.
  const lecteur = reponse.body.getReader();
  const morceaux = [];
  let recus = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    morceaux.push(value);
    recus += value.length;
    surProgression(recus, tailleAttendue);
  }
  const tout = new Uint8Array(recus);
  let pos = 0;
  for (const m of morceaux) { tout.set(m, pos); pos += m.length; }
  return new Response(tout);
}

function colonnes(buffer, disposition, n) {
  const sortie = {};
  for (const col of disposition) {
    const Type = TYPES[col.type];
    if (!Type) throw new ErreurDonnees("meta.json", `type de colonne inconnu : ${col.type}`);
    sortie[col.nom] = new Type(buffer, col.decalage, n);
  }
  return sortie;
}

export async function chargeTout(surProgression) {
  const meta = await (await recupere("meta.json")).json();
  const tailles = meta.fichiers;
  const total = tailles["points.bin"] + tailles["clusters.json"] + tailles["echantillon.json"] + tailles["evenements.json"];
  const recus = {};
  const progression = (fichier) => (n) => {
    recus[fichier] = n;
    surProgression(Object.values(recus).reduce((a, b) => a + b, 0), total, fichier);
  };

  const [binaire, clusters, echantillon, evenements] = await Promise.all([
    recupere("points.bin", { surProgression: progression("points.bin"), tailleAttendue: tailles["points.bin"] }).then((r) => r.arrayBuffer()),
    recupere("clusters.json", { surProgression: progression("clusters.json") }).then((r) => r.json()),
    recupere("echantillon.json", { surProgression: progression("echantillon.json") }).then((r) => r.json()),
    recupere("evenements.json", { surProgression: progression("evenements.json") }).then((r) => r.json()),
  ]);
  if (binaire.byteLength !== tailles["points.bin"]) {
    throw new ErreurDonnees("points.bin", `taille inattendue (${binaire.byteLength} octets au lieu de ${tailles["points.bin"]})`);
  }
  return new Donnees(meta, binaire, clusters, echantillon, evenements);
}

export class Donnees {
  constructor(meta, binaire, clusters, echantillon, evenements) {
    this.meta = meta;
    this.n = meta.points.n;
    this.p = colonnes(binaire, meta.points.colonnes, this.n);
    this.SANS = meta.points.sans_echantillon;
    this.evenements = evenements;
    this.familles = meta.familles;
    this.jours = meta.jours;

    // Fiches : tableau indexé par id + 1 (le bruit, -1, en position 0).
    this.fiches = [];
    for (const f of clusters) this.fiches[f.id + 1] = f;
    this.clusters = clusters.filter((f) => f.id >= 0);
    this.bruit = this.fiches[0];

    // Coordonnées réelles (déquantifiées) pour le survol et les étiquettes.
    const { x0, x1, y0, y1 } = meta.bornes;
    this.bornes = meta.bornes;
    this.x = new Float32Array(this.n);
    this.y = new Float32Array(this.n);
    const kx = (x1 - x0) / 65535, ky = (y1 - y0) / 65535;
    for (let i = 0; i < this.n; i++) {
      this.x[i] = x0 + this.p.x[i] * kx;
      this.y[i] = y0 + this.p.y[i] * ky;
    }

    // Cadre utile : les points classés, sans les quelques points isolés très
    // loin du reste (quantiles 0,3 % et 99,7 %), pour un premier cadrage lisible.
    const xs = [], ys = [];
    for (let i = 0; i < this.n; i++) {
      if (this.p.cluster[i] >= 0) { xs.push(this.x[i]); ys.push(this.y[i]); }
    }
    const q = (t, f) => { const s = Float32Array.from(t).sort(); return s[Math.floor(f * (s.length - 1))]; };
    this.cadreUtile = { x0: q(xs, 0.003), x1: q(xs, 0.997), y0: q(ys, 0.003), y1: q(ys, 0.997) };

    // Index des points par cluster.
    const comptes = new Uint32Array(65);
    for (let i = 0; i < this.n; i++) comptes[this.p.cluster[i] + 1]++;
    this.parCluster = Array.from(comptes, (c) => new Uint32Array(c));
    const pos = new Uint32Array(65);
    for (let i = 0; i < this.n; i++) {
      const c = this.p.cluster[i] + 1;
      this.parCluster[c][pos[c]++] = i;
    }

    // Échantillon local : [point, document_id, vl, vh, ol, oh, groupe]
    this.echantillon = echantillon.map(([point, doc, vl, vh, ol, oh, groupe], rang) => ({
      rang, point, doc, vl, vh, ol, oh, groupe,
      cluster: this.p.cluster[point],
    }));
    this.groupes = new Map();
    for (const e of this.echantillon) {
      if (e.groupe < 0) continue;
      if (!this.groupes.has(e.groupe)) this.groupes.set(e.groupe, []);
      this.groupes.get(e.groupe).push(e);
    }

    this.posts = null;       // chargé après le premier affichage
    this.originaux = null;   // chargé à l'ouverture de la visionneuse
  }

  fiche(id) {
    return this.fiches[id + 1];
  }

  vignette(e) {
    return `vignettes/${e.cluster}/${e.doc}.webp`;
  }

  echantillonDuPoint(i) {
    const k = this.p.sample[i];
    return k === this.SANS ? null : this.echantillon[k];
  }

  /** Charge l'identifiant des posts (lien vers X). Sans bloquer l'affichage. */
  chargePosts() {
    if (!this.promessePosts) {
      this.promessePosts = recupere("posts.bin")
        .then((r) => r.arrayBuffer())
        .then((buf) => {
          const m = this.meta.posts;
          this.posts = colonnes(buf, m.colonnes, m.n);
          return this.posts;
        })
        .catch((e) => {
          console.error(e);
          this.posts = false;
          return false;
        });
    }
    return this.promessePosts;
  }

  chargeOriginaux() {
    if (!this.promesseOriginaux) {
      this.promesseOriginaux = recupere("originaux.json").then((r) => r.json()).then((o) => (this.originaux = o));
    }
    return this.promesseOriginaux;
  }

  /** URL du post d'origine sur X, ou null si posts.bin n'est pas (encore) chargé. */
  urlPost(i) {
    if (!this.posts) return null;
    return `https://twitter.com/i/web/status/${this.posts.id[this.p.post[i]].toString()}`;
  }

  imagesDuPost(i) {
    return this.posts ? this.posts.images[this.p.post[i]] : null;
  }

  /**
   * Statistiques d'engagement d'un ensemble de clusters, un engagement par
   * post (un post de 4 images ne compte qu'une fois). Sert aux regroupements
   * faits à la main, que les fiches pré-calculées ne couvrent pas.
   */
  statsEngagement(ids) {
    const vus = new Set();
    const valeurs = [];
    let images = 0;
    for (const id of ids) {
      const pts = this.parCluster[id + 1];
      images += pts.length;
      for (const i of pts) {
        const post = this.p.post[i];
        if (vus.has(post)) continue;
        vus.add(post);
        valeurs.push(this.p.eng[i]);
      }
    }
    valeurs.sort((a, b) => a - b);
    const q = (p) => {
      if (!valeurs.length) return 0;
      const h = (valeurs.length - 1) * p, b = Math.floor(h);
      return valeurs[b] + (h - b) * ((valeurs[b + 1] ?? valeurs[b]) - valeurs[b]);
    };
    const somme = valeurs.reduce((a, b) => a + b, 0);
    return { images, posts: valeurs.length, mediane: q(0.5), q90: q(0.9), somme, max: valeurs[valeurs.length - 1] || 0 };
  }

  /**
   * Jours de publication des images locales d'un cluster. L'échantillon a été
   * tiré parmi les points de probabilité 1 par ordre de document_id, donc par
   * ordre de publication : il couvre surtout le début du mois (voir Limites).
   */
  datesEchantillon(f) {
    const jours = f.echantillon.map((r) => Math.floor(this.p.minute[this.echantillon[r].point] / 1440)).sort((a, b) => a - b);
    const serie = new Array(29).fill(0);
    for (const j of jours) serie[j]++;
    return {
      serie,
      premier: jours[0] ?? null,
      dernier: jours[jours.length - 1] ?? null,
      mediane: jours.length ? jours[Math.floor(jours.length / 2)] : null,
    };
  }

  /** Série quotidienne cumulée d'un ensemble de clusters. */
  serie(ids) {
    const s = new Array(29).fill(0);
    for (const id of ids) this.fiche(id).serie.forEach((v, j) => (s[j] += v));
    return s;
  }
}
