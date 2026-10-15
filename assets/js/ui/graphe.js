// Outils communs aux graphiques SVG : export PNG (polices embarquées, titre et
// source dans l'image) et copie des données sous-jacentes.

import { telecharge, copie, notifie } from "./notifier.js";

const POLICES = [
  ["Libre Franklin", "normal", "300 800", "assets/fonts/libre-franklin-normal-300-800-latin.woff2"],
  ["Newsreader", "normal", "300 700", "assets/fonts/newsreader-normal-300-700-latin.woff2"],
  ["IBM Plex Mono", "normal", "400", "assets/fonts/ibm-plex-mono-normal-400-latin.woff2"],
];
let policesCss = null;

async function base64(url) {
  const octets = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let binaire = "";
  for (let i = 0; i < octets.length; i += 0x8000) binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(binaire);
}

async function polices() {
  if (!policesCss) {
    const blocs = await Promise.all(POLICES.map(async ([famille, style, poids, url]) =>
      `@font-face{font-family:"${famille}";font-style:${style};font-weight:${poids};src:url(data:font/woff2;base64,${await base64(url)}) format("woff2");}`));
    policesCss = blocs.join("\n");
  }
  return policesCss;
}

/** Règles CSS de la page qui concernent les graphiques, à recopier dans le SVG exporté. */
function reglesGraphes() {
  const regles = [];
  for (const feuille of document.styleSheets) {
    let liste;
    try { liste = feuille.cssRules; } catch { continue; }
    for (const r of liste) {
      if (r.selectorText && /\.graphe|\.cretes/.test(r.selectorText)) regles.push(r.cssText);
    }
  }
  return regles.join("\n");
}

/**
 * Exporte un SVG en PNG (×2), avec un bandeau de titre et une ligne de source,
 * pour que l'image reste lisible hors du dashboard.
 */
export async function exportePng(svg, nom, { titre = "", sousTitre = "", source = "" } = {}) {
  try {
    const r = svg.getBoundingClientRect();
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", r.width);
    clone.setAttribute("height", r.height);
    clone.classList.add("graphe");
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = `${await polices()}\n${reglesGraphes().replace(/\.graphe\s+/g, "")}\ntext{font-family:"Libre Franklin",sans-serif}`;
    clone.prepend(style);
    const texte = new XMLSerializer().serializeToString(clone);
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(texte)}`;
    await img.decode();

    const echelle = 2, marge = 24, haut = titre ? (sousTitre ? 70 : 48) : 12, bas = source ? 34 : 12;
    const canvas = document.createElement("canvas");
    canvas.width = (r.width + 2 * marge) * echelle;
    canvas.height = (r.height + haut + bas) * echelle;
    const c = canvas.getContext("2d");
    c.scale(echelle, echelle);
    c.fillStyle = "#f5f3ee";
    c.fillRect(0, 0, r.width + 2 * marge, r.height + haut + bas);
    await document.fonts.ready;
    if (titre) {
      c.fillStyle = "#1b1a17";
      c.font = '500 19px Newsreader, Georgia, serif';
      c.fillText(titre, marge, 30);
      if (sousTitre) {
        c.fillStyle = "#4a463e";
        c.font = '400 12px "Libre Franklin", sans-serif';
        c.fillText(sousTitre, marge, 50);
      }
    }
    c.drawImage(img, marge, haut, r.width, r.height);
    if (source) {
      c.fillStyle = "#6f695d";
      c.font = '400 10.5px "Libre Franklin", sans-serif';
      c.fillText(source, marge, haut + r.height + 22);
    }
    canvas.toBlob((b) => telecharge(b, nom), "image/png");
  } catch (e) {
    console.error(e);
    notifie("Export PNG impossible dans ce navigateur.");
  }
}

/** Tableau d'objets -> texte séparé par tabulations (collable dans un tableur). */
export function enTsv(lignes, colonnes) {
  const entete = colonnes.map(([, titre]) => titre).join("\t");
  const corps = lignes.map((l) => colonnes.map(([cle]) => String(l[cle] ?? "").replace(/\t|\n/g, " ")).join("\t"));
  return [entete, ...corps].join("\n");
}

export function enCsv(lignes, colonnes) {
  const echappe = (v) => {
    const s = String(v ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const entete = colonnes.map(([, titre]) => echappe(titre)).join(";");
  const corps = lignes.map((l) => colonnes.map(([cle]) => echappe(l[cle])).join(";"));
  // BOM UTF-8 et point-virgule : ouverture directe dans Excel en français.
  return `﻿${[entete, ...corps].join("\r\n")}`;
}

/**
 * Ajoute les boutons « PNG » et « Données » en haut à droite d'un graphique.
 * options : { svg: () => SVGElement, nom, titre, sousTitre, source, donnees: () => [lignes, colonnes] }
 */
export function outils(conteneur, options) {
  const barre = document.createElement("div");
  barre.className = "outils-graphe";
  barre.innerHTML = `<button type="button" data-png title="Télécharger ce graphique en PNG">PNG</button>${options.donnees ? '<button type="button" data-donnees title="Copier les données du graphique (collables dans un tableur)">Données</button>' : ""}`;
  barre.querySelector("[data-png]").addEventListener("click", () =>
    exportePng(options.svg(), options.nom, { titre: options.titre, sousTitre: options.sousTitre, source: options.source ?? "SPINE France · analyse 691 · opsci.ai" }));
  barre.querySelector("[data-donnees]")?.addEventListener("click", () => {
    const [lignes, colonnes] = options.donnees();
    copie(enTsv(lignes, colonnes), `${lignes.length} lignes copiées (format tableur).`);
  });
  conteneur.style.position = "relative";
  // Les boutons vivent au-dessus du graphique, jamais sur ses marques.
  conteneur.style.paddingTop = "30px";
  conteneur.append(barre);
  return barre;
}
