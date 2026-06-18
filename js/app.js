// Load arrow geometry helpers
const ArrowGeometryModule = (typeof require !== 'undefined')
  ? require('./arrow-geometry.js')
  : (typeof window !== 'undefined' && window.ArrowGeometry);

const THEME_MASCOTS = {
  dark: 'assets/foreman-mascot.svg',
  light: 'assets/foreman-mascot-light.svg',
  colorful: 'assets/foreman-mascot-colorful.svg',
  professional: 'assets/foreman-mascot.svg',
};

const VALID_THEMES = ['dark', 'light', 'colorful', 'professional'];

function setTheme(themeName) {
  // Whitelist-validate theme name
  if (VALID_THEMES.indexOf(themeName) === -1) {
    themeName = 'dark';
  }

  // Remove existing theme classes
  document.body.classList.remove('theme-light', 'theme-colorful', 'theme-professional');
  if (themeName !== 'dark') {
    document.body.classList.add('theme-' + themeName);
  }

  // Update mascot images
  var mascotSrc = THEME_MASCOTS[themeName] || THEME_MASCOTS.dark;
  document.querySelectorAll('img.header-mascot').forEach(function(img) {
    img.setAttribute('src', mascotSrc);
  });

  // Update #pipeline::before background via injected style
  var styleEl = document.getElementById('theme-mascot-bg');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'theme-mascot-bg';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = '#pipeline::before { background-image: url(\'' + mascotSrc + '\'); }';

  // Persist preference
  try { localStorage.setItem('foreman-theme', themeName); } catch (e) { /* ignore */ }

  // Update button states
  document.querySelectorAll('.theme-btn').forEach(function(btn) {
    var isActive = btn.getAttribute('data-theme') === themeName;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

const agents = [
  { id: 'researcher', name: 'Researcher', stage: 1, description: 'Deep codebase analysis', artifact: 'research-report.md', multiModel: false },
  { id: 'planner', name: 'Planner', stage: 2, description: 'Creates implementation plan from research', artifact: 'implementation-plan.md', multiModel: false },
  { id: 'verifier', name: 'Verifier', stage: 3, description: 'Independent plan review', artifact: null, multiModel: true, outcomes: ['APPROVED', 'NEEDS_REVISION'], models: ['claude', 'chatgpt', 'gemini'] },
  { id: 'implementer', name: 'Implementer', stage: 4, description: 'Executes the plan by making code changes', artifact: null, multiModel: false },
  { id: 'validator', name: 'Validator', stage: 5, description: 'Verifies implementation, runs build/tests', artifact: 'implementation-issues.md', multiModel: true, outcomes: ['PASS', 'FAIL'], models: ['claude', 'chatgpt', 'gemini'] },
  { id: 'build-watcher', name: 'Build Watcher', stage: 6, description: 'Monitors CI after PR push', artifact: null, multiModel: false },
  { id: 'post-mortem', name: 'Post-Mortem', stage: 7, description: 'Pipeline aftercare and learnings', artifact: 'post-mortem-findings.md', multiModel: false },
];

const feedbackLoops = [
  { from: 'verifier', to: 'planner', label: 'NEEDS_REVISION' },
  { from: 'validator', to: 'implementer', label: 'FAIL' },
];

// Drag state
const dragOffsets = new Map(); // agentId → { dx, dy }

// Demo animation state
let demoActive = false;
let demoTimeouts = [];
let demoProgressEl = null;

function makeDraggable(node) {
  const agentId = node.dataset.agentId;

  // Clear fadeIn animation after it completes so its transform
  // doesn't override drag transforms in the CSS cascade.
  node.addEventListener('animationend', () => {
    node.style.animation = 'none';
    const saved = dragOffsets.get(agentId);
    if (saved) {
      node.style.setProperty('--drag-x', `${saved.dx}px`);
      node.style.setProperty('--drag-y', `${saved.dy}px`);
    }
  }, { once: true });

  let startX, startY, offsetX, offsetY, hasDragged;

  function onPointerDown(e) {
    if (!e.isPrimary || e.button !== 0) return;

    e.preventDefault();
    node.setPointerCapture(e.pointerId);

    // Cancel any in-progress fadeIn animation immediately so its transform
    // doesn't fight with drag transforms in the CSS cascade.
    node.style.animation = 'none';
    node.getAnimations().forEach(a => a.cancel());

    const saved = dragOffsets.get(agentId) || { dx: 0, dy: 0 };
    startX = e.clientX;
    startY = e.clientY;
    offsetX = saved.dx;
    offsetY = saved.dy;
    hasDragged = false;

    node.classList.add('dragging');

    node.addEventListener('pointermove', onPointerMove);
    node.addEventListener('pointerup', onPointerUp);
    node.addEventListener('pointercancel', onInterruptedDrag);
    node.addEventListener('lostpointercapture', onInterruptedDrag);
  }

  function onPointerMove(e) {
    if (!e.isPrimary) return;

    const dx = e.clientX - startX + offsetX;
    const dy = e.clientY - startY + offsetY;

    if (!hasDragged && Math.hypot(e.clientX - startX, e.clientY - startY) > 5) {
      hasDragged = true;
    }

    node.style.setProperty('--drag-x', `${dx}px`);
    node.style.setProperty('--drag-y', `${dy}px`);
    renderArrows();
  }

  function persistCurrentPosition() {
    const style = node.style;
    const dx = parseFloat(style.getPropertyValue('--drag-x')) || 0;
    const dy = parseFloat(style.getPropertyValue('--drag-y')) || 0;
    dragOffsets.set(agentId, { dx, dy });
  }

  function cleanup() {
    node.classList.remove('dragging');
    node.removeEventListener('pointermove', onPointerMove);
    node.removeEventListener('pointerup', onPointerUp);
    node.removeEventListener('pointercancel', onInterruptedDrag);
    node.removeEventListener('lostpointercapture', onInterruptedDrag);
  }

  function onPointerUp(e) {
    if (!e.isPrimary) return;

    const dx = e.clientX - startX + offsetX;
    const dy = e.clientY - startY + offsetY;

    // Apply final position to the node so getBoundingClientRect reflects it
    node.style.setProperty('--drag-x', `${dx}px`);
    node.style.setProperty('--drag-y', `${dy}px`);
    dragOffsets.set(agentId, { dx, dy });

    if (hasDragged) {
      node.addEventListener('click', function suppressClick(clickEvent) {
        clickEvent.stopImmediatePropagation();
        clickEvent.preventDefault();
      }, { capture: true, once: true });
    }

    cleanup();
    renderArrows();
  }

  function onInterruptedDrag() {
    persistCurrentPosition();
    renderArrows();
    cleanup();
  }

  node.addEventListener('pointerdown', onPointerDown);
}

const modelLogos = {
  claude: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="#D97706"/><text x="20" y="26" text-anchor="middle" fill="#fff" font-size="16" font-family="sans-serif">C</text></svg>',
  chatgpt: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="#10A37F"/><text x="20" y="26" text-anchor="middle" fill="#fff" font-size="16" font-family="sans-serif">G</text></svg>',
  gemini: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="#4285F4"/><text x="20" y="26" text-anchor="middle" fill="#fff" font-size="16" font-family="sans-serif">Gm</text></svg>',
};

const colorMap = {
  'researcher': 'var(--color-researcher)',
  'planner': 'var(--color-planner)',
  'verifier': 'var(--color-verifier)',
  'implementer': 'var(--color-implementer)',
  'validator': 'var(--color-validator)',
  'build-watcher': 'var(--color-build-watcher)',
  'post-mortem': 'var(--color-post-mortem)',
};

function renderPipeline() {
  const container = document.getElementById('pipeline');
  container.innerHTML = '';

  agents.forEach((agent, i) => {
    const node = document.createElement('div');
    node.className = 'agent-node' + (agent.multiModel ? ' multi-model' : '');
    node.dataset.agentId = agent.id;
    node.style.setProperty('--node-color', colorMap[agent.id]);
    node.style.animationDelay = `${i * 0.1}s`;

    node.innerHTML = `
      <span class="stage-badge">${agent.stage}</span>
      <div class="agent-name">${agent.name}</div>
      <div class="agent-desc">${agent.description}</div>
      ${agent.artifact ? `<span class="artifact-badge">📄 ${agent.artifact}</span>` : ''}

    `;

    if (agent.multiModel && agent.models) {
      agent.models.forEach((model, mi) => {
        const card = document.createElement('div');
        card.className = 'model-card';
        card.dataset.model = model;
        card.style.setProperty('--card-index', mi);
        card.innerHTML = `
          <div class="model-card-front"></div>
          <div class="model-card-back">${modelLogos[model] || ''}<span class="model-label">${model}</span></div>
        `;
        node.appendChild(card);
      });
    }

    node.addEventListener('click', () => {
      const panel = document.getElementById('agent-detail');
      if (agent.multiModel && panel.classList.contains('visible') && panel.dataset.agentId === agent.id) {
        node.classList.toggle('fanned');
      } else {
        document.querySelectorAll('.agent-node.fanned').forEach(n => n.classList.remove('fanned'));
        panel.dataset.agentId = agent.id;
        showAgentDetail(agent.id);
      }
    });
    container.appendChild(node);

    const savedOffset = dragOffsets.get(agent.id);
    if (savedOffset) {
      node.style.setProperty('--drag-x', `${savedOffset.dx}px`);
      node.style.setProperty('--drag-y', `${savedOffset.dy}px`);
    }
    makeDraggable(node);
  });

  requestAnimationFrame(() => renderArrows());
}

function renderArrows() {
  const container = document.getElementById('pipeline');
  const existing = container.querySelector('svg.arrows-overlay');
  if (existing) existing.remove();

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('arrows-overlay');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  container.appendChild(svg);

  const containerRect = container.getBoundingClientRect();
  const nodes = container.querySelectorAll('.agent-node');
  const nodeRects = Array.from(nodes).map(n => {
    const r = n.getBoundingClientRect();
    return {
      id: n.dataset.agentId,
      left: r.left - containerRect.left,
      top: r.top - containerRect.top,
      right: r.right - containerRect.left,
      bottom: r.bottom - containerRect.top,
      cx: (r.left + r.right) / 2 - containerRect.left,
      cy: (r.top + r.bottom) / 2 - containerRect.top,
      width: r.width,
      height: r.height,
    };
  });

  const isVertical = window.innerWidth <= 900;

  // Forward arrows between sequential agents
  for (let i = 0; i < nodeRects.length - 1; i++) {
    const from = nodeRects[i];
    const to = nodeRects[i + 1];
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('arrow');

    const result = ArrowGeometryModule.computeForwardPath(from, to, isVertical);
    path.setAttribute('d', result.d);
    svg.appendChild(path);

    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.classList.add('arrowhead');
    polygon.setAttribute('points', ArrowGeometryModule.computeArrowheadPoints(result.endX, result.endY, result.angle));
    svg.appendChild(polygon);
  }

  // Feedback loop arrows
  feedbackLoops.forEach(loop => {
    const fromIdx = nodeRects.findIndex(n => n.id === loop.from);
    const toIdx = nodeRects.findIndex(n => n.id === loop.to);
    if (fromIdx === -1 || toIdx === -1) return;

    const from = nodeRects[fromIdx];
    const to = nodeRects[toIdx];
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('arrow', 'feedback');

    const result = ArrowGeometryModule.computeFeedbackPath(from, to, isVertical);
    path.setAttribute('d', result.d);
    svg.appendChild(path);

    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.classList.add('arrowhead-feedback');
    polygon.setAttribute('points', ArrowGeometryModule.computeArrowheadPoints(result.endX, result.endY, result.angle));
    svg.appendChild(polygon);

    // Feedback label
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.classList.add('artifact-label');
    const labelPos = ArrowGeometryModule.computeFeedbackLabelPosition(from, to, isVertical);
    label.setAttribute('x', labelPos.x);
    label.setAttribute('y', labelPos.y);
    label.textContent = loop.label;
    svg.appendChild(label);
  });
}

function showAgentDetail(agentId) {
  const agent = agents.find(a => a.id === agentId);
  if (!agent) return;

  const panel = document.getElementById('agent-detail');
  panel.dataset.agentId = agentId;
  panel.innerHTML = `
    <button class="close-btn" aria-label="Close">&times;</button>
    <h2 style="color: ${colorMap[agent.id]}">${agent.name}</h2>
    <div class="detail-section">
      <h3>Stage</h3>
      <p>${agent.stage} of ${agents.length}</p>
    </div>
    <div class="detail-section">
      <h3>Description</h3>
      <p>${agent.description}</p>
    </div>
    ${agent.artifact ? `
    <div class="detail-section">
      <h3>Artifact</h3>
      <p>📄 ${agent.artifact}</p>
    </div>` : ''}
    ${agent.multiModel ? `
    <div class="detail-section">
      <h3>Multi-Model</h3>
      <p>Uses multiple models for consensus</p>
    </div>` : ''}
    ${agent.outcomes ? `
    <div class="detail-section">
      <h3>Outcomes</h3>
      <p>${agent.outcomes.map(o => `<span class="outcome-pill ${o === 'PASS' || o === 'APPROVED' ? 'pass' : 'fail'}">${o}</span>`).join('')}</p>
    </div>` : ''}
  `;

  panel.classList.add('visible');

  panel.querySelector('.close-btn').addEventListener('click', () => {
    panel.classList.remove('visible');
    document.querySelectorAll('.agent-node.fanned').forEach(n => n.classList.remove('fanned'));
  });
}

function startDemo() {
  if (demoActive) return;
  demoActive = true;
  document.body.classList.add('demo-active');

  // Close any open detail panel
  const panel = document.getElementById('agent-detail');
  panel.classList.remove('visible');
  document.querySelectorAll('.agent-node.fanned').forEach(n => n.classList.remove('fanned'));

  // Update toggle button
  const btn = document.getElementById('demo-toggle');
  if (btn) {
    btn.textContent = '⏹ Stop';
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
  }

  // Create progress indicator
  demoProgressEl = document.createElement('div');
  demoProgressEl.className = 'demo-progress';
  demoProgressEl.setAttribute('role', 'status');
  demoProgressEl.setAttribute('aria-live', 'polite');
  document.body.appendChild(demoProgressEl);

  // Use professional demo path if professional theme is active
  if (document.body.classList.contains('theme-professional')) {
    runProfessionalDemo();
    return;
  }

  const nodes = document.querySelectorAll('.agent-node');
  const arrows = document.querySelectorAll('.arrows-overlay .arrow');
  const arrowheads = document.querySelectorAll('.arrows-overlay .arrowhead, .arrows-overlay .arrowhead-feedback');

  const stepDuration = 2000; // ms per agent
  let currentStep = 0;

  function highlightStep(index) {
    if (!demoActive) return;

    // Clear previous highlights
    nodes.forEach(n => n.classList.remove('demo-highlight'));
    arrows.forEach(a => a.classList.remove('demo-active-arrow'));
    arrowheads.forEach(a => a.classList.remove('demo-active-arrow'));

    if (index >= agents.length) {
      // Demo complete — show feedback loops
      showFeedbackLoops();
      return;
    }

    const agent = agents[index];
    const node = document.querySelector(`.agent-node[data-agent-id="${agent.id}"]`);
    if (node) node.classList.add('demo-highlight');

    // Highlight the arrow leading TO this node (arrow index = node index - 1)
    if (index > 0) {
      const forwardArrows = document.querySelectorAll('.arrows-overlay .arrow:not(.feedback)');
      const forwardHeads = document.querySelectorAll('.arrows-overlay .arrowhead');
      if (forwardArrows[index - 1]) forwardArrows[index - 1].classList.add('demo-active-arrow');
      if (forwardHeads[index - 1]) forwardHeads[index - 1].classList.add('demo-active-arrow');
    }

    // Update progress
    if (demoProgressEl) {
      demoProgressEl.textContent = `Stage ${agent.stage}/${agents.length}: ${agent.name} — ${agent.description}`;
    }

    // Show detail panel briefly (suppressed in professional theme)
    const detailTimeout = setTimeout(() => {
      if (demoActive && !document.body.classList.contains('theme-professional')) {
        showAgentDetail(agent.id);
      }
    }, stepDuration * 0.3);
    demoTimeouts.push(detailTimeout);

    // Schedule next step
    currentStep = index + 1;
    const nextTimeout = setTimeout(() => highlightStep(currentStep), stepDuration);
    demoTimeouts.push(nextTimeout);
  }

  function showFeedbackLoops() {
    if (!demoActive) return;

    // Clear all highlights
    nodes.forEach(n => n.classList.remove('demo-highlight'));
    arrows.forEach(a => a.classList.remove('demo-active-arrow'));
    arrowheads.forEach(a => a.classList.remove('demo-active-arrow'));

    if (demoProgressEl) {
      demoProgressEl.textContent = 'Feedback loops: revision & failure paths';
    }

    // Highlight feedback arrows and their source/target nodes
    const feedbackArrows = document.querySelectorAll('.arrows-overlay .arrow.feedback');
    const feedbackHeads = document.querySelectorAll('.arrows-overlay .arrowhead-feedback');

    feedbackArrows.forEach(a => a.classList.add('demo-active-arrow'));
    feedbackHeads.forEach(a => a.classList.add('demo-active-arrow'));

    feedbackLoops.forEach(loop => {
      const fromNode = document.querySelector(`.agent-node[data-agent-id="${loop.from}"]`);
      const toNode = document.querySelector(`.agent-node[data-agent-id="${loop.to}"]`);
      if (fromNode) fromNode.classList.add('demo-highlight');
      if (toNode) toNode.classList.add('demo-highlight');
    });

    // End demo after showing feedback loops
    const endTimeout = setTimeout(() => {
      if (demoActive) stopDemo();
    }, stepDuration * 1.5);
    demoTimeouts.push(endTimeout);
  }

  highlightStep(0);
}

const PROFESSIONAL_DEMO_SCENES = [
  { agentIndex: null, text: 'Work items or manual input enter the pipeline', action: 'highlight-input' },
  { agentIndex: 0, text: 'Deep codebase analysis begins', action: 'highlight' },
  { agentIndex: 1, text: 'Implementation plan created from research', action: 'highlight' },
  { agentIndex: 2, text: 'Multiple models provide independent plan review', action: 'fan-out' },
  { agentIndex: 3, text: 'Code changes executed against the plan', action: 'highlight' },
  { agentIndex: 4, text: 'Multiple models verify implementation independently', action: 'fan-out' },
  { agentIndex: 5, text: 'CI pipeline monitored for build status', action: 'highlight' },
  { agentIndex: 6, text: 'Pipeline aftercare and learnings captured', action: 'highlight' },
  { agentIndex: null, text: 'Feedback loops enable automatic revision and retry', action: 'feedback' },
];

function runProfessionalDemo() {
  const nodes = document.querySelectorAll('.agent-node');
  const arrows = document.querySelectorAll('.arrows-overlay .arrow');
  const arrowheads = document.querySelectorAll('.arrows-overlay .arrowhead, .arrows-overlay .arrowhead-feedback');
  const stepDuration = 3000;

  function runScene(sceneIndex) {
    if (!demoActive) return;
    if (sceneIndex >= PROFESSIONAL_DEMO_SCENES.length) {
      const endTimeout = setTimeout(() => {
        if (demoActive) stopDemo();
      }, stepDuration);
      demoTimeouts.push(endTimeout);
      return;
    }

    const scene = PROFESSIONAL_DEMO_SCENES[sceneIndex];

    // Clear previous highlights
    nodes.forEach(n => n.classList.remove('demo-highlight'));
    arrows.forEach(a => a.classList.remove('demo-active-arrow'));
    arrowheads.forEach(a => a.classList.remove('demo-active-arrow'));

    // Update progress text
    if (demoProgressEl) {
      demoProgressEl.textContent = scene.text;
    }

    if (scene.action === 'highlight-input') {
      // Pulse the first node with a subtle glow
      if (nodes[0]) nodes[0].classList.add('demo-highlight');
    } else if (scene.action === 'highlight') {
      const node = nodes[scene.agentIndex];
      if (node) node.classList.add('demo-highlight');
      // Highlight arrow leading to this node
      if (scene.agentIndex > 0) {
        const forwardArrows = document.querySelectorAll('.arrows-overlay .arrow:not(.feedback)');
        const forwardHeads = document.querySelectorAll('.arrows-overlay .arrowhead');
        if (forwardArrows[scene.agentIndex - 1]) forwardArrows[scene.agentIndex - 1].classList.add('demo-active-arrow');
        if (forwardHeads[scene.agentIndex - 1]) forwardHeads[scene.agentIndex - 1].classList.add('demo-active-arrow');
      }
    } else if (scene.action === 'fan-out') {
      const node = nodes[scene.agentIndex];
      if (node) {
        node.classList.add('demo-highlight');
        node.classList.add('fanned');
      }
      if (scene.agentIndex > 0) {
        const forwardArrows = document.querySelectorAll('.arrows-overlay .arrow:not(.feedback)');
        const forwardHeads = document.querySelectorAll('.arrows-overlay .arrowhead');
        if (forwardArrows[scene.agentIndex - 1]) forwardArrows[scene.agentIndex - 1].classList.add('demo-active-arrow');
        if (forwardHeads[scene.agentIndex - 1]) forwardHeads[scene.agentIndex - 1].classList.add('demo-active-arrow');
      }
    } else if (scene.action === 'feedback') {
      const feedbackArrows = document.querySelectorAll('.arrows-overlay .arrow.feedback');
      const feedbackHeads = document.querySelectorAll('.arrows-overlay .arrowhead-feedback');
      feedbackArrows.forEach(a => a.classList.add('demo-active-arrow'));
      feedbackHeads.forEach(a => a.classList.add('demo-active-arrow'));
      feedbackLoops.forEach(loop => {
        const fromNode = document.querySelector(`.agent-node[data-agent-id="${loop.from}"]`);
        const toNode = document.querySelector(`.agent-node[data-agent-id="${loop.to}"]`);
        if (fromNode) fromNode.classList.add('demo-highlight');
        if (toNode) toNode.classList.add('demo-highlight');
      });
    }

    const nextTimeout = setTimeout(() => runScene(sceneIndex + 1), stepDuration);
    demoTimeouts.push(nextTimeout);
  }

  runScene(0);
}

function stopDemo() {
  demoActive = false;

  // Clear all scheduled timeouts
  demoTimeouts.forEach(t => clearTimeout(t));
  demoTimeouts = [];

  // Remove all demo classes
  document.body.classList.remove('demo-active');
  document.querySelectorAll('.agent-node.demo-highlight').forEach(n => n.classList.remove('demo-highlight'));
  document.querySelectorAll('.agent-node.fanned').forEach(n => n.classList.remove('fanned'));
  document.querySelectorAll('.demo-active-arrow').forEach(el => el.classList.remove('demo-active-arrow'));

  // Remove progress indicator
  if (demoProgressEl && demoProgressEl.parentNode) {
    demoProgressEl.parentNode.removeChild(demoProgressEl);
  }
  demoProgressEl = null;

  // Close detail panel
  const panel = document.getElementById('agent-detail');
  panel.classList.remove('visible');

  // Reset toggle button
  const btn = document.getElementById('demo-toggle');
  if (btn) {
    btn.textContent = '▶ Demo';
    btn.classList.remove('active');
    btn.setAttribute('aria-pressed', 'false');
  }
}

function handleResize() {
  clearTimeout(handleResize._timer);
  handleResize._timer = setTimeout(() => renderArrows(), 150);
}

document.addEventListener('DOMContentLoaded', () => {
  renderPipeline();
  window.addEventListener('resize', handleResize);

  // Initialize theme
  var savedTheme = null;
  try { savedTheme = localStorage.getItem('foreman-theme'); } catch (e) { /* ignore */ }
  if (!savedTheme) {
    savedTheme = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
  }
  setTheme(savedTheme);

  // Attach theme button listeners
  document.querySelectorAll('.theme-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      setTheme(btn.getAttribute('data-theme'));
    });
  });

  // Attach demo toggle listener
  const demoBtn = document.getElementById('demo-toggle');
  if (demoBtn) {
    demoBtn.addEventListener('click', function() {
      if (demoActive) {
        stopDemo();
      } else {
        startDemo();
      }
    });
  }

  // Close detail panel when clicking outside
  document.addEventListener('click', (e) => {
    const panel = document.getElementById('agent-detail');
    if (panel.classList.contains('visible') &&
        !panel.contains(e.target) &&
        !e.target.closest('.agent-node')) {
      panel.classList.remove('visible');
      document.querySelectorAll('.agent-node.fanned').forEach(n => n.classList.remove('fanned'));
    }
  });

  // Tab navigation
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');
  let gameInitialized = false;

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      tabBtns.forEach(b => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      tabPanels.forEach(p => {
        p.classList.toggle('active', p.id === 'panel-' + targetTab);
      });

      if (targetTab === 'game') {
        if (demoActive) stopDemo();
        const canvas = document.getElementById('game-canvas');
        const Game = (typeof window !== 'undefined' && window.ForemanGame);
        if (Game && canvas && !gameInitialized) {
          Game.initGame(canvas);
          gameInitialized = true;
        }
      } else {
        const Game = (typeof window !== 'undefined' && window.ForemanGame);
        if (Game) Game.stopGame();
      }
    });
  });

  // Game start button
  const gameStartBtn = document.getElementById('game-start-btn');
  if (gameStartBtn) {
    gameStartBtn.addEventListener('click', () => {
      const Game = (typeof window !== 'undefined' && window.ForemanGame);
      if (Game) Game.startGame();
    });
  }

  // Arrow key handling for game
  document.addEventListener('keydown', (e) => {
    const gamePanel = document.getElementById('panel-game');
    if (!gamePanel || !gamePanel.classList.contains('active')) return;
    const Game = (typeof window !== 'undefined' && window.ForemanGame);
    if (!Game) return;
    const state = Game.getGameState();
    if (!state || !state.active) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); Game.movePlayer('left'); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); Game.movePlayer('right'); }
  });
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { agents, feedbackLoops, dragOffsets, makeDraggable, modelLogos, renderPipeline, renderArrows, showAgentDetail, setTheme, THEME_MASCOTS, VALID_THEMES, PROFESSIONAL_DEMO_SCENES, runProfessionalDemo, startDemo, stopDemo, demoActive: () => demoActive };
}
