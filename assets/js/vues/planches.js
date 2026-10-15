// Vue Planches contact : un cluster se comprend en regardant ses images.
//
// Le vocabulaire est celui du tirage contact : vues numérotées sur fond noir,
// dans l'ordre où l'éditeur photo les lirait (ici : certitude HDBSCAN
// décroissante). Les archives et les musées présentent ainsi leurs fonds depuis
// longtemps ; voir SOURCES.md (Whitelaw, PixPlot, planches Magnum).

import { etat } from "../etat.js";
import { entier, pct, jourCourt, mediane, html, plie, accord, minuteLongue, enLettres } from "../format.js";
import { FAMILLES, barreComposition } from "../couleurs.js";
import { LOGIQUES, REGIMES } from "../textes.js";
import { ouvre as ouvreVisionneuse } from "../ui/visionneuse.js";

const TRIS = [
  ["certitude", "Certitude"],
  ["date", "Date"],
  ["engagement", "Engagements"],
];

export default class VuePlanches {
  constructor(el, donnees, navigue) {
    this.el = el;
    this.d = donnees;
    this.nav = navigue;
    el.classList.add("vue-planches", "vue--plein");
    el.innerHTML = `
      <aside class="planches__choix" aria-label="Choisir un cluster">
        <div class="panneau__entete">
          <h3>Planches contact</h3>
          <input type="search" class="champ" id="filtre-planches" placeholder="Filtrer…" style="width:100%" aria-label="Filtrer les clusters">
          <p class="petit discret" style="margin:6px 0 0">Chiffre : images disponibles en local, 10 % de chaque cluster.</p>
        </div>
        <ul class="liste-clusters" id="liste-planches"></ul>
      </aside>
      <div class="planches__contenu" id="contenu-planches"></div>`;
    this.liste();
    el.querySelector("#filtre-planches").addEventListener("input", (e) => this.liste(e.target.value));
    el.querySelector("#liste-planches").addEventListener("click", (e) => {
      const b = e.target.closest("[data-planche]");
      if (!b) return;
      const id = b.dataset.planche === "" ? null : Number(b.dataset.planche);
      etat.change({ planche: id });
    });
    etat.ecoute(["planche", "colonnes", "triPlanche", "avantApres"], (changees) => {
      this.contenu();
      if (changees.includes("planche")) {
        this.liste(el.querySelector("#filtre-planches").value);
        el.querySelector("#contenu-planches").scrollTop = 0;
      }
    });
    this.contenu();
  }

  liste(filtre = "") {
    const q = plie(filtre.trim());
    const actif = etat.get("planche");
    const fiches = [...this.d.clusters].sort((a, b) => b.n - a.n).filter((f) => !q || plie(`${f.label} ${f.voit} ${f.id}`).includes(q));
    this.el.querySelector("#liste-planches").innerHTML = `
      <li><button type="button" data-planche="" class="${actif === null ? "survol" : ""}"><span class="id">∗</span><span><strong>Le mur des 64 planches</strong></span><span class="nb"></span></button></li>
      ${fiches.map((f) => `<li><button type="button" data-planche="${f.id}" class="${actif === f.id ? "survol" : ""}" ${actif === f.id ? 'aria-current="true"' : ""}>
        <span class="id">${f.id}</span><span>${html(f.label)}</span><span class="nb">${entier(f.echantillon.length)}</span>${barreComposition(f.parts)}</button></li>`).join("")}`;
  }

  contenu() {
    const id = etat.get("planche");
    if (id === null || !this.d.fiche(id) || id < 0) this.mur();
    else this.planche(this.d.fiche(id));
  }

  // ------------------------------------------------------------------ Le mur
  mur() {
    const zone = this.el.querySelector("#contenu-planches");
    const groupes = ["sujet", "genre", "gabarit"].map((l) => [l, this.d.clusters.filter((f) => f.logique === l).sort((a, b) => b.n - a.n)]);
    zone.innerHTML = `
      <header class="page__entete" style="max-width:1100px">
        <span class="kicker">Vue 5 · Planches contact</span>
        <h2>Les noms disent le sujet ; les planches montrent que CLIP range aussi des formats et des chartes graphiques</h2>
        <p class="chapeau">Les neuf images les plus centrales de chaque cluster, rangées selon ce que le cluster regroupe vraiment
          (lecture manuelle des images). Cliquez une planche pour l'ouvrir en grand. Les 4&#8239;859 images du dépôt sont les 10 %
          les plus certaines de chaque cluster : on voit le cœur des clusters, pas leurs bords.</p>
      </header>
      ${groupes.map(([l, fiches]) => `
        <section class="bloc">
          <h3>${LOGIQUES[l].nom.charAt(0).toUpperCase() + LOGIQUES[l].nom.slice(1)}s · ${enLettres(fiches.length)} clusters, ${entier(fiches.reduce((s, f) => s + f.n, 0))} images</h3>
          <p class="chapeau petit">${LOGIQUES[l].definition}</p>
          <div class="planches-mur">${fiches.map((f) => `
            <button type="button" class="mur__item" data-ouvre="${f.id}" aria-label="Ouvrir la planche ${html(f.label)}">
              <div class="mini-planche">${f.echantillon.slice(0, 9).map((r) => {
                const e = this.d.echantillon[r];
                return `<span style="aspect-ratio:1;overflow:hidden;display:block;background:#121110"><img src="${this.d.vignette(e)}" alt="" loading="lazy" decoding="async" width="64" height="64" style="width:100%;height:100%;object-fit:cover;display:block"></span>`;
              }).join("")}</div>
              <div class="mur__legende"><strong>${html(f.label)}</strong><span class="num">${entier(f.n)}</span></div>
            </button>`).join("")}</div>
        </section>`).join("")}
      <section class="bloc" id="doublons"></section>`;
    zone.querySelectorAll("[data-ouvre]").forEach((b) => b.addEventListener("click", () => etat.change({ planche: Number(b.dataset.ouvre) })));
    this.doublons(zone.querySelector("#doublons"));
  }

  /** Détecteur de quasi-doublons : même image (dHash à 4 bits près), posts distincts. */
  doublons(zone) {
    const p = this.d.p;
    const groupes = [...this.d.groupes.values()].map((g) => {
      const minutes = g.map((e) => p.minute[e.point]);
      const posts = new Set(g.map((e) => p.post[e.point]));
      return { g, n: g.length, posts: posts.size, debut: Math.min(...minutes), fin: Math.max(...minutes), cluster: g[0].cluster };
    }).sort((a, b) => b.n - a.n || (b.fin - b.debut) - (a.fin - a.debut));
    const t = this.d.meta.totaux;
    const distincts = groupes.filter((g) => g.posts === g.n).length;
    zone.innerHTML = `
      <h3>La même image, des posts différents : ${entier(t.groupes_doublons)} groupes de quasi-doublons dans l'échantillon</h3>
      <p class="chapeau">Les 65&#8239;229 fichiers ont tous un nom différent, mais une empreinte perceptuelle (dHash, 64 bits, au plus ${this.d.meta.echantillon.seuil_doublon_bits} bits d'écart)
        retrouve ${entier(t.images_en_doublon)} images qui sont la même à quelques pixels près. ${entier(distincts)} groupes sur ${entier(groupes.length)} sont faits de posts tous distincts :
        photos d'agence reprises par plusieurs comptes, visuels génériques réutilisés (« Alerte info »), images d'une même émission.</p>
      <p class="reserve">Calculé sur les 4&#8239;859 images locales seulement : les 90 % restants ne sont pas dans le dépôt. Et les comptes auteurs n'étant pas dans les données,
        on ne peut pas dire si deux copies viennent du même compte ou de deux comptes différents.</p>
      <div class="repertoire" style="margin-top:14px">${groupes.slice(0, 12).map((g, k) => `
        <div class="repertoire__item">
          <div class="mini-planche" style="grid-template-columns:repeat(4,1fr)">${g.g.slice(0, 4).map((e, j) => `
            <button type="button" data-groupe="${k}" data-k="${j}" aria-label="Agrandir"><img src="${this.d.vignette(e)}" alt="" loading="lazy" width="56" height="56"></button>`).join("")}</div>
          <h4>${enLettres(g.n)} copies, ${accord(g.posts, "post")}</h4>
          <p>${html(this.d.fiche(g.cluster).label)} · ${g.fin - g.debut < 1440
            ? `en ${entier(Math.max(1, Math.round((g.fin - g.debut) / 60)))} h, le ${jourCourt(Math.floor(g.debut / 1440))}`
            : `du ${jourCourt(Math.floor(g.debut / 1440))} au ${jourCourt(Math.floor(g.fin / 1440))}`}</p>
        </div>`).join("")}</div>`;
    zone.querySelectorAll("[data-groupe]").forEach((b) => b.addEventListener("click", () => {
      const g = groupes[Number(b.dataset.groupe)];
      ouvreVisionneuse(g.g, Number(b.dataset.k));
    }));
  }

  // ------------------------------------------------------------------ Une planche
  ordre(f) {
    const p = this.d.p;
    const images = f.echantillon.map((r) => this.d.echantillon[r]);
    const tri = etat.get("triPlanche");
    if (tri === "date") images.sort((a, b) => p.minute[a.point] - p.minute[b.point]);
    if (tri === "engagement") images.sort((a, b) => p.eng[b.point] - p.eng[a.point]);
    return images;
  }

  planche(f) {
    const zone = this.el.querySelector("#contenu-planches");
    const p = this.d.p;
    const v = etat.valeurs;
    const images = this.ordre(f);
    const groupesIci = new Set(images.filter((e) => e.groupe >= 0).map((e) => e.groupe));
    const enDoublon = images.filter((e) => e.groupe >= 0).length;
    const regime = REGIMES[f.regime];
    zone.innerHTML = `
      <div class="planche-titre">
        <div>
          <span class="kicker">Planche · cluster ${f.id} · <span class="etiquette-logique etiquette-logique--${f.logique}">${f.logique}</span></span>
          <h2>${html(f.label)}</h2>
        </div>
        <div style="display:flex;gap:6px">
          <button type="button" class="bouton bouton--discret" data-action="carte">Voir sur la carte</button>
          <button type="button" class="bouton bouton--discret" data-action="temps">Courbe</button>
          <button type="button" class="bouton bouton--discret" data-action="mur">Le mur</button>
        </div>
      </div>
      <p class="fiche__voit" style="margin:6px 0 4px">${html(f.voit)}</p>
      ${f.note ? `<p class="note-lecture"><strong>Le label trompe.</strong> ${html(f.note)}</p>` : ""}
      <p class="petit discret">${accord(images.length, "image locale", "images locales")} sur ${entier(f.n)} · ${FAMILLES[f.dominante]} ${pct(f.part_dominante, 0)} ·
        médiane ${mediane(f.eng.mediane)} engagements par post · pic le ${jourCourt(f.pic)} (${pct(f.pct_pic / 100, 0)}), régime ${regime.nom.toLowerCase()}
        ${groupesIci.size ? ` · ${accord(groupesIci.size, "groupe")} de quasi-doublons (${enDoublon} images, signalées ×n)` : ""}</p>
      <div class="planche__outils">
        <label class="interrupteur">Vignettes par ligne <input type="range" min="3" max="12" step="1" value="${v.colonnes}" id="colonnes-planche" style="width:110px"> <span class="num">${v.colonnes}</span></label>
        <span class="carte__groupe"><span class="libelle">Ordre</span><span class="segments">${TRIS.map(([k, l]) => `<button type="button" data-tri="${k}" aria-pressed="${v.triPlanche === k}">${l}</button>`).join("")}</span></span>
        <label class="interrupteur" title="Sépare les images du jour de pic de celles du reste du mois"><input type="checkbox" id="avant-apres" ${v.avantApres ? "checked" : ""}> Jour du pic contre le reste</label>
      </div>
      <div id="planche-corps"></div>
      <p class="source-graphe" style="margin-top:12px">Ordre « certitude » : probabilité HDBSCAN décroissante, puis proximité du point le plus dense du cluster.
        Numéros de vue en bas à gauche ; en bas à droite, ${v.triPlanche === "engagement" ? "les engagements du post" : "la date de publication"}.
        ${v.avantApres ? "" : "Cadre blanc : image publiée le jour du pic."}</p>`;

    const corps = zone.querySelector("#planche-corps");
    if (v.avantApres) {
      const duPic = images.filter((e) => Math.floor(p.minute[e.point] / 1440) === f.pic);
      const reste = images.filter((e) => Math.floor(p.minute[e.point] / 1440) !== f.pic);
      corps.innerHTML = `<div class="avant-apres">
        <div><h4>Le jour du pic, ${jourCourt(f.pic)} · ${accord(duPic.length, "image")}</h4>${this.grille(duPic, Math.max(3, Math.round(v.colonnes / 2)))}</div>
        <div><h4>Le reste du mois · ${accord(reste.length, "image")}</h4>${this.grille(reste, Math.max(3, Math.round(v.colonnes / 2)))}</div></div>`;
      corps.querySelectorAll(".planche").forEach((pl, k) => this.branche(pl, k === 0 ? duPic : reste));
    } else {
      corps.innerHTML = this.grille(images, v.colonnes);
      this.branche(corps.querySelector(".planche"), images);
    }

    zone.querySelector("#colonnes-planche").addEventListener("input", (e) => etat.change({ colonnes: Number(e.target.value) }));
    zone.querySelectorAll("[data-tri]").forEach((b) => b.addEventListener("click", () => etat.change({ triPlanche: b.dataset.tri })));
    zone.querySelector("#avant-apres").addEventListener("change", (e) => etat.change({ avantApres: e.target.checked }));
    zone.querySelector('[data-action="carte"]').addEventListener("click", () => this.nav("carte", { sel: f.id, iso: [f.id] }));
    zone.querySelector('[data-action="temps"]').addEventListener("click", () => this.nav("temps", { focus: f.id }));
    zone.querySelector('[data-action="mur"]').addEventListener("click", () => etat.change({ planche: null }));
  }

  grille(images, colonnes) {
    if (!images.length) return `<div class="vide"><strong>Aucune image</strong>L'échantillon local ne contient pas d'image pour cette sélection.</div>`;
    const p = this.d.p;
    const tri = etat.get("triPlanche");
    const taillesGroupes = new Map();
    for (const e of images) if (e.groupe >= 0) taillesGroupes.set(e.groupe, this.d.groupes.get(e.groupe).length);
    const f = this.d.fiche(images[0].cluster);
    return `<div class="planche" style="--colonnes:${colonnes}">${images.map((e, k) => {
      const jour = Math.floor(p.minute[e.point] / 1440);
      const droite = tri === "engagement" ? `${entier(p.eng[e.point])} eng.` : `${String(jour + 1).padStart(2, "0")}/09`;
      return `<figure class="vue-image${jour === f.pic && !etat.get("avantApres") ? " vue-image--pic" : ""}">
        <button type="button" data-k="${k}" aria-label="Vue ${k + 1}, ${minuteLongue(p.minute[e.point])}"><img src="${this.d.vignette(e)}" alt="" loading="lazy" decoding="async" width="${e.vl}" height="${e.vh}"></button>
        ${e.groupe >= 0 ? `<span class="vue-image__doublon" title="Quasi-doublon : la même image apparaît ${taillesGroupes.get(e.groupe)} fois dans l'échantillon">×${taillesGroupes.get(e.groupe)}</span>` : ""}
        <figcaption><span>${k + 1}</span><span>${droite}</span></figcaption>
      </figure>`;
    }).join("")}</div>`;
  }

  branche(planche, images) {
    planche?.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-k]");
      if (b) ouvreVisionneuse(images, Number(b.dataset.k));
    });
  }

  active() {}

  clavier(e) {
    if (e.key === "Escape" && etat.get("planche") !== null) { etat.change({ planche: null }); return true; }
    return false;
  }
}
