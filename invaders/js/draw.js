// draw.js — shared drawing helpers (used by both gameplay and the menu).
import { vmem } from 'lib/vga.js';

// Aliens are drawn with a hand-rolled loop (not vga.put) because we need to
// re-colour eye pixels: a sprite pixel of 248 is drawn as 248 + eyetype, so
// pill-carrying aliens glow green (249) instead of red (248).
export function drawalien(x1, y1, picture, eyetype) {
  const w = picture[0], h = picture[1];
  const x2 = x1 + w - 1, y2 = y1 + h - 1;
  let n = 2;
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      const v = picture[n++];
      if (v !== 0 && x >= 0 && x <= 319 && y >= 0 && y <= 199) {
        vmem[x + y * 320] = (v === 248) ? 248 + eyetype : v;
      }
    }
  }
}
