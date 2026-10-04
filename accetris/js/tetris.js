// tetris.js — Accetris game logic (ported from accetris.c).
//
// The playfield is a 2-D array indexed [x][y] to match the C original:
//   x in 0..9  (columns, left to right)
//   y in 0..19 (rows,    top to bottom)
//
// Each cell holds 0 (empty) or a shape type 1..8 (the chunk picture index).

import * as vga from '../../lib/vga.js';
import * as input from '../../lib/input.js';
import * as timing from '../../lib/timing.js';
import { loadPic } from '../../lib/assets.js';

// ---------------------------------------------------------------------------
// Constants (mirrors the #defines in accetris.c)
// ---------------------------------------------------------------------------
const XMAPSIZE = 10;
const YMAPSIZE = 20;
const XCHUNKSIZE = 7;
const YCHUNKSIZE = 6;

const DISPLAYX = 16;
const DISPLAYY = 5;

const ACCELERATION = 1.25;
const TEXTCOLOUR = 80;

const LCLRX = 160, LCLRY = 10;
const LVLX  = 160, LVLY  = 28;
const SCOREX = 160, SCOREY = 185;

// Seconds per drop at level 0.  Tune to taste.  The original measured this
// empirically against the 18.2 Hz tick in DOS; that measurement is not
// reproducible in JS, so we use a fixed value here.  delay_size is divided
// by ACCELERATION once per level (and by activeshape.y in accelerate mode).
const STARTING_DELAY = 0.5;

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------
let zerox = 0, zeroy = 0;

/** @type {Uint8Array[]} */
let map = null;

/** chunkpic[0..8] — index 0 is the blank "erase" picture. */
const chunkpic = new Array(9);
let pausepic = null;

let lines_cleared = 0;
let level = 0;
let score = 0;
let delay_size = STARTING_DELAY;

let activeshape = null;

// These persist across the whole game (declared at the top of play_tetris()
// in the original C).
let done = false;
let buttondown = 0;
let mouseAccumX = 0;
let mouseAccumY = 0;

export function getScore() { return score; }

// ---------------------------------------------------------------------------
// Asset loading
// ---------------------------------------------------------------------------
export async function loadGamePictures() {
  chunkpic[0] = await loadPic('assets/blank.pic');
  for (let i = 1; i <= 8; i++) chunkpic[i] = await loadPic(`assets/chunk${i}.pic`);
  pausepic = await loadPic('assets/p.pic');

  zerox = 159 - ((XMAPSIZE * XCHUNKSIZE) >> 1);
  zeroy = 109 - ((YMAPSIZE * YCHUNKSIZE) >> 1);
}

// ---------------------------------------------------------------------------
// Shape generation and manipulation
// ---------------------------------------------------------------------------

function generateShape(type) {
  const s = {
    x: 0, y: 0,
    chunkx: new Array(9).fill(0),
    chunky: new Array(9).fill(0),
    numchunks: 4,
    type,
  };
  switch (type) {
    case 1: // line
      s.chunkx[0]=-2; s.chunky[0]=0;
      s.chunkx[1]=-1; s.chunky[1]=0;
      s.chunkx[2]= 0; s.chunky[2]=0;
      s.chunkx[3]= 1; s.chunky[3]=0;
      break;
    case 2: // square
      s.chunkx[0]=0; s.chunky[0]=0;
      s.chunkx[1]=1; s.chunky[1]=0;
      s.chunkx[2]=0; s.chunky[2]=1;
      s.chunkx[3]=1; s.chunky[3]=1;
      break;
    case 3: // T
      s.chunkx[0]=-1; s.chunky[0]=0;
      s.chunkx[1]= 0; s.chunky[1]=0;
      s.chunkx[2]= 1; s.chunky[2]=0;
      s.chunkx[3]= 0; s.chunky[3]=1;
      break;
    case 4: // squiggle 1
      s.chunkx[0]= 0; s.chunky[0]=0;
      s.chunkx[1]= 1; s.chunky[1]=0;
      s.chunkx[2]=-1; s.chunky[2]=1;
      s.chunkx[3]= 0; s.chunky[3]=1;
      break;
    case 5: // squiggle 2
      s.chunkx[0]= 0; s.chunky[0]=1;
      s.chunkx[1]= 1; s.chunky[1]=1;
      s.chunkx[2]=-1; s.chunky[2]=0;
      s.chunkx[3]= 0; s.chunky[3]=0;
      break;
    case 6: // backwards L
      s.chunkx[0]=-1; s.chunky[0]=0;
      s.chunkx[1]= 0; s.chunky[1]=0;
      s.chunkx[2]= 1; s.chunky[2]=0;
      s.chunkx[3]= 1; s.chunky[3]=1;
      break;
    case 7: // L
      s.chunkx[0]=-1; s.chunky[0]=0;
      s.chunkx[1]= 0; s.chunky[1]=0;
      s.chunkx[2]= 1; s.chunky[2]=0;
      s.chunkx[3]=-1; s.chunky[3]=1;
      break;
    default: {
      // "Odd Piece" (type 8): 1..8 chunks placed at random non-overlapping
      // offsets in the range -1..1 in both axes.
      //
      // NOTE: in the original C, chunkx[0]/chunky[0] were never explicitly
      // initialised in this branch — they held whatever garbage was in the
      // struct.  We deliberately initialise them to (0,0) for determinism.
      s.numchunks = (Math.random() * 8 | 0) + 1;
      s.chunkx[0] = 0;
      s.chunky[0] = 0;
      for (let n = 1; n < s.numchunks; n++) {
        let okay;
        do {
          okay = true;
          s.chunkx[n] = (Math.random() * 3 | 0) - 1;
          s.chunky[n] = (Math.random() * 3 | 0) - 1;
          for (let m = 0; m < n; m++) {
            if (s.chunkx[n] === s.chunkx[m] && s.chunky[n] === s.chunky[m]) {
              okay = false;
              break;
            }
          }
        } while (!okay);
      }
      break;
    }
  }
  return s;
}

function drawChunk(x, y, chunktype) {
  vga.put(x * XCHUNKSIZE + zerox, y * YCHUNKSIZE + zeroy, chunkpic[chunktype], 0);
}

// mode truthiness: 0 erases (blank chunk), non-zero draws shape.type.
function drawShape(shape, mode) {
  const chunktype = shape.type * (mode ? 1 : 0);
  for (let n = 0; n < shape.numchunks; n++) {
    drawChunk(shape.chunkx[n] + shape.x, shape.chunky[n] + shape.y, chunktype);
  }
}

function move(direction) {
  let okay = true;
  for (let n = 0; n < activeshape.numchunks; n++) {
    const nx = activeshape.x + activeshape.chunkx[n] + direction;
    const ny = activeshape.y + activeshape.chunky[n];
    if (nx < 0 || nx >= XMAPSIZE || map[nx][ny] !== 0) { okay = false; break; }
  }
  if (okay) {
    drawShape(activeshape, 0);
    activeshape.x += direction;
    drawShape(activeshape, activeshape.type);
  }
}

function rotate(ang) {
  const newx = new Array(9);
  const newy = new Array(9);
  let okay = true;
  for (let n = 0; n < activeshape.numchunks; n++) {
    newx[n] = -activeshape.chunky[n] * ang;
    newy[n] =  activeshape.chunkx[n] * ang;
    const a = newx[n] + activeshape.x;
    const b = newy[n] + activeshape.y;
    if (a < 0 || a >= XMAPSIZE || b < 0 || b >= YMAPSIZE || map[a][b] !== 0) {
      okay = false;
      break;
    }
  }
  if (okay && activeshape.type !== 2) {
    drawShape(activeshape, 0);
    for (let n = 0; n < activeshape.numchunks; n++) {
      activeshape.chunkx[n] = newx[n];
      activeshape.chunky[n] = newy[n];
    }
    drawShape(activeshape, activeshape.type);
  }
}

function shapeFallen() {
  for (let n = 0; n < activeshape.numchunks; n++) {
    const x = activeshape.x + activeshape.chunkx[n];
    const y = activeshape.y + activeshape.chunky[n];
    if (y >= YMAPSIZE - 1) return true;
    if (map[x][y + 1] !== 0) return true;
  }
  return false;
}

function dead() {
  for (let n = 0; n < activeshape.numchunks; n++) {
    const x = activeshape.x + activeshape.chunkx[n];
    const y = activeshape.y + activeshape.chunky[n];
    if (map[x][y] !== 0) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Line clearing
// ---------------------------------------------------------------------------
function checkLine(y) {
  for (let x = 0; x < XMAPSIZE; x++) if (!map[x][y]) return 0;
  return 1;
}

function copyLine(a, b) {
  for (let n = 0; n < XMAPSIZE; n++) map[n][a] = map[n][b];
}

function checkForLines() {
  const eraseline = new Int32Array(9);
  let exponent = 0;
  let changedone = false;

  // Find unique full rows the active shape occupies.
  for (let n = 0; n < activeshape.numchunks; n++) {
    const y = activeshape.chunky[n] + activeshape.y;
    eraseline[n] = checkLine(y) * y;
    for (let m = 0; m <= n; m++) {
      if (m !== n && eraseline[m] === eraseline[n]) eraseline[n] = 0;
    }
  }

  // Clear them.  Note the C's ordering: we walk chunk order, and any later
  // full row that is *above* the one we just collapsed gets bumped down by 1.
  for (let n = 0; n < activeshape.numchunks; n++) {
    if (!eraseline[n]) continue;
    exponent++;
    lines_cleared++;
    changedone = true;
    for (let m = eraseline[n]; m > 0; m--) copyLine(m, m - 1);
    for (let m = n + 1; m < activeshape.numchunks; m++) {
      if (eraseline[m] && eraseline[m] < eraseline[n]) eraseline[m]++;
    }
  }

  if (Math.floor(lines_cleared / 10) >= level + 1) {
    delay_size /= ACCELERATION;
    level++;
    drawLevelNum();
  }

  let scorechange = 1;
  for (let n = 0; n < exponent; n++) scorechange *= 5;
  scorechange *= (level + 1);
  score += scorechange;
  drawScore();

  if (changedone) {
    drawLinesCleared();
    for (let x = 0; x < XMAPSIZE; x++)
      for (let y = 0; y < YMAPSIZE; y++)
        drawChunk(x, y, map[x][y]);
  }
}

// ---------------------------------------------------------------------------
// Screen chrome
// ---------------------------------------------------------------------------
function highlight(x1, y1, x2, y2) {
  const depth = 10;
  for (let n = 1; n < depth; n++) {
    vga.box(x1 - n, y1 - n, x2 + n, y1 - n, depth - n, 6);
    vga.box(x1 - n, y2 + n, x2 + n, y2 + n, depth - n, 6);
    vga.box(x1 - n, y1 - n + 1, x1 - n, y2 + n - 1, depth - n, 6);
    vga.box(x2 + n, y1 - n + 1, x2 + n, y2 + n - 1, depth - n, 6);
  }
  vga.box(x1, y1, x2, y2, 0, 0);
}

function drawScore() {
  const text = 'Score: ' + score;
  vga.drawtext((SCOREX - (text.length * vga.xfontsize) / 2) | 0, SCOREY, text, TEXTCOLOUR, 0);
}
function drawLinesCleared() {
  const text = 'Lines Cleared: ' + lines_cleared;
  vga.drawtext((LCLRX - (text.length * vga.xfontsize) / 2) | 0, LCLRY, text, TEXTCOLOUR, 0);
}
function drawLevelNum() {
  const text = 'Level: ' + level;
  vga.drawtext((LVLX - (text.length * vga.xfontsize) / 2) | 0, LVLY, text, TEXTCOLOUR, 0);
}

function drawScreen() {
  highlight(zerox, zeroy,
            zerox + XMAPSIZE * XCHUNKSIZE - 1,
            zeroy + YMAPSIZE * YCHUNKSIZE - 1);

  highlight(zerox + DISPLAYX * XCHUNKSIZE - 3 * XCHUNKSIZE,
            zeroy + DISPLAYY * YCHUNKSIZE - 2 * YCHUNKSIZE,
            zerox + DISPLAYX * XCHUNKSIZE + 3 * XCHUNKSIZE,
            zeroy + DISPLAYY * YCHUNKSIZE + 3 * YCHUNKSIZE);

  highlight(LCLRX - 9 * vga.xfontsize - 2, LCLRY - 1,
            LCLRX + 9 * vga.xfontsize + 2, LCLRY + vga.yfontsize);

  highlight(LVLX - (4.5 * vga.xfontsize | 0) - 2, LVLY - 1,
            LVLX + (4.5 * vga.xfontsize | 0) + 2, LVLY + vga.yfontsize);

  highlight(SCOREX - 6 * vga.xfontsize - 2, SCOREY - 1,
            SCOREX + 6 * vga.xfontsize + 2, SCOREY + vga.yfontsize);

  drawLinesCleared();
  drawLevelNum();
  drawScore();

  vga.drawtext(zerox + DISPLAYX * XCHUNKSIZE - 3 * XCHUNKSIZE,
               zeroy + DISPLAYY * YCHUNKSIZE - 3 * vga.yfontsize,
               'Preview:', 128, 6);
}

function eraseMap() {
  for (let a = 0; a < XMAPSIZE; a++) map[a].fill(0);
  vga.box(zerox, zeroy,
          zerox + XMAPSIZE * XCHUNKSIZE - 1,
          zeroy + YMAPSIZE * YCHUNKSIZE - 1, 0, 0);
}

// ---------------------------------------------------------------------------
// Pause overlay
// ---------------------------------------------------------------------------
async function pause() {
  vga.box(zerox, zeroy,
          zerox + XMAPSIZE * XCHUNKSIZE - 1,
          zeroy + YMAPSIZE * YCHUNKSIZE - 1, 0, 0);

  const cx = 160, cy = 100;
  const xo = pausepic[0] >> 1;
  const yo = pausepic[1] >> 1;

  let ang  = -Math.PI / 2;
  let angi = 0;
  let angii = 0.02;

  vga.rotput(cx, cy, xo, yo, ang, 2, pausepic, 1);

  let lastTick = timing.counter();
  while (!input.kbhit()) {
    await timing.nextFrame();
    const t = timing.counter();
    if (t === lastTick) continue;
    lastTick = t;

    vga.rotput(cx, cy, xo, yo, ang, 2, pausepic, 1); // erase old
    angi += angii;
    if (angi > 0.2 || angi < -0.2) angii = -angii;
    ang += angi;
    vga.rotput(cx, cy, xo, yo, ang, 2, pausepic, 1); // draw new
  }
  vga.rotput(cx, cy, xo, yo, ang, 2, pausepic, 1);   // erase final

  while (input.kbhit()) input.getch();

  for (let x = 0; x < XMAPSIZE; x++)
    for (let y = 0; y < YMAPSIZE; y++)
      drawChunk(x, y, map[x][y]);
  drawShape(activeshape, 1);
}

// ---------------------------------------------------------------------------
// Drop wait — replaces the C's iteration-count delay with real time.
// Returns early on soft-drop (mouse-down or Down arrow).  Sets `done` on ESC.
// ---------------------------------------------------------------------------
async function dropDelay(seconds) {
  if (seconds <= 0) return;
  const deadline = performance.now() + seconds * 1000;

  while (performance.now() < deadline && !done) {
    if (input.kbhit()) {
      const k = input.getch();
      if (k === 27) { done = true; return; }
      if (k === 122) rotate(-1);                 // 'z'
      else if (k === 120) rotate(1);             // 'x'
      else if (k === 112 || k === 80 || k === 32) { // 'p','P', space
        await pause();
      } else if (k === 0) {
        const scan = input.getch();
        switch (scan) {
          case 72: rotate(1); break;    // Up
          case 71: rotate(-1); break;   // Home
          case 73: rotate(1); break;    // PgUp
          case 75: move(-1); break;     // Left
          case 77: move(1); break;      // Right
          case 80: return;              // Down (soft drop)
	  case 27: setWantLock(false); break; // escape
        }
      }
    }

    const d = input.readmousediff();
    mouseAccumX += d.x;
    mouseAccumY += d.y;

    if (mouseAccumX >= 10 || mouseAccumX <= -10) {
      const dir = mouseAccumX > 0 ? 1 : -1;
      move(dir);
      mouseAccumX -= 10 * dir;
    }
    if (mouseAccumY >= 10) {
      mouseAccumY -= 10;
      return;
    }

    const b = input.buttonmask();
    if (b === 1 && buttondown !== 1) rotate(-1);
    else if (b === 2 && buttondown !== 2) rotate(1);
    buttondown = b;

    await timing.nextFrame();
  }
}

// ---------------------------------------------------------------------------
// Main play loop
// ---------------------------------------------------------------------------
export async function playTetris(gamestyle, startLevel) {
  done = false;
  buttondown = 0;
  mouseAccumX = 0;
  mouseAccumY = 0;

  score = 0;
  lines_cleared = 0;
  level = startLevel;
  delay_size = STARTING_DELAY / Math.pow(ACCELERATION, startLevel);

  // Set up map as [XMAPSIZE][YMAPSIZE]
  map = Array.from({ length: XMAPSIZE }, () => new Uint8Array(YMAPSIZE));

  // Background + chrome
  const bg = await loadPic('assets/backg1.pic');
  vga.erase(0, 0, 319, 199, 0, 0, bg);
  drawScreen();
  eraseMap();

  // Seed the "next shape" preview
  let nextType = (Math.random() * 7 | 0) + 1;
  let nextshape = generateShape(nextType);
  nextshape.x = DISPLAYX;
  nextshape.y = DISPLAYY;

  while (!done) {
    drawShape(nextshape, 0);       // erase preview
    activeshape = nextshape;       // reference (we reassign nextshape below)

    nextType = (Math.random() * 7 | 0) + 1;
    if (gamestyle === 3) {
      nextType += (Math.random() * 5 | 0);
      if (nextType > 8) nextType = 8;
    }
    nextshape = generateShape(nextType);
    nextshape.x = DISPLAYX;
    nextshape.y = DISPLAYY;
    drawShape(nextshape, 1);       // draw new preview

    activeshape.x = (XMAPSIZE / 2 | 0) - 1;
    activeshape.y = 0;
    if (activeshape.type > 7) activeshape.y = 2;
    if (dead()) done = true;
    while (input.kbhit()) input.getch();

    do {
      drawShape(activeshape, 0);
      activeshape.y++;
      drawShape(activeshape, activeshape.type);

      let diu = delay_size;
      if (gamestyle === 2) diu /= activeshape.y;
      await dropDelay(diu);
    } while (!shapeFallen() && !done);

    if (done) break;

    // Lock into map
    for (let n = 0; n < activeshape.numchunks; n++) {
      map[activeshape.x + activeshape.chunkx[n]][activeshape.y + activeshape.chunky[n]] =
        activeshape.type;
    }
    checkForLines();
  }
}
