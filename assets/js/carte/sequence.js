// La séquence : la carte se remplit jour après jour, du 1er au 29 septembre.
//
// Lecture, pause, trois vitesses, curseur à l'heure près, traînée des jours
// passés, marqueurs d'événements sourcés sur la frise, export vidéo.
//
// Piège de lecture connu (Robertson et al., 2008) : une animation se regarde
// bien mais se compare mal. La frise montre donc aussi le volume de chaque jour
// en barres, et le curseur permet de s'arrêter sur une date pour comparer.

import { etat } from "../etat.js";
import { entier, jourMoyen, jourCourt, heure, html, estWeekend } from "../format.js";
import * as infobulle from "../ui/infobulle.js";
import { notifie, telecharge } from "../ui/notifier.js";

const FIN = 29 * 1440;
const SECONDES_PAR_JOUR = { 1: 4, 2: 2, 3: 1 };
const ICONE_LECTURE = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5v11l9.5-5.5z" fill="currentColor"/></svg>';
const ICONE_PAUSE = '<svg viewBox="0 0 14 14" aria-hidden="true"><rect x="2.5" y="1.5" width="3.2" height="11" fill="currentColor"/><rect x="8.3" y="1.5" width="3.2" height="11" fill="currentColor"/></svg>';

export class Sequence {
  constructor(conteneur, donnees, { surRendu }) {
    this.el = conteneur;
    this.d = donnees;
    this.surRendu = surRendu;
    this.lecture = false;
    this.compose = null;   // fourni par la carte : dessine une image composite
    this.rendSync = null;  // fourni par la carte : rendu immédiat
    this.el.innerHTML = `
      <div class="frise__commandes">
        <button type="button" class="frise__lecture" aria-label="Lire la séquence (Espace)" title="Lire la séquence (Espace)">${ICONE_LECTURE}</button>
        <div class="frise__date" aria-live="off"><small></small><span></span></div>
      </div>
      <svg class="frise__axe" role="slider" tabindex="0" aria-label="Date de la séquence" aria-valuemin="0" aria-valuemax="${FIN}"></svg>
      <div class="frise__options">
        <div class="segments" role="group" aria-label="Vitesse">
          <button type="button" data-v="1" title="1 jour toutes les 4 secondes">Lent</button>
          <button type="button" data-v="2" title="1 jour toutes les 2 secondes">Normal</button>
          <button type="button" data-v="3" title="1 jour par seconde">Rapide</button>
        </div>
        <div style="display:flex;gap:10px;align-items:center">
          <label class="interrupteur" title="Les images des jours précédents restent, en plus pâle"><input type="checkbox" data-trainee> Traînée</label>
          <button type="button" class="bouton bouton--discret" data-tout title="Revenir à tout le mois (Fin)">Tout le mois</button>
          <button type="button" class="bouton bouton--discret" data-video title="Enregistrer la séquence complète en vidéo">Vidéo</button>
        </div>
      </div>`;
    this.svg = d3.select(this.el.querySelector(".frise__axe"));
    this.boutonLecture = this.el.querySelector(".frise__lecture");
    this.branche();
    etat.ecoute(["t", "vitesse", "trainee", "iso"], () => this.maj());
  }

  branche() {
    this.boutonLecture.addEventListener("click", () => (this.lecture ? this.pause() : this.lit()));
    this.el.querySelector(".segments").addEventListener("click", (e) => {
      const b = e.target.closest("[data-v]");
      if (b) etat.change({ vitesse: Number(b.dataset.v) });
    });
    this.el.querySelector("[data-trainee]").addEventListener("change", (e) => etat.change({ trainee: e.target.checked }));
    this.el.querySelector("[data-tout]").addEventListener("click", () => { this.pause(); etat.change({ t: null }); });
    this.el.querySelector("[data-video]").addEventListener("click", () => this.enregistre());

    const noeud = this.svg.node();
    let glisse = false;
    const versT = (e) => {
      const r = noeud.getBoundingClientRect();
      const x = Math.min(Math.max(e.clientX - r.left, 0), r.width);
      return Math.min(FIN - 1, Math.round(this.x.invert(x) / 30) * 30);
    };
    noeud.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".marque-evenement")) return;
      glisse = true;
      noeud.setPointerCapture(e.pointerId);
      this.pause();
      etat.change({ t: versT(e) });
    });
    noeud.addEventListener("pointermove", (e) => { if (glisse) etat.change({ t: versT(e) }); });
    noeud.addEventListener("pointerup", () => { glisse = false; });
    noeud.addEventListener("keydown", (e) => { if (this.clavier(e)) e.preventDefault(); });
  }

  redimensionne() {
    const largeur = this.el.querySelector(".frise__axe").getBoundingClientRect().width;
    if (!largeur) return;
    this.largeur = largeur;
    this.x = d3.scaleLinear().domain([0, FIN]).range([0, largeur]);
    this.dessineAxe();
    this.maj();
  }

  dessineAxe() {
    const svg = this.svg;
    svg.selectAll("*").remove();
    const h = 64, bas = 46, hautBarres = 30;
    const jours = this.d.jours;
    const classes = jours.map((j) => j.images - j.bruit);
    const max = d3.max(classes);
    const y = d3.scaleLinear().domain([0, max]).range([0, hautBarres]);
    const largeurJour = this.x(1440) - this.x(0);

    const fond = svg.append("g");
    jours.forEach((j, i) => {
      if (estWeekend(i)) fond.append("rect").attr("x", this.x(i * 1440)).attr("y", bas - hautBarres - 4).attr("width", largeurJour).attr("height", hautBarres + 4).attr("fill", "#ece8df");
    });
    svg.append("g").attr("class", "barres-corpus").selectAll("rect").data(classes).join("rect")
      .attr("x", (_, i) => this.x(i * 1440) + 1)
      .attr("y", (v) => bas - y(v))
      .attr("width", Math.max(1, largeurJour - 2))
      .attr("height", (v) => y(v))
      .attr("fill", "#cdc7bb");
    this.yBarres = y;
    this.basBarres = bas;
    svg.append("g").attr("class", "barres-selection");
    svg.append("line").attr("x1", 0).attr("x2", this.largeur).attr("y1", bas + 0.5).attr("y2", bas + 0.5).attr("stroke", "#a9a191");

    const etiquettes = svg.append("g");
    jours.forEach((j, i) => {
      const lundi = new Date(Date.UTC(2026, 8, 1 + i)).getUTCDay() === 1;
      if (i === 0 || lundi || i === 28) {
        etiquettes.append("text").attr("x", this.x(i * 1440 + 720)).attr("y", h - 4).attr("text-anchor", "middle")
          .attr("font-size", 10.5).attr("fill", i === 0 || i === 28 ? "#1b1a17" : "#6f695d").attr("font-family", "Public Sans, sans-serif")
          .text(i === 0 ? "1er sept." : String(i + 1));
      }
    });

    // Marqueurs d'événements : un triangle par jour, survol = titres et sources.
    const parJour = d3.group(this.d.evenements, (e) => e.jour);
    const marques = svg.append("g");
    for (const [jour, evts] of parJour) {
      const cx = this.x(jour * 1440 + 720);
      const g = marques.append("g").attr("class", "marque-evenement").style("cursor", "pointer")
        .attr("tabindex", 0).attr("role", "button")
        .attr("aria-label", `${jourCourt(jour)} : ${evts.map((e) => e.titre).join(" ; ")}`);
      g.append("rect").attr("x", cx - 9).attr("y", 0).attr("width", 18).attr("height", 14).attr("fill", "transparent");
      g.append("path").attr("d", `M${cx - 5},1 L${cx + 5},1 L${cx},9 Z`).attr("fill", "#1b1a17");
      if (evts.length > 1) g.append("text").attr("x", cx + 7).attr("y", 8).attr("font-size", 9).attr("font-weight", 700).attr("fill", "#1b1a17").text(evts.length);
      const contenu = () => `<div class="kicker" style="margin:0 0 4px">${jourCourt(jour)} · événements sourcés</div>${evts.map((e) => `<div style="margin-bottom:6px"><strong>${html(e.titre)}</strong><br><span class="discret petit">${html(e.sources[0].editeur)}</span></div>`).join("")}<div class="discret petit">Clic : aller à cette date</div>`;
      g.on("pointerenter", (ev) => infobulle.montre(contenu(), ev.clientX, ev.clientY))
        .on("pointermove", (ev) => infobulle.place(ev.clientX, ev.clientY))
        .on("pointerleave", () => infobulle.cache({ force: true }))
        .on("click", () => { this.pause(); etat.change({ t: jour * 1440 + 20 * 60 }); })
        .on("keydown", (ev) => { if (ev.key === "Enter") { this.pause(); etat.change({ t: jour * 1440 + 20 * 60 }); } });
    }

    this.curseur = svg.append("g").attr("class", "curseur").style("pointer-events", "none");
    this.curseur.append("line").attr("y1", 10).attr("y2", bas + 4).attr("stroke", "#1b1a17").attr("stroke-width", 1.5);
    this.curseur.append("circle").attr("cy", bas + 4).attr("r", 4.5).attr("fill", "#1b1a17");
  }

  maj() {
    const v = etat.valeurs;
    this.el.querySelectorAll("[data-v]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.v) === v.vitesse)));
    this.el.querySelector("[data-trainee]").checked = v.trainee;
    this.boutonLecture.innerHTML = this.lecture ? ICONE_PAUSE : ICONE_LECTURE;
    this.boutonLecture.setAttribute("aria-label", this.lecture ? "Pause (Espace)" : "Lire la séquence (Espace)");
    const date = this.el.querySelector(".frise__date");
    if (v.t === null) {
      date.querySelector("small").textContent = "Tout le mois";
      date.querySelector("span").textContent = "1er – 29 sept.";
    } else {
      const jour = Math.floor(v.t / 1440);
      date.querySelector("small").textContent = `${heure(v.t)} · ${entier(this.imagesPubliees(v.t))} images publiées`;
      date.querySelector("span").textContent = jourMoyen(jour);
    }
    if (!this.x) return;
    this.svg.attr("aria-valuenow", v.t ?? FIN).attr("aria-valuetext", v.t === null ? "Tout le mois" : jourMoyen(Math.floor(v.t / 1440)));
    const xt = this.x(v.t ?? FIN);
    this.curseur.attr("transform", `translate(${xt},0)`).style("opacity", v.t === null ? 0.25 : 1);

    // Si des clusters sont isolés, leurs volumes quotidiens passent en encre.
    const ids = v.iso;
    const serie = ids.length ? this.d.serie(ids) : [];
    const max = Math.max(1, ...serie);
    const echelle = ids.length ? d3.scaleLinear().domain([0, max]).range([0, 30]) : null;
    const largeurJour = this.x(1440) - this.x(0);
    this.svg.select(".barres-selection").selectAll("rect").data(serie).join("rect")
      .attr("x", (_, i) => this.x(i * 1440) + 1 + largeurJour * 0.22)
      .attr("y", (s) => this.basBarres - echelle(s))
      .attr("width", Math.max(1, largeurJour * 0.56 - 2))
      .attr("height", (s) => echelle(s))
      .attr("fill", "#1b1a17");
    this.svg.select(".barres-corpus").attr("opacity", ids.length ? 0.45 : 1);
  }

  imagesPubliees(t) {
    // Approximation sans parcourir les points : jours pleins + prorata du jour courant.
    const jour = Math.floor(t / 1440);
    let n = 0;
    for (let j = 0; j < jour; j++) n += this.d.jours[j].images - (etat.get("bruit") ? 0 : this.d.jours[j].bruit);
    const courant = this.d.jours[jour] ? this.d.jours[jour].images - (etat.get("bruit") ? 0 : this.d.jours[jour].bruit) : 0;
    return n + Math.round(courant * ((t - jour * 1440) / 1440));
  }

  lit() {
    if (this.lecture) return;
    let t = etat.get("t");
    if (t === null || t >= FIN - 1) t = 0;
    this.lecture = true;
    etat.change({ t });
    this.maj();
    let avant = performance.now();
    const pas = (maintenant) => {
      if (!this.lecture) return;
      const dt = Math.min(100, maintenant - avant);
      avant = maintenant;
      const vitesse = 1440 / (SECONDES_PAR_JOUR[etat.get("vitesse")] * 1000);
      const suivant = etat.get("t") + dt * vitesse;
      if (suivant >= FIN - 1) {
        etat.change({ t: FIN - 1 });
        this.pause();
        return;
      }
      etat.change({ t: Math.round(suivant) });
      this.boucle = requestAnimationFrame(pas);
    };
    this.boucle = requestAnimationFrame(pas);
  }

  pause() {
    if (!this.lecture) return;
    this.lecture = false;
    cancelAnimationFrame(this.boucle);
    this.maj();
  }

  clavier(e) {
    const t = etat.get("t");
    const pasJour = e.shiftKey ? 60 : 1440;
    switch (e.key) {
      case " ":
        if (this.lecture) this.pause(); else this.lit();
        return true;
      case "ArrowRight":
        this.pause();
        etat.change({ t: Math.min(FIN - 1, (t ?? -pasJour) + pasJour) });
        return true;
      case "ArrowLeft":
        this.pause();
        etat.change({ t: Math.max(0, (t ?? FIN) - pasJour) });
        return true;
      case "Home":
        this.pause();
        etat.change({ t: 0 });
        return true;
      case "End":
        this.pause();
        etat.change({ t: null });
        return true;
      default:
        return false;
    }
  }

  // ------------------------------------------------------------------ Export vidéo
  async enregistre() {
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream || !this.compose) {
      notifie("Ce navigateur ne sait pas enregistrer de vidéo (MediaRecorder absent).");
      return;
    }
    const types = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    const type = types.find((t) => MediaRecorder.isTypeSupported(t));
    if (!type) { notifie("Aucun format vidéo disponible dans ce navigateur."); return; }
    const extension = type.startsWith("video/mp4") ? "mp4" : "webm";

    this.pause();
    const avant = { t: etat.get("t") };
    const secondesParJour = SECONDES_PAR_JOUR[etat.get("vitesse")];
    const premiere = this.compose({ t: 0 });
    const sortie = document.createElement("canvas");
    sortie.width = premiere.width - (premiere.width % 2);
    sortie.height = premiere.height - (premiere.height % 2);
    const ctx = sortie.getContext("2d");
    const flux = sortie.captureStream(30);
    const morceaux = [];
    const enreg = new MediaRecorder(flux, { mimeType: type, videoBitsPerSecond: 10_000_000 });
    enreg.ondataavailable = (e) => { if (e.data.size) morceaux.push(e.data); };
    const termine = new Promise((ok) => { enreg.onstop = ok; });

    const bouton = this.el.querySelector("[data-video]");
    bouton.disabled = true;
    this.boutonLecture.disabled = true;
    let annule = false;
    const annulation = document.createElement("button");
    annulation.type = "button";
    annulation.className = "bouton";
    annulation.textContent = "Annuler l'enregistrement";
    annulation.addEventListener("click", () => { annule = true; });
    bouton.after(annulation);

    enreg.start(500);
    const debut = performance.now();
    const duree = 29 * secondesParJour * 1000;
    await new Promise((fini) => {
      const image = (maintenant) => {
        const ecoule = maintenant - debut;
        const t = Math.min(FIN - 1, Math.round((ecoule / duree) * FIN));
        etat.change({ t });
        const c = this.compose({ t });
        ctx.drawImage(c, 0, 0, sortie.width, sortie.height);
        bouton.textContent = `Enregistrement ${Math.min(29, Math.floor(t / 1440) + 1)}/29`;
        if (annule || ecoule >= duree + 1500) { fini(); return; } // 1,5 s sur la dernière image
        requestAnimationFrame(image);
      };
      requestAnimationFrame(image);
    });
    enreg.stop();
    await termine;
    annulation.remove();
    bouton.disabled = false;
    bouton.textContent = "Vidéo";
    this.boutonLecture.disabled = false;
    etat.change({ t: avant.t });
    if (annule) { notifie("Enregistrement annulé."); return; }
    telecharge(new Blob(morceaux, { type }), `spine-691-septembre-2026.${extension}`);
    notifie(`Vidéo enregistrée (${extension.toUpperCase()}, ${29 * secondesParJour} s).`);
  }
}
