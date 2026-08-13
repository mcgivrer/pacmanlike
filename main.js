/* ===========================================================================
 * PacmanLike — point d'entrée
 * Squelette de jeu : canvas pixel art, boucle à pas fixe, joueur déplaçable,
 * entrées clavier + contrôles tactiles transparents (réactifs au média).
 *
 * Note : la logique de jeu complète (fantômes, pastilles, niveaux) est
 * volontairement minimale ici ; l'objet de cette livraison est le squelette
 * jouable et la compatibilité mobile avec contrôles tactiles.
 * ========================================================================== */

import { createCRTRenderer } from './crt.js';
import { createInput, InputDevice } from './input.js';

const CELL = 8;                 // taille d'une cellule en px (résolution logique)
const COLS = 28;                // 224 / 8
const ROWS = 31;                // 248 / 8
const SPEED = 32;               // cellules par seconde (joueur)
const STEP = 1 / 60;            // pas de simulation fixe (s)

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// --- Rendu CRT (post-traitement WebGL) ----------------------------------
// Le canvas 2D sert de source; le canvas WebGL créé par le renderer devient
// l'affichage visible. On masque le canvas 2D source.
const crt = createCRTRenderer(canvas);
canvas.classList.add('source-canvas');

// --- Labyrinthe simplifié (1 = mur, 0 = vide) -------------------------------
// Grille 28x31 générée par bordure + quelques murs internes pour la démo.
const maze = (() => {
  const m = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  for (let x = 0; x < COLS; x++) { m[0][x] = 1; m[ROWS - 1][x] = 1; }
  for (let y = 0; y < ROWS; y++) { m[y][0] = 1; m[y][COLS - 1] = 1; }
  // quelques blocs internes
  for (const [x, y, w, h] of [[4, 4, 6, 3], [18, 4, 6, 3], [4, 22, 6, 3], [18, 22, 6, 3]]) {
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) m[y + j][x + i] = 1;
  }
  return m;
})();

function isWall(col, row) {
  // Tunnels latéraux : les colonnes hors-grille sont traversables.
  if (row < 0 || row >= ROWS) return true;
  if (col < 0 || col >= COLS) return false;
  return maze[row][col] === 1;
}

// --- Entité joueur ----------------------------------------------------------
const player = {
  x: Math.floor(COLS / 2) + 0.5,   // position en cellules (centre)
  y: Math.floor(ROWS / 2) + 0.5,
  dir: { x: 0, y: 0 },
  nextDir: { x: 0, y: 0 },
};

const DIRECTIONS = {
  up:    { x: 0, y: -1 },
  down:  { x: 0, y: 1 },
  left:  { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

// --- Entrées unifiées : clavier + tactile + gamepad -----------------------
const input = createInput({
  onDirection: (name) => { const d = DIRECTIONS[name]; if (d) player.nextDir = d; },
  onAction: toggleAction,
  onDeviceChange: (device) => updateTutorial(device),
});

// Branchement des boutons tactiles du DOM (D-pad + action).
input.bindTouchButton('.dpad-btn', (btn) => input.setDirection(btn.dataset.dir));
input.bindTouchButton('#touch-action', () => input.pressAction());

// --- Tutoriel de démarrage (adapté au device d'entrée) --------------------
const tutorialList = document.getElementById('tutorial-list');

// Cartouches de touche (clavier) / bouton (manette) / geste (tactile).
const k = (label) => `<span class="key">${label}</span>`;

const TUTORIALS = {
  [InputDevice.KEYBOARD]: [
    `Déplacement : ${k('↑')} ${k('↓')} ${k('←')} ${k('→')} <span class="lbl">ou</span> ${k('Z')} ${k('Q')} ${k('S')} ${k('D')}`,
    `Démarrer / Pause : ${k('Espace')} <span class="lbl">ou</span> ${k('Entrée')}`,
    `Pause : ${k('P')} <span class="lbl">ou</span> ${k('Échap')}`,
  ],
  [InputDevice.GAMEPAD]: [
    `Déplacement : croix directionnelle <span class="lbl">ou</span> stick gauche`,
    `Démarrer / Pause : bouton ${k('A')} <span class="lbl">ou</span> ${k('Start')}`,
    `Connecte/déconnecte la manette : détection automatique.`,
  ],
  [InputDevice.TOUCH]: [
    `Déplacement : croix directionnelle tactile en bas à gauche`,
    `Démarrer / Pause : bouton ${k('⏯')} en bas à droite`,
  ],
};

function updateTutorial(device) {
  const lines = TUTORIALS[device] || TUTORIALS[InputDevice.KEYBOARD];
  tutorialList.innerHTML = lines.map((l) => `<li>${l}</li>`).join('');
}
updateTutorial(input.device);

// --- État de jeu simplifié --------------------------------------------------
const STATE = { TITLE: 'title', PLAYING: 'playing', PAUSED: 'paused', GAMEOVER: 'gameover' };
let state = STATE.TITLE;
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg = document.getElementById('overlay-message');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const levelEl = document.getElementById('level');

let score = 0;
let lives = 3;
let level = 1;

function showOverlay(title, msg) {
  overlayTitle.textContent = title;
  overlayMsg.textContent = msg;
  overlay.classList.add('visible');
}
function hideOverlay() { overlay.classList.remove('visible'); }

function toggleAction() {
  if (state === STATE.TITLE || state === STATE.GAMEOVER) {
    startGame();
  } else if (state === STATE.PLAYING) {
    togglePause();
  }
}

function togglePause() {
  if (state === STATE.PLAYING) {
    state = STATE.PAUSED;
    showOverlay('Pause', 'Appuie pour reprendre');
  } else if (state === STATE.PAUSED) {
    state = STATE.PLAYING;
    hideOverlay();
  }
}

function startGame() {
  score = 0; lives = 3; level = 1;
  player.x = Math.floor(COLS / 2) + 0.5;
  player.y = Math.floor(ROWS / 2) + 0.5;
  player.dir = { x: 0, y: 0 };
  player.nextDir = { x: 0, y: 0 };
  updateHud();
  state = STATE.PLAYING;
  hideOverlay();
}

function updateHud() {
  scoreEl.textContent = score;
  livesEl.textContent = lives;
  levelEl.textContent = level;
}

// --- Simulation -------------------------------------------------------------
function canMoveTo(col, row) {
  return !isWall(Math.floor(col), Math.floor(row));
}

function update(dt) {
  if (state !== STATE.PLAYING) return;

  // Tente d'appliquer la direction voulue à l'intersection / alignement.
  const col = Math.floor(player.x);
  const row = Math.floor(player.y);
  const cx = col + 0.5;
  const cy = row + 0.5;
  const alignedX = Math.abs(player.x - cx) < 0.1;
  const alignedY = Math.abs(player.y - cy) < 0.1;

  if ((player.nextDir.x !== player.dir.x || player.nextDir.y !== player.dir.y) && (alignedX || alignedY)) {
    const nc = col + player.nextDir.x;
    const nr = row + player.nextDir.y;
    if (!isWall(nc, nr)) {
      player.dir = player.nextDir;
      // recentre sur l'axe perpendiculaire pour éviter de longer un mur.
      if (player.dir.x !== 0) player.y = cy;
      if (player.dir.y !== 0) player.x = cx;
    }
  }

  // Déplacement continu
  const nx = player.x + player.dir.x * SPEED * dt;
  const ny = player.y + player.dir.y * SPEED * dt;

  // Collisions simples (avant/arrière de la cellule selon l'axe de mouvement)
  if (player.dir.x !== 0) {
    const probeX = nx + player.dir.x * 0.4;
    if (!isWall(Math.floor(probeX), row)) player.x = nx;
    else player.x = cx;
  }
  if (player.dir.y !== 0) {
    const probeY = ny + player.dir.y * 0.4;
    if (!isWall(col, Math.floor(probeY))) player.y = ny;
    else player.y = cy;
  }

  // Tunnels latéraux
  if (player.x < -0.5) player.x = COLS - 0.5;
  else if (player.x > COLS - 0.5) player.x = -0.5;
}

// --- Rendu ------------------------------------------------------------------
function render() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Murs
  ctx.fillStyle = '#2121ff';
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (maze[y][x] === 1) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }

  // Joueur (cercle jaune pixel)
  ctx.fillStyle = '#ffff00';
  const px = Math.round(player.x * CELL);
  const py = Math.round(player.y * CELL);
  ctx.beginPath();
  ctx.arc(px, py, CELL * 0.45, 0, Math.PI * 2);
  ctx.fill();
}

// --- Boucle principale à pas fixe ------------------------------------------
let last = performance.now();
let acc = 0;
function loop(now) {
  input.pollGamepad();
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25; // borne anti-saut après tab inactive
  acc += dt;
  while (acc >= STEP) {
    update(STEP);
    acc -= STEP;
  }
  render();
  if (crt.enabled) crt.render(last / 1000);
  requestAnimationFrame(loop);
}

// Écran de titre initial
showOverlay('PacmanLike', input.device === InputDevice.GAMEPAD ? 'Appuie sur A / Start pour jouer' : (input.device === InputDevice.TOUCH ? 'Appuie sur ⏯ pour jouer' : 'Appuie sur Espace pour jouer'));
requestAnimationFrame(loop);
