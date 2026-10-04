// main.js
import * as vga from 'lib/vga.js';
import * as input from 'lib/input.js';
import * as timing from 'lib/timing.js';
import { state } from './state.js';
import { loadFontInto, drainKeyboard, continue_game } from './helpers.js';
import { play_game, loadLevels } from './game.js';
import {
  opscreen, mainmenu, show_credits, show_high_score_list,
  explain_game, test_high_scores,
} from './screens.js';

const HOME_URL = '/';

async function main() {
  const canvas = document.getElementById('screen');
  vga.attachCanvas(canvas);
  input.initInput(canvas);

  await loadFontInto('assets/11x12.blf');
  const levels = await loadLevels('assets/levels.dat');
  state.numlevels = levels.numLevels;

  timing.startLoop(() => vga.present());

  await opscreen();

  let done = false;
  while (!done) {
    drainKeyboard();
    const choice = await mainmenu();
    switch (choice) {
      case 0: {
        let continuing = 0;
        do {
          state.quitting = false;
          vga.cls();
          await play_game(continuing);
          await test_high_scores(state.score);
          if (state.current_level < state.numlevels && !state.quitting) {
            continuing = await continue_game();
          } else {
            continuing = 0;
          }
        } while (continuing);
        break;
      }
      case 1: await show_high_score_list(); break;
      case 2: await show_credits(); break;
      case 3: await explain_game(); break;
      case 4:
        input.setWantLock(false);
        if (document.pointerLockElement) document.exitPointerLock();
        if (window.history.length > 1) window.history.back();
        else window.location.href = HOME_URL;
        return;
    }
  }

  await opscreen();
}

main().catch(err => {
  console.error(err);
  document.body.innerHTML =
    `<pre style="color:#f88;font:14px monospace;padding:1em">${err.stack || err}</pre>`;
});
