# Implementation Plan

## Goal
Create a responsive web-based visualizer showing the 7-agent pipeline flow with boxes, arrows, feedback loops, and multi-model indicators.

## Steps

### Step 1: Create project structure and package.json
- **File:** `package.json`
- **Action:** create
- **Details:** Minimal package.json with project name, version, description, and a `start` script using a simple static server (e.g., `npx serve .`). No build dependencies required.
- **Verify:** `cat package.json` confirms valid JSON.

### Step 2: Create index.html
- **File:** `index.html`
- **Action:** create
- **Details:**
  - HTML5 boilerplate with responsive viewport meta tag
  - Title: "Agent Pipeline Visualizer"
  - Link to `css/style.css`
  - Main container with:
    - Header: project title and brief description
    - `<div id="pipeline">` — container for the SVG-based pipeline diagram
    - `<div id="agent-detail">` — sidebar/modal for agent details on click
  - Script tag loading `js/app.js` (defer)
- **Verify:** Open in browser, confirm page loads without errors.

### Step 3: Create css/style.css
- **File:** `css/style.css`
- **Action:** create
- **Details:**
  - CSS reset / box-sizing
  - CSS custom properties for agent colors:
    - Researcher: `#4A90D9` (blue)
    - Planner: `#7B68EE` (purple)
    - Verifier: `#E67E22` (orange)
    - Implementer: `#27AE60` (green)
    - Validator: `#E74C3C` (red)
    - Build Watcher: `#F39C12` (gold)
    - Post-Mortem: `#8E44AD` (dark purple)
  - `.pipeline-container` — responsive flex/grid layout (horizontal desktop, vertical mobile)
  - `.agent-node` — rounded rectangle cards with shadow, border-left color-coded, hover effect
  - `.agent-node.multi-model` — stacked appearance (pseudo-elements for layered look)
  - `.arrow` — SVG path styling with animated dash-offset for flow effect
  - `.arrow.feedback` — dashed stroke for NEEDS_REVISION / FAIL loops
  - `.artifact-label` — small pill-shaped labels on arrows
  - `.status-indicator` — colored dot (idle/active/pass/fail)
  - Media query for mobile: stack vertically, arrows rotate
  - Keyframe animations: `@keyframes flowPulse` for arrow animation, `@keyframes fadeIn` for nodes
- **Verify:** Styles load without 404; layout renders correctly.

### Step 4: Create js/app.js
- **File:** `js/app.js`
- **Action:** create
- **Details:**
  - Define agent data array:
    ```js
    const agents = [
      { id: 'researcher', name: 'Researcher', stage: 1, description: 'Deep codebase analysis', artifact: 'research-report.md', multiModel: false },
      { id: 'planner', name: 'Planner', stage: 2, description: 'Creates implementation plan from research', artifact: 'implementation-plan.md', multiModel: false },
      { id: 'verifier', name: 'Verifier', stage: 3, description: 'Independent plan review', artifact: null, multiModel: true, outcomes: ['APPROVED', 'NEEDS_REVISION'] },
      { id: 'implementer', name: 'Implementer', stage: 4, description: 'Executes the plan by making code changes', artifact: null, multiModel: false },
      { id: 'validator', name: 'Validator', stage: 5, description: 'Verifies implementation, runs build/tests', artifact: 'implementation-issues.md', multiModel: true, outcomes: ['PASS', 'FAIL'] },
      { id: 'build-watcher', name: 'Build Watcher', stage: 6, description: 'Monitors CI after PR push', artifact: null, multiModel: false },
      { id: 'post-mortem', name: 'Post-Mortem', stage: 7, description: 'Pipeline aftercare and learnings', artifact: 'post-mortem-findings.md', multiModel: false },
    ];
    ```
  - `renderPipeline()` function:
    - Creates agent node DOM elements inside `#pipeline`
    - Each node: div with class `.agent-node` (+ `.multi-model` if applicable), containing icon placeholder, name, description, stage number, and artifact badge
  - `renderArrows()` function:
    - Creates an SVG overlay positioned absolutely over the pipeline container
    - Draws SVG `<path>` elements connecting sequential agents (uses `getBoundingClientRect()` to calculate positions)
    - Forward arrows: solid with animated flow
    - Feedback arrows (Verifier→Planner, Validator→Implementer): curved dashed paths below/above the main flow
    - Artifact labels positioned along arrow midpoints
  - `handleResize()` — recalculates arrow positions on window resize (debounced)
  - `showAgentDetail(agentId)` — click handler that populates `#agent-detail` panel with full agent info
  - `initAnimation()` — optional: sequentially highlights agents to demo the pipeline flow
  - Event listeners: click on agent nodes, window resize, DOMContentLoaded
- **Verify:** Page renders all 7 agent boxes with connecting arrows; clicking an agent shows detail; resize works.

### Step 5: Create README.md
- **File:** `README.md`
- **Action:** create
- **Details:**
  - Project title and description
  - How to run: `npx serve .` or just open `index.html`
  - Pipeline overview (text description of the 7 stages)
  - Tech stack: HTML, CSS, vanilla JS, SVG
- **Verify:** README renders correctly on GitHub.

## Build & Test
- Build: No build step required (static files)
- Test: Open `index.html` in a browser or run `npx serve .` and verify:
  1. All 7 agent nodes render with correct names and colors
  2. Arrows connect agents in correct order
  3. Feedback loops (Verifier→Planner, Validator→Implementer) are visually distinct
  4. Multi-model agents (Verifier, Validator) have stacked/grouped appearance
  5. Clicking an agent shows its details
  6. Layout is responsive (resize browser to verify mobile layout)
  7. No console errors

## Rollback
- Since this is a greenfield project, rollback is simply `git reset --hard HEAD~1` or delete the created files:
  ```bash
  rm -rf index.html css/ js/ package.json README.md
  ```
