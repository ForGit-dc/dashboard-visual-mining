// Index spatial pour le survol : grille régulière sur les coordonnées de
// données, stockée en deux tableaux (début de case, points triés par case).
// Trouver le point le plus proche du pointeur coûte quelques centaines de
// comparaisons au lieu de 65 229.

export class Grille {
  constructor(x, y, bornes, cases = 256) {
    const { x0, x1, y0, y1 } = bornes;
    this.x = x;
    this.y = y;
    this.n = cases;
    this.x0 = x0;
    this.y0 = y0;
    this.lx = (x1 - x0) / cases;
    this.ly = (y1 - y0) / cases;

    const nb = x.length;
    const caseDe = new Uint32Array(nb);
    const comptes = new Uint32Array(cases * cases + 1);
    for (let i = 0; i < nb; i++) {
      const c = this.caseXY(x[i], y[i]);
      caseDe[i] = c;
      comptes[c + 1]++;
    }
    for (let c = 1; c < comptes.length; c++) comptes[c] += comptes[c - 1];
    this.debut = comptes;
    this.points = new Uint32Array(nb);
    const curseur = comptes.slice(0, cases * cases);
    for (let i = 0; i < nb; i++) this.points[curseur[caseDe[i]]++] = i;
  }

  caseXY(x, y) {
    const i = Math.min(this.n - 1, Math.max(0, Math.floor((x - this.x0) / this.lx)));
    const j = Math.min(this.n - 1, Math.max(0, Math.floor((y - this.y0) / this.ly)));
    return j * this.n + i;
  }

  /**
   * Point visible le plus proche de (x, y) dans un rayon donné (unités de
   * données). `visible(i)` filtre comme le shader. Renvoie -1 si rien.
   * À distance égale, le point dessiné en dernier (le plus haut) l'emporte.
   */
  plusProche(x, y, rayon, visible) {
    const i0 = Math.max(0, Math.floor((x - rayon - this.x0) / this.lx));
    const i1 = Math.min(this.n - 1, Math.floor((x + rayon - this.x0) / this.lx));
    const j0 = Math.max(0, Math.floor((y - rayon - this.y0) / this.ly));
    const j1 = Math.min(this.n - 1, Math.floor((y + rayon - this.y0) / this.ly));
    let meilleur = -1;
    let dmin = rayon * rayon;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const c = j * this.n + i;
        for (let k = this.debut[c]; k < this.debut[c + 1]; k++) {
          const p = this.points[k];
          const dx = this.x[p] - x, dy = this.y[p] - y;
          const d = dx * dx + dy * dy;
          if (d < dmin || (d === dmin && p > meilleur)) {
            if (!visible(p)) continue;
            dmin = d;
            meilleur = p;
          }
        }
      }
    }
    return meilleur;
  }

  /** Tous les points visibles d'un rectangle (pour les vignettes au zoom fort). */
  dansRectangle(xa, ya, xb, yb, visible, limite = Infinity) {
    const sortie = [];
    const i0 = Math.max(0, Math.floor((xa - this.x0) / this.lx));
    const i1 = Math.min(this.n - 1, Math.floor((xb - this.x0) / this.lx));
    const j0 = Math.max(0, Math.floor((ya - this.y0) / this.ly));
    const j1 = Math.min(this.n - 1, Math.floor((yb - this.y0) / this.ly));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const c = j * this.n + i;
        for (let k = this.debut[c]; k < this.debut[c + 1]; k++) {
          const p = this.points[k];
          if (this.x[p] < xa || this.x[p] > xb || this.y[p] < ya || this.y[p] > yb) continue;
          if (!visible(p)) continue;
          sortie.push(p);
          if (sortie.length > limite) return sortie;
        }
      }
    }
    return sortie;
  }
}
