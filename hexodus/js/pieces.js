// pieces.js — piece generation, rotation, and hexagon picture loading.

import { loadPic } from 'lib/assets.js';
import { state, NUMCHUNKPICS, XGRIDSIZE } from './state.js';

const SHAPES = [
  // 0: C
  [[0,0],[1,-1],[2,-1],[-1,1],[-1,2]],
  // 1: Triangle
  [[0,0],[0,2],[2,0],[0,1],[1,0],[1,1]],
  // 2: T
  [[0,0],[1,0],[-1,1],[0,-1]],
  // 3: X
  [[0,0],[0,1],[1,0],[-1,0],[0,-1]],
  // 4: Z
  [[0,0],[0,1],[1,-1],[1,-2]],
  // 5: backwards Z
  [[0,0],[0,1],[-1,0],[-1,-1]],
  // 6: line
  [[0,0],[-1,0],[1,0],[-2,0],[2,0]],
];

export function generate_chunk(dst, shape_type) {
  const pts = SHAPES[shape_type % SHAPES.length];
  dst.length = pts.length;
  for (let n = 0; n < pts.length; n++) {
    const type = Math.floor(Math.random() * NUMCHUNKPICS);
    dst[n] = {
      x: pts[n][0],
      y: pts[n][1],
      pic: state.chunkpic[type],
      type,
    };
  }
  return dst.length;
}

export function rotate(chunk, numpoints, direction) {
  for (let n = 0; n < numpoints; n++) {
    const c = chunk[n];
    if (direction === -1) {
      c.x += c.y;
      c.y -= c.x;
    } else {
      c.y += c.x;
      c.x -= c.y;
    }
  }
}

export function chunkcopy(dest, source, count) {
  dest.length = count;
  for (let n = 0; n < count; n++) {
    const s = source[n];
    dest[n] = { x: s.x, y: s.y, pic: s.pic, type: s.type };
  }
  return count;
}

// Load the six "hex<n><a-e>.pic" hexagon sprites for the chosen
// hexagon_picture_type (0..4).  All six hexagons in the set share the
// same style suffix.
const HEX_SUFFIX = ['a', 'b', 'c', 'd', 'e'];
export async function load_hexagons(pictype) {
  const suffix = HEX_SUFFIX[pictype] || 'a';
  for (let n = 0; n < NUMCHUNKPICS; n++) {
    const name = `assets/hex${n + 1}${suffix}.pic`;
    state.chunkpic[n] = await loadPic(name);
  }
}

export function mapy(c) {
  return state.shape.y + c.y - (((XGRIDSIZE - state.shape.x - c.x) / 2) | 0);
}
