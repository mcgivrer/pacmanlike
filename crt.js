/* ===========================================================================
 * PacmanLike — post-traitement CRT via WebGL
 *
 * Le jeu est rendu sur un canvas 2D (`#game`) servant de texture source.
 * Ce module crée un canvas WebGL (`#crt`) qui:
 *   1. affiche la texture (passe quad plein écran),
 *   2. applique un shader de fragment simulant un moniteur CRT:
 *        - distorsion de barillet (courbure),
 *        - vignettage,
 *        - lignes de balayage (scanlines),
 *        - séparation des canaux RGB (chromatic aberration),
 *        - scintillement (flicker),
 *        - glitches occasionnels liés au balayage (bandes décalées,
 *          déplacement horizontal transitoire).
 *
 * Aucune dépendance externe: WebGL1 vanilla, attributs/uniformes minimisés.
 * ========================================================================== */

import { CRT_VERTEX, CRT_FRAGMENT } from './shaders/crt.glsl.js';

/** Crée et configure le rendu CRT au-dessus du canvas de jeu source. */
export function createCRTRenderer(sourceCanvas) {
  const display = document.createElement('canvas');
  display.id = 'crt';
  // Taille logique interne = celle du jeu; affichage géré par le CSS.
  display.width = sourceCanvas.width;
  display.height = sourceCanvas.height;
  // On insère le canvas CRT juste après le canvas de jeu dans le DOM.
  sourceCanvas.parentElement.insertBefore(display, sourceCanvas.nextSibling);

  const gl = display.getContext('webgl', { antialias: false, premultipliedAlpha: false });
  if (!gl) {
    // Fallback: pas de WebGL -> on garde simplement le canvas 2D visible.
    display.remove();
    console.warn('WebGL non disponible, rendu CRT désactivé.');
    return { render() {}, resize() {}, enabled: false };
  }

  // --- Programme shader -----------------------------------------------------
  const program = compileProgram(gl, CRT_VERTEX, CRT_FRAGMENT);
  gl.useProgram(program);

  const aPos = gl.getAttribLocation(program, 'a_pos');
  const aUv = gl.getAttribLocation(program, 'a_uv');

  // Quad plein écran (deux triangles), UV en unité de texture.
  const quad = new Float32Array([
    // pos     uv
    -1, -1, 0, 1,
     1, -1, 1, 1,
    -1,  1, 0, 0,
    -1,  1, 0, 0,
     1, -1, 1, 1,
     1,  1, 1, 0,
  ]);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

  const stride = 4 * 4; // 4 floats * 4 octets
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(aUv);
  gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, stride, 2 * 4);

  // --- Texture source (canvas 2D) ------------------------------------------
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // --- Uniformes ------------------------------------------------------------
  const uTex = gl.getUniformLocation(program, 'u_tex');
  const uRes = gl.getUniformLocation(program, 'u_resolution');
  const uTime = gl.getUniformLocation(program, 'u_time');
  const uGlitch = gl.getUniformLocation(program, 'u_glitch');

  gl.uniform1i(uTex, 0);

  // --- État des glitches (générés aléatoirement) ---------------------------
  let glitchUntil = 0;     // timestamp de fin du glitch courant
  let glitchBand = 0;      // position Y (0..1) de la bande décalée
  let glitchShift = 0;     // amplitude du décalage horizontal
  let nextGlitchAt = 3 + Math.random() * 7; // prochain déclenchement (s)

  /** Met à jour la taille du canvas d'affichage selon l'élément DOM. */
  function resize() {
    const w = display.clientWidth | 0;
    const h = display.clientHeight | 0;
    if (display.width !== w || display.height !== h) {
      display.width = w;
      display.height = h;
    }
    gl.viewport(0, 0, display.width, display.height);
  }

  /** Rendu CRT: échantillonne la texture du canvas de jeu et applique l'effet. */
  function render(timeSec) {
    resize();

    // Gestion des glitches de balayage: déclenchement sporadique.
    if (timeSec > nextGlitchAt && timeSec > glitchUntil) {
      glitchUntil = timeSec + 0.08 + Math.random() * 0.18; // durée courte
      glitchBand = Math.random();
      glitchShift = (Math.random() * 2 - 1) * 0.018;
      nextGlitchAt = timeSec + 4 + Math.random() * 9;
    }
    const glitchActive = timeSec < glitchUntil ? 1.0 : 0.0;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // On recharge la texture depuis le canvas 2D à chaque frame.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);

    gl.uniform2f(uRes, display.width, display.height);
    gl.uniform1f(uTime, timeSec);
    // on passe band, shift, active via un vec3 (z = active)
    gl.uniform3f(uGlitch, glitchBand, glitchShift, glitchActive);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  return { render, resize, enabled: true, display };
}

// --- Compilation des shaders ------------------------------------------------
function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error('Erreur de compilation shader: ' + log);
  }
  return sh;
}

function compileProgram(gl, vsSrc, fsSrc) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error('Erreur de link programme: ' + log);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return prog;
}
