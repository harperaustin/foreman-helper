const ARROW_SIZE = 10;

function tangentAngle(d) {
  const parts = d.match(/[-+]?(?:\d+\.?\d*|\.\d+)/g);
  if (!parts || parts.length < 8) return 0;
  const nums = parts.map(Number);
  // Cubic bezier: M x0 y0 C x1 y1, x2 y2, x3 y3
  const P2 = { x: nums[4], y: nums[5] };
  const P3 = { x: nums[6], y: nums[7] };
  const dx = P3.x - P2.x;
  const dy = P3.y - P2.y;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return 0;
  return Math.atan2(dy, dx);
}

function computeArrowheadPoints(tipX, tipY, angle, size) {
  if (size === undefined) size = ARROW_SIZE;
  const halfWidth = size * 0.7;
  const backX = tipX - Math.cos(angle) * size;
  const backY = tipY - Math.sin(angle) * size;
  const perpX = -Math.sin(angle);
  const perpY = Math.cos(angle);
  const x1 = backX + perpX * halfWidth;
  const y1 = backY + perpY * halfWidth;
  const x2 = backX - perpX * halfWidth;
  const y2 = backY - perpY * halfWidth;
  return `${tipX},${tipY} ${x1},${y1} ${x2},${y2}`;
}

function computeForwardPath(from, to, isVertical) {
  let startX, startY, endX, endY, d;

  if (isVertical) {
    startX = from.cx;
    startY = from.bottom;
    endX = to.cx;
    endY = to.top;
  } else {
    startX = from.right;
    startY = from.cy;
    endX = to.left;
    endY = to.cy;
  }

  const dist = Math.hypot(endX - startX, endY - startY);
  if (dist < 1) {
    const angle = isVertical ? Math.PI / 2 : 0;
    d = `M ${startX} ${startY} C ${startX} ${startY}, ${endX} ${endY}, ${endX} ${endY}`;
    return { d, endX, endY, angle };
  }

  if (isVertical) {
    const midY = (startY + endY) / 2;
    d = `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
  } else {
    const midX = (startX + endX) / 2;
    d = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
  }

  const angle = tangentAngle(d);

  // Shorten endpoint inward by ARROW_SIZE so stroke doesn't poke through arrowhead
  const shortenedEndX = endX - Math.cos(angle) * ARROW_SIZE;
  const shortenedEndY = endY - Math.sin(angle) * ARROW_SIZE;

  if (isVertical) {
    const midY = (startY + shortenedEndY) / 2;
    d = `M ${startX} ${startY} C ${startX} ${midY}, ${shortenedEndX} ${midY}, ${shortenedEndX} ${shortenedEndY}`;
  } else {
    const midX = (startX + shortenedEndX) / 2;
    d = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${shortenedEndY}, ${shortenedEndX} ${shortenedEndY}`;
  }

  return { d, endX, endY, angle };
}

function computeFeedbackPath(from, to, isVertical) {
  let startX, startY, endX, endY, d;

  if (isVertical) {
    startX = from.left;
    startY = from.cy;
    endX = to.left;
    endY = to.cy;
    const offset = -40;
    d = `M ${startX} ${startY} C ${startX + offset} ${startY}, ${endX + offset} ${endY}, ${endX} ${endY}`;
  } else {
    startX = from.cx;
    startY = from.bottom;
    endX = to.cx;
    endY = to.bottom;
    const offset = 50;
    d = `M ${startX} ${startY} C ${startX} ${startY + offset}, ${endX} ${endY + offset}, ${endX} ${endY}`;
  }

  const dist = Math.hypot(endX - startX, endY - startY);
  if (dist < 1) {
    const angle = isVertical ? -Math.PI / 2 : 0;
    return { d, endX, endY, angle };
  }

  const angle = tangentAngle(d);

  // Shorten endpoint inward by ARROW_SIZE
  const shortenedEndX = endX - Math.cos(angle) * ARROW_SIZE;
  const shortenedEndY = endY - Math.sin(angle) * ARROW_SIZE;

  if (isVertical) {
    const offset = -40;
    d = `M ${startX} ${startY} C ${startX + offset} ${startY}, ${shortenedEndX + offset} ${shortenedEndY}, ${shortenedEndX} ${shortenedEndY}`;
  } else {
    const offset = 50;
    d = `M ${startX} ${startY} C ${startX} ${startY + offset}, ${shortenedEndX} ${shortenedEndY + offset}, ${shortenedEndX} ${shortenedEndY}`;
  }

  return { d, endX, endY, angle };
}

function computeFeedbackLabelPosition(from, to, isVertical) {
  let startX, startY, endX, endY;

  if (isVertical) {
    startX = from.left;
    startY = from.cy;
    endX = to.left;
    endY = to.cy;
  } else {
    startX = from.cx;
    startY = from.bottom;
    endX = to.cx;
    endY = to.bottom;
  }

  const dist = Math.hypot(endX - startX, endY - startY);

  // Compute shortened endpoint (same logic as computeFeedbackPath)
  let sEndX = endX;
  let sEndY = endY;
  if (dist >= 1) {
    let tempD;
    if (isVertical) {
      const offset = -40;
      tempD = `M ${startX} ${startY} C ${startX + offset} ${startY}, ${endX + offset} ${endY}, ${endX} ${endY}`;
    } else {
      const offset = 50;
      tempD = `M ${startX} ${startY} C ${startX} ${startY + offset}, ${endX} ${endY + offset}, ${endX} ${endY}`;
    }
    const angle = tangentAngle(tempD);
    sEndX = endX - Math.cos(angle) * ARROW_SIZE;
    sEndY = endY - Math.sin(angle) * ARROW_SIZE;
  }

  // Compute the four cubic Bézier control points (matching computeFeedbackPath's shortened path)
  let P0, P1, P2, P3;
  if (isVertical) {
    const offset = -40;
    P0 = { x: startX, y: startY };
    P1 = { x: startX + offset, y: startY };
    P2 = { x: sEndX + offset, y: sEndY };
    P3 = { x: sEndX, y: sEndY };
  } else {
    const offset = 50;
    P0 = { x: startX, y: startY };
    P1 = { x: startX, y: startY + offset };
    P2 = { x: sEndX, y: sEndY + offset };
    P3 = { x: sEndX, y: sEndY };
  }

  // Evaluate cubic Bézier at t=0.5: mid = 0.125*P0 + 0.375*P1 + 0.375*P2 + 0.125*P3
  const midX = 0.125 * P0.x + 0.375 * P1.x + 0.375 * P2.x + 0.125 * P3.x;
  const midY = 0.125 * P0.y + 0.375 * P1.y + 0.375 * P2.y + 0.125 * P3.y;

  // Tangent at t=0.5: B'(0.5) = -3*(0.25)*P0 + 3*(1-2+0.75)*P1 + 3*(1-0.75)*P2 + 3*(0.25)*P3
  // Simplified: B'(0.5) = 0.75*(-P0 - P1 + P2 + P3)
  const tanX = 0.75 * (-P0.x - P1.x + P2.x + P3.x);
  const tanY = 0.75 * (-P0.y - P1.y + P2.y + P3.y);

  // Normalize tangent
  const tanLen = Math.hypot(tanX, tanY);
  let perpX, perpY;
  if (tanLen < 1e-9) {
    // Fallback: offset away from boxes
    perpX = isVertical ? -1 : 0;
    perpY = isVertical ? 0 : 1;
  } else {
    const ntx = tanX / tanLen;
    const nty = tanY / tanLen;
    // Perpendicular: rotate 90° clockwise => (nty, -ntx) or counter-clockwise => (-nty, ntx)
    // We want "away from boxes": in vertical mode, further left (negative x); in horizontal mode, further down (positive y)
    if (isVertical) {
      // Choose perpendicular that points more to the left (negative x)
      perpX = -nty;
      perpY = ntx;
      if (perpX > 0) { perpX = -perpX; perpY = -perpY; }
    } else {
      // Choose perpendicular that points more downward (positive y)
      perpX = nty;
      perpY = -ntx;
      if (perpY < 0) { perpX = -perpX; perpY = -perpY; }
    }
  }

  const OFFSET_PX = 14;
  return {
    x: midX + perpX * OFFSET_PX,
    y: midY + perpY * OFFSET_PX
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ARROW_SIZE, tangentAngle, computeArrowheadPoints, computeForwardPath, computeFeedbackPath, computeFeedbackLabelPosition };
} else if (typeof window !== 'undefined') {
  window.ArrowGeometry = { ARROW_SIZE, tangentAngle, computeArrowheadPoints, computeForwardPath, computeFeedbackPath, computeFeedbackLabelPosition };
}
