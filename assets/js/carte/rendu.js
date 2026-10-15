// Rendu WebGL 2 des 65 229 points de la carte.
//
// Les données ne sont envoyées au GPU qu'une fois. Tout ce qui change à
// l'interaction passe par des uniformes ou par une petite texture de 65 x 2
// texels (une colonne par cluster, bruit en colonne 0) :
//   ligne 0 : couleur du cluster dans le mode courant
//   ligne 1 : drapeaux  r = isolé, g = survolé, b = visible
// La séquence temporelle ne coûte donc rien côté JavaScript : on change u_t,
// le shader cache les points futurs et pâlit les anciens.

const SOMMETS = `#version 300 es
precision highp float;
in vec2 a_pos;        // position normalisée 0..1 (uint16 normalisé)
in float a_cluster;   // 0 = bruit, 1..64 = cluster + 1
in float a_prob;      // certitude HDBSCAN 0..1
in float a_minute;    // minutes depuis le 1er septembre 00:00

uniform vec2 u_echelle;
uniform vec2 u_decalage;
uniform float u_taille;     // diamètre en pixels physiques
uniform float u_t;          // minute courante ; < 0 : tout le mois
uniform float u_fenetre;    // durée pendant laquelle un point reste « frais »
uniform float u_trainee;    // 1 : les points plus anciens restent, pâlis
uniform float u_bruit;      // 1 : bruit affiché
uniform float u_certitude;  // certitude minimale affichée
uniform float u_isole;      // 1 : au moins un cluster est isolé
uniform vec3 u_gris;
uniform sampler2D u_tex;

out vec4 v_couleur;
out float v_taille;

void main() {
  int c = int(a_cluster + 0.5);
  vec4 couleur = texelFetch(u_tex, ivec2(c, 0), 0);
  vec4 drapeau = texelFetch(u_tex, ivec2(c, 1), 0);

  float visible = drapeau.b;
  if (c == 0) visible *= u_bruit;
  else visible *= step(u_certitude, a_prob + 0.0001);

  // La certitude porte l'opacité : un point de bord pèse moins qu'un point de cœur.
  float alpha = c == 0 ? 0.42 : mix(0.28, 0.9, a_prob);
  float taille = u_taille * (c == 0 ? 0.85 : 1.0);
  vec3 rgb = couleur.rgb;

  if (u_t >= 0.0) {
    float age = u_t - a_minute;
    if (age < 0.0) {
      visible = 0.0;
    } else if (age > u_fenetre) {
      if (u_trainee > 0.5) {
        alpha *= 0.24;
        rgb = mix(rgb, u_gris, 0.5);
      } else {
        visible = 0.0;
      }
    } else {
      // Un point qui vient de paraître est un peu plus gros pendant ~2 h.
      float frais = 1.0 - age / u_fenetre;
      taille *= 1.0 + 1.1 * smoothstep(0.9, 1.0, frais);
      alpha = max(alpha, 0.55);
    }
  }

  if (u_isole > 0.5) {
    if (drapeau.r < 0.5) {
      alpha *= 0.12;
      rgb = u_gris;
    } else {
      taille *= 1.45;   // les clusters isolés ressortent même vus de loin
    }
  }
  if (drapeau.g > 0.5) {
    taille *= 1.3;
    alpha = max(alpha, 0.8);
  }

  gl_Position = vec4(a_pos * u_echelle + u_decalage, 0.0, 1.0);
  if (visible < 0.5) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
  } else {
    gl_PointSize = taille;
  }
  v_couleur = vec4(rgb * alpha, alpha);   // alpha prémultiplié
  v_taille = taille;
}`;

const FRAGMENTS = `#version 300 es
precision mediump float;
in vec4 v_couleur;
in float v_taille;
out vec4 sortie;

void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float bord = 1.5 / max(v_taille, 1.0);
  float a = 1.0 - smoothstep(1.0 - bord, 1.0, d);
  if (a <= 0.0) discard;
  sortie = v_couleur * a;
}`;

function compile(gl, type, source) {
  const s = gl.createShader(type);
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(`Shader : ${gl.getShaderInfoLog(s)}`);
  }
  return s;
}

export function hexVersRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export class RenduPoints {
  constructor(canvas, donnees) {
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    if (!gl) throw new Error("webgl2-indisponible");
    this.gl = gl;
    this.canvas = canvas;
    this.n = donnees.n;

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, SOMMETS));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAGMENTS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    this.prog = prog;
    gl.useProgram(prog);

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const p = donnees.p;

    const pos = new Uint16Array(this.n * 2);
    for (let i = 0; i < this.n; i++) { pos[2 * i] = p.x[i]; pos[2 * i + 1] = p.y[i]; }
    this.attribut("a_pos", pos, 2, gl.UNSIGNED_SHORT, true);

    const cl = new Uint8Array(this.n);
    for (let i = 0; i < this.n; i++) cl[i] = p.cluster[i] + 1;
    this.attribut("a_cluster", cl, 1, gl.UNSIGNED_BYTE, false);
    this.attribut("a_prob", p.prob, 1, gl.UNSIGNED_BYTE, true);
    this.attribut("a_minute", p.minute, 1, gl.UNSIGNED_SHORT, false);

    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.texels = new Uint8Array(65 * 2 * 4);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 65, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.texels);

    this.u = {};
    for (const nom of ["u_echelle", "u_decalage", "u_taille", "u_t", "u_fenetre", "u_trainee",
      "u_bruit", "u_certitude", "u_isole", "u_gris", "u_tex"]) {
      this.u[nom] = gl.getUniformLocation(prog, nom);
    }
    gl.uniform1i(this.u.u_tex, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.fond = [245 / 255, 243 / 255, 238 / 255];
  }

  attribut(nom, donnees, taille, type, normalise) {
    const gl = this.gl;
    const loc = gl.getAttribLocation(this.prog, nom);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, donnees, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc);
    if (normalise || type === gl.FLOAT) gl.vertexAttribPointer(loc, taille, type, normalise, 0, 0);
    else gl.vertexAttribPointer(loc, taille, type, false, 0, 0);
  }

  /** couleurs : tableau de 65 [r, g, b] ; drapeaux : tableau de 65 [isolé, survolé, visible]. */
  majTexture(couleurs, drapeaux) {
    const t = this.texels;
    for (let c = 0; c < 65; c++) {
      const [r, g, b] = couleurs[c];
      t.set([r, g, b, 255], c * 4);
      const [iso, survol, visible] = drapeaux[c];
      t.set([iso ? 255 : 0, survol ? 255 : 0, visible ? 255 : 0, 255], (65 + c) * 4);
    }
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 65, 2, gl.RGBA, gl.UNSIGNED_BYTE, t);
  }

  redimensionne(largeur, hauteur, dpr) {
    const w = Math.max(1, Math.round(largeur * dpr));
    const h = Math.max(1, Math.round(hauteur * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
  }

  /**
   * vue : { cx, cy, k } en coordonnées de données, k en pixels CSS par unité.
   * bornes : bornes de quantification (meta.bornes). params : voir le shader.
   */
  dessine(vue, bornes, largeur, hauteur, params) {
    const gl = this.gl;
    const { x0, x1, y0, y1 } = bornes;
    const sx = (2 * vue.k) / largeur;
    const sy = (2 * vue.k) / hauteur;
    gl.useProgram(this.prog);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform2f(this.u.u_echelle, (x1 - x0) * sx, (y1 - y0) * sy);
    gl.uniform2f(this.u.u_decalage, (x0 - vue.cx) * sx, (y0 - vue.cy) * sy);
    gl.uniform1f(this.u.u_taille, params.taille);
    gl.uniform1f(this.u.u_t, params.t ?? -1);
    gl.uniform1f(this.u.u_fenetre, params.fenetre ?? 1440);
    gl.uniform1f(this.u.u_trainee, params.trainee ? 1 : 0);
    gl.uniform1f(this.u.u_bruit, params.bruit ? 1 : 0);
    gl.uniform1f(this.u.u_certitude, params.certitude || 0);
    gl.uniform1f(this.u.u_isole, params.isole ? 1 : 0);
    gl.uniform3f(this.u.u_gris, 0.72, 0.70, 0.66);
    gl.clearColor(...this.fond, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, this.n);
  }
}
