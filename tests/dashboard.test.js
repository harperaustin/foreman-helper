/**
 * @jest-environment jsdom
 */

let Dashboard;

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  document.body.innerHTML = `
    <div class="refresh-bar-container">
      <div class="refresh-countdown"><div class="refresh-countdown-bar"></div></div>
      <span class="refresh-label">Auto-refresh: <span id="refresh-status">paused</span></span>
    </div>
    <div id="dashboard-table-container"></div>
  `;
  Dashboard = require('../js/dashboard.js');
});

afterEach(() => {
  Dashboard.stopAutoRefresh();
  jest.useRealTimers();
});

describe('fetchPipelines', () => {
  test('returns a promise that resolves with an array of pipelines', () => {
    return Dashboard.fetchPipelines().then(pipelines => {
      expect(Array.isArray(pipelines)).toBe(true);
      expect(pipelines.length).toBe(5);
    });
  });

  test('each pipeline has required fields', () => {
    return Dashboard.fetchPipelines().then(pipelines => {
      pipelines.forEach(p => {
        expect(p).toHaveProperty('id');
        expect(p).toHaveProperty('name');
        expect(p).toHaveProperty('stage');
        expect(p).toHaveProperty('status');
        expect(p).toHaveProperty('startTime');
        expect(p).toHaveProperty('prUrl');
        expect(p).toHaveProperty('events');
        expect(Array.isArray(p.events)).toBe(true);
      });
    });
  });

  test('pipelines have valid status values', () => {
    const validStatuses = ['running', 'success', 'failed', 'pending'];
    return Dashboard.fetchPipelines().then(pipelines => {
      pipelines.forEach(p => {
        expect(validStatuses).toContain(p.status);
      });
    });
  });
});

describe('renderDashboard', () => {
  test('renders a table into the container', () => {
    const container = document.getElementById('dashboard-table-container');
    Dashboard.renderDashboard(container);
    // fetchPipelines returns a resolved promise, flush microtasks
    return Promise.resolve().then(() => {
      const table = container.querySelector('.dashboard-table');
      expect(table).not.toBeNull();
    });
  });

  test('renders correct number of rows', () => {
    const container = document.getElementById('dashboard-table-container');
    Dashboard.renderDashboard(container);
    return Promise.resolve().then(() => {
      const rows = container.querySelectorAll('.dashboard-row');
      expect(rows.length).toBe(5);
    });
  });

  test('rows have data-pipeline-id attribute', () => {
    const container = document.getElementById('dashboard-table-container');
    Dashboard.renderDashboard(container);
    return Promise.resolve().then(() => {
      const rows = container.querySelectorAll('.dashboard-row');
      rows.forEach(row => {
        expect(row.getAttribute('data-pipeline-id')).toBeTruthy();
      });
    });
  });

  test('table has correct header columns', () => {
    const container = document.getElementById('dashboard-table-container');
    Dashboard.renderDashboard(container);
    return Promise.resolve().then(() => {
      const headers = container.querySelectorAll('.dashboard-table th');
      const headerTexts = Array.from(headers).map(h => h.textContent);
      expect(headerTexts).toEqual(['#', 'Pipeline', 'Stage', 'Status', 'Elapsed', 'PR']);
    });
  });

  test('status badges have correct class names', () => {
    const container = document.getElementById('dashboard-table-container');
    Dashboard.renderDashboard(container);
    return Promise.resolve().then(() => {
      const badges = container.querySelectorAll('.status-badge');
      expect(badges.length).toBeGreaterThan(0);
      badges.forEach(badge => {
        const hasStatusClass = badge.classList.contains('status-running') ||
          badge.classList.contains('status-success') ||
          badge.classList.contains('status-failed') ||
          badge.classList.contains('status-pending');
        expect(hasStatusClass).toBe(true);
      });
    });
  });

  test('PR links have correct target and rel attributes', () => {
    const container = document.getElementById('dashboard-table-container');
    Dashboard.renderDashboard(container);
    return Promise.resolve().then(() => {
      const links = container.querySelectorAll('.dashboard-table a');
      expect(links.length).toBeGreaterThan(0);
      links.forEach(link => {
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toBe('noopener');
        expect(link.textContent).toMatch(/^PR #\d+$/);
      });
    });
  });
});

describe('toggleEventLog', () => {
  test('expands and collapses event log on toggle', () => {
    const container = document.getElementById('dashboard-table-container');
    Dashboard.renderDashboard(container);
    return Promise.resolve().then(() => {
      const pipelineId = Dashboard.MOCK_PIPELINES[0].id;
      const row = container.querySelector('.dashboard-row[data-pipeline-id="' + pipelineId + '"]');

      // Expand
      Dashboard.toggleEventLog(pipelineId);
      expect(row.getAttribute('data-expanded')).toBe('true');
      const eventRow = row.nextElementSibling;
      expect(eventRow).not.toBeNull();
      expect(eventRow.classList.contains('event-log-row')).toBe(true);

      // Check timeline items
      const items = eventRow.querySelectorAll('.event-timeline li');
      expect(items.length).toBe(Dashboard.MOCK_PIPELINES[0].events.length);

      // Collapse
      Dashboard.toggleEventLog(pipelineId);
      expect(row.getAttribute('data-expanded')).toBe('false');
      expect(row.nextElementSibling === null || !row.nextElementSibling.classList.contains('event-log-row')).toBe(true);
    });
  });

  test('rapid double toggle does not create duplicate rows', () => {
    const container = document.getElementById('dashboard-table-container');
    Dashboard.renderDashboard(container);
    return Promise.resolve().then(() => {
      const pipelineId = Dashboard.MOCK_PIPELINES[0].id;

      // Toggle open twice rapidly
      Dashboard.toggleEventLog(pipelineId);
      Dashboard.toggleEventLog(pipelineId);
      Dashboard.toggleEventLog(pipelineId);

      const row = container.querySelector('.dashboard-row[data-pipeline-id="' + pipelineId + '"]');
      expect(row.getAttribute('data-expanded')).toBe('true');

      // Should only have one event-log-row
      const tbody = container.querySelector('tbody');
      const eventRows = tbody.querySelectorAll('.event-log-row');
      expect(eventRows.length).toBe(1);
    });
  });
});

describe('auto-refresh lifecycle', () => {
  test('startAutoRefresh sets refresh status to active', () => {
    Dashboard.startAutoRefresh();
    const status = document.getElementById('refresh-status');
    expect(status.textContent).toBe('active');
  });

  test('stopAutoRefresh sets refresh status to paused', () => {
    Dashboard.startAutoRefresh();
    Dashboard.stopAutoRefresh();
    const status = document.getElementById('refresh-status');
    expect(status.textContent).toBe('paused');
  });

  test('startAutoRefresh is idempotent — calling twice does not create duplicate intervals', () => {
    const container = document.getElementById('dashboard-table-container');
    Dashboard.renderDashboard(container);

    return Promise.resolve().then(() => {
      Dashboard.startAutoRefresh();
      Dashboard.startAutoRefresh();

      // Advance time by one interval
      jest.advanceTimersByTime(10000);

      // Should still have exactly one table
      return Promise.resolve().then(() => {
        const tables = container.querySelectorAll('.dashboard-table');
        expect(tables.length).toBe(1);
      });
    });
  });

  test('stopAutoRefresh stops the refresh timer', () => {
    const container = document.getElementById('dashboard-table-container');
    Dashboard.renderDashboard(container);

    return Promise.resolve().then(() => {
      Dashboard.startAutoRefresh();
      Dashboard.stopAutoRefresh();

      const bar = document.querySelector('.refresh-countdown-bar');
      expect(bar.classList.contains('running')).toBe(false);
      expect(bar.style.width).toBe('100%');
    });
  });

  test('countdown bar gets running class on start', () => {
    Dashboard.startAutoRefresh();
    const bar = document.querySelector('.refresh-countdown-bar');
    expect(bar.classList.contains('running')).toBe(true);
  });

  test('countdown bar loses running class on stop', () => {
    Dashboard.startAutoRefresh();
    Dashboard.stopAutoRefresh();
    const bar = document.querySelector('.refresh-countdown-bar');
    expect(bar.classList.contains('running')).toBe(false);
  });
});

describe('renderPipelineTable', () => {
  test('replaces existing table on re-render', () => {
    const container = document.getElementById('dashboard-table-container');
    Dashboard.renderPipelineTable(Dashboard.MOCK_PIPELINES, container);
    Dashboard.renderPipelineTable(Dashboard.MOCK_PIPELINES, container);
    const tables = container.querySelectorAll('.dashboard-table');
    expect(tables.length).toBe(1);
  });
});

describe('index.html integration', () => {
  test('dashboard tab button exists in index.html', () => {
    const fs = require('fs');
    const path = require('path');
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    expect(html).toContain('id="tab-dashboard"');
    expect(html).toContain('data-tab="dashboard"');
    expect(html).toContain('📊 Dashboard');
  });

  test('dashboard panel exists in index.html', () => {
    const fs = require('fs');
    const path = require('path');
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    expect(html).toContain('id="panel-dashboard"');
    expect(html).toContain('id="dashboard-table-container"');
    expect(html).toContain('id="refresh-status"');
  });

  test('dashboard.js script tag exists in index.html', () => {
    const fs = require('fs');
    const path = require('path');
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    expect(html).toContain('src="js/dashboard.js"');
  });
});

describe('CSS dashboard styles', () => {
  test('style.css contains dashboard styles', () => {
    const fs = require('fs');
    const path = require('path');
    const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
    expect(css).toContain('.dashboard-table');
    expect(css).toContain('.status-badge');
    expect(css).toContain('.event-timeline');
    expect(css).toContain('.refresh-countdown');
    expect(css).toContain('@keyframes countdown');
  });

  test('style.css contains professional theme dashboard overrides', () => {
    const fs = require('fs');
    const path = require('path');
    const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
    expect(css).toContain('body.theme-professional .dashboard-title');
    expect(css).toContain('body.theme-professional .dashboard-table th');
    expect(css).toContain('body.theme-professional .status-badge');
  });

  test('status badge color values exist for all statuses', () => {
    const fs = require('fs');
    const path = require('path');
    const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
    expect(css).toContain('.status-badge.status-running');
    expect(css).toContain('.status-badge.status-success');
    expect(css).toContain('.status-badge.status-failed');
    expect(css).toContain('.status-badge.status-pending');
    expect(css).toContain('#42a5f5'); // running
    expect(css).toContain('#66bb6a'); // success
    expect(css).toContain('#ef5350'); // failed
    expect(css).toContain('#ffc107'); // pending
  });
});

describe('module exports', () => {
  test('exports all required functions', () => {
    expect(typeof Dashboard.renderDashboard).toBe('function');
    expect(typeof Dashboard.startAutoRefresh).toBe('function');
    expect(typeof Dashboard.stopAutoRefresh).toBe('function');
    expect(typeof Dashboard.fetchPipelines).toBe('function');
    expect(typeof Dashboard.toggleEventLog).toBe('function');
    expect(typeof Dashboard.renderPipelineTable).toBe('function');
  });
});
