// Visionneuse : l'image d'origine n'est chargée qu'ici, sur demande explicite.
// Partout ailleurs, on affiche des vignettes de 256 px (9 Ko en moyenne) au lieu
// des originaux (148 Ko en médiane).

import { entier, decimal, minuteLongue, accord, html } from "../format.js";

let donnees = null;
let liste = [];
let index = 0;
let surNavigation = null;

const dlg = () => document.getElementById("visionneuse");

export function initVisionneuse(d) {
  donnees = d;
  dlg().addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); va(-1); }
    if (e.key === "ArrowRight") { e.preventDefault(); va(1); }
  });
  dlg().addEventListener("click", (e) => {
    if (e.target === dlg()) dlg().close();
  });
}

/** liste : entrées de l'échantillon (donnees.echantillon) ; i : position de départ. */
export function ouvre(entrees, i, { navigation = null } = {}) {
  liste = entrees;
  index = i;
  surNavigation = navigation;
  if (!dlg().open) dlg().showModal();
  affiche();
}

function va(pas) {
  if (!liste.length) return;
  index = (index + pas + liste.length) % liste.length;
  affiche();
  surNavigation?.(liste[index]);
}

async function affiche() {
  const e = liste[index];
  const p = donnees.p;
  const i = e.point;
  const fiche = donnees.fiche(e.cluster);
  const rangDansCluster = fiche.echantillon.indexOf(e.rang) + 1;
  const copies = e.groupe >= 0 ? donnees.groupes.get(e.groupe).filter((c) => c !== e) : [];

  const corps = document.createElement("div");
  corps.className = "visionneuse__corps";
  corps.innerHTML = `
    <div class="visionneuse__image">
      <p class="visionneuse__etat">Chargement de l'image d'origine…</p>
      ${liste.length > 1 ? `<button type="button" class="visionneuse__nav visionneuse__nav--prec" aria-label="Image précédente">‹</button>
      <button type="button" class="visionneuse__nav visionneuse__nav--suiv" aria-label="Image suivante">›</button>` : ""}
    </div>
    <aside class="visionneuse__info">
      <p class="kicker" style="color:#a8a194">Cluster ${fiche.id} · vue ${rangDansCluster} sur ${fiche.echantillon.length}</p>
      <h3>${html(fiche.label)}</h3>
      <dl>
        <dt>Publié le</dt><dd>${minuteLongue(p.minute[i])}</dd>
        <dt>Engagements</dt><dd>${entier(p.eng[i])} <span class="nb-images"></span></dd>
        <dt>Certitude</dt><dd>${decimal(p.prob[i] / 255, 2)} <span style="color:#a8a194">(probabilité HDBSCAN)</span></dd>
        <dt>Original</dt><dd>${entier(e.ol)} × ${entier(e.oh)} px</dd>
        <dt>Document</dt><dd class="mono">${e.doc}</dd>
      </dl>
      <p class="lien-post" style="margin-bottom:14px"><span style="color:#a8a194">Lien vers le post en cours de chargement…</span></p>
      ${copies.length ? `<p><strong>Quasi-doublon.</strong> La même image, à quelques pixels près, apparaît dans ${accord(copies.length, "autre post", "autres posts")} de l'échantillon :</p>
        <div class="mini-planche" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">${copies.slice(0, 8).map((c) =>
          `<button type="button" data-rang="${c.rang}" title="${html(minuteLongue(p.minute[c.point]))}"><img src="${donnees.vignette(c)}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}
      <p style="color:#a8a194;font-size:11px">← → pour naviguer · Échap pour fermer</p>
      <form method="dialog"><button class="bouton visionneuse__fermer" type="submit">Fermer</button></form>
    </aside>`;
  dlg().replaceChildren(corps);
  corps.querySelector(".visionneuse__nav--prec")?.addEventListener("click", () => va(-1));
  corps.querySelector(".visionneuse__nav--suiv")?.addEventListener("click", () => va(1));
  corps.querySelectorAll("[data-rang]").forEach((b) => b.addEventListener("click", () => {
    const cible = donnees.echantillon[Number(b.dataset.rang)];
    const k = liste.indexOf(cible);
    if (k >= 0) { index = k; affiche(); } else { liste = [cible, ...liste]; index = 0; affiche(); }
  }));

  // Lien vers le post : posts.bin peut encore être en chargement.
  donnees.chargePosts().then(() => {
    const zone = corps.querySelector(".lien-post");
    const url = donnees.urlPost(i);
    const nb = donnees.imagesDuPost(i);
    if (nb > 1) corps.querySelector(".nb-images").textContent = `(post de ${nb} images, chiffre du post)`;
    zone.innerHTML = url
      ? `<a class="bouton" href="${url}" target="_blank" rel="noopener noreferrer">Ouvrir le post sur X ↗</a>
         <span style="display:block;color:#a8a194;font-size:11px;margin-top:6px">Certains posts ont été supprimés depuis la collecte : le lien peut ne plus répondre.</span>`
      : `<span style="color:#a8a194">Lien indisponible : posts.bin n'a pas pu être chargé.</span>`;
  });

  // Image d'origine, avec repli sur la vignette si le fichier manque.
  const zoneImage = corps.querySelector(".visionneuse__image");
  const etatChargement = corps.querySelector(".visionneuse__etat");
  let nom;
  try {
    await donnees.chargeOriginaux();
    nom = donnees.originaux[String(e.doc)];
  } catch { nom = null; }
  if (liste[index] !== e) return; // l'utilisateur est déjà passé à une autre image
  const img = new Image();
  img.alt = `Image du cluster ${fiche.label}, publiée le ${minuteLongue(p.minute[i])}`;
  img.onload = () => { etatChargement.remove(); };
  img.onerror = () => {
    etatChargement.textContent = "Image d'origine introuvable sur le serveur : affichage de la vignette.";
    img.onerror = null;
    img.src = donnees.vignette(e);
  };
  img.src = nom ? `images_691_echantillon/${e.cluster}/${nom}` : donnees.vignette(e);
  zoneImage.prepend(img);
}
