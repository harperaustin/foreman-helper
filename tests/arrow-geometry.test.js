const {
  ARROW_SIZE,
  tangentAngle,
  computeArrowheadPoints,
  computeForwardPath,
  computeFeedbackPath,
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
