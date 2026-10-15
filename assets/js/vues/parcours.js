// Parcours guidé : quatre écrans qui racontent une histoire tirée des données,
// pour l'analyste qui ouvre l'outil sans savoir quoi chercher. Chaque étape
// règle l'outil réel (vue, couleurs, sélection, date) : on apprend l'outil en
// lisant l'histoire, et l'on peut reprendre la main à tout moment.

import { etat } from "../etat.js";
import { entier, mediane, enLettres } from "../format.js";

export class Parcours {
  constructor(donnees, navigue, carte) {
    this.d = donnees;
    this.nav = navigue;
    this.carte = carte;
    const t = donnees.meta.totaux;
    const vide = donnees.clusters.filter((f) => f.n >= d3.median(donnees.clusters, (c) => c.n) && f.eng.mediane < t.mediane_engagement_post);
    const imagesVide = vide.reduce((s, f) => s + f.n, 0);
    const stats = donnees.fiche(17), pol = donnees.fiche(40);
    this.etapes = [
      {
        titre: "65 229 images rangées par ressemblance, en deux continents",
        texte: `Chaque point est une image publiée sur X en septembre 2026 ; plus il est opaque, plus HDBSCAN est sûr de son cluster.
          À gauche, des photographies ; à droite, des images faites de texte : vignettes titrées, captures d'écran, cartons d'annonce.
          Un quart du corpus (${entier(t.bruit)} images) n'entre dans aucun cluster : il est masqué par défaut, et expliqué dans « Ce que la méthode rate ».`,
        applique: () => {
          this.nav("carte", { couleur: "cluster", iso: [], sel: null, t: null, noms: true, bruit: false, certitude: 0, cadrage: null });
          setTimeout(() => this.carte()?.recadre(), 60);
        },
      },
      {
        titre: "Recolorée par famille d'acteurs, la carte sépare les canaux des sujets partagés",
        texte: `Bleu franc : les flux des médias, souvent à plus de 95 % Media. Ocre : la communication des élus et des institutions, surtout parmi les photographies.
          Vermillon : les rares clusters tenus par les Vectors, des images de seconde main (captures, graphiques, caricatures).
          Plus un cluster est pâle, plus il est partagé entre familles.`,
        applique: () => this.nav("carte", { couleur: "famille", iso: [], sel: null, t: null, cadrage: null }),
      },
      {
        titre: "Le 26 septembre, le pape à Paris : un événement, trois clusters, deux continents",
        texte: `Le 25, Léon XIV arrive à Paris ; le 26, il célèbre la messe place de la Concorde (site du voyage, Conférence des évêques de France).
          HDBSCAN range les vignettes titrées (Visite de Léon XIV) parmi les images faites de texte, les portraits et les scènes (Pape Catholique, Visite Papale)
          parmi les photographies. Appuyez sur lecture : les points apparaissent jour après jour, ceux des jours passés restent en plus pâle.`,
        applique: () => {
          this.nav("carte", { couleur: "cluster", iso: [4, 13, 14], sel: 14, t: 25 * 1440 + 20 * 60, trainee: true });
          setTimeout(() => this.carte()?.selectionne([4, 13, 14]), 60);
        },
      },
      {
        titre: "Beaucoup produit, rien repris",
        texte: `${enLettres(vide.length).charAt(0).toUpperCase() + enLettres(vide.length).slice(1)} clusters cumulent ${entier(imagesVide)} images pour une médiane d'engagement sous celle du corpus :
          tous sont des gabarits d'éditeurs (vignettes de presse régionale, Gala, Imaz Press, Marie France). À l'opposé, des clusters à dominante Vectors,
          bien plus petits, sont parmi les plus repris : ${stats.label} (médiane ${mediane(stats.eng.mediane)}), ${pol.label} (${mediane(pol.eng.mediane)}).`,
        applique: () => this.nav("resonance"),
      },
    ];
    this.el = document.createElement("aside");
    this.el.className = "parcours";
    this.el.setAttribute("aria-live", "polite");
    this.el.setAttribute("aria-label", "Parcours guidé");
    this.el.hidden = true;
    document.body.append(this.el);
  }

  ouvre(i = 0) {
    this.i = Math.max(0, Math.min(this.etapes.length - 1, i));
    const e = this.etapes[this.i];
    e.applique();
    etat.change({ parcours: this.i });
    const dernier = this.i === this.etapes.length - 1;
    this.el.innerHTML = `
      <div class="parcours__etape"><span>Parcours guidé · ${this.i + 1} sur ${this.etapes.length}</span>
        <button type="button" class="lien-bouton" data-fermer aria-label="Fermer le parcours">Fermer ✕</button></div>
      <h3>${e.titre}</h3>
      <p>${e.texte}</p>
      <div class="parcours__nav">
        <button type="button" class="bouton bouton--discret" data-prec ${this.i === 0 ? "disabled" : ""}>Précédent</button>
        <span class="parcours__points">${this.etapes.map((_, k) => `<span class="${k <= this.i ? "fait" : ""}"></span>`).join("")}</span>
        <button type="button" class="bouton bouton--plein" data-suiv>${dernier ? "Terminer" : "Suivant"}</button>
      </div>`;
    this.el.hidden = false;
    this.el.querySelector("[data-fermer]").addEventListener("click", () => this.ferme());
    this.el.querySelector("[data-prec]").addEventListener("click", () => this.ouvre(this.i - 1));
    this.el.querySelector("[data-suiv]").addEventListener("click", () => (dernier ? this.ferme() : this.ouvre(this.i + 1)));
    this.el.querySelector("[data-suiv]").focus({ preventScroll: true });
  }

  ferme() {
    this.el.hidden = true;
    etat.change({ parcours: null });
  }

  get ouvert() {
    return !this.el.hidden;
  }
}
