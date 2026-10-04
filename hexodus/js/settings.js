// settings.js — Hexodus settings dialogs.
//
// Ported from hex0009.cpp: set_music, set_background_patterns,
// set_hexagon_characters, set_starting_level.

import * as vga from 'lib/vga.js';
import * as input from 'lib/input.js';
import * as timing from 'lib/timing.js';
import { loadPic } from 'lib/assets.js';
import { ScreenPointer } from 'lib/ui.js';
import { state } from './state.js';
import { load_hexagons } from './pieces.js';

// Shared: dialog with a title and a list of options.  Returns the chosen
// index, or the current value if Esc is pressed.
async function optionDialog(title, options, current) {
  const numoptions = options.length;
  const xf = vga.xfontsize, yf = vga.yfontsize;

  const bx1 = (160 - (xf * title.length) / 2 - 8) | 0;
  const bx2 = bx1 + xf * title.length + 16;
  const by1 = (100 - ((numoptions + 2) * yf * 1.5) / 2 - 8) | 0;
  const by2 = by1 + (numoptions + 2) * yf * 1.5 + 16;

  vga.box(bx1 + 1, by1 + 1, bx2, by2, 18, 4);
  vga.box(bx1, by1, bx2 - 1, by2 - 1, 22, 4);
  vga.box(bx1 + 1, by1 + 1, bx2 - 1, by2 - 1, 20, 0);

  const tx = [], ty = [], x1 = [], x2 = [], y1 = [], y2 = [];
  for (let n = 0; n < numoptions; n++) {
    tx[n] = (160 - (xf * options[n].length) / 2) | 0;
    ty[n] = (100 - ((numoptions + 2) * yf * 1.5) / 2
             + (n + 2) * yf * 1.5) | 0;
    x1[n] = tx[n] - 2;
    x2[n] = tx[n] + xf * options[n].length + 2;
    y1[n] = ty[n] - 2;
    y2[n] = ty[n] + yf + 2;
    vga.box(x1[n], y1[n], x2[n] - 1, y2[n] - 1, 22, 4);
    vga.box(x1[n] + 1, y1[n] + 1, x2[n], y2[n], 18, 4);
    vga.box(x1[n] + 1, y1[n] + 1, x2[n] - 1, y2[n] - 1, 20, 0);
    vga.drawtext(tx[n], ty[n], options[n], 15, 4);
  }
  vga.drawtext(bx1 + 8, by1 + 8 + (yf / 2 | 0), title, 15, 4);

  const ptr = await ScreenPointer.create();
  let copt = current;
  vga.box(x1[copt], y1[copt], x2[copt], y2[copt], 4, 6);
  ptr.draw(input.mousex(), input.mousey());

  let result = current;
  let done = false;
  let obp = false;

  while (!done) {
    if (input.kbhit()) {
      const k = input.getch();
      if (k === 27) { done = true; }
      else if (k === 13 || k === 32) { result = copt; done = true; }
      else if (k === 0) {
        const scan = input.getch();
        if (scan === 72 || scan === 75 || scan === 77 || scan === 80) {
          ptr.undraw();
          vga.box(x1[copt], y1[copt], x2[copt], y2[copt], -4, 6);
          if (scan === 72 || scan === 75) copt = (copt - 1 + numoptions) % numoptions;
          else                            copt = (copt + 1) % numoptions;
          vga.box(x1[copt], y1[copt], x2[copt], y2[copt], 4, 6);
          ptr.draw(input.mousex(), input.mousey());
        }
      }
    }

    const { x: mx, y: my } = ptr.sync();
    for (let n = 0; n < numoptions; n++) {
      if (mx >= x1[n] && mx <= x2[n] && my >= y1[n] && my <= y2[n]
          && n !== copt) {
        ptr.undraw();
        vga.box(x1[copt], y1[copt], x2[copt], y2[copt], -4, 6);
        copt = n;
        vga.box(x1[copt], y1[copt], x2[copt], y2[copt], 4, 6);
        ptr.draw(mx, my);
        break;
      }
    }

    const bp = input.buttonpressed();
    if (!bp && obp) {
      for (let n = 0; n < numoptions; n++) {
        if (mx >= x1[n] && mx <= x2[n] && my >= y1[n] && my <= y2[n]) {
          result = n; done = true;
        }
      }
    }
    obp = bp;

    await timing.nextFrame();
  }

  ptr.undraw();
  vga.erase(bx1, by1, bx2, by2, 0, 0, state.backg);
  return result;
}

export async function set_music() {
  // Silent port: the choice is remembered but nothing plays.
  state.music_on = await optionDialog(
    'What music would you like:',
    ['None', 'Tune #1', 'Tune #2', 'Tune #3'],
    state.music_on
  );
}

export async function set_background_patterns() {
  state.backgpattern = await optionDialog(
    'Please choose a background:',
    ['Colour Patterns', 'Grey Pattern', 'Blackness'],
    state.backgpattern
  );
}

// ---------------------------------------------------------------------------
// set_hexagon_characters — five preview hexagons, choose one.
// ---------------------------------------------------------------------------

export async function set_hexagon_characters() {
  const numoptions = 5;
  const xf = vga.xfontsize, yf = vga.yfontsize;

  const hexpic = [];
  for (let n = 0; n < numoptions; n++) {
    hexpic[n] = await loadPic(`assets/hex${n + 1}${'ABCDE'[n]}.pic`);
  }

  const x1 = [], x2 = [], y1 = [], y2 = [];
  for (let n = 0; n < numoptions; n++) {
    x1[n] = (160 - (2 * hexpic[0][0] * numoptions) / 2
             + 2 * hexpic[0][0] * n) | 0;
    x2[n] = x1[n] + hexpic[0][0] - 1;
    y1[n] = 110;
    y2[n] = y1[n] + hexpic[0][1] - 1;
  }
  let bx1 = x1[0] - 10;
  let bx2 = x1[numoptions - 1] + hexpic[0][0] + 10;
  let by1 = y1[0] - 10 - yf - 10;
  let by2 = y1[0] + hexpic[0][1] + 10;
  const title = 'Please choose:';
  const tx = (160 - (title.length * xf) / 2) | 0;
  const ty = by1 + 10;
  if (tx <= bx1 + 10) bx1 = tx - 10;
  if (tx + xf * title.length > bx2) bx2 = tx + xf * title.length + 10;

  vga.box(bx1 + 1, by1 + 1, bx2, by2, 18, 4);
  vga.box(bx1, by1, bx2 - 1, by2 - 1, 22, 4);
  vga.box(bx1 + 1, by1 + 1, bx2 - 1, by2 - 1, 20, 0);
  vga.drawtext(tx, ty, title, 15, 4);

  for (let n = 0; n < numoptions; n++) {
    x1[n] -= 3; y1[n] -= 3; x2[n] += 3; y2[n] += 3;
    vga.box(x1[n], y1[n], x2[n] - 1, y2[n] - 1, 22, 4);
    vga.box(x1[n] + 1, y1[n] + 1, x2[n], y2[n], 18, 4);
    vga.box(x1[n] + 1, y1[n] + 1, x2[n] - 1, y2[n] - 1, 20, 0);
    vga.put(x1[n] + 3, y1[n] + 3, hexpic[n], 4);
  }

  const ptr = await ScreenPointer.create();
  let copt = state.hexagon_picture_type;
  vga.box(x1[copt] - 1, y1[copt] - 1, x2[copt] + 1, y2[copt] + 1, 14, 4);
  ptr.draw(input.mousex(), input.mousey());

  let done = false;
  let obp = false;

  while (!done) {
    if (input.kbhit()) {
      const k = input.getch();
      if (k === 27) done = true;
      else if (k === 13 || k === 32) {
        done = true;
        state.hexagon_picture_type = copt;
        await load_hexagons(copt);
      } else if (k === 0) {
        const scan = input.getch();
        if (scan === 72 || scan === 75 || scan === 77 || scan === 80) {
          ptr.undraw();
          vga.box(x1[copt] - 1, y1[copt] - 1, x2[copt] + 1, y2[copt] + 1, 20, 4);
          if (scan === 72 || scan === 75) copt = (copt - 1 + numoptions) % numoptions;
          else                            copt = (copt + 1) % numoptions;
          vga.box(x1[copt] - 1, y1[copt] - 1, x2[copt] + 1, y2[copt] + 1, 14, 4);
          ptr.draw(input.mousex(), input.mousey());
        }
      }
    }

    const { x: mx, y: my } = ptr.sync();
    for (let n = 0; n < numoptions; n++) {
      if (mx >= x1[n] && mx <= x2[n] && my >= y1[n] && my <= y2[n]
          && n !== copt) {
        ptr.undraw();
        vga.box(x1[copt] - 1, y1[copt] - 1, x2[copt] + 1, y2[copt] + 1, 20, 4);
        copt = n;
        vga.box(x1[copt] - 1, y1[copt] - 1, x2[copt] + 1, y2[copt] + 1, 14, 4);
        ptr.draw(mx, my);
        break;
      }
    }

    const bp = input.buttonpressed();
    if (!bp && obp) {
      for (let n = 0; n < numoptions; n++) {
        if (mx >= x1[n] && mx <= x2[n] && my >= y1[n] && my <= y2[n]) {
          done = true;
          state.hexagon_picture_type = n;
          await load_hexagons(n);
        }
      }
    }
    obp = bp;

    await timing.nextFrame();
  }

  ptr.undraw();
  vga.erase(bx1, by1, bx2, by2, 0, 0, state.backg);
}

// ---------------------------------------------------------------------------
// set_starting_level — numeric spinner (0..9).
// ---------------------------------------------------------------------------

export async function set_starting_level() {
  const xf = vga.xfontsize, yf = vga.yfontsize;
  const title = 'Starting Level';
  const tx = (160 - (xf * title.length) / 2) | 0;
  const ty = (100 - 2 * xf) | 0;
  const bx1 = tx - 10;
  const bx2 = tx + (xf * title.length) + 10;
  const by1 = ty - 10;
  const by2 = by1 + 4 * yf;
  const nx1 = ((bx1 + bx2) / 2 | 0) - xf;
  const nx2 = nx1 + 2 * xf;
  const ny1 = ty + yf + 8;
  const ny2 = ny1 + yf;

  vga.box(bx1 + 1, by1 + 1, bx2, by2, 18, 4);
  vga.box(bx1, by1, bx2 - 1, by2 - 1, 22, 4);
  vga.box(bx1 + 1, by1 + 1, bx2 - 1, by2 - 1, 20, 0);
  vga.drawtext(tx, ty, title, 15, 4);

  vga.box(nx1 - 3, ny1 - 3, nx2 + 2, ny2 + 2, 18, 4);
  vga.box(nx1 - 2, ny1 - 2, nx2 + 3, ny2 + 3, 22, 4);
  vga.box(nx1 - 2, ny1 - 2, nx2 + 2, ny2 + 2, 0, 0);

  let val = state.starting_level;
  const drawVal = () => {
    vga.box(nx1 - 2, ny1 - 2, nx2 + 2, ny2 + 2, 0, 0);
    vga.drawtext(nx1, ny1, String(val), 15, 0);
  };
  drawVal();

  const ptr = await ScreenPointer.create();
  ptr.draw(input.mousex(), input.mousey());

  let mdx = 0, mdy = 0;
  let done = false;

  while (!done) {
    const d = input.readmousediff();
    mdx += d.x; mdy += d.y;

    if (mdx > 10 || mdy < -10) {
      mdx = mdy = 0;
      ptr.undraw();
      val = (val + 1) % 10;
      drawVal();
      ptr.draw(input.mousex(), input.mousey());
    } else if (mdx < -10 || mdy > 10) {
      mdx = mdy = 0;
      ptr.undraw();
      val = val - 1; if (val < 0) val = 9;
      drawVal();
      ptr.draw(input.mousex(), input.mousey());
    }

    if (input.buttonpressed()) {
      state.starting_level = val;
      while (input.buttonpressed()) await timing.nextFrame();
      done = true;
      break;
    }

    if (input.kbhit()) {
      const k = input.getch();
      if (k === 27) { done = true; }
      else if (k === 13 || k === 32) { state.starting_level = val; done = true; }
      else if (k === 0) {
        const scan = input.getch();
        ptr.undraw();
        if (scan === 72 || scan === 77) val = (val + 1) % 10;
        else if (scan === 75 || scan === 80) { val = val - 1; if (val < 0) val = 9; }
        drawVal();
        ptr.draw(input.mousex(), input.mousey());
      }
    }

    ptr.sync();
    await timing.nextFrame();
  }

  ptr.undraw();
  vga.erase(bx1, by1, bx2, by2, 0, 0, state.backg);
}
