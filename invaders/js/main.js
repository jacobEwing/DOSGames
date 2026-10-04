// main.js — entry point for Invaders.
import * as vga from 'lib/vga.js';
import * as input from 'lib/input.js';
import * as timing from 'lib/timing.js';
import { setFontFrom } from 'lib/assets.js';
import { loadAllPictures } from './assets.js';
import { loadLevels } from './level.js';
import { loadScores, topScore } from './hscr.js';
import { mainMenu, showHighScores, testHighScores, showCredits,
         explainGame, adjustSettings } from './screens.js';
import { playGame, initPalette, initGame } from './game.js';

async function boot() {
  const canvas = document.getElementById('screen');
  vga.attachCanvas(canvas);
  timing.startLoop(() => vga.present());
  input.initInput(canvas);

  await setFontFrom(new URL('../assets/thin.blf', import.meta.url).href);
  await loadAllPictures();
  await loadLevels();
  initPalette();
  initGame();

  let exiting = false;
  while (!exiting) {
    const choice = await mainMenu();
    switch (choice) {
      case 0: {
        const hi = topScore(loadScores());
        const score = await playGame(hi);
        input.setMouseLimits(0, 0, 319, 199);
        await testHighScores(score);
        break;
      }
      case 1: await showHighScores(); break;
      case 2: await showCredits(); break;
      case 3: await explainGame(); break;
      case 4: await adjustSettings(); break;
      case 5: exiting = true;
        input.setWantLock(false);
        if (document.pointerLockElement) document.exitPointerLock();
        if (window.history.length > 1) window.history.back();
        else window.location.href = HOME_URL;
        return;
    }
  }
}

boot().catch(e => {
  console.error(e);
  document.body.textContent = e && e.message ? e.message : String(e);
});
