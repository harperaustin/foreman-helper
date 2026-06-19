/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

let Harness;

beforeEach(() => {
  jest.resetModules();
  Harness = require('../js/harness.js');
});

describe('Harness module API', () => {
  test('exposes renderHarness function', () => {
    expect(typeof Harness.renderHarness).toBe('function');
  });

  test('HARNESS_ENABLED is true', () => {
    expect(Harness.HARNESS_ENABLED).toBe(true);
  });
});

describe('renderHarness behavior', () => {
  test('renders the Coming Soon screen with expected content', () => {
    const div = document.createElement('div');
    Harness.renderHarness(div);
    expect(div.querySelector('.harness-title').textContent).toContain('Multi-Repo Harness');
    expect(div.querySelector('.harness-subtitle').textContent).toContain('Coming Soon');
    expect(div.querySelector('.harness-hazard').textContent).toContain('🚧');
    expect(div.querySelectorAll('.harness-stripe').length).toBeGreaterThanOrEqual(1);
  });

  test('re-rendering does not duplicate elements (idempotency)', () => {
    const div = document.createElement('div');
    Harness.renderHarness(div);
    Harness.renderHarness(div);
    expect(div.querySelectorAll('.harness-title').length).toBe(1);
    expect(div.querySelectorAll('.harness-hazard').length).toBe(1);
  });

  test('null container does not throw', () => {
    expect(() => Harness.renderHarness(null)).not.toThrow();
  });
});

describe('index.html structure', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

  test('contains harness tab and panel markup', () => {
    expect(html).toContain('id="tab-harness"');
    expect(html).toContain('data-tab="harness"');
    expect(html).toContain('🚧 Harness');
    expect(html).toContain('id="panel-harness"');
    expect(html).toContain('id="harness-container"');
    expect(html).toContain('src="js/harness.js"');
  });

  test('no longer references the dashboard feature', () => {
    expect(html).not.toContain('data-tab="dashboard"');
    expect(html).not.toContain('id="panel-dashboard"');
    expect(html).not.toContain('js/dashboard.js');
  });
});

describe('css/style.css harness rules', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');

  test('default retro harness styles exist', () => {
    expect(css).toMatch(/\.harness-title\s*\{[^}]*'Press Start 2P'/);
    expect(css).toMatch(/\.harness-stripe\s*\{[^}]*repeating-linear-gradient/);
  });

  test('professional theme overrides exist', () => {
    expect(css).toMatch(/body\.theme-professional \.harness-stripe\s*\{\s*display:\s*none/);
    expect(css).toMatch(/body\.theme-professional \.harness-hazard\s*\{\s*display:\s*none/);
    expect(css).toMatch(/body\.theme-professional \.harness-title[\s\S]*?animation:\s*none/);
  });

  test('no dashboard CSS remains', () => {
    expect(css).not.toContain('dashboard');
    expect(css).not.toContain('Dashboard');
  });
});

describe('integration: scripts load together in shared scope', () => {
  test('harness.js and app.js do not collide at top level', () => {
    const harnessSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'harness.js'), 'utf8');
    expect(harnessSrc.trim().startsWith('(function')).toBe(true);
    // Evaluate in a shared global scope to catch redeclaration collisions.
    const vm = require('vm');
    const sandbox = { window: {}, document, module: { exports: {} } };
    sandbox.global = sandbox;
    vm.createContext(sandbox);
    expect(() => vm.runInContext(harnessSrc, sandbox)).not.toThrow();
    expect(typeof sandbox.window.ForemanHarness.renderHarness).toBe('function');
  });
});
