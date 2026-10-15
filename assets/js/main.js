// Point d'entrée : chargement des données, routeur de vues, raccourcis clavier.
// Les vues autres que la carte sont chargées au premier affichage (import
// dynamique) : le premier écran ne paie que ce qu'il montre.

import { etat, VUES } from "./etat.js";
import { chargeTout, ErreurDonnees } from "./donnees.js";
import { VueCarte } from "./carte/carte.js";
import { initVisionneuse } from "./ui/visionneuse.js";
import { copie } from "./ui/notifier.js";
import { entier, decimal, pct } from "./format.js";

const MODULES = {
  temps: () => import("./vues/temps.js"),
  familles: () => import("./vues/familles.js"),
  resonance: () => import("./vues/resonance.js"),
  planches: () => import("./vues/planches.js"),
  clusters: () => import("./vues/clusters.js"),
  limites: () => import("./vues/limites.js"),
  methode: () => import("./vues/methode.js"),
};

const vues = {};
let donnees = null;
let active = null;
let parcours = null;

function navigue(vue, patch = {}) {
  etat.change({ vue, ...patch }, { historique: true });
}

function hauteurEntete() {
  const h = document.querySelector(".bandeau").offsetHeight + document.querySelector(".onglets").offsetHeight;
  document.documentElement.style.setProperty("--hauteur-haut", `${h}px`);
  document.documentElement.style.setProperty("--hauteur-onglets", `${document.querySelector(".onglets").offsetHeight}px`);
}

function afficheErreur(e) {
  const zone = document.getElementById("vue");
  let explication;
  if (e instanceof ErreurDonnees && e.cause === "fichier-local") {
    explication = `<p>La page est ouverte directement depuis le disque (<code>file://</code>) : les navigateurs y bloquent la lecture des fichiers de données.</p>
      <p>Servez le dossier avec un petit serveur local, depuis la racine du dépôt :</p>
      <p><code>python -m http.server 8000</code> puis ouvrez <code>http://localhost:8000</code>.</p>`;
  } else if (e instanceof ErreurDonnees && /HTTP 404/.test(e.cause)) {
    explication = `<p>Le fichier <code>data/${e.fichier}</code> est introuvable sur le serveur.</p>
      <p>Les données se régénèrent avec <code>python scripts/build_vignettes.py</code> puis <code>python scripts/build_data.py</code> (voir le README).</p>`;
  } else {
    explication = `<p>Le chargement a échoué : <code>${String(e.message || e)}</code>.</p>
      <p>Vérifiez la connexion puis rechargez la page.</p>`;
  }
  zone.innerHTML = `<section class="erreur-globale"><h2>Les données n'ont pas pu être chargées</h2>${explication}
    <p><button class="bouton" type="button" onclick="location.reload()">Réessayer</button></p></section>`;
}

function majChiffresCles(d) {
  const t = d.meta.totaux;
  document.getElementById("chiffres-cles").innerHTML =
    `<strong>${entier(t.images)} images</strong> issues de ${entier(t.posts)} posts publiés sur X du 1<sup>er</sup> au 29 septembre 2026 par quatre familles d'acteurs ·
     <strong>${t.clusters} clusters</strong> (CLIP, UMAP, HDBSCAN) ·
     <strong>${entier(t.bruit)} non classées</strong> (${pct(t.bruit / t.images)}) ·
     <strong>${decimal(t.engagements_par_post / 1e6, 2)} millions d'engagements</strong>, comptés une fois par post ·
     ${entier(t.images_locales)} images consultables (10 % par cluster)`;
}

async function active_(nom) {
  if (!VUES.includes(nom)) nom = "carte";
  document.querySelectorAll(".onglets a").forEach((a) => {
    if (a.dataset.vue === nom) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  if (active && vues[active] && active !== nom) {
    vues[active].el.classList.remove("active");
    vues[active].desactive?.();
  }
  if (!vues[nom]) {
    const section = document.createElement("section");
    section.className = "vue";
    section.id = `vue-${nom}`;
    document.getElementById("vue").append(section);
    if (nom === "carte") {
      vues.carte = new VueCarte(section, donnees, navigue);
      vues.carte.el = section;
    } else {
      section.innerHTML = '<div class="chargement"><p class="chargement__detail">Chargement de la vue…</p></div>';
      section.classList.add("active");
      try {
        const module = await MODULES[nom]();
        section.innerHTML = "";
        vues[nom] = new module.default(section, donnees, navigue, { carte: () => vues.carte });
        vues[nom].el = section;
      } catch (e) {
        console.error(e);
        section.innerHTML = `<section class="erreur-globale"><h2>Cette vue n'a pas pu s'ouvrir</h2><p><code>${String(e.message || e)}</code></p></section>`;
        return;
      }
    }
  }
  active = nom;
  document.body.dataset.vue = nom;
  vues[nom].el.classList.add("active");
  hauteurEntete();
  vues[nom].active?.();
  document.title = `${document.querySelector(`.onglets a[data-vue="${nom}"]`)?.textContent.replace(/^\d/, "").trim() || "Carte"} · SPINE · Septembre 2026 en 65 229 images`;
}

function clavier(e) {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
  const cible = e.target;
  if (cible.closest?.("input, textarea, select, [contenteditable]") && e.key !== "Escape") return;
  if (document.getElementById("visionneuse").open) return;
  if (/^[1-7]$/.test(e.key)) {
    navigue(VUES[Number(e.key) - 1]);
    e.preventDefault();
    return;
  }
  if (e.key === "?") { document.getElementById("dialogue-clavier").showModal(); e.preventDefault(); return; }
  if (e.key === "/") {
    const champ = vues[active]?.el.querySelector('input[type="search"], .champ');
    if (champ) { champ.focus(); e.preventDefault(); }
    return;
  }
  if (e.key === "l" || e.key === "L") { copie(etat.lienAbsolu(), "Lien copié : il rouvre exactement cet écran."); e.preventDefault(); return; }
  if (e.key === "p" || e.key === "P") { lanceParcours(); e.preventDefault(); return; }
  if (e.key === "Escape" && parcours?.ouvert) { parcours.ferme(); e.preventDefault(); return; }
  if (vues[active]?.clavier?.(e)) e.preventDefault();
}

async function lanceParcours(etape = 0) {
  const { Parcours } = await import("./vues/parcours.js");
  if (!parcours) parcours = new Parcours(donnees, navigue, () => vues.carte);
  parcours.ouvre(etape);
}

// Une vignette absente ou en erreur est remplacée par un cadre explicite, au
// lieu de l'icône d'image cassée du navigateur.
document.addEventListener("error", (e) => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || !img.src.includes("vignettes/") || img.dataset.echec) return;
  img.dataset.echec = "1";
  const repli = document.createElement("span");
  repli.className = "image-absente";
  repli.textContent = "image indisponible";
  repli.title = img.src.split("/").slice(-2).join("/");
  img.replaceWith(repli);
}, true);

async function demarre() {
  const barre = document.getElementById("chargement-barre");
  const detail = document.getElementById("chargement-detail");
  const debut = performance.now();
  try {
    donnees = await chargeTout((recus, total, fichier) => {
      barre.style.width = `${Math.min(100, (100 * recus) / total).toFixed(1)}%`;
      detail.textContent = `${fichier} · ${entier(recus / 1024)} Ko sur ${entier(total / 1024)} Ko`;
    });
  } catch (e) {
    console.error(e);
    afficheErreur(e);
    return;
  }
  window.__mesures = { ...(window.__mesures || {}), chargement_ms: Math.round(performance.now() - debut) };
  document.getElementById("chargement").remove();
  majChiffresCles(donnees);
  initVisionneuse(donnees);
  hauteurEntete();
  window.addEventListener("resize", hauteurEntete);

  await active_(etat.get("vue"));
  etat.ecoute(["vue"], (_, v) => active_(v.vue));
  if (etat.get("parcours") !== null) lanceParcours(etat.get("parcours"));

  document.addEventListener("keydown", clavier);
  document.getElementById("copier-lien").addEventListener("click", () =>
    copie(etat.lienAbsolu(), "Lien copié : il rouvre exactement cet écran."));
  document.getElementById("aide-clavier").addEventListener("click", () =>
    document.getElementById("dialogue-clavier").showModal());
  document.getElementById("lancer-parcours").addEventListener("click", () => lanceParcours(0));
  document.querySelector(".onglets").addEventListener("click", (e) => {
    const a = e.target.closest("a[data-vue]");
    if (!a) return;
    e.preventDefault();
    navigue(a.dataset.vue);
  });
  window.__mesures.premier_rendu_ms = Math.round(performance.now() - debut);
  // Depuis le début de la navigation, téléchargements compris.
  window.__mesures.premier_rendu_depuis_navigation_ms = Math.round(performance.now());
}

demarre();
