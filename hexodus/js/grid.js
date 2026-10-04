// grid.js — rendering of chunks, shapes, and the static game screen.
//
// Ported from hex0009.cpp:
//   drawchunk, erasechunk, drawshape, eraseshape, drawshapefree, drawscreen.
//
// All drawing goes through lib/vga.js.  Chunk sprites and the level
// background are Uint8Arrays in .pic format ([0]=w, [1]=h, [2..]=pixels).

import * as vga from 'lib/vga.js';
import {
  state, map,
  ZEROX, ZEROY, XCHUNKSIZE, YCHUNKSIZE,
  XGRIDSIZE, YGRIDSIZE,
  PREVIEWX, PREVIEWY, SCRX, SCRY, LNUMX, LNUMY,
} from './state.js';

// ---------------------------------------------------------------------------
// drawchunk — plot one hexagon at (shapex + chunkx, shapey + chunky) in grid
// space.  The "mindraw" clamps keep drawing inside the playfield's visible
// region; pixels outside are skipped, not clipped, so the sprite origin is
// preserved on the boundary.
// ---------------------------------------------------------------------------

const MINDRAWX = ZEROX + 6;
const MINDRAWY = ZEROY + YCHUNKSIZE * ((XGRIDSIZE / 2 | 0) + 2) - 1;
const MAXDRAWX = ZEROX + (((XGRIDSIZE + 0.5) * ((2 * XCHUNKSIZE / 3) | 0)) | 0);
const MAXDRAWY = ZEROY + (YGRIDSIZE + 2) * YCHUNKSIZE - 1;

export function drawchunk(shapex, shapey, chunkx, chunky, picture) {
  const w = picture[0], h = picture[1];
  const x1 = ZEROX + (shapex + chunkx) * ((2 * XCHUNKSIZE / 3) | 0);
  const y1 = ZEROY + (shapey + chunky) * YCHUNKSIZE
           + (shapex + chunkx) * (YCHUNKSIZE / 2 | 0);
  const x2 = x1 + w - 1;
  const y2 = y1 + h - 1;

  let n = 2;
  for (let y = y1; y <= y2; y++) {
    if (y >= MINDRAWY && y <= MAXDRAWY) {
      const yrow = (y << 8) + (y << 6);
      for (let x = x1; x <= x2; x++) {
        if (x >= MINDRAWX && x <= MAXDRAWX && picture[n]) {
          vga.vmem[yrow + x] = picture[n];
        }
        n++;
      }
    } else {
      n += w;
    }
  }
}

// ---------------------------------------------------------------------------
// erasechunk — restore the playfield background underneath one hexagon.
// Uses chunkpic[0] as the stencil (all chunk pics share dimensions, so any
// of them works).  The background is tiled, with modulo wraps.
// ---------------------------------------------------------------------------

export function erasechunk(chunkx, chunky) {
  const mask = state.chunkpic[0];
  const bg = state.backg;
  const bgw = bg[0], bgh = bg[1];

  const x1 = ZEROX + chunkx * ((2 * XCHUNKSIZE / 3) | 0);
  const y1 = ZEROY + chunky * YCHUNKSIZE + chunkx * (YCHUNKSIZE / 2 | 0);
  const x2 = x1 + mask[0] - 1;
  const y2 = y1 + mask[1] - 1;

  let n = 2;
  for (let y = y1; y <= y2; y++) {
    const yrow = (y << 8) + (y << 6);
    for (let x = x1; x <= x2; x++) {
      if (mask[n] !== 0
          && x >= 0 && x <= 319
          && y >= 0 && y <= 199) {
        const cx = ((x % bgw) + bgw) % bgw;
        const cy = ((y % bgh) + bgh) % bgh;
        vga.vmem[yrow + x] = bg[cx + bgw * cy + 2];
      }
      n++;
    }
  }
}

// ---------------------------------------------------------------------------
// drawshape / eraseshape — the current piece, drawn or erased from the grid.
// The C code passes chunk coordinates already offset by (x, y); we keep that
// convention.
// ---------------------------------------------------------------------------

export function drawshape(x, y, chunk, numchunks) {
  for (let n = 0; n < numchunks; n++) {
    drawchunk(x, y, chunk[n].x, chunk[n].y, chunk[n].pic);
  }
}

export function eraseshape(x, y, chunk, numchunks) {
  for (let n = 0; n < numchunks; n++) {
    erasechunk(x + chunk[n].x, y + chunk[n].y);
  }
}

// ---------------------------------------------------------------------------
// drawshapefree — draw a shape at a screen pixel origin without grid
// clamping.  Used for the "next piece" preview.  The scaling here squishes
// the piece into a smaller footprint (2/3 x, plus a shear).
// ---------------------------------------------------------------------------

export function drawshapefree(x, y, chunk, numchunks) {
  for (let n = 0; n < numchunks; n++) {
    const drawx = x + chunk[n].x * ((2 * XCHUNKSIZE / 3) | 0);
    const drawy = y + chunk[n].y * YCHUNKSIZE + chunk[n].x * (YCHUNKSIZE / 2 | 0);
    vga.put(drawx, drawy, chunk[n].pic, 4);
  }
}

// ---------------------------------------------------------------------------
// drawscreen — lay down the static chrome: preview frame, score box, level
// box, playfield frame, winning-region highlight.  Called once per level.
// ---------------------------------------------------------------------------

const PLAYFIELD_X1 = ZEROX + 5;
const PLAYFIELD_Y1 = ZEROY + YCHUNKSIZE * ((XGRIDSIZE / 2 | 0) + 2) - 2;
const PLAYFIELD_X2 = ZEROX + (((XGRIDSIZE + 0.5) * ((2 * XCHUNKSIZE / 3) | 0)) | 0) + 1;
const PLAYFIELD_Y2 = ZEROY + (YGRIDSIZE + 2) * YCHUNKSIZE;

export function drawscreen() {
  const xf = vga.xfontsize, yf = vga.yfontsize;

  // -- background: preview frame -------------------------------------------
  vga.box(PREVIEWX - 20, PREVIEWY - 16, PREVIEWX + 24, PREVIEWY + 24, 8, 4);

  // -- preview: clear, then frame (matches the C ordering) -----------------
  vga.erase(PREVIEWX - 19, PREVIEWY - 15, PREVIEWX + 23, PREVIEWY + 23,
            0, 0, state.backg);
  vga.box(PREVIEWX - 20, PREVIEWY - 16, PREVIEWX + 24, PREVIEWY + 24, 8, 4);

  // -- score ---------------------------------------------------------------
  vga.erase(SCRX, SCRY, SCRX + 10 * xf, SCRY + 3 * yf, 0, 0, state.backg);
  vga.box(SCRX - 1, SCRY - 1, SCRX + 10 * xf + 1, SCRY + 3 * yf + 1, 8, 4);
  vga.drawtext(SCRX + (xf / 2 | 0), SCRY + (yf / 2 | 0),
               'Score:', 15, 4);
  vga.drawtext(SCRX + (xf / 2 | 0), SCRY + ((3 * yf) / 2 | 0),
               String(state.score), 15, 4);

  // -- level number --------------------------------------------------------
  // Note: the C code uses 3 * xfontsize for the vertical extent here, not
  // yfontsize.  That is almost certainly a typo but it is what the original
  // does, and the result looks correct for the fonts shipped with the game,
  // so we preserve it.
  vga.erase(LNUMX, LNUMY,
            LNUMX + 8 * xf, LNUMY + 3 * xf, 0, 0, state.backg);
  vga.box(LNUMX - 1, LNUMY - 1,
          LNUMX + 8 * xf + 1, LNUMY + 3 * xf + 1, 8, 4);
  vga.drawtext(LNUMX + xf, LNUMY + (yf / 2 | 0), 'Level:', 15, 4);
  vga.drawtext(LNUMX + 3 * xf, LNUMY + ((3 * yf) / 2 | 0),
               String(state.levelnum), 15, 4);

  // -- playfield frame -----------------------------------------------------
  vga.box(PLAYFIELD_X1, PLAYFIELD_Y1, PLAYFIELD_X2, PLAYFIELD_Y2, 8, 4);

  // -- playfield interior --------------------------------------------------
  vga.erase(PLAYFIELD_X1 + 1, PLAYFIELD_Y1 + 1,
            PLAYFIELD_X2 - 1, PLAYFIELD_Y2 - 1,
            0, 0, state.backg);

  // -- winning region highlight -------------------------------------------
  // The colour is sampled from the background picture itself (byte 2 is the
  // first pixel of the .pic).  In the C original this reads backg[2] which
  // is an unsigned char; we mirror that.
  const highlight = state.backg[2];
  vga.box(PLAYFIELD_X1 + 1,
          PLAYFIELD_Y1 + 1,
          PLAYFIELD_X2 - 1,
          PLAYFIELD_Y1 + 1 + 5 * YCHUNKSIZE,
          highlight, 5);
}
