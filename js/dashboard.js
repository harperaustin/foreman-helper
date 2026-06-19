(function() {
// Dashboard Module — Pipeline Registry with mock data layer

var REFRESH_INTERVAL_MS = 10000;
var refreshIntervalId = null;
var tableContainer = null;

var STAGES = ['Research', 'Planning', 'Implementation', 'Verification', 'Validation', 'Build Watch', 'Post-Mortem', 'Complete'];
var STATUSES = ['running', 'success', 'failed', 'pending'];

var now = Date.now();

var MOCK_PIPELINES = [
  {
    id: 'pl-1',
    name: 'Auth Service Refactor',
    stage: 'Implementation',
    status: 'running',
    startTime: new Date(now - 342000).toISOString(),
    prUrl: 'https://github.com/org/repo/pull/42',
    events: [
      { timestamp: new Date(now - 342000).toISOString(), message: 'Pipeline started' },
      { timestamp: new Date(now - 300000).toISOString(), message: 'Research phase completed' },
      { timestamp: new Date(now - 240000).toISOString(), message: 'Planning phase completed' },
      { timestamp: new Date(now - 180000).toISOString(), message: 'Implementation began' },
      { timestamp: new Date(now - 60000).toISOString(), message: 'Tests running' }
    ]
  },
  {
    id: 'pl-2',
    name: 'Dashboard UI Feature',
    stage: 'Verification',
    status: 'running',
    startTime: new Date(now - 600000).toISOString(),
    prUrl: 'https://github.com/org/repo/pull/87',
    events: [
      { timestamp: new Date(now - 600000).toISOString(), message: 'Pipeline started' },
      { timestamp: new Date(now - 480000).toISOString(), message: 'Research completed' },
      { timestamp: new Date(now - 360000).toISOString(), message: 'Plan approved' },
      { timestamp: new Date(now - 240000).toISOString(), message: 'Implementation done' },
      { timestamp: new Date(now - 120000).toISOString(), message: 'Verification in progress' }
    ]
  },
  {
    id: 'pl-3',
    name: 'CI Pipeline Fix',
    stage: 'Complete',
    status: 'success',
    startTime: new Date(now - 1800000).toISOString(),
    prUrl: 'https://github.com/org/repo/pull/91',
    events: [
      { timestamp: new Date(now - 1800000).toISOString(), message: 'Pipeline started' },
      { timestamp: new Date(now - 1500000).toISOString(), message: 'All stages passed' },
      { timestamp: new Date(now - 1200000).toISOString(), message: 'Build succeeded' }
    ]
  },
  {
    id: 'pl-4',
    name: 'Database Migration',
    stage: 'Planning',
    status: 'pending',
    startTime: new Date(now - 120000).toISOString(),
    prUrl: 'https://github.com/org/repo/pull/103',
    events: [
      { timestamp: new Date(now - 120000).toISOString(), message: 'Pipeline queued' },
      { timestamp: new Date(now - 90000).toISOString(), message: 'Research completed' },
      { timestamp: new Date(now - 30000).toISOString(), message: 'Awaiting plan review' }
    ]
  },
  {
    id: 'pl-5',
    name: 'API Rate Limiter',
    stage: 'Validation',
    status: 'failed',
    startTime: new Date(now - 900000).toISOString(),
    prUrl: 'https://github.com/org/repo/pull/110',
    events: [
      { timestamp: new Date(now - 900000).toISOString(), message: 'Pipeline started' },
      { timestamp: new Date(now - 720000).toISOString(), message: 'Implementation done' },
      { timestamp: new Date(now - 540000).toISOString(), message: 'Verification passed' },
      { timestamp: new Date(now - 300000).toISOString(), message: 'Validation failed: rate limit test timeout' }
    ]
  }
];

function fetchPipelines() {
  // Simulate live changes by randomizing one pipeline's status/stage
  var idx = Math.floor(Math.random() * MOCK_PIPELINES.length);
  var pipeline = MOCK_PIPELINES[idx];
  var stageIdx = STAGES.indexOf(pipeline.stage);
  if (stageIdx < STAGES.length - 1 && Math.random() > 0.5) {
    pipeline.stage = STAGES[stageIdx + 1];
  }
  if (Math.random() > 0.7) {
    pipeline.status = STATUSES[Math.floor(Math.random() * STATUSES.length)];
  }
  return Promise.resolve(MOCK_PIPELINES);
}

function formatElapsed(startTimeISO) {
  var elapsed = Date.now() - new Date(startTimeISO).getTime();
  var totalSeconds = Math.max(0, Math.floor(elapsed / 1000));
  var minutes = Math.floor(totalSeconds / 60);
  var seconds = totalSeconds % 60;
  return minutes + 'm ' + seconds + 's';
}

function extractPRNumber(prUrl) {
  var parts = prUrl.split('/');
  return parts[parts.length - 1];
}

var STATUS_EMOJI = {
  success: '✅',
  running: '🔄',
  failed: '❌',
  pending: '⏳'
};

function renderPipelineTable(pipelines, container) {
  var target = container || tableContainer;
  if (!target) return;

  var existing = target.querySelector('.dashboard-table');
  if (existing) existing.remove();

  var table = document.createElement('table');
  table.className = 'dashboard-table';

  var thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>#</th><th>Pipeline</th><th>Stage</th><th>Status</th><th>Elapsed</th><th>PR</th></tr>';
  table.appendChild(thead);

  var tbody = document.createElement('tbody');
  pipelines.forEach(function(p, i) {
    var tr = document.createElement('tr');
    tr.className = 'dashboard-row';
    tr.setAttribute('data-pipeline-id', p.id);
    tr.setAttribute('data-expanded', 'false');

    var prNum = extractPRNumber(p.prUrl);
    var emoji = STATUS_EMOJI[p.status] || '';

    tr.innerHTML =
      '<td>' + (i + 1) + '</td>' +
      '<td>' + p.name + '</td>' +
      '<td>' + p.stage + '</td>' +
      '<td><span class="status-badge status-' + p.status + '">' + emoji + ' ' + p.status + '</span></td>' +
      '<td>' + formatElapsed(p.startTime) + '</td>' +
      '<td><a href="' + p.prUrl + '" target="_blank" rel="noopener">PR #' + prNum + '</a></td>';

    tr.addEventListener('click', function() {
      toggleEventLog(p.id);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  target.appendChild(table);
}

function toggleEventLog(pipelineId) {
  var row = document.querySelector('.dashboard-row[data-pipeline-id="' + pipelineId + '"]');
  if (!row) return;

  var isExpanded = row.getAttribute('data-expanded') === 'true';

  if (isExpanded) {
    var nextRow = row.nextElementSibling;
    if (nextRow && nextRow.classList.contains('event-log-row')) {
      nextRow.remove();
    }
    row.setAttribute('data-expanded', 'false');
  } else {
    // Remove any existing event log row first (idempotency)
    var existingNext = row.nextElementSibling;
    if (existingNext && existingNext.classList.contains('event-log-row')) {
      existingNext.remove();
    }

    var pipeline = null;
    for (var i = 0; i < MOCK_PIPELINES.length; i++) {
      if (MOCK_PIPELINES[i].id === pipelineId) {
        pipeline = MOCK_PIPELINES[i];
        break;
      }
    }
    if (!pipeline) return;

    var logRow = document.createElement('tr');
    logRow.className = 'event-log-row';
    var td = document.createElement('td');
    td.setAttribute('colspan', '6');

    var ul = document.createElement('ul');
    ul.className = 'event-timeline';
    pipeline.events.forEach(function(evt) {
      var li = document.createElement('li');
      var time = new Date(evt.timestamp);
      var timeStr = time.toLocaleTimeString();
      li.innerHTML = '<span class="event-time">' + timeStr + '</span> ' + evt.message;
      ul.appendChild(li);
    });

    td.appendChild(ul);
    logRow.appendChild(td);
    row.parentNode.insertBefore(logRow, row.nextSibling);
    row.setAttribute('data-expanded', 'true');
  }
}

function renderDashboard(container) {
  tableContainer = container;
  fetchPipelines().then(function(pipelines) {
    renderPipelineTable(pipelines, container);
  });
}

function startAutoRefresh() {
  stopAutoRefresh();

  var bar = document.querySelector('.refresh-countdown-bar');
  var statusEl = document.getElementById('refresh-status');
  if (bar) {
    bar.classList.add('running');
    // Restart animation
    bar.style.animation = 'none';
    void bar.offsetWidth; // trigger reflow
    bar.style.animation = '';
  }
  if (statusEl) statusEl.textContent = 'active';

  refreshIntervalId = setInterval(function() {
    fetchPipelines().then(function(pipelines) {
      renderPipelineTable(pipelines);
    });
    // Restart countdown animation
    var b = document.querySelector('.refresh-countdown-bar');
    if (b) {
      b.style.animation = 'none';
      void b.offsetWidth;
      b.style.animation = '';
    }
  }, REFRESH_INTERVAL_MS);
}

function stopAutoRefresh() {
  if (refreshIntervalId !== null) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
  }
  var bar = document.querySelector('.refresh-countdown-bar');
  var statusEl = document.getElementById('refresh-status');
  if (bar) {
    bar.classList.remove('running');
    bar.style.animation = 'none';
    bar.style.width = '100%';
  }
  if (statusEl) statusEl.textContent = 'paused';
}

var api = {
  renderDashboard: renderDashboard,
  startAutoRefresh: startAutoRefresh,
  stopAutoRefresh: stopAutoRefresh,
  fetchPipelines: fetchPipelines,
  toggleEventLog: toggleEventLog,
  renderPipelineTable: renderPipelineTable,
  MOCK_PIPELINES: MOCK_PIPELINES
};

if (typeof window !== 'undefined') {
  window.ForemanDashboard = api;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}

})();
