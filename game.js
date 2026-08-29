'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#7986cb', // J - indigo
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const HIGHSCORES_KEY = 'tetris.highscores.v1';
const MAX_HIGHSCORES = 5;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const highscoreEntry = document.getElementById('highscore-entry');
const playerNameInput = document.getElementById('player-name-input');
const saveScoreBtn = document.getElementById('save-score-btn');
const hsTbodyGameover = document.getElementById('hs-tbody-gameover');
const startScreen = document.getElementById('start-screen');
const playBtn = document.getElementById('play-btn');
const resetScoresBtn = document.getElementById('reset-scores-btn');
const hsTbodyStart = document.getElementById('hs-tbody-start');
const hsBestCombo = document.getElementById('hs-best-combo');
const hsBestLines = document.getElementById('hs-best-lines');

let board, current, next, score, lines, level, combo, maxCombo, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function loadHighscores() {
  try {
    const raw = localStorage.getItem(HIGHSCORES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(e => e && typeof e === 'object'
      && typeof e.name === 'string'
      && typeof e.score === 'number'
      && typeof e.lines === 'number'
      && typeof e.level === 'number'
      && typeof e.maxCombo === 'number'
      && typeof e.date === 'string');
  } catch {
    return [];
  }
}

function saveHighscores(list) {
  try {
    localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(list));
  } catch {}
}

function clearHighscores() {
  try {
    localStorage.removeItem(HIGHSCORES_KEY);
  } catch {}
}

function qualifiesForHighscore(s) {
  const list = loadHighscores();
  if (list.length < MAX_HIGHSCORES) return true;
  return s > list[list.length - 1].score;
}

function addHighscore(name, s, l, lvl, comboValue) {
  const list = loadHighscores();
  const entry = { name: name || 'Jugador', score: s, lines: l, level: lvl, maxCombo: comboValue, date: new Date().toISOString() };
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  list.splice(MAX_HIGHSCORES);
  saveHighscores(list);
  return { list, index: list.indexOf(entry) };
}

function bestComboAndLines() {
  const list = loadHighscores();
  let bestCombo = 0, bestLines = 0;
  for (const e of list) {
    if (e.maxCombo > bestCombo) bestCombo = e.maxCombo;
    if (e.lines > bestLines) bestLines = e.lines;
  }
  return { bestCombo, bestLines };
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderHighscoreTable(tbody, list, highlightIndex) {
  tbody.innerHTML = '';
  if (!list.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.textContent = 'Sin récords todavía';
    td.className = 'hs-empty';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  list.forEach((entry, i) => {
    const tr = document.createElement('tr');
    if (i === highlightIndex) tr.classList.add('hs-highlight');
    tr.innerHTML = `<td>${i + 1}</td><td>${escapeHtml(entry.name)}</td><td>${entry.score.toLocaleString()}</td><td>${entry.lines}</td><td>${entry.level}</td><td>${entry.maxCombo}</td>`;
    tbody.appendChild(tr);
  });
}

function refreshStartScreen() {
  const list = loadHighscores();
  renderHighscoreTable(hsTbodyStart, list, -1);
  const { bestCombo, bestLines } = bestComboAndLines();
  hsBestCombo.textContent = bestCombo;
  hsBestLines.textContent = bestLines;
}

function showStartScreen() {
  refreshStartScreen();
  startScreen.classList.remove('hidden');
}

function hideStartScreen() {
  startScreen.classList.add('hidden');
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
  return cleared;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  const cleared = clearLines();
  if (cleared > 0) {
    combo++;
    if (combo > maxCombo) maxCombo = combo;
  } else {
    combo = 0;
  }
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = '#22222e';
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  if (qualifiesForHighscore(score)) {
    highscoreEntry.classList.remove('hidden');
    playerNameInput.value = 'Jugador';
  } else {
    highscoreEntry.classList.add('hidden');
  }
  renderHighscoreTable(hsTbodyGameover, loadHighscores(), -1);
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  combo = 0;
  maxCombo = 0;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  highscoreEntry.classList.add('hidden');
  hsTbodyGameover.innerHTML = '';
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'Space') e.preventDefault();
  if (!current) return;
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

playBtn.addEventListener('click', () => {
  hideStartScreen();
  init();
});

resetScoresBtn.addEventListener('click', () => {
  if (confirm('¿Seguro que quieres borrar todos los récords?')) {
    clearHighscores();
    refreshStartScreen();
  }
});

saveScoreBtn.addEventListener('click', () => {
  const name = playerNameInput.value.trim() || 'Jugador';
  const { list, index } = addHighscore(name, score, lines, level, maxCombo);
  renderHighscoreTable(hsTbodyGameover, list, index);
  highscoreEntry.classList.add('hidden');
});

showStartScreen();
