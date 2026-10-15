"""Verifie que les donnees du depot sont bien celles decrites dans BRIEF.txt.

A lancer EN PREMIER, avant d'ecrire la moindre ligne du dashboard :

    python brief/verifier_donnees.py

Aucune dependance, bibliotheque standard uniquement.

Ce script sert a deux choses. D'abord a confirmer que rien n'a bouge depuis la
redaction du brief. Ensuite, et surtout, a te montrer comment charger les fichiers
SANS tomber dans les quatre pieges de parsing decrits dans DONNEES.md : le CRLF,
les guillemets incoherents sur cluster_id, la ligne -1 malformee, et le label
DELETE qui n'est pas un nom de cluster.

Si un controle echoue, ne contourne pas : les donnees ont change et le brief est
peut-etre perime sur ce point. Signale-le.
"""

import collections
import csv
import os
import statistics
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGES = os.path.join(RACINE, "images_691_echantillon")

ATTENDU = {
    "images": 65229,
    "clusters_nommes": 64,
    "bruit": 16916,
    "jours": 29,
    "premier_jour": "2026-09-01",
    "dernier_jour": "2026-09-29",
    "engagements": 8393806,
    "images_locales": 4859,
}

ok = True


def verifie(libelle, obtenu, attendu):
    global ok
    bon = obtenu == attendu
    ok = ok and bon
    etat = "OK  " if bon else "ECHEC"
    print(f"  [{etat}] {libelle:<44} {obtenu}" + ("" if bon else f"   (attendu {attendu})"))


def lire(nom):
    """Ouvre un CSV du depot en neutralisant le CRLF.

    newline='' est obligatoire : sans lui, le module csv et les terminaisons
    \\r\\n se combinent mal et la derniere colonne de chaque ligne garde un \\r.
    """
    chemin = os.path.join(RACINE, nom)
    if not os.path.exists(chemin):
        sys.exit(f"Fichier introuvable : {chemin}")
    with open(chemin, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def normalise_cluster(valeur):
    """Rend un cluster_id comparable d'un fichier a l'autre.

    clusters.csv et document_to_cluster.csv entourent l'identifiant de guillemets,
    documents_and_blob_url.csv ne le fait pas, et la ligne du bruit dans
    clusters.csv porte une apostrophe parasite ('-1). Sans cette normalisation la
    jointure echoue en silence sur TOUS les clusters.
    """
    return valeur.strip().strip("'\"")


print("\n=== 1. chargement ===")
clusters = lire("clusters.csv")
topics = lire("document_to_cluster.csv")
docs = lire("documents_and_blob_url.csv")
print(f"  clusters.csv               {len(clusters):>6} lignes")
print(f"  document_to_cluster.csv    {len(topics):>6} lignes")
print(f"  documents_and_blob_url.csv {len(docs):>6} lignes")

print("\n=== 2. volumetrie ===")
verifie("images dans document_to_cluster", len(topics), ATTENDU["images"])
verifie("images dans documents_and_blob_url", len(docs), ATTENDU["images"])

labels = {normalise_cluster(r["cluster_id"]): r["cluster_label"] for r in clusters}
nommes = {c: l for c, l in labels.items() if c != "-1"}
verifie("clusters nommes (hors bruit)", len(nommes), ATTENDU["clusters_nommes"])

bruit = sum(1 for r in docs if normalise_cluster(r["cluster_id"]) == "-1")
verifie("images non classees (bruit)", bruit, ATTENDU["bruit"])
print(f"         soit {100 * bruit / len(docs):.1f} % du corpus")

print("\n=== 3. pieges de parsing ===")
verifie("la ligne du bruit est bien recuperee", labels.get("-1"), "DELETE")
print("         rappel : DELETE n'est PAS un nom de cluster, ne jamais l'afficher")

bruts = {r["cluster_id"] for r in clusters} | {r["cluster_id"] for r in docs}
normalises = {normalise_cluster(v) for v in bruts}
print(f"  [INFO ] formes brutes de cluster_id            {len(bruts)}")
print(f"  [INFO ] apres normalisation                    {len(normalises)}")
if len(bruts) > len(normalises):
    print("         -> les guillemets different d'un fichier a l'autre, normalise toujours")

print("\n=== 4. jointures ===")
ids_topics = {r["document_id"] for r in topics}
ids_docs = {r["document_id"] for r in docs}
verifie("document_id communs aux deux CSV", len(ids_topics & ids_docs), ATTENDU["images"])
verifie("document_id presents dans un seul", len(ids_topics ^ ids_docs), 0)

utilises = {normalise_cluster(r["cluster_id"]) for r in topics}
verifie("cluster_id utilises sans label", len(utilises - set(labels)), 0)

print("\n=== 5. dates ===")
jours = [r["created_at"][:10] for r in docs if r["created_at"]]
verifie("dates manquantes", len(docs) - len(jours), 0)
verifie("jours distincts", len(set(jours)), ATTENDU["jours"])
verifie("premier jour", min(jours), ATTENDU["premier_jour"])
verifie("dernier jour", max(jours), ATTENDU["dernier_jour"])

print("\n=== 6. engagements ===")
eng = [int(r["engagements"]) for r in docs if r["engagements"].strip().isdigit()]
verifie("total des engagements", sum(eng), ATTENDU["engagements"])
moyenne = statistics.mean(eng)
mediane = statistics.median(eng)
print(f"  [INFO ] mediane {mediane:.0f}   moyenne {moyenne:.1f}   max {max(eng):,}")
print(f"         la moyenne vaut {moyenne / mediane:.0f} fois la mediane : distribution")
print("         tres asymetrique, n'affiche JAMAIS de moyenne d'engagements")

print("\n=== 7. images locales ===")
if os.path.isdir(IMAGES):
    sur_disque = {}
    for dossier in os.listdir(IMAGES):
        chemin = os.path.join(IMAGES, dossier)
        if os.path.isdir(chemin):
            sur_disque[dossier] = set(os.listdir(chemin))
    total = sum(len(v) for v in sur_disque.values())
    verifie("fichiers images", total, ATTENDU["images_locales"])
    verifie("dossiers (un par cluster nomme)", len(sur_disque), ATTENDU["clusters_nommes"])

    attendus = collections.defaultdict(set)
    for r in docs:
        attendus[normalise_cluster(r["cluster_id"])].add(r["blob_url"])
    orphelins = sum(len(f - attendus.get(c, set())) for c, f in sur_disque.items())
    verifie("images sans ligne correspondante", orphelins, 0)

    poids = sum(
        os.path.getsize(os.path.join(IMAGES, c, f))
        for c, fichiers in sur_disque.items() for f in fichiers
    )
    print(f"  [INFO ] poids total {poids / 1024 ** 2:.0f} Mo")
    print("         GitHub Pages refuse de publier au-dela de 1 Go, et le depot")
    print("         est deja proche de la limite : genere des vignettes avant")
    print("         d'ajouter quoi que ce soit de lourd (voir BRIEF.txt section 9.1)")
else:
    print(f"  [INFO ] dossier absent : {IMAGES}")

print("\n=== 8. donnees derivees ===")
derivee = os.path.join(RACINE, "brief", "data-derivee", "clusters_enrichis.csv")
if os.path.exists(derivee):
    with open(derivee, newline="", encoding="utf-8") as f:
        enrichis = list(csv.DictReader(f))
    verifie("lignes dans clusters_enrichis.csv", len(enrichis), 65)
    mauvais = [
        r["cluster_id"] for r in enrichis
        if len(r["serie_quotidienne"].split("|")) != ATTENDU["jours"]
    ]
    verifie("series quotidiennes a 29 valeurs", len(mauvais), 0)
    somme = sum(sum(int(v) for v in r["serie_quotidienne"].split("|")) for r in enrichis)
    verifie("somme des series = nombre d'images", somme, ATTENDU["images"])
else:
    print(f"  [INFO ] fichier absent : {derivee}")

print()
if ok:
    print("Tous les controles passent. Les chiffres de BRIEF.txt sont a jour.")
else:
    print("AU MOINS UN CONTROLE A ECHOUE.")
    print("Les donnees ont change depuis la redaction du brief. Ne contourne pas,")
    print("signale-le : une partie du brief est peut-etre perimee.")
sys.exit(0 if ok else 1)
