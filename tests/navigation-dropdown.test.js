/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const styleCss = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');

// ---------------------------------------------------------------------------
// Structure tests (parse index.html directly)
// ---------------------------------------------------------------------------
describe('navigation dropdown — DOM structure', () => {
  beforeEach(() => {
    document.body.innerHTML = indexHtml;
  });

  test('main .tab-nav contains exactly pipeline, harness, profile, users, messages buttons', () => {
    const nav = document.querySelector('nav.tab-nav');
    expect(nav).not.toBeNull();
    const ids = Array.from(nav.querySelectorAll(':scope > .tab-btn')).map((b) => b.id);
    expect(ids).toEqual(['tab-pipeline', 'tab-harness', 'tab-profile', 'tab-users', 'tab-messages']);
  });

  test('games menu toggle and list exist', () => {
    expect(document.getElementById('games-menu')).not.toBeNull();
    expect(document.getElementById('games-menu-toggle')).not.toBeNull();
    expect(document.getElementById('games-menu-list')).not.toBeNull();
  });

  test('moved game buttons live inside the dropdown list', () => {
    const list = document.getElementById('games-menu-list');
    expect(list.querySelector('#tab-game')).not.toBeNull();
    expect(list.querySelector('#tab-bug-squash')).not.toBeNull();
    expect(list.querySelector('#tab-snake')).not.toBeNull();
  });

  test('moved buttons keep .tab-btn class, role="tab", data-tab and aria-controls', () => {
    [
      { id: 'tab-game', tab: 'game', panel: 'panel-game' },
      { id: 'tab-bug-squash', tab: 'bug-squash', panel: 'panel-bug-squash' },
      { id: 'tab-snake', tab: 'snake', panel: 'panel-snake' },
    ].forEach(({ id, tab, panel }) => {
      const btn = document.getElementById(id);
      expect(btn).not.toBeNull();
      expect(btn.classList.contains('tab-btn')).toBe(true);
      expect(btn.getAttribute('role')).toBe('tab');
      expect(btn.getAttribute('data-tab')).toBe(tab);
      expect(btn.getAttribute('aria-controls')).toBe(panel);
    });
  });

  test('moved buttons keep their visible labels', () => {
    expect(document.getElementById('tab-game').textContent).toContain('Game');
    expect(document.getElementById('tab-bug-squash').textContent).toContain('Bug Squash');
    expect(document.getElementById('tab-snake').textContent).toContain('Snake');
  });

  test('moved buttons are NOT direct children of .tab-nav', () => {
    const nav = document.querySelector('nav.tab-nav');
    const directIds = Array.from(nav.querySelectorAll(':scope > .tab-btn')).map((b) => b.id);
    expect(directIds).not.toContain('tab-game');
    expect(directIds).not.toContain('tab-bug-squash');
    expect(directIds).not.toContain('tab-snake');
  });

  test('original game panels still exist', () => {
    expect(document.getElementById('panel-game')).not.toBeNull();
    expect(document.getElementById('panel-bug-squash')).not.toBeNull();
    expect(document.getElementById('panel-snake')).not.toBeNull();
  });

  test('dropdown list is hidden by default in markup', () => {
    const list = document.getElementById('games-menu-list');
    expect(list.hasAttribute('hidden')).toBe(true);
  });

  test('toggle starts with aria-expanded="false"', () => {
    const toggle = document.getElementById('games-menu-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  test('dropdown toggle button text is "Extras ▾" and has no game emoji', () => {
    const toggle = document.getElementById('games-menu-toggle');
    expect(toggle.textContent.trim()).toBe('Extras ▾');
    expect(toggle.textContent).not.toContain('🎮');
  });

  test('dropdown toggle button aria-label is updated to "Open extras menu"', () => {
    const toggle = document.getElementById('games-menu-toggle');
    expect(toggle.getAttribute('aria-label')).toBe('Open extras menu');
  });
});

// ---------------------------------------------------------------------------
// CSS tests
// ---------------------------------------------------------------------------
describe('navigation dropdown — CSS', () => {
  test('header rule includes position: relative', () => {
    const headerIdx = styleCss.indexOf('header {');
    expect(headerIdx).toBeGreaterThan(-1);
    const headerBlock = styleCss.substring(headerIdx, styleCss.indexOf('}', headerIdx));
    expect(headerBlock).toContain('position: relative');
  });

  test('.games-menu is absolutely positioned in the top-right', () => {
    const idx = styleCss.indexOf('.games-menu {');
    expect(idx).toBeGreaterThan(-1);
    const block = styleCss.substring(idx, styleCss.indexOf('}', idx));
    expect(block).toContain('position: absolute');
    expect(block).toContain('top: 0');
    expect(block).toContain('right: 0');
  });

  test('.games-menu-list and its hidden selector exist', () => {
    expect(styleCss).toContain('.games-menu-list {');
    expect(styleCss).toContain('.games-menu-list[hidden]');
  });

  test('.games-menu-list .tab-btn is full-width and left-aligned', () => {
    const idx = styleCss.indexOf('.games-menu-list .tab-btn {');
    expect(idx).toBeGreaterThan(-1);
    const block = styleCss.substring(idx, styleCss.indexOf('}', idx));
    expect(block).toContain('width: 100%');
    expect(block).toContain('text-align: left');
  });

  test('professional theme overrides exist for the dropdown', () => {
    expect(styleCss).toContain('body.theme-professional .games-menu-toggle');
    expect(styleCss).toContain('body.theme-professional .games-menu-list');
  });

  test('existing body.theme-professional .tab-btn block is preserved', () => {
    expect(styleCss).toContain('body.theme-professional .tab-btn {');
  });
});

// ---------------------------------------------------------------------------
// Interaction tests (load full app.js, drive DOMContentLoaded)
// ---------------------------------------------------------------------------
function stubCanvas() {
  const ctx = {
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
    save: jest.fn(),
    restore: jest.fn(),
    translate: jest.fn(),
    rotate: jest.fn(),
    scale: jest.fn(),
    drawImage: jest.fn(),
    set fillStyle(v) {},
    set strokeStyle(v) {},
    set lineWidth(v) {},
    set font(v) {},
    set textAlign(v) {},
  };
  HTMLCanvasElement.prototype.getContext = () => ctx;
}

function loadAppWithFullDom() {
  jest.resetModules();
  document.body.innerHTML = indexHtml;
  stubCanvas();

  global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  global.cancelAnimationFrame = (id) => clearTimeout(id);

  window.ForemanGame = { initGame: jest.fn(), stopGame: jest.fn() };
  window.BugSquashAnim = { initAnim: jest.fn(), startAnim: jest.fn(), stopAnim: jest.fn() };
  window.ForemanSnake = { initSnake: jest.fn(), stopSnake: jest.fn() };
  window.ForemanHarness = { renderHarness: jest.fn() };
  window.ForemanProfileUI = { renderProfile: jest.fn(), renderUsers: jest.fn() };

  // Track document-level listeners added during this load so they can be
  // cleaned up afterwards — the shared jsdom `document` persists across tests
  // and accumulated DOMContentLoaded listeners would otherwise stack up.
  const originalAdd = document.addEventListener.bind(document);
  const added = [];
  document.addEventListener = (type, fn, opts) => {
    added.push({ type, fn, opts });
    return originalAdd(type, fn, opts);
  };

  require('../js/app');
  document.dispatchEvent(new Event('DOMContentLoaded'));

  // Restore and return a cleanup function
  document.addEventListener = originalAdd;
  return () => added.forEach(({ type, fn, opts }) => document.removeEventListener(type, fn, opts));
}

describe('navigation dropdown — interaction', () => {
  let cleanupListeners = () => {};

  function loadApp() {
    cleanupListeners = loadAppWithFullDom();
  }

  afterEach(() => {
    cleanupListeners();
    cleanupListeners = () => {};
    delete window.ForemanGame;
    delete window.BugSquashAnim;
    delete window.ForemanSnake;
    delete window.ForemanHarness;
    delete window.ForemanProfileUI;
  });

  test('clicking toggle opens the dropdown', () => {
    loadApp();
    const toggle = document.getElementById('games-menu-toggle');
    const list = document.getElementById('games-menu-list');
    const menu = document.getElementById('games-menu');

    toggle.click();

    expect(menu.classList.contains('open')).toBe(true);
    expect(list.hidden).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  test('selecting a dropdown item activates its panel and closes the menu', () => {
    loadApp();
    const toggle = document.getElementById('games-menu-toggle');
    const list = document.getElementById('games-menu-list');

    toggle.click();
    document.getElementById('tab-bug-squash').click();

    expect(document.getElementById('panel-bug-squash').classList.contains('active')).toBe(true);
    expect(list.hidden).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(window.BugSquashAnim.initAnim).toHaveBeenCalled();
    expect(window.BugSquashAnim.startAnim).toHaveBeenCalled();
    // Other games are stopped
    expect(window.ForemanGame.stopGame).toHaveBeenCalled();
    expect(window.ForemanSnake.stopSnake).toHaveBeenCalled();
  });

  test('repeated toggle clicks open then close cleanly', () => {
    loadApp();
    const toggle = document.getElementById('games-menu-toggle');
    const menu = document.getElementById('games-menu');

    toggle.click();
    expect(menu.classList.contains('open')).toBe(true);
    toggle.click();
    expect(menu.classList.contains('open')).toBe(false);
    toggle.click();
    expect(menu.classList.contains('open')).toBe(true);
  });

  test('clicking outside closes an open dropdown', () => {
    loadApp();
    const toggle = document.getElementById('games-menu-toggle');
    const menu = document.getElementById('games-menu');

    toggle.click();
    expect(menu.classList.contains('open')).toBe(true);

    document.body.click();
    expect(menu.classList.contains('open')).toBe(false);
    expect(document.getElementById('games-menu-list').hidden).toBe(true);
  });

  test('pressing Escape closes an open dropdown', () => {
    loadApp();
    const toggle = document.getElementById('games-menu-toggle');
    const menu = document.getElementById('games-menu');

    toggle.click();
    expect(menu.classList.contains('open')).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(menu.classList.contains('open')).toBe(false);
  });

  test('rapid sequential item clicks keep the menu closed and panels correct', () => {
    loadApp();
    const toggle = document.getElementById('games-menu-toggle');
    const menu = document.getElementById('games-menu');

    toggle.click();
    document.getElementById('tab-game').click();
    toggle.click();
    document.getElementById('tab-snake').click();

    expect(menu.classList.contains('open')).toBe(false);
    expect(document.getElementById('panel-snake').classList.contains('active')).toBe(true);
  });

  test('clicking the games toggle does NOT change the active theme (regression)', () => {
    loadApp();

    // Switch to a non-dark theme via a real theme control.
    const lightBtn = document.querySelector('.theme-btn[data-theme="light"]');
    expect(lightBtn).not.toBeNull();
    lightBtn.click();
    expect(document.body.classList.contains('theme-light')).toBe(true);

    // Clicking the games dropdown toggle must not run the theme logic.
    const toggle = document.getElementById('games-menu-toggle');
    toggle.click();

    // Theme is unchanged: still light, not reset to dark.
    expect(document.body.classList.contains('theme-light')).toBe(true);
    expect(document.body.classList.contains('theme-colorful')).toBe(false);
    expect(document.body.classList.contains('theme-professional')).toBe(false);

    // The toggle is not treated as a theme control.
    expect(toggle.classList.contains('theme-btn')).toBe(false);
    expect(toggle.hasAttribute('data-theme')).toBe(false);
    // Real theme button state still reflects the chosen theme.
    expect(lightBtn.classList.contains('active')).toBe(true);
    expect(lightBtn.getAttribute('aria-pressed')).toBe('true');
  });

  test('missing dropdown markup is a safe no-op', () => {
    jest.resetModules();
    document.body.innerHTML = `
      <nav class="tab-nav" role="tablist">
        <button class="tab-btn active" data-tab="pipeline" id="tab-pipeline" aria-controls="panel-pipeline">Pipeline</button>
      </nav>
      <main>
        <div id="agent-detail"></div>
        <div id="pipeline"></div>
        <div id="panel-pipeline" class="tab-panel active"></div>
      </main>
    `;
    require('../js/app');
    expect(() => {
      document.dispatchEvent(new Event('DOMContentLoaded'));
    }).not.toThrow();
  });
});
