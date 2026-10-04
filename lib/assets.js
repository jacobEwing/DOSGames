// assets.js — loaders for .pic, .blf, .pal, and level files.
import * as vga from './vga.js';

const fontCache = new Map();

export async function loadPic(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`loadPic ${url}: ${r.status}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf.length < 2) throw new Error(`loadPic ${url}: too short`);
  const w = buf[0], h = buf[1], need = 2 + w * h;
  if (buf.length < need) throw new Error(`loadPic ${url}: got ${buf.length}, need ${need}`);
  return buf.subarray(0, need);
}

export async function loadFont(url) {
  if (fontCache.has(url)) return fontCache.get(url);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`loadFont ${url}: ${r.status}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  const w = buf[0], h = buf[1], bits = w * h;
  const chars = new Array(256);
  for (let c = 0; c < 256; c++) {
    const pix = new Uint8Array(bits), bitBase = c * bits;
    for (let i = 0; i < bits; i++) {
      const bitIdx = bitBase + i;
      const byteIdx = 2 + (bitIdx >> 3);
      const bitInByte = 7 - (bitIdx & 7);
      pix[i] = (buf[byteIdx] >> bitInByte) & 1;
    }
    chars[c] = { w, h, pix };
  }
  const font = { w, h, chars };
  fontCache.set(url, font);
  return font;
}

// Convenience: load a font and install it.
export async function setFontFrom(url) {
  const font = await loadFont(url);
  vga.setFont(font);
  return font;
}

// Load a 768-byte .pal file and apply it.
export async function loadPalette(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`loadPalette ${url}: ${r.status}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf.length < 768) throw new Error(`loadPalette ${url}: got ${buf.length}, need 768`);
  vga.setPalette(buf);
  return buf;
}
