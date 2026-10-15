// Vue Carte : la projection UMAP des 65 229 images.
//
// Couches, de bas en haut : points (WebGL), vignettes au zoom fort et noms de
// clusters (canvas 2D), puis légende, zoom et légende d'événement (DOM).

import { etat } from "../etat.js";
import { entier, decimal, minuteLongue, jourCourt, jourMoyen, heure, html, plie, accord } from "../format.js";
import { couleurCluster, COULEUR_FAMILLE, FAMILLES, BRUIT, rampeVectors, couleurResonance, MAX_RESONANCE, barreComposition } from "../couleurs.js";
import { RenduPoints, hexVersRgb } from "./rendu.js";
import { Grille } from "./grille.js";
import * as etiquettes from "./etiquettes.js";
import { Sequence } from "./sequence.js";
import * as infobulle from "../ui/infobulle.js";
import { construitFiche } from "../ui/fiche.js";
import { ouvre as ouvreVisionneuse } from "../ui/visionneuse.js";
import { telecharge, notifie } from "../ui/notifier.js";

const MODES = [
  ["cluster", "Cluster"],
  ["famille", "Famille dominante"],
  ["vectors", "Poids des Vectors"],
  ["resonance", "Résonance"],
];

const TITRES = {
  cluster: "Deux continents : à gauche des photographies, à droite des images faites de texte",
  famille: "Deux tiers des images d'Officials sont des photos de terrain ; les Media tiennent les vignettes titrées",
  vectors: "Les Vectors pèsent 13,2 % du corpus, mais jusqu'à six fois plus dans quelques genres d'images",
  resonance: "Les photographies sont trois fois plus reprises que les images faites de texte : médiane 16 engagements par post contre 5",
};

export class VueCarte {
  constructor(conteneur, donnees, navigation) {
    this.d = donnees;
    this.nav = navigation;
    this.el = conteneur;
    this.vue = null;           // { cx, cy, k }
    this.k0 = 1;
    this.survolCluster = null;
    this.survolPoint = -1;
    this.rendaPrevu = false;
    this.cacheImages = new Map();
    this.construitDom();

    try {
      this.rendu = new RenduPoints(this.canvasGl, donnees);
    } catch (e) {
      console.error(e);
      this.rendu = null;
      this.zone.insertAdjacentHTML("beforeend", `<div class="carte__repli"><div>
        <h3>La carte ne peut pas s'afficher</h3>
        <p>Elle a besoin de WebGL 2, absent ou désactivé dans ce navigateur (${html(e.message)}).<br>
        Les autres vues (Temps, Familles, Résonance, Planches, Clusters) restent disponibles.</p></div></div>`);
    }
    this.grille = new Grille(donnees.x, donnees.y, donnees.bornes);
    this.sequence = new Sequence(this.frise, donnees, { surRendu: () => this.demandeRendu() });
    this.sequence.compose = () => this.composeVideo();
    this.brancheInteractions();
    this.majCouleurs();
    this.majPanneau();
    this.majLegende();
    this.majOutils();

    etat.ecoute(["couleur", "bruit", "certitude", "iso"], () => {
      this.majCouleurs();
      this.majLegende();
      this.majOutils();
      this.demandeRendu();
    });
    etat.ecoute(["noms", "trainee"], () => { this.majOutils(); this.demandeRendu(); });
    etat.ecoute(["sel"], () => this.majPanneau());
    etat.ecoute(["t"], () => {
      this.majEvenement();
      this.demandeRendu();
      // Pendant la lecture, le compteur suit au plus quatre fois par seconde.
      if (!this.compteur) this.compteur = setTimeout(() => { this.compteur = null; this.majCompte(); }, 250);
    });
    etat.ecoute(["cadrage"], (_, v) => {
      if (this.ecritureCadrage) return;
      if (v.cadrage) this.anime(this.depuisCadrage(v.cadrage));
      else this.anime(this.cadreTout());
    });

    new ResizeObserver(() => this.redimensionne()).observe(this.zone);
  }

  // ------------------------------------------------------------------ DOM
  construitDom() {
    this.el.classList.add("vue-carte", "vue--plein");
    this.el.innerHTML = `
      <div class="carte__outils">
        <div class="carte__titre"><h2 id="titre-carte"></h2><span class="discret" id="compte-carte"></span></div>
        <div class="carte__groupe" role="group" aria-label="Couleur des points">
          <span class="libelle">Couleur</span>
          <div class="segments" id="modes-carte">${MODES.map(([v, l]) => `<button type="button" data-mode="${v}" aria-pressed="false">${l}</button>`).join("")}</div>
        </div>
        <label class="interrupteur" title="Afficher les 16 916 images que HDBSCAN n'a rangées dans aucun cluster (B)"><input type="checkbox" id="bascule-bruit"> Non classées</label>
        <label class="interrupteur" title="Noms de clusters (N)"><input type="checkbox" id="bascule-noms"> Noms</label>
        <label class="interrupteur" title="Masquer les points dont la probabilité d'appartenance HDBSCAN est inférieure au seuil">
          Certitude ≥ <input type="range" id="curseur-certitude" min="0" max="1" step="0.05" style="width:90px"> <span class="num" id="valeur-certitude"></span></label>
        <div class="carte__groupe carte__groupe--fin">
          <button type="button" class="bouton bouton--discret" id="plein-ecran" title="Plein écran (F)">Plein écran</button>
          <button type="button" class="bouton bouton--discret" id="export-carte" title="Télécharger la carte telle qu'affichée, en PNG">PNG</button>
        </div>
      </div>
      <div class="carte__zone" id="zone-carte" aria-label="Carte UMAP des images ; utilisez la liste à droite pour naviguer au clavier" role="img">
        <canvas class="calque-points"></canvas>
        <canvas class="calque-noms"></canvas>
        <div class="zoom">
          <button type="button" data-zoom="1" aria-label="Zoomer" title="Zoomer (+)">+</button>
          <button type="button" data-zoom="-1" aria-label="Dézoomer" title="Dézoomer (−)">−</button>
          <button type="button" data-zoom="0" aria-label="Recadrer" title="Recadrer la carte (0)">⟲</button>
        </div>
        <div class="legende" id="legende-carte"></div>
        <div class="legende-evenement" id="evenement-carte" hidden></div>
      </div>
      <div class="frise"></div>
      <aside class="panneau" id="panneau-carte" aria-label="Clusters"></aside>`;
    this.zone = this.el.querySelector("#zone-carte");
    this.canvasGl = this.el.querySelector(".calque-points");
    this.canvas2d = this.el.querySelector(".calque-noms");
    this.ctx = this.canvas2d.getContext("2d");
    this.frise = this.el.querySelector(".frise");
    this.panneau = this.el.querySelector("#panneau-carte");
  }

  majOutils() {
    const v = etat.valeurs;
    this.el.querySelectorAll("#modes-carte button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === v.couleur)));
    this.el.querySelector("#bascule-bruit").checked = v.bruit;
    this.el.querySelector("#bascule-noms").checked = v.noms;
    this.el.querySelector("#curseur-certitude").value = v.certitude;
    this.el.querySelector("#valeur-certitude").textContent = decimal(v.certitude, 2);
    this.el.querySelector("#titre-carte").textContent = TITRES[v.couleur] ?? TITRES.cluster;
    this.majCompte();
  }

  /** Nombre de points réellement dessinés : bruit, certitude, isolement et date compris. */
  compteVisibles() {
    let n = 0;
    for (let i = 0; i < this.d.n; i++) if (this.estVisible(i)) n++;
    return n;
  }

  majCompte() {
    const el = this.el.querySelector("#compte-carte");
    if (el) el.textContent = `${entier(this.compteVisibles())} images affichées sur ${entier(this.d.n)}`;
  }

  // ------------------------------------------------------------------ Couleurs et visibilité
  majCouleurs() {
    if (!this.rendu) return;
    const v = etat.valeurs;
    const couleurs = [], drapeaux = [];
    for (let c = -1; c < 64; c++) {
      const f = this.d.fiche(c);
      couleurs.push(hexVersRgb(couleurCluster(f, v.couleur)));
      drapeaux.push([v.iso.includes(c), c === this.survolCluster, true]);
    }
    this.rendu.majTexture(couleurs, drapeaux);
  }

  estVisible(i) {
    const v = etat.valeurs;
    const p = this.d.p;
    const c = p.cluster[i];
    if (c === -1) { if (!v.bruit) return false; }
    else if (p.prob[i] / 255 + 0.0001 < v.certitude) return false;
    if (v.t !== null) {
      const age = v.t - p.minute[i];
      if (age < 0) return false;
      if (age > 1440 && !v.trainee) return false;
    }
    if (v.iso.length && !v.iso.includes(c)) return false;
    return true;
  }

  // ------------------------------------------------------------------ Géométrie
  cadreTout() {
    const { x0, x1, y0, y1 } = this.d.cadreUtile;
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, k: this.k0 };
  }

  calculeK0() {
    const { x0, x1, y0, y1 } = this.d.cadreUtile;
    this.k0 = Math.min(this.largeur / (x1 - x0), this.hauteur / (y1 - y0)) * 0.92;
  }

  versEcran(x, y) {
    const { cx, cy, k } = this.vue;
    return [this.largeur / 2 + (x - cx) * k, this.hauteur / 2 - (y - cy) * k];
  }

  versDonnees(sx, sy) {
    const { cx, cy, k } = this.vue;
    return [cx + (sx - this.largeur / 2) / k, cy - (sy - this.hauteur / 2) / k];
  }

  depuisCadrage([cx, cy, z]) {
    return { cx, cy, k: this.k0 * z };
  }

  cadrePour(ids) {
    let xa = Infinity, ya = Infinity, xb = -Infinity, yb = -Infinity;
    for (const id of ids) {
      const c = this.d.fiche(id).cadre;
      if (!c) continue;
      xa = Math.min(xa, c[0]); ya = Math.min(ya, c[1]); xb = Math.max(xb, c[2]); yb = Math.max(yb, c[3]);
    }
    if (!Number.isFinite(xa)) return this.cadreTout();
    const k = Math.min(this.largeur / (xb - xa), this.hauteur / (yb - ya)) * 0.6;
    return { cx: (xa + xb) / 2, cy: (ya + yb) / 2, k: Math.min(Math.max(k, this.k0), this.k0 * 14) };
  }

  bornerK(k) {
    return Math.min(Math.max(k, this.k0 * 0.4), this.k0 * 60);
  }

  redimensionne() {
    const r = this.zone.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const premier = !this.largeur;
    const ancienK0 = this.k0;
    this.largeur = r.width;
    this.hauteur = r.height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.calculeK0();
    if (premier) {
      this.vue = etat.get("cadrage") ? this.depuisCadrage(etat.get("cadrage")) : this.cadreTout();
    } else if (this.vue) {
      this.vue.k *= this.k0 / ancienK0;
    }
    this.rendu?.redimensionne(this.largeur, this.hauteur, this.dpr);
    this.canvas2d.width = Math.round(this.largeur * this.dpr);
    this.canvas2d.height = Math.round(this.hauteur * this.dpr);
    this.sequence.redimensionne();
    this.demandeRendu();
  }

  // ------------------------------------------------------------------ Rendu
  demandeRendu() {
    if (this.rendaPrevu) return;
    this.rendaPrevu = true;
    requestAnimationFrame(() => {
      this.rendaPrevu = false;
      this.rend();
    });
  }

  tailleDePoint() {
    const z = this.vue.k / this.k0;
    return Math.min(9, Math.max(1.7, 2.1 * Math.pow(z, 0.42))) * this.dpr;
  }

  rend() {
    if (!this.vue || !this.largeur || !this.el.classList.contains("active")) return;
    const v = etat.valeurs;
    const t0 = performance.now();
    if (this.rendu) {
      this.rendu.dessine(this.vue, this.d.bornes, this.largeur, this.hauteur, {
        taille: this.tailleDePoint(),
        t: v.t,
        fenetre: 1440,
        trainee: v.trainee,
        bruit: v.bruit,
        certitude: v.certitude,
        isole: v.iso.length > 0,
      });
    }
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.largeur, this.hauteur);
    this.dessineVignettes(ctx);
    if (v.noms) this.dessineRegions(ctx);
    if (v.noms) this.dessineNoms(ctx);
    this.dernierRendu = performance.now() - t0;
    // Mesures lues par la recette de performance (voir README, « Performances »).
    const m = (window.__mesures ??= {});
    m.premiere_carte_ms ??= Math.round(performance.now());
    (m.rendus ??= []).push(this.dernierRendu);
    if (m.rendus.length > 600) m.rendus.shift();
    if (this.surRendu) this.surRendu(ctx);
  }

  /**
   * Les deux continents de la carte, nommés comme des régions sur une carte
   * de géographie. Ils sont calculés dans build_data.py (plus grand écart entre
   * les ancres de clusters sur l'axe horizontal) et tiennent à la lecture des
   * images : à gauche 92 % de photographies, à droite 94 % d'images où le texte
   * domine. On ne les montre qu'à faible zoom, quand le lecteur cherche ses repères.
   */
  dessineRegions(ctx) {
    const z = this.vue.k / this.k0;
    if (z > 1.8 || etat.get("iso").length) return;
    const regions = this.d.meta.continents || [];
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = `600 11px "Public Sans", sans-serif`;
    for (const r of regions) {
      const [x, y] = this.versEcran(r.x, r.y);
      const texte = r.nom.toUpperCase().split("").join(" ");
      ctx.fillStyle = "rgba(111, 105, 93, 0.9)";
      ctx.fillText(texte, x, y);
      ctx.font = `italic 400 12.5px Newsreader, Georgia, serif`;
      ctx.fillText(r.detail, x, y + 16);
      ctx.font = `600 11px "Public Sans", sans-serif`;
    }
    ctx.restore();
  }

  dessineNoms(ctx) {
    const v = etat.valeurs;
    const cumul = v.t === null ? null : Math.floor(v.t / 1440);
    const candidats = [];
    for (const f of this.d.clusters) {
      const isole = v.iso.includes(f.id);
      const survole = f.id === this.survolCluster;
      if (v.iso.length && !isole && !survole) continue;
      let priorite = f.n;
      let gras = false;
      if (cumul !== null) {
        let deja = 0;
        for (let j = 0; j <= cumul; j++) deja += f.serie[j];
        if (deja < 5) continue;
        const aujourdhui = f.serie[cumul];
        priorite = aujourdhui * 10 + deja / 100;
        gras = aujourdhui >= 0.12 * f.n;
      }
      const [x, y] = this.versEcran(f.ancre[0], f.ancre[1]);
      if (x < -50 || y < -20 || x > this.largeur + 50 || y > this.hauteur + 20) continue;
      const taille = 11 + 4 * Math.sqrt(Math.max(0, f.n - 200) / 6900);
      candidats.push({
        id: f.id, texte: f.label, x, y, ancreX: x, ancreY: y,
        taille: Math.round(taille * 2) / 2,
        priorite, force: isole || survole || f.id === v.sel, gras: gras || survole || isole,
      });
    }
    const obstacles = [];
    const leg = this.el.querySelector("#legende-carte");
    if (leg && !leg.hidden) {
      const rz = this.zone.getBoundingClientRect(), rl = leg.getBoundingClientRect();
      obstacles.push({ x: rl.left - rz.left, y: rl.top - rz.top, w: rl.width, h: rl.height });
    }
    const evt = this.el.querySelector("#evenement-carte");
    if (evt && !evt.hidden) {
      const rz = this.zone.getBoundingClientRect(), re = evt.getBoundingClientRect();
      obstacles.push({ x: re.left - rz.left, y: re.top - rz.top, w: re.width, h: re.height });
    }
    obstacles.push({ x: this.largeur - 48, y: 6, w: 44, h: 100 }); // boutons de zoom
    this.nomsPoses = etiquettes.place(ctx, candidats, this.largeur, this.hauteur, { obstacles });
    etiquettes.dessine(ctx, this.nomsPoses);
  }

  dessineVignettes(ctx) {
    // Au zoom fort, la carte devient planche contact : les images locales
    // remplacent leurs points (à la manière de PixPlot, Yale DHLab).
    const z = this.vue.k / this.k0;
    if (z < 5) return;
    const [xa, yb] = this.versDonnees(0, 0);
    const [xb, ya] = this.versDonnees(this.largeur, this.hauteur);
    const p = this.d.p;
    const ech = this.grille.dansRectangle(xa, ya, xb, yb, (i) => p.sample[i] !== this.d.SANS && this.estVisible(i), 400);
    if (ech.length > 400) return;
    const cote = Math.min(84, Math.max(30, this.vue.k * 0.45));
    ech.sort((a, b) => p.prob[a] - p.prob[b]);
    for (const i of ech) {
      const e = this.d.echantillonDuPoint(i);
      const img = this.image(e);
      if (!img.complete || !img.naturalWidth) continue;
      const [sx, sy] = this.versEcran(this.d.x[i], this.d.y[i]);
      const r = Math.min(cote / img.naturalWidth, cote / img.naturalHeight);
      const w = img.naturalWidth * r, h = img.naturalHeight * r;
      ctx.fillStyle = "#121110";
      ctx.fillRect(sx - w / 2 - 1.5, sy - h / 2 - 1.5, w + 3, h + 3);
      ctx.drawImage(img, sx - w / 2, sy - h / 2, w, h);
    }
  }

  image(e) {
    let img = this.cacheImages.get(e.doc);
    if (!img) {
      img = new Image();
      img.decoding = "async";
      img.onload = () => this.demandeRendu();
      img.src = this.d.vignette(e);
      this.cacheImages.set(e.doc, img);
    }
    return img;
  }

  // ------------------------------------------------------------------ Animation de cadrage
  anime(cible, duree = null) {
    if (!this.vue) { this.vue = cible; return; }
    const de = [this.vue.cx, this.vue.cy, this.largeur / this.vue.k];
    const vers = [cible.cx, cible.cy, this.largeur / cible.k];
    const interp = d3.interpolateZoom(de, vers);
    const total = duree ?? Math.min(900, Math.max(250, interp.duration * 0.6));
    const debut = performance.now();
    cancelAnimationFrame(this.animation);
    const pas = (maintenant) => {
      const t = Math.min(1, (maintenant - debut) / total);
      const [cx, cy, w] = interp(d3.easeCubicInOut(t));
      this.vue = { cx, cy, k: this.largeur / w };
      this.rend();
      if (t < 1) this.animation = requestAnimationFrame(pas);
      else this.memoriseCadrage();
    };
    this.animation = requestAnimationFrame(pas);
  }

  memoriseCadrage() {
    clearTimeout(this.minuteurCadrage);
    this.minuteurCadrage = setTimeout(() => {
      const z = this.vue.k / this.k0;
      const toutVu = Math.abs(z - 1) < 0.02 && Math.abs(this.vue.cx - this.cadreTout().cx) < 0.05 && Math.abs(this.vue.cy - this.cadreTout().cy) < 0.05;
      this.ecritureCadrage = true;
      etat.change({ cadrage: toutVu ? null : [this.vue.cx, this.vue.cy, z] });
      this.ecritureCadrage = false;
    }, 250);
  }

  zoomPar(facteur, sx = this.largeur / 2, sy = this.hauteur / 2) {
    const [x, y] = this.versDonnees(sx, sy);
    const k = this.bornerK(this.vue.k * facteur);
    this.vue = { k, cx: x - (sx - this.largeur / 2) / k, cy: y + (sy - this.hauteur / 2) / k };
    this.demandeRendu();
    this.memoriseCadrage();
  }

  recadre() {
    this.anime(this.cadreTout());
  }

  // ------------------------------------------------------------------ Interactions
  brancheInteractions() {
    const z = this.zone;
    let glisse = null;
    const pointeurs = new Map();

    z.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".zoom, .legende, .legende-evenement")) return;
      z.setPointerCapture(e.pointerId);
      pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      glisse = { x: e.clientX, y: e.clientY, cx: this.vue.cx, cy: this.vue.cy, bouge: false };
      cancelAnimationFrame(this.animation);
    });
    z.addEventListener("pointermove", (e) => {
      const r = z.getBoundingClientRect();
      if (pointeurs.size === 2 && pointeurs.has(e.pointerId)) {
        // Pincement à deux doigts.
        const [a, b] = [...pointeurs.values()];
        const avant = Math.hypot(a.x - b.x, a.y - b.y);
        pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const [c, d] = [...pointeurs.values()];
        const apres = Math.hypot(c.x - d.x, c.y - d.y);
        if (avant > 0) this.zoomPar(apres / avant, (c.x + d.x) / 2 - r.left, (c.y + d.y) / 2 - r.top);
        return;
      }
      if (glisse && pointeurs.has(e.pointerId)) {
        const dx = e.clientX - glisse.x, dy = e.clientY - glisse.y;
        if (!glisse.bouge && Math.hypot(dx, dy) > 4) {
          glisse.bouge = true;
          z.classList.add("glisse");
          infobulle.cache({ force: true });
        }
        if (glisse.bouge) {
          this.vue = { ...this.vue, cx: glisse.cx - dx / this.vue.k, cy: glisse.cy + dy / this.vue.k };
          this.demandeRendu();
        }
        return;
      }
      this.survole(e.clientX - r.left, e.clientY - r.top, e.clientX, e.clientY);
    });
    const fin = (e) => {
      pointeurs.delete(e.pointerId);
      if (!glisse) return;
      const etaitGlisse = glisse.bouge;
      glisse = null;
      z.classList.remove("glisse");
      if (etaitGlisse) { this.memoriseCadrage(); return; }
      if (e.type === "pointerup") this.clique(e);
    };
    z.addEventListener("pointerup", fin);
    z.addEventListener("pointercancel", fin);
    z.addEventListener("pointerleave", () => {
      if (!glisse) this.finSurvol();
    });
    z.addEventListener("wheel", (e) => {
      e.preventDefault();
      const r = z.getBoundingClientRect();
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      this.zoomPar(Math.exp(-delta * 0.0016), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    z.addEventListener("dblclick", (e) => {
      const r = z.getBoundingClientRect();
      this.zoomPar(2, e.clientX - r.left, e.clientY - r.top);
    });

    this.el.querySelectorAll("[data-zoom]").forEach((b) => b.addEventListener("click", () => {
      const s = Number(b.dataset.zoom);
      if (s === 0) this.recadre(); else this.zoomPar(s > 0 ? 1.6 : 1 / 1.6);
    }));
    this.el.querySelector("#modes-carte").addEventListener("click", (e) => {
      const b = e.target.closest("[data-mode]");
      if (b) etat.change({ couleur: b.dataset.mode });
    });
    this.el.querySelector("#bascule-bruit").addEventListener("change", (e) => etat.change({ bruit: e.target.checked }));
    this.el.querySelector("#bascule-noms").addEventListener("change", (e) => etat.change({ noms: e.target.checked }));
    this.el.querySelector("#curseur-certitude").addEventListener("input", (e) => etat.change({ certitude: Number(e.target.value) }));
    this.el.querySelector("#plein-ecran").addEventListener("click", () => this.pleinEcran());
    this.el.querySelector("#export-carte").addEventListener("click", () => this.exportePng());

    // L'infobulle d'un point reste ouverte quand on la survole : son lien est cliquable.
    const bulle = infobulle.element();
    bulle.addEventListener("pointerenter", () => infobulle.maintiens(true));
    bulle.addEventListener("pointerleave", () => { infobulle.maintiens(false); infobulle.cache(); });
  }

  survole(sx, sy, clientX, clientY) {
    if (!this.vue) return;
    const [x, y] = this.versDonnees(sx, sy);
    const rayon = Math.max(10, this.tailleDePoint() / this.dpr * 1.5) / this.vue.k;
    const debut = performance.now();
    const i = this.grille.plusProche(x, y, rayon, (j) => this.estVisible(j));
    const m = (window.__mesures ??= {});
    (m.survols ??= []).push(performance.now() - debut);
    if (m.survols.length > 600) m.survols.shift();
    if (i === this.survolPoint) {
      if (i >= 0) infobulle.place(clientX, clientY);
      return;
    }
    this.survolPoint = i;
    const c = i >= 0 ? this.d.p.cluster[i] : null;
    this.zone.style.cursor = i >= 0 ? "pointer" : "";
    if (c !== this.survolCluster) {
      this.survolCluster = c;
      this.majCouleurs();
      this.demandeRendu();
    }
    if (i < 0) { infobulle.cache(); return; }
    infobulle.montre(this.contenuInfobulle(i), clientX, clientY, { interactive: true });
  }

  finSurvol() {
    this.survolPoint = -1;
    if (this.survolCluster !== null) {
      this.survolCluster = null;
      this.majCouleurs();
      this.demandeRendu();
    }
    setTimeout(() => infobulle.cache(), 120);
  }

  contenuInfobulle(i) {
    const p = this.d.p;
    const c = p.cluster[i];
    const f = this.d.fiche(c);
    const e = this.d.echantillonDuPoint(i);
    const url = this.d.urlPost(i);
    const nbImages = this.d.imagesDuPost(i);
    const couleur = c === -1 ? BRUIT : couleurCluster(f, etat.get("couleur"));
    const visuel = e
      ? `<img class="infobulle__image" src="${this.d.vignette(e)}" alt="" width="${e.vl}" height="${e.vh}">`
      : `<p class="infobulle__absente">${c === -1
          ? "Image non classée : le dépôt ne contient pas les images du bruit."
          : "Image non disponible en local : seules les 10 % d'images les plus certaines de chaque cluster sont dans le dépôt."}</p>`;
    if (!this.d.posts) this.d.chargePosts().then(() => { if (this.survolPoint === i) infobulle.montre(this.contenuInfobulle(i), ...this.dernierePosition()); });
    return `${visuel}
      <div style="display:flex;align-items:center;gap:6px;font-weight:700"><span class="pastille" style="--c:${couleur}"></span>${html(c === -1 ? "Non classée (bruit HDBSCAN)" : f.label)}</div>
      <hr>
      <div class="infobulle__ligne"><span>Publiée</span><span>${minuteLongue(p.minute[i])}</span></div>
      <div class="infobulle__ligne"><span>Engagements du post</span><span>${entier(p.eng[i])}</span></div>
      ${nbImages > 1 ? `<div class="infobulle__ligne discret"><span>Post de ${nbImages} images</span><span>même chiffre</span></div>` : ""}
      ${c >= 0 ? `<div class="infobulle__ligne"><span>Certitude</span><span>${decimal(p.prob[i] / 255, 2)}</span></div>` : ""}
      <hr>
      ${url ? `<a href="${url}" target="_blank" rel="noopener noreferrer">Ouvrir le post sur X ↗</a>` : `<span class="discret">Lien vers le post en chargement…</span>`}
      ${c >= 0 ? `<div class="discret petit" style="margin-top:4px">Clic : isoler ce cluster · Ctrl + clic : l'ajouter</div>` : ""}`;
  }

  dernierePosition() {
    const b = infobulle.element().getBoundingClientRect();
    return [b.left - 14, b.top - 14];
  }

  clique(e) {
    const r = this.zone.getBoundingClientRect();
    const [x, y] = this.versDonnees(e.clientX - r.left, e.clientY - r.top);
    const rayon = Math.max(10, this.tailleDePoint() / this.dpr * 1.5) / this.vue.k;
    const i = this.grille.plusProche(x, y, rayon, (j) => this.estVisible(j));
    const v = etat.valeurs;
    if (i < 0) {
      if (v.iso.length || v.sel !== null) etat.change({ iso: [], sel: null });
      return;
    }
    const c = this.d.p.cluster[i];
    if (c === -1) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      const iso = v.iso.includes(c) ? v.iso.filter((k) => k !== c) : [...v.iso, c];
      etat.change({ iso, sel: iso.length ? c : null });
    } else if (v.iso.length === 1 && v.iso[0] === c) {
      etat.change({ iso: [], sel: null });
    } else {
      etat.change({ iso: [c], sel: c });
      this.anime(this.cadrePour([c]));
    }
  }

  /** Sélection depuis une autre vue, la liste ou le parcours. */
  selectionne(ids, { cadrer = true } = {}) {
    etat.change({ iso: ids, sel: ids.length ? ids[ids.length - 1] : null });
    if (cadrer && ids.length && this.largeur) this.anime(this.cadrePour(ids));
  }

  // ------------------------------------------------------------------ Panneau
  majPanneau() {
    const sel = etat.get("sel");
    this.panneau.scrollTop = 0;
    if (sel !== null && sel >= 0 && this.d.fiche(sel)) {
      const f = this.d.fiche(sel);
      this.panneau.replaceChildren(construitFiche(this.d, f, {
        retour: () => etat.change({ sel: null, iso: [] }),
        planche: (id) => this.nav("planches", { planche: id }),
        temps: (id) => this.nav("temps", { focus: id }),
        selectionne: (id) => this.selectionne([id]),
        image: (entrees, k) => ouvreVisionneuse(entrees, k),
      }));
      return;
    }
    this.panneau.innerHTML = `
      <div class="panneau__entete">
        <h3>Les 64 clusters</h3>
        <input type="search" class="champ" id="filtre-liste" placeholder="Filtrer par nom ou contenu…" style="width:100%" aria-label="Filtrer la liste des clusters">
        <p class="petit discret" style="margin:6px 0 0">Triés par nombre d'images. Barre : part de chaque famille d'acteurs.</p>
      </div>
      <ul class="liste-clusters" id="liste-carte"></ul>`;
    const remplit = (filtre) => {
      const q = plie(filtre.trim());
      const lignes = [...this.d.clusters].sort((a, b) => b.n - a.n)
        .filter((f) => !q || plie(`${f.label} ${f.voit} ${f.id}`).includes(q));
      const ul = this.panneau.querySelector("#liste-carte");
      ul.innerHTML = lignes.length ? lignes.map((f) => `
        <li><button type="button" data-cluster="${f.id}">
          <span class="id">${f.id}</span><span>${html(f.label)}</span><span class="nb">${entier(f.n)}</span>
          ${barreComposition(f.parts)}
        </button></li>`).join("")
        : `<li class="vide" style="padding:16px"><strong>Aucun cluster</strong>ne contient « ${html(filtre)} » dans son nom ou sa description.</li>`;
    };
    remplit("");
    const champ = this.panneau.querySelector("#filtre-liste");
    champ.addEventListener("input", () => remplit(champ.value));
    const ul = this.panneau.querySelector("#liste-carte");
    ul.addEventListener("click", (e) => {
      const b = e.target.closest("[data-cluster]");
      if (b) this.selectionne([Number(b.dataset.cluster)]);
    });
    ul.addEventListener("pointerover", (e) => {
      const b = e.target.closest("[data-cluster]");
      const c = b ? Number(b.dataset.cluster) : null;
      if (c !== this.survolCluster) { this.survolCluster = c; this.majCouleurs(); this.demandeRendu(); }
    });
    ul.addEventListener("pointerleave", () => { this.survolCluster = null; this.majCouleurs(); this.demandeRendu(); });
  }

  // ------------------------------------------------------------------ Légende
  majLegende() {
    const v = etat.valeurs;
    const leg = this.el.querySelector("#legende-carte");
    const certitude = `<div class="legende__ligne"><svg width="60" height="10" aria-hidden="true">${[0.28, 0.5, 0.7, 0.9].map((a, i) =>
      `<circle cx="${6 + i * 15}" cy="5" r="4" fill="#1b1a17" fill-opacity="${a}"/>`).join("")}</svg><span>Opacité : certitude HDBSCAN, de 0 à 1</span></div>`;
    const bruit = v.bruit ? `<div class="legende__ligne"><span class="pastille" style="--c:${BRUIT}"></span><span>Non classées (bruit), ${entier(this.d.bruit.n)} images</span></div>` : "";
    let corps = "";
    if (v.couleur === "cluster") {
      corps = `<div class="legende__titre">Une couleur par cluster</div>
        <p style="margin:0 0 4px">Huit teintes attribuées pour que deux clusters voisins ne se ressemblent jamais. Le nom porte l'identité, pas la couleur.</p>`;
    } else if (v.couleur === "famille") {
      const dominantes = FAMILLES.map((f, i) => [f, this.d.clusters.filter((c) => c.dominante === i).length]);
      corps = `<div class="legende__titre">Famille majoritaire du cluster</div>
        ${dominantes.map(([f, n]) => `<div class="legende__ligne"><span class="pastille" style="--c:${COULEUR_FAMILLE[f]}${n ? "" : ";opacity:.35"}"></span><span>${f}</span><span class="discret">${n ? accord(n, "cluster") : "ne domine aucun cluster"}</span></div>`).join("")}
        <p>Intensité : part de cette famille, de 35 % (pâle, sujet partagé) à 100 % (canal). La famille n'est connue qu'au niveau du cluster, pas de l'image.</p>`;
    } else if (v.couleur === "vectors") {
      const stops = [1, 1.5, 2, 3, 4, 6.2].map((r) => d3.color(rampeVectors(r)).formatHex());
      corps = `<div class="legende__titre">Part des Vectors, rapportée à leur poids moyen (13,2 %)</div>
        <svg class="legende__rampe" viewBox="0 0 150 8" preserveAspectRatio="none"><defs><linearGradient id="gv">${stops.map((c, i) => `<stop offset="${i / (stops.length - 1)}" stop-color="${c}"/>`).join("")}</linearGradient></defs><rect width="150" height="8" fill="url(#gv)"/></svg>
        <div class="legende__echelle"><span>×1</span><span>×2</span><span>×4</span><span>×6</span></div>
        <div class="legende__ligne"><span class="pastille" style="--c:#d9d3c8"></span><span>sous ×1 : moins de Vectors que la moyenne</span></div>`;
    } else if (v.couleur === "resonance") {
      const valeurs = [0, 2, 5, 10, 25, MAX_RESONANCE];
      corps = `<div class="legende__titre">Engagements médians par post du cluster</div>
        <svg class="legende__rampe" viewBox="0 0 150 8" preserveAspectRatio="none"><defs><linearGradient id="gr">${valeurs.map((m, i) => `<stop offset="${i / (valeurs.length - 1)}" stop-color="${couleurResonance(m)}"/>`).join("")}</linearGradient></defs><rect width="150" height="8" fill="url(#gr)"/></svg>
        <div class="legende__echelle"><span>0</span><span>5</span><span>25</span><span>60+</span></div>
        <p>Médiane par post, pas par image : un post de 4 images ne compte qu'une fois. Échelle log(1 + x).</p>`;
    }
    leg.innerHTML = corps + certitude + bruit;
  }

  majEvenement() {
    const t = etat.get("t");
    const zone = this.el.querySelector("#evenement-carte");
    if (t === null) { zone.hidden = true; return; }
    const jour = Math.floor(t / 1440);
    const evts = this.d.evenements.filter((e) => e.jour === jour);
    if (!evts.length) { zone.hidden = true; return; }
    zone.hidden = false;
    zone.innerHTML = evts.map((e) => `
      <span class="date">${jourCourt(e.jour)} · ${e.clusters.map((c) => html(this.d.fiche(c).label)).join(", ")}</span>
      <strong>${html(e.titre)}</strong>
      <a class="petit" href="${html(e.sources[0].url)}" target="_blank" rel="noopener">${html(e.sources[0].editeur)} ↗</a>`).join('<hr style="border:0;border-top:1px solid var(--filet);margin:6px 0">');
  }

  // ------------------------------------------------------------------ Export, plein écran
  pleinEcran() {
    if (document.fullscreenElement) document.exitFullscreen();
    else this.el.requestFullscreen?.().catch(() => notifie("Plein écran refusé par le navigateur."));
  }

  /** Image composite : points + vignettes + noms + bandeau de titre et de source. */
  compose({ largeurMax = 2400, titre = null, sousTitre = null, reutilise = false } = {}) {
    this.rend();
    const w = this.canvasGl.width, h = this.canvasGl.height;
    const echelle = Math.min(1, largeurMax / w);
    const haut = Math.round(64 * this.dpr * echelle), bas = Math.round(34 * this.dpr * echelle);
    const largeur = Math.round(w * echelle), hauteur = Math.round(h * echelle) + haut + bas;
    // Pendant l'enregistrement vidéo, on redessine dans la même toile à chaque image.
    let out = reutilise ? this.toileCompose : null;
    if (!out || out.width !== largeur || out.height !== hauteur) {
      out = document.createElement("canvas");
      out.width = largeur;
      out.height = hauteur;
      if (reutilise) this.toileCompose = out;
    }
    const c = out.getContext("2d");
    c.fillStyle = "#f5f3ee";
    c.fillRect(0, 0, out.width, out.height);
    if (this.rendu) c.drawImage(this.canvasGl, 0, haut, out.width, out.height - haut - bas);
    c.drawImage(this.canvas2d, 0, haut, out.width, out.height - haut - bas);
    const u = this.dpr * echelle;
    c.fillStyle = "#1b1a17";
    c.font = `500 ${22 * u}px Newsreader, Georgia, serif`;
    c.textBaseline = "alphabetic";
    c.fillText(titre ?? (TITRES[etat.get("couleur")] || ""), 18 * u, 30 * u);
    c.font = `400 ${12 * u}px "Public Sans", sans-serif`;
    c.fillStyle = "#4a463e";
    c.fillText(sousTitre ?? this.sousTitreExport(), 18 * u, 50 * u);
    c.fillStyle = "#6f695d";
    c.font = `400 ${10.5 * u}px "Public Sans", sans-serif`;
    c.fillText("SPINE France · analyse 691 · opsci.ai — CLIP ViT-H-14, UMAP (n_neighbors 15, min_dist 0), HDBSCAN (min_samples 6). Images publiées sur X du 1er au 29 septembre 2026.", 18 * u, out.height - 13 * u);
    c.strokeStyle = "#1b1a17";
    c.lineWidth = 1 * u;
    c.beginPath(); c.moveTo(0, haut - 0.5); c.lineTo(out.width, haut - 0.5); c.stroke();
    return out;
  }

  sousTitreExport() {
    const v = etat.valeurs;
    const morceaux = [`${entier(this.compteVisibles())} images affichées sur ${entier(this.d.n)}`];
    morceaux.push(MODES.find(([m]) => m === v.couleur)[1].toLowerCase());
    if (v.t !== null) morceaux.push(`situation au ${minuteLongue(v.t)}`);
    if (v.iso.length) morceaux.push(`isolés : ${v.iso.map((c) => this.d.fiche(c).label).join(", ")}`);
    return morceaux.join(" · ");
  }

  /** Image d'une vidéo : la carte composite, plus la date en grand et l'événement du jour. */
  composeVideo() {
    const out = this.compose({
      largeurMax: 1920,
      reutilise: true,
      titre: "Septembre 2026 en 65 229 images : la carte se remplit jour après jour",
      sousTitre: "Chaque point est une image publiée sur X ; les jours passés restent, en plus pâle. Projection UMAP des embeddings CLIP.",
    });
    const t = etat.get("t");
    if (t === null) return out;
    const c = out.getContext("2d");
    const u = out.width / this.largeur;
    const jour = Math.floor(t / 1440);
    c.textAlign = "right";
    c.fillStyle = "#1b1a17";
    c.font = `500 ${26 * u}px Newsreader, Georgia, serif`;
    c.fillText(jourMoyen(jour), out.width - 18 * u, 32 * u);
    c.font = `600 ${11 * u}px "Public Sans", sans-serif`;
    c.fillStyle = "#6f695d";
    c.fillText(`${heure(t)} · ${entier(this.sequence.imagesPubliees(t))} images publiées`, out.width - 18 * u, 50 * u);
    const evts = this.d.evenements.filter((e) => e.jour === jour);
    if (evts.length) {
      const haut = Math.round(64 * this.dpr * Math.min(1, 1920 / this.canvasGl.width));
      c.textAlign = "left";
      let y = haut + 22 * u;
      for (const e of evts.slice(0, 2)) {
        c.fillStyle = "rgba(245,243,238,0.94)";
        c.fillRect(14 * u, y - 16 * u, 430 * u, 40 * u);
        c.fillStyle = "#1b1a17";
        c.fillRect(14 * u, y - 16 * u, 3 * u, 40 * u);
        c.font = `500 ${15 * u}px Newsreader, Georgia, serif`;
        c.fillText(e.titre, 24 * u, y + 1 * u);
        c.font = `400 ${10 * u}px "Public Sans", sans-serif`;
        c.fillStyle = "#6f695d";
        c.fillText(`Source : ${e.sources[0].editeur}`, 24 * u, y + 17 * u);
        y += 46 * u;
      }
    }
    c.textAlign = "left";
    return out;
  }

  exportePng() {
    const out = this.compose();
    out.toBlob((b) => telecharge(b, `spine-691-carte-${etat.get("couleur")}.png`), "image/png");
  }

  // ------------------------------------------------------------------ Cycle de vie
  active() {
    this.redimensionne();
    this.demandeRendu();
    this.d.chargePosts();
  }

  desactive() {
    this.sequence.pause();
    infobulle.cache({ force: true });
  }

  /** Raccourcis transmis par main.js quand la carte est la vue active. */
  clavier(e) {
    const v = etat.valeurs;
    switch (e.key) {
      case "+": case "=": this.zoomPar(1.5); return true;
      case "-": case "_": this.zoomPar(1 / 1.5); return true;
      case "0": this.recadre(); return true;
      case "b": case "B": etat.change({ bruit: !v.bruit }); return true;
      case "n": case "N": etat.change({ noms: !v.noms }); return true;
      case "c": case "C": {
        const i = MODES.findIndex(([m]) => m === v.couleur);
        etat.change({ couleur: MODES[(i + 1) % MODES.length][0] });
        return true;
      }
      case "f": case "F": this.pleinEcran(); return true;
      case "Escape":
        if (v.iso.length || v.sel !== null) { etat.change({ iso: [], sel: null }); return true; }
        return false;
      default:
        return this.sequence.clavier(e);
    }
  }
}

