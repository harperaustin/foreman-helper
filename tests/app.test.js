/**
 * @jest-environment jsdom
 */

// Polyfill PointerEvent for jsdom
if (typeof PointerEvent === 'undefined') {
  class PointerEvent extends MouseEvent {
    constructor(type, params = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.isPrimary = params.isPrimary ?? true;
    }
  }
  global.PointerEvent = PointerEvent;
}

beforeEach(() => {
  document.body.innerHTML = `
    <main>
      <div id="pipeline"></div>
      <div id="agent-detail"></div>
    </main>
  `;
  jest.resetModules();
});

function loadApp() {
  return require('../js/app');
}

describe('agents data', () => {
  test('has 7 agents in correct order', () => {
    const { agents } = loadApp();
    expect(agents).toHaveLength(7);
    expect(agents.map(a => a.id)).toEqual([
      'researcher', 'planner', 'verifier', 'implementer',
      'validator', 'build-watcher', 'post-mortem',
    ]);
  });

  test('stages are sequential 1-7', () => {
    const { agents } = loadApp();
    agents.forEach((a, i) => expect(a.stage).toBe(i + 1));
  });

  test('feedback loops reference valid agents', () => {
    const { agents, feedbackLoops } = loadApp();
    const ids = new Set(agents.map(a => a.id));
    feedbackLoops.forEach(loop => {
      expect(ids.has(loop.from)).toBe(true);
      expect(ids.has(loop.to)).toBe(true);
    });
  });
});

describe('renderPipeline', () => {
  test('creates agent nodes in the DOM', () => {
    const { renderPipeline } = loadApp();
    renderPipeline();
    const nodes = document.querySelectorAll('.agent-node');
    expect(nodes.length).toBe(7);
  });

  test('each node has data-agent-id', () => {
    const { renderPipeline, agents } = loadApp();
    renderPipeline();
    agents.forEach(agent => {
      const node = document.querySelector(`[data-agent-id="${agent.id}"]`);
      expect(node).not.toBeNull();
    });
  });

  test('multi-model agents get multi-model class', () => {
    const { renderPipeline, agents } = loadApp();
    renderPipeline();
    agents.filter(a => a.multiModel).forEach(agent => {
      const node = document.querySelector(`[data-agent-id="${agent.id}"]`);
      expect(node.classList.contains('multi-model')).toBe(true);
    });
  });
});

describe('showAgentDetail', () => {
  test('opens detail panel with agent info', () => {
    const { renderPipeline, showAgentDetail } = loadApp();
    renderPipeline();
    showAgentDetail('researcher');
    const panel = document.getElementById('agent-detail');
    expect(panel.classList.contains('visible')).toBe(true);
    expect(panel.textContent).toContain('Researcher');
  });

  test('does nothing for unknown agent id', () => {
    const { showAgentDetail } = loadApp();
    showAgentDetail('nonexistent');
    const panel = document.getElementById('agent-detail');
    expect(panel.classList.contains('visible')).toBe(false);
  });
});

describe('drag behavior', () => {
  function createMockNode(agentId) {
    const node = document.createElement('div');
    node.dataset.agentId = agentId;
    node.style.setProperty('--drag-x', '0px');
    node.style.setProperty('--drag-y', '0px');
    node.setPointerCapture = jest.fn();
    node.releasePointerCapture = jest.fn();
    document.body.appendChild(node);
    return node;
  }

  function firePointerEvent(node, type, opts = {}) {
    const defaults = { isPrimary: true, button: 0, clientX: 0, clientY: 0, pointerId: 1 };
    const event = new PointerEvent(type, { ...defaults, ...opts, bubbles: true });
    node.dispatchEvent(event);
    return event;
  }

  test('dragging updates CSS custom properties', () => {
    const { makeDraggable } = loadApp();
    const node = createMockNode('test-agent');
    makeDraggable(node);

    firePointerEvent(node, 'pointerdown', { clientX: 100, clientY: 100 });
    firePointerEvent(node, 'pointermove', { clientX: 150, clientY: 120 });

    expect(node.style.getPropertyValue('--drag-x')).toBe('50px');
    expect(node.style.getPropertyValue('--drag-y')).toBe('20px');
  });

  test('dragging class is added during drag and removed after', () => {
    const { makeDraggable } = loadApp();
    const node = createMockNode('test-drag-class');
    makeDraggable(node);

    firePointerEvent(node, 'pointerdown', { clientX: 0, clientY: 0 });
    expect(node.classList.contains('dragging')).toBe(true);

    firePointerEvent(node, 'pointerup', { clientX: 10, clientY: 10 });
    expect(node.classList.contains('dragging')).toBe(false);
  });

  test('pointerup persists offset for next drag', () => {
    const { makeDraggable, dragOffsets } = loadApp();
    const node = createMockNode('persist-test');
    makeDraggable(node);

    firePointerEvent(node, 'pointerdown', { clientX: 0, clientY: 0 });
    firePointerEvent(node, 'pointermove', { clientX: 30, clientY: 40 });
    firePointerEvent(node, 'pointerup', { clientX: 30, clientY: 40 });

    const saved = dragOffsets.get('persist-test');
    expect(saved).toEqual({ dx: 30, dy: 40 });
  });

  test('lost pointer capture persists current visual position', () => {
    const { makeDraggable, dragOffsets } = loadApp();
    const node = createMockNode('lost-capture-test');
    makeDraggable(node);

    firePointerEvent(node, 'pointerdown', { clientX: 0, clientY: 0 });
    firePointerEvent(node, 'pointermove', { clientX: 60, clientY: 80 });

    // Simulate lost capture (e.g., another element steals pointer)
    node.dispatchEvent(new PointerEvent('lostpointercapture', { bubbles: true }));

    const saved = dragOffsets.get('lost-capture-test');
    expect(saved).toEqual({ dx: 60, dy: 80 });
    expect(node.classList.contains('dragging')).toBe(false);
  });

  test('pointercancel persists current visual position', () => {
    const { makeDraggable, dragOffsets } = loadApp();
    const node = createMockNode('cancel-test');
    makeDraggable(node);

    firePointerEvent(node, 'pointerdown', { clientX: 0, clientY: 0 });
    firePointerEvent(node, 'pointermove', { clientX: 25, clientY: 35 });

    firePointerEvent(node, 'pointercancel');

    const saved = dragOffsets.get('cancel-test');
    expect(saved).toEqual({ dx: 25, dy: 35 });
    expect(node.classList.contains('dragging')).toBe(false);
  });

  test('non-primary pointer events are ignored', () => {
    const { makeDraggable } = loadApp();
    const node = createMockNode('non-primary');
    makeDraggable(node);

    firePointerEvent(node, 'pointerdown', { isPrimary: false, clientX: 100, clientY: 100 });
    expect(node.classList.contains('dragging')).toBe(false);
  });

  test('right-click does not start drag', () => {
    const { makeDraggable } = loadApp();
    const node = createMockNode('right-click');
    makeDraggable(node);

    firePointerEvent(node, 'pointerdown', { button: 2, clientX: 100, clientY: 100 });
    expect(node.classList.contains('dragging')).toBe(false);
  });

  test('sequential drags accumulate offsets', () => {
    const { makeDraggable, dragOffsets } = loadApp();
    const node = createMockNode('accumulate');
    makeDraggable(node);

    // First drag: move 20, 10
    firePointerEvent(node, 'pointerdown', { clientX: 0, clientY: 0 });
    firePointerEvent(node, 'pointerup', { clientX: 20, clientY: 10 });

    // Second drag: move another 15, 5
    firePointerEvent(node, 'pointerdown', { clientX: 50, clientY: 50 });
    firePointerEvent(node, 'pointermove', { clientX: 65, clientY: 55 });
    firePointerEvent(node, 'pointerup', { clientX: 65, clientY: 55 });

    const saved = dragOffsets.get('accumulate');
    expect(saved).toEqual({ dx: 35, dy: 15 });
  });

  test('pointerup triggers arrow re-render so arrows stay attached', () => {
    const { renderPipeline, renderArrows, makeDraggable, dragOffsets } = loadApp();
    renderPipeline();

    // Setup mock rects
    const container = document.getElementById('pipeline');
    const containerRect = { left: 0, top: 0, right: 1400, bottom: 300, width: 1400, height: 300 };
    container.getBoundingClientRect = jest.fn(() => containerRect);
    const nodes = container.querySelectorAll('.agent-node');
    nodes.forEach((node, i) => {
      const x = 50 + i * 180;
      node.getBoundingClientRect = jest.fn(() => ({
        left: x, top: 100, right: x + 130, bottom: 160, width: 130, height: 60,
      }));
      node.setPointerCapture = jest.fn();
      node.releasePointerCapture = jest.fn();
    });
    Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true });

    renderArrows();
    const svgBefore = container.querySelector('svg.arrows-overlay');
    const pathsBefore = svgBefore ? svgBefore.querySelectorAll('path.arrow').length : 0;

    // Simulate drag on first node
    const firstNode = nodes[0];
    firePointerEvent(firstNode, 'pointerdown', { clientX: 100, clientY: 100 });
    firePointerEvent(firstNode, 'pointermove', { clientX: 130, clientY: 110 });
    firePointerEvent(firstNode, 'pointerup', { clientX: 130, clientY: 110 });

    // After pointerup, SVG should still exist with arrows
    const svgAfter = container.querySelector('svg.arrows-overlay');
    expect(svgAfter).not.toBeNull();
    const pathsAfter = svgAfter.querySelectorAll('path.arrow').length;
    expect(pathsAfter).toBe(pathsBefore);
  });

  test('pointerup applies final dx/dy to node CSS before re-rendering arrows', () => {
    const { makeDraggable, dragOffsets } = loadApp();
    const node = createMockNode('final-pos-test');
    makeDraggable(node);

    // Start drag at (100, 100), move to (120, 115), release at (130, 120)
    // The last pointermove is at (120, 115) but pointerup is at (130, 120)
    firePointerEvent(node, 'pointerdown', { clientX: 100, clientY: 100 });
    firePointerEvent(node, 'pointermove', { clientX: 120, clientY: 115 });

    // At this point CSS vars reflect the pointermove position
    expect(node.style.getPropertyValue('--drag-x')).toBe('20px');
    expect(node.style.getPropertyValue('--drag-y')).toBe('15px');

    // Release at a different position than last pointermove
    firePointerEvent(node, 'pointerup', { clientX: 130, clientY: 120 });

    // CSS vars must reflect the final pointerup position, not the last pointermove
    expect(node.style.getPropertyValue('--drag-x')).toBe('30px');
    expect(node.style.getPropertyValue('--drag-y')).toBe('20px');

    // dragOffsets must also match
    const saved = dragOffsets.get('final-pos-test');
    expect(saved).toEqual({ dx: 30, dy: 20 });
  });

  test('arrow endpoints match box final position after drag-end', () => {
    const { renderPipeline, renderArrows } = loadApp();
    renderPipeline();

    const container = document.getElementById('pipeline');
    const containerRect = { left: 0, top: 0, right: 1400, bottom: 300, width: 1400, height: 300 };
    container.getBoundingClientRect = jest.fn(() => containerRect);

    // After dragging, update mock rects to reflect the new position
    const dragDx = 30;
    const dragDy = 10;
    const nodes = container.querySelectorAll('.agent-node');
    nodes.forEach((node, i) => {
      const x = 50 + i * 180;
      // First node is dragged, others stay in place
      const offsetX = i === 0 ? dragDx : 0;
      const offsetY = i === 0 ? dragDy : 0;
      node.getBoundingClientRect = jest.fn(() => ({
        left: x + offsetX, top: 100 + offsetY,
        right: x + 130 + offsetX, bottom: 160 + offsetY,
        width: 130, height: 60,
      }));
      node.setPointerCapture = jest.fn();
      node.releasePointerCapture = jest.fn();
    });
    Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true });

    // Simulate the drag completing and arrows re-rendering
    const firstNode = nodes[0];
    firePointerEvent(firstNode, 'pointerdown', { clientX: 100, clientY: 100 });
    firePointerEvent(firstNode, 'pointermove', { clientX: 100 + dragDx, clientY: 100 + dragDy });
    firePointerEvent(firstNode, 'pointerup', { clientX: 100 + dragDx, clientY: 100 + dragDy });

    // Verify arrow endpoint matches second node's left edge (target)
    const svg = container.querySelector('svg.arrows-overlay');
    expect(svg).not.toBeNull();
    const arrowheads = svg.querySelectorAll('polygon.arrowhead');
    expect(arrowheads.length).toBeGreaterThan(0);

    // First arrowhead tip should point to the second node's left edge
    const firstArrowhead = arrowheads[0];
    const points = firstArrowhead.getAttribute('points');
    const [tipX, tipY] = points.trim().split(' ')[0].split(',').map(Number);
    // Second node: left = 50 + 1*180 = 230, cy = (100+160)/2 = 130
    expect(tipX).toBeCloseTo(230, 0);
    expect(tipY).toBeCloseTo(130, 0);
  });
});

describe('arrow rendering', () => {
  function mockGetBoundingClientRect(index) {
    const x = 50 + index * 180;
    return {
      left: x,
      top: 100,
      right: x + 130,
      bottom: 160,
      width: 130,
      height: 60,
    };
  }

  function setupMockRects() {
    const containerRect = { left: 0, top: 0, right: 1400, bottom: 300, width: 1400, height: 300 };
    const container = document.getElementById('pipeline');
    container.getBoundingClientRect = jest.fn(() => containerRect);

    const nodes = container.querySelectorAll('.agent-node');
    nodes.forEach((node, i) => {
      node.getBoundingClientRect = jest.fn(() => mockGetBoundingClientRect(i));
    });

    // Mock window.innerWidth for horizontal layout
    Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true });
  }

  test('SVG contains no <marker> elements after render', () => {
    const { renderPipeline, renderArrows } = loadApp();
    renderPipeline();
    setupMockRects();
    renderArrows();

    const svg = document.querySelector('svg.arrows-overlay');
    const markers = svg.querySelectorAll('marker');
    expect(markers.length).toBe(0);
  });

  test('SVG contains <polygon> elements with class arrowhead (one per forward arrow)', () => {
    const { renderPipeline, renderArrows } = loadApp();
    renderPipeline();
    setupMockRects();
    renderArrows();

    const svg = document.querySelector('svg.arrows-overlay');
    const arrowheads = svg.querySelectorAll('polygon.arrowhead');
    expect(arrowheads.length).toBe(6);
  });

  test('SVG contains <polygon> elements with class arrowhead-feedback', () => {
    const { renderPipeline, renderArrows } = loadApp();
    renderPipeline();
    setupMockRects();
    renderArrows();

    const svg = document.querySelector('svg.arrows-overlay');
    const feedbackHeads = svg.querySelectorAll('polygon.arrowhead-feedback');
    expect(feedbackHeads.length).toBe(2);
  });

  test('path.arrow elements have no marker-end attribute', () => {
    const { renderPipeline, renderArrows } = loadApp();
    renderPipeline();
    setupMockRects();
    renderArrows();

    const svg = document.querySelector('svg.arrows-overlay');
    const paths = svg.querySelectorAll('path.arrow');
    paths.forEach(p => {
      expect(p.getAttribute('marker-end')).toBeNull();
    });
  });

  test('polygon points are within expected range of target positions', () => {
    const { renderPipeline, renderArrows } = loadApp();
    renderPipeline();
    setupMockRects();
    renderArrows();

    const svg = document.querySelector('svg.arrows-overlay');
    const arrowheads = svg.querySelectorAll('polygon.arrowhead');
    arrowheads.forEach((polygon, i) => {
      const points = polygon.getAttribute('points');
      expect(points).not.toMatch(/NaN/);
      const pairs = points.trim().split(' ');
      expect(pairs.length).toBe(3);
      const [tipX, tipY] = pairs[0].split(',').map(Number);
      expect(Number.isNaN(tipX)).toBe(false);
      expect(Number.isNaN(tipY)).toBe(false);
    });
  });

  test('forward arrowhead tips land on target box left edge (horizontal)', () => {
    const { renderPipeline, renderArrows } = loadApp();
    renderPipeline();
    setupMockRects();
    renderArrows();

    const svg = document.querySelector('svg.arrows-overlay');
    const arrowheads = svg.querySelectorAll('polygon.arrowhead');
    arrowheads.forEach((polygon, i) => {
      const points = polygon.getAttribute('points');
      const [tipX, tipY] = points.trim().split(' ')[0].split(',').map(Number);
      // Tip should be at target box's left edge (x = 50 + (i+1)*180) and cy (130)
      const expectedX = 50 + (i + 1) * 180;
      const expectedY = 130; // (100 + 160) / 2
      expect(tipX).toBeCloseTo(expectedX, 0);
      expect(tipY).toBeCloseTo(expectedY, 0);
    });
  });

  test('feedback arrowhead tips land on target box bottom edge (horizontal)', () => {
    const { renderPipeline, renderArrows } = loadApp();
    renderPipeline();
    setupMockRects();
    renderArrows();

    const svg = document.querySelector('svg.arrows-overlay');
    const feedbackHeads = svg.querySelectorAll('polygon.arrowhead-feedback');
    // feedbackLoops: verifier→planner and validator→implementer
    // In horizontal layout, endY should be target.bottom (160)
    feedbackHeads.forEach((polygon) => {
      const points = polygon.getAttribute('points');
      const [tipX, tipY] = points.trim().split(' ')[0].split(',').map(Number);
      expect(tipY).toBeCloseTo(160, 0); // target.bottom = 160
    });
  });
});
