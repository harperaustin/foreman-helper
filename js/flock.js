(function() {
// Flocking-Boids Simulation Module ("Flock")
// Classic Reynolds boids: separation, alignment, cohesion, plus a mouse
// "predator" the boids flee from. Mirrors the lifecycle/export conventions
// of js/sand-game.js so the same jest+jsdom harness can drive it.

var CANVAS_WIDTH = 480;
var CANVAS_HEIGHT = 400;

var DEFAULT_COUNT = 50;
var MIN_COUNT = 10;
var MAX_COUNT = 80;

var DEFAULT_SPEED = 2.5; // max velocity magnitude (px/frame)
var MIN_SPEED = 0.5;
var MAX_SPEED = 6;
var MIN_SPEED_FRACTION = 0.5; // boids keep at least this fraction of max speed

// Perception radii (px)
var SEPARATION_RADIUS = 24;
var ALIGN_RADIUS = 50;
var COHESION_RADIUS = 50;
var PREDATOR_RADIUS = 90;

// Steering weights
var SEP_WEIGHT = 1.6;
var ALIGN_WEIGHT = 1.0;
var COHESION_WEIGHT = 0.9;
var PREDATOR_WEIGHT = 3.0;

var BOID_SIZE = 6;
var BOID_COLOR = '#48cae4';
var BG_COLOR = '#0d1b2a';

var MIN_DISTANCE = 14;          // minimum centre-to-centre spacing (px); ~2x BOID_SIZE
var SPAWN_MAX_ATTEMPTS = 30;    // rejection-sampling tries before fallback
var COLLISION_PASSES = 3;       // positional resolution iterations per tick
var DEFAULT_ADD = 5;            // boids added per "Add Boids" click

var canvas = null;
var ctx = null;
var animFrameId = null;

var state = {
  running: false,
  count: DEFAULT_COUNT,
  speed: DEFAULT_SPEED,
  boids: [],
  predator: null,
  frameCount: 0
};

function isFiniteNumber(n) {
  return typeof n === 'number' && isFinite(n);
}

function clampCount(n) {
  var v = Math.round(Number(n));
  if (!isFiniteNumber(v)) v = DEFAULT_COUNT;
  return Math.max(MIN_COUNT, Math.min(MAX_COUNT, v));
}

function clampSpeed(s) {
  var v = Number(s);
  if (!isFiniteNumber(v)) v = DEFAULT_SPEED;
  return Math.max(MIN_SPEED, Math.min(MAX_SPEED, v));
}

function makeBoid() {
  var angle = Math.random() * Math.PI * 2;
  var mag = state.speed * (0.5 + Math.random() * 0.5);
  return {
    x: Math.random() * CANVAS_WIDTH,
    y: Math.random() * CANVAS_HEIGHT,
    vx: Math.cos(angle) * mag,
    vy: Math.sin(angle) * mag
  };
}

// True if (x, y) is at least minDist away from every boid in the array.
function isFarEnough(x, y, boids, minDist) {
  for (var i = 0; i < boids.length; i++) {
    var dx = x - boids[i].x;
    var dy = y - boids[i].y;
    if (dx * dx + dy * dy < minDist * minDist) return false;
  }
  return true;
}

// Make a boid whose position does not overlap any in `existing`. Rejection-samples
// up to SPAWN_MAX_ATTEMPTS times; falls back to the last candidate so it never hangs
// even on a densely packed canvas. Velocity comes straight from makeBoid().
function makeNonOverlappingBoid(existing) {
  var boid = makeBoid();
  for (var attempt = 0; attempt < SPAWN_MAX_ATTEMPTS; attempt++) {
    if (isFarEnough(boid.x, boid.y, existing, MIN_DISTANCE)) break;
    boid.x = Math.random() * CANVAS_WIDTH;
    boid.y = Math.random() * CANVAS_HEIGHT;
  }
  return boid;
}

function spawnBoids(n) {
  var count = clampCount(n);
  state.boids = [];
  for (var i = 0; i < count; i++) {
    state.boids.push(makeNonOverlappingBoid(state.boids));
  }
}

function initFlock(canvasEl) {
  canvas = canvasEl || null;
  ctx = null;
  if (canvas && typeof canvas.getContext === 'function') {
    ctx = canvas.getContext('2d');
  }
  state.count = DEFAULT_COUNT;
  state.speed = DEFAULT_SPEED;
  state.predator = null;
  state.running = false;
  state.frameCount = 0;
  spawnBoids(state.count);
  return getFlockState();
}

// --- Pure steering helpers (exported, testable) ---

// Steer away from crowding neighbours; closer neighbours pushed against harder.
function computeSeparation(boid, boids, radius) {
  var r = radius || SEPARATION_RADIUS;
  var sx = 0, sy = 0, count = 0;
  for (var i = 0; i < boids.length; i++) {
    var other = boids[i];
    if (other === boid) continue;
    var dx = boid.x - other.x;
    var dy = boid.y - other.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d > 0 && d < r) {
      sx += dx / d / d;
      sy += dy / d / d;
      count++;
    }
  }
  if (count === 0) return { x: 0, y: 0 };
  return { x: sx / count, y: sy / count };
}

// Steer toward the average heading of nearby neighbours.
function computeAlignment(boid, boids, radius) {
  var r = radius || ALIGN_RADIUS;
  var vx = 0, vy = 0, count = 0;
  for (var i = 0; i < boids.length; i++) {
    var other = boids[i];
    if (other === boid) continue;
    var dx = other.x - boid.x;
    var dy = other.y - boid.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d < r) {
      vx += other.vx;
      vy += other.vy;
      count++;
    }
  }
  if (count === 0) return { x: 0, y: 0 };
  return { x: vx / count - boid.vx, y: vy / count - boid.vy };
}

// Steer toward the local centre of mass of nearby neighbours.
function computeCohesion(boid, boids, radius) {
  var r = radius || COHESION_RADIUS;
  var cx = 0, cy = 0, count = 0;
  for (var i = 0; i < boids.length; i++) {
    var other = boids[i];
    if (other === boid) continue;
    var dx = other.x - boid.x;
    var dy = other.y - boid.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d < r) {
      cx += other.x;
      cy += other.y;
      count++;
    }
  }
  if (count === 0) return { x: 0, y: 0 };
  return { x: cx / count - boid.x, y: cy / count - boid.y };
}

// Flee a nearby predator; force grows as the cursor gets closer.
function computePredatorAvoid(boid, predator, radius) {
  if (!predator || !isFiniteNumber(predator.x) || !isFiniteNumber(predator.y)) {
    return { x: 0, y: 0 };
  }
  var r = radius || PREDATOR_RADIUS;
  var dx = boid.x - predator.x;
  var dy = boid.y - predator.y;
  var d = Math.sqrt(dx * dx + dy * dy);
  if (d >= r || d === 0) return { x: 0, y: 0 };
  // Stronger when closer: scale by remaining fraction of the radius.
  var strength = (r - d) / r;
  return { x: (dx / d) * strength * r, y: (dy / d) * strength * r };
}

function clampVelocity(boid) {
  var mag = Math.sqrt(boid.vx * boid.vx + boid.vy * boid.vy);
  var max = state.speed;
  var min = state.speed * MIN_SPEED_FRACTION;
  if (mag === 0) {
    var angle = Math.random() * Math.PI * 2;
    boid.vx = Math.cos(angle) * min;
    boid.vy = Math.sin(angle) * min;
    return;
  }
  if (mag > max) {
    boid.vx = (boid.vx / mag) * max;
    boid.vy = (boid.vy / mag) * max;
  } else if (mag < min) {
    boid.vx = (boid.vx / mag) * min;
    boid.vy = (boid.vy / mag) * min;
  }
}

function tick() {
  state.frameCount++;
  // Snapshot so every boid steers off the same frame's positions/velocities.
  var snapshot = [];
  for (var i = 0; i < state.boids.length; i++) {
    var b = state.boids[i];
    snapshot.push({ x: b.x, y: b.y, vx: b.vx, vy: b.vy });
  }
  for (var j = 0; j < state.boids.length; j++) {
    var boid = state.boids[j];
    var snapBoid = snapshot[j];
    var sep = computeSeparation(snapBoid, snapshot, SEPARATION_RADIUS);
    var ali = computeAlignment(snapBoid, snapshot, ALIGN_RADIUS);
    var coh = computeCohesion(snapBoid, snapshot, COHESION_RADIUS);
    var pred = computePredatorAvoid(snapBoid, state.predator, PREDATOR_RADIUS);

    boid.vx += sep.x * SEP_WEIGHT + ali.x * ALIGN_WEIGHT + coh.x * COHESION_WEIGHT + pred.x * PREDATOR_WEIGHT;
    boid.vy += sep.y * SEP_WEIGHT + ali.y * ALIGN_WEIGHT + coh.y * COHESION_WEIGHT + pred.y * PREDATOR_WEIGHT;

    clampVelocity(boid);

    boid.x += boid.vx;
    boid.y += boid.vy;

    // Wrap around edges so the flock never leaves the canvas.
    boid.x = ((boid.x % CANVAS_WIDTH) + CANVAS_WIDTH) % CANVAS_WIDTH;
    boid.y = ((boid.y % CANVAS_HEIGHT) + CANVAS_HEIGHT) % CANVAS_HEIGHT;
  }
  // Hard no-overlap guarantee: push apart any boids closer than MIN_DISTANCE.
  resolveCollisions(COLLISION_PASSES);
  return getFlockState();
}

// Positional collision resolution: iteratively push apart any pair of boids that
// are closer than MIN_DISTANCE, then re-wrap everyone inside the canvas.
function resolveCollisions(passes) {
  var iters = (typeof passes === 'number' && passes > 0) ? passes : COLLISION_PASSES;
  for (var p = 0; p < iters; p++) {
    for (var i = 0; i < state.boids.length; i++) {
      for (var k = i + 1; k < state.boids.length; k++) {
        var a = state.boids[i], b = state.boids[k];
        var dx = b.x - a.x, dy = b.y - a.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d >= MIN_DISTANCE) continue;
        var nx, ny;
        if (d === 0) {                 // exact overlap: pick a random axis
          var ang = Math.random() * Math.PI * 2;
          nx = Math.cos(ang); ny = Math.sin(ang); d = 0.0001;
        } else { nx = dx / d; ny = dy / d; }
        var push = (MIN_DISTANCE - d) / 2;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
      }
    }
  }
  // Keep everyone inside the canvas after pushing.
  for (var j = 0; j < state.boids.length; j++) {
    var bj = state.boids[j];
    bj.x = ((bj.x % CANVAS_WIDTH) + CANVAS_WIDTH) % CANVAS_WIDTH;
    bj.y = ((bj.y % CANVAS_HEIGHT) + CANVAS_HEIGHT) % CANVAS_HEIGHT;
  }
}

// Append `n` non-overlapping boids to the existing flock, clamped to MAX_COUNT.
// Does not replace existing boids.
function addBoids(n) {
  var add = Math.round(Number(n));
  if (!isFiniteNumber(add) || add <= 0) add = DEFAULT_ADD;
  var target = clampCount(state.boids.length + add);
  while (state.boids.length < target) {
    state.boids.push(makeNonOverlappingBoid(state.boids));
  }
  state.count = state.boids.length;
  return getFlockState();
}

function render() {
  if (!ctx) return;
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.fillStyle = BOID_COLOR;
  for (var i = 0; i < state.boids.length; i++) {
    var boid = state.boids[i];
    var angle = Math.atan2(boid.vy, boid.vx);
    ctx.save();
    ctx.translate(boid.x, boid.y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(BOID_SIZE, 0);
    ctx.lineTo(-BOID_SIZE * 0.6, BOID_SIZE * 0.5);
    ctx.lineTo(-BOID_SIZE * 0.6, -BOID_SIZE * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  if (state.predator) {
    ctx.fillStyle = '#ff5d5d';
    ctx.beginPath();
    ctx.arc(state.predator.x, state.predator.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function loop() {
  if (!state.running) return;
  tick();
  render();
  if (typeof requestAnimationFrame !== 'undefined') {
    animFrameId = requestAnimationFrame(loop);
  }
}

function startFlock() {
  if (animFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  if (state.boids.length === 0) spawnBoids(state.count);
  state.running = true;
  loop();
}

function stopFlock() {
  state.running = false;
  if (animFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
    cancelAnimationFrame(animFrameId);
  }
  animFrameId = null;
}

function resetFlock() {
  spawnBoids(state.count);
  state.frameCount = 0;
  return getFlockState();
}

function setBoidCount(n) {
  state.count = clampCount(n);
  spawnBoids(state.count);
}

function setSpeed(s) {
  state.speed = clampSpeed(s);
}

function setPredator(x, y) {
  if (isFiniteNumber(x) && isFiniteNumber(y)) {
    state.predator = { x: x, y: y };
  }
}

function clearPredator() {
  state.predator = null;
}

function getFlockState() {
  return {
    running: state.running,
    count: state.count,
    speed: state.speed,
    frameCount: state.frameCount,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    predator: state.predator,
    boids: state.boids
  };
}

var FlockModule = {
  initFlock: initFlock,
  startFlock: startFlock,
  stopFlock: stopFlock,
  resetFlock: resetFlock,
  // Public API aliases matching the conventional verb names. `reset` re-seeds
  // the flock to a fresh randomized state, respecting the current boid count
  // and speed setting (makeBoid/spawnBoids read state.speed), so a speed
  // change applied before or after reset is reflected in per-tick movement.
  init: initFlock,
  start: startFlock,
  stop: stopFlock,
  reset: resetFlock,
  tick: tick,
  getFlockState: getFlockState,
  setBoidCount: setBoidCount,
  addBoids: addBoids,
  resolveCollisions: resolveCollisions,
  setSpeed: setSpeed,
  setPredator: setPredator,
  clearPredator: clearPredator,
  computeSeparation: computeSeparation,
  computeAlignment: computeAlignment,
  computeCohesion: computeCohesion,
  computePredatorAvoid: computePredatorAvoid,
  MIN_COUNT: MIN_COUNT,
  MAX_COUNT: MAX_COUNT,
  DEFAULT_COUNT: DEFAULT_COUNT,
  MIN_SPEED: MIN_SPEED,
  MAX_SPEED: MAX_SPEED,
  DEFAULT_SPEED: DEFAULT_SPEED,
  SEPARATION_RADIUS: SEPARATION_RADIUS,
  ALIGN_RADIUS: ALIGN_RADIUS,
  COHESION_RADIUS: COHESION_RADIUS,
  PREDATOR_RADIUS: PREDATOR_RADIUS,
  MIN_DISTANCE: MIN_DISTANCE,
  CANVAS_WIDTH: CANVAS_WIDTH,
  CANVAS_HEIGHT: CANVAS_HEIGHT
};

if (typeof module !== 'undefined' && module.exports) { module.exports = FlockModule; }
if (typeof window !== 'undefined') { window.ForemanFlock = FlockModule; }
})();
