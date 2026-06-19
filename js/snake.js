(function() {
// Pipeline Snake Game Module

var GRID_SIZE = 20;
var CELL_SIZE = 20;
var CANVAS_WIDTH = 480;
var CANVAS_HEIGHT = 400;
var TICK_RATE_MS = 150;
var STAGE_LABELS = ['R', 'P', 'V', 'I', 'V', 'PR'];
var STAGE_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];

var canvas = null;
var ctx = null;
var tickIntervalId = null;
var animFrameId = null;

var state = {
  snake: [],
  direction: 'right',
  nextDirection: 'right',
  food: { x: 0, y: 0 },
  score: 0,
  active: false,
  gameOver: false,
  startTime: null,
  longestChain: 0,
  particles: [],
  leaderboard: []
};

function getFont(size) {
  if (typeof document === 'undefined') return size + 'px sans-serif';
  var isProfessional = document.body.classList.contains('theme-professional');
  return isProfessional
    ? size + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, "Inter", sans-serif'
    : size + 'px "Press Start 2P", cursive';
}

function getThemeColors() {
  if (typeof document === 'undefined') {
    return { bg: '#111', grid: '#222', text: '#fff', accent: '#f5c518' };
  }
  var cl = document.body.classList;
  if (cl.contains('theme-professional')) {
    return { bg: '#1a1a1a', grid: '#2a2a2a', text: '#e0e0e0', accent: '#333' };
  } else if (cl.contains('theme-light')) {
    return { bg: '#f0f0f0', grid: '#ddd', text: '#333', accent: '#f5c518' };
  } else if (cl.contains('theme-colorful')) {
    return { bg: '#1a1a2e', grid: '#2a2a4e', text: '#fff', accent: '#ff6b6b' };
  }
  return { bg: '#111', grid: '#222', text: '#fff', accent: '#f5c518' };
}

function initSnake(canvasEl) {
  canvas = canvasEl;
  if (canvas) {
    ctx = canvas.getContext('2d');
  }
  state.snake = [
    { x: 5, y: 10, label: STAGE_LABELS[2], colorIdx: 2 },
    { x: 4, y: 10, label: STAGE_LABELS[1], colorIdx: 1 },
    { x: 3, y: 10, label: STAGE_LABELS[0], colorIdx: 0 }
  ];
  state.direction = 'right';
  state.nextDirection = 'right';
  state.score = 0;
  state.active = false;
  state.gameOver = false;
  state.startTime = null;
  state.longestChain = 0;
  state.particles = [];
  spawnFood();
  loadLeaderboard();
  renderLeaderboardDOM();
  return state;
}

function startSnake() {
  // Idempotent: cancel existing loops first
  if (tickIntervalId) {
    clearInterval(tickIntervalId);
    tickIntervalId = null;
  }
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }

  // Reset state
  var cols = Math.floor(CANVAS_WIDTH / CELL_SIZE);
  var rows = Math.floor(CANVAS_HEIGHT / CELL_SIZE);
  var cx = Math.floor(cols / 2);
  var cy = Math.floor(rows / 2);

  state.snake = [
    { x: cx, y: cy, label: STAGE_LABELS[2], colorIdx: 2 },
    { x: cx - 1, y: cy, label: STAGE_LABELS[1], colorIdx: 1 },
    { x: cx - 2, y: cy, label: STAGE_LABELS[0], colorIdx: 0 }
  ];
  state.direction = 'right';
  state.nextDirection = 'right';
  state.score = 0;
  state.active = true;
  state.gameOver = false;
  state.startTime = Date.now();
  state.longestChain = 3;
  state.particles = [];
  spawnFood();

  tickIntervalId = setInterval(function() {
    if (state.active) tick();
  }, TICK_RATE_MS);

  renderLoop();
}

function stopSnake() {
  state.active = false;
  if (tickIntervalId) {
    clearInterval(tickIntervalId);
    tickIntervalId = null;
  }
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

function setDirection(dir) {
  var opposites = { up: 'down', down: 'up', left: 'right', right: 'left' };
  if (opposites[dir] === state.direction) return;
  if (['up', 'down', 'left', 'right'].indexOf(dir) === -1) return;
  state.nextDirection = dir;
}

function tick() {
  if (!state.active || state.gameOver) return;

  state.direction = state.nextDirection;

  var head = state.snake[0];
  var newHead = { x: head.x, y: head.y, label: '', colorIdx: 0 };

  if (state.direction === 'right') newHead.x++;
  else if (state.direction === 'left') newHead.x--;
  else if (state.direction === 'up') newHead.y--;
  else if (state.direction === 'down') newHead.y++;

  var cols = Math.floor(CANVAS_WIDTH / CELL_SIZE);
  var rows = Math.floor(CANVAS_HEIGHT / CELL_SIZE);

  // Wall collision
  if (newHead.x < 0 || newHead.x >= cols || newHead.y < 0 || newHead.y >= rows) {
    doGameOver();
    return;
  }

  // Self collision
  for (var i = 0; i < state.snake.length; i++) {
    if (state.snake[i].x === newHead.x && state.snake[i].y === newHead.y) {
      doGameOver();
      return;
    }
  }

  // Assign label based on snake length cycle
  var nextIdx = state.snake.length % STAGE_LABELS.length;
  newHead.label = STAGE_LABELS[nextIdx];
  newHead.colorIdx = nextIdx;

  state.snake.unshift(newHead);

  // Check food
  if (newHead.x === state.food.x && newHead.y === state.food.y) {
    state.score++;
    state.longestChain = Math.max(state.longestChain, state.snake.length);
    spawnParticles(newHead.x * CELL_SIZE + CELL_SIZE / 2, newHead.y * CELL_SIZE + CELL_SIZE / 2);
    spawnFood();
    updateScoreDisplay();
  } else {
    state.snake.pop();
  }
}

function spawnFood() {
  var cols = Math.floor(CANVAS_WIDTH / CELL_SIZE);
  var rows = Math.floor(CANVAS_HEIGHT / CELL_SIZE);
  var attempts = 0;
  while (attempts < 1000) {
    var fx = Math.floor(Math.random() * cols);
    var fy = Math.floor(Math.random() * rows);
    var occupied = false;
    for (var i = 0; i < state.snake.length; i++) {
      if (state.snake[i].x === fx && state.snake[i].y === fy) {
        occupied = true;
        break;
      }
    }
    if (!occupied) {
      state.food = { x: fx, y: fy };
      return;
    }
    attempts++;
  }
  state.food = { x: 0, y: 0 };
}

function spawnParticles(x, y) {
  var count = 8 + Math.floor(Math.random() * 5);
  for (var i = 0; i < count; i++) {
    var angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    var speed = 1.5 + Math.random() * 2.5;
    state.particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      ttl: 25 + Math.floor(Math.random() * 10),
      type: Math.random() > 0.5 ? 'hat' : 'circle'
    });
  }
}

function updateParticles() {
  for (var i = state.particles.length - 1; i >= 0; i--) {
    var p = state.particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.1; // gravity
    p.ttl--;
    if (p.ttl <= 0) {
      state.particles.splice(i, 1);
    }
  }
}

function render() {
  if (!ctx) return;
  var colors = getThemeColors();
  var cols = Math.floor(CANVAS_WIDTH / CELL_SIZE);
  var rows = Math.floor(CANVAS_HEIGHT / CELL_SIZE);

  // Clear
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Grid lines
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 0.5;
  for (var gx = 0; gx <= cols; gx++) {
    ctx.beginPath();
    ctx.moveTo(gx * CELL_SIZE, 0);
    ctx.lineTo(gx * CELL_SIZE, CANVAS_HEIGHT);
    ctx.stroke();
  }
  for (var gy = 0; gy <= rows; gy++) {
    ctx.beginPath();
    ctx.moveTo(0, gy * CELL_SIZE);
    ctx.lineTo(CANVAS_WIDTH, gy * CELL_SIZE);
    ctx.stroke();
  }

  // Food
  ctx.font = (CELL_SIZE - 4) + 'px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('\uD83D\uDC1B', state.food.x * CELL_SIZE + CELL_SIZE / 2, state.food.y * CELL_SIZE + CELL_SIZE / 2);

  // Snake segments
  for (var si = 0; si < state.snake.length; si++) {
    var seg = state.snake[si];
    var segColor = STAGE_COLORS[seg.colorIdx % STAGE_COLORS.length];
    ctx.fillStyle = segColor;
    var sx = seg.x * CELL_SIZE + 1;
    var sy = seg.y * CELL_SIZE + 1;
    var sw = CELL_SIZE - 2;
    var sh = CELL_SIZE - 2;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(sx, sy, sw, sh, 4);
      ctx.fill();
    } else {
      ctx.fillRect(sx, sy, sw, sh);
    }
    // Label
    ctx.fillStyle = '#fff';
    ctx.font = (CELL_SIZE * 0.5) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(seg.label, seg.x * CELL_SIZE + CELL_SIZE / 2, seg.y * CELL_SIZE + CELL_SIZE / 2);
  }

  // Particles
  updateParticles();
  for (var pi = 0; pi < state.particles.length; pi++) {
    var part = state.particles[pi];
    ctx.globalAlpha = Math.min(1, part.ttl / 10);
    if (part.type === 'hat') {
      ctx.font = '10px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\u26D1\uFE0F', part.x, part.y);
    } else {
      ctx.fillStyle = '#f5c518';
      ctx.beginPath();
      ctx.arc(part.x, part.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // HUD
  ctx.fillStyle = colors.text;
  ctx.font = getFont(10);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Score: ' + state.score, 8, 6);

  if (state.startTime) {
    var elapsed = Math.floor((Date.now() - state.startTime) / 1000);
    ctx.textAlign = 'right';
    ctx.fillText(elapsed + 's', CANVAS_WIDTH - 8, 6);
  }

  // Game over overlay
  if (state.gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = '#ff4444';
    ctx.font = getFont(16);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
    ctx.fillStyle = colors.text;
    ctx.font = getFont(8);
    ctx.fillText('Score: ' + state.score + '  Chain: ' + state.longestChain, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 15);
    ctx.fillText('Press Start to retry', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);
  }
}

function renderLoop() {
  if (!state.active && !state.gameOver) return;
  render();
  if (state.active) {
    animFrameId = requestAnimationFrame(renderLoop);
  }
}

function doGameOver() {
  state.active = false;
  state.gameOver = true;
  if (tickIntervalId) {
    clearInterval(tickIntervalId);
    tickIntervalId = null;
  }
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }

  var timeSurvived = state.startTime ? Math.floor((Date.now() - state.startTime) / 1000) : 0;
  state.leaderboard.push({
    score: state.score,
    time: timeSurvived,
    chain: state.longestChain,
    date: new Date().toISOString()
  });
  state.leaderboard.sort(function(a, b) { return b.score - a.score; });
  if (state.leaderboard.length > 10) {
    state.leaderboard = state.leaderboard.slice(0, 10);
  }
  saveLeaderboard();
  renderLeaderboardDOM();
  render();
  updateScoreDisplay();
}

function updateScoreDisplay() {
  if (typeof document === 'undefined') return;
  var el = document.getElementById('snake-score');
  if (el) {
    el.textContent = state.gameOver
      ? 'Game Over! Score: ' + state.score
      : 'Score: ' + state.score;
  }
}

function loadLeaderboard() {
  state.leaderboard = [];
  if (typeof localStorage === 'undefined') return;
  try {
    var raw = localStorage.getItem('foreman-snake-scores');
    if (!raw) return;
    var parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    state.leaderboard = parsed.filter(function(entry) {
      return entry && typeof entry.score === 'number' && typeof entry.time === 'number';
    }).slice(0, 10);
  } catch (e) {
    state.leaderboard = [];
  }
}

function saveLeaderboard() {
  if (typeof localStorage === 'undefined') return;
  try {
    var data = state.leaderboard.slice(0, 10);
    localStorage.setItem('foreman-snake-scores', JSON.stringify(data));
  } catch (e) { /* ignore */ }
}

function clearLeaderboard() {
  state.leaderboard = [];
  if (typeof localStorage !== 'undefined') {
    try { localStorage.removeItem('foreman-snake-scores'); } catch (e) { /* ignore */ }
  }
  renderLeaderboardDOM();
}

function renderLeaderboardDOM() {
  if (typeof document === 'undefined') return;
  var list = document.getElementById('snake-leaderboard-list');
  if (!list) return;
  list.innerHTML = '';
  for (var i = 0; i < state.leaderboard.length; i++) {
    var entry = state.leaderboard[i];
    var li = document.createElement('li');
    li.innerHTML = '<span>Score: ' + entry.score + '</span><span>' + entry.time + 's | Chain: ' + (entry.chain || 0) + '</span>';
    list.appendChild(li);
  }
}

function getSnakeState() {
  return state;
}

function getLeaderboard() {
  return state.leaderboard;
}

// Keyboard handler
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', function(e) {
    var panel = document.getElementById('panel-snake');
    if (!panel || !panel.classList.contains('active')) return;

    var keyMap = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', W: 'up', s: 'down', S: 'down', a: 'left', A: 'left', d: 'right', D: 'right'
    };

    if (keyMap[e.key]) {
      e.preventDefault();
      setDirection(keyMap[e.key]);
    }

    if ((e.key === ' ' || e.key === 'Enter') && (!state.active || state.gameOver)) {
      e.preventDefault();
      startSnake();
    }
  });
}

var SnakeModule = {
  initSnake: initSnake,
  startSnake: startSnake,
  stopSnake: stopSnake,
  getSnakeState: getSnakeState,
  setDirection: setDirection,
  tick: tick,
  getLeaderboard: getLeaderboard,
  clearLeaderboard: clearLeaderboard,
  getFont: getFont,
  GRID_SIZE: GRID_SIZE,
  CELL_SIZE: CELL_SIZE,
  STAGE_LABELS: STAGE_LABELS
};

if (typeof module !== 'undefined' && module.exports) { module.exports = SnakeModule; }
if (typeof window !== 'undefined') { window.ForemanSnake = SnakeModule; }
})();
