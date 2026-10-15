// Parcours guidé : dix écrans qui racontent une histoire tirée des données,
// pour l'analyste qui ouvre l'outil sans savoir quoi chercher. Chaque étape
// règle l'outil réel (vue, couleurs, sélection, date) : on apprend l'outil en
// lisant l'histoire, et l'on peut reprendre la main à tout moment.
// Les chiffres cités sont calculés à l'ouverture, jamais recopiés à la main.

import { etat } from "../etat.js";
import { entier, pct, ratio, mediane, jourCourt, enLettres } from "../format.js";

const majuscule = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export class Parcours {
  constructor(donnees, navigue, carte) {
    this.d = donnees;
    this.nav = navigue;
    this.carte = carte;
    const C = donnees.clusters;
    const t = donnees.meta.totaux;
    const [photos, texte] = donnees.meta.continents;
    const vectors = donnees.familles[2];
    const repertoire = [...C].sort((a, b) => b.ratios[2] - a.ratios[2]).slice(0, 4);
    const evenementiels = C.filter((f) => f.regime === "evenementiel").length;
    const semaine = C.filter((f) => f.regime === "semaine").length;
    const papale = donnees.fiche(14);
    const vide = C.filter((f) => f.n >= d3.median(C, (c) => c.n) && f.eng.mediane < t.mediane_engagement_post);
    const imagesVide = vide.reduce((s, f) => s + f.n, 0);
    const stats = donnees.fiche(17), pol = donnees.fiche(40);
    const gabarits = C.filter((f) => f.logique === "gabarit");
    const faitsDivers = donnees.fiche(58);
    const tirage = donnees.meta.echantillon.tirage;
    const nbEvenements = donnees.evenements.length;

    this.etapes = [
      {
        titre: `${entier(t.images)} images rangées par ressemblance, en deux continents`,
        texte: `Chaque point est une image publiée sur X en septembre 2026, posée près de celles qui lui ressemblent ;
          plus il est opaque, plus HDBSCAN est sûr de son cluster. À gauche, des photographies ; à droite, des images faites de texte :
          vignettes titrées, captures d'écran, cartons. Survolez un point : date, engagements, lien vers le post, et l'image quand elle fait partie
          des 10 % présents dans le dépôt. Cliquez-le pour isoler son cluster.`,
        applique: () => {
          this.nav("carte", { couleur: "cluster", iso: [], sel: null, t: null, noms: true, bruit: false, certitude: 0, cadrage: null });
          setTimeout(() => this.carte()?.recadre(), 60);
        },
      },
      {
        titre: "Recolorée par famille d'acteurs, la carte sépare les canaux des sujets partagés",
        texte: `Bleu franc : les flux des médias, souvent à plus de 95 % Media. Ocre : les élus et les institutions, qui publient
          ${pct(photos.familles[1], 0)} des photographies mais ${pct(texte.familles[1], 0)} des images faites de texte.
          Plus un cluster est pâle, plus il est partagé entre familles. Chaque bouton de couleur, en haut de la carte, explique son codage au survol.`,
        applique: () => this.nav("carte", { couleur: "famille", iso: [], sel: null, t: null, cadrage: null }),
      },
      {
        titre: `Les Vectors font ${pct(vectors.part, 1)} des images, mais ${ratio(repertoire[0].ratios[2])} dans ${repertoire[0].label}`,
        texte: `En rouge foncé, les clusters où les Vectors pèsent bien plus que leur part du corpus :
          ${repertoire.map((f) => `${f.label} (${ratio(f.ratios[2])})`).join(", ")}. Pas de photo d'actualité dans ce répertoire :
          de la peinture ancienne, des captures d'écran, des couvertures de livres, des dessins de presse. Des images de seconde main, qu'on cite pour argumenter.`,
        applique: () => this.nav("carte", { couleur: "vectors", iso: [], sel: null, t: null, cadrage: null }),
      },
      {
        titre: "Le mois se rejoue heure par heure : bouton « Lire septembre », en bas à gauche",
        texte: `La frise compte les images de chaque jour, week-ends grisés ; ses triangles marquent les ${enLettres(nbEvenements)} événements datés et sourcés.
          Cliquez la frise pour aller à un jour, glissez pour parcourir, ou lancez la lecture : chaque image apparaît à l'heure de sa publication
          et les jours passés restent, en plus pâle. Ici, le 15 septembre à 18 h : la journée de mobilisation intersectorielle s'affiche en haut à gauche, avec sa source.`,
        applique: () => this.nav("carte", { couleur: "cluster", iso: [], sel: null, t: 14 * 1440 + 18 * 60, trainee: true, cadrage: null }),
      },
      {
        titre: "Le 26 septembre, le pape à Paris : un événement, trois clusters, deux continents",
        texte: `Le 25, Léon XIV arrive à Paris ; le 26, il célèbre la messe place de la Concorde (site du voyage, Conférence des évêques de France).
          HDBSCAN range les vignettes titrées (Visite de Léon XIV) parmi les images faites de texte, les portraits et les scènes
          (Pape Catholique, Visite Papale) parmi les photographies. Faites glisser la frise du 24 au 27 septembre : les trois clusters s'allument ensemble.`,
        applique: () => {
          this.nav("carte", { couleur: "cluster", iso: [4, 13, 14], sel: 14, t: 25 * 1440 + 20 * 60, trainee: true });
          setTimeout(() => this.carte()?.selectionne([4, 13, 14]), 60);
        },
      },
      {
        titre: `${majuscule(enLettres(evenementiels))} clusters vivent d'un événement, ${enLettres(semaine)} ne publient qu'en semaine`,
        texte: `La vue Temps aligne les 64 courbes, chacune à sa propre échelle, triées par régime : on y compare des rythmes, pas des volumes.
          Un trait vertical est un événement sourcé ; un pic sans trait est un pic qu'aucune source fiable ne date, et il n'est pas annoté.
          En bas de la page, ${papale.label} : ${pct(papale.pct_pic / 100, 1)} de ses images en un seul jour, le ${jourCourt(papale.pic)}.`,
        applique: () => this.nav("temps", { focus: 14 }),
      },
      {
        titre: "Chaque famille a ses territoires, et le tableau les chiffre",
        texte: `Dans la vue Familles, chaque case rapporte la part d'une famille dans un cluster à son poids dans tout le corpus : ×4, c'est quatre fois plus que d'habitude.
          Les Officials tiennent leurs cérémonies et leurs communiqués, les Influencers le sport. Une case hachurée a moins de cinq images attendues :
          le rapport y serait trop fragile, il n'est pas mis en couleur. Cliquez un en-tête pour trier.`,
        applique: () => this.nav("familles", { triMatrice: "Officials" }),
      },
      {
        titre: "Beaucoup produit, rien repris",
        texte: `${majuscule(enLettres(vide.length))} clusters cumulent ${entier(imagesVide)} images pour une médiane d'engagement sous celle du corpus :
          tous sont des gabarits d'éditeurs (vignettes de presse régionale, Gala, Imaz Press, Marie France). À l'opposé, des clusters à dominante Vectors,
          bien plus petits, sont parmi les plus repris : ${stats.label} (médiane ${mediane(stats.eng.mediane)}), ${pol.label} (${mediane(pol.eng.mediane)}).`,
        applique: () => this.nav("resonance"),
      },
      {
        titre: `${faitsDivers.label}, le plus gros cluster, est un format avant d'être un sujet`,
        texte: `Sa planche le montre : des vignettes de presse régionale à bandeau, construites sur le même modèle, quel que soit le fait divers.
          ${majuscule(enLettres(gabarits.length))} clusters sont ainsi la charte graphique d'un éditeur plutôt qu'un sujet, ${entier(gabarits.reduce((s, f) => s + f.n, 0))} images en tout.
          Réserve : les images du dépôt datent surtout du début du mois (${pct(tirage.part_4_premiers_jours, 0)} du 1er au 4 septembre) ; les planches ne montrent pas les pics.`,
        applique: () => this.nav("planches", { planche: 58, colonnes: 6, triPlanche: "certitude", avantApres: false }),
      },
      {
        titre: "Ce que la méthode rate, et comment partager ce que vous voyez",
        texte: `Un quart des images sans cluster (${entier(t.bruit)}), des labels qui trompent, un voyage du pape éclaté en trois clusters :
          la dernière vue chiffre ces limites au lieu de les taire. Pour montrer un écran à un collègue, « Copier le lien » (touche L) :
          l'adresse rouvre exactement la même vue, avec ses réglages. La touche ? liste tous les raccourcis.`,
        applique: () => this.nav("limites"),
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
