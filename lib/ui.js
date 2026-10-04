// ui.js — shared UI widgets from mcgalib.cpp.
//
// All interactive widgets are async and yield to requestAnimationFrame while
// waiting for input, so callers must be inside an async context.

import * as vga from './vga.js';
import * as input from './input.js';
import * as timing from './timing.js';
import { loadPic } from './assets.js';

// -----------------------------------------------------------------------------
// Pointer configuration
// -----------------------------------------------------------------------------

let pointerUrl = 'assets/pointer.pic';
let pointerPicCache = null;

export function setPointerUrl(url) {
  pointerUrl = url;
  pointerPicCache = null;
}

async function getPointerPic() {
  if (!pointerPicCache) pointerPicCache = await loadPic(pointerUrl);
  return pointerPicCache;
}

// -----------------------------------------------------------------------------
// ScreenPointer — save/restore software cursor
// -----------------------------------------------------------------------------

export class ScreenPointer {
  constructor(pic) {
    this.pic = pic;
    this.under = new Uint8Array(2 + pic[0] * pic[1]);
    this.x = 0; this.y = 0; this.visible = false;
  }
  static async create() {
    return new ScreenPointer(await getPointerPic());
  }
  draw(x, y) {
    this.x = x; this.y = y;
    vga.get(x, y, x + this.pic[0] - 1, y + this.pic[1] - 1, this.under);
    vga.put(x, y, this.pic, 4);
    this.visible = true;
  }
  undraw() {
    if (!this.visible) return;
    vga.put(this.x, this.y, this.under, 0);
    this.visible = false;
  }
  moveTo(x, y) { this.undraw(); this.draw(x, y); }
  // Move to current mouse position; return the new {x, y}.
  sync() {
    const mx = input.mousex(), my = input.mousey();
    if (mx !== this.x || my !== this.y) this.moveTo(mx, my);
    else if (!this.visible) this.draw(mx, my);
    return { x: mx, y: my };
  }
}

// -----------------------------------------------------------------------------
// menubox — three nested boxes, the classic Arkann/mcgalib decoration.
// -----------------------------------------------------------------------------

export function menubox(x1, y1, x2, y2) {
  vga.box(x1 + 1, y1 + 1, x2, y2, 17, 4);
  vga.box(x1, y1, x2 - 1, y2 - 1, 23, 4);
  vga.box(x1 + 1, y1 + 1, x2 - 1, y2 - 1, 20, 0);
}

// -----------------------------------------------------------------------------
// menuscreen — full-screen menu over a tiled background.
//
//   title:   string
//   options: array of strings
//   config:  { background: url }
//
// Returns the index of the selected option.
// -----------------------------------------------------------------------------

export async function menuscreen(title, options, config) {
  const bg = await loadPic(config.background);
  const ptr = await ScreenPointer.create();
  const numoptions = options.length;
  const xf = vga.xfontsize, yf = vga.yfontsize;

  vga.erase(0, 0, 319, 199, 0, 0, bg);

  // Title
  const tx = (160 - (xf * title.length) / 2) | 0;
  const ty = 15;
  vga.box(tx - 24, ty - 9, tx + 26 + title.length * xf - 1, ty + 11 + yf - 1, 16, 0);
  vga.box(tx - 26, ty - 11, tx + 24 + title.length * xf - 1, ty + 9 + yf - 1, 20, 0);
  vga.box(tx - 25, ty - 10, tx + 25 + title.length * xf - 1, ty + 10 + yf - 1, 18, 0);
  vga.drawtext(tx, ty, title, 15, 4);

  // Options
  const x1 = new Int32Array(numoptions), x2 = new Int32Array(numoptions);
  const y1 = new Int32Array(numoptions), y2 = new Int32Array(numoptions);
  for (let n = 0; n < numoptions; n++) {
    x1[n] = (160 - (options[n].length * xf) / 2 - xf / 2) | 0;
    x2[n] = x1[n] + options[n].length * xf + xf;
    y1[n] = (130 + (n - (numoptions / 2 | 0)) * 2 * yf - (yf / 3 | 0)) | 0;
    y2[n] = y1[n] + yf + ((2 * yf / 3) | 0);
    vga.box(x1[n] + 1, y1[n] + 1, x2[n], y2[n], 18, 0);
    vga.box(x1[n], y1[n], x2[n] - 1, y2[n] - 1, 26, 0);
    vga.box(x1[n] + 1, y1[n] + 1, x2[n] - 1, y2[n] - 1, 22, 0);
    vga.drawtext(x1[n] + (xf / 2 | 0), y1[n] + (yf / 3 | 0), options[n], 15, 4);
  }

  while (input.kbhit()) input.getch();

  let copt = 0;
  vga.box(x1[copt], y1[copt], x2[copt], y2[copt], 4, 6);
  ptr.draw(input.mousex(), input.mousey());

  let chosen = -1;
  while (chosen === -1) {
    const { x: mx, y: my } = ptr.sync();

    // Hover: highlight option under cursor
    for (let n = 0; n < numoptions; n++) {
      if (mx >= x1[n] && mx <= x2[n] && my >= y1[n] && my <= y2[n] && n !== copt) {
        ptr.undraw();
        vga.box(x1[copt], y1[copt], x2[copt], y2[copt], -4, 6);
        copt = n;
        vga.box(x1[copt], y1[copt], x2[copt], y2[copt], 4, 6);
        ptr.draw(mx, my);
        break;   // only one option can be under the cursor
      }
    }

    // Click
    if (input.buttonpressed()) {
      let hit = -1;
      for (let n = 0; n < numoptions; n++) {
        if (mx >= x1[n] && mx <= x2[n] && my >= y1[n] && my <= y2[n]) { hit = n; break; }
      }
      while (input.buttonpressed()) await timing.nextFrame();
      if (hit !== -1) { chosen = hit; break; }
      continue;
    }

    // Keyboard
    if (input.kbhit()) {
      const k = input.getch();
      if (k === 13) { chosen = copt; break; }
      if (k === 0) {
        const scan = input.getch();
        // 72=Up, 75=Left -> previous; 80=Down, 77=Right -> next
        if (scan === 72 || scan === 75 || scan === 80 || scan === 77) {
          ptr.undraw();
          vga.box(x1[copt], y1[copt], x2[copt], y2[copt], -4, 6);
          if (scan === 72 || scan === 75) copt = (copt - 1 + numoptions) % numoptions;
          else                             copt = (copt + 1) % numoptions;
          vga.box(x1[copt], y1[copt], x2[copt], y2[copt], 4, 6);
          ptr.draw(input.mousex(), input.mousey());
        }
      }
    }

    await timing.nextFrame();
  }

  ptr.undraw();
  return chosen;
}

// -----------------------------------------------------------------------------
// choice — row of picture-options under a title box.
//
//   title:      string
//   optionPics: array of .pic buffers
//
// Returns the index of the chosen picture.
// -----------------------------------------------------------------------------

export async function choice(title, optionPics) {
  const ptr = await ScreenPointer.create();
  const numoptions = optionPics.length;
  const xf = vga.xfontsize, yf = vga.yfontsize;

  const tx = (160 - (xf * title.length) / 2) | 0;
  const ty = (100 - 2 * yf) | 0;

  const x1 = new Int32Array(numoptions), x2 = new Int32Array(numoptions);
  const y1 = new Int32Array(numoptions), y2 = new Int32Array(numoptions);

  // Lay out options side by side, centered around x=160.
  let totalHalf = 0;
  for (let n = 0; n < numoptions; n++) totalHalf += ((optionPics[n][0] + 10) / 2) | 0;
  x1[0] = 160 - totalHalf;
  x2[0] = x1[0] + optionPics[0][0] - 1;
  y1[0] = (100 - (optionPics[0][1] / 2 | 0) + 2 * yf) | 0;
  y2[0] = y1[0] + optionPics[0][1] - 1;
  for (let n = 1; n < numoptions; n++) {
    x1[n] = x2[n - 1] + 10;
    x2[n] = x1[n] + optionPics[n][0] - 1;
    y1[n] = (100 - (optionPics[n][1] / 2 | 0) + 2 * yf) | 0;
    y2[n] = y1[n] + optionPics[n][1] - 1;
  }

  // Bounding box around title and options.
  let bx1 = tx - 10, bx2 = tx + title.length * xf + 10;
  let by1 = ty - 10, by2 = ty + yf;
  for (let n = 0; n < numoptions; n++) {
    if (x1[n] - 10 < bx1) bx1 = x1[n] - 10;
    if (x2[n] + 10 > bx2) bx2 = x2[n] + 10;
    if (y1[n] - 10 < by1) by1 = y1[n] - 10;
    if (y2[n] + 10 > by2) by2 = y2[n] + 10;
  }
  vga.box(bx1 - 1, by1 - 1, bx2, by2, 22, 4);
  vga.box(bx1, by1, bx2 + 1, by2 + 1, 18, 4);
  vga.box(bx1, by1, bx2, by2, 20, 0);

  vga.drawtext(tx, ty, title, 15, 4);
  for (let n = 0; n < numoptions; n++) vga.put(x1[n], y1[n], optionPics[n], 0);

  while (input.kbhit()) input.getch();

  let copt = 0;
  vga.box(x1[copt] - 1, y1[copt] - 1, x2[copt] + 1, y2[copt] + 1, 14, 4);
  ptr.draw(input.mousex(), input.mousey());

  let chosen = -1;
  while (chosen === -1) {
    const { x: mx, y: my } = ptr.sync();

    // Hover
    for (let n = 0; n < numoptions; n++) {
      if (mx >= x1[n] && mx <= x2[n] && my >= y1[n] && my <= y2[n] && n !== copt) {
        vga.box(x1[copt] - 1, y1[copt] - 1, x2[copt] + 1, y2[copt] + 1, 20, 4);
        copt = n;
        vga.box(x1[copt] - 1, y1[copt] - 1, x2[copt] + 1, y2[copt] + 1, 14, 4);
      }
    }

    // Mouse press-and-drag: commit on release
    if (input.buttonpressed()) {
      let optionChosen = -1;
      while (input.buttonpressed()) {
        ptr.sync();
        const cx = input.mousex(), cy = input.mousey();
        optionChosen = -1;
        for (let n = 0; n < numoptions; n++) {
          if (cx >= x1[n] && cx <= x2[n] && cy >= y1[n] && cy <= y2[n]) {
            if (n !== copt) {
              ptr.undraw();
              vga.box(x1[copt] - 1, y1[copt] - 1, x2[copt] + 1, y2[copt] + 1, 20, 4);
              copt = n;
              vga.box(x1[copt] - 1, y1[copt] - 1, x2[copt] + 1, y2[copt] + 1, 14, 4);
              ptr.draw(cx, cy);
            }
            optionChosen = n;
          }
        }
        await timing.nextFrame();
      }
      if (optionChosen !== -1) { chosen = optionChosen; break; }
      continue;
    }

    // Keyboard
    if (input.kbhit()) {
      const k = input.getch();
      if (k === 13) { chosen = copt; break; }
      if (k === 0) {
        const scan = input.getch();
        if (scan === 72 || scan === 75 || scan === 80 || scan === 77) {
          ptr.undraw();
          vga.box(x1[copt] - 1, y1[copt] - 1, x2[copt] + 1, y2[copt] + 1, 20, 4);
          if (scan === 72 || scan === 75) copt = (copt - 1 + numoptions) % numoptions;
          else                             copt = (copt + 1) % numoptions;
          vga.box(x1[copt] - 1, y1[copt] - 1, x2[copt] + 1, y2[copt] + 1, 14, 4);
          ptr.draw(input.mousex(), input.mousey());
        }
      }
    }

    await timing.nextFrame();
  }

  ptr.undraw();
  return chosen;
}

// -----------------------------------------------------------------------------
// choose — modal dialog with text buttons and hotkeys.
//
//   title:   string
//   buttons: array of { text: string, hotkey: charCode }
//
// Returns the index of the chosen button.
// -----------------------------------------------------------------------------

export async function choose(title, buttons) {
  const ptr = await ScreenPointer.create();
  const xf = vga.xfontsize, yf = vga.yfontsize;
  const numbuttons = buttons.length;

  let buttonswidth = xf;
  for (let n = 0; n < numbuttons; n++) buttonswidth += (buttons[n].text.length + 1) * xf;
  const titlewidth = (title.length + 2) * xf;
  const boxwidth = Math.max(buttonswidth, titlewidth);

  const boxx1 = 160 - (boxwidth / 2 | 0);
  const boxx2 = boxx1 + boxwidth - 1;
  const boxy1 = (100 - 2 * yf) | 0;
  const boxy2 = boxy1 + 4 * yf - 1;

  const underbox = new Uint8Array(2 + (boxx2 - boxx1 + 1) * (boxy2 - boxy1 + 1));

  // Save what's under the box (pointer hidden so it isn't captured).
  ptr.undraw();
  vga.get(boxx1, boxy1, boxx2, boxy2, underbox);

  vga.box(boxx1, boxy1, boxx2 - 1, boxy2 - 1, 22, 4);
  vga.box(boxx1 + 1, boxy1 + 1, boxx2, boxy2, 18, 4);
  vga.box(boxx1 + 1, boxy1 + 1, boxx2 - 1, boxy2 - 1, 20, 0);

  // Buttons
  const btnBox = [];
  let x = 160 - (buttonswidth / 2 | 0);
  for (let n = 0; n < numbuttons; n++) {
    x += xf;
    const bx1 = x - 2;
    x += xf * buttons[n].text.length;
    const bx2 = x + 2;
    const by2 = boxy2 - (yf / 2 | 0) + 1;
    const by1 = by2 - yf - 2;
    btnBox.push({ x1: bx1, y1: by1, x2: bx2, y2: by2 });
    vga.box(bx1 + 1, by1 + 1, bx2, by2, 18, 4);
    vga.box(bx1, by1, bx2 - 1, by2 - 1, 22, 4);
    vga.box(bx1 + 1, by1 + 1, bx2 - 1, by2 - 1, 20, 0);
    vga.drawtext(bx1 + 2, by1 + 1, buttons[n].text, 15, 4);
  }

  vga.drawtext(160 - (titlewidth / 2 | 0) + xf, (boxy1 + yf / 2) | 0, title, 15, 4);

  ptr.draw(input.mousex(), input.mousey());

  let chosen = -1;
  while (chosen === -1) {
    if (input.kbhit()) {
      const k = input.getch();
      for (let n = 0; n < numbuttons; n++) {
        if (k === buttons[n].hotkey) { chosen = n; break; }
      }
      if (chosen !== -1) break;
    }

    ptr.sync();
    if (input.buttonpressed()) {
      const mx = input.mousex(), my = input.mousey();
      for (let n = 0; n < numbuttons; n++) {
        const b = btnBox[n];
        if (mx >= b.x1 && mx <= b.x2 && my >= b.y1 && my <= b.y2) { chosen = n; break; }
      }
      while (input.buttonpressed()) await timing.nextFrame();
    }

    await timing.nextFrame();
  }

  ptr.undraw();
  vga.put(boxx1, boxy1, underbox, 0);
  return chosen;
}

// -----------------------------------------------------------------------------
// taketext — text input field, optionally with buttons and hotkeys.
//
//   title:   string
//   buttons: optional array of { text: string, hotkey: charCode }
//
// Returns { text, buttonUsed }.  buttonUsed is -1 if Enter was pressed with no
// button matching; the C's "Enter sets *buttonused = 0" behaviour is preserved
// when buttons is non-empty.
// -----------------------------------------------------------------------------

export async function taketext(title, buttons = []) {
  const ptr = await ScreenPointer.create();
  const xf = vga.xfontsize, yf = vga.yfontsize;
  const numbuttons = buttons.length;

  let buttonswidth = xf;
  for (let n = 0; n < numbuttons; n++) buttonswidth += (buttons[n].text.length + 1) * xf;
  const titlewidth = (title.length + 2) * xf;
  const boxwidth = Math.max(buttonswidth, titlewidth);

  const boxx1 = 160 - (boxwidth / 2 | 0);
  const boxx2 = boxx1 + boxwidth - 1;
  const boxy1 = numbuttons ? (100 - 3 * yf) | 0 : (100 - 2 * yf) | 0;
  const boxy2 = boxy1 + (numbuttons ? 6 * yf : 4 * yf) - 1;

  const underbox = new Uint8Array(2 + (boxx2 - boxx1 + 1) * (boxy2 - boxy1 + 1));

  ptr.undraw();
  vga.get(boxx1, boxy1, boxx2, boxy2, underbox);

  vga.box(boxx1, boxy1, boxx2 - 1, boxy2 - 1, 22, 4);
  vga.box(boxx1 + 1, boxy1 + 1, boxx2, boxy2, 18, 4);
  vga.box(boxx1 + 1, boxy1 + 1, boxx2 - 1, boxy2 - 1, 20, 0);

  const btnBox = [];
  let x = 160 - (buttonswidth / 2 | 0);
  for (let n = 0; n < numbuttons; n++) {
    x += xf;
    const bx1 = x - 2;
    x += xf * buttons[n].text.length;
    const bx2 = x + 2;
    const by2 = boxy2 - (yf / 2 | 0) + 1;
    const by1 = by2 - yf - 2;
    btnBox.push({ x1: bx1, y1: by1, x2: bx2, y2: by2 });
    vga.box(bx1 + 1, by1 + 1, bx2, by2, 18, 4);
    vga.box(bx1, by1, bx2 - 1, by2 - 1, 22, 4);
    vga.box(bx1 + 1, by1 + 1, bx2 - 1, by2 - 1, 20, 0);
    vga.drawtext(bx1 + 2, by1 + 1, buttons[n].text, 15, 4);
  }

  vga.drawtext(160 - (titlewidth / 2 | 0) + xf, (boxy1 + yf / 2) | 0, title, 15, 4);

  // Text field geometry
  let w = boxx2 - boxx1 - 2 * xf;
  w -= w % xf;
  const textx1 = 160 - (w / 2 | 0);
  const textx2 = textx1 + w;
  const displaywidth = (w / xf) | 0;
  const texty = numbuttons
    ? (btnBox[0].y1 - 1.5 * yf) | 0
    : (boxy2 - 1.5 * yf) | 0;

  vga.box(textx1 - 2, texty - 2, textx2 + 1, texty + yf + 1, 18, 0);
  vga.box(textx1 - 1, texty - 1, textx2 + 2, texty + yf + 2, 22, 0);
  vga.box(textx1 - 1, texty - 1, textx2 + 1, texty + yf + 1, 0, 0);

  ptr.draw(input.mousex(), input.mousey());

  let text = '';
  let coffset = 0;      // 0 == cursor at end; negative == cursor earlier
  let doffset = 0;      // index of first displayed character
  let insertmode = 1;
  let buttonUsed = -1;

  const drawTextAndCursor = () => {
    let display = '';
    for (let i = 0; i < displaywidth; i++) {
      const idx = doffset + i;
      display += idx < text.length ? text[idx] : ' ';
    }
    ptr.undraw();
    vga.drawtext(textx1, texty, display, 15, 0);
    const cx = textx1 + xf * (text.length + coffset - doffset);
    const cw = (xf - 2) * (insertmode ? 0 : 1);
    vga.box(cx, texty, cx + cw, texty + yf - 1, 14, 1);
    ptr.draw(input.mousex(), input.mousey());
  };

  drawTextAndCursor();

  while (buttonUsed === -1) {
    if (input.kbhit()) {
      // Wipe cursor before processing keystroke
      ptr.undraw();
      const oldCx = textx1 + xf * (text.length + coffset - doffset);
      const oldCw = (xf - 2) * (insertmode ? 0 : 1);
      vga.box(oldCx, texty, oldCx + oldCw, texty + yf - 1, 0, 0);

      const key = input.getch();

      // Hotkeys
      let handled = false;
      for (let i = 0; i < numbuttons; i++) {
        if (key === buttons[i].hotkey) { buttonUsed = i; handled = true; break; }
      }

      if (!handled) {
        switch (key) {
          case 0: {
            const scan = input.getch();
            switch (scan) {
              case 71: coffset = -text.length; break;             // Home
              case 79: coffset = 0; break;                         // End
              case 75: if (-coffset < text.length) coffset--; break; // Left
              case 77: if (coffset < 0) coffset++; break;          // Right
              case 83: { // Del
                if (-coffset > 0) {
                  const pos = text.length + coffset;
                  text = text.slice(0, pos) + text.slice(pos + 1);
                  coffset++;
                }
                break;
              }
              case 82: insertmode = 1 - insertmode; break;         // Insert
            }
            break;
          }
          case 8: { // Backspace
            if (-coffset < text.length) {
              const pos = text.length + coffset - 1;
              if (pos >= 0) text = text.slice(0, pos) + text.slice(pos + 1);
            }
            break;
          }
          case 13: { // Enter
            buttonUsed = numbuttons ? 0 : -1;
            break;
          }
          default: {
            if (key >= 32 && key <= 126) {
              const ch = String.fromCharCode(key);
              const pos = text.length + coffset;
              if (insertmode) {
                text = text.slice(0, pos) + ch + text.slice(pos);
              } else {
                if (pos < text.length) {
                  text = text.slice(0, pos) + ch + text.slice(pos + 1);
                  if (coffset < 0) coffset++;
                } else {
                  text += ch;
                }
              }
            }
            break;
          }
        }
      }

      if (buttonUsed !== -1) break;

      // Keep cursor in the visible window
      const cursorIdx = text.length + coffset;
      const margin = insertmode ? 0 : 1;
      if (cursorIdx > doffset + displaywidth - margin) {
        doffset = cursorIdx - displaywidth + margin;
      }
      if (cursorIdx < doffset) doffset = cursorIdx;

      drawTextAndCursor();
    }

    ptr.sync();
    if (input.buttonpressed()) {
      const mx = input.mousex(), my = input.mousey();
      for (let i = 0; i < numbuttons; i++) {
        const b = btnBox[i];
        if (mx >= b.x1 && mx <= b.x2 && my >= b.y1 && my <= b.y2) { buttonUsed = i; break; }
      }
      while (input.buttonpressed()) await timing.nextFrame();
    }

    if (buttonUsed !== -1) break;
    await timing.nextFrame();
  }

  ptr.undraw();
  vga.put(boxx1, boxy1, underbox, 0);
  return { text, buttonUsed };
}

// -----------------------------------------------------------------------------
// adjust_value — numeric spinner.
//
//   value: initial value
//   min, max: bounds (min <= max; swapped if not)
//
// Returns { value, changed }.  On ESC, changed = false and value is unchanged.
// -----------------------------------------------------------------------------

export async function adjust_value(title, value, min, max) {
  const ptr = await ScreenPointer.create();
  const xf = vga.xfontsize, yf = vga.yfontsize;

  if (min > max) { const t = min; min = max; max = t; }
  let val = value;

  const tx = (160 - (xf * title.length) / 2) | 0;
  const ty = (100 - 2 * yf) | 0;
  let bx1 = tx - (xf >> 1);
  let bx2 = tx + xf * title.length + (xf >> 1);
  const by1 = ty - 2;
  const by2 = by1 + 3 * yf;

  const nx1 = ((bx1 + bx2) / 2 | 0) - 3 * xf;
  const nx2 = nx1 + 6 * xf;
  const ny1 = ty + yf + 4;
  const ny2 = ny1 + yf;

  if (nx1 < bx1) bx1 = nx1 - (xf >> 1);
  if (nx2 > bx2) bx2 = nx2 + (xf >> 1);

  const underbox = new Uint8Array(2 + (bx2 - bx1 + 1) * (by2 - by1 + 1));

  ptr.undraw();
  vga.get(bx1, by1, bx2, by2, underbox);
  vga.box(bx1 + 1, by1 + 1, bx2, by2, 18, 4);
  vga.box(bx1, by1, bx2 - 1, by2 - 1, 22, 4);
  vga.box(bx1 + 1, by1 + 1, bx2 - 1, by2 - 1, 20, 0);

  vga.drawtext(tx, ty, title, 15, 4);

  vga.box(nx1 - 3, ny1 - 3, nx2 + 2, ny2 + 2, 18, 4);
  vga.box(nx1 - 2, ny1 - 2, nx2 + 3, ny2 + 3, 22, 4);
  vga.box(nx1 - 2, ny1 - 2, nx2 + 2, ny2 + 2, 0, 0);
  vga.drawtext(nx1, ny1, String(val), 15, 0);

  ptr.draw(input.mousex(), input.mousey());

  const redrawValue = () => {
    ptr.undraw();
    vga.box(nx1 - 2, ny1 - 2, nx2 + 2, ny2 + 2, 0, 0);
    vga.drawtext(nx1, ny1, String(val), 15, 0);
    ptr.draw(input.mousex(), input.mousey());
  };

  let mdx = 0, mdy = 0;
  let changed = false;

  while (true) {
    // Mouse deltas
    const d = input.readmousediff();
    mdx += d.x;
    mdy += d.y;

    if (mdx > 10 || mdy < -10) {
      mdx = mdy = 0;
      val = (val + 1 > max) ? min : val + 1;
      redrawValue();
    } else if (mdx < -10 || mdy > 10) {
      mdx = mdy = 0;
      val = (val - 1 < min) ? max : val - 1;
      redrawValue();
    }

    // Click commits
    if (input.buttonpressed()) {
      changed = true;
      while (input.buttonpressed()) await timing.nextFrame();
      break;
    }

    // Keyboard
    if (input.kbhit()) {
      const k = input.getch();
      if (k === 27) { changed = false; break; }
      if (k === 13 || k === 32) { changed = true; break; }
      if (k === 0) {
        const scan = input.getch();
        // 72=Up, 77=Right -> increment; 75=Left, 80=Down -> decrement
        if (scan === 72 || scan === 77) {
          val = (val + 1 > max) ? min : val + 1;
          redrawValue();
        } else if (scan === 75 || scan === 80) {
          val = (val - 1 < min) ? max : val - 1;
          redrawValue();
        }
      }
    }

    ptr.sync();
    await timing.nextFrame();
  }

  ptr.undraw();
  vga.put(bx1, by1, underbox, 0);
  return { value: val, changed };
}
