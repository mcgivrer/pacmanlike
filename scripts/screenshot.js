/* Génère des screenshots PNG du jeu (rendu du canvas 2D) via node-canvas.
 * Reproduit le rendu de main.js: labyrinthe + joueur, écran de titre, et
 * une variante avec quelques "pastilles" pour illustrer.
 */
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const CELL = 8, COLS = 28, ROWS = 31;
const W = COLS * CELL, H = ROWS * CELL;

// Labyrinthe identique à main.js
const maze = (() => {
  const m = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  for (let x = 0; x < COLS; x++) { m[0][x] = 1; m[ROWS - 1][x] = 1; }
  for (let y = 0; y < ROWS; y++) { m[y][0] = 1; m[y][COLS - 1] = 1; }
  for (const [x, y, w, h] of [[4,4,6,3],[18,4,6,3],[4,22,6,3],[18,22,6,3]]) {
    for (let i=0;i<w;i++) for (let j=0;j<h;j++) m[y+j][x+i] = 1;
  }
  return m;
})();

function drawMaze(ctx, withDots=false) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  // murs
  ctx.fillStyle = '#2121ff';
  for (let y=0;y<ROWS;y++) for (let x=0;x<COLS;x++) if (maze[y][x]===1) ctx.fillRect(x*CELL,y*CELL,CELL,CELL);
  // pastilles
  if (withDots) {
    ctx.fillStyle = '#ffd83d';
    for (let y=0;y<ROWS;y++) for (let x=0;x<COLS;x++) if (maze[y][x]===0) ctx.fillRect(x*CELL+3, y*CELL+3, 2, 2);
  }
}

function drawPlayer(ctx, cx, cy, mouthAngle=0) {
  ctx.fillStyle = '#ffff00';
  ctx.beginPath();
  ctx.arc(cx, cy, CELL*0.45, mouthAngle, Math.PI*2 - mouthAngle);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fill();
}

function save(ctx, name) {
  const out = path.join(__dirname, '..', 'docs', 'screenshots', name);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, ctx.canvas.toBuffer('image/png'));
  console.log('capturé:', out);
}

// 1) Écran de jeu en cours (joueur + pastilles)
{
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  drawMaze(ctx, true);
  drawPlayer(ctx, Math.floor(COLS/2)*CELL+4, Math.floor(ROWS/2)*CELL+4, 0.3);
  save(ctx, 'gameplay.png');
}

// 2) Écran de jeu sans pastilles (joueur seul)
{
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  drawMaze(ctx, false);
  drawPlayer(ctx, Math.floor(COLS/2)*CELL+4, Math.floor(ROWS/2)*CELL+4, 0.0);
  save(ctx, 'gameplay-nodots.png');
}

// 3) Labyrinthe seul (titre / vue d'ensemble)
{
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  drawMaze(ctx, true);
  save(ctx, 'maze.png');
}
