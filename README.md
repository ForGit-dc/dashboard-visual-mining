# SPINE · Septembre 2026 en 65 229 images

Dashboard de *visual mining* de l'analyse 691 (« Topic-mining-SPINE-France ») :
65 229 images publiées sur X du 1er au 29 septembre 2026 par quatre familles
d'acteurs (Media, Officials, Vectors, Influencers), vectorisées par CLIP,
projetées par UMAP et regroupées par HDBSCAN en 64 clusters.

Site statique, sans serveur ni base de données. Publié sur GitHub Pages :
**https://forgit-dc.github.io/dashboard-visual-mining/**

Documents d'accompagnement :

| fichier | contenu |
|---|---|
| [`CONCEPTION.md`](CONCEPTION.md) | ce qui a été vérifié dans le brief et corrigé, ce qui a été retenu ou écarté, identité visuelle, pile technique |
| [`LIMITES.md`](LIMITES.md) | limites connues, et ce qu'il aurait fallu de données en plus |
| [`SOURCES.md`](SOURCES.md) | sources des événements annotés, références de l'état de l'art |

---

## Les vues

| touche | vue | à quoi elle sert |
|---|---|---|
| `1` | **Carte** | les 65 229 images projetées par UMAP, en WebGL. Quatre couleurs (cluster, famille dominante, poids des Vectors, résonance), opacité portée par la certitude HDBSCAN, noms placés sans chevauchement, fiche de cluster, séquence jour par jour avec événements sourcés, export PNG et vidéo |
| `2` | **Temps** | volume quotidien par régime (événementiel, jours ouvrés, week-end, continu), crêtes des 64 clusters face aux événements, détail d'un cluster |
| `3` | **Familles d'acteurs** | les quatre familles, le répertoire des Vectors, la matrice de sur-représentation (observé ÷ attendu), l'indice de mélange |
| `4` | **Résonance** | volume contre médiane des engagements par post, quadrants nommés, dépendance au post viral |
| `5` | **Planches contact** | le mur des 64 planches, chaque planche réglable de 3 à 12 vues par ligne, détecteur de quasi-doublons |
| `6` | **Les 64 clusters** | le tableau : tri sur toutes les colonnes, recherche avec opérateurs, copie vers un tableur, export CSV |
| `7` | **Ce que la méthode rate** | bruit, échantillon daté, événement éclaté, gabarits d'éditeurs, production à vide, double comptage, labels trompeurs, regroupement manuel |
| | **Méthode et sources** | chaîne de traitement, contenu du dépôt, événements et sources, références |

Un **parcours guidé** en quatre étapes (bouton en haut à droite, touche `P`)
pilote l'outil réel. Tout l'état de l'interface est dans l'adresse de la page :
le bouton « Copier le lien » (touche `L`) partage exactement l'écran affiché.
La liste des raccourcis s'ouvre avec `?`.

---

## Structure du dépôt

```
index.html                  page unique ; les vues se chargent à la demande
.nojekyll                   GitHub Pages sert le dépôt tel quel
assets/
  css/app.css               toute la feuille de style (jetons en tête de fichier)
  js/main.js                chargement, routeur de vues, raccourcis
  js/etat.js                état de l'interface et permaliens
  js/donnees.js             décodage des binaires, statistiques à la demande
  js/carte/                 rendu WebGL, index spatial, noms, séquence et vidéo
  js/vues/                  une vue par fichier, plus le parcours guidé
  js/ui/                    fiche, visionneuse, infobulle, recherche, exports
  fonts/                    Newsreader, Libre Franklin, IBM Plex Mono (OFL)
  vendor/                   D3 7.9.0 (ISC)
data/                       GÉNÉRÉ par scripts/build_data.py, ne pas éditer
vignettes/                  GÉNÉRÉ par scripts/build_vignettes.py, ne pas éditer
annotations/
  lecture_clusters.csv      lecture manuelle des 64 clusters (logique, ce qu'on voit, notes)
  evenements.json           événements datés, chacun avec ses sources
scripts/
  build_vignettes.py        vignettes WebP et empreintes dHash
  build_data.py             tout data/ à partir des CSV
  verifier_build.py         revérifie data/ contre les CSV bruts
brief/                      cahier des charges : données dérivées, dictionnaire, script de vérification
clusters.csv, document_to_cluster.csv, documents_and_blob_url.csv, images_691_echantillon/
                            données d'origine, inchangées
```

Aucune étape de build JavaScript : les modules ES sont servis tels quels.

---

## Régénérer les données

Python 3.10 ou plus, avec `numpy` et `Pillow` (testé avec Python 3.11.9,
numpy 2.3.3, Pillow 11.3.0).

```bash
python brief/verifier_donnees.py     # les CSV sont-ils ceux du brief ?
python scripts/build_vignettes.py    # vignettes + empreintes, ~30 s
python scripts/build_data.py         # data/, quelques secondes
python scripts/verifier_build.py     # relit data/ comme le navigateur, compare aux CSV
```

`build_vignettes.py --manquantes` ne refait que les vignettes absentes.

Ce que fait `build_data.py` :

- lit les trois CSV en neutralisant les quatre pièges décrits dans
  `brief/DONNEES.md` (fins de ligne, guillemets incohérents sur `cluster_id`,
  ligne `'-1` malformée, label `DELETE`) ;
- s'arrête à la première incohérence, et recoupe chaque cluster avec les
  fichiers du brief (effectifs, sommes d'engagements, séries quotidiennes,
  familles) ;
- dédoublonne les engagements par post (un post de 4 images ne compte qu'une fois)
  et calcule médiane, 9e décile et part du premier post ;
- calcule l'entropie et la sur-représentation des familles, le régime temporel,
  les deux continents de la carte, la position des noms, la coloration des
  clusters voisins, les groupes de quasi-doublons et le mode de tirage de
  l'échantillon ;
- écrit `points.bin` (une colonne binaire par champ, 1 Mo pour 65 229 points),
  `posts.bin`, des JSON, et l'empreinte SHA-256 de chaque fichier d'entrée dans
  `meta.json`.

Pour changer la lecture d'un cluster ou ajouter un événement, modifiez
`annotations/`, relancez `build_data.py` puis `verifier_build.py` (qui vérifie
aussi que chaque source d'événement figure dans `SOURCES.md`).

---

## Ouvrir en local

Les navigateurs bloquent la lecture de fichiers de données depuis `file://`.
Depuis la racine du dépôt :

```bash
python -m http.server 8000
```

puis http://localhost:8000. Le dashboard l'explique lui-même s'il est ouvert
directement depuis le disque.

---

## Déployer sur GitHub Pages

1. Pousser `main` sur GitHub (dépôt public, ou compte payant pour un dépôt privé).
2. *Settings → Pages → Build and deployment* : source « Deploy from a branch »,
   branche `main`, dossier `/ (root)`.
3. Attendre la fin du workflow « pages build and deployment » (onglet *Actions*).
   Chaque push suivant redéploie le site.

Budget de poids, la principale contrainte (GitHub Pages refuse un site de plus
de 1 Go) :

| élément | poids |
|---|---|
| images d'origine (`images_691_echantillon/`) | 791 Mo |
| vignettes WebP 256 px | 46 Mo |
| CSV d'origine | 15 Mo |
| données du dashboard (`data/`) | 2,2 Mo |
| polices, scripts, styles | 1,2 Mo |
| **site publié** | **≈ 855 Mo** |

Le dashboard n'affiche que des vignettes (9 Ko en moyenne au lieu de 148 Ko) ;
l'image d'origine n'est chargée que dans la visionneuse, sur demande. Avant
d'ajouter quoi que ce soit de lourd au dépôt, retirer l'équivalent ailleurs.

---

## Performances mesurées

Mesures sur le volume réel (65 229 points), Chrome 154 piloté par Playwright,
Windows 11, carte graphique intégrée Intel Arc, cache désactivé, connexion
simulée par le protocole DevTools.

| mesure | résultat |
|---|---|
| carte affichée, serveur local | 0,35 s |
| carte affichée, connexion moyenne (10 Mbit/s, 40 ms) | 1,9 s pour 2,6 Mo |
| carte affichée, connexion lente (1,6 Mbit/s, 150 ms) | 10,3 s |
| rendu d'une image de carte (points, vignettes et noms) | 1,1 ms en médiane, 1,8 ms au 95e centile |
| lecture de la séquence | 120 images par seconde (pas de recalcul JavaScript : la date est un paramètre du shader) |
| recherche du point survolé (index en grille) | moins de 0,1 ms |
| processeur ralenti 4 fois | rendu 2,8 ms, lecture à 60 images par seconde en médiane |

Le premier écran ne charge que la carte : les autres vues sont des modules
importés au premier affichage, et `posts.bin` (les liens vers X) arrive après le
premier rendu.

---

## Vérifications

- `brief/verifier_donnees.py` : les CSV correspondent au brief.
- `scripts/verifier_build.py` : `data/` relu comme le navigateur le lit
  (déquantification comprise) et comparé aux CSV bruts ; vignettes présentes ;
  sources d'événements citées.
- Palette des familles validée sur le fond `#f5f3ee` pour la vision normale, la
  protanopie et la deutéranopie (simulation Machado 2009), sur toutes les paires.

---

## Licences

Polices sous licence SIL Open Font License (textes dans `assets/fonts/`), D3
sous licence ISC (`assets/vendor/`). Les données et les images appartiennent à
opsci.ai et à leurs auteurs.
