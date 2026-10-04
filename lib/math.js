// math.js — geometry helpers from mcgalib.cpp.
export const PI = Math.PI;

export function sgn(val) {
  return val > 0 ? 1 : val < 0 ? -1 : 0;
}

export function rel_ang(x1, y1, x2, y2) {
  const deltax = x2 - x1, deltay = y2 - y1;
  const hyp = Math.sqrt(deltax * deltax + deltay * deltay);
  let alpha;
  if (y2 === y1) {
    alpha = PI / 2;
    if (x2 < x1) alpha = 3 * PI / 2;
  } else if (x2 === x1) {
    alpha = 0;
    if (y2 > y1) alpha = PI;
  } else if (x2 > x1) {
    alpha = Math.asin(deltay / hyp) + PI / 2;
  } else {
    alpha = Math.acos(deltay / hyp) + PI;
  }
  return alpha;
}

export function hypotenuse(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function dist(p1, p2) {
  const dx = p2.x - p1.x, dy = p2.y - p1.y, dz = (p2.z || 0) - (p1.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function boxes_touch(ax, ay, bx, by, cx, cy, dx, dy) {
  if (ax > bx) [ax, bx] = [bx, ax];
  if (ay > by) [ay, by] = [by, ay];
  if (cx > dx) [cx, dx] = [dx, cx];
  if (cy > dy) [cy, dy] = [dy, cy];
  return ax <= dx && bx >= cx && ay <= dy && by >= cy;
}

export function linesegs_touch(ax, ay, bx, by, cx, cy, dx, dy) {
  if (!boxes_touch(ax, ay, bx, by, cx, cy, dx, dy)) return false;
  const deltax1 = ax - bx, deltax2 = cx - dx;
  const deltay1 = ay - by, deltay2 = cy - dy;

  const div = (n, d) => (n / d) | 0;

  if (deltax1 && deltax2) {
    const v1 = div(deltay1 * (cx - ax), deltax1) + ay - cy;
    const v2 = div(deltay1 * (dx - ax), deltax1) + ay - dy;
    const v3 = div(deltay2 * (ax - cx), deltax2) + cy - ay;
    const v4 = div(deltay2 * (bx - cx), deltax2) + cy - by;
    if (sgn(v1) !== sgn(v2) && sgn(v3) !== sgn(v4)) return true;
  } else if (deltax1) {
    const v1 = div(deltay1 * (cx - ax), deltax1) + ay;
    if (sgn(cy - v1) !== sgn(dy - v1)) return true;
  } else if (deltax2) {
    const v1 = div(deltay2 * (ax - cx), deltax2) + cy;
    if (sgn(ay - v1) !== sgn(by - v1)) return true;
  } else if (ax === cx && ay === cy) {
    return true;
  }
  return false;
}
