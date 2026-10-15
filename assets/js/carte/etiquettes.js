// Placement des noms de clusters avec détection de collision.
//
// Le défaut le plus visible de l'outil générique : 64 noms posés au centre de
// leur cluster, qui se chevauchent dans les zones denses. Ici, algorithme
// glouton classique du placement d'étiquettes ponctuelles (Christensen, Marks
// et Shieber, 1995) : les noms sont traités par priorité (taille du cluster,
// sauf sélection), chacun essaie une série de positions autour de son ancre et
// prend la première qui ne touche aucun nom déjà posé. S'il n'y en a pas, il
// n'est pas affiché : il réapparaît en zoomant. Recalculé à chaque mouvement de
// la carte (64 noms, moins d'une milliseconde).

const PAPIER = "rgba(245, 243, 238, 0.92)";
const ENCRE = "#1b1a17";

function chevauche(a, b, marge) {
  return a.x - marge < b.x + b.w && a.x + a.w + marge > b.x && a.y - marge < b.y + b.h && a.y + a.h + marge > b.y;
}

/**
 * candidats : [{ id, texte, x, y, taille, priorite, force, gras }]
 * x, y : position écran de l'ancre (pixels CSS).
 * Renvoie la liste des noms placés, avec leur rectangle.
 */
export function place(ctx, candidats, largeur, hauteur, { marge = 3, obstacles = [] } = {}) {
  const poses = obstacles.map((o) => ({ ...o, obstacle: true }));
  const ordre = [...candidats].sort((a, b) => (b.force - a.force) || (b.priorite - a.priorite));
  const sortie = [];
  for (const c of ordre) {
    ctx.font = `${c.gras ? 700 : 600} ${c.taille}px "Libre Franklin", sans-serif`;
    const w = ctx.measureText(c.texte).width;
    const h = c.taille * 1.18;
    const pas = h * 0.95;
    const essais = [
      [0, 0], [0, -pas], [0, pas], [w / 2 + 10, 0], [-w / 2 - 10, 0],
      [0, -2 * pas], [0, 2 * pas], [w / 2 + 10, -pas], [-w / 2 - 10, -pas],
      [w / 2 + 10, pas], [-w / 2 - 10, pas],
    ];
    let retenu = null;
    for (let k = 0; k < essais.length; k++) {
      const [dx, dy] = essais[k];
      const r = { x: c.x + dx - w / 2, y: c.y + dy - h / 2, w, h };
      if (r.x < 4 || r.y < 4 || r.x + w > largeur - 4 || r.y + h > hauteur - 4) continue;
      if (poses.some((p) => chevauche(r, p, marge))) continue;
      retenu = { ...c, ...r, deplace: k > 0 };
      break;
    }
    if (!retenu && c.force) {
      // Un nom forcé (cluster sélectionné) s'affiche même en conflit.
      retenu = { ...c, x: c.x - w / 2, y: c.y - h / 2, w, h, deplace: false };
    }
    if (retenu) {
      poses.push(retenu);
      sortie.push(retenu);
    }
  }
  return sortie;
}

export function dessine(ctx, poses) {
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  for (const p of poses) {
    if (p.deplace) {
      // Filet de rappel vers l'ancre quand le nom a dû s'écarter.
      const bx = Math.max(p.x, Math.min(p.ancreX, p.x + p.w));
      const by = Math.max(p.y, Math.min(p.ancreY, p.y + p.h));
      ctx.strokeStyle = "rgba(27, 26, 23, 0.55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.ancreX, p.ancreY);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.fillStyle = ENCRE;
      ctx.beginPath();
      ctx.arc(p.ancreX, p.ancreY, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const p of poses) {
    ctx.font = `${p.gras ? 700 : 600} ${p.taille}px "Libre Franklin", sans-serif`;
    const x = p.x + p.w / 2, y = p.y + p.h / 2 + 0.5;
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = PAPIER;
    ctx.strokeText(p.texte, x, y);
    ctx.fillStyle = p.attenue ? "rgba(27, 26, 23, 0.45)" : ENCRE;
    ctx.fillText(p.texte, x, y);
  }
}
