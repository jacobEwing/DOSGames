// main.js — Blast (DOS Minesweeper) port
import * as vga from 'lib/vga.js';
import * as input from 'lib/input.js';
import * as timing from 'lib/timing.js';
import * as ui from 'lib/ui.js';
import * as assets from 'lib/assets.js';

// ------------- Constants -------------
const maxmenus = 3;
const menubordersize = 2;
const textcolour = 80;
const menucolour = 20;
const shading = 3;
const maxxmapsize = 40;
const maxymapsize = 25;
const centerx = 160, centery = 100;

// ------------- Globals -------------
let nummenus = 0;
const menu = [];                      // menu[n][m] -> string
const menulength = new Int32Array(maxmenus);

let nummines = 100;
let xmapsize = 30, ymapsize = 15;
const xboxsize = 8, yboxsize = 7;

let dead = 0, done = 0, clicked_on_mines = 0;

// Map arrays are [x][y], flattened with stride maxymapsize — matches the
// C's  unsigned char map[40][25].
const XY_SIZE = maxxmapsize * maxymapsize;
const mapArr     = new Uint8Array(XY_SIZE);
const testedArr  = new Uint8Array(XY_SIZE);
const flaggedArr = new Uint8Array(XY_SIZE);
const mi = (x, y) => x * maxymapsize + y;

const mappic = new Array(5).fill(null);
let backg = null;
const startbutton = { x1: 0, y1: 0, x2: 0, y2: 0, pic: null };

// ------------- Helpers -------------
// atoi(): C returns 0 for junk / empty, JS parseInt gives NaN.
function atoi(s) {
  const m = String(s).match(/^\s*([+-]?\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

// ------------- Menu file -------------
async function load_menus(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`load_menus ${url}: ${r.status}`);
  const text = await r.text();
  const lines = text.split(/\r?\n/);
  let pos = 0;
  nummenus = atoi(lines[pos++]);
  for (let n = 0; n < nummenus; n++) {
    menu[n] = [];
    // C's fgets keeps the trailing '\n' on titles (and strlen counts it);
    // add it back so layout matches.
    menu[n][0] = lines[pos++] + '\n';
    menulength[n] = atoi(lines[pos++]);
    for (let m = 1; m <= menulength[n]; m++) menu[n][m] = lines[pos++];
  }
}

function maxmnuarea() {
  let maxarea = 0;
  for (let n = 0; n < nummenus; n++) {
    let maxstr = 0;
    for (let m = 0; m <= menulength[n]; m++) {
      if (menu[n][m].length > maxstr) maxstr = menu[n][m].length;
    }
    const xsize = maxstr * vga.xfontsize + menubordersize * 2;
    const ysize = menulength[n] * vga.yfontsize + menubordersize * 2;
    if (xsize * ysize > maxarea) maxarea = xsize * ysize;
  }
  return maxarea;
}

// ------------- Menu bar -------------
function drawmenus() {
  const ymenusize = vga.yfontsize + menubordersize * 2;
  let xmenusize = menubordersize;
  for (let n = 0; n < nummenus; n++) xmenusize += vga.xfontsize * menu[n][0].length;

  vga.box(0, 0, xmenusize - 1, ymenusize - 1, menucolour, 0);
  vga.box(1, ymenusize - 1, xmenusize - 1, ymenusize - 1, menucolour - shading, 0);
  vga.box(xmenusize - 1, 1, xmenusize - 1, ymenusize - 1, menucolour - shading, 0);
  vga.box(0, 0, xmenusize - 1, 0, menucolour + shading, 4);
  vga.box(0, 0, 0, ymenusize - 1, menucolour + shading, 4);

  let x = menubordersize;
  const y = ymenusize;
  for (let n = 0; n < nummenus; n++) {
    vga.box(x - (vga.xfontsize >> 1) + 1, 0,
            x - (vga.xfontsize >> 1) + 1, y - 1, menucolour + shading, 0);
    vga.drawtext(x, menubordersize, menu[n][0], textcolour, 4);
    vga.box(x - (vga.xfontsize >> 1), 0,
            x - (vga.xfontsize >> 1), y - 1, menucolour - shading, 0);
    x += vga.xfontsize * menu[n][0].length;
  }
}

function current_menu(mx, my) {
  const ymenusize = vga.yfontsize + menubordersize * 2;
  let xmenusize = menubordersize;
  let ret = 0;
  if (my < ymenusize) {
    for (let n = 0; n < nummenus; n++) {
      xmenusize += vga.xfontsize * menu[n][0].length;
      if ((xmenusize - (vga.xfontsize >> 1)) < mx) ret++;
    }
    if (ret === nummenus) ret = -1;
  } else ret = -1;
  return ret;
}

function on_open_menu(mx, my, menux, menuy, menuxsize, menuysize) {
  return (mx >= menux && mx < menux + menuxsize &&
          my >= menuy && my < menuy + menuysize) ? 1 : 0;
}

function current_option(my, menuy, length) {
  let n = 0;
  let y = menuy + 2;
  while (n <= length && y < my) { y += vga.yfontsize; n++; }
  if (n > length || n === 0) return 0;
  return n;
}

function open_menu(cm, undermenu) {
  let xsize = 0;
  for (let n = 1; n <= menulength[cm]; n++)
    if (menu[cm][n].length > xsize) xsize = menu[cm][n].length;
  xsize *= vga.xfontsize;
  xsize += menubordersize * 2;
  const ysize = menulength[cm] * vga.yfontsize + menubordersize * 2;

  let menux = vga.xfontsize >> 1;
  for (let n = 0; n < cm; n++) menux += vga.xfontsize * menu[n][0].length;
  const menuy = vga.yfontsize;

  vga.get(menux, menuy, menux + xsize - 1, menuy + ysize - 1, undermenu);
  vga.box(menux, menuy, menux + xsize - 1, menuy + ysize - 1, 0, 0);

  let x = menux + menubordersize;
  let y = menuy + menubordersize;
  for (let n = 1; n <= menulength[cm]; n++) {
    vga.drawtext(x, y, menu[cm][n], textcolour, 4);
    y += vga.yfontsize;
  }

  vga.box(menux, menuy, menux, menuy + ysize - 1, menucolour + shading, 0);
  vga.box(menux, menuy, menux + xsize - 1, menuy, menucolour + shading, 0);
  vga.box(menux + xsize - 1, menuy, menux + xsize - 1, menuy + ysize - 1, menucolour - shading, 0);
  vga.box(menux, menuy + ysize - 1, menux + xsize - 1, menuy + ysize - 1, menucolour - shading, 0);
  vga.box(menux, menuy, menux + xsize - 1, menuy + ysize - 1, menucolour, 5);

  return { x: menux, y: menuy };
}

function close_menu(undermenu, menux, menuy) {
  vga.put(menux, menuy, undermenu, 0);
}

// ------------- Map -------------
function initialize_map() {
  clicked_on_mines = 0;
  for (let x = 0; x < xmapsize; x++) {
    for (let y = 0; y < ymapsize; y++) {
      mapArr[mi(x, y)] = 0;
      testedArr[mi(x, y)] = 0;
      flaggedArr[mi(x, y)] = 0;
    }
  }
}

function add_mines(tx, ty) {
  for (let n = 0; n < nummines; n++) {
    let x, y;
    do {
      x = (Math.random() * xmapsize) | 0;
      y = (Math.random() * ymapsize) | 0;
    } while (mapArr[mi(x, y)] !== 0 || (Math.abs(x - tx) < 2 && Math.abs(y - ty) < 2));
    mapArr[mi(x, y)] = 1;
  }
}

function draw_map() {
  const zerox = centerx - (((xboxsize * xmapsize) / 2) | 0);
  const zeroy = centery - (((yboxsize * ymapsize) / 2) | 0);
  let drawy = zeroy;
  for (let y = 0; y < ymapsize; y++) {
    let drawx = zerox;
    for (let x = 0; x < xmapsize; x++) {
      vga.put(drawx, drawy, mappic[0], 0);
      drawx += xboxsize;
    }
    drawy += yboxsize;
  }
}

function erase_map() {
  const zerox = centerx - (((xboxsize * xmapsize) / 2) | 0);
  const zeroy = centery - (((yboxsize * ymapsize) / 2) | 0);
  vga.erase(zerox, zeroy,
            zerox + xmapsize * xboxsize,
            zeroy + ymapsize * yboxsize, 0, 0, backg);
}

function num_adjacent_mines(cx, cy) {
  let total = 0;
  for (let x = cx - 1; x <= cx + 1; x++) {
    for (let y = cy - 1; y <= cy + 1; y++) {
      if ((x !== cx || y !== cy)
        && x >= 0 && x < xmapsize && y >= 0 && y < ymapsize
        && mapArr[mi(x, y)] !== 0) total++;
    }
  }
  return total;
}

function drawboxval(x, y, number) {
  if (number > 0) {
    x += xboxsize >> 1;
    y += yboxsize >> 1;
    x -= vga.xfontsize >> 1;
    y -= vga.yfontsize >> 1;
    // Colour IS the number (1..8 map to palette entries) — matches C.
    vga.drawtext(x, y, String(number), number, 4);
  }
}

function test_spot(x, y) {
  const zerox = centerx - (((xboxsize * xmapsize) / 2) | 0);
  const zeroy = centery - (((yboxsize * ymapsize) / 2) | 0);
  testedArr[mi(x, y)] = 1;

  if (mapArr[mi(x, y)]) return 1;

  const adjmines = num_adjacent_mines(x, y);
  if (adjmines === 0) test_adjacent_spaces(x, y);
  vga.put(zerox + xboxsize * x, zeroy + yboxsize * y, mappic[2], 0);
  drawboxval(zerox + xboxsize * x, zeroy + yboxsize * y, adjmines);
  return 0;
}

function test_adjacent_spaces(cx, cy) {
  const zerox = centerx - (((xboxsize * xmapsize) / 2) | 0);
  const zeroy = centery - (((yboxsize * ymapsize) / 2) | 0);
  for (let x = cx - 1; x <= cx + 1; x++) {
    for (let y = cy - 1; y <= cy + 1; y++) {
      if (x >= 0 && x < xmapsize && y >= 0 && y < ymapsize
        && !testedArr[mi(x, y)] && !flaggedArr[mi(x, y)]) {
        testedArr[mi(x, y)] = 1;
        const adjmines = num_adjacent_mines(x, y);
        if (mapArr[mi(x, y)]) {
          vga.put(zerox + xboxsize * x, zeroy + yboxsize * y, mappic[3], 0);
          dead = 1;
        } else {
          vga.put(zerox + xboxsize * x, zeroy + yboxsize * y, mappic[2], 0);
        }
        if (adjmines !== 0) {
          drawboxval(zerox + xboxsize * x, zeroy + yboxsize * y, adjmines);
        } else {
          test_adjacent_spaces(x, y);
        }
      }
    }
  }
}

function flag_spot(x, y) {
  if (x < 0 || x >= xmapsize || y < 0 || y >= ymapsize) return;
  if (testedArr[mi(x, y)]) return;
  const zerox = centerx - (((xboxsize * xmapsize) / 2) | 0);
  const zeroy = centery - (((yboxsize * ymapsize) / 2) | 0);
  flaggedArr[mi(x, y)] = 1 - flaggedArr[mi(x, y)];
  vga.put(zerox + xboxsize * x, zeroy + yboxsize * y,
          flaggedArr[mi(x, y)] ? mappic[1] : mappic[0], 0);
}

async function showbombs() {
  const zerox = centerx - (((xboxsize * xmapsize) / 2) | 0);
  const zeroy = centery - (((yboxsize * ymapsize) / 2) | 0);
  while (input.kbhit()) input.getch();
  for (let x = 0; x < xmapsize; x++) {
    const rx = zerox + x * xboxsize;
    for (let y = 0; y < ymapsize; y++) {
      const ry = zeroy + y * yboxsize;
      if (mapArr[mi(x, y)] && !flaggedArr[mi(x, y)])         vga.put(rx, ry, mappic[3], 0);
      else if (!mapArr[mi(x, y)] && flaggedArr[mi(x, y)])    vga.put(rx, ry, mappic[4], 0);
    }
  }
  while (!input.kbhit() && !input.buttonpressed()) await timing.nextFrame();
}

async function click_surrounding_spots(x, y) {
  if (testedArr[mi(x, y)]) {
    let n = 0;
    for (let a = -1; a <= 1; a++) {
      for (let b = -1; b <= 1; b++) {
        if (b !== 0 || a !== 0) {
          if (a + x >= 0 && a + x < xmapsize && b + y >= 0 && b + y < ymapsize)
            n += flaggedArr[mi(a + x, b + y)];
        }
      }
    }
    if (n === num_adjacent_mines(x, y)) {
      for (let a = -1; a <= 1; a++) {
        for (let b = -1; b <= 1; b++) {
          if (a + x >= 0 && a + x < xmapsize && b + y >= 0 && b + y < ymapsize
            && !flaggedArr[mi(a + x, b + y)]) {
            if (test_spot(a + x, b + y)) dead = 1;
          }
        }
      }
    }
  }
  if (dead) await showbombs();
}

// realx/realy mirror the C exactly, including its quirk that exact negative
// integers shift an extra cell (if (a < 0) a--; then (int) truncation).
function realx() {
  const zerox = centerx - (xboxsize * xmapsize) / 2;
  let a = (input.mousex() - zerox) / xboxsize;
  if (a < 0) a -= 1;
  return Math.trunc(a);
}
function realy() {
  const zeroy = centery - (yboxsize * ymapsize) / 2;
  let a = (input.mousey() - zeroy) / yboxsize;
  if (a < 0) a -= 1;
  return Math.trunc(a);
}

// ------------- Start button -------------
function startbutton_draw() { vga.put(startbutton.x1, startbutton.y1, startbutton.pic, 0); }
function startbutton_touching(x, y) {
  return x >= startbutton.x1 && x <= startbutton.x2 &&
         y >= startbutton.y1 && y <= startbutton.y2;
}

async function handle_startbutton_press() {
  let mx = input.mousex(), my = input.mousey();
  while (input.buttonmask() === 1) {
    if (startbutton_touching(input.mousex(), input.mousey())) {
      vga.erase(startbutton.x1, startbutton.y1, startbutton.x2, startbutton.y2, 0, 0, backg);
      vga.scaleput(startbutton.x1 + 3, startbutton.y1 + 1, 1.1, 1.2, startbutton.pic, 0);
      while (startbutton_touching(input.mousex(), input.mousey()) && input.buttonmask() === 1)
        await timing.nextFrame();
      startbutton_draw();
    }
    mx = input.mousex(); my = input.mousey();
    await timing.nextFrame();
  }
  if (startbutton_touching(mx, my)) {
    initialize_map();
    draw_map();
    dead = 0;
  }
}

// ------------- Board click -------------
async function handle_board_click() {
  // C: bp = 0; while(buttonpressed()) { a = buttonpressed(); if(a > bp) bp = a; }
  // buttonpressed() here is a boolean; buttonmask() gives the actual bitmask.
  let bp = 0;
  while (input.buttonpressed()) {
    const a = input.buttonmask();
    if (a > bp) bp = a;
    await timing.nextFrame();
  }
  const rx = realx(), ry = realy();
  if (rx < 0 || rx >= xmapsize || ry < 0 || ry >= ymapsize) return;
  switch (bp) {
    case 1:
      if (!flaggedArr[mi(rx, ry)]) {
        if (!clicked_on_mines) { clicked_on_mines = 1; add_mines(rx, ry); }
        if (test_spot(rx, ry)) { dead = 1; await showbombs(); }
      }
      break;
    case 2:
      flag_spot(rx, ry);
      break;
    case 3:
    case 4:
      await click_surrounding_spots(rx, ry);
      break;
  }
}

// ------------- Menu option -------------
async function handle_option(menunumber, optionnumber) {
  const opt = menu[menunumber][optionnumber];
  if (opt === "Exit") {
    if (document.pointerLockElement) document.exitPointerLock();
    if (window.history.length > 1) window.history.back();
    else window.location.href = HOME_URL;
  } else if (opt === "New game") {
    initialize_map();
    draw_map();
    dead = 0;
  } else {
    erase_map();
    if (opt === "Beginner")            { xmapsize = 8;  ymapsize = 12; nummines = 15;  }
    else if (opt === "Intermediate")   { xmapsize = 15; ymapsize = 15; nummines = 45;  }
    else if (opt === "Expert")         { xmapsize = 30; ymapsize = 15; nummines = 100; }
    else if (opt === "Custom") {
      const r1 = await ui.taketext("How wide do you want the map? (max. 40)",
                                   [{ text: "Okay", hotkey: 13 }]);
      let newxsize = atoi(r1.text);
      const r2 = await ui.taketext("How tall do you want the map? (max, 25)",
                                   [{ text: "Okay", hotkey: 13 }]);
      let newysize = atoi(r2.text);
      if (newxsize > maxxmapsize) newxsize = maxxmapsize;
      if (newysize > maxymapsize) newysize = maxymapsize;
      if (newxsize < 5) newxsize = 1;   // intentional, matches original
      if (newysize < 5) newysize = 1;
      xmapsize = newxsize;
      ymapsize = newysize;
      const maxmines = (xmapsize * ymapsize / 2) | 0;
      const prompt = "How many mines? (min 1, max " + maxmines + ")";
      const r3 = await ui.taketext(prompt, [{ text: "Okay", hotkey: 13 }]);
      nummines = atoi(r3.text);
      if (nummines < 1) nummines = 1;
      if (nummines > maxmines) nummines = maxmines;
    }
    initialize_map();
    draw_map();
    dead = 0;
  }
}

// ------------- Main loop -------------
async function handle_menu_IO() {
  let menu_open = -1;
  let menux = 0, menuy = 0;

  await load_menus('assets/blast.mnu');
  const undermenu = new Uint8Array(maxmnuarea() + 2);

  drawmenus();
  initialize_map();
  draw_map();
  startbutton_draw();

  while (!done) {
    const mx = input.mousex(), my = input.mousey();
    if (input.buttonpressed()) {
      if (menu_open !== -1 && on_open_menu(mx, my, menux, menuy, undermenu[0], undermenu[1])) {
        const copt = current_option(my, menuy, menulength[menu_open]);
        const mop = menu_open;
        close_menu(undermenu, menux, menuy);
        menu_open = -1;
        await handle_option(mop, copt);
        while (input.buttonpressed()) await timing.nextFrame();
      } else {
        const cm = current_menu(mx, my);
        if (cm === -1) {
          if (menu_open !== -1) {
            close_menu(undermenu, menux, menuy);
            menu_open = -1;
          } else if (startbutton_touching(mx, my) && input.buttonmask() === 1) {
            await handle_startbutton_press();
          } else if (realx() >= 0 && realx() < xmapsize
                  && realy() >= 0 && realy() < ymapsize && !dead) {
            await handle_board_click();
          }
        } else if (cm !== menu_open) {
          if (menu_open !== -1) {
            close_menu(undermenu, menux, menuy);
            menu_open = -1;
          }
          const pos = open_menu(cm, undermenu);
          menux = pos.x; menuy = pos.y;
          menu_open = cm;
          while (input.buttonpressed()) await timing.nextFrame();
        }
      }
    }
    await timing.nextFrame();
  }
}

// ------------- Entry point -------------
async function main() {
  const canvas = document.getElementById('screen');
  vga.attachCanvas(canvas);
  input.initInput(canvas, window);

  // The DOS version relied on the hardware mouse cursor; show the OS one.
  canvas.style.cursor = 'crosshair';

  // ui.taketext needs a ScreenPointer, but this game has no pointer.pic.
  // Supply a 1x1 transparent pic via a data URL (fetch handles data:).
  ui.setPointerUrl('data:application/octet-stream;base64,AQEA');

  await assets.setFontFrom('assets/6x6.blf');

  backg      = await assets.loadPic('assets/backg.pic');
  mappic[0]  = await assets.loadPic('assets/untested.pic');
  mappic[1]  = await assets.loadPic('assets/flagged.pic');
  mappic[2]  = await assets.loadPic('assets/empty.pic');
  mappic[3]  = await assets.loadPic('assets/hasbomb.pic');
  mappic[4]  = await assets.loadPic('assets/wrong.pic');

  startbutton.pic = await assets.loadPic('assets/startbtn.pic');
  startbutton.x1  = 160 - (startbutton.pic[0] >> 1);
  startbutton.y1  = 0;
  startbutton.x2  = startbutton.x1 + startbutton.pic[0] - 1;
  startbutton.y2  = startbutton.y1 + startbutton.pic[1] - 1;

  vga.erase(0, 0, 319, 199, 0, 0, backg);
  vga.drawtext(160 - 13 * vga.xfontsize,
               (199 - 1.5 * vga.yfontsize) | 0,
               "Copyright 1998 Jacob Ewing", 14, 4);

  timing.startLoop(vga.present);
  await handle_menu_IO();
}

main().catch(e => console.error(e));
