# Agent Pipeline Visualizer

A responsive web-based visualizer showing the 7-agent foreman-helper pipeline flow with boxes, arrows, feedback loops, and multi-model indicators.

## How to Run

Open `index.html` directly in a browser, or serve it locally:

```bash
npx serve .
```

## Pipeline Overview

The visualizer displays the following 7-stage agent pipeline:

| Stage | Agent | Description |
|-------|-------|-------------|
| 1 | **Researcher** | Deep codebase analysis |
| 2 | **Planner** | Creates implementation plan from research |
| 3 | **Verifier** | Independent plan review (multi-model) |
| 4 | **Implementer** | Executes the plan by making code changes |
| 5 | **Validator** | Verifies implementation, runs build/tests (multi-model) |
| 6 | **Build Watcher** | Monitors CI after PR push |
| 7 | **Post-Mortem** | Pipeline aftercare and learnings |

### Feedback Loops

- **Verifier → Planner**: When the plan receives `NEEDS_REVISION`
- **Validator → Implementer**: When validation returns `FAIL`

### Multi-Model Agents

The Verifier and Validator agents use multiple models for consensus, indicated by a stacked card appearance in the visualization.

## Tech Stack

- HTML5
- CSS3 (custom properties, flexbox, animations)
- Vanilla JavaScript (ES6+)
- SVG (dynamically generated arrows)

## Features

- Color-coded agent nodes
- Animated flow arrows between stages
- Distinct feedback loop visualization (dashed red paths)
- Multi-model agent stacked appearance
- Click-to-inspect agent detail panel
- Responsive layout (horizontal on desktop, vertical on mobile)
