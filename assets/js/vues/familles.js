// Vue Familles d'acteurs : l'angle propre à SPINE.
//
// La famille d'un compte (Media, Officials, Vectors, Influencers) n'est connue
// qu'agrégée par cluster (brief/data-derivee/cluster_x_famille.csv). Aucune
// image n'est jamais colorée par une famille : on compare des parts.

import { etat } from "../etat.js";
import { entier, decimal, pct, ratio, mediane, html, accord } from "../format.js";
import { FAMILLES, COULEUR_FAMILLE, barreComposition } from "../couleurs.js";
import { ROLES } from "../textes.js";
import * as infobulle from "../ui/infobulle.js";
import { outils } from "../ui/graphe.js";
import { aide } from "../ui/aide.js";
import { ouvre as ouvreVisionneuse } from "../ui/visionneuse.js";

const SEUIL_EFFECTIF = 5; // effectif attendu sous lequel un rapport n'est pas fiable

export default class VueFamilles {
  constructor(el, donnees, navigue) {
    this.el = el;
    this.d = donnees;
    this.nav = navigue;
    const fam = donnees.familles;
    const medCorpus = donnees.meta.totaux.mediane_engagement_post;
    const repertoire = donnees.clusters.filter((f) => f.ratios[2] >= 3).sort((a, b) => b.ratios[2] - a.ratios[2]);
    const repris = repertoire.filter((f) => f.eng.mediane >= 3 * medCorpus);

    el.innerHTML = `
      <div class="page">
        <header class="page__entete">
          <span class="kicker">Vue 3 · Familles d'acteurs</span>
          <h2>Les Vectors ne photographient pas : ils citent, tracent et caricaturent</h2>
          <p class="chapeau">Le corpus vient de six listes de comptes constituées à la main, regroupées en quatre familles.
            Un cluster tenu par les Media raconte une couverture éditoriale, par les Officials une opération de communication,
            par les Vectors une appropriation militante. La famille n'est connue qu'au niveau du cluster :
            les comparaisons portent sur des parts, jamais sur des images une à une.</p>
        </header>

        <div class="familles-tetes" id="tetes"></div>

        <section class="bloc">
          <h3>Le répertoire des Vectors : ${accord(repertoire.length, "cluster")} où ils pèsent plus de trois fois leur poids</h3>
          <p class="chapeau">Les Vectors font ${pct(fam[2].part)} du corpus. Dans ces clusters, ils en font de
            ${pct(Math.min(...repertoire.map((f) => f.parts[2])), 0)} à ${pct(Math.max(...repertoire.map((f) => f.parts[2])), 0)}.
            Ce sont des images de seconde main, qu'on cite pour argumenter : peinture ancienne, captures d'écran, couvertures de livres,
            dessins de presse, graphiques, miniatures vidéo, drapeaux. Et elles circulent : ${repris.length} de ces clusters ont une médiane
            d'au moins ${entier(3 * medCorpus)} engagements par post, trois fois celle du corpus (${mediane(medCorpus)}).</p>
          <div class="repertoire" id="repertoire"></div>
        </section>

        <section class="bloc">
          <h3>Chaque famille a ses territoires : les Officials leurs cérémonies et leurs communiqués, les Influencers le sport et les produits</h3>
          <p class="chapeau">Chaque case rapporte la part d'une famille dans le cluster à sa part dans tout le corpus.
            ×1 : la famille pèse son poids habituel. ×4 : quatre fois plus. Les cases teintées sont au-dessus de ×1, d'autant plus foncées que l'écart est grand.
            Une case hachurée signale un effectif attendu inférieur à ${SEUIL_EFFECTIF} images : le rapport y est trop fragile pour être lu.
            Cliquez un en-tête pour trier.</p>
          <div class="graphe" id="matrice"></div>
        </section>

        <section class="bloc">
          <h3>Du canal au sujet partagé : ${accord(donnees.clusters.filter((f) => f.entropie < 0.4).length, "cluster")} sur 64 sont des canaux tenus par une seule famille</h3>
          <p class="chapeau">Indice de mélange : entropie des parts des quatre familles, de 0 (une famille publie tout) à 1 (quatre parts égales).
            Un cluster homogène est un canal ; un cluster mélangé est un sujet que plusieurs familles s'approprient.
            Chaque point est un cluster, de la couleur de sa famille dominante, de surface proportionnelle à son nombre d'images.</p>
          <div class="graphe" id="melange"></div>
          <p class="note-lecture"><strong>Correction au brief.</strong> Aéronautique Militaire est le cluster dont la famille dominante pèse le moins (34,9 %) :
            Media, Officials et Vectors y publient à parts presque égales. Mais à l'entropie, qui compte aussi les Influencers,
            le plus mélangé est Industrie Agroalimentaire (0,91), devant Animaux et Humains (0,87). Les deux lectures sont justes ; elles ne mesurent pas la même chose.</p>
          <p><button type="button" class="bouton" id="vers-carte-familles">Voir la carte recolorée par famille</button></p>
        </section>
      </div>`;

    this.tetes();
    this.repertoire(repertoire);
    this.matrice();
    this.melange();
    el.querySelector("#vers-carte-familles").addEventListener("click", () => this.nav("carte", { couleur: "famille", iso: [], sel: null }));
    etat.ecoute(["triMatrice"], () => this.matrice());
  }

  tetes() {
    const zone = this.el.querySelector("#tetes");
    const dominees = FAMILLES.map((_, i) => this.d.clusters.filter((f) => f.dominante === i).length);
    zone.innerHTML = this.d.familles.map((f, i) => {
      const top = [...this.d.clusters].filter((c) => c.n * f.part >= SEUIL_EFFECTIF).sort((a, b) => b.ratios[i] - a.ratios[i]).slice(0, 3);
      const tauxMoyen = this.d.meta.totaux.bruit / this.d.meta.totaux.images;
      return `<div class="famille-tete" style="--c:${f.couleur}">
        <h3>${f.nom}</h3>
        <div class="volume num">${entier(f.images)} <span class="petit discret" style="font-weight:400">images, ${pct(f.part)}</span></div>
        <div class="petit">${dominees[i] ? `Majoritaire dans ${accord(dominees[i], "cluster")}` : "Majoritaire dans aucun cluster"}</div>
        <div class="petit ${f.taux_bruit > tauxMoyen * 1.3 ? "alerte" : ""}">${pct(f.taux_bruit)} de ses images non classées${f.taux_bruit > tauxMoyen * 1.3 ? ` (moyenne : ${pct(tauxMoyen)})` : ""}</div>
        <p class="role">${ROLES[f.nom]}</p>
        <p class="petit" style="margin:6px 0 0"><span class="discret">Plus sur-représentée dans</span><br>${top.map((c) => `${html(c.label)} <strong>${ratio(c.ratios[i])}</strong>`).join("<br>")}</p>
      </div>`;
    }).join("");
  }

  repertoire(liste) {
    const zone = this.el.querySelector("#repertoire");
    zone.innerHTML = liste.map((f) => {
      const images = f.echantillon.slice(0, 6).map((r) => this.d.echantillon[r]);
      return `<div class="repertoire__item">
        <div class="mini-planche" style="grid-template-columns:repeat(3,1fr)">${images.map((e, k) => `
          <button type="button" data-cluster="${f.id}" data-k="${k}" aria-label="Agrandir"><img src="${this.d.vignette(e)}" alt="" loading="lazy" width="76" height="76"></button>`).join("")}</div>
        <h4>${html(f.label)}</h4>
        <p><span class="ratio">${ratio(f.ratios[2])}</span> · ${pct(f.parts[2], 0)} de Vectors · médiane ${mediane(f.eng.mediane)} eng./post</p>
        <p>${html(f.voit)}</p>
      </div>`;
    }).join("");
    zone.querySelectorAll("[data-cluster]").forEach((b) => b.addEventListener("click", () => {
      const f = this.d.fiche(Number(b.dataset.cluster));
      ouvreVisionneuse(f.echantillon.map((r) => this.d.echantillon[r]), Number(b.dataset.k));
    }));
  }

  matrice() {
    const zone = this.el.querySelector("#matrice");
    const cle = etat.get("triMatrice");
    const tri = {
      Media: (f) => f.ratios[0], Officials: (f) => f.ratios[1], Vectors: (f) => f.ratios[2], Influencers: (f) => f.ratios[3],
      melange: (f) => f.entropie, n: (f) => f.n,
    }[cle] ?? ((f) => f.ratios[2]);
    const lignes = [...this.d.clusters].sort((a, b) => tri(b) - tri(a));
    const part = this.d.familles.map((f) => f.part);
    const fond = (i, r) => {
      if (r <= 1) return "transparent";
      const t = Math.min(1, Math.log2(r) / Math.log2(6));
      return d3.color(d3.interpolateLab("#f5f3ee", COULEUR_FAMILLE[FAMILLES[i]])(0.12 + 0.78 * t)).formatHex();
    };
    const encre = (i, r) => {
      if (r <= 1) return "";
      const c = d3.lab(fond(i, r));
      return c.l < 58 ? "color:#fff;font-weight:700" : "font-weight:700";
    };
    const bulles = {
      melange: ["Mélange", "0 : une seule famille publie ; 1 : les quatre à parts égales|Clic : trier du plus mélangé au plus homogène"],
      n: ["Images", "Images du cluster|Clic : trier du plus gros au plus petit"],
    };
    const entete = (k, titre) => {
      const [t, texte] = bulles[k] ?? [k, `Part des ${k} dans le cluster, divisée par leur part dans le corpus (${pct(part[FAMILLES.indexOf(k)], 1)})|Clic : trier, la plus forte sur-représentation en haut`];
      return `<th scope="col" aria-sort="${cle === k ? "descending" : "none"}" ${aide(t, texte)}><button type="button" data-tri="${k}">${titre}${cle === k ? " ▼" : ""}</button></th>`;
    };
    zone.innerHTML = `<div style="max-height:620px;overflow-y:auto;border-top:1px solid var(--encre)"><table class="matrice">
      <thead><tr><th scope="col">Cluster</th>${FAMILLES.map((f, i) => entete(f, `<span class="fam fam--${f}">${f}</span> <span class="discret" style="font-weight:400">${pct(part[i], 1)}</span>`)).join("")}
        ${entete("melange", "Mélange")}<th scope="col" style="min-width:150px">Composition</th>${entete("n", "Images")}</tr></thead>
      <tbody>${lignes.map((f) => `<tr>
        <td class="nom" data-cluster="${f.id}" ${aide(f.label, "Clic : ouvrir ce cluster sur la carte, avec sa fiche")}>${html(f.label)}</td>
        ${FAMILLES.map((fam, i) => {
          const attendu = f.n * part[i];
          const r = f.ratios[i];
          if (attendu < SEUIL_EFFECTIF) return `<td class="cellule vide-effectif" ${aide(`${f.label} · ${fam}`, `${entier(f.familles[i])} images observées pour ${decimal(attendu, 1)} attendues|Effectif trop faible : le rapport ne se lit pas`)}>${ratio(r)}</td>`;
          return `<td class="cellule${r <= 1 ? " faible" : ""}" style="background:${fond(i, r)};${encre(i, r)}" data-i="${i}" data-cluster="${f.id}">${ratio(r)}</td>`;
        }).join("")}
        <td class="cellule">${decimal(f.entropie, 2)}</td>
        <td>${barreComposition(f.parts)}</td>
        <td class="cellule">${entier(f.n)}</td>
      </tr>`).join("")}</tbody></table></div>`;
    zone.querySelectorAll("[data-tri]").forEach((b) => b.addEventListener("click", () => etat.change({ triMatrice: b.dataset.tri })));
    zone.querySelectorAll("td.nom").forEach((td) => td.addEventListener("click", () => {
      const id = Number(td.dataset.cluster);
      this.nav("carte", { sel: id, iso: [id] });
    }));
    zone.querySelectorAll("td.cellule[data-i]").forEach((td) => {
      td.addEventListener("pointerenter", (ev) => {
        const f = this.d.fiche(Number(td.dataset.cluster));
        const i = Number(td.dataset.i);
        infobulle.montre(`<div style="font-weight:700">${html(f.label)} · ${FAMILLES[i]}</div>
          <div class="infobulle__valeur">${ratio(f.ratios[i])}</div>
          <div class="discret">${entier(f.familles[i])} images sur ${entier(f.n)}, soit ${pct(f.parts[i])} du cluster,<br>contre ${pct(part[i])} dans le corpus.<br>Attendu : ${decimal(f.n * part[i], 0)} images.</div>`, ev.clientX, ev.clientY);
      });
      td.addEventListener("pointermove", (ev) => infobulle.place(ev.clientX, ev.clientY));
      td.addEventListener("pointerleave", () => infobulle.cache({ force: true }));
    });
  }

  melange() {
    const zone = this.el.querySelector("#melange");
    const l = 1180, h = 300, m = { g: 20, d: 20, h: 40, b: 40 };
    const x = d3.scaleLinear().domain([0, 1]).range([m.g, l - m.d]);
    const r = d3.scaleSqrt().domain([0, d3.max(this.d.clusters, (f) => f.n)]).range([0, 26]);
    const noeuds = this.d.clusters.map((f) => ({ f, x: x(f.entropie), y: h / 2, r: Math.max(3, r(f.n)) }));
    const sim = d3.forceSimulation(noeuds)
      .force("x", d3.forceX((n) => x(n.f.entropie)).strength(1))
      .force("y", d3.forceY(h / 2 + 6).strength(0.06))
      .force("c", d3.forceCollide((n) => n.r + 1.2))
      .stop();
    for (let i = 0; i < 240; i++) sim.tick();
    const svg = d3.select(zone).append("svg").attr("viewBox", `0 0 ${l} ${h}`).attr("width", "100%").attr("role", "img")
      .attr("aria-label", "Indice de mélange des familles pour chaque cluster");
    const axe = svg.append("g").attr("class", "axe").attr("transform", `translate(0,${h - m.b + 10})`)
      .call(d3.axisBottom(x).ticks(10).tickSize(-6).tickFormat((v) => decimal(v, 1)));
    axe.select(".domain").attr("stroke", "#a9a191");
    svg.append("text").attr("class", "titre-axe").attr("x", x(0)).attr("y", h - 4).text("← canal : une famille publie tout");
    svg.append("text").attr("class", "titre-axe").attr("x", x(1)).attr("y", h - 4).attr("text-anchor", "end").text("sujet partagé : quatre parts égales →");
    svg.append("g").selectAll("circle").data(noeuds).join("circle")
      .attr("cx", (n) => n.x).attr("cy", (n) => n.y).attr("r", (n) => n.r)
      .attr("fill", (n) => COULEUR_FAMILLE[FAMILLES[n.f.dominante]]).attr("fill-opacity", 0.85)
      .attr("stroke", "#f5f3ee").attr("stroke-width", 1.5).style("cursor", "pointer")
      .on("pointerenter pointermove", (ev, n) => infobulle.montre(`<div style="font-weight:700">${html(n.f.label)}</div>
        <div class="infobulle__valeur">${decimal(n.f.entropie, 2)}</div>
        <div class="discret">mélange · ${FAMILLES[n.f.dominante]} ${pct(n.f.part_dominante, 0)} · ${entier(n.f.n)} images</div>${barreComposition(n.f.parts)}`, ev.clientX, ev.clientY))
      .on("pointerleave", () => infobulle.cache({ force: true }))
      .on("click", (_, n) => this.nav("carte", { sel: n.f.id, iso: [n.f.id] }));
    // Étiquettes : les extrêmes, et le cluster discuté dans le brief.
    const tries = [...noeuds].sort((a, b) => a.f.entropie - b.f.entropie);
    const marques = [...tries.slice(0, 2), ...tries.slice(-3), noeuds.find((n) => n.f.id === 32), noeuds.find((n) => n.f.id === 58)].filter(Boolean);
    const poses = [];
    for (const n of marques) {
      const haut = n.y < h / 2 + 6;
      let y = haut ? n.y - n.r - 8 : n.y + n.r + 14;
      const ancre = n.x > l - 120 ? "end" : n.x < 120 ? "start" : "middle";
      while (poses.some((p) => Math.abs(p.y - y) < 13 && Math.abs(p.x - n.x) < 150)) y += haut ? -13 : 13;
      poses.push({ x: n.x, y });
      svg.append("text").attr("class", "graphe etiquette").attr("x", n.x).attr("y", y).attr("text-anchor", ancre)
        .attr("font-size", 11).attr("fill", "#1b1a17").attr("paint-order", "stroke").attr("stroke", "#f5f3ee").attr("stroke-width", 3)
        .text(`${n.f.label} ${decimal(n.f.entropie, 2)}`);
    }
    outils(zone, {
      svg: () => svg.node(),
      nom: "spine-691-melange-familles.png",
      titre: "Du canal au sujet partagé : indice de mélange des quatre familles",
      sousTitre: "Entropie normalisée des parts Media, Officials, Vectors, Influencers ; couleur : famille dominante ; surface : images",
      donnees: () => [this.d.clusters.map((f) => ({ id: f.id, label: f.label, entropie: decimal(f.entropie, 3), dominante: FAMILLES[f.dominante], part: decimal(f.part_dominante * 100, 1), n: f.n })),
        [["id", "cluster_id"], ["label", "label"], ["entropie", "mélange (0-1)"], ["dominante", "famille dominante"], ["part", "part dominante (%)"], ["n", "images"]]],
    });
  }

  active() {}
}
