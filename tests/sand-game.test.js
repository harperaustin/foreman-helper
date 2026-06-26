/**
 * @jest-environment jsdom
 */

let Sand;
let canvas;

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 396;
  canvas.getContext = () => ({
    clearRect: jest.fn(),
    fillRect: jest.fn(),
    beginPath: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(),
    fillText: jest.fn(),
    closePath: jest.fn(),
    set fillStyle(v) {},
    set strokeStyle(v) {},
    set lineWidth(v) {},
    set font(v) {},
    set textAlign(v) {},
  });
  Sand = require('../js/sand-game.js');
  Sand.initSand(canvas);
});

afterEach(() => {
  Sand.stopSand();
  jest.useRealTimers();
});

describe('sand-game initialization', () => {
  test('initSand returns initial state', () => {
    const state = Sand.getSandState();
    expect(state).toBeDefined();
    expect(state.running).toBe(false);
    expect(state.currentElement).toBe(Sand.ELEMENTS.SAND);
  });

  test('grid dimensions match constants', () => {
    const state = Sand.getSandState();
    expect(state.cols).toBe(Sand.COLS);
    expect(state.rows).toBe(Sand.ROWS);
  });

  test('grid starts entirely empty', () => {
    expect(Sand.getCell(0, 0)).toBe(Sand.ELEMENTS.EMPTY);
    expect(Sand.getCell(10, 10)).toBe(Sand.ELEMENTS.EMPTY);
    expect(Sand.getCell(Sand.COLS - 1, Sand.ROWS - 1)).toBe(Sand.ELEMENTS.EMPTY);
  });
});

describe('startSand / stopSand lifecycle', () => {
  test('startSand sets running true', () => {
    Sand.startSand();
    expect(Sand.getSandState().running).toBe(true);
  });

  test('startSand is idempotent — second call cancels previous frame', () => {
    const cancelSpy = jest.spyOn(global, 'cancelAnimationFrame');
    Sand.startSand();
    Sand.startSand();
    expect(cancelSpy).toHaveBeenCalled();
    cancelSpy.mockRestore();
  });

  test('stopSand sets running false', () => {
    Sand.startSand();
    Sand.stopSand();
    expect(Sand.getSandState().running).toBe(false);
  });

  test('stopSand is safe to call when not running', () => {
    expect(() => Sand.stopSand()).not.toThrow();
  });
});

describe('setElement input sanitation', () => {
  test('valid element changes currentElement', () => {
    Sand.setElement(Sand.ELEMENTS.WATER);
    expect(Sand.getSandState().currentElement).toBe(Sand.ELEMENTS.WATER);
  });

  test('unknown numeric value is a no-op', () => {
    Sand.setElement(Sand.ELEMENTS.STONE);
    Sand.setElement(999);
    expect(Sand.getSandState().currentElement).toBe(Sand.ELEMENTS.STONE);
  });

  test('undefined / null are no-ops', () => {
    Sand.setElement(Sand.ELEMENTS.DIRT);
    Sand.setElement(undefined);
    Sand.setElement(null);
    expect(Sand.getSandState().currentElement).toBe(Sand.ELEMENTS.DIRT);
  });
});

describe('paintCell boundary sanitation', () => {
  test('in-bounds paint sets the cell', () => {
    Sand.setElement(Sand.ELEMENTS.STONE);
    Sand.paintCell(5, 5);
    expect(Sand.getCell(5, 5)).toBe(Sand.ELEMENTS.STONE);
  });

  test('out-of-bounds paint does not throw and leaves grid unchanged', () => {
    expect(() => Sand.paintCell(-1, -1)).not.toThrow();
    expect(() => Sand.paintCell(Sand.COLS + 5, Sand.ROWS + 5)).not.toThrow();
    expect(Sand.getCell(0, 0)).toBe(Sand.ELEMENTS.EMPTY);
  });
});

describe('physics', () => {
  test('SAND falls one row per tick', () => {
    Sand.clearGrid();
    // Paint a single sand cell well away from edges (avoid brush neighbours hitting edges).
    Sand.setElement(Sand.ELEMENTS.SAND);
    const col = 20;
    // Clear neighbours that the brush set, leave just one cell to track cleanly.
    Sand.paintCell(col, 0);
    // Wipe everything then set exactly one cell via internal grid for determinism.
    Sand.clearGrid();
    Sand.getSandState().grid[0 * Sand.COLS + col] = Sand.ELEMENTS.SAND;
    Sand.tick();
    expect(Sand.getCell(col, 0)).toBe(Sand.ELEMENTS.EMPTY);
    expect(Sand.getCell(col, 1)).toBe(Sand.ELEMENTS.SAND);
  });

  test('DIRT falls slower than SAND', () => {
    Sand.clearGrid();
    const grid = Sand.getSandState().grid;
    const sandCol = 10;
    const dirtCol = 30;
    grid[0 * Sand.COLS + sandCol] = Sand.ELEMENTS.SAND;
    grid[0 * Sand.COLS + dirtCol] = Sand.ELEMENTS.DIRT;
    // Run several ticks; sand should be lower than dirt overall.
    for (let i = 0; i < 6; i++) Sand.tick();
    let sandRow = -1;
    let dirtRow = -1;
    for (let r = 0; r < Sand.ROWS; r++) {
      if (Sand.getCell(sandCol, r) === Sand.ELEMENTS.SAND) sandRow = r;
      if (Sand.getCell(dirtCol, r) === Sand.ELEMENTS.DIRT) dirtRow = r;
    }
    expect(sandRow).toBeGreaterThan(dirtRow);
  });

  test('STONE never moves', () => {
    Sand.clearGrid();
    const col = 15;
    Sand.getSandState().grid[0 * Sand.COLS + col] = Sand.ELEMENTS.STONE;
    for (let i = 0; i < 5; i++) Sand.tick();
    expect(Sand.getCell(col, 0)).toBe(Sand.ELEMENTS.STONE);
  });

  test('WATER spreads sideways to fill gaps', () => {
    Sand.clearGrid();
    const grid = Sand.getSandState().grid;
    const floorRow = Sand.ROWS - 1;
    // Build a stone floor.
    for (let c = 0; c < Sand.COLS; c++) {
      grid[floorRow * Sand.COLS + c] = Sand.ELEMENTS.STONE;
    }
    // Drop a stack of water in a single column just above the floor.
    const col = 20;
    for (let r = floorRow - 5; r < floorRow; r++) {
      grid[r * Sand.COLS + col] = Sand.ELEMENTS.WATER;
    }
    for (let i = 0; i < 40; i++) Sand.tick();
    // Conserved water must spread across more than the single source column
    // (it cannot all stack in one column above a flat floor).
    let columnsWithWater = 0;
    for (let c = 0; c < Sand.COLS; c++) {
      let hasWater = false;
      for (let r = 0; r < floorRow; r++) {
        if (Sand.getCell(c, r) === Sand.ELEMENTS.WATER) { hasWater = true; break; }
      }
      if (hasWater) columnsWithWater++;
    }
    expect(columnsWithWater).toBeGreaterThan(1);
  });
});

describe('clearGrid', () => {
  test('clears painted cells and resets frameCount', () => {
    Sand.setElement(Sand.ELEMENTS.SAND);
    Sand.paintCell(5, 5);
    Sand.tick();
    Sand.clearGrid();
    expect(Sand.getCell(5, 5)).toBe(Sand.ELEMENTS.EMPTY);
    expect(Sand.getSandState().frameCount).toBe(0);
  });
});

describe('water physics: at most one move per tick (regression)', () => {
  afterEach(() => {
    if (Math.random.mockRestore) Math.random.mockRestore();
  });

  function findWater() {
    for (let row = 0; row < Sand.ROWS; row++) {
      for (let col = 0; col < Sand.COLS; col++) {
        if (Sand.getCell(col, row) === Sand.ELEMENTS.WATER) return { col, row };
      }
    }
    return null;
  }

  test('water spreads at most one column (right bias) on a stone floor', () => {
    jest.spyOn(global.Math, 'random').mockReturnValue(0.9);
    const floorRow = Sand.ROWS - 1;
    const startCol = 20;
    const startRow = floorRow - 1;
    // Lay a stone floor so water cannot fall and must spread sideways, then
    // place a single water particle directly into the grid (no 5-cell brush).
    const grid = Sand.getSandState().grid;
    for (let c = 0; c < Sand.COLS; c++) grid[floorRow * Sand.COLS + c] = Sand.ELEMENTS.STONE;
    grid[startRow * Sand.COLS + startCol] = Sand.ELEMENTS.WATER;

    Sand.tick();

    const after = findWater();
    expect(after).not.toBeNull();
    expect(Math.abs(after.col - startCol)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.row - startRow)).toBeLessThanOrEqual(1);
  });

  test('water spreads at most one column (left bias) on a stone floor', () => {
    jest.spyOn(global.Math, 'random').mockReturnValue(0.1);
    const floorRow = Sand.ROWS - 1;
    const startCol = 20;
    const startRow = floorRow - 1;
    const grid = Sand.getSandState().grid;
    for (let c = 0; c < Sand.COLS; c++) grid[floorRow * Sand.COLS + c] = Sand.ELEMENTS.STONE;
    grid[startRow * Sand.COLS + startCol] = Sand.ELEMENTS.WATER;

    Sand.tick();

    const after = findWater();
    expect(after).not.toBeNull();
    expect(Math.abs(after.col - startCol)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.row - startRow)).toBeLessThanOrEqual(1);
  });

  test('falling water moves at most one row per tick', () => {
    jest.spyOn(global.Math, 'random').mockReturnValue(0.9);
    const startCol = 10;
    const startRow = 0;
    const grid = Sand.getSandState().grid;
    grid[startRow * Sand.COLS + startCol] = Sand.ELEMENTS.WATER;

    Sand.tick();

    const after = findWater();
    expect(after).not.toBeNull();
    expect(after.row - startRow).toBeLessThanOrEqual(1);
    expect(Math.abs(after.col - startCol)).toBeLessThanOrEqual(1);
  });
});

describe('new elements registration', () => {
  test('all new elements are defined and distinct', () => {
    const ids = [
      Sand.ELEMENTS.GRAVEL, Sand.ELEMENTS.EXPLOSIVE, Sand.ELEMENTS.LAVA,
      Sand.ELEMENTS.FIRE, Sand.ELEMENTS.WOOD, Sand.ELEMENTS.PERSON
    ];
    ids.forEach((id) => expect(typeof id).toBe('number'));
    const all = [
      Sand.ELEMENTS.EMPTY, Sand.ELEMENTS.SAND, Sand.ELEMENTS.DIRT,
      Sand.ELEMENTS.STONE, Sand.ELEMENTS.WATER, ...ids
    ];
    expect(new Set(all).size).toBe(all.length);
  });

  test('new elements are selectable via setElement', () => {
    Sand.setElement(Sand.ELEMENTS.GRAVEL);
    expect(Sand.getSandState().currentElement).toBe(Sand.ELEMENTS.GRAVEL);
    Sand.setElement(Sand.ELEMENTS.LAVA);
    expect(Sand.getSandState().currentElement).toBe(Sand.ELEMENTS.LAVA);
    Sand.setElement(Sand.ELEMENTS.PERSON);
    expect(Sand.getSandState().currentElement).toBe(Sand.ELEMENTS.PERSON);
  });

  test('unknown id is still rejected after adding new elements', () => {
    Sand.setElement(Sand.ELEMENTS.WOOD);
    Sand.setElement(999);
    expect(Sand.getSandState().currentElement).toBe(Sand.ELEMENTS.WOOD);
  });
});

describe('density-based sinking through water', () => {
  afterEach(() => {
    if (Math.random.mockRestore) Math.random.mockRestore();
  });

  function countCells(type) {
    let n = 0;
    for (let r = 0; r < Sand.ROWS; r++) {
      for (let c = 0; c < Sand.COLS; c++) {
        if (Sand.getCell(c, r) === type) n++;
      }
    }
    return n;
  }

  function setupSolidOverWater(solid) {
    Sand.clearGrid();
    // Force straight-down (no diagonal randomness wandering off).
    jest.spyOn(global.Math, 'random').mockReturnValue(0.0);
    const grid = Sand.getSandState().grid;
    const col = 20;
    const r = 10;
    grid[r * Sand.COLS + col] = solid;
    grid[(r + 1) * Sand.COLS + col] = Sand.ELEMENTS.WATER;
    grid[(r + 2) * Sand.COLS + col] = Sand.ELEMENTS.STONE; // floor
    // Walls beside the water so it can only be displaced upward by sinking solid.
    grid[(r + 1) * Sand.COLS + (col - 1)] = Sand.ELEMENTS.STONE;
    grid[(r + 1) * Sand.COLS + (col + 1)] = Sand.ELEMENTS.STONE;
    grid[(r + 2) * Sand.COLS + (col - 1)] = Sand.ELEMENTS.STONE;
    grid[(r + 2) * Sand.COLS + (col + 1)] = Sand.ELEMENTS.STONE;
    return { col, r };
  }

  test('SAND sinks through water and water rises (conserved)', () => {
    const { col, r } = setupSolidOverWater(Sand.ELEMENTS.SAND);
    const waterBefore = countCells(Sand.ELEMENTS.WATER);
    Sand.tick();
    expect(Sand.getCell(col, r + 1)).toBe(Sand.ELEMENTS.SAND);
    expect(Sand.getCell(col, r)).toBe(Sand.ELEMENTS.WATER);
    expect(countCells(Sand.ELEMENTS.WATER)).toBe(waterBefore);
  });

  test('GRAVEL sinks through water', () => {
    const { col, r } = setupSolidOverWater(Sand.ELEMENTS.GRAVEL);
    Sand.tick();
    expect(Sand.getCell(col, r + 1)).toBe(Sand.ELEMENTS.GRAVEL);
    expect(Sand.getCell(col, r)).toBe(Sand.ELEMENTS.WATER);
  });

  test('DIRT sinks through water (accounting for 3-frame gating)', () => {
    const { col, r } = setupSolidOverWater(Sand.ELEMENTS.DIRT);
    const waterBefore = countCells(Sand.ELEMENTS.WATER);
    // Dirt only moves every 3rd frame; run enough ticks.
    for (let i = 0; i < 3; i++) Sand.tick();
    expect(Sand.getCell(col, r + 1)).toBe(Sand.ELEMENTS.DIRT);
    expect(countCells(Sand.ELEMENTS.WATER)).toBe(waterBefore);
  });

  test('water count is conserved during a sink interaction', () => {
    setupSolidOverWater(Sand.ELEMENTS.SAND);
    const before = countCells(Sand.ELEMENTS.WATER);
    for (let i = 0; i < 5; i++) Sand.tick();
    expect(countCells(Sand.ELEMENTS.WATER)).toBe(before);
  });
});

describe('lava behavior', () => {
  afterEach(() => {
    if (Math.random.mockRestore) Math.random.mockRestore();
  });

  test('lava turns adjacent water into stone (both cells)', () => {
    Sand.clearGrid();
    const grid = Sand.getSandState().grid;
    const col = 20;
    const r = 10;
    grid[r * Sand.COLS + col] = Sand.ELEMENTS.LAVA;
    grid[r * Sand.COLS + (col + 1)] = Sand.ELEMENTS.WATER;
    Sand.tick();
    expect(Sand.getCell(col, r)).toBe(Sand.ELEMENTS.STONE);
    expect(Sand.getCell(col + 1, r)).toBe(Sand.ELEMENTS.STONE);
  });

  test('lava ignites adjacent wood', () => {
    Sand.clearGrid();
    const grid = Sand.getSandState().grid;
    const col = 20;
    const r = 10;
    grid[r * Sand.COLS + col] = Sand.ELEMENTS.LAVA;
    grid[r * Sand.COLS + (col + 1)] = Sand.ELEMENTS.WOOD;
    // floor so lava doesn't fall away
    grid[(r + 1) * Sand.COLS + col] = Sand.ELEMENTS.STONE;
    Sand.tick();
    expect(Sand.getCell(col + 1, r)).toBe(Sand.ELEMENTS.FIRE);
  });
});

describe('explosive behavior', () => {
  afterEach(() => {
    if (Math.random.mockRestore) Math.random.mockRestore();
  });

  test('explosive detonates when adjacent to fire, clearing nearby cells', () => {
    Sand.clearGrid();
    const grid = Sand.getSandState().grid;
    const col = 20;
    const r = 15;
    // Fill a 5x5 region with sand
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        grid[(r + dr) * Sand.COLS + (col + dc)] = Sand.ELEMENTS.SAND;
      }
    }
    grid[r * Sand.COLS + col] = Sand.ELEMENTS.EXPLOSIVE;
    grid[r * Sand.COLS + (col + 1)] = Sand.ELEMENTS.FIRE;
    Sand.tick();
    // Center is no longer explosive/sand (became fire/empty).
    expect(Sand.getCell(col, r)).not.toBe(Sand.ELEMENTS.EXPLOSIVE);
    expect(Sand.getCell(col, r)).not.toBe(Sand.ELEMENTS.SAND);
    // A corner of the blast radius was cleared of sand.
    expect(Sand.getCell(col - 2, r - 2)).not.toBe(Sand.ELEMENTS.SAND);
  });

  test('explosive falls like a powder when no trigger present', () => {
    Sand.clearGrid();
    jest.spyOn(global.Math, 'random').mockReturnValue(0.0);
    const grid = Sand.getSandState().grid;
    const col = 20;
    const r = 5;
    grid[r * Sand.COLS + col] = Sand.ELEMENTS.EXPLOSIVE;
    Sand.tick();
    expect(Sand.getCell(col, r)).toBe(Sand.ELEMENTS.EMPTY);
    expect(Sand.getCell(col, r + 1)).toBe(Sand.ELEMENTS.EXPLOSIVE);
  });
});

describe('fire behavior', () => {
  afterEach(() => {
    if (Math.random.mockRestore) Math.random.mockRestore();
  });

  test('fire spreads to adjacent wood', () => {
    Sand.clearGrid();
    // Prevent dissipation (random >= 0.25) and rising.
    jest.spyOn(global.Math, 'random').mockReturnValue(0.9);
    const grid = Sand.getSandState().grid;
    const col = 20;
    const r = 15;
    grid[r * Sand.COLS + col] = Sand.ELEMENTS.FIRE;
    grid[r * Sand.COLS + (col + 1)] = Sand.ELEMENTS.WOOD;
    // surround fire with stone above so it doesn't rise away first
    grid[(r - 1) * Sand.COLS + col] = Sand.ELEMENTS.STONE;
    Sand.tick();
    expect(Sand.getCell(col + 1, r)).toBe(Sand.ELEMENTS.FIRE);
  });

  test('fire dissipates over time', () => {
    Sand.clearGrid();
    jest.spyOn(global.Math, 'random').mockReturnValue(0.1); // < 0.25 → dissipate
    const grid = Sand.getSandState().grid;
    const col = 20;
    const r = 15;
    grid[r * Sand.COLS + col] = Sand.ELEMENTS.FIRE;
    Sand.tick();
    expect(Sand.getCell(col, r)).toBe(Sand.ELEMENTS.EMPTY);
  });
});

describe('wood behavior', () => {
  test('wood is static absent fire or lava', () => {
    Sand.clearGrid();
    const col = 18;
    const r = 5;
    Sand.getSandState().grid[r * Sand.COLS + col] = Sand.ELEMENTS.WOOD;
    for (let i = 0; i < 5; i++) Sand.tick();
    expect(Sand.getCell(col, r)).toBe(Sand.ELEMENTS.WOOD);
  });

  test('wood ignites when adjacent to fire', () => {
    Sand.clearGrid();
    const grid = Sand.getSandState().grid;
    const col = 18;
    const r = 15;
    grid[r * Sand.COLS + col] = Sand.ELEMENTS.WOOD;
    grid[(r + 1) * Sand.COLS + col] = Sand.ELEMENTS.FIRE;
    Sand.tick();
    expect(Sand.getCell(col, r)).toBe(Sand.ELEMENTS.FIRE);
  });
});

describe('person behavior', () => {
  afterEach(() => {
    if (Math.random.mockRestore) Math.random.mockRestore();
  });

  test('person moves each tick (wanders when on solid ground)', () => {
    Sand.clearGrid();
    jest.spyOn(global.Math, 'random').mockReturnValue(0.9); // prefer right
    const grid = Sand.getSandState().grid;
    const col = 20;
    const r = 15;
    grid[r * Sand.COLS + col] = Sand.ELEMENTS.PERSON;
    // floor under the person and to the right so it can step sideways
    grid[(r + 1) * Sand.COLS + col] = Sand.ELEMENTS.STONE;
    grid[(r + 1) * Sand.COLS + (col + 1)] = Sand.ELEMENTS.STONE;
    grid[(r + 1) * Sand.COLS + (col - 1)] = Sand.ELEMENTS.STONE;
    Sand.tick();
    expect(Sand.getCell(col, r)).not.toBe(Sand.ELEMENTS.PERSON);
    // person moved to a neighbouring cell
    const moved = Sand.getCell(col + 1, r) === Sand.ELEMENTS.PERSON ||
                  Sand.getCell(col - 1, r) === Sand.ELEMENTS.PERSON;
    expect(moved).toBe(true);
  });

  test('person falls under gravity', () => {
    Sand.clearGrid();
    const grid = Sand.getSandState().grid;
    const col = 20;
    const r = 5;
    grid[r * Sand.COLS + col] = Sand.ELEMENTS.PERSON;
    Sand.tick();
    expect(Sand.getCell(col, r)).toBe(Sand.ELEMENTS.EMPTY);
    expect(Sand.getCell(col, r + 1)).toBe(Sand.ELEMENTS.PERSON);
  });

  test('person dies in contact with lava', () => {
    Sand.clearGrid();
    const grid = Sand.getSandState().grid;
    const col = 20;
    const r = 15;
    grid[r * Sand.COLS + col] = Sand.ELEMENTS.PERSON;
    grid[r * Sand.COLS + (col + 1)] = Sand.ELEMENTS.LAVA;
    // floor so person doesn't simply fall
    grid[(r + 1) * Sand.COLS + col] = Sand.ELEMENTS.STONE;
    Sand.tick();
    expect(Sand.getCell(col, r)).toBe(Sand.ELEMENTS.EMPTY);
  });

  test('person dies in contact with fire', () => {
    Sand.clearGrid();
    const grid = Sand.getSandState().grid;
    const col = 20;
    const r = 15;
    grid[r * Sand.COLS + col] = Sand.ELEMENTS.PERSON;
    grid[r * Sand.COLS + (col + 1)] = Sand.ELEMENTS.FIRE;
    grid[(r + 1) * Sand.COLS + col] = Sand.ELEMENTS.STONE;
    Sand.tick();
    expect(Sand.getCell(col, r)).toBe(Sand.ELEMENTS.EMPTY);
  });
});

describe('shared scope integration', () => {
  test('no redeclaration errors when all scripts load in same scope', () => {
    const fs = require('fs');
    const vm = require('vm');
    const arrowSrc = fs.readFileSync('js/arrow-geometry.js', 'utf8');
    const gameSrc = fs.readFileSync('js/game.js', 'utf8');
    const bugSquashSrc = fs.readFileSync('js/bug-squash.js', 'utf8');
    const snakeSrc = fs.readFileSync('js/snake.js', 'utf8');
    const sandSrc = fs.readFileSync('js/sand-game.js', 'utf8');
    const context = vm.createContext({
      document: { getElementById: () => ({ getContext: () => ({ clearRect(){}, fillRect(){}, fillText(){}, beginPath(){}, arc(){}, fill(){}, closePath(){}, moveTo(){}, lineTo(){}, stroke(){} }) }), addEventListener: () => {} },
      window: {},
      requestAnimationFrame: () => 1,
      cancelAnimationFrame: () => {},
      module: undefined,
      setInterval: () => 1,
      clearInterval: () => {},
      localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      Math: Math,
      Int8Array: Int8Array,
      Date: Date,
      JSON: JSON
    });
    expect(() => {
      vm.runInContext(arrowSrc, context);
      vm.runInContext(gameSrc, context);
      vm.runInContext(bugSquashSrc, context);
      vm.runInContext(snakeSrc, context);
      vm.runInContext(sandSrc, context);
    }).not.toThrow();
    expect(context.window.ForemanSandGame).toBeDefined();
  });
});
