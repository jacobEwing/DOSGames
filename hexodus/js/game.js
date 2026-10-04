// game.js — the main Hexodus play loop and its input handlers.
//
// Ported from hex0009.cpp: play_game, handle_keyboard_IO, handle_mouse_IO,
// addscore.
//
// Timing note: the C version calibrates `starting_delay` against the 18.2 Hz
// PC BIOS tick at startup (set_delay_size).  That's machine-dependent and
// can't be reproduced in JS, so we pick a fixed value that gives a similar
// pace.  With STARTING_DELAY = 18 and the original formula
//
//     delay_size = starting_delay / ((levelnum + 1) / 2)
//
// we get roughly:
//   level 0 -> 36 ticks (~2.0 s per row)
//   level 1 -> 18 ticks (~1.0 s)
//   level 2 -> 12 ticks (~0.66 s)
//   level 3 ->  9 ticks (~0.5 s)
// and so on.  Tune STARTING_DELAY here if the game feels too fast or slow.

import * as vga from 'lib/vga.js';
import * as input from 'lib/input.js';
import * as timing from 'lib/timing.js';
import { setFontFrom } from 'lib/assets.js';
import {
  state, map,
  XGRIDSIZE, YGRIDSIZE, MINMAPY, FALLSPEED,
  PREVIEWX, PREVIEWY, SCRX, SCRY,
  loadBackgroundForLevel,
} from './state.js';
import {
  generate_chunk, rotate, chunkcopy, mapy,
} from './pieces.js';
import {
  drawshape, eraseshape, drawshapefree, drawscreen,
  erasechunk, drawchunk,
} from './grid.js';

// ---------------------------------------------------------------------------
// Timing.
// ---------------------------------------------------------------------------

const STARTING_DELAY = 18;

function computeDelaySize(levelnum) {
  // Mirrors: delay_size = starting_delay / ((levelnum + 1) / 2)
  // Integer division truncates toward zero, matching C.
  const d = STARTING_DELAY / ((levelnum + 1) / 2);
  return Math.max(1, d | 0);
}

// ---------------------------------------------------------------------------
// Geometry helpers.
//
// mapy() lives in pieces.js because it depends on the current shape, but
// it's only used here (fits-check during rotation).  The fall-check uses a
// different y-mapping (see the inner loop); the original made the same
// distinction.
// ---------------------------------------------------------------------------

// Return true if the current piece can legally occupy its current position.
// Matches the per-chunk checks scattered through the C input handlers.
function canPlace() {
  for (let n = 0; n < state.numchunks; n++) {
    const c = state.chunk[n];
    const tx = state.shape.x + c.x;
    if (tx >= XGRIDSIZE || tx < 0 || mapy(c) < MINMAPY) return false;
    const ty = (state.shape.y + c.y) + ((tx / 2) | 0) - 1;
    if (tx >= 0 && tx < XGRIDSIZE && ty >= 0 && ty < YGRIDSIZE) {
      if (map[tx][ty] !== -1) return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// playGame — top-level game entry point.
// ---------------------------------------------------------------------------

export async function playGame() {
  await setFontFrom('assets/thin.blf');

  state.done = state.dead = false;
  state.score = 0;
  state.levelnum = state.starting_level;
  state.drop_tally = 0;

  // Music: skipped.  The C version calls play_tune(1) here.

  while (!state.dead) {
    await playLevel();
  }

  // The C version does nosound() here; nothing to do.
}

// ---------------------------------------------------------------------------
// playLevel — one level, mirrors one iteration of play_game's outer loop.
// ---------------------------------------------------------------------------

async function playLevel() {
  state.done = false;
  state.delay_size = computeDelaySize(state.levelnum);

  await loadBackgroundForLevel(state.levelnum, state.backgpattern);
  state.levelnum++;
  drawscreen();

  // Clear the map.
  for (let n = 1; n < XGRIDSIZE; n++) {
    for (let m = 0; m < YGRIDSIZE; m++) {
      map[n][m] = -1;
    }
  }

  let map_volume = 0;
  let doneonce = false;
  state.numchunks = generate_chunk(state.chunk, Math.floor(Math.random() * 7));

  while (!(state.done || state.dead)) {
    state.shape.x = (XGRIDSIZE / 2) | 0;
    state.shape.y = ((XGRIDSIZE / 2) | 0) - ((XGRIDSIZE / 4) | 0) + 4;

    if (doneonce) {
      vga.erase(PREVIEWX - 19, PREVIEWY - 15,
                PREVIEWX + 23, PREVIEWY + 23,
                0, 0, state.backg);
      state.numchunks = chunkcopy(state.chunk, state.nextchunk,
                                  state.nextnumchunks);
    }

    state.nextnumchunks =
      generate_chunk(state.nextchunk, Math.floor(Math.random() * 7));

    drawshape(state.shape.x, state.shape.y, state.chunk, state.numchunks);
    drawshapefree(PREVIEWX, PREVIEWY, state.nextchunk, state.nextnumchunks);

    let fallen = false;
    let exploded = false;

    while (!(state.done || fallen || exploded || state.dead)) {
      state.delay_tally = 0;

      // ---- sub-tick loop ----------------------------------------------
      while (state.delay_tally < state.delay_size && !state.done) {
        // Music: skipped.

        state.delay_tally++;

        state.drop_tally =
          (state.drop_tally + 1) % (FALLSPEED * state.delay_size);

        if (state.drop_tally === 0) {
          // Drop the bottom row of the tower.
          for (let n = 1; n < XGRIDSIZE; n++) {
            if (map[n][YGRIDSIZE - 1] !== -1) {
              map_volume--;
              map[n][YGRIDSIZE - 1] = -1;
              erasechunk(n, YGRIDSIZE - 1 - ((n / 2) | 0) + 1);
            }
          }

          if (doneonce && map_volume <= 0) state.dead = true;

          // Shift everything up by one row.
          for (let n = 1; n < XGRIDSIZE; n++) {
            for (let m = YGRIDSIZE - 1; m > 0; m--) {
              if (map[n][m] !== map[n][m - 1]) {
                map[n][m] = map[n][m - 1];
                if (map[n][m] === -1) {
                  erasechunk(n, m - ((n / 2) | 0) + 1);
                } else {
                  drawchunk(n, m - ((n / 2) | 0) + 1,
                            0, 0, state.chunkpic[map[n][m]]);
                }
              }
              map[n][0] = -1;
            }
          }
        }

        handleMouseIO();
        await handleKeyboardIO();

        await timing.nextTick();
      }
      // ---- end sub-tick loop ------------------------------------------

      // Collision / fall / explosion check, mirroring the C's per-chunk,
      // per-test-point loop.
      for (let n = 0; n < state.numchunks; n++) {
        const c = state.chunk[n];
        for (let m = 0; m < 3; m++) {
          let testx, testy;
          switch (m) {
            case 0:
              testy = (state.shape.y + c.y)
                    + (((state.shape.x + c.x) / 2) | 0) - 1;
              testx = state.shape.x + c.x;
              break;
            case 1:
              testy = (state.shape.y + c.y)
                    + (((state.shape.x + c.x - 1) / 2) | 0) - 1;
              testx = state.shape.x + (c.x + 1);
              break;
            case 2:
              testy = (state.shape.y + c.y)
                    + (((state.shape.x + c.x - 1) / 2) | 0) - 1;
              testx = state.shape.x + (c.x - 1);
              break;
          }
          if (testx < XGRIDSIZE && testx >= 1
              && testy >= 0 && testy < YGRIDSIZE) {
            if (testy >= YGRIDSIZE - 1) {
              fallen = true;
            } else if (map[testx][testy + 1] === c.type) {
              fallen = true;
            } else if (map[testx][testy + 1] !== -1) {
              exploded = true;
              map[testx][testy + 1] = -1;
              map_volume--;
              switch (m) {
                case 0: erasechunk(testx, state.shape.y + c.y + 1); break;
                case 1: erasechunk(testx, state.shape.y + c.y);     break;
                case 2: erasechunk(testx, state.shape.y + c.y + 1); break;
              }
            }
          }
        }
      }

      if (exploded) {
        eraseshape(state.shape.x, state.shape.y, state.chunk, state.numchunks);
      } else if (!fallen) {
        eraseshape(state.shape.x, state.shape.y, state.chunk, state.numchunks);
        state.shape.y++;
        drawshape(state.shape.x, state.shape.y, state.chunk, state.numchunks);
      } else {
        // Land the piece into the map.
        for (let n = 0; n < state.numchunks; n++) {
          const c = state.chunk[n];
          const testy = (state.shape.y + c.y)
                      + (((state.shape.x + c.x) / 2) | 0) - 1;
          const testx = state.shape.x + c.x;
          map_volume++;
          addscore(5);
          if (testx >= 0 && testx < XGRIDSIZE
              && testy >= 0 && testy < YGRIDSIZE) {
            map[testx][testy] = c.type;
          }

          if (state.shape.y + c.y
              + (((state.shape.x + c.x) / 2) | 0) + 1 < 20) {
            state.done = true;
          }
        }
      }
    }

    if (doneonce && map_volume <= 0) state.dead = true;
    if (!doneonce) {
      doneonce = true;
      state.drop_tally = 0;
    }
  }

  if (!state.dead) addscore(map_volume);

  vga.erase(PREVIEWX - 19, PREVIEWY - 15,
            PREVIEWX + 23, PREVIEWY + 23,
            0, 0, state.backg);
}

// ---------------------------------------------------------------------------
// Movement helpers — shared by keyboard and mouse handlers.
// ---------------------------------------------------------------------------

function tryRotate(direction) {
  eraseshape(state.shape.x, state.shape.y, state.chunk, state.numchunks);
  rotate(state.chunk, state.numchunks, direction);
  if (!canPlace()) {
    rotate(state.chunk, state.numchunks, -direction);
  }
  drawshape(state.shape.x, state.shape.y, state.chunk, state.numchunks);
}

function tryMove(dx) {
  eraseshape(state.shape.x, state.shape.y, state.chunk, state.numchunks);

  const oldx = state.shape.x;
  const oldy = state.shape.y;

  if (dx < 0) {
    if (state.shape.x > 0) {
      if (state.shape.x % 2) state.shape.y++;
      state.shape.x--;
    }
  } else if (dx > 0) {
    if (state.shape.x < XGRIDSIZE) {
      if (!(state.shape.x % 2)) state.shape.y--;
      state.shape.x++;
    }
  }

  if (!canPlace()) {
    state.shape.x = oldx;
    state.shape.y = oldy;
  }

  drawshape(state.shape.x, state.shape.y, state.chunk, state.numchunks);
}

// ---------------------------------------------------------------------------
// Keyboard handler.  Async because the pause branch must wait for input.
// ---------------------------------------------------------------------------

export async function handleKeyboardIO() {
  if (!input.kbhit()) return;

  const key = input.getch();
  switch (key) {
    case 9:                              // Tab — end level
      state.done = true;
      break;

    case 32: case 112: case 80:          // Space / 'p' / 'P' — pause
      // The C version blocks in getch() until the next key, then drains.
      while (!input.kbhit()) await timing.nextFrame();
      while (input.kbhit()) input.getch();
      break;

    case 27:                             // Esc — back to menu
      state.done = state.dead = true;
      break;

    case 122: case 90:                   // 'z' / 'Z' — rotate CCW
      tryRotate(-1);
      break;

    case 120: case 88:                   // 'x' / 'X' — rotate CW
      tryRotate(1);
      break;

    case 0:                              // Extended keys
      switch (input.getch()) {
        case 72: tryRotate(1); break;                     // Up
        case 75: tryMove(-1);  break;                     // Left
        case 77: tryMove(1);   break;                     // Right
        case 80: state.delay_tally = state.delay_size; break; // Down — fast drop
      }
      break;
  }
}

// ---------------------------------------------------------------------------
// Mouse handler.
//
// The original reads raw mouse deltas in 640x200 mickey space; our
// input.readmousediff() returns 320x200 screen pixels.  We multiply by 2
// so the threshold constants (10, 5) keep their original meaning.
// ---------------------------------------------------------------------------

let buttonreleased = true;
let diffx = 0, diffy = 0;

export function handleMouseIO() {
  const mask = input.buttonmask();

  if (mask === 0) buttonreleased = true;

  const d = input.readmousediff();
  diffx += d.x * 2;
  diffy += d.y * 2;
  if (diffy < 0) diffy = 0;

  if (!diffx && !diffy) return;

  if (diffy > 5) {
    // Fast drop.
    state.delay_tally = state.delay_size;
    diffx = diffy = 0;
  } else if (diffx < -10) {
    diffx = diffy = 0;
    tryMove(-1);
  } else if (diffx > 10) {
    diffx = 0;
    tryMove(1);
  }

  if (buttonreleased && mask !== 0) {
    buttonreleased = false;
    switch (mask) {
      case 1:   // Left button
        tryRotate(-1);
        break;
      case 2:   // Right button
        tryRotate(1);
        break;
      default:
        buttonreleased = true;
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// Score.
// ---------------------------------------------------------------------------

export function addscore(amount) {
  const xf = vga.xfontsize, yf = vga.yfontsize;
  vga.erase(SCRX, SCRY + ((1.5 * yf) | 0),
            SCRX + 10 * xf, SCRY + 3 * yf,
            0, 0, state.backg);
  state.score += amount;
  vga.drawtext(SCRX + (xf / 2 | 0), SCRY + ((3 * yf / 2) | 0),
               String(state.score), 15, 4);
}
