/**
 * @jest-environment jsdom
 */

let Snake;

function createMockCanvas() {
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
    roundRect: jest.fn(),
    set fillStyle(v) {},
    set strokeStyle(v) {},
    set lineWidth(v) {},
    set font(v) {},
    set textAlign(v) {},
    set textBaseline(v) {},
    set globalAlpha(v) {},
  });
  return canvas;
}

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  document.body.className = '';
  document.body.innerHTML = '<div id="panel-snake" class="tab-panel active"></div><span id="snake-score"></span><ol id="snake-leaderboard-list"></ol>';
  localStorage.clear();
  Snake = require('../js/snake.js');
  Snake.initSnake(createMockCanvas());
});

afterEach(() => {
  jest.useRealTimers();
  if (Snake) Snake.stopSnake();
});

describe('Snake initialization', () => {
  test('initSnake returns state with snake length 3, direction right, score 0, not active, not gameOver', () => {
    const state = Snake.getSnakeState();
    expect(state.snake).toHaveLength(3);
    expect(state.direction).toBe('right');
    expect(state.score).toBe(0);
    expect(state.active).toBe(false);
    expect(state.gameOver).toBe(false);
  });

  test('food position is within grid bounds', () => {
    const state = Snake.getSnakeState();
    const cols = Math.floor(480 / Snake.CELL_SIZE);
    const rows = Math.floor(400 / Snake.CELL_SIZE);
    expect(state.food.x).toBeGreaterThanOrEqual(0);
    expect(state.food.x).toBeLessThan(cols);
    expect(state.food.y).toBeGreaterThanOrEqual(0);
    expect(state.food.y).toBeLessThan(rows);
  });
});

describe('setDirection', () => {
  test('can change direction to up from right', () => {
    Snake.setDirection('up');
    const state = Snake.getSnakeState();
    expect(state.nextDirection).toBe('up');
  });

  test('cannot reverse to left from right (180° blocked)', () => {
    Snake.setDirection('left');
    const state = Snake.getSnakeState();
    expect(state.nextDirection).toBe('right');
  });

  test('can change direction to down from right', () => {
    Snake.setDirection('down');
    const state = Snake.getSnakeState();
    expect(state.nextDirection).toBe('down');
  });
});

describe('tick — movement', () => {
  test('after one tick, head moves one cell in current direction', () => {
    Snake.startSnake();
    const stateBefore = Snake.getSnakeState();
    const headXBefore = stateBefore.snake[0].x;
    Snake.tick();
    const stateAfter = Snake.getSnakeState();
    expect(stateAfter.snake[0].x).toBe(headXBefore + 1);
  });

  test('snake length stays same when no food eaten', () => {
    Snake.startSnake();
    const state = Snake.getSnakeState();
    // Move food far away
    state.food = { x: 0, y: 0 };
    // Position snake away from food
    state.snake[0].x = 10;
    state.snake[0].y = 10;
    state.snake[1].x = 9;
    state.snake[1].y = 10;
    state.snake[2].x = 8;
    state.snake[2].y = 10;
    const lenBefore = state.snake.length;
    Snake.tick();
    expect(Snake.getSnakeState().snake.length).toBe(lenBefore);
  });
});

describe('tick — eating food', () => {
  test('eating food increases snake length and score', () => {
    Snake.startSnake();
    const state = Snake.getSnakeState();
    // Place food at head's next position
    const head = state.snake[0];
    state.food = { x: head.x + 1, y: head.y };
    const lenBefore = state.snake.length;
    Snake.tick();
    expect(Snake.getSnakeState().snake.length).toBe(lenBefore + 1);
    expect(Snake.getSnakeState().score).toBe(1);
  });

  test('new segment has correct label from STAGE_LABELS cycle', () => {
    Snake.startSnake();
    const state = Snake.getSnakeState();
    const head = state.snake[0];
    state.food = { x: head.x + 1, y: head.y };
    Snake.tick();
    // The new head gets label based on snake.length % STAGE_LABELS.length at time of creation
    const newHead = Snake.getSnakeState().snake[0];
    expect(Snake.STAGE_LABELS).toContain(newHead.label);
  });
});

describe('tick — wall collision', () => {
  test('hitting right wall causes game over', () => {
    Snake.startSnake();
    const state = Snake.getSnakeState();
    const cols = Math.floor(480 / Snake.CELL_SIZE);
    // Set head at right edge
    state.snake[0].x = cols - 1;
    state.snake[0].y = 10;
    state.snake[1].x = cols - 2;
    state.snake[1].y = 10;
    state.snake[2].x = cols - 3;
    state.snake[2].y = 10;
    state.direction = 'right';
    state.nextDirection = 'right';
    Snake.tick();
    expect(Snake.getSnakeState().gameOver).toBe(true);
  });
});

describe('tick — self collision', () => {
  test('colliding with self causes game over', () => {
    Snake.startSnake();
    const state = Snake.getSnakeState();
    // Create a snake that will collide with itself
    state.snake = [
      { x: 5, y: 5, label: 'R', colorIdx: 0 },
      { x: 6, y: 5, label: 'P', colorIdx: 1 },
      { x: 6, y: 6, label: 'V', colorIdx: 2 },
      { x: 5, y: 6, label: 'I', colorIdx: 3 },
      { x: 4, y: 6, label: 'V', colorIdx: 4 },
      { x: 4, y: 5, label: 'PR', colorIdx: 5 },
    ];
    state.direction = 'left';
    state.nextDirection = 'left';
    // Head at (5,5) moving left goes to (4,5) which is occupied by last segment
    Snake.tick();
    expect(Snake.getSnakeState().gameOver).toBe(true);
  });
});

describe('game over cleanup', () => {
  test('game over sets active to false', () => {
    Snake.startSnake();
    const state = Snake.getSnakeState();
    const cols = Math.floor(480 / Snake.CELL_SIZE);
    state.snake[0].x = cols - 1;
    state.snake[1].x = cols - 2;
    state.snake[2].x = cols - 3;
    state.direction = 'right';
    state.nextDirection = 'right';
    Snake.tick();
    expect(Snake.getSnakeState().active).toBe(false);
  });

  test('tick no longer advances after game over', () => {
    Snake.startSnake();
    const state = Snake.getSnakeState();
    const cols = Math.floor(480 / Snake.CELL_SIZE);
    state.snake[0].x = cols - 1;
    state.snake[0].y = 10;
    state.snake[1].x = cols - 2;
    state.snake[1].y = 10;
    state.snake[2].x = cols - 3;
    state.snake[2].y = 10;
    state.direction = 'right';
    state.nextDirection = 'right';
    Snake.tick();
    expect(Snake.getSnakeState().gameOver).toBe(true);
    const headAfterGameOver = Snake.getSnakeState().snake[0].x;
    Snake.tick();
    expect(Snake.getSnakeState().snake[0].x).toBe(headAfterGameOver);
  });
});

describe('startSnake idempotency', () => {
  test('calling startSnake twice does not cause double-speed', () => {
    Snake.startSnake();
    Snake.startSnake();
    const state = Snake.getSnakeState();
    expect(state.active).toBe(true);
    expect(state.snake.length).toBe(3);
    expect(state.score).toBe(0);
  });
});

describe('stopSnake cleanup', () => {
  test('stopSnake sets active to false', () => {
    Snake.startSnake();
    Snake.stopSnake();
    expect(Snake.getSnakeState().active).toBe(false);
  });
});

describe('leaderboard — save and load', () => {
  test('game over saves to localStorage', () => {
    Snake.startSnake();
    const state = Snake.getSnakeState();
    state.score = 5;
    // Trigger game over via wall collision
    const cols = Math.floor(480 / Snake.CELL_SIZE);
    state.snake[0].x = cols - 1;
    state.snake[0].y = 10;
    state.snake[1].x = cols - 2;
    state.snake[1].y = 10;
    state.snake[2].x = cols - 3;
    state.snake[2].y = 10;
    state.direction = 'right';
    state.nextDirection = 'right';
    Snake.tick();
    const stored = localStorage.getItem('foreman-snake-scores');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored);
    expect(parsed[0].score).toBe(5);
  });
});

describe('leaderboard — invalid localStorage data', () => {
  test('invalid JSON defaults to empty leaderboard', () => {
    localStorage.setItem('foreman-snake-scores', 'not valid json{{{');
    Snake.initSnake(createMockCanvas());
    expect(Snake.getLeaderboard()).toEqual([]);
  });
});

describe('leaderboard — max 10 entries', () => {
  test('keeps only top 10 entries', () => {
    // Pre-fill with 10 entries
    const entries = [];
    for (var i = 0; i < 10; i++) {
      entries.push({ score: i + 1, time: 10, chain: 3 });
    }
    localStorage.setItem('foreman-snake-scores', JSON.stringify(entries));
    Snake.initSnake(createMockCanvas());

    // Trigger game over with higher score
    Snake.startSnake();
    const state = Snake.getSnakeState();
    state.score = 100;
    const cols = Math.floor(480 / Snake.CELL_SIZE);
    state.snake[0].x = cols - 1;
    state.snake[0].y = 10;
    state.snake[1].x = cols - 2;
    state.snake[1].y = 10;
    state.snake[2].x = cols - 3;
    state.snake[2].y = 10;
    state.direction = 'right';
    state.nextDirection = 'right';
    Snake.tick();

    expect(Snake.getLeaderboard().length).toBe(10);
    expect(Snake.getLeaderboard()[0].score).toBe(100);
  });
});

describe('getFont theme awareness', () => {
  test('default theme returns Press Start 2P font', () => {
    document.body.className = '';
    const font = Snake.getFont(12);
    expect(font).toContain('Press Start 2P');
  });

  test('professional theme returns system font', () => {
    document.body.className = 'theme-professional';
    const font = Snake.getFont(12);
    expect(font).toContain('system-ui');
    expect(font).not.toContain('Press Start 2P');
  });
});

describe('STAGE_LABELS constant', () => {
  test('equals expected pipeline stage labels', () => {
    expect(Snake.STAGE_LABELS).toEqual(['R', 'P', 'V', 'I', 'V', 'PR']);
  });
});

describe('rapid start/stop toggling', () => {
  test('rapid toggling results in consistent state', () => {
    Snake.startSnake();
    Snake.stopSnake();
    Snake.startSnake();
    const state = Snake.getSnakeState();
    expect(state.active).toBe(true);
    expect(state.snake.length).toBe(3);
  });
});

describe('DOM presence test', () => {
  test('snake tab button and panel exist in index.html', () => {
    const fs = require('fs');
    const path = require('path');
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    expect(html).toContain('id="tab-snake"');
    expect(html).toContain('id="panel-snake"');
    expect(html).toContain('id="snake-canvas"');
    expect(html).toContain('id="snake-start-btn"');
    expect(html).toContain('id="snake-leaderboard"');
    expect(html).toContain('js/snake.js');
  });
});

describe('CSS theme coverage', () => {
  test('style.css contains snake-specific professional theme rules', () => {
    const fs = require('fs');
    const path = require('path');
    const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
    expect(css).toContain('#snake-canvas');
    expect(css).toContain('.snake-leaderboard');
    expect(css).toContain('body.theme-professional #snake-canvas');
    expect(css).toContain('body.theme-professional .snake-leaderboard h3');
  });
});
