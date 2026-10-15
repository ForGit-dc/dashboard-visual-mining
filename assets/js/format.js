// Formats français : espace fine insécable pour les milliers et avant « % »,
// virgule décimale, dates courtes à la manière de la presse (« ven. 25 sept. »).

const FINE = " ";
const entiers = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const decimaux = {};

export function entier(v) {
  return entiers.format(Math.round(v));
}

export function decimal(v, chiffres = 1) {
  if (Object.is(v, -0) || Math.abs(v) < 0.5 * 10 ** -chiffres) v = 0;
  if (!decimaux[chiffres]) {
    decimaux[chiffres] = new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: chiffres,
      maximumFractionDigits: chiffres,
    });
  }
  return decimaux[chiffres].format(v);
}

/** Part entre 0 et 1, affichée en pourcentage. */
export function pct(part, chiffres = 1) {
  return `${decimal(part * 100, chiffres)}${FINE}%`;
}

/** Rapport observé / attendu : « ×4,6 ». */
export function ratio(v) {
  if (v === 0) return "×0";
  return `×${decimal(v, v < 10 ? 1 : 0)}`;
}

/** Grands nombres pour les axes et les titres : 6,09 M ; 414 k au-delà de 10 000. */
export function compact(v) {
  const a = Math.abs(v);
  if (a >= 1e6) return `${decimal(v / 1e6, a >= 1e7 ? 1 : 2)}${FINE}M`;
  if (a >= 1e4) return `${entier(v / 1e3)}${FINE}k`;
  return entier(v);
}

/** Médiane d'engagements : entière quand elle l'est, sinon une décimale. */
export function mediane(v) {
  return Number.isInteger(v) ? entier(v) : decimal(v, 1);
}

/** « 1 engagement », « 16 engagements » : singulier sous 2, comme le veut l'usage. */
export function engagements(v) {
  return `${mediane(v)}${" "}${v >= 2 ? "engagements" : "engagement"}`;
}

// Locale D3 pour les axes, cohérente avec les fonctions ci-dessus.
export const localeD3 = window.d3
  ? d3.formatLocale({ decimal: ",", thousands: FINE, grouping: [3], currency: ["", " €"], percent: `${FINE}%` })
  : null;

// ---------- Dates ----------
const JOURS_COURTS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const JOURS_LONGS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const DEBUT = Date.UTC(2026, 8, 1); // 1er septembre 2026 ; les horaires du corpus sont sans fuseau

export function dateDuJour(jour) {
  return new Date(DEBUT + jour * 86400000);
}

function numeroJour(n) {
  // « 1er » en clair : les lettres en exposant Unicode manquent dans la plupart
  // des polices, et le texte part aussi dans des canvas et des SVG.
  return n === 1 ? "1er" : String(n);
}

/** « 25 sept. » */
export function jourCourt(jour) {
  const d = dateDuJour(jour);
  return `${numeroJour(d.getUTCDate())} sept.`;
}

/** « ven. 25 sept. » */
export function jourMoyen(jour) {
  const d = dateDuJour(jour);
  return `${JOURS_COURTS[d.getUTCDay()]} ${numeroJour(d.getUTCDate())} sept.`;
}

/** « vendredi 25 septembre » */
export function jourLong(jour) {
  const d = dateDuJour(jour);
  return `${JOURS_LONGS[d.getUTCDay()]} ${numeroJour(d.getUTCDate())} septembre`;
}

/** Minute depuis le 1er septembre 00:00 -> « ven. 25 sept., 14 h 32 » */
export function minuteLongue(minute) {
  const jour = Math.floor(minute / 1440);
  const m = minute - jour * 1440;
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, "0");
  return `${jourMoyen(jour)}, ${h}${FINE}h${FINE}${mm}`;
}

export function heure(minute) {
  const m = ((minute % 1440) + 1440) % 1440;
  return `${Math.floor(m / 60)}${FINE}h`;
}

export function estWeekend(jour) {
  const j = dateDuJour(jour).getUTCDay();
  return j === 0 || j === 6;
}

/** Nombre au singulier ou au pluriel : « 1 image », « 2 images ». */
export function accord(n, singulier, pluriel = `${singulier}s`) {
  return `${entier(n)}${" "}${Math.abs(n) >= 2 ? pluriel : singulier}`;
}

/** Échappe une chaîne avant de l'insérer dans du HTML construit à la main. */
export function html(chaine) {
  return String(chaine)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Comparaison insensible aux accents et à la casse, pour la recherche. */
export function plie(chaine) {
  return String(chaine).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const LETTRES = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
  "onze", "douze", "treize", "quatorze", "quinze", "seize"];

/** Petits nombres en lettres dans les titres, comme le veut l'usage de la presse. */
export function enLettres(n) {
  return Number.isInteger(n) && n >= 0 && n < LETTRES.length ? LETTRES[n] : entier(n);
}
