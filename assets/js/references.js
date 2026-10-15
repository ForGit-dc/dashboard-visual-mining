// Références externes et ce que j'en ai retenu pour ce dashboard.
// Même contenu que SOURCES.md, qui fait foi.

export const REFERENCES = [
  {
    theme: "Nuages de points dans le navigateur",
    items: [
      { titre: "Regl-Scatterplot: A Scalable Interactive JavaScript-based Scatter Plot Library", auteurs: "F. Lekschas", publication: "Journal of Open Source Software, 2023", url: "https://joss.theoj.org/papers/10.21105/joss.05275",
        retenu: "WebGL pour dépasser le million de points, index spatial pour la sélection. J'ai repris l'architecture (WebGL + index CPU) en l'écrivant à la main pour mettre le temps et la certitude dans le shader." },
      { titre: "Embedding Atlas: Low-Friction, Interactive Embedding Visualization", auteurs: "D. Ren, F. Hohman, H. Lin, D. Moritz (Apple)", publication: "arXiv 2505.06386, 2025", url: "https://arxiv.org/abs/2505.06386",
        retenu: "Étiquetage automatique des régions denses et transparence qui garde lisibles les points superposés : d'où les noms placés par priorité et l'opacité portée par la certitude." },
    ],
  },
  {
    theme: "Lire une projection UMAP",
    items: [
      { titre: "How to Use t-SNE Effectively", auteurs: "M. Wattenberg, F. Viégas, I. Johnson", publication: "Distill, 2016", url: "https://distill.pub/2016/misread-tsne/",
        retenu: "La taille des amas et les distances entre amas ne se lisent pas. Repris dans « Ce que la méthode rate », section 7." },
      { titre: "Understanding UMAP", auteurs: "A. Coenen, A. Pearce (Google PAIR)", publication: "2019", url: "https://pair-code.github.io/understanding-umap/",
        retenu: "Effet de n_neighbors et min_dist sur la forme du nuage ; min_dist = 0 tasse les points, ce que la carte doit dire." },
      { titre: "UMAP : paramètres", auteurs: "L. McInnes et al.", publication: "documentation umap-learn", url: "https://umap-learn.readthedocs.io/en/latest/parameters.html",
        retenu: "Définition de min_dist reprise dans la chaîne de traitement, plus haut." },
    ],
  },
  {
    theme: "Placer des étiquettes",
    items: [
      { titre: "An Empirical Study of Algorithms for Point-Feature Label Placement", auteurs: "J. Christensen, J. Marks, S. Shieber", publication: "ACM Transactions on Graphics 14(3), 1995", url: "https://dash.harvard.edu/bitstream/1/2032678/2/AnEmpiricalStudy.pdf",
        retenu: "Le placement optimal est NP-difficile ; un glouton par priorité avec positions candidates donne de bons résultats. C'est l'algorithme de carte/etiquettes.js." },
      { titre: "DataMapPlot : options de placement des étiquettes", auteurs: "Tutte Institute", publication: "documentation", url: "https://datamapplot.readthedocs.io/en/latest/placement_controls.html",
        retenu: "Cartes de données étiquetées pour les projections UMAP : noms de régions et filets de rappel quand un nom s'écarte de son amas." },
    ],
  },
  {
    theme: "Collections d'images, archives et musées",
    items: [
      { titre: "PixPlot", auteurs: "Yale Digital Humanities Lab", publication: "2017–", url: "https://dhlab.yale.edu/projects/pixplot",
        retenu: "La carte devient planche quand on zoome : les vignettes remplacent les points au zoom fort." },
      { titre: "Generous Interfaces for Digital Cultural Collections", auteurs: "M. Whitelaw", publication: "Digital Humanities Quarterly 9(1), 2015", url: "https://digitalhumanities.org/dhq/vol/9/1/000205/000205.html",
        retenu: "Montrer l'étendue d'une collection avant de demander une requête : le mur des 64 planches s'ouvre avant toute recherche." },
      { titre: "Visualization of Cultural Heritage Collection Data: State of the Art and Future Challenges", auteurs: "F. Windhager et al.", publication: "IEEE TVCG 25(6), 2019", url: "https://doi.org/10.1109/TVCG.2018.2830759",
        retenu: "Alterner vue d'ensemble et objet singulier, et exposer l'incertitude des données de collection." },
      { titre: "Exploring massive image collections with ImagePlot", auteurs: "L. Manovich", publication: "IPAM, UCLA", url: "https://www.ipam.ucla.edu/abstract/?tid=10210",
        retenu: "Montrer les images elles-mêmes plutôt que des marques qui les remplacent." },
      { titre: "Magnum Contact Sheets", auteurs: "K. Lubben (dir.)", publication: "Thames & Hudson, 2011", url: "https://www.lensculture.com/books/1274-magnum-contact-sheets",
        retenu: "Le vocabulaire de la planche : vues numérotées sur fond noir, lues dans l'ordre, et la sélection qui s'y marque." },
    ],
  },
  {
    theme: "Animation et narration",
    items: [
      { titre: "Effectiveness of Animation in Trend Visualization", auteurs: "G. Robertson, R. Fernandez, D. Fisher, B. Lee, J. Stasko", publication: "IEEE TVCG 14(6), 2008", url: "https://doi.org/10.1109/TVCG.2008.125",
        retenu: "L'animation plaît mais trompe en analyse ; les traces et les petits multiples sont plus justes. D'où la traînée, le curseur, et la vue Temps en petits multiples à côté de la séquence." },
      { titre: "What to consider when using text in data visualizations", auteurs: "L. C. Muth (Datawrapper)", publication: "2022", url: "https://www.datawrapper.de/blog/text-in-data-visualizations",
        retenu: "Titres qui affirment, légendes au plus près des marques, notes et sources dans le graphique exporté." },
      { titre: "Narrative Intelligence : NATO Information Environment", auteurs: "opsci.ai", publication: "2026", url: "https://narrative-intelligence.systems/",
        retenu: "Référence directe du brief : une affirmation, puis sa preuve ; sections numérotées ; limites dites dans le corps du rapport." },
    ],
  },
  {
    theme: "Couleur, typographie, technique",
    items: [
      { titre: "A Physiologically-based Model for Simulation of Color Vision Deficiency", auteurs: "G. Machado, M. Oliveira, L. Fernandes", publication: "IEEE TVCG 15(6), 2009", url: "https://doi.org/10.1109/TVCG.2009.113",
        retenu: "Simulation protan et deutan utilisée pour valider la palette des familles et la coloration des clusters voisins." },
      { titre: "Newsreader", auteurs: "Production Type", publication: "police OFL", url: "https://github.com/productiontype/Newsreader",
        retenu: "Dessinée pour la lecture de presse à l'écran : titres et chiffres en vedette." },
      { titre: "Libre Franklin", auteurs: "Impallari Type et al.", publication: "police OFL", url: "https://github.com/googlefonts/Libre-Franklin",
        retenu: "Une Franklin Gothic : la famille des pages graphiques de la presse, dense et lisible en petit corps." },
      { titre: "GitHub Pages limits", auteurs: "GitHub", publication: "documentation", url: "https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits",
        retenu: "Site publié limité à 1 Go : vignettes de 9 Ko au lieu des originaux de 148 Ko." },
      { titre: "HTMLCanvasElement.captureStream() et MediaRecorder", auteurs: "MDN", publication: "documentation", url: "https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream",
        retenu: "Export vidéo de la séquence sans bibliothèque." },
    ],
  },
];
