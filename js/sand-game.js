(function() {
// Falling-Sand Pixel Game Module ("Sandbox")

var CELL_SIZE = 12;
var CANVAS_WIDTH = 480;
var CANVAS_HEIGHT = 396;
var COLS = 40;
var ROWS = 33;
var TICK_RATE_MS = 33; // ~30fps

var ELEMENTS = {
  EMPTY: 0, SAND: 1, DIRT: 2, STONE: 3, WATER: 4,
  EXPLOSIVES: 5, LAVA: 6, PEOPLE: 7, GRAVEL: 8, FIRE: 9, WOOD: 10
};

var ELEMENT_COLORS = {};
ELEMENT_COLORS[ELEMENTS.EMPTY] = '#111';
ELEMENT_COLORS[ELEMENTS.SAND] = '#e3c768';
ELEMENT_COLORS[ELEMENTS.DIRT] = '#8a5a2b';
ELEMENT_COLORS[ELEMENTS.STONE] = '#888c94';
ELEMENT_COLORS[ELEMENTS.WATER] = '#3a7bd5';
ELEMENT_COLORS[ELEMENTS.EXPLOSIVES] = '#c0392b';
ELEMENT_COLORS[ELEMENTS.LAVA] = '#e8531f';
ELEMENT_COLORS[ELEMENTS.PEOPLE] = '#f2d3b3';
ELEMENT_COLORS[ELEMENTS.GRAVEL] = '#6f6b63';
ELEMENT_COLORS[ELEMENTS.FIRE] = '#ff8c1a';
ELEMENT_COLORS[ELEMENTS.WOOD] = '#5c3b1e';

var ELEMENT_VALUES = [
  ELEMENTS.EMPTY, ELEMENTS.SAND, ELEMENTS.DIRT, ELEMENTS.STONE, ELEMENTS.WATER,
  ELEMENTS.EXPLOSIVES, ELEMENTS.LAVA, ELEMENTS.PEOPLE, ELEMENTS.GRAVEL,
  ELEMENTS.FIRE, ELEMENTS.WOOD
];

var canvas = null;
var ctx = null;
var animFrameId = null;

// Per-tick marker so each particle moves at most once per tick. A particle that
// moves into a destination cell marks that index processed; the scan skips any
// cell already marked so it is not visited (and moved) again the same tick.
var processed = null;

function allocProcessed() {
  if (typeof Uint8Array !== 'undefined') {
    processed = new Uint8Array(COLS * ROWS);
  } else {
    processed = [];
    for (var i = 0; i < COLS * ROWS; i++) processed[i] = 0;
  }
}

function clearProcessed() {
  if (!processed) { allocProcessed(); return; }
  for (var i = 0; i < COLS * ROWS; i++) processed[i] = 0;
}

function markProcessed(col, row) {
  if (!inBounds(col, row)) return;
  processed[row * COLS + col] = 1;
}

function isProcessed(col, row) {
  if (!inBounds(col, row)) return false;
  return processed[row * COLS + col] === 1;
}

var state = {
  grid: null,
  currentElement: ELEMENTS.SAND,
  frameCount: 0,
  running: false
};

function inBounds(col, row) {
  return col >= 0 && col < COLS && row >= 0 && row < ROWS;
}

function getCell(col, row) {
  if (!inBounds(col, row)) return ELEMENTS.EMPTY;
  return state.grid[row * COLS + col];
}

function setCell(col, row, val) {
  if (!inBounds(col, row)) return;
  state.grid[row * COLS + col] = val;
}

function allocGrid() {
  if (typeof Int8Array !== 'undefined') {
    state.grid = new Int8Array(COLS * ROWS);
  } else {
    state.grid = [];
    for (var i = 0; i < COLS * ROWS; i++) state.grid[i] = ELEMENTS.EMPTY;
  }
}

function initSand(canvasEl) {
  canvas = canvasEl;
  ctx = null;
  if (canvas && typeof canvas.getContext === 'function') {
    ctx = canvas.getContext('2d');
  }
  allocGrid();
  state.frameCount = 0;
  state.running = false;
  state.currentElement = ELEMENTS.SAND;
  return getSandState();
}

function setElement(type) {
  // Input sanitation: only accept known element values.
  if (ELEMENT_VALUES.indexOf(type) === -1) return;
  state.currentElement = type;
}

function paintCell(col, row) {
  // Input sanitation: ignore out-of-bounds clicks.
  if (!inBounds(col, row)) return;
  // 2-cell brush (the cell plus its 4-neighbours), each bounds-checked.
  setCell(col, row, state.currentElement);
  setCell(col - 1, row, state.currentElement);
  setCell(col + 1, row, state.currentElement);
  setCell(col, row - 1, state.currentElement);
  setCell(col, row + 1, state.currentElement);
}

function clearGrid() {
  if (!state.grid) allocGrid();
  for (var i = 0; i < COLS * ROWS; i++) state.grid[i] = ELEMENTS.EMPTY;
  state.frameCount = 0;
}

function trySwapDown(col, row, swapWithWater) {
  // Returns true if the particle moved.
  if (row + 1 >= ROWS) return false;
  var val = getCell(col, row);
  var below = getCell(col, row + 1);
  if (below === ELEMENTS.EMPTY) {
    setCell(col, row, ELEMENTS.EMPTY);
    setCell(col, row + 1, val);
    markProcessed(col, row + 1);
    return true;
  }
  // Sink straight down through water: swap the particle with the water above it.
  if (swapWithWater && below === ELEMENTS.WATER) {
    setCell(col, row, ELEMENTS.WATER);
    setCell(col, row + 1, val);
    markProcessed(col, row + 1);
    return true;
  }
  // diagonal fall, randomized order
  var first = Math.random() < 0.5 ? -1 : 1;
  var dirs = [first, -first];
  for (var i = 0; i < dirs.length; i++) {
    var dc = dirs[i];
    if (!inBounds(col + dc, row + 1)) continue;
    var diag = getCell(col + dc, row + 1);
    if (diag === ELEMENTS.EMPTY) {
      setCell(col, row, ELEMENTS.EMPTY);
      setCell(col + dc, row + 1, val);
      markProcessed(col + dc, row + 1);
      return true;
    }
    if (swapWithWater && diag === ELEMENTS.WATER) {
      setCell(col, row, ELEMENTS.WATER);
      setCell(col + dc, row + 1, val);
      markProcessed(col + dc, row + 1);
      return true;
    }
  }
  return false;
}

function tickWater(col, row) {
  // Solidify into stone when adjacent to lava (both convert).
  if (hasNeighbor(col, row, ELEMENTS.LAVA)) {
    setCell(col, row, ELEMENTS.STONE);
    markProcessed(col, row);
    return true;
  }
  if (getCell(col, row + 1) === ELEMENTS.EMPTY) {
    setCell(col, row, ELEMENTS.EMPTY);
    setCell(col, row + 1, ELEMENTS.WATER);
    markProcessed(col, row + 1);
    return true;
  }
  // can't fall straight: try diagonal down
  if (trySwapDown(col, row)) return true;
  // spread sideways into empty gaps to fill them
  var first = Math.random() < 0.5 ? -1 : 1;
  var dirs = [first, -first];
  for (var i = 0; i < dirs.length; i++) {
    var dc = dirs[i];
    if (inBounds(col + dc, row) && getCell(col + dc, row) === ELEMENTS.EMPTY) {
      setCell(col, row, ELEMENTS.EMPTY);
      setCell(col + dc, row, ELEMENTS.WATER);
      markProcessed(col + dc, row);
      return true;
    }
  }
  return false;
}

// True if any of the 4 orthogonal neighbours holds the given element.
function hasNeighbor(col, row, element) {
  return getCell(col - 1, row) === element ||
    getCell(col + 1, row) === element ||
    getCell(col, row - 1) === element ||
    getCell(col, row + 1) === element;
}

function tickLava(col, row) {
  // Lava solidifies to stone when it touches water; the touching water
  // solidifies too so both convert regardless of scan order.
  if (hasNeighbor(col, row, ELEMENTS.WATER)) {
    setCell(col, row, ELEMENTS.STONE);
    markProcessed(col, row);
    var nb = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (var n = 0; n < nb.length; n++) {
      var nc = col + nb[n][0];
      var nr = row + nb[n][1];
      if (getCell(nc, nr) === ELEMENTS.WATER) {
        setCell(nc, nr, ELEMENTS.STONE);
        markProcessed(nc, nr);
      }
    }
    return true;
  }
  // Gravity acts every tick so lava flows straight down like a liquid.
  if (getCell(col, row + 1) === ELEMENTS.EMPTY) {
    setCell(col, row, ELEMENTS.EMPTY);
    setCell(col, row + 1, ELEMENTS.LAVA);
    markProcessed(col, row + 1);
    return true;
  }
  if (trySwapDown(col, row)) return true;
  // Viscous sideways spread only every 2nd frame so flows stay slow.
  if (state.frameCount % 2 !== 0) return false;
  var first = Math.random() < 0.5 ? -1 : 1;
  var dirs = [first, -first];
  for (var i = 0; i < dirs.length; i++) {
    var dc = dirs[i];
    if (inBounds(col + dc, row) && getCell(col + dc, row) === ELEMENTS.EMPTY) {
      setCell(col, row, ELEMENTS.EMPTY);
      setCell(col + dc, row, ELEMENTS.LAVA);
      markProcessed(col + dc, row);
      return true;
    }
  }
  return false;
}

function explode(col, row) {
  if (getCell(col, row) !== ELEMENTS.EXPLOSIVES) return;
  var radius = 3;
  // Consume this explosive first to terminate the chain-reaction recursion.
  setCell(col, row, ELEMENTS.EMPTY);
  var chain = [];
  for (var dr = -radius; dr <= radius; dr++) {
    for (var dc = -radius; dc <= radius; dc++) {
      var c = col + dc;
      var r = row + dr;
      if (!inBounds(c, r)) continue;
      if (dc * dc + dr * dr > radius * radius) continue;
      if (getCell(c, r) === ELEMENTS.EXPLOSIVES) {
        chain.push([c, r]);
        continue;
      }
      setCell(c, r, Math.random() < 0.6 ? ELEMENTS.FIRE : ELEMENTS.EMPTY);
      markProcessed(c, r);
    }
  }
  markProcessed(col, row);
  for (var i = 0; i < chain.length; i++) {
    explode(chain[i][0], chain[i][1]);
  }
}

function tickExplosives(col, row) {
  // Ignite on contact with fire or lava.
  if (hasNeighbor(col, row, ELEMENTS.FIRE) || hasNeighbor(col, row, ELEMENTS.LAVA)) {
    explode(col, row);
    return true;
  }
  // Otherwise fall like sand.
  return trySwapDown(col, row);
}

function tickPeople(col, row) {
  // Burn up when touching fire or lava.
  if (hasNeighbor(col, row, ELEMENTS.FIRE) || hasNeighbor(col, row, ELEMENTS.LAVA)) {
    setCell(col, row, ELEMENTS.FIRE);
    markProcessed(col, row);
    return true;
  }
  // Fall under gravity and sink/drown through water.
  if (getCell(col, row + 1) === ELEMENTS.EMPTY ||
      getCell(col, row + 1) === ELEMENTS.WATER) {
    if (trySwapDown(col, row, true)) return true;
  }
  // On solid ground: wander left/right every 4th frame.
  if (state.frameCount % 4 !== 0) return false;
  var dir = Math.random() < 0.5 ? -1 : 1;
  // Walk into an adjacent empty cell.
  if (inBounds(col + dir, row) && getCell(col + dir, row) === ELEMENTS.EMPTY) {
    setCell(col, row, ELEMENTS.EMPTY);
    setCell(col + dir, row, ELEMENTS.PEOPLE);
    markProcessed(col + dir, row);
    return true;
  }
  // Climb a 1-pixel step: blocked beside, empty above the step.
  if (inBounds(col + dir, row) && getCell(col + dir, row) !== ELEMENTS.EMPTY &&
      inBounds(col + dir, row - 1) && getCell(col + dir, row - 1) === ELEMENTS.EMPTY &&
      getCell(col, row - 1) === ELEMENTS.EMPTY) {
    setCell(col, row, ELEMENTS.EMPTY);
    setCell(col + dir, row - 1, ELEMENTS.PEOPLE);
    markProcessed(col + dir, row - 1);
    return true;
  }
  return false;
}

function tickFire(col, row) {
  // Burn out with a 20% chance per tick.
  if (Math.random() < 0.2) {
    setCell(col, row, ELEMENTS.EMPTY);
    markProcessed(col, row);
    return true;
  }
  // Rise upward, or diagonally upward.
  if (getCell(col, row - 1) === ELEMENTS.EMPTY) {
    setCell(col, row, ELEMENTS.EMPTY);
    setCell(col, row - 1, ELEMENTS.FIRE);
    markProcessed(col, row - 1);
    return true;
  }
  var first = Math.random() < 0.5 ? -1 : 1;
  var dirs = [first, -first];
  for (var i = 0; i < dirs.length; i++) {
    var dc = dirs[i];
    if (inBounds(col + dc, row - 1) && getCell(col + dc, row - 1) === ELEMENTS.EMPTY) {
      setCell(col, row, ELEMENTS.EMPTY);
      setCell(col + dc, row - 1, ELEMENTS.FIRE);
      markProcessed(col + dc, row - 1);
      return true;
    }
  }
  return false;
}

function tickWood(col, row) {
  // Flammable: catch fire when touching fire or lava (20% chance per tick).
  if (hasNeighbor(col, row, ELEMENTS.FIRE) || hasNeighbor(col, row, ELEMENTS.LAVA)) {
    if (Math.random() < 0.2) {
      setCell(col, row, ELEMENTS.FIRE);
      markProcessed(col, row);
      return true;
    }
  }
  return false;
}

function tick() {
  state.frameCount++;
  if (!state.grid) return getSandState();
  clearProcessed();
  // Process bottom-up so particles fall at most one row per tick. Start at the
  // bottom-most row so floor-level elements (lava, fire, people) still act.
  for (var row = ROWS - 1; row >= 0; row--) {
    for (var col = 0; col < COLS; col++) {
      // Skip cells already filled by a particle that moved this tick so each
      // particle is visited (and moves) at most once per tick.
      if (isProcessed(col, row)) continue;
      var val = getCell(col, row);
      if (val === ELEMENTS.EMPTY || val === ELEMENTS.STONE) continue;
      if (val === ELEMENTS.SAND) {
        trySwapDown(col, row, true);
      } else if (val === ELEMENTS.DIRT) {
        // Slow fall: only move every 3rd frame.
        if (state.frameCount % 3 === 0) trySwapDown(col, row, true);
      } else if (val === ELEMENTS.GRAVEL) {
        trySwapDown(col, row, true);
      } else if (val === ELEMENTS.WATER) {
        tickWater(col, row);
      } else if (val === ELEMENTS.LAVA) {
        tickLava(col, row);
      } else if (val === ELEMENTS.EXPLOSIVES) {
        tickExplosives(col, row);
      } else if (val === ELEMENTS.PEOPLE) {
        tickPeople(col, row);
      } else if (val === ELEMENTS.FIRE) {
        tickFire(col, row);
      } else if (val === ELEMENTS.WOOD) {
        tickWood(col, row);
      }
    }
  }
  return getSandState();
}

function render() {
  if (!ctx) return;
  ctx.fillStyle = ELEMENT_COLORS[ELEMENTS.EMPTY];
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  if (!state.grid) return;
  for (var row = 0; row < ROWS; row++) {
    for (var col = 0; col < COLS; col++) {
      var val = state.grid[row * COLS + col];
      if (val === ELEMENTS.EMPTY) continue;
      ctx.fillStyle = ELEMENT_COLORS[val] || '#fff';
      ctx.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
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

function startSand() {
  // Idempotent: cancel any existing loop first.
  if (animFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  if (!state.grid) allocGrid();
  state.running = true;
  loop();
}

function stopSand() {
  state.running = false;
  if (animFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
    cancelAnimationFrame(animFrameId);
  }
  animFrameId = null;
}

function cellAt(col, row) {
  return getCell(col, row);
}

function getSandState() {
  return {
    running: state.running,
    currentElement: state.currentElement,
    frameCount: state.frameCount,
    cols: COLS,
    rows: ROWS,
    grid: state.grid,
    cellAt: cellAt
  };
}

var SandGameModule = {
  initSand: initSand,
  startSand: startSand,
  stopSand: stopSand,
  getSandState: getSandState,
  tick: tick,
  setElement: setElement,
  paintCell: paintCell,
  clearGrid: clearGrid,
  getCell: getCell,
  ELEMENTS: ELEMENTS,
  COLS: COLS,
  ROWS: ROWS,
  CELL_SIZE: CELL_SIZE
};

if (typeof module !== 'undefined' && module.exports) { module.exports = SandGameModule; }
if (typeof window !== 'undefined') { window.ForemanSandGame = SandGameModule; }
})();
