// Infobulle unique, positionnée près du pointeur et toujours dans la fenêtre.
// Le contenu est construit avec html() (format.js) ou des nœuds DOM : jamais de
// données brutes insérées telles quelles.

const el = () => document.getElementById("infobulle");
let maintenue = false;

export function montre(contenu, x, y, { interactive = false } = {}) {
  const b = el();
  if (typeof contenu === "string") b.innerHTML = contenu;
  else b.replaceChildren(contenu);
  b.hidden = false;
  b.classList.toggle("interactive", interactive);
  place(x, y);
}

export function place(x, y) {
  const b = el();
  const r = b.getBoundingClientRect();
  const marge = 14;
  let gauche = x + marge;
  let haut = y + marge;
  if (gauche + r.width > window.innerWidth - 8) gauche = x - marge - r.width;
  if (haut + r.height > window.innerHeight - 8) haut = Math.max(8, y - marge - r.height);
  b.style.left = `${Math.max(8, gauche)}px`;
  b.style.top = `${haut}px`;
}

export function cache({ force = false } = {}) {
  if (maintenue && !force) return;
  maintenue = false;
  el().hidden = true;
}

/** Garde l'infobulle ouverte tant que le pointeur est dessus (lien cliquable). */
export function maintiens(oui) {
  maintenue = oui;
}

export function element() {
  return el();
}
