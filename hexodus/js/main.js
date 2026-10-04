// main.js — Hexodus bootstrap and main menu dispatch.
//
// This is a faithful port of the MCGA/Mode 13h revision of Hexodus
// (hex0009.cpp).  A later Allegro rewrite of the same game exists, but
// the source we're working from is the original DOS version.
//
// Sound is deliberately omitted in this port.

import * as vga from 'lib/vga.js';
import * as input from 'lib/input.js';
import * as timing from 'lib/timing.js';
import { setFontFrom, loadPic } from 'lib/assets.js';
import { state, loadInitialAssets } from './state.js';
import { load_hexagons } from './pieces.js';
import { playGame } from './game.js';
import {
  menuscreen, explain_game, show_high_scores, show_credits,
} from './screens.js';
import {
  set_music, set_background_patterns,
  set_hexagon_characters, set_starting_level,
} from './settings.js';
import { test_high_scores } from './scores.js';

async function main(canvas) {
  vga.attachCanvas(canvas);
  input.initInput(canvas);
  input.setWantLock(true);
  await loadInitialAssets();
  await load_hexagons(state.hexagon_picture_type);
  await setFontFrom('assets/11x12.blf');

  let exiting = false;
  while (!exiting) {
    const choice = await menuscreen(
      'Hexodus', true, 'undermnu.pic',
      ['Play Hexodus', 'High Scores', 'Credits',
       'How to Play', 'Exit']
    );

    switch (choice) {
      case 0:
        state.backg = await loadPic('assets/undergme.pic');
        vga.erase(0, 0, 319, 199, 0, 0, state.backg);
        await playGame();
        await test_high_scores();
        await setFontFrom('assets/11x12.blf');
        break;
      case 1:
        await show_high_scores();
        await setFontFrom('assets/11x12.blf');
        break;
      case 2:
        await show_credits();
        await setFontFrom('assets/11x12.blf');
        break;
      case 3:
        await explain_game();
        await setFontFrom('assets/11x12.blf');
        break;
      case 4:
        exiting = true;
        history.back();
        break;      
    }
  }
}

timing.startLoop(() => vga.present());

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('screen');
  main(canvas).catch(err => {
    console.error(err);
    document.body.insertAdjacentHTML('beforeend',
      `<pre style="color:#f88;font:14px monospace;padding:1em;white-space:pre-wrap">${err.stack || err}</pre>`);
  });
});
