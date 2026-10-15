// Vue Temps : 64 courbes de 29 jours.
//
// Vue d'ensemble « empilée » au sens propre : les 64 crêtes l'une sous l'autre
// (ridgeline), chacune à sa propre échelle, triées par régime puis par jour de
// pic, avec les événements sourcés en traits verticaux. Une aire empilée des
// 64 clusters serait illisible ; quatre petits graphiques montrent à la place
// le volume quotidien de chaque régime. En dessous : un cluster isolé, en
// valeurs absolues, avec ses images du jour de pic contre celles du reste du mois.

import { etat } from "../etat.js";
import { entier, pct, jourCourt, jourMoyen, html, accord, estWeekend, mediane } from "../format.js";
import { REGIMES, ORDRE_REGIMES } from "../textes.js";
import * as infobulle from "../ui/infobulle.js";
import { outils } from "../ui/graphe.js";
import { ouvre as ouvreVisionneuse } from "../ui/visionneuse.js";

const JOURS = d3.range(29);

export default class VueTemps {
  constructor(el, donnees, navigue) {
    this.el = el;
    this.d = donnees;
    this.nav = navigue;
    const parRegime = d3.rollup(donnees.clusters, (v) => v.length, (f) => f.regime);
    el.innerHTML = `
      <div class="page">
        <header class="page__entete">
          <span class="kicker">Vue 2 · Temps</span>
          <h2>${parRegime.get("evenementiel")} clusters vivent d'un événement, ${parRegime.get("semaine")} ne publient qu'en semaine : deux régimes que le volume seul ne montre pas</h2>
          <p class="chapeau">Les pics se lisent contre l'actualité : chaque trait vertical est un événement daté, dont la source est citée.
            Un pic sans trait est un pic que je n'ai pas su expliquer avec une source fiable : il n'est pas annoté.</p>
        </header>

        <section class="bloc">
          <h3>Le volume quotidien, par régime</h3>
          <p class="chapeau">Images publiées chaque jour par les clusters de chaque régime. Échelles indépendantes : comparez les formes, pas les hauteurs. Bandes grises : week-ends.</p>
          <div class="colonnes colonnes--4" id="regimes"></div>
        </section>

        <section class="bloc">
          <h3>Les 64 clusters, jour par jour</h3>
          <p class="chapeau">Chaque crête est un cluster, rapporté à son propre maximum : on compare des rythmes, pas des volumes. Survolez une crête pour les valeurs, cliquez pour le détail.</p>
          <div class="graphe defile" id="cretes"></div>
          <p class="source-graphe">Lecture : la crête de Visite Papale est plate tout le mois puis monte d'un coup le 25. Jours en abscisse, du 1<sup>er</sup> au 29 septembre 2026.</p>
        </section>

        <section class="bloc" id="detail-temps"></section>
      </div>`;
    this.dessineRegimes();
    this.dessineCretes();
    this.majDetail();
    etat.ecoute(["focus"], () => { this.majDetail(); this.marqueActif(); });
  }

  // ------------------------------------------------------------------ Petits multiples par régime
  dessineRegimes() {
    const zone = this.el.querySelector("#regimes");
    for (const r of ORDRE_REGIMES) {
      const membres = this.d.clusters.filter((f) => f.regime === r);
      const serie = this.d.serie(membres.map((f) => f.id));
      const total = d3.sum(serie);
      const cellule = document.createElement("div");
      cellule.className = "graphe";
      cellule.innerHTML = `<h4 style="font:600 13px var(--sans);margin:0 0 2px">${REGIMES[r].nom}</h4>
        <p class="petit discret" style="margin:0 0 6px;min-height:34px">${accord(membres.length, "cluster")}, ${entier(total)} images. ${REGIMES[r].definition.charAt(0).toUpperCase()}${REGIMES[r].definition.slice(1)}.</p>`;
      const l = 280, h = 92, m = { g: 30, d: 4, h: 6, b: 18 };
      const x = d3.scaleBand().domain(JOURS).range([m.g, l - m.d]).paddingInner(0.18);
      const y = d3.scaleLinear().domain([0, d3.max(serie)]).nice(3).range([h - m.b, m.h]);
      const svg = d3.select(cellule).append("svg").attr("viewBox", `0 0 ${l} ${h}`).attr("width", "100%").attr("role", "img")
        .attr("aria-label", `Images par jour, régime ${REGIMES[r].nom}`);
      svg.append("g").selectAll("rect").data(JOURS.filter(estWeekend)).join("rect")
        .attr("x", (j) => x(j) - x.step() * 0.09).attr("width", x.step()).attr("y", m.h).attr("height", h - m.b - m.h).attr("fill", "#ece8df");
      svg.append("g").attr("class", "grille").selectAll("line").data(y.ticks(3)).join("line")
        .attr("x1", m.g).attr("x2", l - m.d).attr("y1", (v) => y(v)).attr("y2", (v) => y(v));
      svg.append("g").selectAll("rect").data(serie).join("rect")
        .attr("x", (_, j) => x(j)).attr("width", x.bandwidth())
        .attr("y", (v) => y(v)).attr("height", (v) => y(0) - y(v)).attr("fill", "#1b1a17")
        .on("pointerenter pointermove", (ev, v) => {
          const j = serie.indexOf(v);
          infobulle.montre(`<div class="infobulle__valeur">${entier(v)} images</div><div class="discret">${jourMoyen(j)} · ${REGIMES[r].nom.toLowerCase()}</div>`, ev.clientX, ev.clientY);
        })
        .on("pointerleave", () => infobulle.cache({ force: true }));
      svg.append("g").attr("class", "axe").attr("transform", `translate(${m.g - 4},0)`)
        .call(d3.axisLeft(y).ticks(3).tickSize(0).tickFormat((v) => entier(v))).call((g) => g.select(".domain").remove());
      svg.append("g").attr("class", "axe").attr("transform", `translate(0,${h - m.b + 12})`).selectAll("text")
        .data([0, 6, 13, 20, 27]).join("text").attr("x", (j) => x(j) + x.bandwidth() / 2).attr("text-anchor", "middle")
        .text((j) => (j === 0 ? "1er" : String(j + 1)));
      zone.append(cellule);
    }
  }

  // ------------------------------------------------------------------ Crêtes
  ordreCretes() {
    const rang = Object.fromEntries(ORDRE_REGIMES.map((r, i) => [r, i]));
    return [...this.d.clusters].sort((a, b) => (rang[a.regime] - rang[b.regime]) || (a.pic - b.pic) || (b.n - a.n));
  }

  dessineCretes() {
    const zone = this.el.querySelector("#cretes");
    const ordre = this.ordreCretes();
    const largeur = Math.max(760, zone.getBoundingClientRect().width || 1200);
    const pas = 18, amplitude = 27, gauche = 210, droite = 150, haut = 46;
    const titres = ORDRE_REGIMES.filter((r) => ordre.some((f) => f.regime === r));
    const hauteur = haut + ordre.length * pas + titres.length * 26 + 30;
    const x = d3.scaleLinear().domain([0, 28]).range([gauche, largeur - droite]);
    const svg = d3.select(zone).append("svg").attr("class", "cretes").attr("width", largeur).attr("height", hauteur)
      .attr("role", "img").attr("aria-label", "Images par jour pour chacun des 64 clusters, normalisées par cluster");
    this.svgCretes = svg;

    // Fond : week-ends et événements.
    const fond = svg.append("g");
    for (const j of JOURS.filter(estWeekend)) {
      fond.append("rect").attr("x", x(j) - (x(1) - x(0)) / 2).attr("width", x(1) - x(0)).attr("y", haut - 8).attr("height", hauteur - haut - 14).attr("fill", "#ece8df");
    }
    const evts = d3.group(this.d.evenements, (e) => e.jour);
    for (const [jour, liste] of evts) {
      const g = fond.append("g").attr("class", "evenement");
      g.append("line").attr("x1", x(jour)).attr("x2", x(jour)).attr("y1", haut - 8).attr("y2", hauteur - 16).attr("stroke", "#1b1a17").attr("stroke-width", 0.8).attr("opacity", 0.55);
      g.append("text").attr("x", x(jour)).attr("y", haut - 14).attr("text-anchor", "middle").attr("font-size", 10).attr("font-weight", 700).attr("fill", "#1b1a17")
        .text(`${jour + 1}`);
      g.append("rect").attr("x", x(jour) - 8).attr("y", haut - 26).attr("width", 16).attr("height", 16).attr("fill", "transparent").style("cursor", "help")
        .on("pointerenter pointermove", (ev) => infobulle.montre(`<div class="kicker" style="margin:0 0 4px">${jourCourt(jour)}</div>${liste.map((e) => `<div style="margin-bottom:5px"><strong>${html(e.titre)}</strong><br><span class="discret petit">${html(e.sources[0].editeur)}</span></div>`).join("")}`, ev.clientX, ev.clientY))
        .on("pointerleave", () => infobulle.cache({ force: true }));
    }
    svg.append("text").attr("x", gauche - 12).attr("y", haut - 14).attr("text-anchor", "end").attr("font-size", 10).attr("fill", "#6f695d").text("événements sourcés ▸");
    // axe des jours en bas
    const axe = svg.append("g").attr("class", "graphe axe");
    [0, 6, 13, 20, 27, 28].forEach((j) => axe.append("text").attr("x", x(j)).attr("y", hauteur - 2).attr("text-anchor", "middle").attr("font-size", 10.5).attr("fill", "#6f695d").text(j === 0 ? "1er sept." : String(j + 1)));

    let y = haut;
    let regimeCourant = null;
    this.lignesCretes = new Map();
    for (const f of ordre) {
      if (f.regime !== regimeCourant) {
        regimeCourant = f.regime;
        y += 26;
        svg.append("text").attr("class", "regime-titre").attr("x", 0).attr("y", y - 10).text(REGIMES[f.regime].nom);
        svg.append("line").attr("x1", 0).attr("x2", largeur).attr("y1", y - 6.5).attr("y2", y - 6.5).attr("stroke", "#1b1a17");
      }
      y += pas;
      const max = d3.max(f.serie) || 1;
      const yy = (v) => y - (v / max) * amplitude;
      const aire = d3.area().x((_, j) => x(j)).y0(y).y1((v) => yy(v)).curve(d3.curveMonotoneX);
      const ligne = d3.line().x((_, j) => x(j)).y((v) => yy(v)).curve(d3.curveMonotoneX);
      const g = svg.append("g").attr("class", "ligne-cluster").attr("data-cluster", f.id).style("cursor", "pointer");
      g.append("path").attr("d", aire(f.serie)).attr("fill", "#f5f3ee").attr("fill-opacity", 0.94);
      g.append("path").attr("d", aire(f.serie)).attr("fill", "rgba(27,26,23,0.07)");
      g.append("path").attr("d", ligne(f.serie)).attr("fill", "none").attr("stroke", "#1b1a17").attr("stroke-width", 1.1);
      g.append("text").attr("x", gauche - 12).attr("y", y - 3).attr("text-anchor", "end").text(f.label);
      g.append("text").attr("x", largeur - droite + 12).attr("y", y - 3).attr("font-size", 10.5).attr("fill", "#6f695d")
        .text(`${jourCourt(f.pic)} · ${pct(f.pct_pic / 100, 0)}`);
      g.append("rect").attr("x", 0).attr("y", y - pas).attr("width", largeur).attr("height", pas).attr("fill", "transparent")
        .on("pointermove", (ev) => {
          const [mx] = d3.pointer(ev);
          const j = Math.max(0, Math.min(28, Math.round(x.invert(mx))));
          infobulle.montre(`<div style="font-weight:700">${html(f.label)}</div><div class="infobulle__valeur">${entier(f.serie[j])} images</div>
            <div class="discret">${jourMoyen(j)} · pic le ${jourCourt(f.pic)} (${entier(f.serie[f.pic])})</div>`, ev.clientX, ev.clientY);
        })
        .on("pointerleave", () => infobulle.cache({ force: true }))
        .on("click", () => etat.change({ focus: f.id }));
      this.lignesCretes.set(f.id, g);
    }
    svg.append("text").attr("x", largeur - droite + 12).attr("y", haut - 14).attr("font-size", 10).attr("fill", "#6f695d").text("pic · part du cluster");
    outils(zone, {
      svg: () => svg.node(),
      nom: "spine-691-cretes.png",
      titre: "Les 64 clusters, jour par jour (1er–29 septembre 2026)",
      sousTitre: "Images par jour, chaque cluster rapporté à son propre maximum ; traits verticaux : événements sourcés",
      donnees: () => [this.d.clusters.map((f) => ({ id: f.id, label: f.label, regime: REGIMES[f.regime].nom, ...Object.fromEntries(f.serie.map((v, j) => [`j${j + 1}`, v])) })),
        [["id", "cluster_id"], ["label", "label"], ["regime", "régime"], ...JOURS.map((j) => [`j${j + 1}`, `2026-09-${String(j + 1).padStart(2, "0")}`])]],
    });
    this.marqueActif();
  }

  marqueActif() {
    const focus = etat.get("focus");
    for (const [id, g] of this.lignesCretes ?? []) g.classed("actif", id === focus);
  }

  // ------------------------------------------------------------------ Détail d'un cluster
  majDetail() {
    const zone = this.el.querySelector("#detail-temps");
    const id = etat.get("focus") ?? 14;
    const f = this.d.fiche(id);
    if (!f || id < 0) { zone.innerHTML = ""; return; }
    const evts = this.d.evenements.filter((e) => e.clusters.includes(id));
    const choix = [...this.d.clusters].sort((a, b) => a.label.localeCompare(b.label, "fr"))
      .map((c) => `<option value="${c.id}"${c.id === id ? " selected" : ""}>${html(c.label)}</option>`).join("");
    zone.innerHTML = `
      <h3>${html(f.label)} : ${entier(f.serie[f.pic])} images le ${jourCourt(f.pic)}, ${pct(f.pct_pic / 100, 1)} du cluster en un jour</h3>
      <p class="chapeau">Régime ${REGIMES[f.regime].nom.toLowerCase()} · ${accord(f.n, "image")} · médiane ${mediane(f.eng.mediane)} engagements par post.
        <label style="margin-left:12px">Changer de cluster <select class="champ" id="choix-temps">${choix}</select></label>
        <button type="button" class="lien-bouton" id="voir-carte" style="margin-left:10px">Voir sur la carte</button></p>
      <div class="colonnes colonnes--2-1">
        <div class="graphe" id="detail-courbe"></div>
        <div>${evts.length ? `<h4 class="pc" style="font-size:12px;margin:0 0 6px">Événements sourcés</h4><ol class="liste-sources">${evts.map((e) => `
          <li><span class="date">${jourCourt(e.jour)}</span><span><strong>${html(e.titre)}.</strong> ${html(e.texte)}<br>
          ${e.sources.map((s) => `<a href="${html(s.url)}" target="_blank" rel="noopener">${html(s.editeur)}, ${html(s.titre)} ↗</a>`).join("<br>")}</span></li>`).join("")}</ol>`
          : `<p class="note-lecture">Aucun événement sourcé pour ce cluster. Son pic du ${jourCourt(f.pic)} n'est pas expliqué ici : je n'ai pas trouvé de source fiable qui le date.</p>`}</div>
      </div>
      <div id="temps-avant-apres" style="margin-top:22px"></div>`;
    zone.querySelector("#choix-temps").addEventListener("change", (e) => etat.change({ focus: Number(e.target.value) }));
    zone.querySelector("#voir-carte").addEventListener("click", () => this.nav("carte", { sel: id, iso: [id] }));
    this.courbeDetail(zone.querySelector("#detail-courbe"), f, evts);
    this.avantApres(zone.querySelector("#temps-avant-apres"), f);
  }

  courbeDetail(zone, f, evts) {
    const l = 760, h = 230, m = { g: 44, d: 10, h: 26, b: 28 };
    const x = d3.scaleBand().domain(JOURS).range([m.g, l - m.d]).paddingInner(0.2);
    const y = d3.scaleLinear().domain([0, d3.max(f.serie)]).nice(4).range([h - m.b, m.h]);
    const svg = d3.select(zone).append("svg").attr("viewBox", `0 0 ${l} ${h}`).attr("width", "100%").attr("role", "img")
      .attr("aria-label", `Images par jour du cluster ${f.label}`);
    svg.append("g").selectAll("rect").data(JOURS.filter(estWeekend)).join("rect")
      .attr("x", (j) => x(j) - x.step() * 0.1).attr("width", x.step()).attr("y", m.h).attr("height", h - m.b - m.h).attr("fill", "#ece8df");
    svg.append("g").attr("class", "grille").selectAll("line").data(y.ticks(4)).join("line")
      .attr("x1", m.g).attr("x2", l - m.d).attr("y1", (v) => y(v)).attr("y2", (v) => y(v));
    svg.append("g").attr("class", "axe").attr("transform", `translate(${m.g - 6},0)`)
      .call(d3.axisLeft(y).ticks(4).tickSize(0).tickFormat((v) => entier(v))).call((g) => g.select(".domain").remove());
    svg.append("text").attr("class", "titre-axe").attr("x", m.g - 6).attr("y", m.h - 12).attr("text-anchor", "end").text("images");
    svg.append("g").selectAll("rect").data(f.serie).join("rect")
      .attr("x", (_, j) => x(j)).attr("width", x.bandwidth()).attr("y", (v) => y(v)).attr("height", (v) => y(0) - y(v))
      .attr("fill", (_, j) => (j === f.pic ? "#1b1a17" : "#8a8476"))
      .on("pointerenter pointermove", (ev, v) => {
        const j = f.serie.indexOf(v);
        infobulle.montre(`<div class="infobulle__valeur">${entier(v)} images</div><div class="discret">${jourMoyen(j)}</div>`, ev.clientX, ev.clientY);
      })
      .on("pointerleave", () => infobulle.cache({ force: true }));
    for (const e of evts) {
      const cx = x(e.jour) + x.bandwidth() / 2;
      svg.append("path").attr("d", `M${cx - 4},${m.h - 14} L${cx + 4},${m.h - 14} L${cx},${m.h - 7} Z`).attr("fill", "#1b1a17");
    }
    const axe = svg.append("g").attr("class", "axe");
    JOURS.forEach((j) => {
      if (j % 2 === 0 || j === 28) axe.append("text").attr("x", x(j) + x.bandwidth() / 2).attr("y", h - m.b + 15).attr("text-anchor", "middle").text(j === 0 ? "1er" : j + 1);
    });
    outils(zone, {
      svg: () => svg.node(),
      nom: `spine-691-temps-cluster-${f.id}.png`,
      titre: `${f.label} : images par jour`,
      sousTitre: `1er–29 septembre 2026 · pic le ${jourCourt(f.pic)} · triangles : événements sourcés`,
      donnees: () => [JOURS.map((j) => ({ date: `2026-09-${String(j + 1).padStart(2, "0")}`, images: f.serie[j] })), [["date", "date"], ["images", "images"]]],
    });
  }

  /** Planche « avant / après » : images locales du jour de pic contre le reste du mois. */
  avantApres(zone, f) {
    const p = this.d.p;
    const images = f.echantillon.map((r) => this.d.echantillon[r]);
    const duPic = images.filter((e) => Math.floor(p.minute[e.point] / 1440) === f.pic);
    const reste = images.filter((e) => Math.floor(p.minute[e.point] / 1440) !== f.pic);
    const planche = (liste, titre, max = 12) => `
      <div><h4>${titre}</h4>
        ${liste.length ? `<div class="mini-planche" style="grid-template-columns:repeat(6,1fr)">${liste.slice(0, max).map((e) => `
          <button type="button" data-rang="${e.rang}" aria-label="Agrandir"><img src="${this.d.vignette(e)}" alt="" loading="lazy" width="96" height="96"></button>`).join("")}</div>
          <p class="petit discret" style="margin-top:4px">${accord(Math.min(max, liste.length), "image")} affichée${Math.min(max, liste.length) > 1 ? "s" : ""} sur ${entier(liste.length)} dans l'échantillon local.</p>`
          : `<p class="vide"><strong>Aucune image locale ce jour-là.</strong>L'échantillon du dépôt a été tiré dans l'ordre de publication :
              il s'arrête pour ce cluster le ${jourCourt(this.d.datesEchantillon(f).dernier)}. Voir « Ce que la méthode rate ».</p>`}
      </div>`;
    zone.innerHTML = `<h4 class="pc" style="font-size:12px;margin:0 0 4px">Avant / après</h4>
      <p class="chapeau" style="margin-bottom:10px">Les images du jour de pic ressemblent-elles au reste du cluster ? Si oui, le pic est un surcroît de volume ; si non, l'événement a apporté ses propres images.</p>
      <div class="avant-apres">${planche(duPic, `Le jour du pic, ${jourCourt(f.pic)}`)}${planche(reste, "Le reste du mois")}</div>`;
    zone.querySelectorAll("[data-rang]").forEach((b) => b.addEventListener("click", () => {
      const e = this.d.echantillon[Number(b.dataset.rang)];
      const liste = duPic.includes(e) ? duPic : reste;
      ouvreVisionneuse(liste, liste.indexOf(e));
    }));
  }

  active() {}
}
