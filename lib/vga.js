// vga.js — mode 13h framebuffer and drawing primitives (from mcgalib.cpp).
import { DEFAULT_PALETTE } from './palette.js';
import { sgn } from './math.js';

export const W = 320, H = 200, SCREEN_SIZE = W * H;
export const vmem = new Uint8Array(SCREEN_SIZE);
export const palette = new Uint8Array(256 * 3);
const palette32 = new Uint32Array(256);

(function initPalette() {
  for (let i = 0; i < 768; i++) palette[i] = DEFAULT_PALETTE[i];
  rebuildPalette32();
})();

function rebuildPalette32() {
  for (let i = 0; i < 256; i++) {
    const r = (palette[i*3+0] * 255 / 63) | 0;
    const g = (palette[i*3+1] * 255 / 63) | 0;
    const b = (palette[i*3+2] * 255 / 63) | 0;
    palette32[i] = (0xff << 24) | (b << 16) | (g << 8) | r;
  }
}

// ---- Palette API -----------------------------------------------------------
// Match load_palette / set_palette / set_colour / read_palette.
export function setPalette(buf) {
  for (let i = 0; i < 768; i++) palette[i] = buf[i] & 0xff;
  rebuildPalette32();
}
export function setColour(c, r, g, b) {
  c &= 0xff;
  palette[c*3+0] = r % 64;
  palette[c*3+1] = g % 64;
  palette[c*3+2] = b % 64;
  rebuildPalette32();
}
export function readPalette(index) {
  index &= 0xff;
  return { r: palette[index*3+0], g: palette[index*3+1], b: palette[index*3+2] };
}

// ---- Canvas ----------------------------------------------------------------
let ctx = null, img = null, buf32 = null;
export function attachCanvas(canvas) {
  canvas.width = W; canvas.height = H;
  ctx = canvas.getContext('2d', { alpha: false });
  img = ctx.createImageData(W, H);
  buf32 = new Uint32Array(img.data.buffer);
}
export function present() {
  for (let i = 0; i < SCREEN_SIZE; i++) buf32[i] = palette32[vmem[i]];
  ctx.putImageData(img, 0, 0);
}

// ---- Pixel -----------------------------------------------------------------
const inb = (x, y) => x >= 0 && x <= 319 && y >= 0 && y <= 199;
const idx = (x, y) => (y << 8) + (y << 6) + x;

export function putpixel(x, y, colour, mode) {
  if (!inb(x, y)) return;
  const i = idx(x, y); colour &= 0xff;
  switch (mode) {
    case 0: vmem[i]  = colour; break;
    case 1: vmem[i] ^= colour; break;
    case 2: vmem[i] |= colour; break;
    case 3: vmem[i] &= colour; break;
    case 4: if (colour) vmem[i] = colour; break;
    case 5: if (!vmem[i]) vmem[i] = colour; break;
    case 6: vmem[i] = (vmem[i] + colour) & 0xff; break;
  }
}
export function getpixel(x, y) {
  return inb(x, y) ? vmem[idx(x, y)] : 0;
}

// ---- Line ------------------------------------------------------------------
export function line(x1, y1, x2, y2, colour, mode) {
  const dx = x2 - x1, dy = y2 - y1;
  const dxa = Math.abs(dx), dya = Math.abs(dy);
  const sdx = sgn(dx), sdy = sgn(dy);
  let x = dya >> 1, y = dxa >> 1, px = x1, py = y1;
  putpixel(px, py, colour, mode);
  if (dxa >= dya) {
    for (let n = 0; n < dxa; n++) {
      y += dya; if (y >= dxa) { y -= dxa; py += sdy; }
      px += sdx; putpixel(px, py, colour, mode);
    }
  } else {
    for (let n = 0; n < dya; n++) {
      x += dxa; if (x >= dya) { x -= dya; px += sdx; }
      py += sdy; putpixel(px, py, colour, mode);
    }
  }
}

// ---- Box -------------------------------------------------------------------
export function box(x1, y1, x2, y2, colour, mode) {
  if (x1 < 0) x1 = 0; if (x1 > 319) x1 = 319;
  if (y1 < 0) y1 = 0; if (y1 > 199) y1 = 199;
  if (x2 < 0) x2 = 0; if (x2 > 319) x2 = 319;
  if (y2 < 0) y2 = 0; if (y2 > 199) y2 = 199;
  if (x1 > x2) { const t = x1; x1 = x2; x2 = t; }
  if (y1 > y2) { const t = y1; y1 = y2; y2 = t; }
  colour &= 0xff;
  const fill = (fn) => {
    for (let y = y1; y <= y2; y++) {
      const base = (y << 8) + (y << 6);
      for (let p = base + x1, end = base + x2; p <= end; p++) fn(p);
    }
  };
  switch (mode) {
    case 0: fill(p => { vmem[p] = colour; }); break;
    case 1: fill(p => { vmem[p] ^= colour; }); break;
    case 2: fill(p => { vmem[p] |= colour; }); break;
    case 3: fill(p => { vmem[p] &= colour; }); break;
    case 4:
      for (let x = x1; x <= x2; x++) {
        vmem[(y1 << 8) + (y1 << 6) + x] = colour;
        vmem[(y2 << 8) + (y2 << 6) + x] = colour;
      }
      for (let y = y1; y <= y2; y++) {
        vmem[(y << 8) + (y << 6) + x1] = colour;
        vmem[(y << 8) + (y << 6) + x2] = colour;
      }
      break;
    case 5: fill(p => { if (!vmem[p]) vmem[p] = colour; }); break;
    case 6: fill(p => { vmem[p] = (vmem[p] + colour) & 0xff; }); break;
  }
}

// ---- Circle ----------------------------------------------------------------
// Mode 4 draws the outline; all other modes draw a filled disc.
export function circle(cx, cy, radius, colour, mode) {
  if (radius < 1) radius = -radius;
  if (!radius) radius++;
  const x1 = cx - radius;
  for (let x = x1; x <= cx; x++) {
    const xdist = Math.abs(x - cx);
    const ydist = Math.sqrt(radius * radius - xdist * xdist) | 0;
    const ydist2 = (Math.sqrt(radius * radius - (xdist - 1) * (xdist - 1)) | 0) + (xdist ? 0 : 1);
    if (mode === 4) {
      if (Math.abs(ydist2 - ydist) > 1) {
        for (let y = ydist; y < ydist2; y++) {
          if (x >= 0 && x <= 319) {
            if (cy + y >= 0 && cy + y <= 199) vmem[x + 320 * (cy + y)] = colour;
            if (cy - y >= 0 && cy - y <= 199) vmem[x + 320 * (cy - y)] = colour;
          }
          const dx2 = cx + xdist;
          if (dx2 >= 0 && dx2 <= 319) {
            if (cy + y >= 0 && cy + y <= 199) vmem[dx2 + 320 * (cy + y)] = colour;
            if (cy - y >= 0 && cy - y <= 199) vmem[dx2 + 320 * (cy - y)] = colour;
          }
        }
      } else {
        const dx2 = cx + xdist;
        for (const y of [cy + ydist, cy - ydist]) {
          if (y >= 0 && y <= 199) {
            if (x >= 0 && x <= 319) vmem[x + 320 * y] = colour;
            if (dx2 >= 0 && dx2 <= 319) vmem[dx2 + 320 * y] = colour;
          }
        }
      }
    } else {
      box(x, cy + ydist2, x, cy - ydist2, colour, mode);
      const dx2 = cx + xdist;
      if (xdist > 0) box(dx2, cy + ydist2, dx2, cy - ydist2, colour, mode);
    }
  }
}

// ---- Polygon (scanline) ----------------------------------------------------
export function polygon(pointx, pointy, numpoints, colour, mode) {
  if (numpoints <= 2) return;
  let minpoint = 0;
  for (let n = 1; n < numpoints; n++) {
    if (pointy[n] < pointy[minpoint]) minpoint = n;
  }

  const x1 = [0, 0], y1 = [0, 0], x2 = [0, 0], y2 = [0, 0];
  const deltaxabs = [0, 0], deltayabs = [0, 0];
  const sgndeltax = [0, 0], sgndeltay = [0, 0];
  const x = [0, 0];
  const drawx = [0, 0], drawy = [0, 0];
  const pointnum = [0, 0];

  for (let n = 0; n < 2; n++) {
    x1[n] = pointx[minpoint]; y1[n] = pointy[minpoint];
    pointnum[n] = minpoint - (n << 1) + 1;
    if (pointnum[n] < 0) pointnum[n] += numpoints;
    else pointnum[n] %= numpoints;
    x2[n] = pointx[pointnum[n]]; y2[n] = pointy[pointnum[n]];

    const ddx = x2[n] - x1[n], ddy = y2[n] - y1[n];
    deltaxabs[n] = Math.abs(ddx);
    deltayabs[n] = Math.abs(ddy);
    sgndeltax[n] = sgn(ddx);
    sgndeltay[n] = sgn(ddy);
    x[n] = deltayabs[n] >> 1;
    drawx[n] = x1[n]; drawy[n] = y1[n];
  }

  let done = false;
  while (!done) {
    line(drawx[0], drawy[0], drawx[1], drawy[0], colour, mode);
    for (let n = 0; n < 2; n++) {
      if (drawy[n] === y2[n]) {
        if (y2[0] === y2[1] && x2[0] === x2[1]) { done = true; break; }
        x1[n] = x2[n]; y1[n] = y2[n];
        pointnum[n] = pointnum[n] - (n << 1) + 1;
        if (pointnum[n] < 0) pointnum[n] += numpoints;
        else pointnum[n] %= numpoints;
        x2[n] = pointx[pointnum[n]]; y2[n] = pointy[pointnum[n]];
        const ddx = x2[n] - x1[n], ddy = y2[n] - y1[n];
        deltaxabs[n] = Math.abs(ddx);
        deltayabs[n] = Math.abs(ddy);
        sgndeltax[n] = sgn(ddx);
        sgndeltay[n] = sgn(ddy);
        x[n] = deltayabs[n] >> 1;
        drawx[n] = x1[n]; drawy[n] = y1[n];
      }
      x[n] += deltaxabs[n];
      while (x[n] >= deltayabs[n]) {
        x[n] -= (deltayabs[n] + (deltayabs[n] ? 0 : 1));
        drawx[n] += sgndeltax[n];
      }
      drawy[n] += sgndeltay[n];
    }
  }
}

// ---- Sprite blit / grab ---------------------------------------------------
export function put(x1, y1, picture, mode) {
  const w = picture[0], h = picture[1];
  const x2 = x1 + w - 1, y2 = y1 + h - 1;
  let n = 2;
  const loop = (fn) => {
    for (let y = y1; y <= y2; y++) {
      if (y >= 0 && y <= 199) {
        const base = (y << 8) + (y << 6);
        for (let x = x1; x <= x2; x++) {
          if (x >= 0 && x <= 319) fn(base + x, picture[n]);
          n++;
        }
      } else n += w;
    }
  };
  switch (mode) {
    case 0: loop((p, v) => { vmem[p]  = v; }); break;
    case 1: loop((p, v) => { vmem[p] ^= v; }); break;
    case 2: loop((p, v) => { vmem[p] |= v; }); break;
    case 3: loop((p, v) => { vmem[p] &= v; }); break;
    case 4: loop((p, v) => { if (v) vmem[p] = v; }); break;
    case 5: loop((p, v) => { if (!vmem[p]) vmem[p] = v; }); break;
    case 6: loop((p, v) => { vmem[p] = (vmem[p] + v) & 0xff; }); break;
  }
}

export function get(x1, y1, x2, y2, picture) {
  if (x1 > x2) { const t = x1; x1 = x2; x2 = t; }
  if (y1 > y2) { const t = y1; y1 = y2; y2 = t; }
  picture[0] = x2 - x1 + 1;
  picture[1] = y2 - y1 + 1;
  let n = 2;
  for (let y = y1; y <= y2; y++)
    for (let x = x1; x <= x2; x++)
      picture[n++] = inb(x, y) ? vmem[idx(x, y)] : 0;
}

// ---- Scaleput --------------------------------------------------------------
// NOTE: xscale and yscale are DIVISORS.  scaleput(x, y, 2, 2, pic, mode) draws
// the sprite at half size, matching mcgalib.cpp.
export function scaleput(x1, y1, xscale, yscale, pic, mode) {
  const xsize = (pic[0] / xscale) | 0;
  const ysize = (pic[1] / yscale) | 0;
  const ixscale = (xscale * 256) | 0;
  const iyscale = (yscale * 256) | 0;
  for (let y = 0; y <= ysize; y++) {
    const py = (y * iyscale) >> 8;
    const my = py * pic[0];
    const cy = y + y1;
    for (let x = 0; x <= xsize; x++) {
      const px = (x * ixscale) >> 8;
      putpixel(x + x1, cy, pic[px + my + 2], mode);
    }
  }
}

// ---- rotput / roterase -----------------------------------------------------

export function calcrotarea(centerx, centery, xoffset, yoffset, ang, scale, pic) {
  const xsize = pic[0], ysize = pic[1];
  const px = [0,0,0,0], py = [0,0,0,0];
  let minx = 0, miny = 0, maxx = 0, maxy = 0;
  const SINE = (Math.sin(ang) * 256) | 0;
  const COSINE = (Math.cos(ang) * 256) | 0;
  if (!scale) scale = 1;

  px[2] = px[0] = -xoffset;
  py[1] = py[0] = -yoffset;
  px[1] = px[3] = px[0] + xsize - 1;
  py[2] = py[3] = py[0] + ysize - 1;

  for (let n = 0; n < 4; n++) {
    const tmp = (px[n] * COSINE - py[n] * SINE) >> 8;
    py[n] = (px[n] * SINE + py[n] * COSINE) >> 8;
    px[n] = tmp;
    px[n] += sgn(px[n]);
    py[n] += sgn(py[n]);
    px[n] *= scale; py[n] *= scale;
    px[n] += centerx; py[n] += centery;
    if (px[n] < minx || !n) minx = px[n];
    if (py[n] < miny || !n) miny = py[n];
    if (px[n] > maxx || !n) maxx = px[n];
    if (py[n] > maxy || !n) maxy = py[n];
  }
  minx = Math.max(0, Math.min(319, minx));
  maxx = Math.max(0, Math.min(319, maxx));
  miny = Math.max(0, Math.min(199, miny));
  maxy = Math.max(0, Math.min(199, maxy));
  return { x1: minx, y1: miny, x2: maxx, y2: maxy };
}

export function calccorners(centerx, centery, xoffset, yoffset, ang, scale, pic) {
  const xsize = pic[0], ysize = pic[1];
  const px = [0,0,0,0], py = [0,0,0,0];
  if (!scale) scale = 1;
  const SINE = (Math.sin(ang) * 256 * scale) | 0;
  const COSINE = (Math.cos(ang) * 256 * scale) | 0;

  px[2] = px[0] = -xoffset;
  py[1] = py[0] = -yoffset;
  px[1] = px[3] = px[0] + xsize;
  py[2] = py[3] = py[0] + ysize;

  for (let n = 0; n < 4; n++) {
    const tmp = (px[n] * COSINE - py[n] * SINE) >> 8;
    py[n] = (px[n] * SINE + py[n] * COSINE) >> 8;
    px[n] = tmp + centerx;
    py[n] += centery;
  }
  return { px, py };
}

export function rotput(centerx, centery, xoffset, yoffset, ang, scale, pic, mode) {
  const xsize = pic[0], ysize = pic[1];
  if (!scale) scale = 1;
  const SINE  = (Math.sin(ang) * 256 * scale) | 0;
  const COSINE = (Math.cos(ang) * 256 * scale) | 0;
  const SINE2  = (Math.sin(-ang) * 256 / scale) | 0;
  const COSINE2 = (Math.cos(-ang) * 256 / scale) | 0;

  const px = [0,0,0,0], py = [0,0,0,0];
  let minx = 0, miny = 0, maxx = 0, maxy = 0;

  px[2] = px[0] = -xoffset;
  py[1] = py[0] = -yoffset;
  px[1] = px[3] = px[0] + xsize;
  py[2] = py[3] = py[0] + ysize;

  for (let n = 0; n < 4; n++) {
    const tmp = (px[n] * COSINE - py[n] * SINE) >> 8;
    py[n] = (px[n] * SINE + py[n] * COSINE) >> 8;
    px[n] = tmp + centerx;
    py[n] += centery;
    if (px[n] < minx || !n) minx = px[n];
    if (py[n] < miny || !n) miny = py[n];
    if (px[n] > maxx || !n) maxx = px[n];
    if (py[n] > maxy || !n) maxy = py[n];
  }
  minx = Math.max(0, Math.min(319, minx));
  maxx = Math.max(0, Math.min(319, maxx));
  miny = Math.max(0, Math.min(199, miny));
  maxy = Math.max(0, Math.min(199, maxy));
  maxx++; maxy++;

  for (let y = miny; y < maxy; y++) {
    const deltay = y - centery;
    const deltaymulSINE2 = deltay * SINE2;
    const deltaymulCOSINE2 = deltay * COSINE2;
    const ymul320 = (y << 8) + (y << 6);
    for (let x = minx; x < maxx; x++) {
      const deltax = x - centerx;
      let rotx = (deltax * COSINE2 - deltaymulSINE2) >> 8;
      let roty = (deltax * SINE2 + deltaymulCOSINE2) >> 8;
      rotx += xoffset; roty += yoffset;
      if (rotx >= 0 && rotx < xsize && roty >= 0 && roty < ysize) {
        const i = x + ymul320;
        const v = pic[2 + rotx + xsize * roty];
        switch (mode) {
          case 0: vmem[i]  = v; break;
          case 1: vmem[i] ^= v; break;
          case 2: vmem[i] |= v; break;
          case 3: vmem[i] &= v; break;
          case 4: if (v) vmem[i] = v; break;
          case 5: if (!vmem[i]) vmem[i] = v; break;
          case 6: vmem[i] = (vmem[i] + v) & 0xff; break;
        }
      }
    }
  }
}

export function roterase(x1, y1, x2, y2, centerx, centery, ang, scale, pic) {
  if (!scale) scale = 1;
  const SINE = (Math.sin(ang) * 64 / scale) | 0;
  const COSINE = (Math.cos(ang) * 64 / scale) | 0;
  const xsize = pic[0], ysize = pic[1];

  x1 = Math.max(0, Math.min(319, x1));
  x2 = Math.max(0, Math.min(319, x2));
  y1 = Math.max(0, Math.min(199, y1));
  y2 = Math.max(0, Math.min(199, y2));
  x2++; y2++;

  const jumpsize = 320 - (x2 - x1);
  let pptr = (y1 << 8) + (y1 << 6) + x1;

  const leftdc = x1 - centerx;
  const rightdc = x2 - centerx;
  const bottomdc = y2 - centery;

  for (let deltay = y1 - centery; deltay < bottomdc; deltay++) {
    const dyS = deltay * SINE;
    const dyC = deltay * COSINE;
    for (let deltax = leftdc; deltax < rightdc; deltax++) {
      let rotx = (deltax * COSINE - dyS) >> 6;
      let roty = (deltax * SINE + dyC) >> 6;
      rotx += centerx; roty += centery;
      while (rotx < 0) rotx += xsize;
      while (roty < 0) roty += ysize;
      rotx %= xsize; roty %= ysize;
      vmem[pptr++] = pic[2 + rotx + xsize * roty];
    }
    pptr += jumpsize;
  }
}

// ---- Background-tiled erase ------------------------------------------------
export function erase(x1, y1, x2, y2, xoffset, yoffset, pic) {
  if (x1 > x2) { const t = x1; x1 = x2; x2 = t; }
  if (y1 > y2) { const t = y1; y1 = y2; y2 = t; }
  if (y1 < 0) y1 = 0; if (y2 > 199) y2 = 199;
  if (x1 < 0) x1 = 0; if (x2 > 319) x2 = 319;
  const xp = pic[0], yp = pic[1];
  for (let y = y1; y <= y2; y++) {
    const cy = ((y + yoffset) % yp + yp) % yp;
    const ymp = (y << 8) + (y << 6);
    for (let x = x1; x <= x2; x++) {
      const cx = ((x + xoffset) % xp + xp) % xp;
      vmem[ymp + x] = pic[cx + xp * cy + 2];
    }
  }
}

export function erasepic(x1, y1, pic, backg, mode) {
  const x2 = x1 + pic[0] - 1, y2 = y1 + pic[1] - 1;
  const bw = backg[0], bh = backg[1];
  let n = 2;
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      if (x <= 319 && x >= 0 && y <= 199 && y >= 0 && (!mode || pic[n])) {
        const cx = ((x % bw) + bw) % bw;
        const cy = ((y % bh) + bh) % bh;
        vmem[x + 320 * y] = backg[cx + bw * cy + 2];
      }
      n++;
    }
  }
}

// -----------------------------------------------------------------------------
// eraseshape — like erase, but erases only the pixels of a sprite, using a
// tiled background.  Mode 0 unconditionally blits the background; mode 1
// erases wherever the sprite's pixel is non-zero; mode 2 erases only where
// the sprite's pixel matches what is currently on screen.
//
// NOTE: mode 2's "(v === 249 && e === 248)" case is a game-specific tweak
// that was added to the C library for this program: aliens are drawn with
// eyes at colour 248, and re-coloured to 249 when carrying a pill, so the
// erase must treat them as equivalent.
// -----------------------------------------------------------------------------
export function eraseshape(x1, y1, xoffset, yoffset, erasee, eraser, mode) {
  const x2 = x1 + erasee[0] - 1;
  const y2 = y1 + erasee[1] - 1;
  const xpicsize = eraser[0], ypicsize = eraser[1];
  let n = 2;
  for (let y = y1; y <= y2; y++) {
    const cy = (((y + yoffset) % ypicsize) + ypicsize) % ypicsize;
    const ymul320 = (y << 8) + (y << 6);
    for (let x = x1; x <= x2; x++) {
      if (mode === 0) {
        const cx = (((x + xoffset) % xpicsize) + xpicsize) % xpicsize;
        vmem[ymul320 + x] = eraser[cx + xpicsize * cy + 2];
      } else if (mode === 1) {
        if (erasee[n] && x >= 0 && x <= 319 && y >= 0 && y <= 199) {
          const cx = (((x + xoffset) % xpicsize) + xpicsize) % xpicsize;
          vmem[ymul320 + x] = eraser[cx + xpicsize * cy + 2];
        }
      } else if (mode === 2) {
        if (x >= 0 && x <= 319 && y >= 0 && y <= 199) {
          const v = vmem[ymul320 + x];
          const e = erasee[n];
          if (e && (v === e || (v === 249 && e === 248))) {
            const cx = (((x + xoffset) % xpicsize) + xpicsize) % xpicsize;
            vmem[ymul320 + x] = eraser[cx + xpicsize * cy + 2];
          }
        }
      }
      n++;
    }
  }
}

export function touching(x1, y1, pic1, x2, y2, pic2, mode) {
  if (x1 < x2 - pic1[0] || x1 > x2 + pic2[0] ||
      y1 < y2 - pic1[1] || y1 > y2 + pic2[1]) return 0;
  if (!mode) return 1;
  for (let x = x1; x < x1 + pic1[0]; x++) {
    for (let y = y1; y < y1 + pic1[1]; y++) {
      if (x >= x2 && x <= x2 + pic2[0] - 1 &&
          y >= y2 && y <= y2 + pic2[1] - 1) {
        const a = pic1[2 + (x - x1) + pic1[0] * (y - y1)];
        const b = pic2[2 + (x - x2) + pic2[0] * (y - y2)];
        if (a && b) return 1;
      }
    }
  }
  return 0;
}

// ---- Fonts & text ----------------------------------------------------------
export let xfontsize = 0;
export let yfontsize = 0;
let currentFont = null;
const tabsize = 4;

export function setFont(font) {
  currentFont = font;
  xfontsize = font.w;
  yfontsize = font.h;
}
export function hasFont() { return !!currentFont; }

export function putfont(x1, y1, picnum, colour, mode) {
  if (!currentFont) return;
  const ch = currentFont.chars[picnum & 0xff];
  if (!ch) return;
  const w = ch.w, h = ch.h, picture = ch.pix;
  const x2 = x1 + w - 1, y2 = y1 + h - 1;
  colour &= 0xff; mode %= 7;
  let n = 0;
  for (let y = y1; y <= y2; y++) {
    if (y >= 0 && y <= 199) {
      const base = (y << 8) + (y << 6);
      for (let x = x1; x <= x2; x++) {
        if (x >= 0 && x <= 319) {
          const on = picture[n] !== 0, p = base + x;
          switch (mode) {
            case 0: vmem[p]  = on * colour; break;
            case 1: vmem[p] ^= on * colour; break;
            case 2: vmem[p] |= on * colour; break;
            case 3: vmem[p] &= on * colour; break;
            case 4: if (on) vmem[p] = colour; break;
            case 5: if (!vmem[p]) vmem[p] = on * colour; break;
            case 6: vmem[p] = (vmem[p] + on * colour) & 0xff; break;
          }
        }
        n++;
      }
    } else n += w;
  }
}

export function drawtext(x, y, str, colour, mode) {
  if (typeof str !== 'string') str = String(str);
  const initx = x, len = str.length;
  for (let n = 0; n < len; n++) {
    const charval = str.charCodeAt(n);
    let repeat;
    do {
      repeat = 1;
      switch (charval) {
        case 13: x = initx; /* fallthrough */
        case 10: y += yfontsize; break;
        case 8:  x -= xfontsize; break;
        case 9:  x += tabsize * xfontsize; break;
        case 11: y += tabsize * yfontsize; break;
        default: repeat = 0;
      }
      n += repeat;
      if (n >= len) break;
    } while (repeat);
    putfont(x, y, charval, colour, mode);
    x += xfontsize;
  }
}

export function cls() { vmem.fill(0); }
