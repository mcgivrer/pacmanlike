/* ===========================================================================
 * Shaders CRT pour PacmanLike
 * Exportés en chaînes JS (pas de loader de fichiers .glsl côté navigateur).
 * ========================================================================== */

// Vertex shader: simple quad plein écran + transmission des UV.
export const CRT_VERTEX = `
attribute vec2 a_pos;
attribute vec2 a_uv;
varying vec2 v_uv;
void main() {
  v_uv = a_uv;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// Fragment shader: effet moniteur CRT.
//  - distorsion de barillet (courbure d'écran)
//  - vignettage des coins
//  - lignes de balayage (scanlines)
//  - séparation des canaux RGB (chromatic aberration) sur les bords
//  - scintillement global (flicker) basse fréquence
//  - glitches de balayage: bande horizontale décalée ponctuellement
export const CRT_FRAGMENT = `
precision mediump float;
varying vec2 v_uv;

uniform sampler2D u_tex;
uniform vec2  u_resolution;
uniform float u_time;
uniform vec3  u_glitch; // x = bandY, y = shiftX, z = active (0/1)

// Distorsion de barillet: écarte les UV vers le centre pour courber l'écran.
// `amount` contrôle la courbure (0 = écran plat).
vec2 barrel(vec2 uv, float amount) {
  vec2 c = uv - 0.5;
  float r2 = dot(c, c);
  uv = uv + c * r2 * amount;
  return uv;
}

void main() {
  // Courbure d'écran (légère) + vignettage lié.
  vec2 uv = barrel(v_uv, 0.12);

  // En dehors de l'écran courbé -> noir (bord du tube).
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // --- Glitch de balayage: bande horizontale décalée ----------------------
  float bandY = u_glitch.x;
  float shiftX = u_glitch.y;
  float gActive = u_glitch.z;
  // Largeur de la bande perturbée.
  float bandHalf = 0.04;
  float bandMask = step(abs(uv.y - bandY), bandHalf) * gActive;
  // Décalage horizontal progressif (doux sur les bords de la bande).
  float soft = smoothstep(bandHalf, 0.0, abs(uv.y - bandY));
  uv.x += shiftX * soft * bandMask;

  // --- Aberration chromatique (séparation RGB sur les bords) ---------------
  float dist = length(uv - 0.5);
  float aberr = 0.0015 + dist * 0.004;
  vec3 col;
  col.r = texture2D(u_tex, uv + vec2( aberr, 0.0)).r;
  col.g = texture2D(u_tex, uv).g;
  col.b = texture2D(u_tex, uv + vec2(-aberr, 0.0)).b;

  // --- Lignes de balayage (scanlines) -------------------------------------
  // On utilise la résolution d'affichage pour une densité cohérente.
  float line = sin(uv.y * u_resolution.y * 3.14159) * 0.5 + 0.5;
  col *= mix(1.0, line, 0.35);

  // --- Scintillement (flicker) basse fréquence ----------------------------
  float flicker = 1.0 - 0.04 * (0.5 + 0.5 * sin(u_time * 31.0))
                     - 0.03 * (0.5 + 0.5 * sin(u_time * 113.0 + 2.0));
  col *= flicker;

  // --- Vignettage des coins -----------------------------------------------
  float vig = smoothstep(0.85, 0.35, dist);
  col *= vig;

  // Léger reflet de tube (dégradé diagonal subtil).
  col += 0.02 * smoothstep(0.7, 0.0, uv.x) * smoothstep(0.7, 0.0, uv.y);

  gl_FragColor = vec4(col, 1.0);
}
`;
