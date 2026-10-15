"""Génère les données du dashboard à partir des CSV du dépôt.

    python scripts/build_vignettes.py   # d'abord : vignettes + empreintes
    python scripts/build_data.py        # ensuite : tout ce qui est dans data/
    python scripts/verifier_build.py    # enfin : revérifie les totaux

Entrées (jamais modifiées)
    clusters.csv, document_to_cluster.csv, documents_and_blob_url.csv
    brief/data-derivee/clusters_enrichis.csv, brief/data-derivee/cluster_x_famille.csv
    annotations/lecture_clusters.csv     lecture manuelle des 64 clusters
    annotations/evenements.json          événements datés et sourcés
    vignettes/index.csv                  produit par build_vignettes.py

Sorties (data/)
    points.bin       une ligne par image, en colonnes binaires (voir meta.json)
    posts.bin        identifiant de chaque post (pour le lien vers X)
    meta.json        totaux, disposition des fichiers binaires, palettes
    clusters.json    une fiche par cluster, bruit compris (id -1)
    echantillon.json les 4 859 images disponibles en local
    originaux.json   nom du fichier d'origine de chaque image locale (chargé à la demande)
    evenements.json  copie validée de annotations/evenements.json

Les quatre pièges de parsing décrits dans brief/DONNEES.md sont traités dans
lire_csv() et normalise_cluster(). Toute incohérence arrête le script : on ne
génère pas de données fausses en silence.

Dépendances : numpy. Bibliothèque standard pour le reste.
"""

import csv
import datetime as dt
import hashlib
import json
import math
import os
import sys

import numpy as np

sys.stdout.reconfigure(encoding="utf-8")

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SORTIE = os.path.join(RACINE, "data")

FAMILLES = ["Media", "Officials", "Vectors", "Influencers"]
JOUR0 = dt.datetime(2026, 9, 1)
NB_JOURS = 29
SEUIL_DOUBLON = 4          # distance de Hamming maximale entre deux dHash
SANS_ECHANTILLON = 0xFFFF  # valeur de la colonne sample pour une image non locale

# Couleurs réservées aux familles : validées sur fond #f5f3ee, toutes paires,
# protanopie et deutéranopie (Machado 2009). Voir CONCEPTION.md.
COULEURS_FAMILLES = {"Media": "#2b6cb0", "Officials": "#d69a16",
                     "Vectors": "#cf3d2e", "Influencers": "#1b9e8f"}
# Teintes du mode « par cluster » : attribuées par coloration de graphe.
PALETTE_CLUSTERS = ["#3d6fb6", "#d0662a", "#2f9468", "#c4961f",
                    "#9a5cb4", "#c4466f", "#6e7d24", "#1d87a6"]


def arret(message):
    sys.exit(f"ERREUR : {message}")


def verifie(condition, message):
    if not condition:
        arret(message)


# --------------------------------------------------------------------------
# Lecture
# --------------------------------------------------------------------------

def lire_csv(chemin_relatif):
    """Lit un CSV du dépôt. newline='' neutralise CRLF comme LF."""
    chemin = os.path.join(RACINE, chemin_relatif)
    verifie(os.path.exists(chemin), f"fichier introuvable : {chemin_relatif}")
    with open(chemin, newline="", encoding="utf-8") as f:
        lignes = [{k.strip(): (v.strip() if isinstance(v, str) else v) for k, v in r.items()}
                  for r in csv.DictReader(f)]
    return lignes


def normalise_cluster(valeur):
    """'-1, "61" et 61 désignent le même cluster selon le fichier."""
    return int(str(valeur).strip().strip("'\""))


def empreinte_fichier(chemin_relatif):
    h = hashlib.sha256()
    with open(os.path.join(RACINE, chemin_relatif), "rb") as f:
        for bloc in iter(lambda: f.read(1 << 20), b""):
            h.update(bloc)
    return h.hexdigest()


# --------------------------------------------------------------------------
# Couleurs : OKLab et simulation de daltonisme (Machado, Oliveira, Fernandes 2009)
# --------------------------------------------------------------------------

def hex_vers_lineaire(hexa):
    rgb = [int(hexa[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return np.array([c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb])


def oklab(lin):
    l, m, s = (np.array([[0.4122214708, 0.5363325363, 0.0514459929],
                         [0.2119034982, 0.6806995451, 0.1073969566],
                         [0.0883024619, 0.2817188376, 0.6299787005]]) @ lin)
    l_, m_, s_ = np.cbrt([l, m, s])
    return np.array([0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
                     1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
                     0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_])


MACHADO = {
    "protan": np.array([[0.152286, 1.052583, -0.204868],
                        [0.114503, 0.786281, 0.099216],
                        [-0.003882, -0.048116, 1.051998]]),
    "deutan": np.array([[0.367322, 0.860646, -0.227968],
                        [0.280085, 0.672501, 0.047413],
                        [-0.011820, 0.042940, 0.968881]]),
}


def ecart_perceptif(a, b):
    """Plus petit ΔE OKLab (×100) entre deux couleurs, en vision normale,
    protanope et deutéranope. Sert à éviter deux voisins confondables."""
    la, lb = hex_vers_lineaire(a), hex_vers_lineaire(b)
    ecarts = [np.linalg.norm(oklab(la) - oklab(lb)) * 100]
    for m in MACHADO.values():
        sa, sb = np.clip(m @ la, 0, 1), np.clip(m @ lb, 0, 1)
        ecarts.append(np.linalg.norm(oklab(sa) - oklab(sb)) * 100)
    return min(ecarts)


# --------------------------------------------------------------------------
# Chargement et contrôles
# --------------------------------------------------------------------------

def charge():
    clusters = lire_csv("clusters.csv")
    topics = lire_csv("document_to_cluster.csv")
    docs = lire_csv("documents_and_blob_url.csv")
    enrichis = lire_csv("brief/data-derivee/clusters_enrichis.csv")
    familles = lire_csv("brief/data-derivee/cluster_x_famille.csv")
    lecture = lire_csv("annotations/lecture_clusters.csv")
    index_vignettes = lire_csv("vignettes/index.csv")

    labels = {normalise_cluster(r["cluster_id"]): r["cluster_label"] for r in clusters}
    verifie(labels.get(-1) == "DELETE", "la ligne du bruit de clusters.csv n'a pas été reconnue")
    verifie(len(labels) == 65 and set(labels) == set(range(-1, 64)), "clusters.csv : 65 identifiants attendus, de -1 à 63")

    par_doc = {}
    for r in docs:
        par_doc[r["document_id"]] = r
    verifie(len(par_doc) == len(docs), "document_id en double dans documents_and_blob_url.csv")
    verifie(len(topics) == len(docs), "les deux gros CSV n'ont pas le même nombre de lignes")

    lignes = []
    for t in topics:
        d = par_doc.get(t["document_id"])
        verifie(d is not None, f"document {t['document_id']} absent de documents_and_blob_url.csv")
        c1, c2 = normalise_cluster(t["cluster_id"]), normalise_cluster(d["cluster_id"])
        verifie(c1 == c2, f"document {t['document_id']} : cluster {c1} d'un côté, {c2} de l'autre")
        quand = dt.datetime.strptime(d["created_at"][:19], "%Y-%m-%d %H:%M:%S")
        url = d["url"]
        verifie(url.startswith("https://twitter.com/i/web/status/"), f"forme d'URL inattendue : {url}")
        lignes.append({
            "document_id": int(t["document_id"]),
            "cluster": c1,
            "prob": float(t["probability"]),
            "x": float(t["umap_x"]),
            "y": float(t["umap_y"]),
            "quand": quand,
            "eng": int(d["engagements"]),
            "tweet": int(url.rsplit("/", 1)[1]),
            "blob": d["blob_url"],
        })
    return labels, lignes, enrichis, familles, lecture, index_vignettes


# --------------------------------------------------------------------------
# Calculs
# --------------------------------------------------------------------------

def quantiles(valeurs, qs):
    if len(valeurs) == 0:
        return [0.0 for _ in qs]
    return [float(np.quantile(valeurs, q)) for q in qs]


def entropie_normalisee(parts):
    p = np.array([x for x in parts if x > 0], dtype=float)
    p = p / p.sum()
    return float(-(p * np.log(p)).sum() / math.log(len(FAMILLES)))


def regime(serie, pic_sur_mediane, pct_pic, ratio_weekend):
    """Quatre rythmes, définis sur la série quotidienne (29 jours).

    événementiel : le pic vaut au moins 7 fois la médiane quotidienne, ou
                   concentre au moins 15 % du cluster en un jour
    semaine      : le week-end produit moins de la moitié d'un jour ouvré
    week-end     : le week-end produit plus de 1,8 fois un jour ouvré
    continu      : le reste
    Seuils choisis à la lecture des 64 séries (voir CONCEPTION.md).
    """
    if pic_sur_mediane >= 7 or pct_pic >= 15:
        return "evenementiel"
    if ratio_weekend < 0.5:
        return "semaine"
    if ratio_weekend > 1.8:
        return "weekend"
    return "continu"


def ancre_de_label(xs, ys, probs):
    """Point le plus dense du cœur du cluster, aligné sur un point réel.

    Le centre géométrique d'un cluster courbe peut tomber hors du cluster ;
    le pic de densité, lui, est toujours dans la masse.
    """
    coeur = probs >= np.quantile(probs, 0.5)
    cx, cy = xs[coeur], ys[coeur]
    x0, x1, y0, y1 = cx.min(), cx.max(), cy.min(), cy.max()
    n = 24
    h, ex, ey = np.histogram2d(cx, cy, bins=n, range=[[x0, x1 + 1e-9], [y0, y1 + 1e-9]])
    # lissage 3x3 pour ne pas tomber sur un pixel isolé
    hp = np.pad(h, 1)
    lisse = sum(hp[1 + dx:n + 1 + dx, 1 + dy:n + 1 + dy] for dx in (-1, 0, 1) for dy in (-1, 0, 1))
    i, j = np.unravel_index(np.argmax(lisse), lisse.shape)
    px, py = (ex[i] + ex[i + 1]) / 2, (ey[j] + ey[j + 1]) / 2
    k = np.argmin((cx - px) ** 2 + (cy - py) ** 2)
    return float(cx[k]), float(cy[k])


def coloration(ids, xs, ys, cl):
    """Attribue une teinte de PALETTE_CLUSTERS à chaque cluster.

    Deux clusters sont voisins si leurs points occupent des cases contiguës
    d'une grille de 200 x 200 sur la carte. On colore d'abord les clusters
    qui ont le plus de voisins ; chacun prend la teinte qui maximise l'écart
    perceptif minimal (daltonismes compris) avec ses voisins déjà colorés.
    """
    n = 200
    mx, my = xs.min(), ys.min()
    sx, sy = (xs.max() - mx) / (n - 1), (ys.max() - my) / (n - 1)
    gi = np.clip(((xs - mx) / sx).astype(int), 0, n - 1)
    gj = np.clip(((ys - my) / sy).astype(int), 0, n - 1)
    cases = {}
    for a, b, c in zip(gi, gj, cl):
        if c >= 0:
            cases.setdefault((a, b), set()).add(int(c))
    contact = {c: {} for c in ids}
    for (a, b), presents in cases.items():
        voisins = set(presents)
        for da in (-2, -1, 0, 1, 2):
            for db in (-2, -1, 0, 1, 2):
                voisins |= cases.get((a + da, b + db), set())
        for c in presents:
            for v in voisins:
                if v != c:
                    contact[c][v] = contact[c].get(v, 0) + 1

    ecarts = {(p, q): ecart_perceptif(p, q) for p in PALETTE_CLUSTERS for q in PALETTE_CLUSTERS}
    couleur, usage = {}, {p: 0 for p in PALETTE_CLUSTERS}
    for c in sorted(ids, key=lambda k: -len(contact[k])):
        meilleur = None
        for p in PALETTE_CLUSTERS:
            pires = [ecarts[(p, couleur[v])] for v in contact[c] if v in couleur]
            score = (min(pires) if pires else 999, -usage[p])
            if meilleur is None or score > meilleur[0]:
                meilleur = (score, p)
        couleur[c] = meilleur[1]
        usage[meilleur[1]] += 1
    pire = min((ecarts[(couleur[a], couleur[b])] for a in ids for b in contact[a]), default=None)
    return couleur, contact, pire


def groupes_doublons(empreintes):
    """Union-find des images dont les dHash diffèrent d'au plus SEUIL_DOUBLON bits."""
    h = np.array([int(e, 16) for e in empreintes], dtype=np.uint64)

    def popcount(x):
        x = x - ((x >> np.uint64(1)) & np.uint64(0x5555555555555555))
        x = (x & np.uint64(0x3333333333333333)) + ((x >> np.uint64(2)) & np.uint64(0x3333333333333333))
        x = (x + (x >> np.uint64(4))) & np.uint64(0x0F0F0F0F0F0F0F0F)
        return (x * np.uint64(0x0101010101010101)) >> np.uint64(56)

    parent = list(range(len(h)))

    def racine(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i in range(len(h) - 1):
        d = popcount(h[i] ^ h[i + 1:])
        for j in np.nonzero(d <= SEUIL_DOUBLON)[0]:
            parent[racine(i)] = racine(i + 1 + int(j))
    racines = [racine(i) for i in range(len(h))]
    tailles = {}
    for r in racines:
        tailles[r] = tailles.get(r, 0) + 1
    numeros, groupe = {}, []
    for r in racines:
        if tailles[r] > 1:
            numeros.setdefault(r, len(numeros))
            groupe.append(numeros[r])
        else:
            groupe.append(-1)
    return groupe


def main():
    labels, lignes, enrichis, familles, lecture, index_vignettes = charge()
    n = len(lignes)
    verifie(n == 65229, f"65 229 images attendues, {n} lues")

    cl = np.array([r["cluster"] for r in lignes], dtype=np.int16)
    xs = np.array([r["x"] for r in lignes])
    ys = np.array([r["y"] for r in lignes])
    probs = np.array([r["prob"] for r in lignes])
    eng = np.array([r["eng"] for r in lignes], dtype=np.int64)
    minutes = np.array([int((r["quand"] - JOUR0).total_seconds() // 60) for r in lignes])
    jours = minutes // 1440
    verifie(minutes.min() >= 0 and jours.max() == NB_JOURS - 1, "dates hors du 01/09 – 29/09")
    verifie((probs[cl == -1] == 0).all(), "probabilité non nulle sur un point de bruit")
    # HDBSCAN peut rattacher un point à un cluster avec une probabilité nulle
    # (263 points, tous dans le cluster 11) : on les garde, on les compte.
    proba_nulle_hors_bruit = np.bincount(cl[(cl >= 0) & (probs == 0)], minlength=64)

    # ----- posts : un tweet peut porter jusqu'à 4 images
    tweets = np.array([r["tweet"] for r in lignes], dtype=np.uint64)
    ids_posts, post = np.unique(tweets, return_inverse=True)
    nb_posts = len(ids_posts)
    verifie(nb_posts < 65536, "plus de 65 535 posts : passer la colonne post en 32 bits")
    eng_post = np.zeros(nb_posts, dtype=np.int64)
    eng_post[post] = eng
    verifie((eng_post[post] == eng).all(), "un même post porte des engagements différents selon l'image")
    images_par_post = np.bincount(post, minlength=nb_posts)

    # ----- échantillon local (10 % par cluster)
    blob_vers_ligne = {r["blob"]: i for i, r in enumerate(lignes)}
    echantillon = []
    for v in index_vignettes:
        i = blob_vers_ligne.get(v["blob_url"])
        verifie(i is not None, f"vignette sans ligne : {v['blob_url']}")
        verifie(lignes[i]["cluster"] == int(v["cluster_id"]), f"vignette rangée dans le mauvais cluster : {v['blob_url']}")
        echantillon.append((i, v))
    verifie(len(echantillon) == 4859, f"4 859 vignettes attendues, {len(echantillon)} dans l'index")
    groupe = groupes_doublons([v["dhash"] for _, v in echantillon])

    # ----- fiches de cluster
    enr = {normalise_cluster(r["cluster_id"]): r for r in enrichis}
    fam = {normalise_cluster(r["cluster_id"]): r for r in familles}
    lec = {int(r["cluster_id"]): r for r in lecture}
    verifie(set(lec) == set(range(64)), "annotations/lecture_clusters.csv doit couvrir les clusters 0 à 63")

    totaux_fam = {f: sum(int(fam[c][f]) for c in fam) for f in FAMILLES}
    total_corpus = sum(totaux_fam.values())
    verifie(total_corpus == n, "cluster_x_famille.csv ne totalise pas 65 229 images")
    part_corpus = {f: totaux_fam[f] / total_corpus for f in FAMILLES}

    weekend = np.array([(JOUR0 + dt.timedelta(days=d)).weekday() >= 5 for d in range(NB_JOURS)])

    fiches = []
    for c in range(-1, 64):
        masque = cl == c
        idx = np.nonzero(masque)[0]
        nc = len(idx)
        posts_c, premier = np.unique(post[idx], return_index=True)
        eng_c = eng[idx][premier]  # un engagement par post, dans ce cluster
        serie = np.bincount(jours[idx], minlength=NB_JOURS)

        # contrôles croisés avec les fichiers du brief
        e = enr[c]
        verifie(int(e["images"]) == nc, f"cluster {c} : {nc} images, le brief en annonce {e['images']}")
        verifie(int(e["engagements"]) == int(eng[idx].sum()), f"cluster {c} : somme d'engagements différente du brief")
        serie_brief = [int(v) for v in e["serie_quotidienne"].split("|")]
        verifie(serie_brief == serie.tolist(), f"cluster {c} : série quotidienne différente du brief")
        f = fam[c]
        comptes = [int(f[k]) for k in FAMILLES]
        verifie(sum(comptes) == nc, f"cluster {c} : familles ({sum(comptes)}) ≠ images ({nc})")
        verifie(comptes == [int(e[k.lower()]) for k in FAMILLES], f"cluster {c} : familles incohérentes entre les deux fichiers du brief")

        parts = [k / nc for k in comptes]
        attendu = [nc * part_corpus[k] for k in FAMILLES]
        ratios = [p / part_corpus[k] for p, k in zip(parts, FAMILLES)]
        residus = [(o - a) / math.sqrt(a) for o, a in zip(comptes, attendu)]
        dom = int(np.argmax(comptes))

        pic = int(np.argmax(serie))
        med_jour = float(np.median(serie))
        moyenne_semaine = serie[~weekend].mean()
        ratio_we = float(serie[weekend].mean() / moyenne_semaine) if moyenne_semaine > 0 else 0.0
        pic_sur_med = float(serie[pic] / max(med_jour, 0.5))
        pct_pic = float(100 * serie[pic] / nc)

        q50, q75, q90 = quantiles(eng_c, [0.5, 0.75, 0.9])
        somme_posts = int(eng_c.sum())
        multi = float((images_par_post[post[idx]] > 1).mean())

        # co-publication : autres clusters présents dans les mêmes posts
        autres = {}
        for j in np.nonzero(np.isin(post, posts_c) & (cl != c))[0]:
            autres.setdefault(int(cl[j]), set()).add(int(post[j]))
        cooc = sorted(((k, len(v)) for k, v in autres.items()), key=lambda kv: -kv[1])[:6]

        fiche = {
            "id": c,
            "label": "Non classé" if c == -1 else labels[c],
            "n": nc,
            "posts": int(len(posts_c)),
            "part": nc / n,
            "familles": comptes,
            "parts": parts,
            "ratios": ratios,
            "residus": residus,
            "dominante": dom,
            "part_dominante": parts[dom],
            "entropie": entropie_normalisee(comptes),
            "eng": {
                "somme_posts": somme_posts,
                "somme_images": int(eng[idx].sum()),
                "mediane": q50, "q75": q75, "q90": q90,
                "max": int(eng_c.max()),
                "part_premier": (int(eng_c.max()) / somme_posts) if somme_posts else 0.0,
                "part_zero": float((eng_c == 0).mean()),
            },
            "part_multi": multi,
            "serie": serie.tolist(),
            "pic": pic,
            "pct_pic": pct_pic,
            "jours_actifs": int((serie > 0).sum()),
            "pic_sur_mediane": pic_sur_med,
            "ratio_weekend": ratio_we,
            "regime": None if c == -1 else regime(serie, pic_sur_med, pct_pic, ratio_we),
            "copublication": cooc,
            "brief": {"eng_par_image": float(e["eng_par_image"])},
        }
        if c >= 0:
            fiche["logique"] = lec[c]["logique"]
            fiche["voit"] = lec[c]["ce_qu_on_voit"]
            fiche["note"] = lec[c]["note_sur_le_label"]
            ax, ay = ancre_de_label(xs[idx], ys[idx], probs[idx])
            coeur = idx[probs[idx] >= 0.5] if (probs[idx] >= 0.5).sum() >= 10 else idx
            fiche["ancre"] = [ax, ay]
            fiche["cadre"] = [float(np.quantile(xs[coeur], 0.02)), float(np.quantile(ys[coeur], 0.02)),
                              float(np.quantile(xs[coeur], 0.98)), float(np.quantile(ys[coeur], 0.98))]
        fiches.append(fiche)

    ids = list(range(64))
    couleurs, contact, pire_ecart = coloration(ids, xs, ys, cl)
    for fiche in fiches:
        if fiche["id"] >= 0:
            fiche["couleur"] = couleurs[fiche["id"]]
            fiche["voisins"] = sorted(contact[fiche["id"]], key=lambda v: -contact[fiche["id"]][v])[:8]
    print(f"coloration : pire écart entre clusters voisins ΔE {pire_ecart:.1f} (daltonismes compris)")

    # ----- points.bin : ordre de dessin = bruit d'abord, puis certitude croissante
    ordre = np.lexsort((probs, cl != -1))
    rang_ech = np.full(n, SANS_ECHANTILLON, dtype=np.uint16)
    ancres = {f["id"]: f["ancre"] for f in fiches if f["id"] >= 0}
    # rang dans la planche : certitude décroissante, puis proximité du pic de densité
    def cle_planche(iv):
        i = iv[0]
        ax, ay = ancres[lignes[i]["cluster"]]
        return (lignes[i]["cluster"], -lignes[i]["prob"], (xs[i] - ax) ** 2 + (ys[i] - ay) ** 2)
    echantillon_trie = sorted(echantillon, key=cle_planche)
    groupe_par_ligne = {echantillon[k][0]: groupe[k] for k in range(len(echantillon))}
    for k, (i, _) in enumerate(echantillon_trie):
        rang_ech[i] = k

    x0, x1 = float(xs.min()), float(xs.max())
    y0, y1 = float(ys.min()), float(ys.max())
    qx = np.round((xs - x0) / (x1 - x0) * 65535).astype(np.uint16)
    qy = np.round((ys - y0) / (y1 - y0) * 65535).astype(np.uint16)
    colonnes = [
        ("x", qx[ordre]), ("y", qy[ordre]),
        ("minute", minutes[ordre].astype(np.uint16)),
        ("post", post[ordre].astype(np.uint16)),
        ("sample", rang_ech[ordre]),
        ("eng", eng[ordre].astype(np.uint32)),
        ("cluster", cl[ordre].astype(np.int8)),
        ("prob", np.round(probs[ordre] * 255).astype(np.uint8)),
    ]
    os.makedirs(SORTIE, exist_ok=True)
    disposition, decalage = [], 0
    with open(os.path.join(SORTIE, "points.bin"), "wb") as f:
        for nom, tableau in colonnes:
            octets = tableau.astype(tableau.dtype.newbyteorder("<")).tobytes()
            f.write(octets)
            disposition.append({"nom": nom, "type": tableau.dtype.name, "decalage": decalage})
            decalage += len(octets)
            bourrage = (-decalage) % 8
            f.write(b"\0" * bourrage)
            decalage += bourrage

    # posts.bin : identifiants 64 bits, puis nombre d'images (8 bits)
    with open(os.path.join(SORTIE, "posts.bin"), "wb") as f:
        f.write(ids_posts.astype("<u8").tobytes())
        f.write(images_par_post.astype(np.uint8).tobytes())

    # ----- échantillon : une entrée par image locale, dans l'ordre des planches
    position = np.empty(n, dtype=np.int64)
    position[ordre] = np.arange(n)
    lignes_ech, originaux = [], {}
    for k, (i, v) in enumerate(echantillon_trie):
        lignes_ech.append([
            int(position[i]),                       # index du point dans points.bin
            int(v["document_id"]),
            int(v["vignette_largeur"]), int(v["vignette_hauteur"]),
            int(v["largeur"]), int(v["hauteur"]),
            groupe_par_ligne[i],                     # groupe de quasi-doublons, -1 sinon
        ])
        originaux[v["document_id"]] = v["blob_url"]
    for fiche in fiches:
        fiche["echantillon"] = [k for k, (i, _) in enumerate(echantillon_trie) if lignes[i]["cluster"] == fiche["id"]]

    # ----- événements
    with open(os.path.join(RACINE, "annotations", "evenements.json"), encoding="utf-8") as f:
        evenements = json.load(f)["evenements"]
    for ev in evenements:
        jour = dt.date.fromisoformat(ev["date"])
        verifie(dt.date(2026, 9, 1) <= jour <= dt.date(2026, 9, 29), f"événement hors période : {ev['id']}")
        verifie(ev["sources"] and all(s["url"].startswith("https://") for s in ev["sources"]),
                f"événement sans source exploitable : {ev['id']}")
        verifie(all(0 <= c < 64 for c in ev["clusters"]), f"cluster inconnu dans {ev['id']}")
        ev["jour"] = (jour - dt.date(2026, 9, 1)).days

    # ----- totaux
    eng_posts_total = int(eng_post.sum())
    bruit = cl == -1
    jour_par_post = np.zeros(nb_posts, dtype=np.int64)
    jour_par_post[post] = jours
    meta = {
        "genere_le": dt.datetime.now().astimezone().isoformat(timespec="seconds"),
        "entrees": {nom: empreinte_fichier(nom) for nom in [
            "clusters.csv", "document_to_cluster.csv", "documents_and_blob_url.csv",
            "brief/data-derivee/clusters_enrichis.csv", "brief/data-derivee/cluster_x_famille.csv",
            "annotations/lecture_clusters.csv", "annotations/evenements.json", "vignettes/index.csv"]},
        "totaux": {
            "images": n,
            "posts": nb_posts,
            "posts_multi_images": int((images_par_post > 1).sum()),
            "images_dans_posts_multi": int((images_par_post[post] > 1).sum()),
            "clusters": 64,
            "bruit": int(bruit.sum()),
            "posts_bruit_seul": int(len(np.setdiff1d(np.unique(post[bruit]), np.unique(post[~bruit])))),
            "jours": NB_JOURS,
            "engagements_par_post": eng_posts_total,
            "engagements_par_image": int(eng.sum()),
            "mediane_engagement_post": float(np.median(eng_post)),
            "part_posts_zero": float((eng_post == 0).mean()),
            "images_locales": len(echantillon),
            "groupes_doublons": int(max(groupe) + 1),
            "images_en_doublon": int(sum(1 for g in groupe if g >= 0)),
            "proba_nulle_hors_bruit": {str(c): int(k) for c, k in enumerate(proba_nulle_hors_bruit) if k},
        },
        "familles": [{"nom": k, "images": totaux_fam[k], "part": part_corpus[k],
                      "bruit": int(fam[-1][k]), "taux_bruit": int(fam[-1][k]) / totaux_fam[k],
                      "couleur": COULEURS_FAMILLES[k]} for k in FAMILLES],
        "jours": [{"date": (JOUR0 + dt.timedelta(days=d)).date().isoformat(), "weekend": bool(weekend[d]),
                   "images": int((jours == d).sum()), "bruit": int(((jours == d) & bruit).sum()),
                   "posts": int((jour_par_post == d).sum()),
                   "engagements": int(eng_post[jour_par_post == d].sum())} for d in range(NB_JOURS)],
        "bornes": {"x0": x0, "x1": x1, "y0": y0, "y1": y1},
        "points": {"fichier": "points.bin", "n": n, "colonnes": disposition,
                   "sans_echantillon": SANS_ECHANTILLON,
                   "note": "x, y quantifiés sur 16 bits entre les bornes ; minute depuis le 01/09/2026 00:00 ; prob sur 0..255"},
        "posts": {"fichier": "posts.bin", "n": nb_posts,
                  "colonnes": [{"nom": "id", "type": "uint64", "decalage": 0},
                               {"nom": "images", "type": "uint8", "decalage": 8 * nb_posts}]},
        "echantillon": {"colonnes": ["point", "document_id", "vignette_l", "vignette_h", "original_l", "original_h", "groupe_doublon"],
                        "seuil_doublon_bits": SEUIL_DOUBLON},
        "palette_clusters": PALETTE_CLUSTERS,
        "coloration_pire_ecart": pire_ecart,
    }

    def ecrit(nom, objet):
        with open(os.path.join(SORTIE, nom), "w", encoding="utf-8", newline="\n") as f:
            json.dump(objet, f, ensure_ascii=False, separators=(",", ":"))

    def arrondi(o):
        if isinstance(o, float):
            return round(o, 4)
        if isinstance(o, list):
            return [arrondi(v) for v in o]
        if isinstance(o, dict):
            return {k: arrondi(v) for k, v in o.items()}
        return o

    ecrit("meta.json", arrondi(meta))
    ecrit("clusters.json", arrondi(fiches))
    ecrit("echantillon.json", lignes_ech)
    ecrit("originaux.json", originaux)
    ecrit("evenements.json", evenements)

    t = meta["totaux"]
    print(f"{t['images']} images, {t['posts']} posts ({t['posts_multi_images']} à plusieurs images)")
    print(f"engagements : {t['engagements_par_post']:,} par post, {t['engagements_par_image']:,} par image".replace(",", " "))
    print(f"{t['images_locales']} images locales, {t['groupes_doublons']} groupes de quasi-doublons ({t['images_en_doublon']} images)")
    for nom in sorted(os.listdir(SORTIE)):
        print(f"  data/{nom:<18} {os.path.getsize(os.path.join(SORTIE, nom)) / 1024:>8.0f} Ko")


if __name__ == "__main__":
    main()
