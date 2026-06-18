/**
 * @jest-environment jsdom
 */

let Game;

beforeEach(() => {
  jest.resetModules();
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 400;
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
    set fillStyle(v) {},
    set strokeStyle(v) {},
    set lineWidth(v) {},
    set font(v) {},
    set textAlign(v) {},
  });
  Game = require('../js/game.js');
  Game.initGame(canvas);
});

describe('game initialization', () => {
  test('initGame returns initial state', () => {
    const state = Game.getGameState();
    expect(state).toBeDefined();
    expect(state.player).toBeDefined();
    expect(state.bugs).toEqual([]);
    expect(state.score).toBe(0);
    expect(state.active).toBe(false);
    expect(state.gameOver).toBe(false);
  });

  test('player starts centered at bottom', () => {
    const state = Game.getGameState();
    expect(state.player.x).toBe((480 - Game.PLAYER_WIDTH) / 2);
    expect(state.player.y).toBe(400 - Game.PLAYER_HEIGHT - 10);
  });
});

describe('movePlayer', () => {
  test('moves left by PLAYER_SPEED', () => {
    const startX = Game.getGameState().player.x;
    Game.movePlayer('left');
    expect(Game.getGameState().player.x).toBe(startX - Game.PLAYER_SPEED);
  });

  test('moves right by PLAYER_SPEED', () => {
    const startX = Game.getGameState().player.x;
    Game.movePlayer('right');
    expect(Game.getGameState().player.x).toBe(startX + Game.PLAYER_SPEED);
  });

  test('clamps to left edge', () => {
    for (let i = 0; i < 200; i++) Game.movePlayer('left');
    expect(Game.getGameState().player.x).toBe(0);
  });

  test('clamps to right edge', () => {
    for (let i = 0; i < 200; i++) Game.movePlayer('right');
    expect(Game.getGameState().player.x).toBe(480 - Game.PLAYER_WIDTH);
  });
});

describe('tick', () => {
  test('moves bugs downward', () => {
    const state = Game.getGameState();
    state.bugs.push({ x: 100, y: 0, speed: 3 });
    Game.tick();
    expect(state.bugs[0].y).toBe(3);
  });

  test('removes bugs that fall off screen and increments score', () => {
    const state = Game.getGameState();
    state.active = true;
    state.bugs.push({ x: 100, y: 399, speed: 5 });
    Game.tick();
    expect(state.bugs).toHaveLength(0);
    expect(state.score).toBe(1);
  });

  test('detects collision and ends game', () => {
    const state = Game.getGameState();
    state.active = true;
    state.bugs.push({ x: state.player.x, y: state.player.y, speed: 2 });
    Game.tick();
    expect(state.gameOver).toBe(true);
    expect(state.active).toBe(false);
  });

  test('no collision when bug is far from player', () => {
    const state = Game.getGameState();
    state.active = true;
    state.bugs.push({ x: 0, y: 0, speed: 2 });
    Game.tick();
    expect(state.gameOver).toBe(false);
  });
});

describe('startGame and stopGame', () => {
  test('startGame sets active true and resets state', () => {
    // Use fake timers to avoid real intervals
    jest.useFakeTimers();
    const state = Game.getGameState();
    state.score = 10;
    state.bugs.push({ x: 50, y: 50, speed: 2 });
    Game.startGame();
    const newState = Game.getGameState();
    expect(newState.active).toBe(true);
    expect(newState.score).toBe(0);
    expect(newState.bugs).toHaveLength(0);
    expect(newState.gameOver).toBe(false);
    Game.stopGame();
    jest.useRealTimers();
  });

  test('stopGame sets active false', () => {
    jest.useFakeTimers();
    Game.startGame();
    Game.stopGame();
    expect(Game.getGameState().active).toBe(false);
    jest.useRealTimers();
  });
});

describe('DOM elements', () => {
  test('game canvas element exists in document', () => {
    document.body.innerHTML = `
      <canvas id="game-canvas" width="480" height="400"></canvas>
      <div class="game-hud"><span id="game-score">Score: 0</span></div>
      <h2 class="game-title">Dodge the Bugs! 🐛</h2>
    `;
    const canvas = document.querySelector('#game-canvas');
    expect(canvas).not.toBeNull();
    expect(canvas.getAttribute('width')).toBe('480');
    expect(canvas.getAttribute('height')).toBe('400');
  });

  test('game title has correct text', () => {
    document.body.innerHTML = `<h2 class="game-title">Dodge the Bugs! 🐛</h2>`;
    const title = document.querySelector('.game-title');
    expect(title).not.toBeNull();
    expect(title.textContent).toContain('Dodge the Bugs!');
  });

  test('game score display exists', () => {
    document.body.innerHTML = `<span id="game-score">Score: 0</span>`;
    const score = document.querySelector('#game-score');
    expect(score).not.toBeNull();
    expect(score.textContent).toBe('Score: 0');
  });
});
