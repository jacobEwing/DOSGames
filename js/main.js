import * as vga    from '../lib/vga.js';
import * as input  from '../lib/input.js';
import * as timing from '../lib/timing.js';
import { runMenu } from './menu.js';

async function boot() {
  const canvas = document.getElementById('screen');
  vga.attachCanvas(canvas);
  input.initInput(canvas);
  timing.startLoop(vga.present);
}

// A game returning via history.back() restores this page from bfcache.
// The previous runMenu() promise has already resolved, so nothing is
// drawing or polling input.  Re-enter the menu loop.
window.addEventListener('pageshow', (e) => {
  if (e.persisted) runMenu();
});

await boot();
runMenu();
