// vga.js — faithful port of Arkann's VGA layer (mode 13h).
import { DEFAULT_PALETTE } from './palette.js';

export const W = 320, H = 200, SCREEN_SIZE = W * H;
export const vmem = new Uint8Array(SCREEN_SIZE);
export const palette = new Uint8Array(256 * 3);
const palette32 = new Uint32Array(256);

(function initPalette() {
  if (DEFAULT_PALETTE.length !== 768) {
    console.error(`palette: expected 768 values, got ${DEFAULT_PALETTE.length}`);
  }
  for (let i = 0; i < 768; i++) palette[i] = DEFAULT_PALETTE[i];
  for (let i = 0; i < 256; i++) {
    const r = (palette[i*3+0] * 255 / 63) | 0;
    const g = (palette[i*3+1] * 255 / 63) | 0;
    const b = (palette[i*3+2] * 255 / 63) | 0;
    palette32[i] = (0xff << 24) | (b << 16) | (g << 8) | r;
  }
})();

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

const inb = (x, y) => x >= 0 && x <= 319 && y >= 0 && y <= 199;
function sgn(v) { return v > 0 ? 1 : v < 0 ? -1 : 0; }

export function putpixel(x, y, colour, mode) {
  if (!inb(x, y)) return;
  const i = (y << 8) + (y << 6) + x; colour &= 0xff;
  switch (mode) {
    case 0: vmem[i] = colour; break;
    case 1: vmem[i] ^= colour; break;
    case 2: vmem[i] |= colour; break;
    case 3: vmem[i] &= colour; break;
    case 4: if (colour) vmem[i] = colour; break;
    case 5: if (!vmem[i]) vmem[i] = colour; break;
    case 6: vmem[i] = (vmem[i] + colour) & 0xff; break;
  }
}
export function getpixel(x, y) {
  return inb(x, y) ? vmem[(y << 8) + (y << 6) + x] : 0;
}

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

export function menubox(x1, y1, x2, y2) {
  box(x1 + 1, y1 + 1, x2, y2, 17, 4);
  box(x1, y1, x2 - 1, y2 - 1, 23, 4);
  box(x1 + 1, y1 + 1, x2 - 1, y2 - 1, 20, 0);
}

export function cls() { vmem.fill(0); }

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
      picture[n++] = inb(x, y) ? vmem[(y << 8) + (y << 6) + x] : 0;
}

export let xfontsize = 0;
export let yfontsize = 0;
let currentFont = null;
const tabsize = 4;
export function setFont(font) {
  currentFont = font; xfontsize = font.w; yfontsize = font.h;
}

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

export function erase(x1, y1, x2, y2, xoffset, yoffset, pic) {
  if (x1 > x2) { const t = x1; x1 = x2; x2 = t; }
  if (y1 > y2) { const t = y1; y1 = y2; y2 = t; }
  if (y1 < 0) y1 = 0; if (y2 > 199) y2 = 199;
  if (x1 < 0) x1 = 0; if (x2 > 319) x2 = 319;
  const xp = pic[0], yp = pic[1];
  for (let y = y1; y <= y2; y++) {
    const cy = (y + yoffset) % yp;
    const ymp = (y << 8) + (y << 6);
    for (let x = x1; x <= x2; x++) {
      const cx = (x + xoffset) % xp;
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
