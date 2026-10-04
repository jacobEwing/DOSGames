// helpers.js
import * as vga from './vga.js';
import * as input from './input.js';
import * as timing from './timing.js';
import { loadFont } from './assets.js';

export async function loadFontInto(url) {
  const font = await loadFont(url);
  vga.setFont(font);
  return font;
}

export async function waitForAnyKey() {
  while (!input.kbhit()) await timing.nextFrame();
}
export async function waitForButtonPress() {
  while (!input.buttonpressed()) await timing.nextFrame();
}
export async function waitForButtonRelease() {
  while (input.buttonpressed()) await timing.nextFrame();
}
export function drainKeyboard() { while (input.kbhit()) input.getch(); }

export async function taketext(quote, length) {
  const xfontsize = vga.xfontsize, yfontsize = vga.yfontsize;
  const quotex = (160 - (xfontsize * quote.length) / 2) | 0;
  const quotey = 80;
  const boxx = quotex - 4, boxy = quotey - 4;
  const textx1 = quotex, texty1 = quotey + yfontsize + 5;
  const xboxsize = quote.length * xfontsize + 4;
  const yboxsize = 4 * yfontsize + 8;

  vga.box(boxx, boxy, boxx + xboxsize, boxy + yboxsize, 0, 0);
  vga.box(boxx, boxy, boxx + xboxsize, boxy + yboxsize, 15, 4);
  vga.drawtext(quotex, quotey, quote, 15, 0);

  let drawx = textx1, drawy = texty1;
  drainKeyboard();
  await timing.nextFrame();

  let str = '', fini = false, cancelled = false;
  while (!fini) {
    while (!input.kbhit()) await timing.nextFrame();
    const key = input.getch();
    if (key === 13) fini = true;
    else if (key === 27) { fini = true; cancelled = true; }
    else if (key === 8) {
      if (str.length > 0) {
        str = str.slice(0, -1);
        drawx -= xfontsize;
        vga.drawtext(drawx, drawy, ' ', 15, 0);
      }
    } else if (key >= 32 && key <= 126 && str.length < length - 2) {
      const ch = String.fromCharCode(key);
      str += ch;
      vga.drawtext(drawx, drawy, ch, 15, 0);
      drawx += xfontsize;
    }
  }
  return cancelled ? null : str;
}

export async function continue_game() {
  const xfontsize = vga.xfontsize, yfontsize = vga.yfontsize;
  const string = 'Continue? (Y/N)';
  const len = string.length;
  const xl = xfontsize * len;
  const understring = new Uint8Array(2 + 512 * 32);

  for (let x = 320; x > 160 - ((xfontsize / 2) | 0) * len; x -= 20) {
    vga.get(x - 2, 93, x + xl, 93 + yfontsize + 4, understring);
    vga.box(x - 2, 93, x + xl, 93 + yfontsize + 4, 0, 0);
    vga.box(x - 2, 93, x + xl, 93 + yfontsize + 4, 15, 4);
    vga.drawtext(x, 95, string, 15, 0);
    vga.put(x - 2, 93, understring, 0);
  }

  let x = 160 - ((xfontsize / 2) | 0) * len;
  vga.get(x - 2, 93, x + xl, 93 + yfontsize + 4, understring);
  vga.box(x - 2, 93, x + xl, 93 + yfontsize + 4, 0, 0);
  vga.box(x - 2, 93, x + xl, 93 + yfontsize + 4, 15, 4);
  vga.drawtext(x, 95, string, 15, 0);

  let returnval = -1;
  while (returnval === -1) {
    while (!input.kbhit()) await timing.nextFrame();
    const key = input.getch();
    if (key === 89 || key === 121) returnval = 1;
    else if (key === 78 || key === 110) returnval = 0;
  }

  vga.put(x - 2, 93, understring, 0);

  for (; x > -136; x -= 20) {
    vga.get(x - 2, 93, x + xl, 93 + yfontsize + 4, understring);
    vga.box(x - 2, 93, x + xl, 93 + yfontsize + 4, 0, 0);
    vga.box(x - 2, 93, x + xl, 93 + yfontsize + 4, 15, 4);
    vga.drawtext(x, 95, string, 15, 0);
    vga.put(x - 2, 93, understring, 0);
  }

  return returnval;
}

