import * as vga    from '../lib/vga.js';
import * as assets from '../lib/assets.js';
import * as ui     from '../lib/ui.js';

// Buttons left-to-right.  `dir: null` means "Exit".
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

export async function runMenu() {
  await assets.setFontFrom('assets/11x12.blf');

  const backg = await assets.loadPic('assets/undermnu.pic');

  // Warped background (matches the DOS build closely).
  for (let y = 0; y < 200; y++) {
    vga.roterase(0, y, 319, y, 160, 100, y / 30, 2, backg);
  }

  const buttons = await Promise.all(GAMES.map(g => assets.loadPic(g.pic)));

  // 2-pixel gap so seven 40px buttons + grey box fit in 320.
  const idx = await ui.choice(TITLE, buttons, 2);
  const pick = GAMES[idx];

  if (pick.dir) {
    window.location.href = pick.dir;
    return;
  }

  // exit menu - just go back in the history
  if (window.history.length > 1) window.history.back();
  else window.location.href = HOME_URL;

}
