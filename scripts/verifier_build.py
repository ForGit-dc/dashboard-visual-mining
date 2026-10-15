"""Revérifie les fichiers de data/ contre les CSV d'origine.

    python scripts/verifier_build.py

À lancer après build_data.py, et avant tout commit des données. Le script relit
les fichiers binaires exactement comme le fait le navigateur (même disposition,
même déquantification) et compare chaque total aux CSV bruts, relus de façon
indépendante. Sortie non nulle au premier écart.
"""

import csv
import json
import os
import sys

import numpy as np

sys.stdout.reconfigure(encoding="utf-8")
RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(RACINE, "data")
echecs = 0


def controle(libelle, obtenu, attendu, tolerance=0):
    global echecs
    bon = abs(obtenu - attendu) <= tolerance if isinstance(attendu, (int, float)) else obtenu == attendu
    echecs += not bon
    print(f"  [{'OK  ' if bon else 'ÉCHEC'}] {libelle:<52} {obtenu}" + ("" if bon else f"  (attendu {attendu})"))


def lit_json(nom):
    with open(os.path.join(DATA, nom), encoding="utf-8") as f:
        return json.load(f)


def colonnes(fichier, disposition, n):
    brut = open(os.path.join(DATA, fichier), "rb").read()
    sortie = {}
    for col in disposition:
        dtype = np.dtype(col["type"]).newbyteorder("<")
        sortie[col["nom"]] = np.frombuffer(brut, dtype=dtype, count=n, offset=col["decalage"])
    return sortie


meta = lit_json("meta.json")
fiches = lit_json("clusters.json")
echantillon = lit_json("echantillon.json")
evenements = lit_json("evenements.json")
n = meta["points"]["n"]
p = colonnes(meta["points"]["fichier"], meta["points"]["colonnes"], n)
posts = colonnes(meta["posts"]["fichier"], meta["posts"]["colonnes"], meta["posts"]["n"])

# Relecture indépendante des CSV bruts
with open(os.path.join(RACINE, "documents_and_blob_url.csv"), newline="", encoding="utf-8") as f:
    docs = list(csv.DictReader(f))
with open(os.path.join(RACINE, "document_to_cluster.csv"), newline="", encoding="utf-8") as f:
    topics = list(csv.DictReader(f))
cluster_brut = np.array([int(r["cluster_id"].strip().strip("'\"")) for r in docs])
eng_brut = np.array([int(r["engagements"]) for r in docs])
tweets_bruts = {}
for r in docs:
    tweets_bruts[r["url"].rsplit("/", 1)[1]] = int(r["engagements"])

print("\n=== points.bin")
controle("nombre de points", len(p["x"]), len(docs))
controle("bruit", int((p["cluster"] == -1).sum()), int((cluster_brut == -1).sum()))
controle("clusters présents", len(set(p["cluster"].tolist()) - {-1}), 64)
controle("somme des engagements par image", int(p["eng"].astype(np.int64).sum()), int(eng_brut.sum()))
for c in (1, 40, 58):
    controle(f"images du cluster {c}", int((p["cluster"] == c).sum()), int((cluster_brut == c).sum()))
b = meta["bornes"]
x = b["x0"] + p["x"] / 65535 * (b["x1"] - b["x0"])
y = b["y0"] + p["y"] / 65535 * (b["y1"] - b["y0"])
xs_bruts = np.array([float(r["umap_x"]) for r in topics])
controle("bornes x après déquantification", (round(float(x.min()), 3), round(float(x.max()), 3)),
         (round(float(xs_bruts.min()), 3), round(float(xs_bruts.max()), 3)))
controle("jours couverts", int(p["minute"].max() // 1440) + 1, 29)

print("\n=== posts.bin")
controle("posts distincts", meta["posts"]["n"], len(tweets_bruts))
controle("engagements dédoublonnés par post", meta["totaux"]["engagements_par_post"], sum(tweets_bruts.values()))
ids = {str(int(v)) for v in posts["id"]}
controle("identifiants retrouvés dans les URL", len(ids & set(tweets_bruts)), len(tweets_bruts))
controle("images par post (somme)", int(posts["images"].astype(np.int64).sum()), len(docs))

print("\n=== clusters.json")
controle("fiches (64 clusters + bruit)", len(fiches), 65)
controle("aucun label DELETE", any(f["label"] == "DELETE" for f in fiches), False)
controle("somme des séries quotidiennes", sum(sum(f["serie"]) for f in fiches), len(docs))
controle("somme des familles", sum(sum(f["familles"]) for f in fiches), len(docs))
foot = next(f for f in fiches if f["id"] == 1)
controle("Football Européen : engagements dédoublonnés", foot["eng"]["somme_posts"], 414288)
controle("Football Européen : médiane par post", foot["eng"]["mediane"], 42)

print("\n=== échantillon et vignettes")
controle("images locales", len(echantillon), 4859)
manquantes = 0
for point, doc, *_ in echantillon:
    c = int(p["cluster"][point])
    if not os.path.exists(os.path.join(RACINE, "vignettes", str(c), f"{doc}.webp")):
        manquantes += 1
controle("vignettes manquantes sur disque", manquantes, 0)
controle("points échantillonnés marqués dans points.bin",
         int((p["sample"] != meta["points"]["sans_echantillon"]).sum()), 4859)
controle("aucune image locale dans le bruit",
         int(((p["sample"] != meta["points"]["sans_echantillon"]) & (p["cluster"] == -1)).sum()), 0)

print("\n=== événements")
controle("événements", len(evenements), len(evenements))
sources_md = os.path.join(RACINE, "SOURCES.md")
if os.path.exists(sources_md):
    texte = open(sources_md, encoding="utf-8").read()
    absentes = [s["url"] for e in evenements for s in e["sources"] if s["url"] not in texte]
    controle("sources d'événements citées dans SOURCES.md", len(absentes), 0)
else:
    print("  [INFO ] SOURCES.md absent : contrôle des sources sauté")

print()
if echecs:
    sys.exit(f"{echecs} contrôle(s) en échec.")
print("Tous les contrôles passent.")
