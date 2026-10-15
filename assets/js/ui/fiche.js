// Fiche d'un cluster : ce qu'on voit, les chiffres qui comptent (avec leur
// dénominateur), la composition par famille, les 29 jours, la planche.

import { entier, decimal, pct, ratio, mediane, jourCourt, html, accord } from "../format.js";
import { FAMILLES, barreComposition } from "../couleurs.js";
import { REGIMES, LOGIQUES } from "../textes.js";
import { courbe } from "./mini.js";

function rangMediane(donnees, f) {
  const plusHautes = donnees.clusters.filter((c) => c.eng.mediane > f.eng.mediane).length;
  return plusHautes + 1;
}

function lectureMelange(h) {
  if (h < 0.25) return "un canal : une seule famille publie";
  if (h < 0.55) return "une famille domine nettement";
  if (h < 0.75) return "dominante nette, mais partagée";
  return "un sujet partagé entre familles";
}

/**
 * Construit la fiche. actions : { retour, planche, temps, selectionne(id), image(entrees, i) }
 */
export function construitFiche(donnees, f, actions) {
  const el = document.createElement("article");
  el.className = "fiche";
  const evts = donnees.evenements.filter((e) => e.clusters.includes(f.id));
  const regime = REGIMES[f.regime];
  const logique = LOGIQUES[f.logique];
  const premieres = f.echantillon.slice(0, 9).map((r) => donnees.echantillon[r]);
  const rang = rangMediane(donnees, f);
  const autres = f.copublication.filter(([id]) => id >= 0).slice(0, 3);
  const bruitCopub = f.copublication.find(([id]) => id === -1);

  el.innerHTML = `
    <div class="fiche__retour">
      <button type="button" class="lien-bouton" data-action="retour">← Tous les clusters</button>
      <span class="mono discret">cluster ${f.id}</span>
    </div>
    <span class="etiquette-logique etiquette-logique--${f.logique}" title="${html(logique.definition)}">${logique.nom}</span>
    <h3>${html(f.label)}</h3>
    <p class="fiche__voit">${html(f.voit)}</p>
    ${f.note ? `<p class="note-lecture"><strong>Le label trompe.</strong> ${html(f.note)}</p>` : ""}

    <div class="fiche__chiffres">
      <div><div class="chiffre__val num">${entier(f.n)}</div>
        <div class="chiffre__lib">images, ${pct(f.part)} du corpus<br>${accord(f.posts, "post")}</div></div>
      <div><div class="chiffre__val num">${mediane(f.eng.mediane)}</div>
        <div class="chiffre__lib">engagements médians par post, ${rang}<sup>e</sup> sur 64<br>9<sup>e</sup> décile : ${entier(f.eng.q90)}</div></div>
      <div><div class="chiffre__val">${jourCourt(f.pic)}</div>
        <div class="chiffre__lib">jour de pic, ${pct(f.pct_pic / 100)} des images</div></div>
      <div><div class="chiffre__val">${regime.nom}</div>
        <div class="chiffre__lib">${f.jours_actifs} jours actifs sur 29</div></div>
    </div>

    <section class="fiche__section">
      <h4>Qui publie</h4>
      ${barreComposition(f.parts, { haute: true })}
      <div class="compo-detail">
        ${FAMILLES.map((fam, i) => `
          <span class="fam fam--${fam}">${fam}</span>
          <span class="num">${entier(f.familles[i])}</span>
          <span class="num">${pct(f.parts[i], 1)}</span>
          <span class="ratio num${f.ratios[i] >= 2 ? " fort" : ""}" title="Part dans ce cluster rapportée à la part de la famille dans le corpus">${ratio(f.ratios[i])}</span>`).join("")}
      </div>
      <p class="petit discret" style="margin-top:8px">Mélange : ${decimal(f.entropie, 2)} sur 1 (entropie des quatre parts), ${lectureMelange(f.entropie)}. ×1 = poids de la famille dans tout le corpus.</p>
    </section>

    <section class="fiche__section">
      <h4>Images par jour</h4>
      ${courbe(f.serie, { largeur: 330, hauteur: 46, jours: evts.map((e) => e.jour), weekend: true })}
      <p class="petit discret" style="margin:4px 0 0">Du 1<sup>er</sup> au 29 septembre. Bandes grises : week-ends. Point : jour de pic.${evts.length ? " Traits : événements sourcés." : ""}</p>
      ${evts.length ? `<ul class="liste-sources" style="margin-top:6px">${evts.map((e) => `
        <li><span class="date">${jourCourt(e.jour)}</span>
          <span>${html(e.titre)}. <a href="${html(e.sources[0].url)}" target="_blank" rel="noopener">${html(e.sources[0].editeur)} ↗</a></span></li>`).join("")}</ul>` : ""}
    </section>

    <section class="fiche__section">
      <h4>Les ${premieres.length} images les plus centrales</h4>
      <div class="mini-planche">${premieres.map((e, k) => `
        <button type="button" data-k="${k}" aria-label="Agrandir l'image ${k + 1}"><img src="${donnees.vignette(e)}" alt="" loading="lazy" decoding="async" width="110" height="110"></button>`).join("")}</div>
      <p class="petit discret" style="margin-top:6px">${accord(f.echantillon.length, "image locale", "images locales")} sur ${entier(f.n)} : les 10 % les plus certaines du cluster.</p>
    </section>

    ${f.eng.part_premier >= 0.25 ? `<p class="note-lecture">Un seul post pèse <strong>${pct(f.eng.part_premier, 0)}</strong> des engagements de ce cluster (${entier(f.eng.max)}). Lisez la médiane, pas le total.</p>` : ""}

    ${autres.length ? `<section class="fiche__section">
      <h4>Publié dans les mêmes posts que</h4>
      <ul class="liste-clusters">${autres.map(([id, nb]) => {
        const o = donnees.fiche(id);
        return `<li><button type="button" data-cluster="${id}"><span class="id">${id}</span><span>${html(o.label)}</span><span class="nb">${accord(nb, "post")}</span></button></li>`;
      }).join("")}</ul>
      ${bruitCopub ? `<p class="petit discret" style="margin-top:6px">Et ${accord(bruitCopub[1], "post")} avec des images non classées.</p>` : ""}
    </section>` : ""}

    <div class="fiche__liens">
      <button type="button" class="bouton" data-action="planche">Planche complète</button>
      <button type="button" class="bouton bouton--discret" data-action="temps">Courbe détaillée</button>
    </div>`;

  el.querySelector('[data-action="retour"]').addEventListener("click", actions.retour);
  el.querySelector('[data-action="planche"]').addEventListener("click", () => actions.planche(f.id));
  el.querySelector('[data-action="temps"]').addEventListener("click", () => actions.temps(f.id));
  el.querySelectorAll(".mini-planche button").forEach((b) =>
    b.addEventListener("click", () => actions.image(premieres, Number(b.dataset.k))));
  el.querySelectorAll("[data-cluster]").forEach((b) =>
    b.addEventListener("click", () => actions.selectionne(Number(b.dataset.cluster))));
  return el;
}
