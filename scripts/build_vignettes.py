"""Génère les vignettes WebP et les empreintes perceptuelles de l'échantillon.

    python scripts/build_vignettes.py            # tout régénérer
    python scripts/build_vignettes.py --manquantes   # seulement les vignettes absentes

Entrées
    images_691_echantillon/<cluster>/<blob_url>   les 4 859 images d'origine
    documents_and_blob_url.csv                    pour retrouver le document_id

Sorties
    vignettes/<cluster>/<document_id>.webp        256 px sur le grand côté, WebP q80
    vignettes/index.csv                           une ligne par image : dimensions,
                                                  poids, empreinte dHash 64 bits

Les vignettes sont nommées par document_id et non par hash : le navigateur
connaît le document_id de chaque point, pas le hash. La correspondance avec le
fichier d'origine est dans index.csv (colonne blob_url).

L'empreinte dHash sert au détecteur de quasi-doublons : on réduit l'image en
niveaux de gris à 9 x 8 pixels et on compare chaque pixel à son voisin de
droite, ce qui donne 64 bits robustes au recadrage léger et à la recompression.
Elle est calculée sur l'image d'origine, pas sur la vignette.

Bibliothèque : Pillow (avec WebP). Pas d'autre dépendance.
"""

import argparse
import csv
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor

from PIL import Image, ImageOps

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGINAUX = os.path.join(RACINE, "images_691_echantillon")
SORTIE = os.path.join(RACINE, "vignettes")
COTE = 256
QUALITE = 80
PAPIER = (245, 243, 238)  # fond de page, pour aplatir les PNG transparents


def normalise_cluster(valeur):
    return valeur.strip().strip("'\"")


def charge_documents():
    """blob_url -> document_id, en lisant le CSV comme le fait build_data.py."""
    chemin = os.path.join(RACINE, "documents_and_blob_url.csv")
    with open(chemin, newline="", encoding="utf-8") as f:
        return {r["blob_url"].strip(): (r["document_id"].strip(), normalise_cluster(r["cluster_id"]))
                for r in csv.DictReader(f)}


def dhash(image):
    gris = image.convert("L").resize((9, 8), Image.LANCZOS)
    px = list(gris.getdata())
    bits = 0
    for ligne in range(8):
        for col in range(8):
            gauche = px[ligne * 9 + col]
            droite = px[ligne * 9 + col + 1]
            bits = (bits << 1) | (1 if droite > gauche else 0)
    return f"{bits:016x}"


def ouvre_rgb(source):
    """Ouvre une image d'origine en RGB, orientation EXIF appliquée.

    Les PNG transparents sont aplatis sur le fond papier de l'interface, sinon
    la transparence deviendrait du noir dans la vignette.
    """
    im = ImageOps.exif_transpose(Image.open(source))
    if im.mode in ("P", "LA", "RGBA") or "transparency" in im.info:
        im = im.convert("RGBA")
        fond = Image.new("RGB", im.size, PAPIER)
        fond.paste(im, mask=im.split()[-1])
        return fond
    return im.convert("RGB")


def traite(tache):
    """Écrit la vignette (sauf si ecrire=False) et renvoie la ligne d'index."""
    source, cible, ecrire = tache
    im = ouvre_rgb(source)
    largeur, hauteur = im.size
    empreinte = dhash(im)
    if ecrire:
        im.thumbnail((COTE, COTE), Image.LANCZOS)
        os.makedirs(os.path.dirname(cible), exist_ok=True)
        im.save(cible, "WEBP", quality=QUALITE, method=6)
    with Image.open(cible) as v:
        v_largeur, v_hauteur = v.size
    return largeur, hauteur, v_largeur, v_hauteur, os.path.getsize(cible), empreinte


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--manquantes", action="store_true",
                        help="ne traite que les vignettes absentes (l'index est réécrit en entier)")
    args = parser.parse_args()

    documents = charge_documents()
    taches, lignes = [], []
    for dossier in sorted(os.listdir(ORIGINAUX), key=int):
        for nom in sorted(os.listdir(os.path.join(ORIGINAUX, dossier))):
            if nom not in documents:
                sys.exit(f"Image sans ligne dans documents_and_blob_url.csv : {dossier}/{nom}")
            document_id, cluster = documents[nom]
            if cluster != dossier:
                sys.exit(f"{nom} est rangée dans {dossier} mais le CSV dit cluster {cluster}")
            source = os.path.join(ORIGINAUX, dossier, nom)
            cible = os.path.join(SORTIE, dossier, f"{document_id}.webp")
            ecrire = not (args.manquantes and os.path.exists(cible))
            taches.append((source, cible, ecrire))
            lignes.append((document_id, dossier, nom))

    print(f"{len(taches)} images, {sum(t[2] for t in taches)} vignettes à écrire")
    debut = time.time()
    # Les vignettes déjà présentes (mode --manquantes) ne sont pas réécrites,
    # mais leur ligne d'index est recalculée : l'index reste complet.
    with ProcessPoolExecutor() as pool:
        resultats = dict(enumerate(pool.map(traite, taches, chunksize=16)))

    chemin_index = os.path.join(SORTIE, "index.csv")
    with open(chemin_index, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["document_id", "cluster_id", "blob_url", "largeur", "hauteur",
                    "vignette_largeur", "vignette_hauteur", "octets", "dhash"])
        for i, (document_id, cluster, nom) in enumerate(lignes):
            w.writerow([document_id, cluster, nom, *resultats[i]])

    total = sum(r[4] for r in resultats.values())
    print(f"{len(taches)} vignettes, {total / 1e6:.1f} Mo, {time.time() - debut:.0f} s")
    print(f"index : {os.path.relpath(chemin_index, RACINE)}")


if __name__ == "__main__":
    main()
