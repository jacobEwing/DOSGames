// screens.js — Hexodus full-screen menus.
//
// Ported from hex0009.cpp:
//   menuscreen (the version with the copyright line, used by main),
//   explain_game, show_high_scores, show_credits.

import * as vga from 'lib/vga.js';
import * as input from 'lib/input.js';
import * as timing from 'lib/timing.js';
import { loadPic, setFontFrom } from 'lib/assets.js';
import { ScreenPointer } from 'lib/ui.js';
import { state } from './state.js';

// ---------------------------------------------------------------------------
// menuscreen — title box, optional copyright strip, vertical option list.
// ---------------------------------------------------------------------------

export async function menuscreen(title, draw_copyright, background, options) {
  const bg = await loadPic(`assets/${background}`);
  const ptr = await ScreenPointer.create();
  const numoptions = options.length;
  const xf = vga.xfontsize, yf = vga.yfontsize;

  vga.erase(0, 0, 319, 199, 0, 0, bg);

  const tx = (160 - (xf * title.length) / 2) | 0;
  const ty = 15;
	  
  vga.box(tx - 24, ty - 9, tx + 26 + title.length * xf - 1,
          ty + 11 + yf - 1, 16, 0);
  vga.box(tx - 26, ty - 11, tx + 24 + title.length * xf - 1,
          ty + 9 + yf - 1, 20, 0);
  vga.box(tx - 25, ty - 10, tx + 25 + title.length * xf - 1,
          ty + 10 + yf - 1, 18, 0);
	 
  vga.drawtext(tx, ty, title, 15, 4);
/*
  if (draw_copyright) {
    vga.box(tx - 25, ty + 10 + yf,
            tx + 25 + title.length * xf - 1,
            ty + 10 + 2 * yf, 4, 6);
    vga.put(160 - ((state.copyright[0] / 2) | 0), ty + yf + 4,
            state.copyright, 4);
    vga.put(tx + title.length * xf, ty + yf - state.tm[1], state.tm, 4);
  }
*/

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
    vga.drawtext(x1[n] + (xf / 2 | 0), y1[n] + (yf / 3 | 0),
                 options[n], 15, 4);
  }

  while (input.kbhit()) input.getch();

  let copt = 0;
  vga.box(x1[copt], y1[copt], x2[copt], y2[copt], 4, 6);
  ptr.draw(input.mousex(), input.mousey());

  let chosen = -1;
  while (chosen === -1) {
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

    if (input.buttonpressed()) {
      let hit = -1;
      for (let n = 0; n < numoptions; n++) {
        if (mx >= x1[n] && mx <= x2[n] && my >= y1[n] && my <= y2[n]) {
          hit = n; break;
        }
      }
      while (input.buttonpressed()) await timing.nextFrame();
      if (hit !== -1) { chosen = hit; break; }
      continue;
    }

    if (input.kbhit()) {
      const k = input.getch();
      if (k === 13) { chosen = copt; break; }
      if (k === 0) {
        const scan = input.getch();
        if (scan === 72 || scan === 75 || scan === 80 || scan === 77) {
          ptr.undraw();
          vga.box(x1[copt], y1[copt], x2[copt], y2[copt], -4, 6);
          if (scan === 72 || scan === 75) copt = (copt - 1 + numoptions) % numoptions;
          else                            copt = (copt + 1) % numoptions;
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

// ---------------------------------------------------------------------------
// explain_game — paginated help screen with LEFT / RIGHT / DONE buttons.
// ---------------------------------------------------------------------------

const HELP_PAGES = [
  [
    'How to Play:', ' ',
    'Hexodus is an extremely addictive game which is',
    'great fun to play and very easy to learn.',
    'This is how it works:', ' ',
    'When you start the game, an area of the screen',
    'will bear a small hexagon pattern, this is the',
    'playing grid.  At the top of the grid, you will',
    'see a shape composed of hexagons, each of the',
    'hexagons in the shape will be drawn in one of six',
    'differnt colours.  You can rotate this shape, and',
    'move it left or right.',
    'The object of the game is to build a tower with',
    'these shapes up to the top of the grid.',
    'There is, however, a catch or two...',
  ],
  [
    'Any hexagons that you land on must be of the same',
    'colour as the one that\'s landing. If they land on',
    'the wrong colour, the whole shape and the hexagon',
    'it landed on will disappear.',
    'On top of that, as you build the tower, it will',
    'disappear at the bottom, making it much harder to',
    'reach the top of the screen', ' ',
    'When you reach the top of the screen, you go on to',
    'the next level.  As the level increases, the',
    'pieces fall faster and the tower will diminish',
    'at a higher speed.',
    'If the tower disappears completely, the game ends.',
  ],
  [
    'Controls:', ' ',
    'You can use either the mouse or the keyboard at',
    'any time throughout the game.  During the game,',
    'the keyboard controls are as follows:', ' ',
    '[left] ......... Moves the shape to the left.',
    '[right] ....... Moves the shape to the right.',
    '[up] ........... Rotates the shape clockwise.',
    '[down] ........ Makes the shape fall quickly.',
    '[z] .... Rotates the shape counter-clockwise.',
    '[x] ............ Rotates the shape clockwise.',
    '[ESC] ............... Exits to the main menu.',
    '[SPACE] .................... Pauses the game.',
  ],
  [
    'These are the mouse controls:', ' ',
    'Moving left drags the shape to the left.',
    'Moving right drags the shape to the right.',
    'Moving down makes the shape fall quickly.',
    'Left mouse button rotates counter-clockwise.',
    'Right mouse button rotates clockwise.',
  ],
  [
    'Settings:',
    'When you select `Settings` on the main menu, you',
    'will be given a menu containing these options:', ' ',
    '`Music`: Lets you turn the music on or off.', ' ',
    '`Background Patterns`: lets you set the type of',
    '    patterns under the game.', ' ',
    '`Hexagon Characters`: lets you select the type of',
    '    hexagons that the shapes are made of.', ' ',
    '`Starting Level`: lets you set the level at which',
    '    the game starts.', ' ',
    '`Main Menu`: returns you to the main menu.',
  ],
];

export async function explain_game() {
  const bg = state.backg = await loadPic('assets/underhlp.pic');
  const left  = await loadPic('assets/left.pic');
  const right = await loadPic('assets/right.pic');
  const done  = await loadPic('assets/done.pic');

  const numoptions = HELP_PAGES.length;
  const button = [
    { pic: left,  x: 0, y: 0 },
    { pic: right, x: 0, y: 0 },
    { pic: done,  x: 0, y: 0 },
  ];
  button[2].x = 160 - (button[2].pic[0] / 2 | 0);
  button[2].y = 199 - button[2].pic[1];
  button[0].x = button[2].x - button[0].pic[0] - 2;
  button[0].y = 199 - button[0].pic[1];
  button[1].x = button[2].x + button[2].pic[0] + 2;
  button[1].y = 199 - button[1].pic[1];

  vga.erase(0, 0, 319, 199, 0, 0, bg);
  vga.put(button[2].x, button[2].y, button[2].pic, 0);

  vga.drawtext((160 - 3.5 * vga.xfontsize) | 0, 10, 'Hexodus', 15, 4);
  vga.put((160 + 3.5 * vga.xfontsize) | 0,
          10 + vga.yfontsize - state.tm[1], state.tm, 4);
  await setFontFrom('assets/6x6.blf');
  vga.drawtext((160 - 13.5 * vga.xfontsize) | 0, 26,
               'Copyright 1997, Jacob Ewing', 15, 4);

  const ptr = await ScreenPointer.create();
  ptr.draw(input.mousex(), input.mousey());

  let optionnum = 0;
  let done_flag = false;

  while (!done_flag) {
    const text = HELP_PAGES[optionnum];
    const numlines = text.length;
    const xf = vga.xfontsize, yf = vga.yfontsize;

    let ty1 = (100 - ((numlines * yf) >> 1)) | 0;
    const ty2 = ty1 + (numlines + 1) * yf;
    let tx1 = 160, tx2 = 160;
    let y = ty1 + (yf / 2 | 0);
    for (let n = 0; n < numlines; n++) {
      const line = text[n].replace(/`/g, '"');
      const x = (160 - xf * (line.length / 2)) | 0;
      vga.drawtext(x, y, line, 15, 4);
      if (x < tx1) {
        tx1 = x;
        tx2 = tx1 + xf * (line.length + 1);
      }
      y += yf;
    }
    if (optionnum > 0) vga.put(button[0].x, button[0].y, button[0].pic, 0);
    else vga.erase(button[0].x, button[0].y,
                   button[0].x + button[0].pic[0] - 1,
                   button[0].y + button[0].pic[1] - 1, 0, 0, bg);
    if (optionnum < numoptions - 1)
      vga.put(button[1].x, button[1].y, button[1].pic, 0);
    else vga.erase(button[1].x, button[1].y,
                   button[1].x + button[1].pic[0] - 1,
                   button[1].y + button[1].pic[1] - 1, 0, 0, bg);

    ptr.sync();

    let hit_a_button = 0;
    let gotone = false;
    while (!gotone) {
      if (input.kbhit()) {
        const k = input.getch();
        if (k === 0) {
          const scan = input.getch();
          if ((scan === 72 || scan === 77) && optionnum < numoptions - 1) {
            optionnum++; gotone = true;
          } else if ((scan === 75 || scan === 80) && optionnum > 0) {
            optionnum--; gotone = true;
          }
        } else {
          gotone = true; done_flag = true;
        }
      }

      ptr.sync();

      if (input.buttonpressed()) {
        let hit = 0;
        while (input.buttonpressed()) {
          ptr.sync();
          const mx = input.mousex(), my = input.mousey();
          hit = 0;
          for (let n = 0; n < 3; n++) {
            const b = button[n];
            if (mx >= b.x && mx <= b.x + b.pic[0] - 1
                && my >= b.y && my <= b.y + b.pic[1] - 1) {
              if ((n !== 0 || optionnum > 0)
                  && (n !== 1 || optionnum < numoptions - 1)) {
                hit = n + 1; break;
              }
            }
          }
          await timing.nextFrame();
        }
        if (hit) { hit_a_button = hit; gotone = true; }
      }

      await timing.nextFrame();
    }

    ptr.undraw();
    vga.erase(tx1, ty1, tx2, ty2, 0, 0, bg);

    switch (hit_a_button) {
      case 1: if (optionnum > 0) optionnum--; break;
      case 2: if (optionnum < numoptions - 1) optionnum++; break;
      case 3: done_flag = true; break;
    }
  }

  ptr.undraw();
  vga.cls();
}

// ---------------------------------------------------------------------------
// show_high_scores — score table with particle animation.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'hexodus.highscores';

export function readScores() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, 10).map(e => ({
      name: String(e.name || '').replace(/\n/g, ''),
      score: Number(e.score) || 0,
    }));
  } catch { return []; }
}

export function writeScores(list) {
  localStorage.setItem(STORAGE_KEY,
    JSON.stringify(list.slice(0, 10)));
}

export async function show_high_scores() {
  await setFontFrom('assets/thin.blf');
  const bg = state.backg = await loadPic('assets/underhsc.pic');
  vga.cls();

  const xf = vga.xfontsize, yf = vga.yfontsize;
  const x1 = 40, x2 = 280;
  const y1 = (100 - 5 * yf - 10) | 0;
  const y2 = (100 + 5 * yf + 10) | 0;

  vga.erase(x1, y1, x2, y2, 0, 0, bg);
  vga.box(x1, y1, x2, y2, 24, 4);
  vga.box(x1 + 1, y1 + 1, x2 - 1, y2 - 1, 20, 4);
  vga.box(x1 + 2, y1 + 2, x2 - 2, y2 - 2, 28, 4);

  const scores = readScores();
  for (let n = 0; n < scores.length && n < 10; n++) {
    const y = 100 + (n - 5) * yf;
    vga.drawtext(50, y, scores[n].name, 15, 4);
    const s = String(scores[n].score);
    vga.drawtext(270 - s.length * xf, y, s, 15, 4);
  }

  const N = 200;
  const dx = new Int32Array(N), dy = new Int32Array(N), dz = new Uint8Array(N);
  for (let n = 0; n < N; n++) {
    dx[n] = Math.floor(Math.random() * 320);
    dy[n] = Math.floor(Math.random() * 200);
    dz[n] = Math.floor(Math.random() * 128);
  }

  while (!input.kbhit() && !input.buttonpressed()) {
    for (let n = 0; n < N; n++) {
      if (dx[n] < x1 || dx[n] > x2 || dy[n] < y1 || dy[n] > y2)
        vga.putpixel(dx[n], dy[n], 0, 0);
      dx[n] += 4;
      if (dx[n] < 0) dx[n] += 320;
      if (dy[n] < 0) dy[n] += 200;
      if (dx[n] > 319) dx[n] -= 320;
      if (dy[n] > 199) dy[n] -= 200;
      dy[n] += ((dx[n] - 159) / 20) | 0;
      if (dx[n] < x1 || dx[n] > x2 || dy[n] < y1 || dy[n] > y2)
        vga.putpixel(dx[n], dy[n], dz[n], 0);
    }
    await timing.nextFrame();
  }
  if (input.kbhit()) input.getch();
}

// ---------------------------------------------------------------------------
// show_credits — vertical credits scroll.
// ---------------------------------------------------------------------------

const CREDITS = [
  'Concept:  Jacob Ewing',
  'Design:  Jacob Ewing',
  'Programming:  Jacob Ewing',
  'Artwork:  Jacob Ewing',
  'Music:  Jacob Ewing',
  'Writing:  Jacob Ewing',
  'Testing:  Jacob Ewing',
  'Debugging:  Jacob Ewing',
  'Special Thanks to:  Jacob Ewing',
  'I\x03:  Jacob Ewing',
  'God Complex:  Jacob Ewing',
  'Please send money to:  Jacob Ewing',
  '', '',
];

export async function show_credits() {
  await setFontFrom('assets/5x5.blf');
  const xf = vga.xfontsize, yf = vga.yfontsize;
  const n = CREDITS.length;
  const spacing = 40;

  const cx = new Int32Array(n);
  const cy = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    cx[i] = 160 - ((CREDITS[i].length * xf) / 2 | 0);
    cy[i] = 200 + i * spacing;
  }

  const bg = state.backg = await loadPic('assets/undercrd.pic');
  vga.erase(0, 0, 319, 199, 0, 0, bg);

  while (!input.kbhit() && !input.buttonpressed()) {
    for (let i = 0; i < n; i++) {
      if (cy[i] < 200 && cy[i] > -yf) {
        vga.erase(cx[i], cy[i],
                  cx[i] + CREDITS[i].length * xf - 1,
                  cy[i] + yf - 1, 0, 0, bg);
      }
      cy[i] -= 1;
      if (cy[i] < -yf) {
        cy[i] = (i === 0 ? cy[n - 1] : cy[i - 1]) + spacing;
      }
      if (cy[i] < 200) {
        vga.drawtext(cx[i], cy[i], CREDITS[i], 15, 4);
      }
    }
    await timing.nextFrame();
  }
  while (input.kbhit()) input.getch();
}
