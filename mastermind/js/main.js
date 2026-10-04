// main.js — Mastermind
//
// Port of mmind09.c.  Drawing primitives, input, timing, palette, and asset
// loading live in lib/; this file holds the game-specific logic: the board
// model, the peg pile management, the pattern tester, the settings screen,
// the credits scroll, and the how-to-play screen.

import * as vga from 'lib/vga.js';
import * as input from 'lib/input.js';
import * as timing from 'lib/timing.js';
import * as assets from 'lib/assets.js';
import * as ui from 'lib/ui.js';

// ---- Constants -------------------------------------------------------------
const BUTTONBORDERSIZE = 4;
const MAXCOLOURS = 12, MINCOLOURS = 5;
const MAXCOLS    = 6,  MINCOLS    = 3;
const MAXROWS    = 16, MINROWS    = 3;
const MAXHOLES   = 96;             // 6 * 16
const MIDHOLEX   = 130;
const MIDHOLEY   = 100;

// ---- Globals ---------------------------------------------------------------
let numcolours = 8;
let numcols    = 5;
let numrows    = 12;
let numholes   = 0;                // = numcols * numrows, set before play_game

const pegpic  = new Array(MAXCOLOURS);   // 12 peg colours
const holepic = new Array(2);            // empty hole, filled hole
const pinpic  = new Array(2);            // exact-match pin, colour-match pin
let   ppic    = null;                    // the standard mouse pointer pic

const button = [];                       // text buttons (Test Pattern etc.)
let   numbuttons = 0;

// ---- Asset loading ---------------------------------------------------------

const PEG_NAMES = [
  'redpeg.pic', 'grnpeg.pic', 'blupeg.pic', 'yelpeg.pic',
  'prppeg.pic', 'cynpeg.pic', 'whtpeg.pic', 'blkpeg.pic',
  'brnpeg.pic', 'pnkpeg.pic', 'grypeg.pic', 'navpeg.pic',
];

async function load_pics() {
  const [p0, p1, ptr, h0, h1, ...pegs] = await Promise.all([
    assets.loadPic('assets/pin2.pic'),
    assets.loadPic('assets/pin1.pic'),
    assets.loadPic('assets/pointer.pic'),
    assets.loadPic('assets/hole1.pic'),
    assets.loadPic('assets/hole2.pic'),
    ...PEG_NAMES.map(n => assets.loadPic('assets/' + n)),
  ]);
  pinpic[0] = p0; pinpic[1] = p1;
  ppic      = ptr;
  holepic[0] = h0; holepic[1] = h1;
  for (let i = 0; i < pegs.length; i++) pegpic[i] = pegs[i];
}

// ---- Buttons ---------------------------------------------------------------

// build_button mirrors the C, except that text buttons store the string
// directly instead of strdup'ing it, and pic buttons just hold the Uint8Array.
function build_button(type, contents) {
  const b = { x: 0, y: 0, xsize: 0, ysize: 0, type, contents };
  if (!type) {
    b.xsize = vga.xfontsize * contents.length + 2 * BUTTONBORDERSIZE;
    b.ysize = vga.yfontsize               + 2 * BUTTONBORDERSIZE;
  } else {
    b.xsize = contents[0];
    b.ysize = contents[1];
  }
  return b;
}

function draw_button(btn, mode) {
  const x1 = btn.x, y1 = btn.y;
  if (!btn.type) {
    const x2 = x1 + btn.xsize - 1;
    const y2 = y1 + btn.ysize - 1;
    const x  = x1 + BUTTONBORDERSIZE;
    const y  = y1 + BUTTONBORDERSIZE;
    vga.box(x1,     y1,     x2 - 1, y2 - 1, 26, 0);
    vga.box(x1 + 1, y1 + 1, x2,     y2,     22, 0);
    vga.box(x1 + 1, y1 + 1, x2 - 1, y2 - 1, 24, 0);
    vga.drawtext(x, y, btn.contents, 15, mode);
  } else {
    vga.put(x1, y1, btn.contents, mode);
  }
}

// ---- Board layout ----------------------------------------------------------

function place_buttons() {
  let x = 40;
  for (let n = 0; n < numbuttons; n++) {
    button[n].y = 5;
    button[n].x = x;
    x += button[n].xsize + 5;
    draw_button(button[n], 4);
  }
}

function place_holes(peg, marker) {
  const xspacing = 3, yspacing = 2;
  const miny = MIDHOLEY - ((numrows * holepic[0][1]) >> 1);

  for (let n = 0; n < numholes; n++) {
    peg[n].x    = MIDHOLEX + 5 + (holepic[0][0] + xspacing) * (n % numcols);
    peg[n].y    = miny + (yspacing + holepic[0][1]) * Math.floor(n / numcols);
    peg[n].pic  = holepic[0];
    marker[n].x = MIDHOLEX - 10 - (holepic[1][0] + xspacing) * (n % numcols);
    marker[n].y = miny + 1 + (yspacing + holepic[0][1]) * Math.floor(n / numcols);
    marker[n].pic = holepic[1];
    marker[n].status = peg[n].status = 0;
  }

  for (let n = 0; n < numholes; n++) {
    vga.put(marker[n].x, marker[n].y, marker[n].pic, 4);
    vga.put(peg[n].x,    peg[n].y,    peg[n].pic,    4);

    if (!(n % numcols)) {
      const text = String(numrows - Math.floor(n / numcols));
      const tx = MIDHOLEX + (holepic[0][0] + 2) * numcols + vga.xfontsize;
      const ty = miny + (holepic[0][1] + 2) * Math.floor(n / numcols);
      vga.drawtext(tx + 1, ty + 1, text, 248, 4);
      vga.drawtext(tx,     ty,     text, 249, 4);
    }
  }
}

function place_pegbuttons(pegbutton) {
  // Figure out a pleasing grid width based on numcolours.
  let width;
  for (width = 5 - (numcolours === 5 ? 1 : 0); numcolours % width; width--);
  if (width <= 1) width = 3;
  else            width = Math.floor(numcolours / width);

  let yoffset = Math.floor(numcolours / width) + (numcolours % width !== 0 ? 1 : 0);
  yoffset = (yoffset * (pegpic[0][1] + 1)) >> 1;

  for (let n = 0; n < numcolours; n++) {
    const x = (n % width) * (pegpic[n][0] + 2) + 212;
    const y = Math.floor(n / width) * (pegpic[n][1] + 2) + 100 - yoffset;
    pegbutton[n].x = x;
    pegbutton[n].y = y;
    pegbutton[n].xsize = pegpic[n][0];
    pegbutton[n].ysize = pegpic[n][1];
    pegbutton[n].contents = pegpic[n];
    pegbutton[n].type = 1;
    draw_button(pegbutton[n], 4);
  }
}

function current_button() {
  const mx = input.mousex(), my = input.mousey();
  for (let n = 0; n < numbuttons; n++) {
    const x1 = button[n].x, y1 = button[n].y;
    const x2 = x1 + button[n].xsize - 1;
    const y2 = y1 + button[n].ysize - 1;
    if (mx >= x1 && mx <= x2 && my >= y1 && my <= y2) return n;
  }
  return -1;
}

// ---- Pattern tester --------------------------------------------------------
//
// Original compared pointers: pegpic[correct[n]] == peg[n]->pic.  In JS we
// compare the pic references directly — same semantics, no pointers needed.
function test_row(peg0, marker0, correctval) {
  const peg    = new Array(MAXCOLS);
  const marker = new Array(MAXCOLS);
  let numpegs = numcols, nummarkers = 0;
  const correct = new Int32Array(MAXCOLS);
  let returnval = true;

  for (let n = 0; n < numpegs; n++) {
    peg[n]        = peg0[n];
    marker[n]     = marker0[n];
    marker[n].pic = holepic[1];
    correct[n]    = correctval[n];
  }

  // Same colour, same spot.
  for (let n = 0; n < numpegs; n++) {
    if (peg[n].pic === pegpic[correct[n]]) {
      marker[nummarkers].pic = pinpic[0];
      nummarkers++;
      numpegs--;
      for (let m = n; m < numpegs; m++) {
        peg[m]     = peg[m + 1];
        correct[m] = correct[m + 1];
      }
      n--;
    }
  }

  // Same colour, different spot.
  for (let n = 0; n < numpegs; n++) {
    for (let m = 0; m < numpegs; m++) {
      if (peg[n].pic === pegpic[correct[m]]) {
        returnval = false;
        marker[nummarkers].pic = pinpic[1];
        nummarkers++;

        numpegs--;
        for (let l = m; l < numpegs; l++) correct[l] = correct[l + 1];
        for (let l = n; l < numpegs; l++) peg[l]     = peg[l + 1];
        n--;
        break;
      }
    }
  }

  for (let n = 0; n < numcols; n++)
    vga.put(marker[n].x, marker[n].y, marker[n].pic, 4);
  if (numpegs) returnval = false;
  return returnval;
}

// ---- Play game -------------------------------------------------------------

async function play_game() {
  numholes = numcols * numrows;

  // Piles ("In:" and "Out:") ------------------------------------------------
  const pile = [
    { x1: 15,  x2: 75,  y1: 60, y2: 120, numpegs: 0, maxpegs: 50,
      pegx: new Int32Array(50), pegy: new Int32Array(50),
      pegpic: new Array(50), title: 'In:' },
    { x1: 245, x2: 305, y1: 60, y2: 120, numpegs: 0, maxpegs: 50,
      pegx: new Int32Array(50), pegy: new Int32Array(50),
      pegpic: new Array(50), title: 'Out:' },
  ];
  const numpiles = 2;

  // Board holes -------------------------------------------------------------
  const peg    = new Array(MAXHOLES);
  const marker = new Array(MAXHOLES);
  for (let i = 0; i < MAXHOLES; i++) {
    peg[i]    = { x: 0, y: 0, status: 0, pic: null };
    marker[i] = { x: 0, y: 0, status: 0, pic: null };
  }

  // Peg-button slots --------------------------------------------------------
  const pegbutton = new Array(MAXCOLOURS);
  for (let i = 0; i < MAXCOLOURS; i++)
    pegbutton[i] = { x: 0, y: 0, xsize: 0, ysize: 0, type: 0, contents: null };

  // Hidden solution ---------------------------------------------------------
  const correct = new Int32Array(MAXCOLS);
  for (let n = 0; n < numcols; n++)
    correct[n] = Math.floor(Math.random() * numcolours);

  // Text buttons ------------------------------------------------------------
  numbuttons = 3;
  button.length = 0;
  button.push(build_button(0, 'Test Pattern'));
  button.push(build_button(0, 'Give Up'));
  button.push(build_button(0, 'Quit'));

  let done = false, quitting = false;
  let current_row = 0;
  let pegpulled = false;

  // Screen setup ------------------------------------------------------------
  vga.box(0, 0, 319, 199, 247, 0);       // cls(247)
  vga.setColour(247, 14, 14, 14);
  vga.setColour(248, 11, 11, 11);
  vga.setColour(249, 18, 18, 18);

  place_holes(peg, marker);
  place_pegbuttons(pegbutton);
  place_buttons();

  // Pile frames -------------------------------------------------------------
  for (let n = 0; n < numpiles; n++) {
    vga.box(pile[n].x1 - 1, pile[n].y1 - 1, pile[n].x2,     pile[n].y2,     248, 4);
    vga.box(pile[n].x1,     pile[n].y1,     pile[n].x2 + 1, pile[n].y2 + 1, 249, 4);
    vga.box(pile[n].x1,     pile[n].y1,     pile[n].x2,     pile[n].y2,     247, 0);
    const cx = ((pile[n].x1 + pile[n].x2) >> 1)
             - ((vga.xfontsize * pile[n].title.length) >> 1);
    vga.drawtext(cx + 1, pile[n].y1 - 3 - vga.yfontsize, pile[n].title, 248, 4);
    vga.drawtext(cx,     pile[n].y1 - 4 - vga.yfontsize, pile[n].title, 249, 4);
  }

  // ---- The pointer --------------------------------------------------------
  // We keep a manual save-under buffer because the "pointer pic" swaps between
  // the arrow and whatever peg is being dragged.
  let pointerpic = ppic;
  const underpointer = new Uint8Array(200);

  let mx = input.mousex();
  let my = input.mousey();
  vga.get(mx, my, mx + pointerpic[0] - 1, my + pointerpic[1] - 1, underpointer);
  vga.put(mx, my, pointerpic, 4);

  // ---- Main loop ----------------------------------------------------------

  while (!quitting) {
    while (!(done || quitting)) {
      // Wait for a button press, redrawing the pointer as the mouse moves.
      while (!input.buttonpressed()) {
        if (mx !== input.mousex() || my !== input.mousey()) {
          vga.put(mx, my, underpointer, 0);
          mx = input.mousex();
          my = input.mousey();
          vga.get(mx, my, mx + pointerpic[0] - 1, my + pointerpic[1] - 1, underpointer);
          vga.put(mx, my, pointerpic, 4);
        }
        await timing.nextFrame();
      }

      // Button is down — erase the pointer before doing anything else.
      vga.put(mx, my, underpointer, 0);
      mx = input.mousex();
      my = input.mousey();

      // ---- Is the cursor on a peg button? --------------------------------
      let n;
      for (n = 0; !pegpulled && n < numcolours; n++) {
        if (mx >= pegbutton[n].x && mx < pegbutton[n].x + pegbutton[n].contents[0] &&
            my >= pegbutton[n].y && my < pegbutton[n].y + pegbutton[n].contents[1])
          break;
      }

      if (n < numcolours || pegpulled) {
        // ---- Drag a peg (from a button, or continuing an existing pull) ---
        if (!pegpulled) pointerpic = pegbutton[n].contents;

        while (input.buttonpressed()) {
          mx = input.mousex();
          my = input.mousey();
          vga.get(mx, my, mx + pointerpic[0] - 1, my + pointerpic[1] - 1, underpointer);
          vga.put(mx, my, pointerpic, 4);
          while (input.buttonpressed() && mx === input.mousex() && my === input.mousey())
            await timing.nextFrame();
          vga.put(mx, my, underpointer, 0);
        }

        // Try to drop into the current row.
        // NOTE: the original has an off-by-one here — after the final row is
        // tested, current_row == numrows and the index arithmetic produces
        // negative indices.  We wrap it so the drop just fails silently
        // rather than crashing, matching the intent without fixing the
        // original's out-of-bounds behaviour.
        let m;
        try {
          for (m = 0; m < numcols; m++) {
            n = (numcols * (numrows - current_row) - 1) - m;
            if (vga.touching(peg[n].x, peg[n].y, peg[n].pic, mx, my, pointerpic, 1)) {
              peg[n].pic    = pointerpic;
              peg[n].status = 1;
              vga.put(peg[n].x, peg[n].y, peg[n].pic, 4);
              break;
            }
          }
        } catch { m = numcols; }   // treat as "didn't land in a hole"

        // Otherwise, try to drop into a pile.
        if (m >= numcols) {
          for (n = 0; n < numpiles; n++) {
            if (mx > pile[n].x1 && mx < pile[n].x2 - pointerpic[0] &&
                my > pile[n].y1 && my < pile[n].y2 - pointerpic[1] &&
                pile[n].numpegs < pile[n].maxpegs)
            {
              pile[n].pegx[pile[n].numpegs]   = mx;
              pile[n].pegy[pile[n].numpegs]   = my;
              pile[n].pegpic[pile[n].numpegs] = pointerpic;
              pile[n].numpegs++;
              vga.put(mx, my, pointerpic, 4);
            }
          }
        }

        pointerpic = ppic;
        pegpulled = false;
      } else {
        // ---- Not a peg button: check for pulling an existing peg ----------
        for (n = 0; n < numholes; n++) {
          if (mx >= peg[n].x && mx < peg[n].x + peg[n].pic[0] &&
              my >= peg[n].y && my < peg[n].y + peg[n].pic[1])
            break;
        }

        if (n < numholes && peg[n].status === 1) {
          pointerpic = peg[n].pic;
          pegpulled = true;
          const m = numcols * (numrows - current_row - 1);
          if (n >= m && n < m + numcols) {
            peg[n].status = 0;
            peg[n].pic    = holepic[0];
            vga.put(peg[n].x, peg[n].y, peg[n].pic, 4);
          }
        } else {
          // ---- Other buttons ---------------------------------------------
          let bp;
          do {
            bp = current_button();
            await timing.nextFrame();
          } while (input.buttonpressed() && bp !== -1);

          switch (bp) {
            case -1: {
              // Picking up from a pile.
              let m;
              for (n = 0; n < numpiles; n++) {
                for (m = pile[n].numpegs - 1; m >= 0; m--) {
                  if (pile[n].pegx[m] <= mx && mx < pile[n].pegx[m] + pile[n].pegpic[m][0] &&
                      pile[n].pegy[m] <= my && my < pile[n].pegy[m] + pile[n].pegpic[m][1])
                    break;
                }
                if (m >= 0) break;
              }
              if (m >= 0) {
                pointerpic = pile[n].pegpic[m];
                vga.box(pile[n].pegx[m], pile[n].pegy[m],
                        pile[n].pegx[m] + pile[n].pegpic[m][0] - 1,
                        pile[n].pegy[m] + pile[n].pegpic[m][1] - 1, 247, 0);
                pegpulled = true;
                pile[n].numpegs--;
                for (; m < pile[n].numpegs; m++) {
                  pile[n].pegx[m]   = pile[n].pegx[m + 1];
                  pile[n].pegy[m]   = pile[n].pegy[m + 1];
                  pile[n].pegpic[m] = pile[n].pegpic[m + 1];
                }
                for (m = 0; m < pile[n].numpegs; m++)
                  vga.put(pile[n].pegx[m], pile[n].pegy[m], pile[n].pegpic[m], 4);
              }
              break;
            }
            case 0: {
              // Test Pattern
              let m = numcols;
              try {
                for (m = 0; m < numcols; m++) {
                  n = (numcols * (numrows - current_row) - 1) - m;
                  if (!peg[n].status) break;
                }
              } catch { m = 0; }   // treat as "row not complete"
              if (m === numcols) {
                n = numcols * (numrows - current_row - 1);
                done = test_row(peg.slice(n), marker.slice(n), correct);
                current_row++;
                done = done || current_row > numrows;
              }
              break;
            }
            case 1:
              done = true;
              break;
            case 2:
              done = quitting = true;
              break;
          }
        }
      }

      // Re-acquire the under-pointer and draw it back.
      vga.get(mx, my, mx + pointerpic[0] - 1, my + pointerpic[1] - 1, underpointer);
      vga.put(mx, my, pointerpic, 4);
    }

    // ---- Round over: reveal, ask to play again --------------------------
    if (!quitting) {
      let n;
      for (n = 0; n < numcols; n++)
        vga.put(peg[n].x, peg[n].y - 20, pegpic[correct[n]], 4);

      vga.put(mx, my, underpointer, 0);
      const ans = await ui.choose('Play again?', [
        { text: 'Yes', hotkey: 13 },
        { text: 'No',  hotkey: 27 },
      ]);
      done = quitting = (ans !== 0);

      for (n = 0; n < numcols; n++)
        vga.box(peg[n].x, peg[n].y - 20,
                peg[n].x + pegpic[correct[n]][0],
                peg[n].y - 20 + pegpic[correct[n]][1], 247, 0);

      current_row = 0;
      place_holes(peg, marker);
      place_pegbuttons(pegbutton);

      for (n = 0; n < numpiles; n++) {
        pile[n].numpegs = 0;
        vga.box(pile[n].x1 - 1, pile[n].y1 - 1, pile[n].x2,     pile[n].y2,     248, 4);
        vga.box(pile[n].x1,     pile[n].y1,     pile[n].x2 + 1, pile[n].y2 + 1, 249, 4);
        vga.box(pile[n].x1,     pile[n].y1,     pile[n].x2,     pile[n].y2,     247, 0);
      }

      for (n = 0; n < numcols; n++)
        correct[n] = Math.floor(Math.random() * numcolours);
    }
  }

  // Drain any lingering mouse press before returning.
  while (input.buttonpressed()) await timing.nextFrame();
}

// ---- Settings --------------------------------------------------------------

async function adjust_settings() {
  await assets.setFontFrom('assets/11x12.blf');

  const [upPic, downPic] = await Promise.all([
    assets.loadPic('assets/up.pic'),
    assets.loadPic('assets/down.pic'),
  ]);
  const optpic = [upPic, downPic];

  // ---- Option table (unchanged) ----
  const option = [];
  for (let n = 0; n < 6; n++) {
    option.push({
      x1: 0, y1: 0, x2: 0, y2: 0,
      min: 0, max: 0,
      pic: optpic[n % 2],
      get: null, set: null,
      increment: 1 - 2 * (n % 2),
    });
  }

  option[0].x1 = option[1].x1 = 80;
  option[0].y1 = 50;
  option[1].y1 = option[0].y1 + option[0].pic[1] + 4;
  option[0].get = () => numcolours; option[0].set = v => numcolours = v;
  option[1].get = () => numcolours; option[1].set = v => numcolours = v;
  option[0].min = option[1].min = MINCOLOURS;
  option[0].max = option[1].max = MAXCOLOURS;

  option[2].x1 = option[3].x1 = 180;
  option[2].y1 = 100;
  option[3].y1 = option[2].y1 + option[2].pic[1] + 4;
  option[2].get = () => numcols;    option[2].set = v => numcols = v;
  option[3].get = () => numcols;    option[3].set = v => numcols = v;
  option[2].min = option[3].min = MINCOLS;
  option[2].max = option[3].max = MAXCOLS;

  option[4].x1 = option[5].x1 = 60;
  option[4].y1 = 120;
  option[5].y1 = option[4].y1 + option[4].pic[1] + 4;
  option[4].get = () => numrows;    option[4].set = v => numrows = v;
  option[5].get = () => numrows;    option[5].set = v => numrows = v;
  option[4].min = option[5].min = MINROWS;
  option[4].max = option[5].max = MAXROWS;

  for (const o of option) {
    o.x2 = o.x1 + o.pic[0] - 1;
    o.y2 = o.y1 + o.pic[1] - 1;
  }

  // ---- Text boxes (unchanged geometry) ----
  const numtextboxes = 3;
  const tbox = [];
  for (let n = 0; n < numtextboxes; n++) {
    const src = option[n << 1];
    const tx = src.x1 - 3 * vga.xfontsize;
    const ty = ((src.y1 + option[(n << 1) + 1].y2) >> 1) - (vga.yfontsize >> 1);
    tbox.push({
      tx, ty,
      x1: tx - 3,
      y1: ty - 3,
      x2: tx - 3 + 4 + 2 * vga.xfontsize,
      y2: ty - 3 + 4 + vga.yfontsize,
      contents: '',
    });
  }

  const quit = build_button(0, 'Done');
  quit.x = 200; quit.y = 170;

  // ---- Background ----
  const backg = await assets.loadPic('assets/backg2.pic');
  for (let y = 0; y < 200; y++)
    vga.roterase(0, y, 319, y, 160, 100, y / 100, 1 + y / 100, backg);

  // ---- Title ----
  const title = 'Settings:';
  const tx = 160 - ((title.length * vga.xfontsize) >> 1);
  const ty = 10;
  vga.drawtext(tx + 1, ty + 1, title, 0, 4);
  vga.drawtext(tx,     ty,     title, 14, 4);

  // ---- Options and labels ----
  draw_button(quit, 4);
  for (const o of option) vga.put(o.x1, o.y1, o.pic, 0);

  const labels = ['Colours', 'Columns', 'Rows'];
  for (let n = 0; n < 3; n++) {
    const src = option[n << 1];
    const ly = ((src.y1 + option[(n << 1) + 1].y2) >> 1) - (vga.yfontsize >> 1);
    vga.drawtext(src.x2 + 4, ly + 1, labels[n], 0, 4);
    vga.drawtext(src.x2 + 3, ly,     labels[n], 14, 4);
  }

  // ---- Draw the embossed frames ONCE ----
  // (In the C, this only happens on entry, not on every update.)
  for (let n = 0; n < numtextboxes; n++) {
    vga.box(tbox[n].x1,     tbox[n].y1,     tbox[n].x2 + 1, tbox[n].y2 + 1, 255, 6);
    vga.box(tbox[n].x1 - 1, tbox[n].y1 - 1, tbox[n].x2,     tbox[n].y2,       1, 6);
    vga.box(tbox[n].x1,     tbox[n].y1,     tbox[n].x2,     tbox[n].y2,       0, 0);
  }

  // ---- Helper: redraw ONLY the text inside the boxes ----
  const drawTboxText = () => {
    for (let n = 0; n < numtextboxes; n++) {
      let s = String(option[n << 1].get());
      if (s.length === 1) s = s + ' ';   // match C's pad-to-two behaviour
      tbox[n].contents = s;
      vga.drawtext(tbox[n].tx, tbox[n].ty, tbox[n].contents, 12, 0);
    }
  };
  drawTboxText();

  // ---- Software cursor ----
  const ptr = await ui.ScreenPointer.create();
  ptr.draw(input.mousex(), input.mousey());

  const onQuit = (mx, my) =>
    quit.x     <= mx && quit.x + quit.xsize - 1 >= mx &&
    quit.y     <= my && quit.y + quit.ysize - 1 >= my;

  let fini = false;
  let buttonpressedonce = false;

  while (!fini) {
    ptr.sync();

    const mx = input.mousex();
    const my = input.mousey();

    if (input.buttonpressed()) {
      if (onQuit(mx, my)) {
        while (onQuit(input.mousex(), input.mousey()) && input.buttonpressed())
          await timing.nextFrame();
        fini = !input.buttonpressed();
      }

      if (!buttonpressedonce) {
        let n;
        for (n = 0; n < option.length; n++) {
          const o = option[n];
          if (o.x1 <= mx && o.x2 >= mx && o.y1 <= my && o.y2 >= my) {
            const v = o.get() + o.increment;
            if (v >= o.min && v <= o.max) {
              o.set(v);
              break;
            }
          }
        }
        if (n < option.length) {
          if (numcolours < numcols + 2) numcolours = numcols + 2;
          ptr.undraw();
          drawTboxText();
          ptr.draw(input.mousex(), input.mousey());
        }
        buttonpressedonce = true;
      }
    } else {
      buttonpressedonce = false;
    }

    await timing.nextFrame();
  }

  ptr.undraw();
  while (input.buttonpressed()) await timing.nextFrame();
  await assets.setFontFrom('assets/thin.blf');
}

// ---- Credits ---------------------------------------------------------------

async function show_credits() {
  await assets.setFontFrom('assets/6x6.blf');

  const credit = [
    'Programming:  Jacob Ewing',
    'Design:  Me',
    'Artwork:  Myself',
    'Writing:  I',
    'Testing:  Deborah Closs / Jacob Ewing',
    'Debugging:  Jacob Ewing',
    'Special Thanks to:  Jacob Ewing',
    'God Complex:  Jacob The Omnipotent',
    'Please send money to:  Jacob Ewing',
    '',
    '',
  ];
  const numcredits = credit.length;
  const spacing = 40;

  const cx = new Array(numcredits);
  const cy = new Array(numcredits);
  for (let n = 0; n < numcredits; n++) {
    cx[n] = 160 - ((credit[n].length * vga.xfontsize) >> 1);
    cy[n] = 200 + n * spacing;
  }

  const backg = await assets.loadPic('assets/backg3.pic');
  for (let n = 0; n < 200; n++)
    vga.roterase(0, n, 319, n, 160, 100, n / 50, 1 + n / 100, backg);

  while (!input.kbhit() && !input.buttonpressed()) {
    for (let n = 0; n < numcredits; n++) {
      if (cy[n] < 200)
        vga.drawtext(cx[n], cy[n], credit[n], 156, 6);
      cy[n] -= 1;
      if (cy[n] < -vga.yfontsize) {
        if (n === 0) cy[n] = cy[numcredits - 1] + spacing;
        else         cy[n] = cy[n - 1] + spacing;
      }
      if (cy[n] < 200)
        vga.drawtext(cx[n], cy[n], credit[n], -156, 6);
    }
    await timing.nextTick();
  }

  while (input.buttonpressed()) await timing.nextFrame();
  while (input.kbhit()) input.getch();
  await assets.setFontFrom('assets/thin.blf');
}

// ---- How to Play -----------------------------------------------------------

async function explain_game() {
  await assets.setFontFrom('assets/thin.blf');   // matches C order? no—see note below

  const pointer = ppic;
  const backg = await assets.loadPic('assets/backg4.pic');

  const btns = [
    { x: 0, y: 0, pic: await assets.loadPic('assets/left.pic')  },
    { x: 0, y: 0, pic: await assets.loadPic('assets/right.pic') },
    { x: 0, y: 0, pic: await assets.loadPic('assets/done.pic')  },
  ];
  const numbuttons = 3;

  btns[2].x = 160 - ((btns[2].pic[0] / 2) | 0);
  btns[2].y = 199 - btns[2].pic[1];
  btns[0].x = btns[2].x - btns[0].pic[0] - 2;
  btns[0].y = 199 - btns[0].pic[1];
  btns[1].x = btns[2].x + btns[2].pic[0] + 2;
  btns[1].y = 199 - btns[1].pic[1];

  vga.erase(0, 0, 320, 200, 0, 0, backg);

  vga.put(btns[2].x, btns[2].y, btns[2].pic, 0);

  vga.drawtext((160 - 3.5 * vga.xfontsize) | 0, 10, 'MasterMind', 15, 4);
  await assets.setFontFrom('assets/6x6.blf');

  const picy = 60;
  const numoptions = 1;
  let optionnum = 0;
  let fini = false;

  const underpointer = new Uint8Array(200);

  let mx = input.mousex(), my = input.mousey();
  vga.get(mx, my, mx + pointer[0] - 1, my + pointer[1] - 1, underpointer);

  while (!fini) {
    let numlines = 0;
    let have_picture = true;
    const text = new Array(16).fill('');

    switch (optionnum) {
      case 0:
        text[0] = "This is a really nice logic game, Unfortunately,";
        text[1] = "I don't have time to explain it right at the";
        text[2] = "moment, because I must go do my homework.";
        text[3] = "Ta Ta Fer Now!";
        numlines = 4;
        have_picture = false;
        break;
    }

    let bx1, bx2, by1, by2, ty1, ty2;
    if (have_picture) {
      // No actual picture data is present in the original; leave the block
      // here for fidelity in case you add one later.
      bx1 = bx2 = by1 = by2 = 0;
      ty1 = picy - 0.25 * (numlines * vga.yfontsize);
    } else {
      bx1 = bx2 = by1 = by2 = 0;
      ty1 = picy - 0.25 * (numlines * vga.yfontsize);
    }
    ty2 = ty1 + (numlines + 1) * 1.5 * vga.yfontsize;

    let tx1 = 160, tx2 = 160;
    let y = ty1 + vga.yfontsize / 2;
    for (let n = 0; n < numlines; n++) {
      // Backtick -> double-quote, as in the original.
//      text[n] = text[n].replace(/`/g, '"');
      const x = 160 - vga.xfontsize * ((text[n].length / 2) | 0);
      vga.drawtext(x, y, text[n], 15, 4);
      if (x < tx1) {
        tx1 = x;
        tx2 = tx1 + vga.xfontsize * (text[n].length + 1);
      }
      y += 1.5 * vga.yfontsize;
    }

    if (optionnum > 0) vga.put(btns[0].x, btns[0].y, btns[0].pic, 0);
    else vga.erase(btns[0].x, btns[0].y,
                   btns[0].x + btns[0].pic[0],
                   btns[0].y + btns[0].pic[1], 0, 0, backg);
    if (optionnum < numoptions - 1) vga.put(btns[1].x, btns[1].y, btns[1].pic, 0);
    else vga.erase(btns[1].x, btns[1].y,
                   btns[1].x + btns[1].pic[0],
                   btns[1].y + btns[1].pic[1], 0, 0, backg);

    mx = input.mousex(); my = input.mousey();
    vga.get(mx, my, mx + pointer[0] - 1, my + pointer[1] - 1, underpointer);

    let gotone = false, hit_a_button = 0;

    while (!gotone) {
      if (input.kbhit()) {
        switch (input.getch()) {
          case 0:
            switch (input.getch()) {
              case 'H'.charCodeAt(0):
              case 'M'.charCodeAt(0):
                if (optionnum < numoptions - 1) { optionnum++; gotone = true; }
                break;
              case 'K'.charCodeAt(0):
              case 'P'.charCodeAt(0):
                if (optionnum > 0) { optionnum--; gotone = true; }
                break;
            }
            break;
          default:
            gotone = fini = true;
        }
      }

      if (mx !== input.mousex() || my !== input.mousey()) {
        vga.put(mx, my, underpointer, 0);
        mx = input.mousex();
        my = input.mousey();
        vga.get(mx, my, mx + pointer[0] - 1, my + pointer[1] - 1, underpointer);
        vga.put(mx, my, pointer, 4);
      }

      while (input.buttonpressed()) {
        hit_a_button = 0;
        if (mx !== input.mousex() || my !== input.mousey()) {
          vga.put(mx, my, underpointer, 0);
          mx = input.mousex();
          my = input.mousey();
          vga.get(mx, my, mx + pointer[0] - 1, my + pointer[1] - 1, underpointer);
          vga.put(mx, my, pointer, 4);
        }
        for (let n = 0; n < numbuttons; n++) {
          if (mx >= btns[n].x && mx <= btns[n].x + btns[n].pic[0] - 1 &&
              my >= btns[n].y && my <= btns[n].y + btns[n].pic[1] - 1)
          {
            if ((n !== 0 || optionnum > 0) &&
                (n !== 1 || optionnum < numoptions - 1)) {
              hit_a_button = n + 1;
              break;
            }
          }
        }
        gotone = !!hit_a_button;
        await timing.nextFrame();
      }

      await timing.nextFrame();
    }

    vga.put(mx, my, underpointer, 0);

    vga.erase(tx1, ty1, tx2, ty2, 0, 0, backg);
    vga.erase(bx1, by1, bx2, by2, 0, 0, backg);

    switch (hit_a_button) {
      case 1: if (optionnum > 0) optionnum--; break;
      case 2: if (optionnum < numoptions - 1) optionnum++; break;
      case 3: fini = true; break;
    }
  }

  await assets.setFontFrom('assets/thin.blf');
}

// ---- Entry point -----------------------------------------------------------

async function main() {
  const canvas = document.getElementById('screen');
  vga.attachCanvas(canvas);
  input.initInput(canvas);
  input.setWantLock(true);
  timing.startLoop(() => vga.present());

  await load_pics();
  await assets.setFontFrom('assets/thin.blf');

  if (!vga.hasFont()) return;

  let done = false;
  while (!done) {
    const r = await ui.menuscreen(
      'MasterMind!',
      ['Play it', 'Credits', 'How to Play', 'Settings', 'Exit'],
      { background: 'assets/backg1.pic' }
    );
    switch (r) {
      case 0:
        numholes = numcols * numrows;
        await play_game();
        break;
      case 1:
        await show_credits();
        break;
      case 2:
        await explain_game();
        break;
      case 3:
        await adjust_settings();
        break;
      case 4:
        done = true;
        input.setWantLock(false);
        if (document.pointerLockElement) document.exitPointerLock();
        if (window.history.length > 1) window.history.back();
        else window.location.href = HOME_URL;
        return;
    }
  }
}

main();
