// Aide au survol : chaque commande dit ce qu'elle fait dès que la souris s'y
// pose, ou que le clavier y arrive. Remplace l'attribut title, dont la bulle
// native met une seconde à venir, disparaît au moindre mouvement et ne permet
// ni titre, ni liste, ni raccourci.
//
// Sur une commande :
//   data-aide="Une phrase."                une explication
//   data-aide="Point un|Point deux"        une liste à puces
//   data-aide-titre="Titre"                facultatif, en gras au-dessus
//   data-touche="F"                        facultatif, le raccourci clavier
//
// Les infobulles de données (valeur d'une barre, image d'un point) restent dans
// infobulle.js : elles suivent le pointeur, celle-ci s'accroche à la commande.

import { html } from "../format.js";

const DELAI = 320;     // avant la première bulle : un clic rapide n'en déclenche pas
const ENCHAINE = 700;  // juste après une bulle, la voisine s'ouvre sans attendre

let bulle = null;
let cible = null;      // commande dont la bulle est affichée
let attendue = null;   // commande survolée dont la bulle n'est pas encore affichée
let minuteur = null;
let fermeeA = -Infinity;

/** Attributs à insérer dans un gabarit : <button ${aide("Zoomer", "…", "+")}>. */
export function aide(titre, texte, touche = "") {
  return `data-aide-titre="${html(titre)}" data-aide="${html(texte)}"${touche ? ` data-touche="${html(touche)}"` : ""}`;
}

/** Même chose sur un élément existant (libellé qui change avec l'état). */
export function regle(el, titre, texte, touche = "") {
  el.dataset.aideTitre = titre;
  el.dataset.aide = texte;
  if (touche) el.dataset.touche = touche;
  else delete el.dataset.touche;
  if (el === cible) remplit(el);
}

function element() {
  if (!bulle) {
    bulle = document.createElement("div");
    bulle.id = "aide";
    bulle.className = "aide";
    bulle.setAttribute("role", "tooltip");
    bulle.hidden = true;
    document.body.append(bulle);
  }
  return bulle;
}

function remplit(c) {
  const b = element();
  const titre = c.dataset.aideTitre;
  const touche = c.dataset.touche;
  const points = (c.dataset.aide || "").split("|").map((s) => s.trim()).filter(Boolean);
  const tete = titre || touche
    ? `<div class="aide__tete"><strong>${html(titre || "")}</strong>${touche ? `<kbd>${html(touche)}</kbd>` : ""}</div>`
    : "";
  const corps = points.length > 1
    ? `<ul>${points.map((p) => `<li>${html(p)}</li>`).join("")}</ul>`
    : points.length ? `<p>${html(points[0])}</p>` : "";
  b.innerHTML = tete + corps;
  place(c);
}

function place(c) {
  const b = element();
  const r = c.getBoundingClientRect();
  const l = b.offsetWidth, h = b.offsetHeight;
  const ecart = 9;
  let haut = r.bottom + ecart;
  const dessus = haut + h > window.innerHeight - 6;
  if (dessus) haut = r.top - ecart - h;
  const centre = r.left + r.width / 2;
  const gauche = Math.max(6, Math.min(window.innerWidth - l - 6, centre - l / 2));
  b.style.left = `${Math.round(gauche)}px`;
  b.style.top = `${Math.round(Math.max(6, haut))}px`;
  b.classList.toggle("aide--dessus", dessus);
  // La pointe reste en face de la commande, même quand la bulle bute sur un bord.
  b.style.setProperty("--pointe", `${Math.round(Math.max(12, Math.min(l - 12, centre - gauche)))}px`);
}

function montre(c) {
  clearTimeout(minuteur);
  attendue = null;
  if (!c.isConnected) return;
  const b = element();
  // Une boîte de dialogue modale passe au-dessus du reste de la page : la bulle
  // doit vivre dedans pour rester visible.
  const hote = c.closest("dialog[open]") ?? document.body;
  if (b.parentElement !== hote) hote.append(b);
  if (cible && cible !== c) cible.removeAttribute("aria-describedby");
  cible = c;
  b.hidden = false;
  c.setAttribute("aria-describedby", "aide");
  remplit(c);
}

export function cache() {
  clearTimeout(minuteur);
  attendue = null;
  if (!cible) return;
  cible.removeAttribute("aria-describedby");
  cible = null;
  fermeeA = performance.now();
  if (bulle) bulle.hidden = true;
}

export function initAide() {
  document.addEventListener("pointerover", (e) => {
    if (e.pointerType === "touch") return;
    const c = e.target.closest?.("[data-aide]");
    if (!c || c === cible || c === attendue) return;
    clearTimeout(minuteur);
    const vite = cible !== null || performance.now() - fermeeA < ENCHAINE;
    attendue = c;
    minuteur = setTimeout(() => montre(c), vite ? 0 : DELAI);
  });
  document.addEventListener("pointerout", (e) => {
    const c = e.target.closest?.("[data-aide]");
    if (!c || (e.relatedTarget && c.contains(e.relatedTarget))) return;
    if (c === attendue) { clearTimeout(minuteur); attendue = null; }
    if (c === cible) cache();
  });
  // Un clic agit : l'explication a fait son travail.
  document.addEventListener("pointerdown", () => cache(), true);
  document.addEventListener("focusin", (e) => {
    const c = e.target.closest?.("[data-aide]");
    if (c && e.target.matches(":focus-visible")) montre(c);
  });
  document.addEventListener("focusout", (e) => {
    if (cible && e.target.closest?.("[data-aide]") === cible) cache();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") cache(); }, true);
  window.addEventListener("scroll", () => cache(), true);
  window.addEventListener("resize", () => cache());
  // Une commande redessinée pendant le survol ne reçoit jamais de pointerout.
  document.addEventListener("pointermove", () => {
    if (cible && (!cible.isConnected || !cible.matches(":hover"))) cache();
  }, { passive: true });
}
