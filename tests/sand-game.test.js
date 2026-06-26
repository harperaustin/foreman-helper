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

describe('new elements: registry and sanitation', () => {
  test('new element values are defined', () => {
    expect(Sand.ELEMENTS.EXPLOSIVES).toBe(5);
    expect(Sand.ELEMENTS.LAVA).toBe(6);
    expect(Sand.ELEMENTS.PEOPLE).toBe(7);
    expect(Sand.ELEMENTS.GRAVEL).toBe(8);
    expect(Sand.ELEMENTS.FIRE).toBe(9);
    expect(Sand.ELEMENTS.WOOD).toBe(10);
  });

  test('new elements are accepted by setElement', () => {
    Sand.setElement(Sand.ELEMENTS.LAVA);
    expect(Sand.getSandState().currentElement).toBe(Sand.ELEMENTS.LAVA);
    Sand.setElement(Sand.ELEMENTS.GRAVEL);
    expect(Sand.getSandState().currentElement).toBe(Sand.ELEMENTS.GRAVEL);
  });
});

describe('sinking physics through water', () => {
  test('SAND sinks below water', () => {
    Sand.clearGrid();
    const grid = Sand.getSandState().grid;
    const col = 20;
    // Trap a water cell (solid below and on both sides) so the only way it can
    // move is by being displaced upward when sand sinks into it.
    grid[0 * Sand.COLS + col] = Sand.ELEMENTS.SAND;
    grid[1 * Sand.COLS + col] = Sand.ELEMENTS.WATER;
    grid[2 * Sand.COLS + col] = Sand.ELEMENTS.STONE;
    grid[2 * Sand.COLS + (col - 1)] = Sand.ELEMENTS.STONE;
    grid[2 * Sand.COLS + (col + 1)] = Sand.ELEMENTS.STONE;
    grid[1 * Sand.COLS + (col - 1)] = Sand.ELEMENTS.STONE;
    grid[1 * Sand.COLS + (col + 1)] = Sand.ELEMENTS.STONE;
    Sand.tick();
    expect(Sand.getCell(col, 1)).toBe(Sand.ELEMENTS.SAND);
    expect(Sand.getCell(col, 0)).toBe(Sand.ELEMENTS.WATER);
  });

  test('DIRT sinks below water over time', () => {
    Sand.clearGrid();
    const grid = Sand.getSandState().grid;
    const col = 20;
    grid[0 * Sand.COLS + col] = Sand.ELEMENTS.DIRT;
    grid[1 * Sand.COLS + col] = Sand.ELEMENTS.WATER;
    grid[2 * Sand.COLS + col] = Sand.ELEMENTS.WATER;
    for (let i = 0; i < 12; i++) Sand.tick();
    let dirtRow = -1;
    for (let r = 0; r < Sand.ROWS; r++) {
      if (Sand.getCell(col, r) === Sand.ELEMENTS.DIRT) dirtRow = r;
    }
    expect(dirtRow).toBeGreaterThan(0);
  });
});

describe('gravel physics', () => {
  test('GRAVEL falls one row per tick', () => {
    Sand.clearGrid();
    const col = 20;
    Sand.getSandState().grid[0 * Sand.COLS + col] = Sand.ELEMENTS.GRAVEL;
    Sand.tick();
    expect(Sand.getCell(col, 0)).toBe(Sand.ELEMENTS.EMPTY);
    expect(Sand.getCell(col, 1)).toBe(Sand.ELEMENTS.GRAVEL);
  });

  test('GRAVEL sinks through water', () => {
    Sand.clearGrid();
    const grid = Sand.getSandState().grid;
    const col = 20;
    grid[0 * Sand.COLS + col] = Sand.ELEMENTS.GRAVEL;
    grid[1 * Sand.COLS + col] = Sand.ELEMENTS.WATER;
    grid[2 * Sand.COLS + col] = Sand.ELEMENTS.STONE;
    grid[2 * Sand.COLS + (col - 1)] = Sand.ELEMENTS.STONE;
    grid[2 * Sand.COLS + (col + 1)] = Sand.ELEMENTS.STONE;
    grid[1 * Sand.COLS + (col - 1)] = Sand.ELEMENTS.STONE;
    grid[1 * Sand.COLS + (col + 1)] = Sand.ELEMENTS.STONE;
    Sand.tick();
    expect(Sand.getCell(col, 1)).toBe(Sand.ELEMENTS.GRAVEL);
    expect(Sand.getCell(col, 0)).toBe(Sand.ELEMENTS.WATER);
  });
});

describe('lava physics', () => {
  test('LAVA flows downward', () => {
    Sand.clearGrid();
    const col = 20;
    Sand.getSandState().grid[0 * Sand.COLS + col] = Sand.ELEMENTS.LAVA;
    // Lava moves every 2nd frame; run a couple ticks.
    for (let i = 0; i < 4; i++) Sand.tick();
    let lavaRow = -1;
    for (let r = 0; r < Sand.ROWS; r++) {
      if (Sand.getCell(col, r) === Sand.ELEMENTS.LAVA) lavaRow = r;
    }
    expect(lavaRow).toBeGreaterThan(0);
  });

  test('LAVA touching water solidifies into STONE', () => {
    Sand.clearGrid();
    const grid = Sand.getSandState().grid;
    const col = 20;
    const row = 10;
    grid[row * Sand.COLS + col] = Sand.ELEMENTS.LAVA;
    grid[row * Sand.COLS + (col + 1)] = Sand.ELEMENTS.WATER;
    Sand.tick();
    expect(Sand.getCell(col, row)).toBe(Sand.ELEMENTS.STONE);
    expect(Sand.getCell(col + 1, row)).toBe(Sand.ELEMENTS.STONE);
  });
});

describe('explosives physics', () => {
  test('EXPLOSIVES fall like sand', () => {
    Sand.clearGrid();
    const col = 20;
    Sand.getSandState().grid[0 * Sand.COLS + col] = Sand.ELEMENTS.EXPLOSIVES;
    Sand.tick();
    expect(Sand.getCell(col, 1)).toBe(Sand.ELEMENTS.EXPLOSIVES);
  });

  test('EXPLOSIVES ignite and blast a radius when touching fire', () => {
    Sand.clearGrid();
    const grid = Sand.getSandState().grid;
    const col = 20;
    const row = 15;
    grid[row * Sand.COLS + col] = Sand.ELEMENTS.EXPLOSIVES;
    grid[row * Sand.COLS + (col + 1)] = Sand.ELEMENTS.FIRE;
    // Surround with wood to detect blast removal.
    grid[(row - 2) * Sand.COLS + col] = Sand.ELEMENTS.WOOD;
    Sand.tick();
    // The explosive cell must no longer be explosives.
    expect(Sand.getCell(col, row)).not.toBe(Sand.ELEMENTS.EXPLOSIVES);
    // Cell within radius cleared (fire or empty), not wood anymore.
    expect(Sand.getCell(col, row - 2)).not.toBe(Sand.ELEMENTS.WOOD);
  });

  test('EXPLOSIVES chain react', () => {
    Sand.clearGrid();
    const grid = Sand.getSandState().grid;
    const row = 15;
    const col = 20;
    grid[row * Sand.COLS + col] = Sand.ELEMENTS.EXPLOSIVES;
    grid[row * Sand.COLS + (col + 1)] = Sand.ELEMENTS.EXPLOSIVES;
    grid[row * Sand.COLS + (col + 2)] = Sand.ELEMENTS.EXPLOSIVES;
    grid[row * Sand.COLS + (col + 3)] = Sand.ELEMENTS.FIRE;
    Sand.tick();
    // All explosives consumed by the chain reaction.
    expect(Sand.getCell(col, row)).not.toBe(Sand.ELEMENTS.EXPLOSIVES);
    expect(Sand.getCell(col + 1, row)).not.toBe(Sand.ELEMENTS.EXPLOSIVES);
    expect(Sand.getCell(col + 2, row)).not.toBe(Sand.ELEMENTS.EXPLOSIVES);
  });
});

describe('little people physics', () => {
  test('PEOPLE fall under gravity', () => {
    Sand.clearGrid();
    const col = 20;
    Sand.getSandState().grid[0 * Sand.COLS + col] = Sand.ELEMENTS.PEOPLE;
    Sand.tick();
    expect(Sand.getCell(col, 1)).toBe(Sand.ELEMENTS.PEOPLE);
  });

  test('PEOPLE sink through water', () => {
    Sand.clearGrid();
    const grid = Sand.getSandState().grid;
    const col = 20;
    grid[0 * Sand.COLS + col] = Sand.ELEMENTS.PEOPLE;
    grid[1 * Sand.COLS + col] = Sand.ELEMENTS.WATER;
    grid[2 * Sand.COLS + col] = Sand.ELEMENTS.STONE;
    grid[2 * Sand.COLS + (col - 1)] = Sand.ELEMENTS.STONE;
    grid[2 * Sand.COLS + (col + 1)] = Sand.ELEMENTS.STONE;
    grid[1 * Sand.COLS + (col - 1)] = Sand.ELEMENTS.STONE;
    grid[1 * Sand.COLS + (col + 1)] = Sand.ELEMENTS.STONE;
    Sand.tick();
    expect(Sand.getCell(col, 1)).toBe(Sand.ELEMENTS.PEOPLE);
    expect(Sand.getCell(col, 0)).toBe(Sand.ELEMENTS.WATER);
  });

  test('PEOPLE walk on solid ground', () => {
    jest.spyOn(global.Math, 'random').mockReturnValue(0.9);
    Sand.clearGrid();
    const grid = Sand.getSandState().grid;
    const floorRow = 10;
    for (let c = 0; c < Sand.COLS; c++) grid[(floorRow + 1) * Sand.COLS + c] = Sand.ELEMENTS.STONE;
    const col = 20;
    grid[floorRow * Sand.COLS + col] = Sand.ELEMENTS.PEOPLE;
    // frameCount must be a multiple of 4 for walking; run a few ticks.
    let moved = false;
    for (let i = 0; i < 8; i++) {
      Sand.tick();
      if (Sand.getCell(col, floorRow) !== Sand.ELEMENTS.PEOPLE) { moved = true; break; }
    }
    expect(moved).toBe(true);
    Math.random.mockRestore();
  });

  test('PEOPLE climb a one-pixel step', () => {
    jest.spyOn(global.Math, 'random').mockReturnValue(0.9);
    Sand.clearGrid();
    const grid = Sand.getSandState().grid;
    const floorRow = 10;
    for (let c = 0; c < Sand.COLS; c++) grid[(floorRow + 1) * Sand.COLS + c] = Sand.ELEMENTS.STONE;
    const col = 20;
    grid[floorRow * Sand.COLS + col] = Sand.ELEMENTS.PEOPLE;
    // A one-pixel step to the right.
    grid[floorRow * Sand.COLS + (col + 1)] = Sand.ELEMENTS.STONE;
    let climbed = false;
    for (let i = 0; i < 8; i++) {
      Sand.tick();
      if (Sand.getCell(col + 1, floorRow - 1) === Sand.ELEMENTS.PEOPLE) { climbed = true; break; }
    }
    expect(climbed).toBe(true);
    Math.random.mockRestore();
  });

  test('PEOPLE burn into fire when touching fire', () => {
    Sand.clearGrid();
    const grid = Sand.getSandState().grid;
    const col = 20;
    const row = 15;
    grid[row * Sand.COLS + col] = Sand.ELEMENTS.PEOPLE;
    grid[row * Sand.COLS + (col + 1)] = Sand.ELEMENTS.FIRE;
    Sand.tick();
    expect(Sand.getCell(col, row)).toBe(Sand.ELEMENTS.FIRE);
  });
});

describe('fire physics', () => {
  test('FIRE eventually decays away', () => {
    jest.spyOn(global.Math, 'random').mockReturnValue(0.1);
    Sand.clearGrid();
    const col = 20;
    Sand.getSandState().grid[10 * Sand.COLS + col] = Sand.ELEMENTS.FIRE;
    Sand.tick();
    // 0.1 < 0.2 -> burns out.
    let hasFire = false;
    for (let r = 0; r < Sand.ROWS; r++) {
      if (Sand.getCell(col, r) === Sand.ELEMENTS.FIRE) hasFire = true;
    }
    expect(hasFire).toBe(false);
    Math.random.mockRestore();
  });

  test('FIRE rises upward', () => {
    jest.spyOn(global.Math, 'random').mockReturnValue(0.9);
    Sand.clearGrid();
    const col = 20;
    const row = 15;
    Sand.getSandState().grid[row * Sand.COLS + col] = Sand.ELEMENTS.FIRE;
    Sand.tick();
    // 0.9 > 0.2 -> survives and rises.
    expect(Sand.getCell(col, row - 1)).toBe(Sand.ELEMENTS.FIRE);
    Math.random.mockRestore();
  });
});

describe('wood physics', () => {
  test('WOOD catches fire when touching fire', () => {
    jest.spyOn(global.Math, 'random').mockReturnValue(0.1);
    Sand.clearGrid();
    const grid = Sand.getSandState().grid;
    const col = 20;
    const row = 15;
    grid[row * Sand.COLS + col] = Sand.ELEMENTS.WOOD;
    grid[(row - 1) * Sand.COLS + col] = Sand.ELEMENTS.FIRE;
    // Fire decays at 0.1, so re-seed and tick a few times; wood should ignite.
    let ignited = false;
    for (let i = 0; i < 5; i++) {
      grid[(row - 1) * Sand.COLS + col] = Sand.ELEMENTS.FIRE;
      Sand.tick();
      if (Sand.getCell(col, row) === Sand.ELEMENTS.FIRE) { ignited = true; break; }
    }
    expect(ignited).toBe(true);
    Math.random.mockRestore();
  });

  test('WOOD catches fire when touching lava', () => {
    jest.spyOn(global.Math, 'random').mockReturnValue(0.1);
    Sand.clearGrid();
    const grid = Sand.getSandState().grid;
    const col = 20;
    const row = 15;
    grid[row * Sand.COLS + col] = Sand.ELEMENTS.WOOD;
    grid[row * Sand.COLS + (col + 1)] = Sand.ELEMENTS.LAVA;
    Sand.tick();
    expect(Sand.getCell(col, row)).toBe(Sand.ELEMENTS.FIRE);
    Math.random.mockRestore();
  });

  test('WOOD is inert with no fire nearby', () => {
    Sand.clearGrid();
    const col = 20;
    const row = 15;
    Sand.getSandState().grid[row * Sand.COLS + col] = Sand.ELEMENTS.WOOD;
    for (let i = 0; i < 5; i++) Sand.tick();
    expect(Sand.getCell(col, row)).toBe(Sand.ELEMENTS.WOOD);
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
