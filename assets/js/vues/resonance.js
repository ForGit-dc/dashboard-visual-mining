// Vue Résonance : couverture contre reprise.
//
// Abscisse : images du cluster (échelle log). Ordonnée : médiane des
// engagements par post (échelle log(1 + x), pour placer les médianes nulles).
// Quadrants coupés à la médiane des tailles de cluster et à la médiane des
// engagements par post de tout le corpus.

import { etat } from "../etat.js";
import { entier, decimal, pct, mediane, html, accord, enLettres } from "../format.js";
import { FAMILLES, COULEUR_FAMILLE } from "../couleurs.js";
import { LOGIQUES } from "../textes.js";
import * as infobulle from "../ui/infobulle.js";
import { outils } from "../ui/graphe.js";
import { place as placeEtiquettes } from "../carte/etiquettes.js";

export default class VueResonance {
  constructor(el, donnees, navigue) {
    this.el = el;
    this.d = donnees;
    this.nav = navigue;
    this.deciles = false;
    const C = donnees.clusters;
    this.medianeCorpus = donnees.meta.totaux.mediane_engagement_post;
    this.medianeTaille = d3.median(C, (f) => f.n);
    const vide = C.filter((f) => f.n >= this.medianeTaille && f.eng.mediane < this.medianeCorpus);
    const gabarits = vide.filter((f) => f.logique === "gabarit");
    const fd = donnees.fiche(58), sd = donnees.fiche(12);
    const imagesVide = d3.sum(vide, (f) => f.n);

    el.innerHTML = `
      <div class="page">
        <header class="page__entete">
          <span class="kicker">Vue 4 · Résonance contre couverture</span>
          <h2>Beaucoup produit, rien repris : ${vide.length === gabarits.length ? `les ${enLettres(vide.length)} clusters de la production à vide sont tous des gabarits d'éditeurs` : `${enLettres(gabarits.length)} des ${enLettres(vide.length)} clusters de la production à vide sont des gabarits d'éditeurs`}</h2>
          <p class="chapeau">${html(fd.label)} : ${entier(fd.n)} images, médiane ${mediane(fd.eng.mediane)} engagement par post.
            ${html(sd.label)} : ${entier(sd.n)} images, médiane ${mediane(sd.eng.mediane)}. Couvrir et être repris sont deux choses différentes ;
            un classement par volume seul ment par omission. En bas à droite, ${accord(vide.length, "cluster")} et ${entier(imagesVide)} images
            (${pct(imagesVide / donnees.n)} du corpus) publiées pour une médiane sous celle du corpus.</p>
        </header>

        <div class="colonnes colonnes--2-1">
          <section class="bloc">
            <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap">
              <h3 style="font-size:19px">Volume et reprise des 64 clusters</h3>
              <label class="interrupteur"><input type="checkbox" id="deciles"> Afficher le 9e décile</label>
            </div>
            <div class="graphe" id="plan"></div>
            <p class="source-graphe">Un point par cluster, de la couleur de sa famille dominante. Coupures : ${entier(this.medianeTaille)} images (médiane des clusters)
              et ${mediane(this.medianeCorpus)} engagements par post (médiane du corpus). Engagements comptés une fois par post.</p>
          </section>
          <section class="bloc">
            <h3 style="font-size:19px">Quand un seul post fait le cluster</h3>
            <p class="chapeau petit">Part des engagements de chaque cluster apportée par son post le plus engageant. Au-delà d'un quart, le total d'engagements ne décrit pas le cluster, il décrit un post.</p>
            <div class="graphe" id="viral"></div>
          </section>
        </div>

        <section class="bloc">
          <h3>Le facteur 42 du brief survit à la correction, mais il ne dit plus la même chose</h3>
          <p class="chapeau">La colonne <code>eng_par_image</code> du brief divise la somme des engagements par le nombre d'images.
            Or l'engagement est celui du post, recopié sur chacune de ses images : un post de quatre images compte quatre fois.
            Et une moyenne suit ses valeurs extrêmes. La médiane par post corrige les deux. Entre Football Européen et Faits Divers,
            elle redonne par coïncidence le même rapport ; pour les autres clusters, l'ordre change.</p>
          <div id="comparaison" class="defile"></div>
          <p class="reserve">Les engagements mesurent la réaction au post, pas à l'image. Un post à quatre images porte le même chiffre sur ses quatre images ; on ne sait pas laquelle a fait réagir.</p>
        </section>
      </div>`;

    el.querySelector("#deciles").addEventListener("change", (e) => { this.deciles = e.target.checked; this.plan(); });
    this.plan();
    this.viral();
    this.comparaison();
  }

  plan() {
    const zone = this.el.querySelector("#plan");
    zone.innerHTML = "";
    const l = 820, h = 560, m = { g: 56, d: 18, h: 18, b: 46 };
    const C = this.d.clusters;
    const x = d3.scaleLog().domain([180, 8200]).range([m.g, l - m.d]);
    const haut = this.deciles ? 1200 : 80;
    const t = (v) => Math.log10(1 + v);
    const y = d3.scaleLinear().domain([0, t(haut)]).range([h - m.b, m.h]);
    const yv = (v) => y(t(v));
    const svg = d3.select(zone).append("svg").attr("viewBox", `0 0 ${l} ${h}`).attr("width", "100%").attr("role", "img")
      .attr("aria-label", "Images par cluster contre médiane des engagements par post");

    // quadrants
    const qx = x(this.medianeTaille), qy = yv(this.medianeCorpus);
    svg.append("rect").attr("x", qx).attr("y", qy).attr("width", l - m.d - qx).attr("height", h - m.b - qy).attr("fill", "#ece8df");
    svg.append("line").attr("x1", qx).attr("x2", qx).attr("y1", m.h).attr("y2", h - m.b).attr("stroke", "#a9a191");
    svg.append("line").attr("x1", m.g).attr("x2", l - m.d).attr("y1", qy).attr("y2", qy).attr("stroke", "#a9a191");
    const compte = (cx, cy) => C.filter((f) => (f.n >= this.medianeTaille) === cx && (f.eng.mediane >= this.medianeCorpus) === cy).length;
    const q = [
      [m.g + 8, m.h + 14, "start", "Peu produit, beaucoup repris", compte(false, true)],
      [l - m.d - 8, m.h + 14, "end", "Beaucoup produit, beaucoup repris", compte(true, true)],
      [m.g + 8, h - m.b - 10, "start", "Peu produit, peu repris", compte(false, false)],
      [l - m.d - 8, h - m.b - 10, "end", "Beaucoup produit, rien repris", compte(true, false)],
    ];
    for (const [qx_, qy_, ancre, texte, n] of q) {
      svg.append("text").attr("class", "quadrant").attr("x", qx_).attr("y", qy_).attr("text-anchor", ancre).text(`${texte} · ${n}`);
    }

    // axes
    const ticksX = [200, 300, 500, 1000, 2000, 5000];
    svg.append("g").attr("class", "axe").attr("transform", `translate(0,${h - m.b})`)
      .call(d3.axisBottom(x).tickValues(ticksX).tickFormat((v) => entier(v)).tickSize(4))
      .call((g) => g.select(".domain").attr("stroke", "#a9a191"));
    const ticksY = (this.deciles ? [0, 1, 3, 10, 30, 100, 300, 1000] : [0, 1, 2, 5, 10, 20, 50]).filter((v) => v <= haut);
    svg.append("g").attr("class", "grille").selectAll("line").data(ticksY).join("line")
      .attr("x1", m.g).attr("x2", l - m.d).attr("y1", (v) => yv(v)).attr("y2", (v) => yv(v));
    svg.append("g").attr("class", "axe").selectAll("text").data(ticksY).join("text")
      .attr("x", m.g - 8).attr("y", (v) => yv(v) + 3.5).attr("text-anchor", "end").text((v) => entier(v));
    svg.append("text").attr("class", "titre-axe").attr("x", m.g - 8).attr("y", m.h - 4).attr("text-anchor", "end").text("eng./post");
    svg.append("text").attr("class", "titre-axe").attr("x", l - m.d).attr("y", h - 8).attr("text-anchor", "end").text("images dans le cluster (échelle log) →");
    svg.append("text").attr("class", "titre-axe").attr("x", m.g).attr("y", h - 8).text(`↑ médiane des engagements par post (échelle log 1 + x)`);

    // déciles
    if (this.deciles) {
      svg.append("g").selectAll("line").data(C).join("line")
        .attr("x1", (f) => x(f.n)).attr("x2", (f) => x(f.n))
        .attr("y1", (f) => yv(f.eng.mediane)).attr("y2", (f) => yv(f.eng.q90))
        .attr("stroke", (f) => COULEUR_FAMILLE[FAMILLES[f.dominante]]).attr("stroke-opacity", 0.55).attr("stroke-width", 1.2);
      svg.append("g").selectAll("line").data(C).join("line")
        .attr("x1", (f) => x(f.n) - 3).attr("x2", (f) => x(f.n) + 3)
        .attr("y1", (f) => yv(f.eng.q90)).attr("y2", (f) => yv(f.eng.q90))
        .attr("stroke", (f) => COULEUR_FAMILLE[FAMILLES[f.dominante]]).attr("stroke-width", 1.2);
    }

    // points
    svg.append("g").selectAll("circle").data(C).join("circle")
      .attr("cx", (f) => x(f.n)).attr("cy", (f) => yv(f.eng.mediane)).attr("r", 5)
      .attr("fill", (f) => COULEUR_FAMILLE[FAMILLES[f.dominante]]).attr("stroke", "#f5f3ee").attr("stroke-width", 2)
      .style("cursor", "pointer")
      .on("pointerenter pointermove", (ev, f) => infobulle.montre(`<div style="font-weight:700">${html(f.label)}</div>
        <div class="infobulle__valeur">${mediane(f.eng.mediane)} engagements médians par post</div>
        <div class="infobulle__ligne"><span>Images</span><span>${entier(f.n)}</span></div>
        <div class="infobulle__ligne"><span>Posts</span><span>${entier(f.posts)}</span></div>
        <div class="infobulle__ligne"><span>9e décile</span><span>${entier(f.eng.q90)}</span></div>
        <div class="infobulle__ligne"><span>Part du 1er post</span><span>${pct(f.eng.part_premier, 0)}</span></div>
        <div class="infobulle__ligne"><span>Famille dominante</span><span>${FAMILLES[f.dominante]} ${pct(f.part_dominante, 0)}</span></div>
        <div class="infobulle__ligne"><span>Logique</span><span>${LOGIQUES[f.logique].nom}</span></div>`, ev.clientX, ev.clientY))
      .on("pointerleave", () => infobulle.cache({ force: true }))
      .on("click", (_, f) => this.nav("carte", { sel: f.id, iso: [f.id] }));

    // étiquettes sans chevauchement (même algorithme que la carte)
    const mesure = document.createElement("canvas").getContext("2d");
    const echelle = zone.getBoundingClientRect().width / l || 1;
    const candidats = C.map((f) => ({
      id: f.id, texte: f.label, x: x(f.n), y: yv(f.eng.mediane) - 11, ancreX: x(f.n), ancreY: yv(f.eng.mediane),
      taille: 10.5 / echelle > 13 ? 13 : 10.5, priorite: Math.abs(Math.log(f.n / this.medianeTaille)) + Math.abs(t(f.eng.mediane) - t(this.medianeCorpus)) * 2,
      force: false, gras: false,
    }));
    const obstacles = C.map((f) => ({ x: x(f.n) - 6, y: yv(f.eng.mediane) - 6, w: 12, h: 12 }));
    q.forEach(([qx_, qy_, ancre]) => obstacles.push({ x: ancre === "start" ? qx_ : qx_ - 240, y: qy_ - 11, w: 240, h: 14 }));
    const poses = placeEtiquettes(mesure, candidats, l, h, { marge: 2, obstacles });
    const g = svg.append("g");
    for (const p of poses) {
      if (p.deplace) {
        g.append("line").attr("x1", p.ancreX).attr("y1", p.ancreY)
          .attr("x2", Math.max(p.x, Math.min(p.ancreX, p.x + p.w))).attr("y2", Math.max(p.y, Math.min(p.ancreY, p.y + p.h)))
          .attr("stroke", "#1b1a17").attr("stroke-opacity", 0.4).attr("stroke-width", 0.8);
      }
      g.append("text").attr("class", "etiquette").attr("x", p.x + p.w / 2).attr("y", p.y + p.h / 2 + 3.5).attr("text-anchor", "middle")
        .attr("font-size", p.taille).text(p.texte);
    }

    outils(zone, {
      svg: () => svg.node(),
      nom: "spine-691-resonance.png",
      titre: "Volume et reprise des 64 clusters",
      sousTitre: `Images par cluster (log) contre médiane des engagements par post (log 1 + x) ; coupures : ${entier(this.medianeTaille)} images et ${mediane(this.medianeCorpus)} engagements`,
      donnees: () => [C.map((f) => ({ id: f.id, label: f.label, n: f.n, posts: f.posts, med: decimal(f.eng.mediane, 1), q90: decimal(f.eng.q90, 1), famille: FAMILLES[f.dominante] })),
        [["id", "cluster_id"], ["label", "label"], ["n", "images"], ["posts", "posts"], ["med", "médiane eng./post"], ["q90", "9e décile"], ["famille", "famille dominante"]]],
    });
  }

  viral() {
    const zone = this.el.querySelector("#viral");
    const C = [...this.d.clusters].sort((a, b) => b.eng.part_premier - a.eng.part_premier).slice(0, 14);
    const l = 400, ligne = 25, h = C.length * ligne + 26, m = { g: 168, d: 40 };
    const x = d3.scaleLinear().domain([0, 1]).range([m.g, l - m.d]);
    const svg = d3.select(zone).append("svg").attr("viewBox", `0 0 ${l} ${h}`).attr("width", "100%").attr("role", "img")
      .attr("aria-label", "Part des engagements apportée par le premier post, par cluster");
    svg.append("line").attr("x1", x(0.25)).attr("x2", x(0.25)).attr("y1", 0).attr("y2", h - 20).attr("stroke", "#a9a191");
    svg.append("text").attr("class", "titre-axe").attr("x", x(0.25) + 4).attr("y", h - 6).text("un quart");
    C.forEach((f, i) => {
      const y0 = i * ligne + 4;
      svg.append("text").attr("x", m.g - 8).attr("y", y0 + 13).attr("text-anchor", "end").attr("font-size", 11.5).attr("fill", "#1b1a17").text(f.label);
      svg.append("rect").attr("x", x(0)).attr("y", y0 + 3).attr("width", x(f.eng.part_premier) - x(0)).attr("height", 14).attr("fill", "#1b1a17")
        .on("pointerenter pointermove", (ev) => infobulle.montre(`<div style="font-weight:700">${html(f.label)}</div><div class="infobulle__valeur">${pct(f.eng.part_premier, 1)}</div><div class="discret">${entier(f.eng.max)} engagements sur ${entier(f.eng.somme_posts)}, pour le premier de ses ${entier(f.posts)} posts</div>`, ev.clientX, ev.clientY))
        .on("pointerleave", () => infobulle.cache({ force: true }));
      svg.append("text").attr("x", x(f.eng.part_premier) + 5).attr("y", y0 + 14).attr("font-size", 11).attr("fill", "#4a463e").text(pct(f.eng.part_premier, 0));
    });
    outils(zone, {
      svg: () => svg.node(),
      nom: "spine-691-dependance-au-viral.png",
      titre: "Part des engagements apportée par le premier post",
      donnees: () => [C.map((f) => ({ label: f.label, part: decimal(f.eng.part_premier * 100, 1), max: f.eng.max, somme: f.eng.somme_posts })),
        [["label", "cluster"], ["part", "part du 1er post (%)"], ["max", "engagements du 1er post"], ["somme", "engagements du cluster (un par post)"]]],
    });
  }

  comparaison() {
    const ids = [1, 2, 58, 40, 32, 12];
    const lignes = ids.map((id) => this.d.fiche(id));
    this.el.querySelector("#comparaison").innerHTML = `<table class="tableau-simple" style="min-width:760px">
      <thead><tr><th>Cluster</th><th class="n">Engagements<br>sommés par image</th><th class="n">Sommés par post</th><th class="n">« eng_par_image »<br>du brief (moyenne)</th><th class="n">Médiane<br>par post</th><th class="n">Part du<br>1er post</th></tr></thead>
      <tbody>${lignes.map((f) => `<tr>
        <td>${html(f.label)}</td>
        <td class="n">${entier(f.eng.somme_images)}</td>
        <td class="n">${entier(f.eng.somme_posts)}</td>
        <td class="n">${decimal(f.brief.eng_par_image, 1)}</td>
        <td class="n"><strong>${mediane(f.eng.mediane)}</strong></td>
        <td class="n">${pct(f.eng.part_premier, 0)}</td></tr>`).join("")}</tbody></table>
      <p class="petit discret" style="margin-top:8px">Football Européen : un seul post de quatre images (132&#8239;538 engagements) y pèse 530&#8239;152 engagements quand on somme par image, soit plus de la moitié du total.
      Rapport des moyennes Football / Faits Divers : ${decimal(this.d.fiche(1).brief.eng_par_image / this.d.fiche(58).brief.eng_par_image, 0)}. Rapport des médianes : ${decimal(this.d.fiche(1).eng.mediane / Math.max(1, this.d.fiche(58).eng.mediane), 0)}.
      L'écart reste énorme, mais il ne dit plus la même chose : la résonance de Football Européen tient à quelques posts viraux.</p>`;
  }

  active() {}
}
