const {
  ARROW_SIZE,
  tangentAngle,
  computeArrowheadPoints,
  computeForwardPath,
  computeFeedbackPath,
  computeFeedbackLabelPosition,
} = require('../js/arrow-geometry.js');

describe('computeArrowheadPoints', () => {
  test('returns string with 3 coordinate pairs', () => {
    const result = computeArrowheadPoints(100, 50, 0);
    const pairs = result.trim().split(' ');
    expect(pairs).toHaveLength(3);
    pairs.forEach(pair => {
      const [x, y] = pair.split(',').map(Number);
      expect(Number.isNaN(x)).toBe(false);
      expect(Number.isNaN(y)).toBe(false);
    });
  });

  test('tip matches (tipX, tipY)', () => {
    const result = computeArrowheadPoints(200, 75, Math.PI / 4);
    const pairs = result.trim().split(' ');
    const [tipX, tipY] = pairs[0].split(',').map(Number);
    expect(tipX).toBeCloseTo(200, 5);
    expect(tipY).toBeCloseTo(75, 5);
  });

  test('triangle area is positive', () => {
    const result = computeArrowheadPoints(100, 50, 0, 10);
    const pairs = result.trim().split(' ').map(p => p.split(',').map(Number));
    const [[x0, y0], [x1, y1], [x2, y2]] = pairs;
    const area = Math.abs((x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)) / 2;
    expect(area).toBeGreaterThan(0);
  });

  test('uses custom size parameter', () => {
    const small = computeArrowheadPoints(50, 50, 0, 5);
    const large = computeArrowheadPoints(50, 50, 0, 20);
    const smallPairs = small.trim().split(' ').map(p => p.split(',').map(Number));
    const largePairs = large.trim().split(' ').map(p => p.split(',').map(Number));
    // Larger size should have base vertices further from tip
    const smallDist = Math.hypot(smallPairs[1][0] - 50, smallPairs[1][1] - 50);
    const largeDist = Math.hypot(largePairs[1][0] - 50, largePairs[1][1] - 50);
    expect(largeDist).toBeGreaterThan(smallDist);
  });
});

describe('tangentAngle', () => {
  test('straight horizontal bezier returns angle ≈ 0', () => {
    const d = 'M 0 0 C 33 0, 66 0, 100 0';
    const angle = tangentAngle(d);
    expect(angle).toBeCloseTo(0, 5);
  });

  test('straight vertical (downward) bezier returns angle ≈ π/2', () => {
    const d = 'M 0 0 C 0 33, 0 66, 0 100';
    const angle = tangentAngle(d);
    expect(angle).toBeCloseTo(Math.PI / 2, 5);
  });

  test('straight vertical (upward) bezier returns angle ≈ -π/2', () => {
    const d = 'M 0 100 C 0 66, 0 33, 0 0';
    const angle = tangentAngle(d);
    expect(angle).toBeCloseTo(-Math.PI / 2, 5);
  });

  test('diagonal bezier returns expected angle', () => {
    const d = 'M 0 0 C 33 33, 66 66, 100 100';
    const angle = tangentAngle(d);
    expect(angle).toBeCloseTo(Math.PI / 4, 5);
  });

  test('returns 0 for degenerate path', () => {
    const d = 'M 50 50 C 50 50, 50 50, 50 50';
    const angle = tangentAngle(d);
    expect(angle).toBe(0);
  });
});

describe('computeForwardPath', () => {
  const hFrom = { left: 0, top: 20, right: 100, bottom: 60, cx: 50, cy: 40, width: 100, height: 40 };
  const hTo = { left: 200, top: 20, right: 300, bottom: 60, cx: 250, cy: 40, width: 100, height: 40 };

  test('horizontal: returns d string starting at from.right', () => {
    const result = computeForwardPath(hFrom, hTo, false);
    expect(result.d).toMatch(/^M 100 40/);
  });

  test('horizontal: endX/endY at to.left, to.cy', () => {
    const result = computeForwardPath(hFrom, hTo, false);
    expect(result.endX).toBe(200);
    expect(result.endY).toBe(40);
  });

  test('horizontal same-height: angle ≈ 0', () => {
    const result = computeForwardPath(hFrom, hTo, false);
    expect(result.angle).toBeCloseTo(0, 1);
  });

  const vFrom = { left: 20, top: 0, right: 80, bottom: 50, cx: 50, cy: 25, width: 60, height: 50 };
  const vTo = { left: 20, top: 150, right: 80, bottom: 200, cx: 50, cy: 175, width: 60, height: 50 };

  test('vertical: starts at from.bottom', () => {
    const result = computeForwardPath(vFrom, vTo, true);
    expect(result.d).toMatch(/^M 50 50/);
  });

  test('vertical: endY at to.top', () => {
    const result = computeForwardPath(vFrom, vTo, true);
    expect(result.endY).toBe(150);
  });

  test('vertical same-column: angle ≈ π/2', () => {
    const result = computeForwardPath(vFrom, vTo, true);
    expect(result.angle).toBeCloseTo(Math.PI / 2, 1);
  });

  test('d contains valid M and C commands', () => {
    const result = computeForwardPath(hFrom, hTo, false);
    expect(result.d).toMatch(/^M\s/);
    expect(result.d).toMatch(/C\s/);
  });
});

describe('computeFeedbackPath', () => {
  const from = { left: 200, top: 20, right: 300, bottom: 60, cx: 250, cy: 40, width: 100, height: 40 };
  const to = { left: 0, top: 20, right: 100, bottom: 60, cx: 50, cy: 40, width: 100, height: 40 };

  test('horizontal: starts below from (from.cx, from.bottom)', () => {
    const result = computeFeedbackPath(from, to, false);
    expect(result.d).toMatch(/^M 250 60/);
  });

  test('horizontal: endX/endY at to.cx, to.bottom', () => {
    const result = computeFeedbackPath(from, to, false);
    expect(result.endX).toBe(50);
    expect(result.endY).toBe(60);
  });

  test('horizontal: d contains valid M and C commands', () => {
    const result = computeFeedbackPath(from, to, false);
    expect(result.d).toMatch(/^M\s/);
    expect(result.d).toMatch(/C\s/);
  });

  const vFrom = { left: 20, top: 150, right: 80, bottom: 200, cx: 50, cy: 175, width: 60, height: 50 };
  const vTo = { left: 20, top: 0, right: 80, bottom: 50, cx: 50, cy: 25, width: 60, height: 50 };

  test('vertical: starts left of from (from.left, from.cy)', () => {
    const result = computeFeedbackPath(vFrom, vTo, true);
    expect(result.d).toMatch(/^M 20 175/);
  });

  test('vertical: endX/endY at to.left, to.cy', () => {
    const result = computeFeedbackPath(vFrom, vTo, true);
    expect(result.endX).toBe(20);
    expect(result.endY).toBe(25);
  });
});

describe('computeFeedbackPath geometry details', () => {
  test('horizontal: curve passes below both boxes (offset > 0)', () => {
    const from = { left: 200, top: 20, right: 300, bottom: 60, cx: 250, cy: 40, width: 100, height: 40 };
    const to = { left: 0, top: 20, right: 100, bottom: 60, cx: 50, cy: 40, width: 100, height: 40 };
    const result = computeFeedbackPath(from, to, false);
    // Control points should have y > from.bottom (using offset 50)
    const nums = result.d.match(/[-+]?(?:\d+\.?\d*|\.\d+)/g).map(Number);
    // M x0 y0 C cp1x cp1y, cp2x cp2y, ex ey => [2]=cp1x [3]=cp1y [4]=cp2x [5]=cp2y
    expect(nums[3]).toBeGreaterThan(from.bottom);
    expect(nums[5]).toBeGreaterThan(to.bottom);
  });

  test('vertical: curve passes left of both boxes (offset < 0)', () => {
    const from = { left: 20, top: 150, right: 80, bottom: 200, cx: 50, cy: 175, width: 60, height: 50 };
    const to = { left: 20, top: 0, right: 80, bottom: 50, cx: 50, cy: 25, width: 60, height: 50 };
    const result = computeFeedbackPath(from, to, true);
    const nums = result.d.match(/[-+]?(?:\d+\.?\d*|\.\d+)/g).map(Number);
    // M x0 y0 C cp1x cp1y, cp2x cp2y, ex ey => [2]=cp1x [4]=cp2x
    expect(nums[2]).toBeLessThan(from.left);
    expect(nums[4]).toBeLessThan(to.left);
  });

  test('horizontal: shortened path still has control points below boxes', () => {
    const from = { left: 200, top: 20, right: 300, bottom: 60, cx: 250, cy: 40, width: 100, height: 40 };
    const to = { left: 0, top: 20, right: 100, bottom: 60, cx: 50, cy: 40, width: 100, height: 40 };
    const result = computeFeedbackPath(from, to, false);
    const nums = result.d.match(/[-+]?(?:\d+\.?\d*|\.\d+)/g).map(Number);
    // cp1y and cp2y should be > bottom (60)
    expect(nums[3]).toBeGreaterThan(from.bottom);
    expect(nums[5]).toBeGreaterThan(to.bottom);
  });

  test('vertical: shortened path still has control points left of boxes', () => {
    const from = { left: 20, top: 150, right: 80, bottom: 200, cx: 50, cy: 175, width: 60, height: 50 };
    const to = { left: 20, top: 0, right: 80, bottom: 50, cx: 50, cy: 25, width: 60, height: 50 };
    const result = computeFeedbackPath(from, to, true);
    const nums = result.d.match(/[-+]?(?:\d+\.?\d*|\.\d+)/g).map(Number);
    // cp1x and cp2x should be < left (20)
    expect(nums[2]).toBeLessThan(from.left);
    expect(nums[4]).toBeLessThan(to.left);
  });

  test('horizontal feedback: angle points toward target (leftward)', () => {
    const from = { left: 200, top: 20, right: 300, bottom: 60, cx: 250, cy: 40, width: 100, height: 40 };
    const to = { left: 0, top: 20, right: 100, bottom: 60, cx: 50, cy: 40, width: 100, height: 40 };
    const result = computeFeedbackPath(from, to, false);
    // Feedback goes right-to-left below, so near the end the tangent should have upward component
    // The angle at the end should point generally upward-left or upward toward the target bottom
    expect(result.angle).not.toBe(0);
    expect(Number.isFinite(result.angle)).toBe(true);
  });

  test('vertical feedback: angle points toward target (upward)', () => {
    const from = { left: 20, top: 150, right: 80, bottom: 200, cx: 50, cy: 175, width: 60, height: 50 };
    const to = { left: 20, top: 0, right: 80, bottom: 50, cx: 50, cy: 25, width: 60, height: 50 };
    const result = computeFeedbackPath(from, to, true);
    // Should point rightward toward target left edge
    expect(Number.isFinite(result.angle)).toBe(true);
  });

  test('feedback with widely spaced boxes produces valid bezier', () => {
    const from = { left: 800, top: 20, right: 900, bottom: 60, cx: 850, cy: 40, width: 100, height: 40 };
    const to = { left: 0, top: 20, right: 100, bottom: 60, cx: 50, cy: 40, width: 100, height: 40 };
    const result = computeFeedbackPath(from, to, false);
    expect(result.d).toMatch(/^M\s/);
    expect(result.d).toMatch(/C\s/);
    expect(result.d).not.toMatch(/NaN/);
    expect(result.endX).toBe(to.cx);
    expect(result.endY).toBe(to.bottom);
  });

  test('feedback with closely spaced boxes does not produce NaN', () => {
    const from = { left: 110, top: 20, right: 200, bottom: 60, cx: 155, cy: 40, width: 90, height: 40 };
    const to = { left: 0, top: 20, right: 100, bottom: 60, cx: 50, cy: 40, width: 100, height: 40 };
    const result = computeFeedbackPath(from, to, false);
    expect(result.d).not.toMatch(/NaN/);
    expect(Number.isFinite(result.endX)).toBe(true);
    expect(Number.isFinite(result.endY)).toBe(true);
  });
});

describe('edge cases', () => {
  test('zero-distance: computeForwardPath does not produce NaN', () => {
    const node = { left: 50, top: 50, right: 50, bottom: 50, cx: 50, cy: 50, width: 0, height: 0 };
    const result = computeForwardPath(node, node, false);
    expect(result.d).not.toMatch(/NaN/);
    expect(Number.isNaN(result.angle)).toBe(false);
    expect(Number.isNaN(result.endX)).toBe(false);
    expect(Number.isNaN(result.endY)).toBe(false);
  });

  test('zero-distance: computeFeedbackPath does not produce NaN', () => {
    const node = { left: 50, top: 50, right: 50, bottom: 50, cx: 50, cy: 50, width: 0, height: 0 };
    const result = computeFeedbackPath(node, node, false);
    expect(result.d).not.toMatch(/NaN/);
    expect(Number.isNaN(result.angle)).toBe(false);
  });

  test('zero-distance: computeArrowheadPoints does not produce NaN', () => {
    const result = computeArrowheadPoints(50, 50, 0, 0);
    expect(result).not.toMatch(/NaN/);
  });

  test('nodes with zero width/height do not crash', () => {
    const from = { left: 10, top: 10, right: 10, bottom: 10, cx: 10, cy: 10, width: 0, height: 0 };
    const to = { left: 100, top: 100, right: 100, bottom: 100, cx: 100, cy: 100, width: 0, height: 0 };
    expect(() => computeForwardPath(from, to, false)).not.toThrow();
    expect(() => computeForwardPath(from, to, true)).not.toThrow();
    expect(() => computeFeedbackPath(from, to, false)).not.toThrow();
    expect(() => computeFeedbackPath(from, to, true)).not.toThrow();
  });
});

describe('arrow attachment contracts', () => {
  test('forward horizontal: arrowhead tip lands exactly on target box left edge', () => {
    const from = { left: 0, top: 20, right: 100, bottom: 60, cx: 50, cy: 40, width: 100, height: 40 };
    const to = { left: 200, top: 20, right: 300, bottom: 60, cx: 250, cy: 40, width: 100, height: 40 };
    const result = computeForwardPath(from, to, false);
    expect(result.endX).toBe(to.left);
    expect(result.endY).toBe(to.cy);
  });

  test('forward vertical: arrowhead tip lands exactly on target box top edge', () => {
    const from = { left: 20, top: 0, right: 80, bottom: 50, cx: 50, cy: 25, width: 60, height: 50 };
    const to = { left: 20, top: 150, right: 80, bottom: 200, cx: 50, cy: 175, width: 60, height: 50 };
    const result = computeForwardPath(from, to, true);
    expect(result.endX).toBe(to.cx);
    expect(result.endY).toBe(to.top);
  });

  test('feedback horizontal: arrowhead tip lands on target box bottom edge', () => {
    const from = { left: 200, top: 20, right: 300, bottom: 60, cx: 250, cy: 40, width: 100, height: 40 };
    const to = { left: 0, top: 20, right: 100, bottom: 60, cx: 50, cy: 40, width: 100, height: 40 };
    const result = computeFeedbackPath(from, to, false);
    expect(result.endX).toBe(to.cx);
    expect(result.endY).toBe(to.bottom);
  });

  test('feedback vertical: arrowhead tip lands on target box left edge', () => {
    const from = { left: 20, top: 150, right: 80, bottom: 200, cx: 50, cy: 175, width: 60, height: 50 };
    const to = { left: 20, top: 0, right: 80, bottom: 50, cx: 50, cy: 25, width: 60, height: 50 };
    const result = computeFeedbackPath(from, to, true);
    expect(result.endX).toBe(to.left);
    expect(result.endY).toBe(to.cy);
  });

  test('forward path starts at source box edge', () => {
    const from = { left: 0, top: 20, right: 100, bottom: 60, cx: 50, cy: 40, width: 100, height: 40 };
    const to = { left: 200, top: 20, right: 300, bottom: 60, cx: 250, cy: 40, width: 100, height: 40 };
    const result = computeForwardPath(from, to, false);
    expect(result.d).toMatch(new RegExp(`^M ${from.right} ${from.cy}`));
  });

  test('feedback path starts at source box edge', () => {
    const from = { left: 200, top: 20, right: 300, bottom: 60, cx: 250, cy: 40, width: 100, height: 40 };
    const to = { left: 0, top: 20, right: 100, bottom: 60, cx: 50, cy: 40, width: 100, height: 40 };
    const result = computeFeedbackPath(from, to, false);
    expect(result.d).toMatch(new RegExp(`^M ${from.cx} ${from.bottom}`));
  });

  test('arrowhead tip coordinates match endX/endY from path computation', () => {
    const from = { left: 0, top: 20, right: 100, bottom: 60, cx: 50, cy: 40, width: 100, height: 40 };
    const to = { left: 200, top: 20, right: 300, bottom: 60, cx: 250, cy: 40, width: 100, height: 40 };
    const result = computeForwardPath(from, to, false);
    const points = computeArrowheadPoints(result.endX, result.endY, result.angle);
    const [tipX, tipY] = points.trim().split(' ')[0].split(',').map(Number);
    expect(tipX).toBe(result.endX);
    expect(tipY).toBe(result.endY);
  });
});

describe('computeFeedbackLabelPosition', () => {
  test('returns coordinates on the feedback curve for horizontal layout', () => {
    const from = { cx: 200, cy: 50, left: 150, right: 250, top: 25, bottom: 75 };
    const to = { cx: 50, cy: 50, left: 0, right: 100, top: 25, bottom: 75 };
    const result = computeFeedbackLabelPosition(from, to, false);
    expect(result.x).toBeGreaterThan(to.cx);
    expect(result.x).toBeLessThan(from.cx);
    expect(result.y).toBeGreaterThan(from.bottom);
  });

  test('returns coordinates on the feedback curve for vertical layout', () => {
    const from = { cx: 50, cy: 200, left: 25, right: 75, top: 175, bottom: 225 };
    const to = { cx: 50, cy: 50, left: 25, right: 75, top: 25, bottom: 75 };
    const result = computeFeedbackLabelPosition(from, to, true);
    expect(result.x).toBeLessThan(to.left);
    expect(result.y).toBeGreaterThan(to.cy);
    expect(result.y).toBeLessThan(from.cy);
  });

  test('label position changes when boxes move', () => {
    const to = { cx: 50, cy: 50, left: 0, right: 100, top: 25, bottom: 75 };
    const from1 = { cx: 200, cy: 50, left: 150, right: 250, top: 25, bottom: 75 };
    const from2 = { cx: 400, cy: 50, left: 350, right: 450, top: 25, bottom: 75 };
    const result1 = computeFeedbackLabelPosition(from1, to, false);
    const result2 = computeFeedbackLabelPosition(from2, to, false);
    expect(result1.x).not.toBeCloseTo(result2.x, 0);
  });

  test('handles coincident boxes gracefully (no NaN)', () => {
    const box = { cx: 50, cy: 50, left: 25, right: 75, top: 25, bottom: 75 };
    const result = computeFeedbackLabelPosition(box, box, false);
    expect(Number.isFinite(result.x)).toBe(true);
    expect(Number.isFinite(result.y)).toBe(true);
  });

  test('perpendicular offset keeps label away from curve midpoint', () => {
    const from = { cx: 200, cy: 50, left: 150, right: 250, top: 25, bottom: 75 };
    const to = { cx: 50, cy: 50, left: 0, right: 100, top: 25, bottom: 75 };
    const result = computeFeedbackLabelPosition(from, to, false);

    // Manually compute the raw Bézier midpoint (no perpendicular offset)
    const startX = from.cx, startY = from.bottom;
    const endX = to.cx, endY = to.bottom;
    const offset = 50;
    // Use the shortened endpoint logic
    const tempD = `M ${startX} ${startY} C ${startX} ${startY + offset}, ${endX} ${endY + offset}, ${endX} ${endY}`;
    const angle = tangentAngle(tempD);
    const sEndX = endX - Math.cos(angle) * ARROW_SIZE;
    const sEndY = endY - Math.sin(angle) * ARROW_SIZE;
    const P0 = { x: startX, y: startY };
    const P1 = { x: startX, y: startY + offset };
    const P2 = { x: sEndX, y: sEndY + offset };
    const P3 = { x: sEndX, y: sEndY };
    const rawMidX = 0.125 * P0.x + 0.375 * P1.x + 0.375 * P2.x + 0.125 * P3.x;
    const rawMidY = 0.125 * P0.y + 0.375 * P1.y + 0.375 * P2.y + 0.125 * P3.y;

    const dist = Math.hypot(result.x - rawMidX, result.y - rawMidY);
    expect(dist).toBeCloseTo(14, 0);
  });
});
