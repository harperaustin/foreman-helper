(function() {
// Bug Squash Animation Module
// Pixel-art animation of the foreman chasing and squashing a bug

const FOREMAN_WIDTH = 40;
const FOREMAN_HEIGHT = 48;
const BUG_SIZE = 24;
const CANVAS_W = 480;
const CANVAS_H = 300;

let canvas = null;
let ctx = null;
let animFrameId = null;
let phase = 'idle';
let foreman = { x: 0, y: 0, vx: 0 };
let bug = { x: 0, y: 0, vx: 0, vy: 0, alive: true };
let frameCount = 0;
let squashFrame = 0;

function resetPositions() {
  foreman.x = 60;
  foreman.y = CANVAS_H - 80;
  foreman.vx = 0;
  bug.x = CANVAS_W - 100 + Math.random() * 60;
  bug.y = CANVAS_H - 80 + (Math.random() - 0.5) * 40;
  bug.vx = -1 + Math.random() * 2;
  bug.vy = -1 + Math.random() * 2;
  bug.alive = true;
}

function initAnim(canvasEl) {
  canvas = canvasEl;
  ctx = canvasEl.getContext('2d');
  phase = 'idle';
  frameCount = 0;
  squashFrame = 0;
  resetPositions();
  return getAnimState();
}

function startAnim() {
  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  phase = 'chase';
  frameCount = 0;
  loop();
}

function stopAnim() {
  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

function getAnimState() {
  return {
    phase,
    foreman: { ...foreman },
    bug: { ...bug },
    frameCount
  };
}

function tick() {
  frameCount++;

  if (phase === 'chase') {
    // Foreman moves toward bug
    const dx = bug.x - foreman.x;
    const dy = bug.y - foreman.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 10) {
      foreman.x += (dx / dist) * 3;
      foreman.y += (dy / dist) * 3;
    } else {
      phase = 'squash';
      bug.alive = false;
      squashFrame = 0;
    }

    // Bug moves erratically
    if (bug.alive) {
      if (frameCount % 60 === 0 || Math.random() < 0.02) {
        bug.vx = (Math.random() - 0.5) * 4;
        bug.vy = (Math.random() - 0.5) * 3;
      }
      bug.x += bug.vx;
      bug.y += bug.vy;

      // Bounce off walls
      if (bug.x < BUG_SIZE) { bug.x = BUG_SIZE; bug.vx *= -1; }
      if (bug.x > CANVAS_W - BUG_SIZE) { bug.x = CANVAS_W - BUG_SIZE; bug.vx *= -1; }
      if (bug.y < CANVAS_H - 120) { bug.y = CANVAS_H - 120; bug.vy *= -1; }
      if (bug.y > CANVAS_H - 50) { bug.y = CANVAS_H - 50; bug.vy *= -1; }
    }
  } else if (phase === 'squash') {
    squashFrame++;
    // Stomp oscillation
    foreman.y = (CANVAS_H - 80) + Math.sin(squashFrame * 0.8) * 4;
    if (squashFrame >= 20) {
      phase = 'celebrate';
      squashFrame = 0;
    }
  } else if (phase === 'celebrate') {
    squashFrame++;
    // Jump up/down
    foreman.y = (CANVAS_H - 80) - Math.abs(Math.sin(squashFrame * 0.2)) * 20;
    if (squashFrame >= 40) {
      resetPositions();
      phase = 'chase';
      frameCount = 0;
    }
  }
}

function render() {
  if (!ctx) return;

  // Clear
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Floor
  ctx.fillStyle = '#3d3d5c';
  ctx.fillRect(0, CANVAS_H - 30, CANVAS_W, 30);
  ctx.strokeStyle = '#5c5c8a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, CANVAS_H - 30);
  ctx.lineTo(CANVAS_W, CANVAS_H - 30);
  ctx.stroke();

  // Draw foreman
  const fx = foreman.x;
  const fy = foreman.y;

  // Hard hat (yellow)
  ctx.fillStyle = '#f5c518';
  ctx.fillRect(fx - 12, fy - 24, 24, 8);
  ctx.fillRect(fx - 8, fy - 28, 16, 6);

  // Face (peach)
  ctx.fillStyle = '#ffcc99';
  ctx.fillRect(fx - 8, fy - 16, 16, 14);

  // Eyes
  ctx.fillStyle = '#333';
  ctx.fillRect(fx - 5, fy - 12, 3, 3);
  ctx.fillRect(fx + 2, fy - 12, 3, 3);

  // Body (blue overalls)
  ctx.fillStyle = '#4488cc';
  ctx.fillRect(fx - 10, fy - 2, 20, 20);

  // Boots (brown)
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(fx - 10, fy + 18, 8, 6);
  ctx.fillRect(fx + 2, fy + 18, 8, 6);

  // Squash phase: draw hammer
  if (phase === 'squash') {
    ctx.fillStyle = '#888';
    ctx.fillRect(fx + 12, fy - 20, 4, 18);
    ctx.fillStyle = '#a0522d';
    ctx.fillRect(fx + 8, fy - 26, 12, 8);
  }

  // Celebrate phase: stars
  if (phase === 'celebrate') {
    ctx.fillStyle = '#f5c518';
    ctx.font = '16px "Press Start 2P", cursive';
    ctx.textAlign = 'center';
    ctx.fillText('✓', fx, fy - 36);
    ctx.font = '10px "Press Start 2P", cursive';
    ctx.fillText('★', fx - 20, fy - 30);
    ctx.fillText('★', fx + 20, fy - 30);
  }

  // Draw bug (if alive)
  if (bug.alive) {
    const bx = bug.x;
    const by = bug.y;
    const wobble = Math.sin(frameCount * 0.3) * 2;

    // Body (green circle)
    ctx.fillStyle = '#44cc44';
    ctx.beginPath();
    ctx.arc(bx, by + wobble, BUG_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(bx - 4, by - 4 + wobble, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx + 4, by - 4 + wobble, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(bx - 4, by - 4 + wobble, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx + 4, by - 4 + wobble, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Antennae
    ctx.strokeStyle = '#44cc44';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx - 4, by - BUG_SIZE / 2 + wobble);
    ctx.lineTo(bx - 8, by - BUG_SIZE / 2 - 8 + wobble);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx + 4, by - BUG_SIZE / 2 + wobble);
    ctx.lineTo(bx + 8, by - BUG_SIZE / 2 - 8 + wobble);
    ctx.stroke();

    // Legs
    ctx.strokeStyle = '#338833';
    ctx.lineWidth = 1.5;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(bx - BUG_SIZE / 2, by + i * 5 + wobble);
      ctx.lineTo(bx - BUG_SIZE / 2 - 6, by + i * 5 + 4 + wobble);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bx + BUG_SIZE / 2, by + i * 5 + wobble);
      ctx.lineTo(bx + BUG_SIZE / 2 + 6, by + i * 5 + 4 + wobble);
      ctx.stroke();
    }
  } else if (phase === 'squash' || phase === 'celebrate') {
    // Splat mark where bug was
    ctx.fillStyle = '#226622';
    ctx.beginPath();
    ctx.arc(bug.x, bug.y, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Text overlay during celebrate
  if (phase === 'celebrate') {
    ctx.fillStyle = '#f5c518';
    ctx.font = '20px "Press Start 2P", cursive';
    ctx.textAlign = 'center';
    ctx.fillText('SQUASHED!', CANVAS_W / 2, 40);
  }
}

function loop() {
  tick();
  render();
  animFrameId = requestAnimationFrame(loop);
}

const BugSquashModule = { initAnim, startAnim, stopAnim, getAnimState, tick };
if (typeof module !== 'undefined' && module.exports) { module.exports = BugSquashModule; }
if (typeof window !== 'undefined') { window.BugSquashAnim = BugSquashModule; }
})();
