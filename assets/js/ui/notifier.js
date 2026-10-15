let minuteur = null;

/** Message court en bas d'écran (« Lien copié »), lu par les lecteurs d'écran. */
export function notifie(message, duree = 2200) {
  const el = document.getElementById("notification");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(minuteur);
  minuteur = setTimeout(() => { el.hidden = true; }, duree);
}

export async function copie(texte, message) {
  try {
    await navigator.clipboard.writeText(texte);
    notifie(message);
  } catch {
    // Contexte non sécurisé (http://) : repli sur une zone de texte sélectionnée.
    const zone = document.createElement("textarea");
    zone.value = texte;
    zone.style.position = "fixed";
    zone.style.opacity = "0";
    document.body.append(zone);
    zone.select();
    const ok = document.execCommand("copy");
    zone.remove();
    notifie(ok ? message : "Copie impossible : sélectionnez et copiez à la main.");
  }
}

/** Déclenche le téléchargement d'un Blob sous un nom donné. */
export function telecharge(blob, nom) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
