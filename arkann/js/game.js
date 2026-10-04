// game.js — direct port of play_game() and all its helper functions.

import * as vga from 'lib/vga.js';
import * as input from 'lib/input.js';
import * as timing from 'lib/timing.js';
import { menubox } from 'lib/ui.js';
import { loadPic, loadLevels } from 'lib/assets.js';
import { state } from './state.js';

// ---- Constants (from the C's #defines) --------------------------------------
const PI = Math.PI;
const MINX = 29, MAXX = 189, MINY = 19, MAXY = 179;
const MINSBX = 210, MINSBY = 29, MAXSBX = 313, MAXSBY = 100;
const XBRICKSIZE = 16, YBRICKSIZE = 6;
const BXOFFSET = -2, BYOFFSET = -2;
const MAXBALLS = 9, MAXNUMSHOTS = 14, NUMBALLPICS = 6;
const NUMBACKGPICS = 15;
const BOUNCECOUNTLIMIT = 200;
const MAXPADWIDTH = 6, PADWIDDEC = 3;

// ---- Assets ----------------------------------------------------------------
let brickpics = null;
let pills = null;
let ballpics = null;
let pads = null;
let shotpic = null;
let levelData = null;

async function ensureAssets() {
  if (brickpics) return;
  [brickpics, pills, ballpics, pads, shotpic, levelData] = await Promise.all([
    Promise.all([
      loadPic('assets/brick1.pic'), loadPic('assets/brick3.pic'),
      loadPic('assets/brick4.pic'), loadPic('assets/brick5.pic'),
      loadPic('assets/brick6.pic'), loadPic('assets/brick7.pic'),
      loadPic('assets/brick8.pic'), loadPic('assets/brick2.pic'),
      loadPic('assets/brick2.pic'), loadPic('assets/brick2.pic'),
    ]),
    Promise.all([
      loadPic('assets/pill7.pic'), loadPic('assets/pill3.pic'),
      loadPic('assets/pill5.pic'), loadPic('assets/pill6.pic'),
      loadPic('assets/pill1.pic'), loadPic('assets/pill8.pic'),
      loadPic('assets/pill2.pic'), loadPic('assets/pill4.pic'),
    ]),
    Promise.all([
      loadPic('assets/ball1.pic'), loadPic('assets/ball2.pic'),
      loadPic('assets/ball3.pic'), loadPic('assets/ball4.pic'),
      loadPic('assets/ball5.pic'), loadPic('assets/ball6.pic'),
    ]),
    Promise.all([loadPic('assets/pad1.pic'), loadPic('assets/pad2.pic')]),
    loadPic('assets/shot.pic'),
    loadLevels('assets/levels.dat'),
  ]);
}

// ---- Game state ------------------------------------------------------------
let backg = null;
let brick = [];      // { x, y, type }
let ball = [];       // { x, y, xi, yi, stuck, stuckx, stucky, type }
let shot = [];       // { x, y }

let lives = 3;
let numbricks = 0, breakables = 0, pill_probabillity = 100;
let pillx = 0, pilly = 0, gotguns = 0;
let padx = 0, pady = 0, xpadsize = 0, widepad = 0;
let numballs = 1, numshots = 0;
let pilltype = -1, pillpictype = 0;
let fireball = 0, ballspeed = 5, padpic = 0;
let stickyball = 0, attatched = 1;
let dead = 0, brickchanged = -1, cycle = 0;
let accel_delay = 0;
let padmoved = 0, bp = 0;
let doneonce = 0;
let scorechange = 0, bouncecount = 0;

// ---- Brick classification --------------------------------------------------
function breakable(btype) {
  switch (btype) {
    case 6: return 0;
    case 8: case 9: return -1;
  }
  return 1;
}

function randpilltype() {
  if ((((Math.random() * 40) | 0) === 0)) {
    return -((((Math.random() * 2) | 0) + 2));
  }
  return (Math.random() * 6) | 0;
}

// ---- Level loading ---------------------------------------------------------
function load_level(levelnum) {
  const level = levelData.levels[levelnum];
  numbricks = level.numBricks;
  pill_probabillity = level.pillProbability;
  breakables = 0;
  brick = new Array(numbricks);
  for (let m = 0; m < numbricks; m++) {
    const b = level.bricks[m];
    brick[m] = {
      x: MINX + ((XBRICKSIZE * b.bx) / 2) | 0,
      y: MINY + ((YBRICKSIZE * b.by) / 2) | 0,
      type: b.type,
    };
    if (brick[m].type !== 6) breakables++;
  }
}

// ---- Screen setup ----------------------------------------------------------
async function drawscreen(levelnum) {
  const url = `assets/backg${(levelnum % NUMBACKGPICS) + 1}.pic`;
  backg = await loadPic(url);
  vga.erase(MINX, MINY, MAXX, MAXY, 0, 0, backg);

  // Score board
  menubox(MINSBX, MINSBY, MAXSBX, MAXSBY);
  // Title
  menubox(((MINSBX + MAXSBX) / 2 | 0) - 4 * vga.xfontsize, MINSBY + 9,
              ((MINSBX + MAXSBX) / 2 | 0) + 4 * vga.xfontsize, MINSBY + vga.yfontsize + 12);
  vga.box(((MINSBX + MAXSBX) / 2 | 0) - 4 * vga.xfontsize, MINSBY + 9,
          ((MINSBX + MAXSBX) / 2 | 0) + 4 * vga.xfontsize, MINSBY + vga.yfontsize + 12,
          1, 2);
  vga.drawtext(((MINSBX + MAXSBX) / 2 | 0) - ((7 * vga.xfontsize / 2) | 0),
               MINSBY + 12, 'Arkann!', 15, 4);

  // Score display
  const x1 = ((MINSBX + MAXSBX) / 2 | 0) - 3 * vga.xfontsize;
  const y1 = (MINSBY + 2.5 * vga.yfontsize) | 0;
  const x2 = ((MINSBX + MAXSBX) / 2 | 0) + 3 * vga.xfontsize;
  const y2 = (MINSBY + 4.5 * vga.yfontsize) | 0;
  vga.box(x1 - 1, y1 - 1, x2, y2, 17, 4);
  vga.box(x1, y1, x2 + 1, y2 + 1, 23, 4);
  vga.box(x1, y1, x2, y2, 0, 0);
  vga.drawtext(x1, y1, 'Score:', 15, 4);
  vga.drawtext(x1, (MINSBY + 3.5 * vga.yfontsize) | 0, String(state.score), 15, 4);

  // Border around play area
  for (let x = 0; x < 15; x++) {
    vga.box(MINX - x - 1, MINY - x - 1, MAXX + x, MAXY + x, 30 - x, 4);
  }
  // Life pads
  for (let x = 0; x < lives - 1; x++) {
    vga.put(MINX + 3 + x * (pads[0][0] + 2), MAXY + 2 + pads[0][1], pads[0], 4);
  }
}

// ---- Animated background ---------------------------------------------------
let bg_offset = 0, bg_diff = 0, bg_diffi = 1;
function animate_background() {
  const spacing = 351;
  for (let n = bg_offset; n < 64000; n += spacing) {
    const x = n % 320;
    const y = (n / 320) | 0;
    if (((x < MINX - 16) || (x > MAXX + 16) || (y < MINY - 16) || (y > MAXY + 16)) &&
        ((x < MINSBX) || (x > MAXSBX) || (y < MINSBY) || (y > MAXSBY))) {
      vga.vmem[n] = 0;
    }
  }
  bg_diff += bg_diffi;
  if (bg_diff > 5 || bg_diff < -5) bg_diffi *= -1;
  bg_offset += 641 + bg_diff;
  while (bg_offset >= spacing) bg_offset -= spacing;
  for (let n = bg_offset; n < 64000; n += spacing) {
    const x = n % 320;
    const y = (n / 320) | 0;
    if (((x < MINX - 16) || (x > MAXX + 16) || (y < MINY - 16) || (y > MAXY + 16)) &&
        ((x < MINSBX) || (x > MAXSBX) || (y < MINSBY) || (y > MAXSBY))) {
      vga.vmem[n] = 14;
    }
  }
}

// ---- Score -----------------------------------------------------------------
function addpoints(scorechange) {
  const x1 = ((MINSBX + MAXSBX) / 2 | 0) - 3 * vga.xfontsize;
  const y1 = (MINSBY + 3.5 * vga.yfontsize) | 0;
  const oldLen = String(state.score).length;
  vga.box(x1, y1, x1 + oldLen * vga.xfontsize, (MINSBY + 4.5 * vga.yfontsize) | 0, 0, 0);

  state.score += scorechange;
  if ((state.score % 5000) < scorechange) {
    if (lives < 7) {
      vga.put(MINX + 3 + (lives - 1) * (pads[0][0] + 2), MAXY + 2 + pads[0][1], pads[0], 4);
      lives++;
    }
  }
  vga.drawtext(x1, y1, String(state.score), 15, 4);
}

// ---- Keyboard --------------------------------------------------------------
async function handle_keypress() {
  const k = input.getch();
  if (k === 27) { dead = 1; lives = 0; state.quitting = true; return; }
  if (k === 0) {
    const scan = input.getch();
    if (scan !== 37) return;
    dead = 1;
    return;
  }
  if (k === 11 || k === 107 || k === 75) { dead = 1; return; }
  if (k === 32 || k === 112 || k === 80) {
    while (!input.kbhit()) await timing.nextFrame();
    while (input.kbhit()) input.getch();
    return;
  }
  if (k === 9) { breakables = 0; return; }
}

// ---- Pad -------------------------------------------------------------------
function handle_pad() {
  const d = input.readmousediff();
  if (d.x) {
    padmoved = 1;
    vga.erase(padx, pady, padx + xpadsize - 1, pady + pads[padpic][1] - 1, 0, 0, backg);
    padx += d.x;
    if (padx > MAXX - xpadsize) padx = MAXX - xpadsize;
    if (padx < MINX) padx = MINX;
    let x = padx;
    for (let n = 0; n <= widepad; n++) {
      vga.put(x, pady, pads[padpic], 4);
      x += pads[padpic][0] - PADWIDDEC;
    }
  }
}

// ---- Pills -----------------------------------------------------------------
function handle_pill() {
  if (pilltype === -1) return;
  vga.erasepic(pillx, pilly, pills[pillpictype], backg, 1);
  for (let n = 0; n < numbricks; n++) {
    if (vga.touching(pillx, pilly, pills[pillpictype],
                     brick[n].x, brick[n].y, brickpics[brick[n].type], 1)) {
      vga.put(brick[n].x, brick[n].y, brickpics[brick[n].type], 4);
    }
  }
  pilly += 2;
  if (pilly >= MAXY - pills[pillpictype][1]) {
    if (pillx <= padx + xpadsize && pillx + pills[pillpictype][0] >= padx) {
      // Clear effects of other pills
      if (pilltype !== 3 && pilltype !== -2 && pilltype !== -3) {
        if (pilltype !== 5 && padpic === 1) {
          gotguns = 0;
          vga.erase(padx, pady, padx + xpadsize - 1, pady + pads[padpic][1] - 1, 0, 0, backg);
          padpic = 0;
          vga.put(padx, pady, pads[padpic], 4);
        }
        if (pilltype !== 1) fireball = 0;
        if (pilltype !== 4) stickyball = 0;
        for (let n = 0; n < numballs; n++) ball[n].stuck = 0;

        if (pilltype !== 2) {
          if (widepad) {
            widepad = 0;
            vga.erase(padx, pady, padx + xpadsize - 1, pady + pads[padpic][1] - 1, 0, 0, backg);
            vga.put(padx, pady, pads[padpic], 4);
          }
          xpadsize = pads[padpic][0];
        }
      }
      switch (pilltype) {
        case 0: addpoints(20); splitballs(); break;
        case 1: addpoints(10); fireball = 1; break;
        case 2:
          addpoints(20);
          if (widepad < MAXPADWIDTH) {
            widepad++;
            vga.erase(padx, pady, padx + xpadsize - 1, pady + pads[padpic][1] - 1, 0, 0, backg);
            xpadsize += pads[padpic][0] - PADWIDDEC;
            if (padx > MAXX - xpadsize) padx = MAXX - xpadsize;
            if (padx < MINX) padx = MINX;
            let x = padx;
            for (let n = 0; n <= widepad; n++) {
              vga.put(x, pady, pads[padpic], 4);
              x += pads[padpic][0] - PADWIDDEC;
            }
          }
          break;
        case 3:
          addpoints(5);
          if (ballspeed > 2) ballspeed--;
          break;
        case 4:
          addpoints(10);
          stickyball = 1;
          for (let n = 0; n < numballs; n++) ball[n].stuck = 0;
          break;
        case 5:
          addpoints(20);
          if (padpic === 0) {
            vga.erase(padx, pady, padx + xpadsize - 1, pady + pads[padpic][1] - 1, 0, 0, backg);
            padpic = 1;
            vga.put(padx, pady, pads[padpic], 4);
          }
          if (!gotguns) { numshots = 0; gotguns = 1; }
          break;
        case -3: addpoints(30); breakables = 0; break;
        case -2:
          addpoints(30);
          if (lives < 7) {
            vga.put(MINX + 3 + (lives - 1) * (pads[0][0] + 2), MAXY + 2 + pads[0][1], pads[0], 4);
            lives++;
          }
          break;
      }
    }
    pilltype = -1;
  } else {
    vga.put(pillx, pilly, pills[pillpictype], 4);
  }
}

// ---- Ball splitting --------------------------------------------------------
function splitballs() {
  if (numballs >= MAXBALLS - 2) return;
  numballs += 2;
  for (let n = numballs - 2; n < numballs; n++) {
    const src = (numballs === 3) ? ball[0] : ball[n - 2];
    ball[n] = { x: src.x, y: src.y, xi: 0, yi: 0, stuck: 0, stuckx: 0, stucky: 0, type: 0 };
    // Truncate to integers, matching the implicit int cast in the C.
    ball[n].xi = Math.trunc(src.xi * Math.cos(n) - src.yi * Math.sin(n));
    ball[n].yi = Math.trunc(src.xi * Math.sin(n) + src.yi * Math.cos(n));
    if (!ball[n].xi) { ball[n].xi++; ball[n].yi--; }
    if (!ball[n].yi) { ball[n].yi++; ball[n].xi--; }
    ball[n].type = (ball[n - 1].type + 1) % NUMBALLPICS;
  }
}

// ---- Shots -----------------------------------------------------------------
function handle_shots() {
  for (let n = 0; n < numshots; n++) {
    vga.erasepic(shot[n].x, shot[n].y, shotpic, backg, 1);
    let hitbrick = 0;
    shot[n].y -= 3;
    for (let l = 0; l < numbricks; l++) {
      if (vga.touching(shot[n].x, shot[n].y, shotpic,
                       brick[l].x, brick[l].y, brickpics[brick[l].type], 1)) {
        if (breakable(brick[l].type) === -1) brick[l].type--;
        else if (breakable(brick[l].type) === 1) {
          vga.erasepic(brick[l].x, brick[l].y, brickpics[brick[l].type], backg, 1);
          numbricks--;
          breakables--;
          for (let k = l; k < numbricks; k++) brick[k] = { ...brick[k + 1] };
          addpoints(1);
        }
        for (let m = n; m < numshots - 1; m++) shot[m] = { ...shot[m + 1] };
        numshots--;
        hitbrick = 1;
        break;
      }
    }
    if (shot[n].y < MINY) {
      for (let m = n; m < numshots - 1; m++) shot[m] = { ...shot[m + 1] };
      numshots--;
      n--;
    } else if (!hitbrick) {
      vga.put(shot[n].x, shot[n].y, shotpic, 4);
    }
  }
   if (!attatched && input.buttonpressed() && gotguns) {
    // The original read shot[-1].y when numshots was 0, which happened to be
    // small enough to let the first shot fire. Replicate that intent directly.
    const canFire = numshots === 0 || shot[numshots - 1].y < pady - 4 * shotpic[1];
    if (numshots < MAXNUMSHOTS - 1 && canFire) {
      shot[numshots] = { x: padx, y: pady - shotpic[1] };
      shot[numshots + 1] = { x: padx + xpadsize - shotpic[0], y: pady - shotpic[1] };
      vga.put(shot[numshots + 1].x, shot[numshots + 1].y, shotpic, 4);
      vga.put(shot[numshots].x, shot[numshots].y, shotpic, 4);
      numshots += 2;
    }
  }
}

// ---- Ball physics for a single ball ---------------------------------------
function ballPhysics(l) {
  if (ball[l].stuck) {
    bouncecount = 0;
    ball[l].x = padx + ball[l].stuckx;
    ball[l].y = ball[l].stucky;
    if (bp) ball[l].stuck = 0;
  } else if (attatched) {
    if (padmoved || !doneonce) {
      doneonce = 1;
      for (let n = 0; n < numballs; n++) {
        ball[n].x = padx + ((xpadsize / 2) | 0) + BXOFFSET + 1;
        ball[n].y = pady - ((ballpics[ball[n].type][1] / 2) | 0) - 2;
      }
    }
    if (bp) {
      attatched = 0;
      switch (l % 3) {
        case 0: ball[l].xi = 3; ball[l].yi = -4; break;
        case 1: ball[l].xi = -1; ball[l].yi = -4; break;
        case 2: ball[l].xi = -4; ball[l].yi = 3; break;
      }
    }
  } else {
    brickchanged = -1;
    // --- Brick collisions ---
    for (let n = 0; (n < numbricks) && (brickchanged === -1); n++) {
      if (vga.touching(brick[n].x, brick[n].y, brickpics[brick[n].type],
                       ball[l].x + BXOFFSET, ball[l].y + BYOFFSET,
                       ballpics[ball[l].type], 1)) {
        vga.put(brick[n].x, brick[n].y, brickpics[brick[n].type], 4);
      }

      const bw = brickpics[brick[n].type][0];
      const bh = brickpics[brick[n].type][1];
      const bx = brick[n].x, by = brick[n].y;
      const ballx = ball[l].x, bally = ball[l].y;

      if (ballx >= bx && ballx <= bx + bw - 1) {
        if (bally <= by + bh - 1 + 3 && bally >= by + bh - 1 && ball[l].yi < 0 &&
            !(bally >= by - 3 && ball[l].yi > 0 && bally <= by)) {
          if (breakable(brick[n].type) === 1) brickchanged = n;
          if (breakable(brick[n].type) === -1) brick[n].type--;
          else n = numbricks - 1;
          if (!fireball || brickchanged === -1) { ball[l].yi *= -1; break; }
        } else if (bally >= by - 3 && ball[l].yi > 0 && bally <= by) {
          if (breakable(brick[n].type) === 1) brickchanged = n;
          if (breakable(brick[n].type) === -1) brick[n].type--;
          else n = numbricks - 1;
          if (!fireball || brickchanged === -1) { ball[l].yi *= -1; break; }
        } else if (bally >= by && bally <= by + bh - 1) {
          if (breakable(brick[n].type) === 1) brickchanged = n;
          if (breakable(brick[n].type) === -1) brick[n].type--;
          else n = numbricks - 1;
          if (!fireball || brickchanged === -1) {
            if (Math.abs(ball[l].yi) >= Math.abs(ball[l].xi)) ball[l].yi *= -1;
            if (Math.abs(ball[l].xi) >= Math.abs(ball[l].yi)) ball[l].xi *= -1;
            break;
          }
        }
      } else if (bally >= by && bally <= by + bh - 1) {
        if (ballx >= bx - 3 && ball[l].xi > 0 && ballx <= bx) {
          if (breakable(brick[n].type) === 1) brickchanged = n;
          if (breakable(brick[n].type) === -1) brick[n].type--;
          else n = numbricks - 1;
          if (!fireball || brickchanged === -1) { ball[l].xi *= -1; break; }
        } else if (ballx <= bx + bw - 1 + 3 && ballx >= bx + bw - 1 && ball[l].xi < 0) {
          if (breakable(brick[n].type) === 1) brickchanged = n;
          if (breakable(brick[n].type) === -1) brick[n].type--;
          else n = numbricks - 1;
          if (!fireball || brickchanged === -1) { ball[l].xi *= -1; break; }
        }
      }
    }

    if (brickchanged !== -1) {
      bouncecount = 0;
      vga.erasepic(brick[brickchanged].x, brick[brickchanged].y,
                   brickpics[brick[brickchanged].type], backg, 1);
      if (pilltype === -1 && !(Math.random() * pill_probabillity | 0)) {
        pillpictype = pilltype = randpilltype();
        if (pillpictype < 0) pillpictype += 9;
        pillx = brick[brickchanged].x;
        pilly = brick[brickchanged].y;
      }
      numbricks--;
      breakables--;
      for (let n = brickchanged; n < numbricks; n++) brick[n] = { ...brick[n + 1] };
      scorechange++;
      addpoints(scorechange);
    }

    // --- Walls and pad ---
    if ((ball[l].x + ball[l].xi + BXOFFSET + ballpics[ball[l].type][0] >= MAXX) ||
        (ball[l].x + ball[l].xi + BXOFFSET <= MINX)) {
      ball[l].xi *= -1;
    }
    if (ball[l].y + ball[l].yi + BYOFFSET <= MINY) ball[l].yi *= -1;

    if (ball[l].y >= pady - ((ballpics[ball[l].type][1] / 2) | 0) - 2 &&
        ball[l].x >= padx && ball[l].x <= padx + xpadsize && ball[l].yi > 0) {
      scorechange = bouncecount = 0;
      let angle = (PI / xpadsize) * (ball[l].x - padx);
      angle = (PI / 2 - angle) * 0.75;
      angle += PI;
      if (angle - PI === 0) {
        ball[l].yi *= -1;
      } else {
        const newxi = Math.trunc(Math.sin(angle) * ballspeed);
        if (newxi) ball[l].xi = newxi;
        ball[l].yi = Math.trunc(Math.cos(angle) * ballspeed);
      }
      if (stickyball) {
        ball[l].stuck = 1;
        ball[l].stuckx = ball[l].x - padx;
        ball[l].stucky = ball[l].y;
      }
    } else if (ball[l].y + ball[l].yi + BYOFFSET + ballpics[ball[l].type][1] >= MAXY) {
      if (numballs > 1) {
        for (let k = l; k < numballs - 1; k++) {
          const t = ball[k]; ball[k] = ball[k + 1]; ball[k + 1] = t;
        }
        numballs--;
      } else {
        dead = 1;
      }
    }
    if (!ball[l].stuck) {
      ball[l].x += ball[l].xi;
      ball[l].y += ball[l].yi;
    }
  }
}

// ---- Main gameplay --------------------------------------------------------
export async function play_game(continuing) {
  await ensureAssets();
  input.setWantLock(true);

  if (!continuing) state.current_level = 0;
  state.score = 0;
  lives = 3;
  padpic = 0;
  xpadsize = pads[0][0];
  pady = MAXY - pads[0][1];
  attatched = 1;
  numballs = 1;
  pilltype = -1;
  numshots = 0;
  cycle = 0;

  // Wait for mouse to be still and button released.
  do {
    const d = input.readmousediff();
    var moving = (d.x || d.y);
    await timing.nextFrame();
  } while (input.buttonpressed() || moving);

  while (lives > 0 && state.current_level < state.numlevels) {
    await drawscreen(state.current_level);
    load_level(state.current_level);
    for (let n = 0; n < numbricks; n++) {
      vga.put(brick[n].x, brick[n].y, brickpics[brick[n].type], 4);
    }

    pilltype = -1;
    numshots = 0;

    while (lives > 0 && breakables > 0) {
      // Per-life reset block
      padx = MINX + ((MAXX - MINX) / 2 | 0) - ((pads[padpic][0] / 2) | 0);
      vga.put(padx, pady, pads[padpic], 4);

      for (let n = 0; n < 15; n++) {
        vga.box(MINX - n - 1, MAXY + n, MAXX + n, MAXY + n, 30 - n, 4);
      }
      for (let n = 0; n < lives - 1; n++) {
        vga.put(MINX + 3 + n * (pads[0][0] + 2), MAXY + 2 + pads[0][1], pads[0], 4);
      }

      accel_delay = 0;
      ballspeed = 5;
      stickyball = 0;
      fireball = 0;
      widepad = 0;
      xpadsize = pads[padpic][0];
      numballs = 1;
      padpic = 0;
      gotguns = 0;
      doneonce = 0;

      // Initialize ball[0]
      ball = [{ x: -50, y: 0, xi: 0, yi: 0, stuck: 0, stuckx: 0, stucky: 0, type: 0 }];

      // ---- Inner tick loop ----
      while (!(dead || breakables <= 0)) {
        // Fast-path pad polling until the next tick
        padmoved = 0;
        const tickAtStart = timing.counter();
        while (timing.counter() === tickAtStart) {
          handle_pad();
          await timing.nextFrame();
        }

        // Read input state for this tick
        if (input.kbhit()) await handle_keypress();
        bp = input.buttonpressed() ? 1 : 0;

        // Accel
        accel_delay = (accel_delay + 1) % 300;
        if (accel_delay === 0 && ballspeed < 6) ballspeed++;

        bouncecount += attatched ? 0 : 1;
        if (bouncecount > BOUNCECOUNTLIMIT) {
          bouncecount = 0;
          splitballs();
        }

        // Background animation
        cycle = (cycle + 1) % 2;
        if (!cycle) animate_background();

        handle_pill();

        for (let n = 0; n < numballs; n++) {
          vga.erasepic(ball[n].x + BXOFFSET, ball[n].y + BYOFFSET, ballpics[0], backg, 1);
        }
        // Ball erase uses the tiled background, which corrupts the border if
        // the ball's bounding box reaches it. Redraw the border (and life pads
        // that sit inside it) to repair any damage. Cheap: 15 outlined boxes.
        for (let n = 0; n < 15; n++) {
          vga.box(MINX - n - 1, MINY - n - 1, MAXX + n, MAXY + n, 30 - n, 4);
        }
        for (let n = 0; n < lives - 1; n++) {
          vga.put(MINX + 3 + n * (pads[0][0] + 2), MAXY + 2 + pads[0][1], pads[0], 4);
        }

        for (let l = 0; l < numballs; l++) {
          ballPhysics(l);
        }

        if (gotguns || numshots) {
          handle_shots();
          handle_shots();
        }

        for (let n = 0; n < numballs; n++) {
          vga.put(ball[n].x + BXOFFSET, ball[n].y + BYOFFSET, ballpics[ball[n].type], 4);
        }
      } // end inner tick loop

      // Cleanup between lives / levels
      if (dead) { lives--; dead = 0; }
      attatched = 1;
      if (pilltype !== -1) {
        vga.erasepic(pillx, pilly, pills[pillpictype], backg, 1);
        pilltype = -1;
      }
      for (let n = 0; n < numballs; n++) {
        vga.erasepic(ball[n].x + BXOFFSET, ball[n].y + BYOFFSET, ballpics[ball[n].type], backg, 1);
        ball[n].x = -ballpics[ball[n].type][0] - 5;
      }
      vga.erase(padx, pady, padx + xpadsize - 1, pady + pads[padpic][1] - 1, 0, 0, backg);
      if (!breakables) {
        for (let n = 0; n < numshots; n++) {
          vga.erasepic(shot[n].x, shot[n].y, shotpic, backg, 1);
        }
      }
    } // end per-life loop

    if (lives > 0) state.current_level++;
  } // end level loop
  input.setWantLock(false);
}
