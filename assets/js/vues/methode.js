// Vue Méthode et sources : la chaîne de traitement, les données, chaque
// événement annoté avec sa source, et les références qui fondent les choix.

import { entier, pct, jourCourt, html } from "../format.js";
import { REFERENCES } from "../references.js";

export default class VueMethode {
  constructor(el, donnees) {
    const m = donnees.meta;
    const t = m.totaux;
    const genere = new Date(m.genere_le);
    el.innerHTML = `
      <div class="page">
        <header class="page__entete">
          <span class="kicker">Méthode et sources</span>
          <h2>Comment ces ${entier(t.images)} images ont été rangées, et d'où vient chaque affirmation de ce dashboard</h2>
          <p class="chapeau">Analyse 691 « Topic-mining-SPINE-France », lancée le 14 octobre 2026 sur six importations de comptes X,
            du 1<sup>er</sup> au 29 septembre 2026 (29 jours pleins). SPINE observe le discours public français : qui parle, ce qui circule,
            et comment les contenus se répètent entre acteurs qui ne se coordonnent pas officiellement.</p>
        </header>

        <section class="bloc">
          <h3>La chaîne de traitement</h3>
          <div class="chaine">
            <div><span class="kicker">1 · vectorisation</span><h4>CLIP ViT-H-14</h4>
              <code>laion/CLIP-ViT-H-14-laion2B-s32B-b79K</code>
              <p class="petit">Chaque image devient un vecteur où la proximité reflète la ressemblance de sens, pas de pixels.
                Deux photos d'une même scène sont proches ; deux images de mêmes couleurs mais de sujets différents ne le sont pas.
                Le texte incrusté compte : CLIP le lit, ce qui explique les clusters de gabarits.</p></div>
            <div><span class="kicker">2 · projection</span><h4>UMAP en deux dimensions</h4>
              <code>n_neighbors=15  min_dist=0.0
n_components=2  metric=cosine
n_epochs=2500  learning_rate=0.5
random_state=42</code>
              <p class="petit">min_dist = 0 autorise les points à se tasser : des amas compacts et bien séparés, faits pour le clustering plutôt que pour la beauté du nuage.
                random_state = 42 rend les coordonnées reproductibles.</p></div>
            <div><span class="kicker">3 · regroupement</span><h4>HDBSCAN</h4>
              <code>min_samples=6  min_cluster_size=défaut
metric=euclidean
cluster_selection_method=eom
soft clustering désactivé</code>
              <p class="petit">HDBSCAN ne force aucune affectation : un point hors de toute zone dense est classé bruit (−1). Chaque point classé reçoit
                une probabilité d'appartenance, de 1 au cœur à 0 sur les bords ; c'est elle qui règle l'opacité des points de la carte.</p></div>
          </div>
        </section>

        <section class="bloc colonnes colonnes--2">
          <div>
            <h3>Ce que contient le dépôt</h3>
            <table class="tableau-simple" style="width:100%">
              <tbody>
                <tr><td>Images</td><td class="n">${entier(t.images)}</td><td class="discret petit">une ligne par image dans les CSV</td></tr>
                <tr><td>Posts</td><td class="n">${entier(t.posts)}</td><td class="discret petit">dont ${entier(t.posts_multi_images)} portent 2 à 4 images</td></tr>
                <tr><td>Clusters</td><td class="n">${t.clusters}</td><td class="discret petit">de 207 à 7&#8239;111 images</td></tr>
                <tr><td>Non classées</td><td class="n">${entier(t.bruit)}</td><td class="discret petit">${pct(t.bruit / t.images)} du corpus</td></tr>
                <tr><td>Engagements</td><td class="n">${entier(t.engagements_par_post)}</td><td class="discret petit">un par post ; ${entier(t.engagements_par_image)} si l'on somme par image</td></tr>
                <tr><td>Images locales</td><td class="n">${entier(t.images_locales)}</td><td class="discret petit">10 % les plus certaines de chaque cluster, en vignettes WebP de 256 px</td></tr>
                <tr><td>Quasi-doublons</td><td class="n">${entier(t.groupes_doublons)}</td><td class="discret petit">groupes, ${entier(t.images_en_doublon)} images (dHash, ≤ ${m.echantillon.seuil_doublon_bits} bits)</td></tr>
              </tbody>
            </table>
            <p class="petit discret" style="margin-top:10px">Données générées le ${genere.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              à ${genere.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} par <code>scripts/build_data.py</code>, puis revérifiées
              contre les CSV d'origine par <code>scripts/verifier_build.py</code>. Empreintes SHA-256 des fichiers d'entrée :</p>
            <ul class="petit mono" style="padding-left:16px;color:var(--encre-2)">${Object.entries(m.entrees).map(([f, h]) => `<li>${html(f)} · ${h.slice(0, 12)}…</li>`).join("")}</ul>
          </div>
          <div>
            <h3>Les quatre familles d'acteurs</h3>
            <p class="petit">Le corpus est construit à partir de six listes de comptes constituées à la main : médias ; élus et partis, institutions, groupes d'intérêt
              (réunis sous Officials) ; vecteurs ; influenceurs. Le croisement cluster × famille a été produit depuis la base de données
              (<code>brief/data-derivee/cluster_x_famille.csv</code>) ; il ne peut pas être recalculé à partir des CSV du dépôt, qui ne disent pas de quelle liste vient chaque image.</p>
            <h3 style="margin-top:18px">Lecture manuelle des clusters</h3>
            <p class="petit">La « logique » (sujet, genre, gabarit), la phrase « ce qu'on voit » et les notes sur les labels viennent d'une lecture des images les plus centrales
              de chaque cluster, consignée dans <code>annotations/lecture_clusters.csv</code>. C'est une annotation d'analyste, pas une donnée : vous pouvez la contester planche à l'appui.</p>
          </div>
        </section>

        <section class="bloc">
          <h3>Les ${donnees.evenements.length} événements annotés, et leurs sources</h3>
          <p class="chapeau">Règle : chaque annotation porte au moins une source ouverte et relue le 15 octobre 2026. Sans source fiable, pas d'annotation.
            Fichier : <code>annotations/evenements.json</code>.</p>
          <ol class="liste-sources">${donnees.evenements.map((e) => `
            <li><span class="date">${jourCourt(e.jour)}</span><span><strong>${html(e.titre)}.</strong> ${html(e.texte)}
              <span class="discret">Clusters : ${e.clusters.map((c) => html(donnees.fiche(c).label)).join(", ")}.</span><br>
              ${e.sources.map((s) => `<a href="${html(s.url)}" target="_blank" rel="noopener">${html(s.editeur)} · ${html(s.titre)} ↗</a>`).join("<br>")}</span></li>`).join("")}
          </ol>
        </section>

        <section class="bloc">
          <h3>Ce qui fonde les choix de ce dashboard</h3>
          <p class="chapeau">Recherches menées pour ce travail : état de l'art de la visualisation de grands nuages de points et de collections d'images,
            pratiques des archives et de la presse de données. Pour chaque référence, ce que j'en ai retenu.</p>
          <div class="colonnes colonnes--2">${REFERENCES.map((g) => `
            <div><h4 class="pc" style="font-size:12px;margin:0 0 6px">${html(g.theme)}</h4>
              <ul class="liste-sources">${g.items.map((r) => `<li style="grid-template-columns:1fr"><span>
                <a href="${html(r.url)}" target="_blank" rel="noopener"><strong>${html(r.titre)}</strong></a> · ${html(r.auteurs)}, ${html(r.publication)}<br>
                <span class="discret">${html(r.retenu)}</span></span></li>`).join("")}</ul></div>`).join("")}
          </div>
        </section>

        <section class="bloc colonnes colonnes--2">
          <div>
            <h3>Régénérer les données</h3>
            <pre class="mono petit" style="background:var(--papier-2);padding:10px 12px;white-space:pre-wrap">python brief/verifier_donnees.py
python scripts/build_vignettes.py
python scripts/build_data.py
python scripts/verifier_build.py</pre>
            <p class="petit">Python 3.10 ou plus, avec numpy et Pillow. Le détail est dans le README.</p>
          </div>
          <div>
            <h3>Partager un écran</h3>
            <p class="petit">Tout l'état de l'interface vit dans l'adresse de la page : vue, couleurs, clusters isolés, date de la séquence, cadrage de la carte,
              tri et recherche du tableau, regroupement manuel. Le bouton « Copier le lien » (raccourci <kbd>L</kbd>) copie cette adresse. Les graphiques s'exportent en PNG,
              avec leur titre et leur source ; le tableau se copie vers un tableur ou s'exporte en CSV ; la séquence s'enregistre en vidéo.</p>
          </div>
        </section>
      </div>`;
  }

  active() {}
}
