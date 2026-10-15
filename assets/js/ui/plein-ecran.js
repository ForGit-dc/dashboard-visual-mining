// Plein écran de toute la page, pas de la seule carte. Un élément mis en plein
// écran passe au-dessus du reste du document : les infobulles, l'aide, le
// parcours et les notifications, qui vivent ailleurs dans la page, restaient
// dessous et le navigateur peignait en noir les zones sans fond. Ici, les
// onglets restent utilisables et rien ne disparaît.

import { notifie } from "./notifier.js";

export function disponible() {
  return Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen);
}

export function bascule() {
  if (document.fullscreenElement) {
    document.exitFullscreen?.().catch(() => {});
    return;
  }
  if (!disponible()) {
    notifie("Le plein écran n'est pas disponible dans ce navigateur.");
    return;
  }
  document.documentElement.requestFullscreen().catch(() => notifie("Le navigateur a refusé le plein écran."));
}
