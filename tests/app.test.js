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
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  test('creates agent nodes in the DOM', () => {
    const { renderPipeline } = loadApp();
    renderPipeline();
    jest.runAllTimers();
    const nodes = document.querySelectorAll('.agent-node');
    expect(nodes.length).toBe(7);
  });

  test('each node has data-agent-id', () => {
    const { renderPipeline, agents } = loadApp();
    renderPipeline();
    jest.runAllTimers();
    agents.forEach(agent => {
      const node = document.querySelector(`[data-agent-id="${agent.id}"]`);
      expect(node).not.toBeNull();
    });
  });

  test('multi-model agents get multi-model class', () => {
    const { renderPipeline, agents } = loadApp();
    renderPipeline();
    jest.runAllTimers();
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
});
