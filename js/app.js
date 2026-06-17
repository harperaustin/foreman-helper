// Load arrow geometry helpers
const ArrowGeometryModule = (typeof require !== 'undefined')
  ? require('./arrow-geometry.js')
  : (typeof window !== 'undefined' && window.ArrowGeometry);

const agents = [
  { id: 'researcher', name: 'Researcher', stage: 1, description: 'Deep codebase analysis', artifact: 'research-report.md', multiModel: false },
  { id: 'planner', name: 'Planner', stage: 2, description: 'Creates implementation plan from research', artifact: 'implementation-plan.md', multiModel: false },
  { id: 'verifier', name: 'Verifier', stage: 3, description: 'Independent plan review', artifact: null, multiModel: true, outcomes: ['APPROVED', 'NEEDS_REVISION'] },
  { id: 'implementer', name: 'Implementer', stage: 4, description: 'Executes the plan by making code changes', artifact: null, multiModel: false },
  { id: 'validator', name: 'Validator', stage: 5, description: 'Verifies implementation, runs build/tests', artifact: 'implementation-issues.md', multiModel: true, outcomes: ['PASS', 'FAIL'] },
  { id: 'build-watcher', name: 'Build Watcher', stage: 6, description: 'Monitors CI after PR push', artifact: null, multiModel: false },
  { id: 'post-mortem', name: 'Post-Mortem', stage: 7, description: 'Pipeline aftercare and learnings', artifact: 'post-mortem-findings.md', multiModel: false },
];

const feedbackLoops = [
  { from: 'verifier', to: 'planner', label: 'NEEDS_REVISION' },
  { from: 'validator', to: 'implementer', label: 'FAIL' },
];

// Drag state
const dragOffsets = new Map(); // agentId → { dx, dy }

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

    node.addEventListener('click', () => showAgentDetail(agent.id));
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
    const midX = (from.cx + to.cx) / 2;
    const midY = isVertical ? (from.cy + to.cy) / 2 : from.bottom + 45;
    label.setAttribute('x', isVertical ? from.left - 35 : midX);
    label.setAttribute('y', midY);
    label.textContent = loop.label;
    svg.appendChild(label);
  });
}

function showAgentDetail(agentId) {
  const agent = agents.find(a => a.id === agentId);
  if (!agent) return;

  const panel = document.getElementById('agent-detail');
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
  });
}

function handleResize() {
  clearTimeout(handleResize._timer);
  handleResize._timer = setTimeout(() => renderArrows(), 150);
}

document.addEventListener('DOMContentLoaded', () => {
  renderPipeline();
  window.addEventListener('resize', handleResize);

  // Close detail panel when clicking outside
  document.addEventListener('click', (e) => {
    const panel = document.getElementById('agent-detail');
    if (panel.classList.contains('visible') &&
        !panel.contains(e.target) &&
        !e.target.closest('.agent-node')) {
      panel.classList.remove('visible');
    }
  });
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { agents, feedbackLoops, dragOffsets, makeDraggable, renderPipeline, renderArrows, showAgentDetail };
}
