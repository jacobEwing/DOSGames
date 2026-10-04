// scores.js — high-score name entry and persistence.
//
// Ported from hex0009.cpp: test_high_scores and the simpler
// taketext(char *quote, int length).  Disk I/O is replaced with
// localStorage.

import * as vga from 'lib/vga.js';
import * as input from 'lib/input.js';
import * as timing from 'lib/timing.js';
import { state } from './state.js';
import { readScores, writeScores, show_high_scores } from './screens.js';

// Single-line text prompt.  Returns the entered string, or null on Esc.
async function taketext(quote, length) {
  const xf = vga.xfontsize, yf = vga.yfontsize;
  const quotex = (160 - (xf * quote.length) / 2) | 0;
  const quotey = 80;
  const boxx = quotex - 4;
  const boxy = quotey - 4;
  const textx1 = quotex;
  const texty1 = quotey + yf + 5;
  const xboxsize = quote.length * xf + 4;
  const yboxsize = 4 * yf + 8;

  vga.box(boxx, boxy, boxx + xboxsize, boxy + yboxsize, 0, 0);
  vga.box(boxx, boxy, boxx + xboxsize, boxy + yboxsize, 15, 4);
  vga.drawtext(quotex, quotey, quote, 15, 0);

  let drawx = textx1;
  const drawy = texty1;
  let str = '';

  while (input.kbhit()) input.getch();

  while (true) {
    if (input.kbhit()) {
      const k = input.getch();
      if (k === 27) return null;
      if (k === 13) return str;
      if (k === 8) {
        if (str.length > 0) {
          str = str.slice(0, -1);
          drawx -= xf;
          vga.drawtext(drawx, drawy, ' ', 15, 0);
        }
      } else if (k >= 32 && k <= 126) {
        if (str.length < 255 && str.length < length - 2) {
          const ch = String.fromCharCode(k);
          str += ch;
          vga.drawtext(drawx, drawy, ch, 15, 0);
          drawx += xf;
        }
      }
    }
    await timing.nextFrame();
  }
}

export async function test_high_scores() {
  const list = readScores();
  const numscores = list.length;
  let gotone = false;
  let rank = -1;

  for (let n = 0; n < numscores && !gotone; n++) {
    if (list[n].score < state.score) {
      const name = await taketext('What is Your Name?', 20);
      if (name === null) return;   // Esc cancels entry
      list.splice(n, 0, { name, score: state.score });
      rank = n;
      gotone = true;
    }
  }

  if (numscores < 10 && !gotone) {
    const name = await taketext('What is Your Name?', 20);
    if (name === null) return;
    list.push({ name, score: state.score });
    rank = numscores;
    gotone = true;
  }

  if (gotone) {
    writeScores(list);
    await show_high_scores();
  }
}
