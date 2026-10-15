# Limites connues, et ce que j'aurais fait avec plus de données

Note courte demandée par le brief (section 14). Le détail chiffré et illustré est
dans le dashboard, vue « Ce que la méthode rate ».

## Limites de la méthode

1. **Un quart du corpus n'est dans aucun cluster.** 16 916 images (25,9 %), dont
   le post le plus engageant du corpus (158 396 engagements). Leur médiane
   d'engagement (9 par post) est celle du corpus : ce n'est pas du déchet. Les
   Influencers y sont sur-représentés (40,2 % de leurs images, contre 25,9 %).
   Le dépôt ne contient aucune image du bruit.

2. **CLIP range des formats autant que des sujets.** Dix clusters regroupent la
   charte graphique d'un éditeur (Hérault Tribune, Imaz Press, Gala, CNews,
   Africa Intelligence, presse régionale) : 10 922 images, 16,7 % du corpus. Les
   six clusters de la « production à vide » (beaucoup d'images, médiane sous
   celle du corpus) sont tous de ce type.

3. **Un même événement peut être éclaté.** La visite du pape (25 au 28 septembre)
   est répartie entre trois clusters, séparés par le format (vignettes titrées,
   portraits, scènes) et rangés sur les deux continents de la carte. Seuls 13
   posts mélangent deux de ces clusters. Le dashboard permet de les regrouper à
   la main (vue Limites, section 3), mais le regroupement reste une décision
   d'analyste.

4. **Des labels décrivent mal leurs images.** Onze labels sont corrigés dans les
   fiches (par exemple « Aéronautique Militaire » : surtout des fantassins).

5. **La carte UMAP se lit avec précaution.** `min_dist = 0` tasse les points ; les
   distances entre clusters et la taille des amas ne se lisent pas comme des
   mesures. 263 points d'Actualités Réunion sont rattachés à leur cluster avec
   une probabilité nulle.

## Limites des données

6. **L'échantillon d'images est daté du début du mois.** Les 4 859 images locales
   sont toutes de probabilité 1, mais 62 % des points classés le sont : le tirage
   s'est départagé par `document_id` croissant (vérifié dans les 64 clusters),
   c'est-à-dire par date de publication. 68 % des images locales datent du
   1er au 4 septembre, aucune ne tombe un jour de pic. Les planches, les
   vignettes de la carte, les quasi-doublons et la lecture manuelle des clusters
   décrivent donc le début du mois. Les chiffres et la carte, calculés sur les
   65 229 images, ne sont pas touchés.

7. **Les engagements sont ceux du post, recopiés sur chaque image.** 4 921 posts
   portent 2 à 4 images : sommés par image, les engagements gonflent de 37,8 %.
   Tout le dashboard compte un engagement par post et le résume par la médiane.
   On ne sait pas laquelle des images d'un album a fait réagir.

8. **Absents des fichiers** : le compte auteur, le texte des posts, la famille
   d'acteurs au niveau de l'image (seulement agrégée par cluster), les vues,
   likes et partages séparés, le fuseau horaire des dates, les images du bruit
   et 90 % des autres. Rien de tout cela n'est simulé.

9. **Huit pics marqués restent sans explication sourcée** (par exemple
   Dirigeants Européens le 13 septembre, Santé Publique le 1er). Ils ne sont pas
   annotés : pas de source fiable, pas d'annotation. Trois tombent quelques jours
   après un événement annoté (ONU, record du gazole) ; la correspondance n'est
   pas forcée.

## Ce que j'aurais fait avec plus de données

- **Avec le compte auteur de chaque post** : un graphe de circulation à partir
  des 231 groupes de quasi-doublons (qui republie l'image de qui, dans quel ordre
  et avec quel délai), et la famille de chaque image au lieu d'une composition
  agrégée par cluster. C'est le cœur de SPINE, et il manque ici.
- **Avec un échantillon tiré au hasard, ou stratifié par jour**, parmi les
  points de probabilité 1 : des planches « avant/après » qui montrent vraiment ce
  que les pics apportent, et un détecteur de quasi-doublons sur tout le mois.
- **Avec le texte des posts** : séparer ce qui est montré de ce qui est dit,
  repérer les images réutilisées pour dire autre chose, et nommer les clusters
  par leur contenu plutôt que par une lecture visuelle.
- **Avec les embeddings CLIP** : mesurer la distance d'une image au centre de son
  cluster, proposer des fusions de clusters par similarité (les trois clusters
  papaux), et détecter les quasi-doublons sur les 65 229 images.
- **Avec les vues, likes et partages séparés** : distinguer une image vue d'une
  image reprise, la différence entre audience et amplification.
