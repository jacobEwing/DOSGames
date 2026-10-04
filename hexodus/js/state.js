// state.js — shared mutable state and constants for Hexodus.

import { loadPic } from 'lib/assets.js';

// ---- Constants ------------------------------------------------------------
export const tabsize = 4;
export const PI = Math.PI;
export const MINMAPY = 2;
export const NUMCHUNKPICS = 6;
export const NUMBACKGROUNDS = 10;
export const MUSIC_VELOCITY = 8;

export const PREVIEWX = 258;
export const PREVIEWY = 24;
export const SCRX = 220;
export const SCRY = 100;
export const LNUMX = 228;
export const LNUMY = 60;
export const ZEROX = 13;
export const ZEROY = -108;

export const XCHUNKSIZE = 11;
export const YCHUNKSIZE = 8;
export const XGRIDSIZE = 25;
export const YGRIDSIZE = 36;
export const FALLSPEED = 6;

// ---- Mutable game state ---------------------------------------------------
// Signed bytes because we store -1 in the map.
export const map = [];
for (let i = 0; i < XGRIDSIZE; i++) map.push(new Int8Array(YGRIDSIZE).fill(-1));

export const state = {
  score: 0,
  levelnum: 0,
  done: false,
  dead: false,

  chunk: [],
  nextchunk: [],
  numchunks: 0,
  nextnumchunks: 0,

  shape: { x: 0, y: 0 },

  starting_level: 0,
  backgpattern: 0,
  music_on: 0,
  hexagon_picture_type: 0,

  chunkpic: new Array(NUMCHUNKPICS),
  backg: null,
  copyright: null,
  tm: null,
  pointer: null,

  starting_delay: 0,
  delay_size: 0,
  delay_tally: 0,
  drop_tally: 0,
  time_tally: 0,
};

// ---- Asset loading --------------------------------------------------------
export async function loadInitialAssets() {
  state.tm        = await loadPic('assets/tm.pic');
  state.copyright = await loadPic('assets/cpyright.pic');
  state.pointer   = await loadPic('assets/pointer.pic');
}

export async function loadBackgroundForLevel(levelnum, backgpattern) {
  let name;
  if (backgpattern === 0) {
    const idx = (levelnum % NUMBACKGROUNDS) + 1;
    name = `assets/backg${idx}.pic`;
  } else if (backgpattern === 1) {
    name = 'assets/backg0.pic';
  } else {
    name = 'assets/blank.pic';
  }
  state.backg = await loadPic(name);
}
