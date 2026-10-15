# Dictionnaire des données

Complément de `BRIEF.txt`. Tout a été vérifié sur les fichiers réels du dépôt le
15/10/2026. Les chiffres donnés ici sont mesurés, pas estimés.

---

## Pièges de parsing, à traiter avant tout le reste

Ces quatre points cassent un chargement naïf. Traite-les explicitement, et écris
un test qui vérifie les totaux après chargement.

**1. Les fichiers sont en CRLF.** Terminaisons `\r\n`. Un parsing ligne à ligne
sans `newline=''` (Python) ou sans gestion du `\r` (JS) laisse un retour chariot
collé à la dernière colonne de chaque ligne.

**2. Le `cluster_id` n'a pas le même format selon le fichier.**

| fichier | forme du cluster_id |
|---|---|
| `clusters.csv` | entre guillemets, `"0"` |
| `document_to_cluster.csv` | entre guillemets, `"61"` |
| `documents_and_blob_url.csv` | **sans guillemets**, `-1` |

Un parseur CSV correct retire les guillemets et te rend `0`, `61`, `-1` dans les
trois cas. Mais si tu découpes à la main sur les virgules, tu obtiendras `"0"` et
`-1`, et la jointure échouera **en silence** sur tous les clusters. Normalise.

**3. La ligne du bruit dans `clusters.csv` est malformée.**

```
"cluster_id","cluster_label","id"
'-1,DELETE,35419              <- apostrophe parasite, aucun guillemet
"0",Cartographie Géopolitique,35420
```

Un parseur standard te rendra `'-1` et non `-1`. C'est le seul `cluster_id` du
jeu qui n'a pas de label exploitable. Détecte-le et traite-le comme le bruit.

**4. `DELETE` n'est pas un nom de cluster.** C'est une consigne interne qui veut
dire « ne pas afficher ». Ne l'écris jamais dans l'interface. Appelle cette classe
« Non classé » ou « Bruit ».

---

## Les fichiers

### `clusters.csv`, 65 clusters

`cluster_id`, `cluster_label`, `id`

Le nom lisible de chaque cluster. 64 labels utilisables, plus la ligne `-1`.
Les labels sont en français et ont été produits automatiquement puis revus.

### `document_to_cluster.csv`, 65 229 images

`cluster_id`, `probability`, `umap_x`, `umap_y`, `document_id`, `id`

Le fichier de la carte. Une ligne par image.

- **`probability`** : force d'appartenance HDBSCAN, de 0 à 1. Vaut `1.0` au cœur
  d'un cluster, descend vers 0 sur les bords. Pour le bruit, elle vaut 0.
  C'est le critère qui a servi à choisir les 10 % d'images échantillonnées.
  **Sers-t'en dans la visualisation** : faire porter l'opacité ou le rayon d'un
  point par sa certitude est plus honnête qu'un nuage uniforme, et ça se voit.
- **`umap_x`, `umap_y`** : coordonnées 2D. Reproductibles (`random_state=42`).
- **`id`** : clé technique de la table source, sans usage pour toi.

### `documents_and_blob_url.csv`, 65 229 images

`cluster_id`, `document_id`, `blob_url`, `url`, `created_at`, `engagements`

- **`blob_url`** : nom du fichier image, un SHA-256 suivi de `.jpg`. C'est
  **exactement** le nom sur disque dans `images_691_echantillon/<cluster_id>/`.
  Les 65 229 valeurs sont uniques, aucune image n'est partagée entre deux posts.
- **`url`** : permalien du post sur twitter.com. Certains seront morts, prévois
  le cas.
- **`created_at`** : date de publication, format `AAAA-MM-JJ HH:MM:SS.000`.
  Du **2026-09-01** au **2026-09-29**, 29 jours pleins, **aucune valeur manquante**.
- **`engagements`** : total d'interactions du post.
  Médiane **10**, maximum **158 396**, total **8 393 806**.
  Distribution extrêmement asymétrique. **N'affiche jamais de moyenne.** Médianes,
  quantiles ou échelle logarithmique.

### `images_691_echantillon/<cluster_id>/<blob_url>`

**4 859 images**, 64 dossiers (`0` à `63`), **764 Mo**, poids médian 148 Ko.

- 10 % des images de chaque cluster, prises par `probability` décroissante.
  Taux vérifié : min 10,0 %, médiane 10,1 %, max 10,4 %.
- **Pas d'images pour le bruit** (`-1`).
- Jointure vérifiée : les 4 859 fichiers correspondent tous à une ligne du CSV,
  avec le même `cluster_id`. Zéro orphelin.
- Taille des dossiers : 41 images pour le cluster 0, 712 pour le cluster 58.

### `brief/data-derivee/cluster_x_famille.csv`, 65 lignes

`cluster_id`, `Media`, `Officials`, `Vectors`, `Influencers`, `total`, puis les
quatre pourcentages.

**Produit depuis la base de données. Tu ne peux pas le recalculer** : le lien
entre une image et la liste de comptes dont elle provient n'est dans aucun des
CSV du dépôt.

### `brief/data-derivee/clusters_enrichis.csv`, 65 lignes

**Charge ce fichier en premier.** Tout y est pré-agrégé par cluster.

| colonne | contenu |
|---|---|
| `cluster_id`, `label` | identifiant et nom lisible |
| `images` | nombre d'images |
| `engagements`, `eng_par_image` | volume et résonance |
| `media`, `officials`, `vectors`, `influencers` | effectifs par famille |
| `famille_dominante`, `pct_dominante` | famille majoritaire et sa part |
| `jour_pic`, `pct_au_pic` | jour le plus actif, et sa part du total |
| `jours_actifs` | nombre de jours sur 29 avec au moins une image |
| `serie_quotidienne` | 29 entiers séparés par `\|`, du 01/09 au 29/09 |

`serie_quotidienne` te donne la courbe temporelle de chaque cluster sans aucun
recalcul. L'index 0 est le 1er septembre, l'index 28 le 29 septembre.

---

## Cohérence vérifiée

| contrôle | résultat |
|---|---|
| `document_id` communs aux deux gros CSV | 65 229 sur 65 229, intersection parfaite |
| `cluster_id` utilisés ayant un label | 64 sur 65, seul `-1` fait exception |
| images sur disque retrouvées dans le CSV | 4 859 sur 4 859 |
| `created_at` manquants | 0 |

---

## Volumétrie de référence

À afficher quelque part dans le dashboard, et à vérifier après ton chargement.

```
65 229  images
64      clusters nommés
16 916  images non classées (25,9 %)
29      jours, du 01/09/2026 au 29/09/2026
8 393 806  engagements cumulés
4 859   images disponibles en local (10 % par cluster)
```

Répartition par famille d'acteurs :

| famille | images | part | taux de bruit |
|---|---|---|---|
| Media | 37 967 | 58,2 % | 25,4 % |
| Officials | 17 220 | 26,4 % | 25,7 % |
| Vectors | 8 644 | 13,2 % | 26,4 % |
| Influencers | 1 398 | 2,1 % | **40,2 %** |

Le taux de bruit des Influencers est l'anomalie à expliquer : leurs visuels sont
les plus hétérogènes du corpus, donc les plus difficiles à regrouper.

---

## Ce qui n'est PAS dans les données

Ne l'invente pas. Si tu en as besoin, signale-le dans ton rendu.

- le compte auteur de chaque post (pseudo, nom, nombre d'abonnés)
- le texte du post
- la famille d'acteurs **au niveau de l'image** : tu l'as agrégée par cluster
  dans `cluster_x_famille.csv`, pas ligne par ligne
- les vues, les retweets et les likes séparément : seul le total `engagements`
  est fourni
- les images du bruit
- les 90 % d'images non échantillonnées
