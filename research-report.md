# Research Report

## Summary
This is an empty repository (no source code, only `.github/agents/` config files). The task is to create a greenfield visualizer web application that demonstrates an agent harness system with 7 agents: researcher, planner, verifier, implementer, validator, build-watcher, and post-mortem. The visualization should show the pipeline flow with boxes and arrows in a clean, responsive UI.

## Relevant Files
- `.github/agents/researcher.agent.md` — Defines Stage 1: deep codebase analysis
- `.github/agents/planner.agent.md` — Defines Stage 2: creates implementation plan from research
- `.github/agents/verifier.agent.md` — Defines Stage 3: independent plan review (multi-model), emits APPROVED/NEEDS_REVISION
- `.github/agents/implementer.agent.md` — Defines Stage 4: executes the plan by making code changes
- `.github/agents/validator.agent.md` — Defines Stage 5: verifies implementation (multi-model), runs build/tests
- `.github/agents/build-watcher.agent.md` — Defines Stage 6: monitors CI after PR push
- `.github/agents/post-mortem.agent.md` — Defines Stage 7: best-effort pipeline aftercare and learnings

## Conventions Observed
- Agent definitions use YAML frontmatter (`name`, `description`, `tools` array) followed by Markdown instructions
- Pipeline flow: Researcher → Planner → Verifier (loop back to Planner if NEEDS_REVISION) → Implementer → Validator (loop back if FAIL) → Build Watcher → Post-Mortem
- Multi-model stages: Verifier and Validator are noted as "multi-model" in the task description (multiple models review independently)
- Output artifacts: `research-report.md`, `implementation-plan.md`, `implementation-issues.md`, `post-mortem-findings.md`

## Dependencies & Impact
- No existing source code — this is a greenfield project
- No package.json, no framework chosen yet
- No CI/CD workflows configured (only agent definitions)

## Risks & Open Questions
- **Framework choice:** No constraints specified. A lightweight static SPA (vanilla HTML/CSS/JS or a single-framework like React/Vue) would work. Recommend a simple static site (HTML + CSS + minimal JS) for maximum portability, or React for richer interactivity.
- **Visualization library:** Could use SVG/CSS for simple box-and-arrow diagrams, or a library like D3.js, Mermaid, or Dagre for graph layout.
- **"Multi-model" representation:** The verifier and validator are called "multi-model" — the UI should visually show multiple parallel model instances feeding into a consensus.
- **Interactivity scope:** Unclear if the visualization should be static (explanatory) or dynamic (showing live pipeline state). Recommend starting with an animated/interactive static demo.
- **Deployment:** No hosting requirements specified. A simple `index.html` + assets would be easiest to deploy anywhere.

## Recommended Approach

### Technology Stack
- **HTML + CSS + vanilla JavaScript** (or a lightweight build with Vite + React if richer interactivity is desired)
- **SVG-based diagram** with CSS animations for the pipeline flow
- No heavy dependencies — keep it clean and fast

### Architecture
```
index.html          — Main page with responsive layout
css/style.css       — Clean modern styling (CSS Grid/Flexbox, animations)
js/app.js           — Pipeline visualization logic, SVG rendering, interactions
```

### Pipeline Visualization Structure
```
[Researcher] → [Planner] → [Verifier ×N] →(APPROVED)→ [Implementer] → [Validator ×N] →(PASS)→ [Build Watcher] → [Post-Mortem]
                   ↑            |                              ↑              |
                   └──(NEEDS_REVISION)                         └──(FAIL)──────┘
```

### Key UI Elements
1. **Agent nodes** — Rounded boxes with icon, name, description, and status indicator
2. **Flow arrows** — Animated SVG paths showing data flow direction
3. **Feedback loops** — Dashed arrows for NEEDS_REVISION and FAIL paths
4. **Multi-model indicators** — Verifier and Validator shown as stacked/grouped boxes (multiple models)
5. **Artifact labels** — Small labels on arrows showing what data passes between stages
6. **Responsive layout** — Horizontal on desktop, vertical on mobile
7. **Color coding** — Each agent type gets a distinct color; status colors for pass/fail/in-progress

### Implementation Steps
1. Create `index.html` with semantic structure and meta tags
2. Create `css/style.css` with responsive grid layout, agent card styles, and animations
3. Create `js/app.js` with SVG arrow rendering and optional interaction (click agent for details)
4. Add a `package.json` (optional) if using a build tool, or keep it zero-dependency
5. Add a README.md explaining the project
