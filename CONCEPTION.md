# Note de conception — analyse 691, SPINE France

Rédigée avant la construction (étape 4 de la méthode du brief), puis tenue à jour.
Elle dit ce que j'ai vérifié, ce que les données m'ont appris, ce que je retiens
de la section 8 du brief, ce que j'écarte et pourquoi.

---

## 1. Ce que j'ai vérifié, et ce qui est faux dans le brief

`python brief/verifier_donnees.py` passe : volumétrie, jointures, dates, totaux.
Mais trois constats de la section 6 ne tiennent pas une fois les données
regardées de près, et la description de l'échantillon d'images est incomplète. Je les signale parce que le brief le demande, et parce
qu'un analyste client les trouverait.

**a. Le total d'engagements compte certains posts deux, trois ou quatre fois.**
`engagements` est une valeur *du post*, recopiée sur chacune de ses images.
Les 65 229 images viennent de **54 542 posts** : 4 921 posts portent 2 à 4 images
(23,9 % des images). Sommer par image donne 8 393 806 ; sommer par post donne
**6 090 581**. L'écart (+37,8 %) n'est pas uniforme : il frappe les clusters
où l'on publie en albums.

**b. `eng_par_image` est une moyenne gonflée par les posts à plusieurs images.**
Football Européen affiche 1 103 engagements par image parce qu'un seul post de
4 images (132 538 engagements) y est compté 4 fois : 530 152 engagements sur
1 024 341. Dédoublonné, le cluster pèse 414 288. Sa médiane par post est de
**42**, celle de Faits Divers de **1** : le facteur 42 du brief survit à la
correction, par coïncidence. Mais il ne dit plus la même chose : la résonance de
Football Européen tient à une poignée de posts viraux (le premier pèse 32 % du
cluster), et pour d'autres clusters l'ordre change. Le dashboard n'affiche donc
**que des médianes par post**, avec le 9e décile et la part du premier post.

Classement par médiane par post, en tête : Sommet Diplomatique (56),
Statistiques et Graphiques (53), Polémiques Sociétales (49), Aéronautique
Militaire (46). Deux clusters à dominante Vectors sur les trois premiers.

**c. « Le cluster le plus mélangé » dépend de l'indicateur.**
Aéronautique Militaire (32) a bien la plus faible part dominante (34,9 %).
Mais à l'entropie de Shannon normalisée sur les quatre familles, le plus
mélangé est Industrie Agroalimentaire (0,91), puis Animaux et Humains (0,87),
Cartographie Géopolitique (0,82), et Aéronautique Militaire seulement
quatrième (0,81). Le dashboard affiche l'entropie, et cite la part dominante en
regard.

**d. L'échantillon d'images est daté du début du mois.** Les 4 859 images locales
ont toutes une probabilité de 1, mais 62 % des points classés sont dans ce cas.
Le tirage s'est départagé par `document_id` croissant : vérifié dans les 64
clusters. Comme `document_id` suit l'ordre de publication (corrélation 0,994),
68 % des images locales datent du 1er au 4 septembre, presque aucune n'est
postérieure au 23, aucune ne tombe un jour de pic. Les planches montrent donc le
début du mois ; les chiffres et la carte, qui portent sur les 65 229 images, ne
sont pas touchés. Le dashboard le dit dans les planches, les fiches et la vue
« Limites » ; pour une prochaine extraction, tirer au hasard parmi les
probabilités 1 ou stratifier par jour.

**Détails mineurs.** Les CSV du dépôt sont en LF, pas en CRLF (le chargement
gère les deux). 1 468 images sont des PNG, pas des JPG. Les images pèsent
791 Mo (754 Mio), pas 764 Mo. Les autres constats (b, c, d, e de la section 6)
sont exacts.

## 2. Ce que les images m'ont appris

J'ai regardé les huit images les plus centrales de chacun des 64 clusters.
Les labels cachent trois logiques de regroupement différentes, que CLIP ne
distingue pas :

| logique | ce que CLIP regroupe | exemples |
|---|---|---|
| **sujet** | une scène photographiée | Football Européen (1), Aéronautique Militaire (32, des fantassins plus que des avions), Manifestations Sociales (59) |
| **gabarit** | la charte graphique d'un éditeur | Actualités Régionales (9) : uniquement des cartes « Hérault Tribune » ; Actualités Réunion (11) : Imaz Press ; Vie des Célébrités (47) : Gala ; Actualités Économiques Africaines (3) : les cartes orange d'Africa Intelligence, qui ne publient jamais le week-end |
| **genre** | un type de document | Polémiques Sociétales (40) : des captures d'écran ; Statistiques et Graphiques (17) ; Imagerie Biblique (29) : de la peinture ancienne ; Chaînes d'Information (26) : les cartons « je suis l'invité de RTL 12h45 » publiés par des élus |

Conséquences pour le dashboard : chaque cluster porte une *lecture* (logique,
ce qu'on voit), signée comme une annotation manuelle et non comme une donnée.
Et les clusters « sans engagement » de la section 6(d) sont presque tous des
gabarits : ce n'est pas un sujet qui n'intéresse personne, c'est un flux
d'éditeur que personne ne relaie.

Les trois clusters papaux se séparent par **format** : vignettes d'articles
titrées (4), portraits du pape (13), scènes de cérémonie (14). Seuls 13 posts
mélangent deux de ces clusters.

Les clusters où les Vectors pèsent plus de trois fois leur poids moyen sont
presque tous des genres de seconde main : peinture ancienne (29, ×6,1),
captures d'écran (40, ×4,6), couvertures de livres (43, ×4,4),
caricatures (8, ×3,8), graphiques (17, ×3,5), miniatures vidéo (45, ×3,5),
drapeaux (28, ×3,4). Les Vectors ne photographient pas : ils citent, tracent
et caricaturent.

**Quasi-doublons.** Les `blob_url` sont uniques, mais une empreinte
perceptuelle (dHash) trouve 231 groupes d'images identiques ou presque dans
l'échantillon local, 515 images, dont 228 groupes faits de posts distincts.
Ce n'est pas un graphe de comptes (les comptes ne sont pas dans les données),
mais c'est une trace de circulation : photos d'agence reprises, visuels
génériques (« ALERTE INFO »), captures d'une même émission.

## 3. La section 8 : ce que je retiens, ce que j'écarte

| piste | décision | pourquoi |
|---|---|---|
| 8.1 séquence jouée | **retenue** | lecture, pause, trois vitesses, curseur à l'heure près, traînée pâle des jours passés, marqueurs d'événements sur la frise. Le filtrage temporel se fait dans le shader : aucun recalcul côté JavaScript pendant la lecture. |
| 8.1 export | **vidéo plutôt que GIF** | un GIF de 65 000 points pèse des dizaines de Mo et bave sur les aplats. `MediaRecorder` produit un WebM (ou un MP4 quand le navigateur sait le faire) sans aucune bibliothèque. |
| 8.2 familles | **retenue, au cœur** | carte recolorée par famille dominante, l'intensité portant la part de cette famille ; matrice de sur-représentation (rapport observé/attendu, et non comptes bruts) ; classement par entropie ; ratio Vectors. |
| 8.2 couleur par image | **écartée** | la famille n'existe qu'au niveau du cluster. Colorer chaque point par une famille serait inventer une donnée. |
| 8.3 résonance | **retenue** | plan log-log, volume en abscisse, **médiane par post** en ordonnée, quadrants nommés, segment médiane → 9e décile pour montrer la dispersion. |
| 8.4 actualité | **retenue** | chaque annotation porte au moins une source vérifiée (lien ouvert et relu). Pas de source, pas d'annotation. |
| 8.5 limites | **retenue** | une vue entière : le bruit, l'éclatement papal, les gabarits, les clusters à vide, le double comptage, ce qui n'est pas dans les données. |
| 8.6 avant/après | **retenue** | sur les clusters événementiels, planche du jour du pic contre le reste du mois. |
| 8.6 quasi-doublons | **retenue** | dHash 64 bits, calculé à la génération des vignettes, distance de Hamming ≤ 4. |
| 8.6 parcours guidé | **retenu** | quatre étapes qui pilotent l'outil réel (vue, couleurs, sélection, date), pas des captures. |
| 8.6 recherche | **retenue** | sur labels et lectures, avec `ET`, `OU`, `-exclusion`, `"phrase"` et des filtres `famille:`, `logique:`, `images>`, `médiane>`. |
| 8.6 permaliens | **retenus** | tout l'état de l'interface vit dans l'URL. |
| aire empilée des 64 clusters | **remplacée** | 64 couches empilées ne se lisent pas. Vue d'ensemble : une crête par cluster (ridgeline) triée par jour de pic, plus le volume quotidien empilé par régime temporel. |
| graphes à deux axes | **écartés** | les captures de l'outil générique superposent posts et engagements sur deux échelles : l'alignement des axes est arbitraire et suggère une corrélation qui n'existe pas. |
| moyennes d'engagement | **écartées partout** | médianes et déciles uniquement. |
| thème sombre | **écarté** | l'identité est celle du papier. Je préfère un seul thème soigné à deux thèmes moyens. |

## 4. Identité visuelle

> **Une table d'éditeur photo : du papier, de l'encre, et quatre couleurs qui
> ne servent qu'aux quatre familles d'acteurs.**

- Fond papier `#f5f3ee`, encre `#1b1a17`, filets d'un pixel. Ni ombre portée,
  ni dégradé, ni coin arrondi au-delà de 2 px.
- Titres en **Newsreader** (Production Type, dessinée pour la lecture de
  presse à l'écran), interface et chiffres en **Libre Franklin** (la
  Franklin Gothic des pages graphiques de la presse américaine), codes et
  identifiants en **IBM Plex Mono**. Chiffres tabulaires dans les colonnes.
  Polices auto-hébergées : pas d'appel à Google Fonts depuis un poste client.
- Les quatre couleurs de famille sont réservées : Media `#2b6cb0`, Officials
  `#d69a16`, Vectors `#cf3d2e`, Influencers `#1b9e8f`. Palette passée au
  validateur (daltonisme protan/deutan, simulation Machado 2009) sur toutes
  les paires : écart minimal ΔE 12,4, vision normale 17,1.
- Le mode « par cluster » de la carte utilise huit teintes attribuées par
  coloration de graphe : deux clusters voisins ne reçoivent jamais deux
  teintes confondables, y compris pour un lecteur daltonien.
- Les planches contact reprennent le vocabulaire du tirage contact : cadres
  noirs, numéros de vue, et une sélection marquée comme au crayon gras.

## 5. Pile technique

- **Aucun build JavaScript.** Modules ES natifs, servis tels quels par GitHub
  Pages. D3 v7 vendorisé pour les échelles et les axes.
- **Carte en WebGL écrit à la main** (un shader de points, environ 200
  lignes) plutôt que deck.gl : la lecture temporelle, la certitude HDBSCAN et
  l'isolement de clusters sont des uniformes du shader, donc la carte reste à
  60 images/s pendant la lecture sans retransférer les données. Survol via une
  grille spatiale côté CPU.
- **Étiquettes de clusters placées par un algorithme glouton avec
  détection de collision**, recalculé à chaque zoom (64 étiquettes, moins
  d'une milliseconde). Une étiquette qui ne trouve pas de place s'efface ;
  elle réapparaît en zoomant.
- **Données en binaire colonnaire** (`data/points.bin`, environ 1 Mo pour 65 229
  points) : aucun parsing CSV dans le navigateur.
- **Vignettes WebP 256 px, qualité 80** : 45 Mo pour 4 859 images, au lieu de
  791 Mo. L'image originale n'est chargée qu'à la demande, dans la visionneuse.
- Tous les fichiers générés ont leur script dans `scripts/`, et
  `scripts/verifier_build.py` revérifie les totaux après génération.

## 6. Ce que je ne peux pas faire avec ces données

Le compte auteur, le texte des posts, la famille au niveau de l'image, les vues
et les likes séparés, les images du bruit, les 90 % d'images non
échantillonnées. Le dashboard le dit là où l'absence se remarque : au survol
d'un point non échantillonné, dans la fiche d'un cluster, dans la vue
« Limites ».
