/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

let Flock;
let canvas;

function makeCtx() {
  return {
    clearRect: jest.fn(),
    fillRect: jest.fn(),
    beginPath: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(),
    closePath: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    translate: jest.fn(),
    rotate: jest.fn(),
    set fillStyle(v) {},
    set strokeStyle(v) {},
    set lineWidth(v) {},
  };
}

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  global.cancelAnimationFrame = (id) => clearTimeout(id);
  canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 400;
  canvas.getContext = () => makeCtx();
  Flock = require('../js/flock.js');
  Flock.initFlock(canvas);
});

afterEach(() => {
  Flock.stopFlock();
  jest.useRealTimers();
});

describe('flock initialization', () => {
  test('initFlock returns state not running', () => {
    const state = Flock.getFlockState();
    expect(state).toBeDefined();
    expect(state.running).toBe(false);
  });

  test('starts with DEFAULT_COUNT boids', () => {
    expect(Flock.getFlockState().boids.length).toBe(Flock.DEFAULT_COUNT);
    expect(Flock.DEFAULT_COUNT).toBe(50);
  });

  test('every boid has numeric position/velocity within bounds', () => {
    const state = Flock.getFlockState();
    state.boids.forEach((b) => {
      expect(typeof b.x).toBe('number');
      expect(typeof b.y).toBe('number');
      expect(typeof b.vx).toBe('number');
      expect(typeof b.vy).toBe('number');
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x).toBeLessThan(state.width);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeLessThan(state.height);
    });
  });
});

describe('separation', () => {
  test('steers away from a crowding neighbour', () => {
    const a = { x: 100, y: 100, vx: 0, vy: 0 };
    const b = { x: 105, y: 100, vx: 0, vy: 0 }; // to the right of a
    const v = Flock.computeSeparation(a, [a, b], Flock.SEPARATION_RADIUS);
    expect(v.x).toBeLessThan(0); // pushed left, away from b
  });

  test('returns zero with no neighbours in range', () => {
    const a = { x: 0, y: 0, vx: 0, vy: 0 };
    const b = { x: 400, y: 400, vx: 0, vy: 0 };
    const v = Flock.computeSeparation(a, [a, b], Flock.SEPARATION_RADIUS);
    expect(v).toEqual({ x: 0, y: 0 });
  });
});

describe('alignment', () => {
  test('steers toward neighbour heading', () => {
    const a = { x: 100, y: 100, vx: 0, vy: 0 };
    const b = { x: 110, y: 100, vx: 2, vy: 0 };
    const c = { x: 90, y: 105, vx: 2, vy: 0 };
    const v = Flock.computeAlignment(a, [a, b, c], Flock.ALIGN_RADIUS);
    expect(v.x).toBeGreaterThan(0);
  });

  test('returns zero with empty neighbourhood', () => {
    const a = { x: 0, y: 0, vx: 0, vy: 0 };
    const b = { x: 400, y: 400, vx: 5, vy: 5 };
    const v = Flock.computeAlignment(a, [a, b], Flock.ALIGN_RADIUS);
    expect(v).toEqual({ x: 0, y: 0 });
  });
});

describe('cohesion', () => {
  test('steers toward centre of mass to the right', () => {
    const a = { x: 100, y: 100, vx: 0, vy: 0 };
    const b = { x: 120, y: 100, vx: 0, vy: 0 };
    const c = { x: 130, y: 100, vx: 0, vy: 0 };
    const v = Flock.computeCohesion(a, [a, b, c], Flock.COHESION_RADIUS);
    expect(v.x).toBeGreaterThan(0);
  });

  test('returns zero with empty neighbourhood', () => {
    const a = { x: 0, y: 0, vx: 0, vy: 0 };
    const b = { x: 400, y: 400, vx: 0, vy: 0 };
    const v = Flock.computeCohesion(a, [a, b], Flock.COHESION_RADIUS);
    expect(v).toEqual({ x: 0, y: 0 });
  });
});

describe('predator avoidance', () => {
  test('steers away from a nearby predator', () => {
    const boid = { x: 100, y: 100, vx: 0, vy: 0 };
    const predator = { x: 110, y: 100 }; // to the right
    const v = Flock.computePredatorAvoid(boid, predator, Flock.PREDATOR_RADIUS);
    expect(v.x).toBeLessThan(0); // flee left
    expect(Math.abs(v.x) + Math.abs(v.y)).toBeGreaterThan(0);
  });

  test('returns zero when predator is null', () => {
    const boid = { x: 100, y: 100, vx: 0, vy: 0 };
    expect(Flock.computePredatorAvoid(boid, null, Flock.PREDATOR_RADIUS)).toEqual({ x: 0, y: 0 });
  });

  test('returns zero when predator beyond radius', () => {
    const boid = { x: 100, y: 100, vx: 0, vy: 0 };
    const predator = { x: 400, y: 400 };
    expect(Flock.computePredatorAvoid(boid, predator, Flock.PREDATOR_RADIUS)).toEqual({ x: 0, y: 0 });
  });

  test('boid moves away from predator over several ticks', () => {
    // Baseline run with no predator
    Flock.resetFlock();
    const baseState = Flock.getFlockState();
    const baseBoid = baseState.boids[0];
    const px = baseBoid.x + 5;
    const py = baseBoid.y;
    function dist(b) { return Math.sqrt((b.x - px) ** 2 + (b.y - py) ** 2); }
    const startDist = dist(baseBoid);
    Flock.setPredator(px, py);
    for (let i = 0; i < 10; i++) Flock.tick();
    const endDist = dist(Flock.getFlockState().boids[0]);
    expect(endDist).toBeGreaterThan(startDist);
  });
});

describe('reset', () => {
  test('re-initializes after ticks', () => {
    for (let i = 0; i < 5; i++) Flock.tick();
    expect(Flock.getFlockState().frameCount).toBe(5);
    const s = Flock.resetFlock();
    expect(s.frameCount).toBe(0);
    expect(s.boids.length).toBe(s.count);
    s.boids.forEach((b) => {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x).toBeLessThan(s.width);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeLessThan(s.height);
    });
  });
});

describe('public API', () => {
  test('exposes reset alias that re-seeds a populated, fresh flock', () => {
    for (let i = 0; i < 20; i++) Flock.tick();
    expect(typeof Flock.reset).toBe('function');
    const before = Flock.getFlockState().boids.map((b) => ({ x: b.x, y: b.y }));
    const s = Flock.reset();
    expect(s.frameCount).toBe(0);
    expect(s.boids.length).toBeGreaterThanOrEqual(12);
    // Positions should be re-seeded (not identical to the pre-reset snapshot).
    const changed = s.boids.some((b, i) => !before[i] || b.x !== before[i].x || b.y !== before[i].y);
    expect(changed).toBe(true);
  });

  test('exposes init/start/stop aliases', () => {
    expect(typeof Flock.init).toBe('function');
    expect(typeof Flock.start).toBe('function');
    expect(typeof Flock.stop).toBe('function');
    Flock.start();
    expect(Flock.getFlockState().running).toBe(true);
    Flock.stop();
    expect(Flock.getFlockState().running).toBe(false);
  });

  // Average per-tick boid displacement, measured with edge-wrap accounted for.
  function avgStep(ticks) {
    const w = Flock.CANVAS_WIDTH;
    const h = Flock.CANVAS_HEIGHT;
    let prev = Flock.getFlockState().boids.map((b) => ({ x: b.x, y: b.y }));
    let total = 0;
    let count = 0;
    for (let t = 0; t < ticks; t++) {
      Flock.tick();
      const cur = Flock.getFlockState().boids;
      for (let i = 0; i < cur.length; i++) {
        let dx = Math.abs(cur[i].x - prev[i].x);
        let dy = Math.abs(cur[i].y - prev[i].y);
        dx = Math.min(dx, w - dx);
        dy = Math.min(dy, h - dy);
        total += Math.sqrt(dx * dx + dy * dy);
        count++;
      }
      prev = cur.map((b) => ({ x: b.x, y: b.y }));
    }
    return total / count;
  }

  test('setSpeed makes the boids fly faster (effect persists across reset)', () => {
    Flock.setSpeed(0.5);
    Flock.reset();
    const slow = avgStep(25);
    Flock.setSpeed(6);
    Flock.reset();
    const fast = avgStep(25);
    expect(fast).toBeGreaterThan(slow);
  });

  test('setSpeed applied after reset still takes effect', () => {
    Flock.reset();
    Flock.setSpeed(0.5);
    const slow = avgStep(25);
    Flock.setSpeed(6);
    const fast = avgStep(25);
    expect(fast).toBeGreaterThan(slow);
  });
});

describe('count control', () => {
  test('setBoidCount updates count and boid array', () => {
    Flock.setBoidCount(30);
    const s = Flock.getFlockState();
    expect(s.count).toBe(30);
    expect(s.boids.length).toBe(30);
  });

  test('clamps above MAX_COUNT', () => {
    Flock.setBoidCount(Flock.MAX_COUNT + 50);
    expect(Flock.getFlockState().count).toBe(Flock.MAX_COUNT);
  });

  test('clamps below MIN_COUNT', () => {
    Flock.setBoidCount(1);
    expect(Flock.getFlockState().count).toBe(Flock.MIN_COUNT);
  });

  test('invalid input does not throw and yields valid count', () => {
    expect(() => Flock.setBoidCount('abc')).not.toThrow();
    const c = Flock.getFlockState().count;
    expect(c).toBeGreaterThanOrEqual(Flock.MIN_COUNT);
    expect(c).toBeLessThanOrEqual(Flock.MAX_COUNT);
  });
});

describe('speed control', () => {
  test('setSpeed updates speed', () => {
    Flock.setSpeed(5);
    expect(Flock.getFlockState().speed).toBe(5);
  });

  test('clamps above MAX_SPEED', () => {
    Flock.setSpeed(99);
    expect(Flock.getFlockState().speed).toBe(Flock.MAX_SPEED);
  });

  test('clamps below MIN_SPEED', () => {
    Flock.setSpeed(0);
    expect(Flock.getFlockState().speed).toBe(Flock.MIN_SPEED);
  });

  test('velocity clamp holds after tick', () => {
    Flock.setSpeed(3);
    Flock.tick();
    const s = Flock.getFlockState();
    s.boids.forEach((b) => {
      const mag = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      expect(mag).toBeLessThanOrEqual(s.speed + 1e-6);
    });
  });
});

describe('edge wrap', () => {
  test('boids stay within bounds after tick past an edge', () => {
    Flock.setBoidCount(Flock.MIN_COUNT);
    const s = Flock.getFlockState();
    // Force a boid just inside the right/bottom edge moving outward.
    s.boids[0].x = s.width - 1;
    s.boids[0].y = s.height - 1;
    s.boids[0].vx = 50;
    s.boids[0].vy = 50;
    Flock.tick();
    const b = Flock.getFlockState().boids[0];
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x).toBeLessThan(s.width);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeLessThan(s.height);
  });
});

describe('lifecycle cleanup', () => {
  test('startFlock sets running true', () => {
    Flock.startFlock();
    expect(Flock.getFlockState().running).toBe(true);
  });

  test('startFlock is idempotent and cancels previous frame', () => {
    const cancelSpy = jest.spyOn(global, 'cancelAnimationFrame');
    Flock.startFlock();
    Flock.startFlock();
    expect(cancelSpy).toHaveBeenCalled();
    expect(Flock.getFlockState().running).toBe(true);
    cancelSpy.mockRestore();
  });

  test('stopFlock sets running false', () => {
    Flock.startFlock();
    Flock.stopFlock();
    expect(Flock.getFlockState().running).toBe(false);
  });

  test('stopFlock before start is a safe no-op', () => {
    expect(() => Flock.stopFlock()).not.toThrow();
    expect(Flock.getFlockState().running).toBe(false);
  });
});

describe('setPredator / clearPredator', () => {
  test('setPredator stores finite coords', () => {
    Flock.setPredator(10, 20);
    expect(Flock.getFlockState().predator).toEqual({ x: 10, y: 20 });
  });

  test('setPredator ignores non-finite input', () => {
    Flock.clearPredator();
    Flock.setPredator(NaN, 5);
    expect(Flock.getFlockState().predator).toBeNull();
  });

  test('clearPredator nulls predator', () => {
    Flock.setPredator(1, 2);
    Flock.clearPredator();
    expect(Flock.getFlockState().predator).toBeNull();
  });
});

function minPairwiseDistance(boids) {
  let min = Infinity;
  for (let i = 0; i < boids.length; i++) {
    for (let k = i + 1; k < boids.length; k++) {
      const dx = boids[i].x - boids[k].x;
      const dy = boids[i].y - boids[k].y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < min) min = d;
    }
  }
  return min;
}

describe('no overlap', () => {
  test('spawns boids at least MIN_DISTANCE apart', () => {
    const boids = Flock.getFlockState().boids;
    expect(minPairwiseDistance(boids)).toBeGreaterThanOrEqual(Flock.MIN_DISTANCE - 1);
  });

  test('resolveCollisions separates two overlapping boids', () => {
    Flock.setBoidCount(Flock.MIN_COUNT);
    const boids = Flock.getFlockState().boids;
    boids[0].x = 100; boids[0].y = 100;
    boids[1].x = 100; boids[1].y = 100;
    Flock.resolveCollisions();
    const dx = boids[0].x - boids[1].x;
    const dy = boids[0].y - boids[1].y;
    expect(Math.sqrt(dx * dx + dy * dy)).toBeGreaterThanOrEqual(Flock.MIN_DISTANCE * 0.9);
  });

  test('no pair overlaps after a tick', () => {
    Flock.setBoidCount(Flock.MIN_COUNT);
    for (let i = 0; i < 5; i++) Flock.tick();
    const boids = Flock.getFlockState().boids;
    expect(minPairwiseDistance(boids)).toBeGreaterThanOrEqual(Flock.MIN_DISTANCE * 0.9);
  });

  test('boids stay in bounds after collision resolution', () => {
    Flock.setBoidCount(Flock.MIN_COUNT);
    const state = Flock.getFlockState();
    state.boids[0].x = state.width - 1; state.boids[0].y = state.height - 1;
    state.boids[1].x = state.width - 1; state.boids[1].y = state.height - 1;
    Flock.resolveCollisions();
    state.boids.forEach((b) => {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x).toBeLessThan(state.width);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeLessThan(state.height);
    });
  });
});

describe('strict non-overlap guarantee', () => {
  test('two coincident boids end up >= MIN_DISTANCE apart', () => {
    Flock.setBoidCount(Flock.MIN_COUNT);
    const boids = Flock.getFlockState().boids;
    boids[0].x = 200; boids[0].y = 150;
    boids[1].x = 200; boids[1].y = 150;
    Flock.resolveCollisions();
    const dx = boids[0].x - boids[1].x;
    const dy = boids[0].y - boids[1].y;
    expect(Math.sqrt(dx * dx + dy * dy)).toBeGreaterThanOrEqual(Flock.MIN_DISTANCE);
  });

  test('a tight clump spreads to >= MIN_DISTANCE', () => {
    Flock.setBoidCount(20);
    const boids = Flock.getFlockState().boids;
    boids.forEach((b) => { b.x = 240 + Math.random(); b.y = 200 + Math.random(); });
    Flock.resolveCollisions();
    expect(minPairwiseDistance(boids)).toBeGreaterThanOrEqual(Flock.MIN_DISTANCE);
  });

  test('default-count run stays >= MIN_DISTANCE after many ticks', () => {
    Flock.setBoidCount(Flock.DEFAULT_COUNT);
    for (let i = 0; i < 150; i++) Flock.tick();
    const boids = Flock.getFlockState().boids;
    expect(minPairwiseDistance(boids)).toBeGreaterThanOrEqual(Flock.MIN_DISTANCE);
  });

  test('MAX_COUNT-packed run stays >= MIN_DISTANCE after many ticks', () => {
    Flock.setBoidCount(Flock.MAX_COUNT);
    for (let i = 0; i < 150; i++) Flock.tick();
    const boids = Flock.getFlockState().boids;
    expect(boids.length).toBe(Flock.MAX_COUNT);
    expect(minPairwiseDistance(boids)).toBeGreaterThanOrEqual(Flock.MIN_DISTANCE);
  });
});

describe('higher boid cap', () => {
  test('MAX_COUNT exceeds 80', () => {
    expect(Flock.MAX_COUNT).toBeGreaterThan(80);
  });

  test('setBoidCount(81) yields more than 80 boids', () => {
    Flock.setBoidCount(81);
    const state = Flock.getFlockState();
    expect(state.count).toBeGreaterThan(80);
    expect(state.boids.length).toBeGreaterThan(80);
  });
});

describe('addBoids', () => {
  test('appends the requested number of boids', () => {
    Flock.setBoidCount(20);
    Flock.addBoids(10);
    const state = Flock.getFlockState();
    expect(state.count).toBe(30);
    expect(state.boids.length).toBe(30);
  });

  test('does not exceed MAX_COUNT', () => {
    Flock.setBoidCount(Flock.MAX_COUNT);
    Flock.addBoids(50);
    expect(Flock.getFlockState().count).toBe(Flock.MAX_COUNT);
  });

  test('preserves existing boids when appending', () => {
    Flock.setBoidCount(20);
    const first = Flock.getFlockState().boids[0];
    const x = first.x, y = first.y;
    Flock.addBoids(5);
    const state = Flock.getFlockState();
    expect(state.boids.length).toBe(25);
    expect(state.boids[0].x).toBe(x);
    expect(state.boids[0].y).toBe(y);
  });

  test('invalid/zero input adds a default positive number, never throws', () => {
    Flock.setBoidCount(20);
    expect(() => Flock.addBoids('abc')).not.toThrow();
    let count = Flock.getFlockState().count;
    expect(count).toBeGreaterThan(20);
    expect(count).toBeLessThanOrEqual(Flock.MAX_COUNT);
    Flock.addBoids(0);
    expect(Flock.getFlockState().count).toBeGreaterThan(count);
  });

  test('appended boids are within bounds', () => {
    Flock.setBoidCount(20);
    Flock.addBoids(10);
    const state = Flock.getFlockState();
    state.boids.forEach((b) => {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x).toBeLessThan(state.width);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeLessThan(state.height);
    });
  });
});

describe('index.html markup', () => {
  beforeEach(() => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    document.body.innerHTML = html;
  });

  test('Flock tab lives inside the Extras dropdown, not the main nav', () => {
    const tab = document.getElementById('tab-flock');
    expect(tab).not.toBeNull();
    const menu = document.getElementById('games-menu-list');
    expect(menu.contains(tab)).toBe(true);
    const nav = document.querySelector('nav.tab-nav');
    expect(nav.contains(tab)).toBe(false);
  });

  test('Flock tab has expected attributes', () => {
    const tab = document.getElementById('tab-flock');
    expect(tab.getAttribute('data-tab')).toBe('flock');
    expect(tab.getAttribute('role')).toBe('tab');
    expect(tab.getAttribute('aria-controls')).toBe('panel-flock');
    expect(tab.textContent).toContain('Flock');
  });

  test('main nav still has exactly 5 tabs', () => {
    const navTabs = document.querySelectorAll('nav.tab-nav .tab-btn');
    expect(navTabs.length).toBe(5);
  });

  test('Flock panel and controls exist', () => {
    expect(document.getElementById('panel-flock')).not.toBeNull();
    expect(document.getElementById('flock-canvas')).not.toBeNull();
    expect(document.getElementById('flock-count')).not.toBeNull();
    expect(document.getElementById('flock-speed')).not.toBeNull();
    expect(document.getElementById('flock-reset-btn')).not.toBeNull();
  });

  test('Flock has an Add Boids button', () => {
    expect(document.getElementById('flock-add-btn')).not.toBeNull();
  });

  test('flock-count slider max exceeds 80 and equals MAX_COUNT', () => {
    const slider = document.getElementById('flock-count');
    const max = Number(slider.getAttribute('max'));
    expect(max).toBeGreaterThan(80);
    expect(max).toBe(Flock.MAX_COUNT);
  });
});
