// main.js — Accetris entry point: fonts, menus, settings, high scores.
import * as vga from '../../lib/vga.js';
import * as input from '../../lib/input.js';
import * as timing from '../../lib/timing.js';
import * as ui from '../../lib/ui.js';
import * as assets from '../../lib/assets.js';
import { playTetris, loadGamePictures, getScore } from './tetris.js';

const HIGHSCORES_KEY = 'accetris.highscores';
const MAX_SCORES = 10;
const MAX_NAME_LEN = 20;

// ---------------------------------------------------------------------------
// Font toggling (mirrors the C's toggle_fonts(): swap active <-> alternate)
// ---------------------------------------------------------------------------
const fonts = { main: null, alt: null };
function toggleFonts() {
  [fonts.main, fonts.alt] = [fonts.alt, fonts.main];
  vga.setFont(fonts.main);
}

// ---------------------------------------------------------------------------
// Settings state (game_style, starting_level)
// ---------------------------------------------------------------------------
let game_style = 1;       // 1=Normal, 2=Accelerating, 3=Odd Piece
let starting_level = 0;   // 0..10

// ---------------------------------------------------------------------------
// High scores (localStorage-backed)
// ---------------------------------------------------------------------------
function loadHighScores() {
  try {
    const raw = localStorage.getItem(HIGHSCORES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, MAX_SCORES).map(e => ({
      name:  String(e.name ?? '').slice(0, MAX_NAME_LEN),
      score: Number(e.score ?? 0) | 0,
    }));
  } catch { return []; }
}

function saveHighScores(scores) {
  try {
    localStorage.setItem(HIGHSCORES_KEY,
      JSON.stringify(scores.slice(0, MAX_SCORES)));
  } catch { /* storage unavailable — silently ignore */ }
}

// ---------------------------------------------------------------------------
// test_high_scores(): after a game, offer to insert the new score.
// ---------------------------------------------------------------------------
async function testHighScores() {
  const sc = getScore();
  if (sc <= 0) return;

  let scores = loadHighScores();

  let rank = -1;
  for (let n = 0; n < scores.length; n++) {
    if (scores[n].score < sc) { rank = n; break; }
  }
  if (rank === -1 && scores.length < MAX_SCORES) rank = scores.length;
  if (rank === -1) return;  // didn't make the board

  // NOTE: the migrated taketext() can't exit on Enter when buttons is empty
  // (it uses -1 as both "no button" and "keep looping").  We pass a single
  // OK/Enter button so Enter commits and mouse-clicking OK works too.
  const result = await ui.taketext('What is Your Name?',
    [{ text: 'OK', hotkey: 13 }]);
  const name = String(result.text || '').replace(/[\r\n]/g, '').slice(0, MAX_NAME_LEN);

  scores.splice(rank, 0, { name, score: sc });
  scores = scores.slice(0, MAX_SCORES);
  saveHighScores(scores);

  await showHighScores();
}

// ---------------------------------------------------------------------------
// show_high_scores(): table of names/scores plus the swirling polygon snake.
// ---------------------------------------------------------------------------
async function showHighScores() {
  const scores = loadHighScores();

  const numpoints = 32;
  const chunksize = 4;

  const boxx1 = 40, boxx2 = 280;
  const boxy1 = 100 - 5 * vga.yfontsize - 10;
  const boxy2 = 100 + 5 * vga.yfontsize + 10;

  const bg1 = await assets.loadPic('assets/backg2.pic');
  const bg0 = await assets.loadPic('assets/backg1.pic');

  vga.erase(0, 0, 319, 199, 0, 0, bg1);
  vga.erase(boxx1, boxy1, boxx2, boxy2, 0, 0, bg0);
  vga.box(boxx1,     boxy1,     boxx2,     boxy2,     24, 4);
  vga.box(boxx1 + 1, boxy1 + 1, boxx2 - 1, boxy2 - 1, 20, 4);
  vga.box(boxx1 + 2, boxy1 + 2, boxx2 - 2, boxy2 - 2, 28, 4);

  for (let n = 0; n < Math.min(MAX_SCORES, scores.length); n++) {
    const nameStr  = scores[n].name;
    const scoreStr = String(scores[n].score);
    const y = 100 + (n - 5) * vga.yfontsize;
    vga.drawtext(50, y, nameStr, 15, 4);
    vga.drawtext(270 - scoreStr.length * vga.xfontsize, y, scoreStr, 15, 4);
  }

  while (input.buttonpressed()) await timing.nextFrame();
  while (input.kbhit()) input.getch();

  // --- Swirling polygon snake animation ---------------------------------
  const x    = new Float32Array(numpoints);
  const y    = new Float32Array(numpoints);
  const oldx = new Float32Array(numpoints);
  const oldy = new Float32Array(numpoints);

  const step = Math.sqrt((chunksize * chunksize) / 2);
  for (let n = 0; n < numpoints; n++) {
    x[n] = 160 + n * step;
    y[n] = 100 + n * step;
  }

  const drawx = new Array(3);
  const drawy = new Array(3);

  let ang = 0;
  let ang2 = 0;
  let doneonce = false;

  while (!input.buttonpressed() && !input.kbhit()) {
    await timing.nextTick();

    oldx[0] = x[0];
    oldy[0] = y[0];

    ang += 0.1;
    if (ang > 2 * Math.PI) ang -= 2 * Math.PI;
    ang2 -= 0.3;
    if (ang2 < 0) ang2 += 2 * Math.PI;

    x[0] = 160 + Math.sin(ang) * (130 + 50 * Math.cos(ang2));
    y[0] = 100 + Math.cos(ang) * (60  + 40 * Math.cos(ang2));

    for (let n = 1; n < numpoints; n++) {
      const dx = x[n] - x[n - 1];
      const dy = y[n] - y[n - 1];
      const dist = Math.sqrt(Math.abs(dx * dx + dy * dy));
      if (dist !== 0) {
        const slope = chunksize / dist;
        oldx[n] = x[n];
        oldy[n] = y[n];
        x[n] = -slope * (x[n - 1] - x[n]) + x[n - 1];
        y[n] = -slope * (y[n - 1] - y[n]) + y[n - 1];
      }
    }

    for (let n = 1; n < numpoints; n++) {
      if (doneonce) {
        // Trailing edges of the previous frame
        drawx[0] = (oldx[n] + (oldy[n - 1] - oldy[n]) / 2) | 0;
        drawy[0] = (oldy[n] - (oldx[n - 1] - oldx[n]) / 2) | 0;
        drawx[1] = (oldx[n] - (oldy[n - 1] - oldy[n]) / 2) | 0;
        drawy[1] = (oldy[n] + (oldx[n - 1] - oldx[n]) / 2) | 0;
        drawx[2] = (oldx[n] + (oldx[n] - oldx[n - 1]) * 6) | 0;
        drawy[2] = (oldy[n] + (oldy[n] - oldy[n - 1]) * 6) | 0;
        vga.polygon(drawx, drawy, 3, -2, 6);   // colour -2 == 254
      }

      drawx[0] = (x[n] + (y[n - 1] - y[n]) / 2) | 0;
      drawy[0] = (y[n] - (x[n - 1] - x[n]) / 2) | 0;
      drawx[1] = (x[n] - (y[n - 1] - y[n]) / 2) | 0;
      drawy[1] = (y[n] + (x[n - 1] - x[n]) / 2) | 0;
      drawx[2] = (x[n] + (x[n] - x[n - 1]) * 6) | 0;
      drawy[2] = (y[n] + (y[n] - y[n - 1]) * 6) | 0;
      vga.polygon(drawx, drawy, 3, 2, 6);
    }
    doneonce = true;
  }

  while (input.kbhit()) input.getch();
  while (input.buttonpressed()) await timing.nextFrame();
}

// ---------------------------------------------------------------------------
// adjust_settings()
// ---------------------------------------------------------------------------
async function adjustSettings() {
  let done = false;
  while (!done) {
    const choice = await ui.menuscreen('Settings',
      ['Game Style', 'Starting Level', 'Main Menu'],
      { background: 'assets/backg3.pic' });

    switch (choice) {
      case 0: {
        toggleFonts();
        const idx = await ui.choose('Please select a playing mode:', [
          { text: 'Normal',       hotkey: 110 /* n */ },
          { text: 'Accelerating', hotkey: 97  /* a */ },
          { text: 'Odd Piece',    hotkey: 111 /* o */ },
        ]);
        game_style = 1 + idx;
        toggleFonts();
        break;
      }
      case 1: {
        const r = await ui.adjust_value('Starting Level:', starting_level, 0, 10);
        starting_level = r.value;
        break;
      }
      default:
        done = true;
    }
  }
}

// ---------------------------------------------------------------------------
// Top-level menu loop
// ---------------------------------------------------------------------------
async function mainMenu() {
  let done = false;
  while (!done) {
    const choice = await ui.menuscreen('Accetris',
      ['Play It', 'High Scores', 'Settings', 'Exit'],
      { background: 'assets/backg2.pic' });

    switch (choice) {
      case 0:
        toggleFonts();            // -> 6x6
        await playTetris(game_style, starting_level);
        await testHighScores();
        toggleFonts();            // -> scrib
        break;
      case 1:
        await showHighScores();
        break;
      case 2:
        await adjustSettings();
        break;
      case 3:
        done = true;
        input.setWantLock(false);
        if (document.pointerLockElement) document.exitPointerLock();
        if (window.history.length > 1) window.history.back();
        else window.location.href = HOME_URL;
        return;
      default:
        done = true;
    }
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function main() {
  const canvas = document.getElementById('screen');
  vga.attachCanvas(canvas);
  input.initInput(canvas);
  timing.startLoop(vga.present);

  // Load fonts: 6x6 goes into `alt`, scrib into `main`.
  // (Mirrors the C's load/toggle/load dance so the swap-on-play works out.)
  fonts.alt  = await assets.loadFont('assets/6x6.blf');
  fonts.main = await assets.loadFont('assets/scrib.blf');
  vga.setFont(fonts.main);

  await loadGamePictures();
  input.setWantLock(true);
  await mainMenu();
  vga.cls();
}

main().catch(err => console.error('Accetris failed to start:', err));
