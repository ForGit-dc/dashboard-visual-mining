// Vue « Les 64 clusters » : le tableau que les analystes utiliseront le plus.
// Triable sur toutes les colonnes, filtrable avec opérateurs, copiable et
// exportable. Chaque nom de cluster est un lien vers sa fiche sur la carte.

import { etat } from "../etat.js";
import { entier, decimal, pct, ratio, mediane, jourCourt, html, accord } from "../format.js";
import { FAMILLES, barreComposition } from "../couleurs.js";
import { REGIMES, LOGIQUES } from "../textes.js";
import { courbe } from "../ui/mini.js";
import { filtre } from "../ui/recherche.js";
import { enTsv, enCsv } from "../ui/graphe.js";
import { copie, telecharge } from "../ui/notifier.js";
import { versURL } from "../etat.js";

// [clé, titre, unité, numérique, valeur de tri, valeur d'export]
const COLONNES = [
  ["id", "#", "", true, (f) => f.id],
  ["label", "Cluster", "et ce qu'on y voit", false, (f) => f.label],
  ["logique", "Logique", "", false, (f) => f.logique ?? ""],
  ["n", "Images", "part du corpus", true, (f) => f.n],
  ["posts", "Posts", "", true, (f) => f.posts],
  ["mediane", "Médiane", "eng. par post", true, (f) => f.eng.mediane],
  ["q90", "9e décile", "eng. par post", true, (f) => f.eng.q90],
  ["premier", "1er post", "part des eng.", true, (f) => f.eng.part_premier],
  ["dominante", "Famille dominante", "barre : les quatre", false, (f) => `${FAMILLES[f.dominante]} ${1 - f.part_dominante}`],
  ["melange", "Mélange", "0 à 1", true, (f) => f.entropie],
  ["vectors", "Vectors", "× poids moyen", true, (f) => f.ratios[2]],
  ["pic", "Pic", "", true, (f) => f.pic],
  ["concentration", "Au pic", "des images", true, (f) => f.pct_pic],
  ["regime", "Régime", "", false, (f) => f.regime ?? ""],
  ["jours", "Jours", "actifs / 29", true, (f) => f.jours_actifs],
  ["serie", "1er–29 septembre", "images par jour", false, null],
];

export default class VueClusters {
  constructor(el, donnees, navigue) {
    this.el = el;
    this.d = donnees;
    this.nav = navigue;
    el.innerHTML = `
      <div class="page page--large">
        <header class="page__entete">
          <span class="kicker">Vue 6 · Les 64 clusters</span>
          <h2>Faits Divers pèse 7&#8239;111 images et une médiane d'un engagement par post : le classement par volume trompe</h2>
          <p class="chapeau">Un cluster par ligne. Cliquez un en-tête pour trier, un nom pour ouvrir la fiche sur la carte.
            Les engagements sont comptés une fois par post, même quand le post porte quatre images, et résumés par la médiane :
            avec un maximum à 158&#8239;396 et une médiane à 10, une moyenne ne décrirait aucun post réel.</p>
        </header>
        <div class="tableau-outils">
          <input type="search" class="champ" id="recherche-clusters" placeholder="ex. famille:vectors images>300 -football" aria-label="Rechercher des clusters" spellcheck="false" autocomplete="off">
          <span class="petit" id="compte-clusters"></span>
          <label class="interrupteur"><input type="checkbox" id="avec-bruit"> Afficher les non classées</label>
          <span style="margin-left:auto;display:flex;gap:6px">
            <button type="button" class="bouton bouton--discret" id="copier-tableau" title="Copier les lignes affichées, collables dans un tableur">Copier le tableau</button>
            <button type="button" class="bouton bouton--discret" id="csv-tableau">Télécharger le CSV</button>
          </span>
          <p class="aide-recherche">Opérateurs : <code>pape OU football</code> · <code>-football</code> · <code>"faits divers"</code> ·
            <code>famille:vectors</code> · <code>logique:gabarit</code> · <code>regime:evenementiel</code> · <code>pic:25</code> ·
            <code>images&gt;1000</code> · <code>mediane&gt;=20</code> · <code>vectors&gt;2</code> · <code>melange&gt;0.8</code>.
            Accents et majuscules ignorés. Raccourci : <kbd>/</kbd>.</p>
        </div>
        <div class="tableau-cadre"><table class="donnees" id="tableau-clusters"></table></div>
        <div class="colonnes colonnes--2" style="margin-top:28px">
          <dl class="petit" style="margin:0;display:grid;grid-template-columns:auto 1fr;gap:6px 14px">
            <dt><strong>Logique</strong></dt><dd>Lecture manuelle des images les plus centrales : ${Object.values(LOGIQUES).map((l) => `<em>${l.nom}</em>, ${l.definition.charAt(0).toLowerCase()}${l.definition.slice(1)}`).join(" ")}</dd>
            <dt><strong>Médiane, 9<sup>e</sup> décile</strong></dt><dd>Engagements du post, un post comptant une fois par cluster. La moitié des posts du cluster font moins que la médiane, 10 % font plus que le décile.</dd>
            <dt><strong>1<sup>er</sup> post</strong></dt><dd>Part des engagements du cluster apportée par son post le plus engageant. Au-delà de 25 %, le total ne dit rien du cluster.</dd>
          </dl>
          <dl class="petit" style="margin:0;display:grid;grid-template-columns:auto 1fr;gap:6px 14px">
            <dt><strong>Mélange</strong></dt><dd>Entropie des parts des quatre familles, ramenée entre 0 (une seule famille publie : un canal) et 1 (quatre familles à parts égales : un sujet partagé).</dd>
            <dt><strong>Vectors</strong></dt><dd>Part des Vectors dans le cluster, divisée par leur part dans tout le corpus (13,2 %). ×4,6 : quatre fois et demie leur poids habituel.</dd>
            <dt><strong>Au pic, régime</strong></dt><dd>Part des images du cluster publiées son jour le plus actif. Régimes : ${Object.values(REGIMES).map((r) => `<em>${r.nom.toLowerCase()}</em> : ${r.definition}`).join(" ; ")}.</dd>
          </dl>
        </div>
      </div>`;

    this.champ = el.querySelector("#recherche-clusters");
    this.champ.value = etat.get("q");
    this.champ.addEventListener("input", () => etat.change({ q: this.champ.value }));
    el.querySelector("#avec-bruit").checked = etat.get("avecBruit");
    el.querySelector("#avec-bruit").addEventListener("change", (e) => etat.change({ avecBruit: e.target.checked }));
    el.querySelector("#copier-tableau").addEventListener("click", () => {
      const [lignes, cols] = this.exportables();
      copie(enTsv(lignes, cols), `${accord(lignes.length, "ligne")} copiées, collables dans un tableur.`);
    });
    el.querySelector("#csv-tableau").addEventListener("click", () => {
      const [lignes, cols] = this.exportables();
      telecharge(new Blob([enCsv(lignes, cols)], { type: "text/csv;charset=utf-8" }), "spine-691-clusters.csv");
    });
    this.table = el.querySelector("#tableau-clusters");
    this.table.addEventListener("click", (e) => {
      const tri = e.target.closest("[data-tri]");
      if (tri) {
        const cle = tri.dataset.tri;
        const sens = etat.get("tri") === cle && etat.get("sens") === "desc" ? "asc" : "desc";
        etat.change({ tri: cle, sens });
        return;
      }
      if (e.target.closest("a")) return;
      const ligne = e.target.closest("tr[data-cluster]");
      if (ligne) this.ouvre(Number(ligne.dataset.cluster));
    });
    etat.ecoute(["q", "tri", "sens", "avecBruit"], () => this.rend());
    this.rend();
  }

  ouvre(id) {
    if (id < 0) { this.nav("limites"); return; }
    this.nav("carte", { sel: id, iso: [id] });
  }

  lignes() {
    const v = etat.valeurs;
    const { resultats, erreurs } = filtre(this.d.clusters, v.q);
    const col = COLONNES.find(([cle]) => cle === v.tri) ?? COLONNES[3];
    const valeur = col[4];
    const tries = [...resultats].sort((a, b) => {
      const x = valeur(a), y = valeur(b);
      const c = typeof x === "string" ? x.localeCompare(y, "fr") : x - y;
      return v.sens === "asc" ? c : -c;
    });
    if (v.avecBruit) tries.push(this.d.bruit);
    return { tries, erreurs, total: resultats.length };
  }

  rend() {
    const v = etat.valeurs;
    const { tries, erreurs, total } = this.lignes();
    const compte = this.el.querySelector("#compte-clusters");
    compte.innerHTML = erreurs.length
      ? `<span style="color:#cf3d2e">⚠</span> ${html(erreurs.join(", "))}`
      : (v.q ? `${accord(total, "cluster")} sur 64` : "64 clusters");
    const maxN = Math.max(...this.d.clusters.map((f) => f.n));
    const maxSerie = null;

    const entete = `<thead><tr>${COLONNES.map(([cle, titre, unite, num, tri]) => {
      const sort = v.tri === cle ? (v.sens === "asc" ? "ascending" : "descending") : "none";
      const contenu = tri ? `<button type="button" data-tri="${cle}">${titre}</button>` : titre;
      return `<th class="${num ? "n" : ""}" aria-sort="${sort}" scope="col">${contenu}${unite ? `<span class="unite">${unite}</span>` : ""}</th>`;
    }).join("")}</tr></thead>`;

    if (!tries.length) {
      this.table.innerHTML = `${entete}<tbody><tr><td colspan="${COLONNES.length}"><div class="vide"><strong>Aucun cluster ne correspond</strong>
        à « ${html(v.q)} ». Les opérateurs sont listés au-dessus du tableau ; essayez sans filtre de champ, ou avec <code>OU</code>.</div></td></tr></tbody>`;
      return;
    }
    const corps = tries.map((f) => {
      const bruit = f.id === -1;
      const lien = bruit ? "#/limites" : versURL({ ...etat.valeurs, vue: "carte", sel: f.id, iso: [f.id], q: "", tri: "n", sens: "desc", avecBruit: false });
      const regime = f.regime ? REGIMES[f.regime].nom : "—";
      return `<tr data-cluster="${f.id}" class="${bruit ? "bruit" : ""}">
        <td class="n mono discret">${bruit ? "−1" : f.id}</td>
        <td class="label"><a href="${lien}">${html(bruit ? "Non classées (bruit HDBSCAN)" : f.label)}</a><small>${html(bruit ? "images qu'aucun cluster n'a retenues : voir « Ce que la méthode rate »" : f.voit)}</small></td>
        <td>${f.logique ? `<span class="etiquette-logique etiquette-logique--${f.logique}">${f.logique}</span>` : ""}</td>
        <td class="n">${entier(f.n)}<span class="barre" style="width:${Math.max(1, (36 * f.n) / maxN).toFixed(1)}px"></span><br><span class="discret">${pct(f.part)}</span></td>
        <td class="n">${entier(f.posts)}</td>
        <td class="n"><strong>${mediane(f.eng.mediane)}</strong></td>
        <td class="n">${entier(f.eng.q90)}</td>
        <td class="n${f.eng.part_premier >= 0.25 ? "" : " discret"}">${pct(f.eng.part_premier, 0)}</td>
        <td><div style="display:flex;flex-direction:column;gap:4px;min-width:150px"><span class="fam fam--${FAMILLES[f.dominante]}">${FAMILLES[f.dominante]} <span class="num discret">${pct(f.part_dominante, 0)}</span></span>${barreComposition(f.parts)}</div></td>
        <td class="n">${decimal(f.entropie, 2)}</td>
        <td class="n${f.ratios[2] >= 2 ? "" : " discret"}">${f.ratios[2] >= 2 ? `<strong>${ratio(f.ratios[2])}</strong>` : ratio(f.ratios[2])}</td>
        <td class="n nw">${jourCourt(f.pic)}</td>
        <td class="n nw">${pct(f.pct_pic / 100, 1)}</td>
        <td>${regime}</td>
        <td class="n">${f.jours_actifs}</td>
        <td>${courbe(f.serie, { largeur: 120, hauteur: 22, max: maxSerie, weekend: true })}</td>
      </tr>`;
    }).join("");
    this.table.innerHTML = `${entete}<tbody>${corps}</tbody>`;
  }

  exportables() {
    const { tries } = this.lignes();
    const cols = [
      ["id", "cluster_id"], ["label", "label"], ["logique", "logique (lecture manuelle)"], ["voit", "ce qu'on voit"],
      ["n", "images"], ["part", "part du corpus (%)"], ["posts", "posts"],
      ["mediane", "médiane engagements par post"], ["q90", "9e décile engagements par post"], ["premier", "part du 1er post (%)"],
      ["somme", "engagements (un par post)"], ["dominante", "famille dominante"], ["part_dom", "part dominante (%)"],
      ["media", "Media"], ["officials", "Officials"], ["vectors", "Vectors"], ["influencers", "Influencers"],
      ["melange", "mélange (entropie 0-1)"], ["ratio_vectors", "Vectors / poids moyen"],
      ["pic", "jour de pic"], ["au_pic", "part au pic (%)"], ["regime", "régime"], ["jours", "jours actifs"], ["serie", "images par jour (1er-29 sept.)"],
    ];
    const n = (v, d = 1) => decimal(v, d);
    const lignes = tries.map((f) => ({
      id: f.id, label: f.id === -1 ? "Non classées (bruit)" : f.label, logique: f.logique ?? "", voit: f.voit ?? "",
      n: f.n, part: n(f.part * 100, 2), posts: f.posts, mediane: n(f.eng.mediane, 1), q90: n(f.eng.q90, 1),
      premier: n(f.eng.part_premier * 100, 1), somme: f.eng.somme_posts, dominante: FAMILLES[f.dominante],
      part_dom: n(f.part_dominante * 100, 1), media: f.familles[0], officials: f.familles[1], vectors: f.familles[2], influencers: f.familles[3],
      melange: n(f.entropie, 3), ratio_vectors: n(f.ratios[2], 2), pic: `2026-09-${String(f.pic + 1).padStart(2, "0")}`,
      au_pic: n(f.pct_pic, 1), regime: f.regime ? REGIMES[f.regime].nom : "", jours: f.jours_actifs, serie: f.serie.join("|"),
    }));
    return [lignes, cols];
  }

  active() {
    this.champ.value = etat.get("q");
  }
}
