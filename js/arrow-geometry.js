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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ARROW_SIZE, tangentAngle, computeArrowheadPoints, computeForwardPath, computeFeedbackPath };
} else if (typeof window !== 'undefined') {
  window.ArrowGeometry = { ARROW_SIZE, tangentAngle, computeArrowheadPoints, computeForwardPath, computeFeedbackPath };
}
