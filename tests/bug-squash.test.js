/**
 * @jest-environment jsdom
 */

let BugSquash;
let canvas;

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 300;
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
  BugSquash = require('../js/bug-squash.js');
  BugSquash.initAnim(canvas);
});

afterEach(() => {
  BugSquash.stopAnim();
  jest.useRealTimers();
});

describe('bug-squash initialization', () => {
  test('initAnim returns initial state with chase-ready positions', () => {
    const state = BugSquash.getAnimState();
    expect(state).toBeDefined();
    expect(state.phase).toBe('idle');
    expect(state.foreman).toBeDefined();
    expect(state.bug).toBeDefined();
    expect(state.bug.alive).toBe(true);
  });

  test('foreman starts on the left side', () => {
    const state = BugSquash.getAnimState();
    expect(state.foreman.x).toBeLessThan(canvas.width / 2);
  });

  test('bug starts on the right side', () => {
    const state = BugSquash.getAnimState();
    expect(state.bug.x).toBeGreaterThan(canvas.width / 3);
  });
});

describe('startAnim / stopAnim lifecycle', () => {
  test('startAnim sets phase to chase', () => {
    BugSquash.startAnim();
    const state = BugSquash.getAnimState();
    expect(state.phase).toBe('chase');
  });

  test('startAnim is idempotent — calling twice does not create duplicate loops', () => {
    const cancelSpy = jest.spyOn(global, 'cancelAnimationFrame');
    BugSquash.startAnim();
    BugSquash.startAnim();
    // Second call should have cancelled the first frame
    expect(cancelSpy).toHaveBeenCalled();
    cancelSpy.mockRestore();
  });

  test('stopAnim cancels animation frame', () => {
    const cancelSpy = jest.spyOn(global, 'cancelAnimationFrame');
    BugSquash.startAnim();
    BugSquash.stopAnim();
    expect(cancelSpy).toHaveBeenCalled();
    cancelSpy.mockRestore();
  });

  test('stopAnim is safe to call when not running', () => {
    expect(() => BugSquash.stopAnim()).not.toThrow();
  });
});

describe('tick advances state', () => {
  test('tick in chase phase moves foreman toward bug', () => {
    BugSquash.startAnim();
    const before = BugSquash.getAnimState().foreman.x;
    BugSquash.tick();
    const after = BugSquash.getAnimState().foreman.x;
    // Foreman should move right (bug is to the right)
    expect(after).toBeGreaterThanOrEqual(before);
  });

  test('foreman eventually reaches bug and transitions to squash', () => {
    BugSquash.startAnim();
    // Run many ticks to force convergence
    for (let i = 0; i < 500; i++) {
      BugSquash.tick();
      const state = BugSquash.getAnimState();
      if (state.phase === 'squash') break;
    }
    const state = BugSquash.getAnimState();
    expect(state.phase).toBe('squash');
    expect(state.bug.alive).toBe(false);
  });

  test('full cycle returns to chase phase with new bug', () => {
    BugSquash.startAnim();
    for (let i = 0; i < 1000; i++) {
      BugSquash.tick();
      const state = BugSquash.getAnimState();
      if (state.phase === 'chase' && i > 100) break;
    }
    const state = BugSquash.getAnimState();
    expect(state.phase).toBe('chase');
    expect(state.bug.alive).toBe(true);
  });
});
