// Vue « Ce que la méthode rate ».
//
// Un analyste fait plus confiance à un outil qui montre ses limites. Chaque
// limite est chiffrée, illustrée, et dit ce qu'elle change à la lecture.

import { etat } from "../etat.js";
import { entier, decimal, pct, mediane, jourCourt, html, enLettres } from "../format.js";
import { FAMILLES } from "../couleurs.js";
import * as infobulle from "../ui/infobulle.js";
import { outils } from "../ui/graphe.js";
import { ouvre as ouvreVisionneuse } from "../ui/visionneuse.js";

export default class VueLimites {
  constructor(el, donnees, navigue) {
    this.el = el;
    this.d = donnees;
    this.nav = navigue;
    const t = donnees.meta.totaux;
    const b = donnees.bruit;
    const jours = donnees.meta.jours;
    const partsBruit = jours.map((j) => j.bruit / j.images);
    const vide = donnees.clusters.filter((f) => f.eng.mediane <= 1).sort((a, b2) => b2.n - a.n);
    const imagesVide = vide.reduce((s, f) => s + f.n, 0);
    const gabarits = donnees.clusters.filter((f) => f.logique === "gabarit").sort((a, b2) => b2.n - a.n);
    const notes = donnees.clusters.filter((f) => f.note && f.note.startsWith("Le label dit"));
    const evtsParCluster = new Map();
    for (const e of donnees.evenements) for (const c of e.clusters) {
      if (!evtsParCluster.has(c)) evtsParCluster.set(c, []);
      evtsParCluster.get(c).push(e.jour);
    }
    const nonExpliques = donnees.clusters.filter((f) => f.pic_sur_mediane >= 3.5 && !(evtsParCluster.get(f.id) || []).includes(f.pic))
      .sort((a, b2) => b2.pic_sur_mediane - a.pic_sur_mediane);
    const nuls = t.proba_nulle_hors_bruit || {};
    const tirage = donnees.meta.echantillon.tirage;

    el.innerHTML = `
      <div class="page">
        <header class="page__entete">
          <span class="kicker">Vue 7 · Ce que la méthode rate</span>
          <h2>Ce que ce clustering ne sait pas faire, chiffré, pour lire le reste avec les bonnes réserves</h2>
          <p class="chapeau">CLIP, UMAP et HDBSCAN rangent des images par ressemblance visuelle. Ils ne savent rien du sens, des comptes ni de l'actualité.
            Voici où cela se voit dans ce corpus, et ce que chaque limite change à la lecture des autres vues.</p>
        </header>

        <section class="limite">
          <span class="limite__num">1 · le bruit</span>
          <h3>Un quart des images n'est rangé nulle part, et ce n'est pas du déchet</h3>
          <div class="colonnes colonnes--2">
            <div>
              <p>HDBSCAN laisse de côté ce qui n'appartient à aucune zone dense : <strong>${entier(b.n)} images</strong>, ${pct(b.n / t.images)} du corpus,
                issues de ${entier(b.posts)} posts. Le fichier source les nomme « DELETE » ; ici, « non classées ».</p>
              <p>Elles ne sont pas moins reprises que les autres : médiane de <strong>${mediane(b.eng.mediane)} engagements par post</strong>, comme le corpus entier
                (${mediane(t.mediane_engagement_post)}). Le post le plus engageant de tout le corpus (${entier(b.eng.max)} engagements) n'est dans aucun cluster.</p>
              <p>Leur part reste stable d'un jour à l'autre, entre ${pct(Math.min(...partsBruit), 0)} et ${pct(Math.max(...partsBruit), 0)} : le bruit ne trahit pas un événement que la méthode aurait raté.
                Il trahit des images trop singulières pour former un groupe, et il touche d'abord les Influencers.</p>
              <p><button type="button" class="bouton bouton--discret" id="voir-bruit">Afficher le bruit sur la carte</button></p>
            </div>
            <div class="graphe" id="bruit-familles"></div>
          </div>
          <p class="reserve">Le dépôt ne contient aucune image du bruit : on ne peut pas regarder ce qu'il y a dedans, seulement ses chiffres.</p>
        </section>

        <section class="limite">
          <span class="limite__num">2 · l'échantillon d'images</span>
          <h3>Les images du dépôt montrent le début du mois : ${pct(tirage.part_4_premiers_jours, 0)} ont été publiées du 1<sup>er</sup> au 4 septembre</h3>
          <div class="colonnes colonnes--2">
            <div>
              <p>Le brief décrit les ${entier(t.images_locales)} images locales comme « les 10 % les plus représentatifs de chaque cluster, sélectionnés par probabilité décroissante ».
                C'est vrai, mais incomplet : ${pct(tirage.part_points_classes_proba_1, 0)} des points classés ont une probabilité de 1, bien plus que 10 %.
                Le tirage s'est donc départagé ailleurs, et les données le montrent sans ambiguïté : dans les ${tirage.clusters_tires_par_plus_petits_id} clusters sur 64,
                les images locales sont exactement les plus petits <code>document_id</code> parmi les points de probabilité 1.</p>
              <p>Or <code>document_id</code> suit l'ordre de publication (corrélation ${decimal(tirage.correlation_id_date, 3)}).
                L'échantillon est donc daté : plus de la moitié des images des trois premiers jours sont en local, presque aucune après le 23,
                aucune le jour d'un pic événementiel.</p>
              <p><strong>Ce que cela change.</strong> Les planches contact, les vignettes de la carte et les quasi-doublons décrivent le début du mois.
                Les lectures des clusters (« ce qu'on voit ») aussi. Les chiffres, les courbes et la carte, eux, portent sur les ${entier(t.images)} images : ils ne sont pas touchés.</p>
              <p><strong>Pour la prochaine extraction</strong> : tirer l'échantillon au hasard parmi les points de probabilité 1, ou le stratifier par jour (10 % de chaque cluster et de chaque jour).</p>
            </div>
            <div class="graphe" id="biais-echantillon"></div>
          </div>
        </section>

        <section class="limite">
          <span class="limite__num">3 · un événement, trois clusters</span>
          <h3>La visite du pape est rangée sur les deux continents de la carte : vignettes titrées d'un côté, photos de l'autre</h3>
          <p class="chapeau">Visite de Léon XIV (4), Pape Catholique (13) et Visite Papale (14) culminent les 25 et 26 septembre. HDBSCAN les sépare par le format,
            pas par le sujet : le 4 rassemble des vignettes d'articles titrées et se trouve parmi les images faites de texte ; le 13 (portraits)
            et le 14 (scènes de cérémonie) sont parmi les photographies. Seuls ${this.copublies([4, 13, 14])} posts mélangent deux de ces clusters.</p>
          <div class="colonnes colonnes--3" id="trois-papes"></div>
          <div class="bloc" style="margin-top:22px" id="regroupement"></div>
        </section>

        <section class="limite">
          <span class="limite__num">4 · des chartes, pas des sujets</span>
          <h3>${enLettres(gabarits.length).charAt(0).toUpperCase() + enLettres(gabarits.length).slice(1)} clusters regroupent la charte graphique d'un éditeur plutôt qu'un sujet</h3>
          <p class="chapeau">CLIP voit la mise en page autant que le contenu : bandeau, logo, typographie. Quand un média publie toutes ses vignettes sur le même gabarit,
            le cluster capte ce gabarit. Actualités Régionales n'est pas « l'actualité régionale » : ce sont les cartes Hérault Tribune.
            Ces ${enLettres(gabarits.length)} clusters font ${entier(gabarits.reduce((s, f) => s + f.n, 0))} images, ${pct(gabarits.reduce((s, f) => s + f.n, 0) / t.images)} du corpus.</p>
          <div class="repertoire" id="gabarits"></div>
        </section>

        <section class="limite">
          <span class="limite__num">5 · la production à vide</span>
          <h3>${enLettres(vide.length).charAt(0).toUpperCase() + enLettres(vide.length).slice(1)} clusters ont une médiane d'au plus un engagement par post : ${entier(imagesVide)} images, ${pct(imagesVide / t.images)} du corpus</h3>
          <p class="chapeau">Une partie mesurable de la production médiatique ne rencontre personne. Ce sont surtout des flux d'éditeurs (gabarits) et des visuels
            de culture populaire publiés en série. Ce n'est pas une limite de la méthode : c'est un résultat. Mais il pèse sur tout classement par volume.</p>
          <table class="tableau-simple"><thead><tr><th>Cluster</th><th>Logique</th><th class="n">Images</th><th class="n">Médiane</th><th class="n">Posts à 0</th><th>Famille dominante</th></tr></thead>
            <tbody>${vide.map((f) => `<tr><td>${html(f.label)}</td><td>${f.logique}</td><td class="n">${entier(f.n)}</td><td class="n">${mediane(f.eng.mediane)}</td><td class="n">${pct(f.eng.part_zero, 0)}</td>
              <td><span class="fam fam--${FAMILLES[f.dominante]}">${FAMILLES[f.dominante]} ${pct(f.part_dominante, 0)}</span></td></tr>`).join("")}</tbody></table>
        </section>

        <section class="limite">
          <span class="limite__num">6 · les engagements</span>
          <h3>Sommés par image, les engagements comptent ${entier(t.posts_multi_images)} posts deux à quatre fois</h3>
          <p>Le champ <code>engagements</code> est celui du post, recopié sur chacune de ses images. ${entier(t.images_dans_posts_multi)} images (${pct(t.images_dans_posts_multi / t.images)})
            appartiennent à un post qui en porte plusieurs. La somme par image vaut ${entier(t.engagements_par_image)} ; la somme par post, la seule qui ait un sens,
            vaut <strong>${entier(t.engagements_par_post)}</strong> (${pct(t.engagements_par_image / t.engagements_par_post - 1, 1)} d'écart).
            L'écart frappe les clusters où l'on publie en albums : Cérémonies Commémoratives (90 % de ses images viennent d'albums), Réunions Institutionnelles, Rencontres Citoyennes.
            Tout ce dashboard compte un engagement par post, et le résume par la médiane.</p>
          <p class="reserve">On ne sait pas laquelle des images d'un album a fait réagir : l'engagement d'un post de quatre images est attribué aux quatre.</p>
        </section>

        <section class="limite">
          <span class="limite__num">7 · des labels qui trompent</span>
          <h3>${enLettres(notes.length).charAt(0).toUpperCase() + enLettres(notes.length).slice(1)} labels décrivent mal ce que montrent les images</h3>
          <p class="chapeau">Les labels ont été produits automatiquement puis revus. À la lecture des images les plus centrales, certains nomment un sujet que les images ne montrent pas.
            Les labels d'origine sont conservés partout ; la correction est signalée dans la fiche de chaque cluster.</p>
          <table class="tableau-simple"><thead><tr><th>Label</th><th>Ce que montrent les images</th></tr></thead>
            <tbody>${notes.map((f) => `<tr><td style="white-space:nowrap"><strong>${html(f.label)}</strong></td><td>${html(f.note.replace(/^Le label dit « [^»]+ » : /, ""))}</td></tr>`).join("")}</tbody></table>
        </section>

        <section class="limite">
          <span class="limite__num">8 · lire la carte</span>
          <h3>Sur la carte UMAP, la position dit « ressemble à », pas « est proche de »</h3>
          <ul>
            <li><strong>Les distances entre clusters ne se lisent pas</strong> comme des distances : UMAP préserve les voisinages, pas les écarts lointains. Deux clusters éloignés ne sont pas forcément « opposés ».</li>
            <li><strong>min_dist = 0</strong> : la projection a été réglée pour tasser les points, ce qui sert le clustering mais produit des amas plus compacts et plus séparés qu'ils ne le sont dans l'espace d'origine.</li>
            <li><strong>La taille d'un amas ne mesure pas sa diversité</strong> : un cluster serré peut contenir des images variées, un cluster étalé des images très semblables.</li>
            <li><strong>Le placement est reproductible</strong> (random_state = 42) : les coordonnées ne bougent pas d'une ouverture à l'autre.</li>
            <li>${Object.entries(nuls).map(([c, n]) => `<strong>${entier(n)} points d'${html(this.d.fiche(Number(c)).label)}</strong> ont une probabilité d'appartenance nulle tout en étant rattachés au cluster`).join(" ; ") || "Aucun point rattaché avec une probabilité nulle"} :
              HDBSCAN les place à la frontière. Le curseur « Certitude » de la carte les masque dès 0,05.</li>
          </ul>
          <p class="reserve">Ces règles de lecture viennent de la littérature sur les projections de type t-SNE et UMAP (voir Méthode et sources).</p>
        </section>

        <section class="limite">
          <span class="limite__num">9 · des pics sans explication</span>
          <h3>${enLettres(nonExpliques.length).charAt(0).toUpperCase() + enLettres(nonExpliques.length).slice(1)} pics marqués ne sont pas annotés : je n'ai pas trouvé de source qui les date</h3>
          <p class="chapeau">Règle suivie : pas de source fiable, pas d'annotation. Quand un événement sourcé tombe quelques jours avant le pic, la correspondance n'est pas forcée.</p>
          <table class="tableau-simple"><thead><tr><th>Cluster</th><th class="n">Pic</th><th class="n">× médiane</th><th class="n">Au pic</th><th>Événement voisin annoté</th></tr></thead>
            <tbody>${nonExpliques.map((f) => {
              const voisins = (evtsParCluster.get(f.id) || []).filter((j) => Math.abs(j - f.pic) <= 4);
              return `<tr><td>${html(f.label)}</td><td class="n">${jourCourt(f.pic)}</td><td class="n">×${decimal(f.pic_sur_mediane, 1)}</td><td class="n">${pct(f.pct_pic / 100, 0)}</td>
                <td>${voisins.length ? voisins.map((j) => `le ${jourCourt(j)}, ${f.pic - j > 0 ? `${f.pic - j} j avant le pic` : `${j - f.pic} j après`}`).join(", ") : "aucun"}</td></tr>`;
            }).join("")}</tbody></table>
        </section>

        <section class="limite">
          <span class="limite__num">10 · ce qui n'est pas dans les données</span>
          <h3>Ce que ce dashboard ne peut pas montrer, et ne simule pas</h3>
          <ul class="liste-absences">
            <li><strong>Le compte auteur</strong> de chaque post : impossible de dire qui publie une image, ni si deux quasi-doublons viennent du même compte.</li>
            <li><strong>La famille d'acteurs au niveau de l'image</strong> : elle n'est connue qu'agrégée par cluster. Aucune image n'est colorée par famille.</li>
            <li><strong>Le texte des posts</strong> : aucune recherche plein texte n'est possible sur ce qui accompagne les images.</li>
            <li><strong>Vues, likes, partages séparés</strong> : seul le total d'engagements du post est fourni.</li>
            <li><strong>Les images du bruit</strong> et les <strong>90 % d'images non échantillonnées</strong> : leur point existe sur la carte, pas leur image.</li>
            <li><strong>Le fuseau horaire</strong> des dates : les heures sont affichées telles que fournies.</li>
          </ul>
          <p>Avec ces données en plus, j'aurais construit un graphe de circulation entre comptes à partir des quasi-doublons, croisé les familles au niveau de l'image,
            et comparé les clusters au texte des posts pour séparer ce qui est montré de ce qui est dit. Détail dans <code>LIMITES.md</code>.</p>
        </section>
      </div>`;

    el.querySelector("#voir-bruit").addEventListener("click", () => this.nav("carte", { bruit: true, iso: [], sel: null, cadrage: null }));
    this.bruitFamilles();
    this.biaisEchantillon();
    this.troisPapes();
    this.regroupement();
    this.gabarits(gabarits);
    etat.ecoute(["groupe"], () => this.regroupement());
  }

  copublies(ids) {
    const parPost = new Map();
    for (const id of ids) for (const i of this.d.parCluster[id + 1]) {
      const post = this.d.p.post[i];
      if (!parPost.has(post)) parPost.set(post, new Set());
      parPost.get(post).add(id);
    }
    let n = 0;
    for (const s of parPost.values()) if (s.size > 1) n++;
    return n;
  }

  bruitFamilles() {
    const zone = this.el.querySelector("#bruit-familles");
    const fam = this.d.familles;
    const moyen = this.d.bruit.n / this.d.n;
    const l = 480, h = 190, m = { g: 96, d: 50, h: 28, b: 24 };
    const y = d3.scaleBand().domain(FAMILLES).range([m.h, h - m.b]).padding(0.32);
    const x = d3.scaleLinear().domain([0, 0.45]).range([m.g, l - m.d]);
    const svg = d3.select(zone).append("svg").attr("viewBox", `0 0 ${l} ${h}`).attr("width", "100%").attr("role", "img").attr("aria-label", "Part des images non classées par famille");
    svg.append("text").attr("class", "titre-axe").attr("x", m.g).attr("y", 12).text("Part des images de chaque famille laissées dans le bruit");
    svg.append("line").attr("x1", x(moyen)).attr("x2", x(moyen)).attr("y1", m.h - 6).attr("y2", h - m.b + 4).attr("stroke", "#1b1a17").attr("stroke-width", 1);
    svg.append("text").attr("class", "titre-axe").attr("x", x(moyen) + 4).attr("y", h - 6).text(`corpus ${pct(moyen)}`);
    fam.forEach((f) => {
      svg.append("text").attr("x", m.g - 8).attr("y", y(f.nom) + y.bandwidth() / 2 + 4).attr("text-anchor", "end").attr("font-size", 12).attr("fill", "#1b1a17").text(f.nom);
      svg.append("rect").attr("x", x(0)).attr("y", y(f.nom)).attr("width", x(f.taux_bruit) - x(0)).attr("height", y.bandwidth()).attr("fill", f.couleur)
        .attr("rx", 0)
        .on("pointerenter pointermove", (ev) => infobulle.montre(`<strong>${f.nom}</strong><div class="infobulle__valeur">${pct(f.taux_bruit)}</div><div class="discret">${entier(f.bruit)} images non classées sur ${entier(f.images)}</div>`, ev.clientX, ev.clientY))
        .on("pointerleave", () => infobulle.cache({ force: true }));
      svg.append("text").attr("x", x(f.taux_bruit) + 5).attr("y", y(f.nom) + y.bandwidth() / 2 + 4).attr("font-size", 11.5).attr("font-weight", f.taux_bruit > moyen * 1.3 ? 700 : 400).attr("fill", "#1b1a17").text(pct(f.taux_bruit));
    });
    outils(zone, {
      svg: () => svg.node(), nom: "spine-691-bruit-par-famille.png", titre: "Part des images non classées, par famille d'acteurs",
      donnees: () => [fam.map((f) => ({ famille: f.nom, images: f.images, bruit: f.bruit, taux: decimal(f.taux_bruit * 100, 1) })),
        [["famille", "famille"], ["images", "images"], ["bruit", "non classées"], ["taux", "taux (%)"]]],
    });
  }

  /** Part des images classées de chaque jour qui sont disponibles en local. */
  biaisEchantillon() {
    const zone = this.el.querySelector("#biais-echantillon");
    const tirage = this.d.meta.echantillon.tirage;
    const parts = tirage.part_par_jour;
    const l = 480, h = 210, m = { g: 40, d: 10, h: 30, b: 26 };
    const x = d3.scaleBand().domain(d3.range(29)).range([m.g, l - m.d]).paddingInner(0.2);
    const y = d3.scaleLinear().domain([0, 0.7]).range([h - m.b, m.h]);
    const svg = d3.select(zone).append("svg").attr("viewBox", `0 0 ${l} ${h}`).attr("width", "100%").attr("role", "img")
      .attr("aria-label", "Part des images classées de chaque jour disponibles en local");
    svg.append("text").attr("class", "titre-axe").attr("x", m.g).attr("y", 12).text("Part des images classées de chaque jour disponibles en local");
    svg.append("g").attr("class", "grille").selectAll("line").data([0.2, 0.4, 0.6]).join("line")
      .attr("x1", m.g).attr("x2", l - m.d).attr("y1", (v) => y(v)).attr("y2", (v) => y(v));
    svg.append("g").attr("class", "axe").selectAll("text").data([0, 0.2, 0.4, 0.6]).join("text")
      .attr("x", m.g - 6).attr("y", (v) => y(v) + 3.5).attr("text-anchor", "end").text((v) => pct(v, 0));
    svg.append("line").attr("x1", m.g).attr("x2", l - m.d).attr("y1", y(0.1)).attr("y2", y(0.1)).attr("stroke", "#1b1a17").attr("stroke-width", 1);
    svg.append("text").attr("class", "titre-axe").attr("x", l - m.d).attr("y", y(0.1) - 5).attr("text-anchor", "end").text("10 % attendus si l'échantillon suivait le mois");
    svg.append("g").selectAll("rect").data(parts).join("rect")
      .attr("x", (_, j) => x(j)).attr("width", x.bandwidth()).attr("y", (v) => y(v)).attr("height", (v) => y(0) - y(v)).attr("fill", "#1b1a17")
      .on("pointerenter pointermove", (ev, v) => {
        const j = parts.indexOf(v);
        infobulle.montre(`<div class="infobulle__valeur">${pct(v, 1)}</div><div class="discret">${jourCourt(j)} : ${entier(tirage.images_par_jour[j])} images locales</div>`, ev.clientX, ev.clientY);
      })
      .on("pointerleave", () => infobulle.cache({ force: true }));
    svg.append("g").attr("class", "axe").selectAll("text.j").data([0, 6, 13, 20, 27]).join("text")
      .attr("x", (j) => x(j) + x.bandwidth() / 2).attr("y", h - 8).attr("text-anchor", "middle").text((j) => (j === 0 ? "1er" : j + 1));
    outils(zone, {
      svg: () => svg.node(), nom: "spine-691-biais-echantillon.png", titre: "Les images du dépôt montrent le début du mois",
      sousTitre: "Part des images classées de chaque jour disponibles en local (échantillon de 4 859 images)",
      donnees: () => [parts.map((v, j) => ({ jour: `2026-09-${String(j + 1).padStart(2, "0")}`, locales: tirage.images_par_jour[j], part: decimal(v * 100, 1) })),
        [["jour", "jour"], ["locales", "images locales"], ["part", "part des images classées (%)"]]],
    });
  }

  troisPapes() {
    const zone = this.el.querySelector("#trois-papes");
    zone.innerHTML = [4, 13, 14].map((id) => {
      const f = this.d.fiche(id);
      const images = f.echantillon.slice(0, 9).map((r) => this.d.echantillon[r]);
      return `<div>
        <div class="mini-planche">${images.map((e, k) => `<button type="button" data-c="${id}" data-k="${k}" aria-label="Agrandir"><img src="${this.d.vignette(e)}" alt="" loading="lazy" width="90" height="90"></button>`).join("")}</div>
        <h4 style="font:500 16px/1.25 var(--serif);margin:8px 0 2px">${html(f.label)} <span class="mono discret" style="font-size:11px">${f.id}</span></h4>
        <p class="petit discret" style="margin:0">${html(f.voit)}<br>${entier(f.n)} images · pic le ${jourCourt(f.pic)} (${pct(f.pct_pic / 100, 0)}) · ${FAMILLES[f.dominante]} ${pct(f.part_dominante, 0)}</p>
      </div>`;
    }).join("");
    zone.querySelectorAll("[data-c]").forEach((b) => b.addEventListener("click", () => {
      const f = this.d.fiche(Number(b.dataset.c));
      ouvreVisionneuse(f.echantillon.map((r) => this.d.echantillon[r]), Number(b.dataset.k));
    }));
  }

  /** Regrouper des clusters à la main : statistiques recalculées sur les points, un engagement par post. */
  regroupement() {
    const zone = this.el.querySelector("#regroupement");
    const ids = etat.get("groupe").filter((id) => this.d.fiche(id) && id >= 0);
    const options = [...this.d.clusters].sort((a, b) => a.label.localeCompare(b.label, "fr"));
    const s = ids.length ? this.d.statsEngagement(ids) : null;
    const serie = ids.length ? this.d.serie(ids) : new Array(29).fill(0);
    const pic = serie.indexOf(Math.max(...serie));
    const rang = s ? this.d.clusters.filter((f) => f.n > s.images).length + 1 : null;
    zone.innerHTML = `
      <h3 style="font-size:18px">Regrouper à la main</h3>
      <p class="chapeau petit">Choisissez des clusters à fusionner : effectifs, médiane par post et courbe sont recalculés à partir des points, chaque post comptant une fois.
        Le regroupement est dans l'adresse de la page : copiez le lien pour le partager.</p>
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:12px">
        ${ids.map((id) => `<button type="button" class="bouton bouton--discret" data-retire="${id}" title="Retirer">${html(this.d.fiche(id).label)} ✕</button>`).join("")}
        <select class="champ" id="ajout-groupe" aria-label="Ajouter un cluster au regroupement"><option value="">+ ajouter un cluster…</option>
          ${options.filter((f) => !ids.includes(f.id)).map((f) => `<option value="${f.id}">${html(f.label)}</option>`).join("")}</select>
        <button type="button" class="lien-bouton petit" id="groupe-papal">trois clusters papaux</button>
      </div>
      ${s ? `<div class="colonnes colonnes--2-1">
        <div class="graphe" id="courbe-groupe"></div>
        <div class="fiche__chiffres" style="margin:0">
          <div><div class="chiffre__val num">${entier(s.images)}</div><div class="chiffre__lib">images ; ce serait le ${rang}<sup>e</sup> cluster du corpus</div></div>
          <div><div class="chiffre__val num">${entier(s.posts)}</div><div class="chiffre__lib">posts distincts</div></div>
          <div><div class="chiffre__val num">${mediane(s.mediane)}</div><div class="chiffre__lib">engagements médians par post</div></div>
          <div><div class="chiffre__val">${jourCourt(pic)}</div><div class="chiffre__lib">jour de pic, ${pct(serie[pic] / s.images)} des images</div></div>
          <div style="grid-column:1/3"><button type="button" class="bouton" id="groupe-carte">Voir le regroupement sur la carte</button></div>
        </div></div>` : `<p class="vide"><strong>Aucun cluster choisi</strong>Ajoutez au moins un cluster pour voir le regroupement.</p>`}`;
    zone.querySelectorAll("[data-retire]").forEach((b) => b.addEventListener("click", () => etat.change({ groupe: ids.filter((i) => i !== Number(b.dataset.retire)) })));
    zone.querySelector("#ajout-groupe").addEventListener("change", (e) => { if (e.target.value !== "") etat.change({ groupe: [...ids, Number(e.target.value)] }); });
    zone.querySelector("#groupe-papal").addEventListener("click", () => etat.change({ groupe: [4, 13, 14] }));
    zone.querySelector("#groupe-carte")?.addEventListener("click", () => this.nav("carte", { iso: ids, sel: ids[0] }));
    if (!s) return;

    // Courbe : une ligne par cluster du groupe, plus le total.
    const l = 640, h = 200, m = { g: 40, d: 120, h: 14, b: 24 };
    const x = d3.scaleLinear().domain([0, 28]).range([m.g, l - m.d]);
    const y = d3.scaleLinear().domain([0, d3.max(serie)]).nice(4).range([h - m.b, m.h]);
    const svg = d3.select(zone.querySelector("#courbe-groupe")).append("svg").attr("viewBox", `0 0 ${l} ${h}`).attr("width", "100%").attr("role", "img").attr("aria-label", "Images par jour du regroupement");
    svg.append("g").attr("class", "grille").selectAll("line").data(y.ticks(4)).join("line").attr("x1", m.g).attr("x2", l - m.d).attr("y1", (v) => y(v)).attr("y2", (v) => y(v));
    svg.append("g").attr("class", "axe").attr("transform", `translate(${m.g - 6},0)`).call(d3.axisLeft(y).ticks(4).tickSize(0).tickFormat((v) => entier(v))).call((g) => g.select(".domain").remove());
    const ligne = d3.line().x((_, j) => x(j)).y((v) => y(v)).curve(d3.curveMonotoneX);
    const gris = ["#8a8476", "#6f695d", "#b0a998", "#5a554b", "#a39d90"];
    // Noms en bout de courbe, écartés verticalement pour ne pas se chevaucher.
    const bouts = ids.map((id, k) => ({ f: this.d.fiche(id), k, y: y(this.d.fiche(id).serie[28]) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < bouts.length; i++) bouts[i].y = Math.max(bouts[i].y, bouts[i - 1].y + 12);
    const debord = bouts.length ? bouts[bouts.length - 1].y - (h - m.b) : 0;
    if (debord > 0) bouts.forEach((b) => { b.y -= debord; });
    for (const { f, k, y: yb } of bouts) {
      svg.append("path").attr("d", ligne(f.serie)).attr("fill", "none").attr("stroke", gris[k % gris.length]).attr("stroke-width", 1.2);
      svg.append("line").attr("x1", x(28) + 1).attr("x2", l - m.d + 4).attr("y1", y(f.serie[28])).attr("y2", yb - 3).attr("stroke", "#a9a191").attr("stroke-width", 0.6);
      svg.append("text").attr("x", l - m.d + 6).attr("y", yb).attr("font-size", 10).attr("fill", "#4a463e").text(f.label.length > 18 ? `${f.label.slice(0, 17)}…` : f.label);
    }
    svg.append("path").attr("d", ligne(serie)).attr("fill", "none").attr("stroke", "#1b1a17").attr("stroke-width", 2);
    svg.append("text").attr("x", x(pic)).attr("y", y(serie[pic]) - 6).attr("text-anchor", "middle").attr("font-size", 11).attr("font-weight", 700).attr("fill", "#1b1a17").text(`ensemble : ${entier(serie[pic])}`);
    svg.append("g").attr("class", "axe").selectAll("text").data([0, 6, 13, 20, 27]).join("text").attr("x", (j) => x(j)).attr("y", h - 6).attr("text-anchor", "middle").text((j) => (j === 0 ? "1er sept." : j + 1));
  }

  gabarits(liste) {
    const zone = this.el.querySelector("#gabarits");
    zone.innerHTML = liste.map((f) => {
      const images = f.echantillon.slice(0, 6).map((r) => this.d.echantillon[r]);
      return `<div class="repertoire__item">
        <div class="mini-planche" style="grid-template-columns:repeat(3,1fr)">${images.map((e, k) => `<button type="button" data-c="${f.id}" data-k="${k}" aria-label="Agrandir"><img src="${this.d.vignette(e)}" alt="" loading="lazy" width="76" height="76"></button>`).join("")}</div>
        <h4>${html(f.label)}</h4>
        <p>${html(f.voit)} · ${entier(f.n)} images · médiane ${mediane(f.eng.mediane)}</p>
      </div>`;
    }).join("");
    zone.querySelectorAll("[data-c]").forEach((b) => b.addEventListener("click", () => {
      const f = this.d.fiche(Number(b.dataset.c));
      ouvreVisionneuse(f.echantillon.map((r) => this.d.echantillon[r]), Number(b.dataset.k));
    }));
  }

  active() {}
}
