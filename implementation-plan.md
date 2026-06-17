# Implementation Plan

## Goal
Transform the pipeline visualizer from a clean/corporate light theme to a construction/foreman-themed aesthetic with pixel art styling, a foreman mascot, and construction-site color palette.

## Steps

### Step 1: Add pixel font and favicon to `index.html`
- **File:** `index.html`
- **Action:** modify (create from `origin/t-haustin/rework-theme-lighter-colors` branch)
- **Details:**
  - Add Google Fonts import for "Press Start 2P" (headings/branding) and "Silkscreen" (UI elements)
  - Add inline SVG foreman mascot (32×32 pixel grid character with hard hat, clipboard, tool belt) in the header next to the title
  - Update `<h1>` to include mascot SVG inline before "Foreman" text
  - Add a subtitle: "Building your pipeline, one agent at a time"
  - Add a `<link rel="icon">` with a base64-encoded 16×16 pixel hard-hat favicon (SVG data URI)
  - Wrap header content in a flex container for mascot + text alignment
- **Verify:** Open in browser; pixel font loads, mascot displays, favicon appears in tab

### Step 2: Create `assets/` directory with mascot variant
- **File:** `assets/foreman-mascot.svg`
- **Action:** create
- **Details:**
  - Create a standalone SVG file of the foreman mascot at 64×64 pixel grid
  - Pixel-art style: hard hat (safety yellow), blue overalls, clipboard in hand, tool belt
  - Use `shape-rendering: crispEdges` for pixelated look
  - This file serves as the canonical mascot reference; the inline version in `index.html` is a simplified 32×32 variant
- **Verify:** SVG renders correctly when opened directly in browser

### Step 3: Rework CSS color palette and construction theme in `css/style.css`
- **File:** `css/style.css`
- **Action:** modify
- **Details:**
  - Replace `:root` CSS variables with construction palette:
    - `--bg`: `#f5f0e8` (warm concrete/tan)
    - `--surface`: `#fffef8` (off-white with warmth)
    - `--text`: `#2c2416` (dark brown-charcoal)
    - `--text-muted`: `#7a6e5f` (warm gray)
    - `--border`: `#d4c9a8` (tan border)
    - `--accent-yellow`: `#f5c518` (safety yellow)
    - `--accent-orange`: `#f47c20` (hard-hat orange)
    - `--accent-blue`: `#3d7ab5` (blueprint blue)
    - `--caution-stripe`: repeating-linear-gradient for yellow/black caution tape
  - Keep agent color variables but warm them slightly to fit the palette
  - Add `font-family: 'Press Start 2P', monospace` for `header h1`
  - Add `font-family: 'Silkscreen', monospace` for `.stage-badge`, `.artifact-badge`, and `.agent-name`
  - Keep body text as system sans-serif for readability
  - Update `body` background to `var(--bg)` with a subtle blueprint grid pattern using `repeating-linear-gradient` (light blue lines every 20px)
  - Style `.agent-node`:
    - Replace left border with a top border using `var(--accent-yellow)` 4px solid (caution-tape style)
    - Add a subtle blueprint grid background to cards using `repeating-linear-gradient`
    - Use `border-radius: 4px` (more angular/industrial instead of 12px rounded)
    - Add a very subtle `box-shadow` with orange tint
  - Style `header`:
    - Add a caution-tape bottom border using the repeating yellow/black gradient
    - Set background to a slightly darker warm tone
    - Use flex layout for mascot + text
  - Style `#agent-detail` panel:
    - Angular border-radius (6px instead of 16px)
    - Top border with caution-tape gradient
    - Slightly off-white background
  - Add `.mascot` class for header mascot sizing and optional idle animation (subtle bounce)
  - Add `image-rendering: pixelated` and `image-rendering: crisp-edges` for mascot/pixel elements
  - Update `.arrow` stroke color from `#94a3b8` to `var(--accent-blue)` (blueprint blue)
  - Update `.arrow.feedback` stroke color from `#f87171` to `var(--accent-orange)` (construction orange)
  - Update `.artifact-label` fill from `#dc2626` to `var(--accent-orange)`
  - Add keyframe `@keyframes hardHatBounce` for subtle mascot animation
- **Verify:** Page renders with construction theme; cards, arrows, and text are legible; responsive layout still works

### Step 4: Update JS arrow markers and add construction icons to nodes in `js/app.js`
- **File:** `js/app.js`
- **Action:** modify
- **Details:**
  - Update SVG arrowhead marker fills:
    - `#arrowhead` polygon fill: change from `#94a3b8` to `#3d7ab5` (blueprint blue)
    - `#arrowhead-feedback` polygon fill: change from `#f87171` to `#f47c20` (construction orange)
  - Add construction emoji/icon to each agent node based on role:
    - researcher: 🔍 (magnifying glass / surveyor)
    - planner: 📐 (drafting/planning)
    - verifier: 🦺 (safety vest / inspector)
    - implementer: 🔨 (hammer / builder)
    - validator: ✅ (check / QA)
    - build-watcher: 🏗️ (construction crane)
    - post-mortem: 📋 (clipboard / report)
  - Insert the emoji before the agent name in the node HTML template
  - Update the `artifact-badge` emoji from 📄 to 🗂️ (more "filed plans" feeling)
  - Optionally add a small inline pixel-mascot SVG to the loading/empty state if pipeline is empty
- **Verify:** Arrows render in blueprint blue/construction orange; agent nodes show role icons; clicking nodes still opens detail panel

### Step 5: Add construction-themed detail panel icons in `js/app.js`
- **File:** `js/app.js`
- **Action:** modify
- **Details:**
  - In `showAgentDetail()`, add the same construction emoji before the agent name in the detail panel `<h2>`
  - Add a small mascot SVG at the bottom of the detail panel as a "stamp" or watermark (reduced opacity)
- **Verify:** Detail panel shows themed icons and mascot watermark

### Step 6: Add "Under Construction" empty/loading state
- **File:** `js/app.js`
- **Action:** modify
- **Details:**
  - Before `renderPipeline()` populates, show a brief "Under Construction" message with the mascot holding a sign
  - This is a minor enhancement — add a placeholder div that gets replaced once nodes render
  - Use inline SVG of mascot with hard hat and "Building..." text
- **Verify:** Brief construction-themed state appears before pipeline renders (or on empty data)

## Build & Test
- **Build:** No build system — open `index.html` in a browser directly
- **Test:** Visual inspection:
  1. Verify pixel font loads (check network tab for Google Fonts)
  2. Verify mascot SVG renders in header at correct size
  3. Verify construction color palette is applied (warm background, yellow accents)
  4. Verify arrows are blueprint blue (forward) and construction orange (feedback)
  5. Verify cards have angular style with caution-tape top border
  6. Verify responsive layout at ≤900px still works (vertical mode)
  7. Verify agent detail panel opens/closes correctly with themed styling
  8. Verify favicon appears in browser tab
  9. Verify no console errors

## Rollback
- All source files are tracked in git on branch `origin/t-haustin/rework-theme-lighter-colors`
- To rollback: `git checkout origin/t-haustin/rework-theme-lighter-colors -- index.html css/style.css js/app.js`
- Remove `assets/` directory if created: `rm -rf assets/`
