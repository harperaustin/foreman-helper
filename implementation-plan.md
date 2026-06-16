# Implementation Plan

## Goal
Completely rework the arrow UI in the pipeline visualizer so arrows render cleanly between blocks with proper spacing, smooth curves, and visual clarity.

## Prerequisites
The application source files (`index.html`, `css/style.css`, `js/app.js`) do not exist on this branch. They must be brought in from a sibling branch (e.g., `t-haustin/pr-4970643f`) before modifications can be made.

## Steps

### Step 1: Scaffold application files from existing branch
- **Files:** `index.html`, `css/style.css`, `js/app.js`
- **Action:** create (copy from branch `t-haustin/pr-4970643f`)
- **Details:** Run `git checkout t-haustin/pr-4970643f -- index.html css/style.css js/app.js` to bring the baseline files into this branch.
- **Verify:** All three files exist and `index.html` loads in a browser without errors.

### Step 2: Increase pipeline gap and container width (CSS)
- **File:** `css/style.css`
- **Action:** modify
- **Details:**
  - Change `#pipeline` `gap` from `1rem` to `3rem`
  - Change `#pipeline` `padding` from `3rem 1rem` to `3rem 2rem`
  - Change `main` `max-width` from `1200px` to `1400px`
  - In the `@media (max-width: 900px)` block, change `#pipeline` `gap` from `2rem` to `3rem`
- **Verify:** Nodes are visibly spaced further apart, with room for arrows between them.

### Step 3: Rework forward arrows to use smooth cubic Bézier curves (JS)
- **File:** `js/app.js`
- **Action:** modify
- **Details:** In `renderArrows()`, replace the forward arrow straight-line (`L`) paths with smooth cubic Bézier curves:
  - Horizontal: change from `M ${startX} ${startY} L ${endX} ${endY}` to:
    ```js
    const midX = (startX + endX) / 2;
    d = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
    ```
  - Vertical: same approach with `midY`:
    ```js
    const midY = (startY + endY) / 2;
    d = `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
    ```
  - Increase edge offsets from `2` to `6` (e.g., `from.right + 6`, `to.left - 6`) so arrows don't start/end flush against nodes.
- **Verify:** Forward arrows render as smooth curves between nodes, not overlapping node edges.

### Step 4: Rework feedback arrows with larger routing offset and smoother arcs (JS)
- **File:** `js/app.js`
- **Action:** modify
- **Details:** In `renderArrows()`, update feedback arrow geometry:
  - **Horizontal layout:**
    - Change `from.bottom + 10` start offset to `from.bottom + 14`
    - Change `to.bottom + 10` end offset to `to.bottom + 14`
    - Increase `offset` from `40` to `60` (routes further below the nodes)
    - Increase arc radius cap from `8` to `12`: `Math.min(12, ...)`
  - **Vertical layout:**
    - Change `from.left - 10` start offset to `from.left - 14`
    - Change `to.left - 10` end offset to `to.left - 14`
    - Change `offset` from `-35` to `-55` (routes further left of the nodes)
    - Increase arc radius cap from `8` to `12`
  - Update feedback label positions to match new offsets:
    - Horizontal: change `from.bottom + 45` to `from.bottom + 60 + 10` (i.e., `from.bottom + 70`)
    - Vertical: change `from.left - 35` to `from.left - 55`
- **Verify:** Feedback arrows route visibly below (or left of) the nodes with smooth rounded corners, labels centered on the path.

### Step 5: Increase arrowhead marker size for better visibility (JS)
- **File:** `js/app.js`
- **Action:** modify
- **Details:** In the SVG `<defs>` markers within `renderArrows()`:
  - Change `markerWidth="6" markerHeight="5"` to `markerWidth="8" markerHeight="6"` for both `#arrowhead` and `#arrowhead-feedback`
  - Update `refX` from `5.5` to `7.5` and `refY` from `2.5` to `3`
  - Update polygon points from `"0 0, 6 2.5, 0 5"` to `"0 0, 8 3, 0 6"`
- **Verify:** Arrowheads are proportionally larger and more visible.

### Step 6: Add subtle arrow styling enhancements (CSS)
- **File:** `css/style.css`
- **Action:** modify
- **Details:**
  - Change `.arrow` `stroke-width` from `2.5` to `2`
  - Add `filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));` to `.arrow` for subtle depth
  - Change `.arrow.feedback` `stroke-dasharray` from `4 3` to `6 4` for more visible dashes
  - Change `.arrow.feedback` `stroke-width` from `2` to `1.8`
- **Verify:** Arrows appear refined with subtle shadow; feedback dashes are more distinct.

## Build & Test
- **Build:** No build step required (plain HTML/CSS/JS).
- **Test:** Open `index.html` in a browser at viewport widths of 1440px, 1024px, and 800px (below 900px breakpoint). Verify:
  1. Forward arrows curve smoothly between all 7 nodes without overlapping node borders.
  2. Feedback arrows route cleanly below/beside nodes with visible rounded corners.
  3. Feedback labels are readable and centered on the feedback path.
  4. No horizontal overflow or clipping occurs at any tested width.
  5. Arrowheads point correctly at destination nodes.

## Rollback
- Run `git checkout t-haustin/pr-4970643f -- index.html css/style.css js/app.js` to restore original files, or `git checkout HEAD -- .` to revert all changes on this branch.
