import * as vga    from '../lib/vga.js';
import * as assets from '../lib/assets.js';
import * as ui     from '../lib/ui.js';

const GAMES = [
  { pic: 'assets/hexodus.pic',  dir: './hexodus/'    },
  { pic: 'assets/arkann.pic',   dir: './arkann/'     },
  { pic: 'assets/invaders.pic', dir: './invaders/'   },
  { pic: 'assets/mmind.pic',    dir: './mastermind/' },
  { pic: 'assets/accetris.pic', dir: './accetris/'   },
  { pic: 'assets/blast.pic',    dir: './blast/'      },
  { pic: 'assets/exit.pic',     dir: null            },
];

const TITLE = "Jacob's Games";

// Brief history, drawn below the menu box in the 4x6 font.
const ABOUT_LINES = [
  'This is a faithful restoration of a game collection I wrote',
  'as as a young man in the mid 1990\'s. Orginially written',
  'in C using my own custom MCGA graphics library, it has been',
  'ported to the web for my reminiscense and your enjoyment.',
  'all assets used are the original files, and the JavaScript',
  'somewhat accurately reflects my coding at the time.'
];

let fontLarge = null;
let fontSmall = null;
let buttons   = null;
let backg     = null;

export async function runMenu() {
  // One-time loads (cached after first call).
  if (!fontLarge) fontLarge = await assets.loadFont('assets/11x12.blf');
  if (!fontSmall) fontSmall = await assets.loadFont('assets/tidy.blf');
  if (!backg)     backg     = await assets.loadPic('assets/undermnu.pic');
  if (!buttons)   buttons   = await Promise.all(GAMES.map(g => assets.loadPic(g.pic)));

  // Warped background.
  for (let y = 0; y < 200; y++) {
    vga.roterase(0, y, 319, y, 160, 100, y / 30, 2 + y / 100, backg);
  }

  // About blurb, drawn before ui.choice so the menu box sits on top of it.
  vga.setFont(fontSmall);
  let fy = 4;
  for (const line of ABOUT_LINES) {
    const fx = (161 - (vga.xfontsize * line.length) / 2) | 0;
    vga.drawtext(fx, fy, line, 0, 4);
    fy += vga.yfontsize + 2;
  }
  fy = 3;
  for (const line of ABOUT_LINES) {
    const fx = (160 - (vga.xfontsize * line.length) / 2) | 0;
    vga.drawtext(fx, fy, line, 15, 4);
    fy += vga.yfontsize + 2;
  }

  // Menu — restore the large font for the title and labels.
  vga.setFont(fontLarge);
  const idx  = await ui.choice(TITLE, buttons, 2);
  const pick = GAMES[idx];

  if (pick.dir) {
    window.location.href = pick.dir;
    return;
  }

  // exit menu - just go back in the history
  if (window.history.length > 1) window.history.back();
  else window.location.href = HOME_URL;
}
