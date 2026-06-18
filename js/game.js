// Dodge the Bugs! - Game Module
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 48;
const BUG_SIZE = 24;
const PLAYER_SPEED = 6;
const BUG_BASE_SPEED = 2;
const SPAWN_INTERVAL_MS = 800;

let canvas = null;
let ctx = null;
let animFrameId = null;
let spawnIntervalId = null;

let state = {
  player: { x: 0, y: 0, width: PLAYER_WIDTH, height: PLAYER_HEIGHT },
  bugs: [],
  score: 0,
  active: false,
  gameOver: false,
};

function initGame(canvasEl) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  state.player.x = (canvas.width - PLAYER_WIDTH) / 2;
  state.player.y = canvas.height - PLAYER_HEIGHT - 10;
  state.player.width = PLAYER_WIDTH;
  state.player.height = PLAYER_HEIGHT;
  state.bugs = [];
  state.score = 0;
  state.active = false;
  state.gameOver = false;
  return state;
}

function getGameState() {
  return state;
}

function startGame() {
  state.bugs = [];
  state.score = 0;
  state.active = true;
  state.gameOver = false;
  state.player.x = (canvas.width - PLAYER_WIDTH) / 2;
  state.player.y = canvas.height - PLAYER_HEIGHT - 10;

  updateScoreDisplay();
  scheduleSpawn();
  loop();
}

function stopGame() {
  state.active = false;
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  if (spawnIntervalId) {
    clearInterval(spawnIntervalId);
    spawnIntervalId = null;
  }
}

function movePlayer(direction) {
  if (direction === 'left') {
    state.player.x = Math.max(0, state.player.x - PLAYER_SPEED);
  } else if (direction === 'right') {
    state.player.x = Math.min(canvas.width - PLAYER_WIDTH, state.player.x + PLAYER_SPEED);
  }
}

function spawnBug() {
  const speed = BUG_BASE_SPEED + Math.floor(state.score / 5) * 0.5;
  const x = Math.random() * (canvas.width - BUG_SIZE);
  state.bugs.push({ x, y: -BUG_SIZE, speed });
}

function scheduleSpawn() {
  if (spawnIntervalId) clearInterval(spawnIntervalId);
  const interval = Math.max(300, SPAWN_INTERVAL_MS - state.score * 10);
  spawnIntervalId = setInterval(() => {
    if (state.active) {
      spawnBug();
      // Re-schedule with updated interval
      const newInterval = Math.max(300, SPAWN_INTERVAL_MS - state.score * 10);
      if (newInterval !== interval) {
        scheduleSpawn();
      }
    }
  }, interval);
}

function tick() {
  // Move bugs down
  for (let i = state.bugs.length - 1; i >= 0; i--) {
    const bug = state.bugs[i];
    bug.y += bug.speed;

    // Check collision (AABB)
    if (state.active && aabb(state.player, bug)) {
      state.gameOver = true;
      state.active = false;
      updateScoreDisplay();
      return;
    }

    // Remove off-screen bugs
    if (bug.y > (canvas ? canvas.height : 400)) {
      state.bugs.splice(i, 1);
      if (state.active) {
        state.score++;
        updateScoreDisplay();
      }
    }
  }
}

function aabb(player, bug) {
  return (
    player.x < bug.x + BUG_SIZE &&
    player.x + PLAYER_WIDTH > bug.x &&
    player.y < bug.y + BUG_SIZE &&
    player.y + PLAYER_HEIGHT > bug.y
  );
}

function updateScoreDisplay() {
  if (typeof document !== 'undefined') {
    const el = document.getElementById('game-score');
    if (el) {
      el.textContent = state.gameOver
        ? 'Game Over! Score: ' + state.score
        : 'Score: ' + state.score;
    }
  }
}

function render() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw player (orange hard-hat worker)
  ctx.fillStyle = '#f5a623';
  ctx.fillRect(state.player.x, state.player.y + 10, PLAYER_WIDTH, PLAYER_HEIGHT - 10);
  // Hard hat
  ctx.fillStyle = '#f5c518';
  ctx.fillRect(state.player.x - 4, state.player.y, PLAYER_WIDTH + 8, 14);
  ctx.fillRect(state.player.x + 8, state.player.y - 4, PLAYER_WIDTH - 16, 6);

  // Draw bugs
  for (const bug of state.bugs) {
    ctx.fillStyle = '#4caf50';
    ctx.beginPath();
    ctx.arc(bug.x + BUG_SIZE / 2, bug.y + BUG_SIZE / 2, BUG_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();
    // Antennae
    ctx.strokeStyle = '#2e7d32';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bug.x + BUG_SIZE / 3, bug.y);
    ctx.lineTo(bug.x + BUG_SIZE / 3 - 4, bug.y - 8);
    ctx.moveTo(bug.x + (BUG_SIZE * 2) / 3, bug.y);
    ctx.lineTo(bug.x + (BUG_SIZE * 2) / 3 + 4, bug.y - 8);
    ctx.stroke();
  }

  // Score text on canvas
  ctx.fillStyle = '#f5c518';
  ctx.font = '12px "Press Start 2P", cursive';
  ctx.textAlign = 'left';
  ctx.fillText('Score: ' + state.score, 10, 20);

  if (state.gameOver) {
    ctx.fillStyle = '#ff4444';
    ctx.font = '16px "Press Start 2P", cursive';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
    ctx.font = '10px "Press Start 2P", cursive';
    ctx.fillText('Press Start to retry', canvas.width / 2, canvas.height / 2 + 30);
  }
}

function loop() {
  if (!state.active) return;
  tick();
  render();
  animFrameId = requestAnimationFrame(loop);
}

const GameModule = { initGame, startGame, stopGame, getGameState, movePlayer, tick, PLAYER_WIDTH, PLAYER_HEIGHT, BUG_SIZE, PLAYER_SPEED };
if (typeof module !== 'undefined' && module.exports) { module.exports = GameModule; }
if (typeof window !== 'undefined') { window.ForemanGame = GameModule; }
