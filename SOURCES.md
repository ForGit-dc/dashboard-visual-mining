# Sources

Toutes les références externes du dashboard : d'abord les événements datés qui
annotent les pics de clusters, puis les travaux qui fondent les choix de
conception. Chaque lien a été ouvert et relu le 15 octobre 2026.

La même liste est lisible dans le dashboard, vue « Méthode et sources ».
`scripts/verifier_build.py` vérifie que chaque source d'événement de
`annotations/evenements.json` figure ici.

---

## 1. Événements annotés

Règle : une annotation n'existe que si au moins une source fiable la date.
Les pics restés sans source sont listés dans `LIMITES.md` et dans la vue
« Ce que la méthode rate ».

| date | événement | clusters | source |
|---|---|---|---|
| 15/09 | Journée de mobilisation intersectorielle : santé, énergie, police, enseignement supérieur, étudiants | Manifestations Sociales | France 3 Occitanie, 14/09/2026 : [Étudiants, policiers, salariés du secteur de la santé : grève et journée de mobilisation, à quoi s'attendre ce mardi ?](https://france3-regions.franceinfo.fr/occitanie/herault/montpellier/etudiants-policiers-salaries-du-secteur-de-la-sante-greve-et-journee-de-mobilisation-a-quoi-s-attendre-ce-mardi-3416861.html) |
| 18/09 | Record historique du gazole : 2,39 € le litre (Prix-carburants.gouv.fr, via l'AFP) | Prix des Carburants | L'EnerGeek, 18/09/2026 : [Carburant : le prix du gazole atteint un record historique](https://lenergeek.com/2026/09/18/carburant-prix-gazole-atteint-record/) |
| 20/09 | Marches contre la loi dite « permis de tuer », plus de 20 000 personnes à Paris selon la préfecture | Manifestations Sociales | franceinfo, 21/09/2026 : [« Non au permis de tuer » : des manifestations en France contre la proposition de loi sur la présomption de légitime défense pour les forces de l'ordre](https://www.franceinfo.fr/faits-divers/police/non-au-permis-de-tuer-des-manifestations-en-france-contre-la-proposition-de-loi-sur-la-presomption-de-legitime-defense-pour-les-forces-de-l-ordre_8202626.html) |
| 22/09 | Assemblée générale de l'ONU : ouverture du débat général, dernier discours d'Emmanuel Macron | Sommet Diplomatique, Emmanuel Macron, Relations États-Unis-Chine | France 24, 22/09/2026 : [À l'Assemblée générale de l'ONU, Macron dénonce « un spectacle qui nous fait honte à tous » à Gaza](https://www.france24.com/fr/am%C3%A9riques/20260922-assembl%C3%A9e-g%C3%A9n%C3%A9rale-onu-en-direct-ouverture-guterres-trump-lula-erdogan-macron-takaichi-burnham-zelensky-moyen-orient-ukraine) |
| 25/09 | Journée nationale d'hommage aux harkis : ravivage de la flamme à l'Arc de Triomphe | Cérémonies Commémoratives | Élysée, 25/09/2026 : [Cérémonie de ravivage de la flamme à l'occasion de la Journée nationale d'hommage aux harkis](https://www.elysee.fr/emmanuel-macron/2026/09/25/ceremonie-de-ravivage-de-la-flamme-a-loccasion-de-la-journee-nationale-dhommage-aux-harkis-aux-moghaznis-et-aux-personnels-des-formations-suppletives-et-assimiles) |
| 25/09 | Le pape Léon XIV arrive à Paris : Élysée, UNESCO, vêpres à Notre-Dame, veillée au Stade de France | Visite de Léon XIV, Pape Catholique, Visite Papale | Conférence des évêques de France, site du voyage apostolique : [Le pape Léon XIV à Paris, 25 et 26 septembre 2026](https://www.pape-france.fr/le-voyage/paris/) |
| 26/09 | Messe place de la Concorde, puis départ pour Lourdes | Visite Papale, Visite de Léon XIV, Pape Catholique | même source : [Le pape Léon XIV à Paris, 25 et 26 septembre 2026](https://www.pape-france.fr/le-voyage/paris/) |
| 26/09 | Marches pour le climat, le vivant, la paix et la justice sociale (plus de 260 rassemblements annoncés) | Manifestations Sociales | Reporterre, 25/09/2026 : [Marches climat du 26 septembre : la carte des manifestations près de chez vous](https://reporterre.net/Marches-climat-du-26-septembre-la-carte-des-manifestations-pres-de-chez-vous) |
| 27/09 | Élections sénatoriales ; le RN obtient pour la première fois un groupe au Sénat | Élections Françaises | franceinfo, 27/09/2026 : [Résultats des élections sénatoriales 2026 : le RN réussit à constituer un groupe au Sénat pour la première fois de son histoire](https://www.franceinfo.fr/elections/senatoriales/resultats-des-elections-senatoriales-2026-le-rn-reussit-a-constituer-un-groupe-au-senat-pour-la-premiere-fois-de-son-histoire_8212448.html) |
| 28/09 | Le pape à Metz, dernière étape du voyage, après Lourdes le 27 | Visite de Léon XIV, Pape Catholique | Conférence des évêques de France : [Voyage apostolique du Saint-Père en France](https://www.pape-france.fr/) |
| 29/09 | Grève de la fonction publique contre le gel du point d'indice, à l'appel de l'intersyndicale | Manifestations Sociales | LCP, 29/09/2026 : [Grève du 29 septembre : pourquoi les fonctionnaires réclament une hausse des salaires](https://lcp.fr/actualites/greve-du-29-septembre-pourquoi-les-fonctionnaires-reclament-une-hausse-des-salaires) ; CFDT, 31/08/2026 : [Mobilisation du 29 septembre 2026 : le préavis de grève](https://www.cfdt-ufetam.org/mobilisation-du-29-septembre-2026-le-preavis-de-greve/) |

Sources consultées mais non retenues comme seule source : appels militants
publiés avant les marches du 20 et du 26 septembre (Attac, LFI, LDH), utiles pour
la date mais pas pour le déroulé ; ils ont été doublés par franceinfo et
Reporterre.

---

## 2. État de l'art et choix de conception

### Nuages de points dans le navigateur

- F. Lekschas, [Regl-Scatterplot: A Scalable Interactive JavaScript-based Scatter Plot Library](https://joss.theoj.org/papers/10.21105/joss.05275), *Journal of Open Source Software*, 2023.
  WebGL pour tenir des millions de points, index spatial pour la sélection.
  **Retenu** : la même architecture (WebGL plus index CPU), écrite à la main pour
  que la date, la certitude et l'isolement soient des paramètres du shader.
- D. Ren, F. Hohman, H. Lin, D. Moritz, [Embedding Atlas: Low-Friction, Interactive Embedding Visualization](https://arxiv.org/abs/2505.06386), Apple, 2025.
  **Retenu** : nommer automatiquement les régions denses, rendre les
  superpositions lisibles par la transparence.

### Lire une projection UMAP

- M. Wattenberg, F. Viégas, I. Johnson, [How to Use t-SNE Effectively](https://distill.pub/2016/misread-tsne/), *Distill*, 2016.
  **Retenu** : la taille des amas et les distances entre amas ne se lisent pas ;
  repris dans la vue « Ce que la méthode rate ».
- A. Coenen, A. Pearce, [Understanding UMAP](https://pair-code.github.io/understanding-umap/), Google PAIR, 2019.
  **Retenu** : effet de `min_dist` ; `min_dist = 0` tasse les points, la carte le dit.
- L. McInnes et al., [UMAP : paramètres](https://umap-learn.readthedocs.io/en/latest/parameters.html), documentation umap-learn.

### Placer des étiquettes

- J. Christensen, J. Marks, S. Shieber, [An Empirical Study of Algorithms for Point-Feature Label Placement](https://dash.harvard.edu/bitstream/1/2032678/2/AnEmpiricalStudy.pdf), *ACM Transactions on Graphics* 14(3), 1995.
  **Retenu** : le placement optimal est NP-difficile ; un algorithme glouton par
  priorité, avec positions candidates, suffit. C'est `assets/js/carte/etiquettes.js`.
- Tutte Institute, [DataMapPlot : options de placement](https://datamapplot.readthedocs.io/en/latest/placement_controls.html).
  **Retenu** : noms de régions sur les cartes de données, filet de rappel quand
  un nom s'écarte de son amas.

### Collections d'images : archives, musées, humanités numériques

- Yale Digital Humanities Lab, [PixPlot](https://dhlab.yale.edu/projects/pixplot).
  **Retenu** : au zoom fort, les vignettes remplacent les points.
- M. Whitelaw, [Generous Interfaces for Digital Cultural Collections](https://digitalhumanities.org/dhq/vol/9/1/000205/000205.html), *Digital Humanities Quarterly* 9(1), 2015.
  **Retenu** : montrer l'étendue d'une collection avant de demander une requête ;
  le mur des 64 planches s'ouvre avant toute recherche.
- F. Windhager et al., [Visualization of Cultural Heritage Collection Data: State of the Art and Future Challenges](https://doi.org/10.1109/TVCG.2018.2830759), *IEEE TVCG* 25(6), 2019.
  **Retenu** : alterner vue d'ensemble et objet singulier, exposer l'incertitude.
- L. Manovich, [Exploring massive image collections with ImagePlot](https://www.ipam.ucla.edu/abstract/?tid=10210), IPAM, UCLA.
  **Retenu** : montrer les images elles-mêmes plutôt que des marques qui les remplacent.
- K. Lubben (dir.), [Magnum Contact Sheets](https://www.lensculture.com/books/1274-magnum-contact-sheets), Thames & Hudson, 2011.
  **Retenu** : le vocabulaire de la planche contact (vues numérotées sur fond noir, lues dans l'ordre).

### Animation et narration

- G. Robertson, R. Fernandez, D. Fisher, B. Lee, J. Stasko, [Effectiveness of Animation in Trend Visualization](https://doi.org/10.1109/TVCG.2008.125), *IEEE TVCG* 14(6), 2008.
  L'animation séduit en présentation mais produit des erreurs d'analyse ; les
  traces et les petits multiples sont plus justes.
  **Retenu** : traînée des jours passés, curseur pour s'arrêter, et une vue
  Temps en petits multiples à côté de la séquence.
- L. C. Muth, [What to consider when using text in data visualizations](https://www.datawrapper.de/blog/text-in-data-visualizations), Datawrapper, 2022.
  **Retenu** : titres qui affirment, légendes au plus près des marques, titre et
  source inclus dans les images exportées.
- opsci.ai, [Narrative Intelligence : NATO Information Environment](https://narrative-intelligence.systems/), 2026.
  Référence directe du brief. **Retenu** : une affirmation, puis sa preuve ;
  sections numérotées ; limites dites dans le corps du texte. **Écarté** : son
  thème sombre et sa typographie, pour ne pas copier.

### Couleur, typographie, technique

- G. Machado, M. Oliveira, L. Fernandes, [A Physiologically-based Model for Simulation of Color Vision Deficiency](https://doi.org/10.1109/TVCG.2009.113), *IEEE TVCG* 15(6), 2009.
  Simulation protan et deutan utilisée pour valider la palette des familles et
  pour colorer les clusters voisins (`scripts/build_data.py`, fonction `coloration`).
- Production Type, [Newsreader](https://github.com/productiontype/Newsreader) ; USWDS, [Public Sans](https://github.com/uswds/public-sans), dérivée de [Libre Franklin](https://github.com/googlefonts/Libre-Franklin) ; IBM, [Plex Mono](https://github.com/IBM/plex). Licence SIL OFL, fichiers et licences dans `assets/fonts/`.
- M. Bostock et al., [D3 v7.9.0](https://d3js.org), licence ISC, copie dans `assets/vendor/`.
- GitHub, [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) : site publié limité à 1 Go.
- MDN, [HTMLCanvasElement.captureStream()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream) et [MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder) : export vidéo sans bibliothèque.

### Modèles de la chaîne de traitement

- [laion/CLIP-ViT-H-14-laion2B-s32B-b79K](https://huggingface.co/laion/CLIP-ViT-H-14-laion2B-s32B-b79K), modèle de vectorisation des images.
- [HDBSCAN : comment ça marche](https://hdbscan.readthedocs.io/en/latest/how_hdbscan_works.html), documentation.
