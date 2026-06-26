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
  GRAVEL: 5, EXPLOSIVE: 6, LAVA: 7, FIRE: 8, WOOD: 9, PERSON: 10
};

var ELEMENT_COLORS = {};
ELEMENT_COLORS[ELEMENTS.EMPTY] = '#111';
ELEMENT_COLORS[ELEMENTS.SAND] = '#e3c768';
ELEMENT_COLORS[ELEMENTS.DIRT] = '#8a5a2b';
ELEMENT_COLORS[ELEMENTS.STONE] = '#888c94';
ELEMENT_COLORS[ELEMENTS.WATER] = '#3a7bd5';
ELEMENT_COLORS[ELEMENTS.GRAVEL] = '#6f7479';
ELEMENT_COLORS[ELEMENTS.EXPLOSIVE] = '#c0392b';
ELEMENT_COLORS[ELEMENTS.LAVA] = '#ff5722';
ELEMENT_COLORS[ELEMENTS.FIRE] = '#ff9b21';
ELEMENT_COLORS[ELEMENTS.WOOD] = '#7a4a1e';
ELEMENT_COLORS[ELEMENTS.PERSON] = '#f2d6b3';

var ELEMENT_VALUES = [
  ELEMENTS.EMPTY, ELEMENTS.SAND, ELEMENTS.DIRT, ELEMENTS.STONE, ELEMENTS.WATER,
  ELEMENTS.GRAVEL, ELEMENTS.EXPLOSIVE, ELEMENTS.LAVA, ELEMENTS.FIRE,
  ELEMENTS.WOOD, ELEMENTS.PERSON
];

// Density drives sinking: a heavier solid swaps places with a lighter liquid
// below it (so sand/dirt/gravel sink through water and water rises, conserved).
var ELEMENT_DENSITY = {};
ELEMENT_DENSITY[ELEMENTS.EMPTY] = 0;
ELEMENT_DENSITY[ELEMENTS.FIRE] = 0;
ELEMENT_DENSITY[ELEMENTS.WATER] = 2;
ELEMENT_DENSITY[ELEMENTS.LAVA] = 3;
ELEMENT_DENSITY[ELEMENTS.PERSON] = 4;
ELEMENT_DENSITY[ELEMENTS.DIRT] = 6;
ELEMENT_DENSITY[ELEMENTS.SAND] = 6;
ELEMENT_DENSITY[ELEMENTS.EXPLOSIVE] = 6;
ELEMENT_DENSITY[ELEMENTS.GRAVEL] = 7;
ELEMENT_DENSITY[ELEMENTS.WOOD] = 99;
ELEMENT_DENSITY[ELEMENTS.STONE] = 99;

function isLiquid(v) {
  return v === ELEMENTS.WATER || v === ELEMENTS.LAVA;
}

function density(v) {
  return ELEMENT_DENSITY[v] || 0;
}

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

function trySwapDown(col, row) {
  // Returns true if the particle moved.
  var val = getCell(col, row);
  var below = getCell(col, row + 1);
  if (below === ELEMENTS.EMPTY) {
    setCell(col, row, ELEMENTS.EMPTY);
    setCell(col, row + 1, val);
    markProcessed(col, row + 1);
    return true;
  }
  // Sink through a lighter liquid: swap so the liquid rises (conserved).
  if (isLiquid(below) && density(val) > density(below)) {
    setCell(col, row + 1, val);
    setCell(col, row, below);
    markProcessed(col, row + 1);
    markProcessed(col, row);
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
    if (isLiquid(diag) && density(val) > density(diag)) {
      setCell(col + dc, row + 1, val);
      setCell(col, row, diag);
      markProcessed(col + dc, row + 1);
      markProcessed(col, row);
      return true;
    }
  }
  return false;
}

function tickLiquid(col, row, type) {
  if (getCell(col, row + 1) === ELEMENTS.EMPTY) {
    setCell(col, row, ELEMENTS.EMPTY);
    setCell(col, row + 1, type);
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
      setCell(col + dc, row, type);
      markProcessed(col + dc, row);
      return true;
    }
  }
  return false;
}

function tickWater(col, row) {
  return tickLiquid(col, row, ELEMENTS.WATER);
}

var NEIGHBORS_4 = [[0, -1], [0, 1], [-1, 0], [1, 0]];

function tickLava(col, row) {
  // Reaction first: contact with water solidifies lava into stone (obsidian);
  // contact with flammable cells ignites them.
  for (var i = 0; i < NEIGHBORS_4.length; i++) {
    var nc = col + NEIGHBORS_4[i][0];
    var nr = row + NEIGHBORS_4[i][1];
    if (!inBounds(nc, nr)) continue;
    var n = getCell(nc, nr);
    if (n === ELEMENTS.WATER) {
      setCell(col, row, ELEMENTS.STONE);
      setCell(nc, nr, ELEMENTS.STONE);
      markProcessed(col, row);
      markProcessed(nc, nr);
      return true;
    }
    if (n === ELEMENTS.WOOD || n === ELEMENTS.EXPLOSIVE) {
      setCell(nc, nr, ELEMENTS.FIRE);
      markProcessed(nc, nr);
    }
  }
  // Lava flows like a slow liquid (every 2nd frame).
  if (state.frameCount % 2 === 0) {
    return tickLiquid(col, row, ELEMENTS.LAVA);
  }
  return false;
}

function detonate(col, row) {
  // Clear a 5x5 (Chebyshev radius 2) region, leaving fire at the core to drive
  // chain reactions.
  for (var dr = -2; dr <= 2; dr++) {
    for (var dc = -2; dc <= 2; dc++) {
      var nc = col + dc;
      var nr = row + dr;
      if (!inBounds(nc, nr)) continue;
      setCell(nc, nr, ELEMENTS.EMPTY);
      markProcessed(nc, nr);
    }
  }
  setCell(col, row, ELEMENTS.FIRE);
  markProcessed(col, row);
  for (var i = 0; i < NEIGHBORS_4.length; i++) {
    var fc = col + NEIGHBORS_4[i][0];
    var fr = row + NEIGHBORS_4[i][1];
    if (!inBounds(fc, fr)) continue;
    setCell(fc, fr, ELEMENTS.FIRE);
    markProcessed(fc, fr);
  }
}

function tickExplosive(col, row) {
  for (var i = 0; i < NEIGHBORS_4.length; i++) {
    var nc = col + NEIGHBORS_4[i][0];
    var nr = row + NEIGHBORS_4[i][1];
    if (!inBounds(nc, nr)) continue;
    var n = getCell(nc, nr);
    if (n === ELEMENTS.FIRE || n === ELEMENTS.LAVA) {
      detonate(col, row);
      return true;
    }
  }
  // Otherwise fall like a heavy powder.
  return trySwapDown(col, row);
}

function tickFire(col, row) {
  // Spread to flammable wood neighbours.
  for (var i = 0; i < NEIGHBORS_4.length; i++) {
    var nc = col + NEIGHBORS_4[i][0];
    var nr = row + NEIGHBORS_4[i][1];
    if (!inBounds(nc, nr)) continue;
    if (getCell(nc, nr) === ELEMENTS.WOOD) {
      setCell(nc, nr, ELEMENTS.FIRE);
      markProcessed(nc, nr);
    }
  }
  // Dissipate over time so fire is finite.
  if (Math.random() < 0.25) {
    setCell(col, row, ELEMENTS.EMPTY);
    markProcessed(col, row);
    return true;
  }
  // Rise: fire drifts upward into empty space.
  if (getCell(col, row - 1) === ELEMENTS.EMPTY) {
    setCell(col, row, ELEMENTS.EMPTY);
    setCell(col, row - 1, ELEMENTS.FIRE);
    markProcessed(col, row - 1);
    return true;
  }
  return false;
}

function tickWood(col, row) {
  // Static, but ignites on contact with fire or lava.
  for (var i = 0; i < NEIGHBORS_4.length; i++) {
    var nc = col + NEIGHBORS_4[i][0];
    var nr = row + NEIGHBORS_4[i][1];
    if (!inBounds(nc, nr)) continue;
    var n = getCell(nc, nr);
    if (n === ELEMENTS.FIRE || n === ELEMENTS.LAVA) {
      setCell(col, row, ELEMENTS.FIRE);
      markProcessed(col, row);
      return true;
    }
  }
  return false;
}

function tickPerson(col, row) {
  // Death: hazards destroy people on contact.
  for (var i = 0; i < NEIGHBORS_4.length; i++) {
    var nc = col + NEIGHBORS_4[i][0];
    var nr = row + NEIGHBORS_4[i][1];
    if (!inBounds(nc, nr)) continue;
    var n = getCell(nc, nr);
    if (n === ELEMENTS.FIRE || n === ELEMENTS.LAVA) {
      setCell(col, row, ELEMENTS.EMPTY);
      markProcessed(col, row);
      return true;
    }
  }
  // Gravity: fall into empty space below.
  if (getCell(col, row + 1) === ELEMENTS.EMPTY) {
    setCell(col, row, ELEMENTS.EMPTY);
    setCell(col, row + 1, ELEMENTS.PERSON);
    markProcessed(col, row + 1);
    return true;
  }
  // Wander: step sideways onto supported ground.
  var first = Math.random() < 0.5 ? -1 : 1;
  var dirs = [first, -first];
  for (var j = 0; j < dirs.length; j++) {
    var dc = dirs[j];
    if (!inBounds(col + dc, row)) continue;
    if (getCell(col + dc, row) !== ELEMENTS.EMPTY) continue;
    // Only step where there is support (so people don't levitate off cliffs).
    if (getCell(col + dc, row + 1) !== ELEMENTS.EMPTY) {
      setCell(col, row, ELEMENTS.EMPTY);
      setCell(col + dc, row, ELEMENTS.PERSON);
      markProcessed(col + dc, row);
      return true;
    }
  }
  return false;
}

function tick() {
  state.frameCount++;
  if (!state.grid) return getSandState();
  clearProcessed();
  // Process bottom-up so particles fall at most one row per tick.
  for (var row = ROWS - 2; row >= 0; row--) {
    for (var col = 0; col < COLS; col++) {
      // Skip cells already filled by a particle that moved this tick so each
      // particle is visited (and moves) at most once per tick.
      if (isProcessed(col, row)) continue;
      var val = getCell(col, row);
      if (val === ELEMENTS.EMPTY || val === ELEMENTS.STONE) continue;
      if (val === ELEMENTS.SAND) {
        trySwapDown(col, row);
      } else if (val === ELEMENTS.DIRT) {
        // Slow fall: only move every 3rd frame.
        if (state.frameCount % 3 === 0) trySwapDown(col, row);
      } else if (val === ELEMENTS.WATER) {
        tickWater(col, row);
      } else if (val === ELEMENTS.GRAVEL) {
        trySwapDown(col, row);
      } else if (val === ELEMENTS.EXPLOSIVE) {
        tickExplosive(col, row);
      } else if (val === ELEMENTS.LAVA) {
        tickLava(col, row);
      } else if (val === ELEMENTS.FIRE) {
        tickFire(col, row);
      } else if (val === ELEMENTS.WOOD) {
        tickWood(col, row);
      } else if (val === ELEMENTS.PERSON) {
        tickPerson(col, row);
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
