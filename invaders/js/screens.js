// screens.js — menu, high scores, credits, help, settings.
import * as vga from 'lib/vga.js';
import * as input from 'lib/input.js';
import * as timing from 'lib/timing.js';
import { loadPic, setFontFrom } from 'lib/assets.js';
import { pics, loadMenuAliens } from './assets.js';
import { loadScores, saveScores } from './hscr.js';
import { drawalien } from './draw.js';

const url = (name) => new URL('../assets/' + name, import.meta.url).href;

// =============================================================================
// boolean_choice — Yes/No modal.  Returns 1 (yes) or 0 (no).
// =============================================================================
export async function booleanChoice(text, c1, c2) {
  const x = (160 - (vga.xfontsize * text.length) / 2) | 0;
  vga.box(x - 2, 93, x + vga.xfontsize * text.length, 93 + vga.yfontsize + 4, 0, 0);
  vga.box(x - 2, 93, x + vga.xfontsize * text.length, 93 + vga.yfontsize + 4, 15, 4);
  vga.drawtext(x, 95, text, 15, 0);
  while (true) {
    if (!input.kbhit()) { await timing.nextFrame(); continue; }
    const k = input.getch();
    const ch = k >= 32 ? String.fromCharCode(k) : '';
    if (k === 13 || ch === c1.toUpperCase() || ch === c1.toLowerCase()) return 1;
    if (k === 27 || ch === c2.toUpperCase() || ch === c2.toLowerCase()) return 0;
  }
}

// =============================================================================
// promptName — the game's own taketext (renamed to avoid clashing with
// lib/ui.js).  Returns a string, or null on ESC.
// =============================================================================
export async function promptName(quote, length) {
  const quotex = (160 - (vga.xfontsize * quote.length) / 2) | 0;
  const quotey = 80;
  const boxx = quotex - 4, boxy = quotey - 4;
  const textx1 = quotex, texty1 = quotey + vga.yfontsize + 5;
  const xboxsize = quote.length * vga.xfontsize + 4;
  const yboxsize = 4 * vga.yfontsize + 8;
  vga.box(boxx, boxy, boxx + xboxsize, boxy + yboxsize, 0, 0);
  vga.box(boxx, boxy, boxx + xboxsize, boxy + yboxsize, 15, 4);
  vga.drawtext(quotex, quotey, quote, 15, 0);

  let drawx = textx1;
  let text = '';
  while (input.kbhit()) input.getch();   // drain
  while (true) {
    if (!input.kbhit()) { await timing.nextFrame(); continue; }
    const k = input.getch();
    if (k === 13) return text;
    if (k === 27) return null;
    if (k === 8) {
      if (text.length > 0) {
        text = text.slice(0, -1);
        drawx -= vga.xfontsize;
        vga.drawtext(drawx, texty1, ' ', 15, 0);
      }
    } else if (k >= 32 && k <= 126) {
      if (text.length < 255 && text.length < length - 2) {
        const ch = String.fromCharCode(k);
        text += ch;
        vga.drawtext(drawx, texty1, ch, 15, 0);
        drawx += vga.xfontsize;
      }
    }
  }
}

// =============================================================================
// mainmenu — animated title screen.  Returns 0..5.
// =============================================================================
export async function mainMenu() {
  await loadMenuAliens();
  const pointer = await loadPic(url('pointer.pic'));
  const backg   = await loadPic(url('undermnu.pic'));
  vga.erase(0, 0, 320, 200, 0, 0, backg);

  // Drop letters I-N-V-A-D-E-R-S into place.
  let lx = 160 - 4 * (pics.letters[0][0] + 5);
  for (let n = 0; n < 8; n++) {
    for (let dy = -pics.letters[n][1]; dy <= 10; dy += 10) {
      vga.put(lx, dy, pics.letters[n], 4);
      await timing.nextFrame();
      vga.eraseshape(lx, dy, 0, 0, pics.letters[n], backg, 2);
    }
    vga.put(lx, 20, pics.letters[n], 4);
    lx += pics.letters[n][0] + 5;
  }
  vga.drawtext(20, 16, 'Attack of the Mutant', 15, 4);
  vga.drawtext(200, 50, 'From Mars!', 15, 4);

  const buttons = await Promise.all(
    Array.from({length: 6}, (_, i) => loadPic(url(`button${i+1}.pic`))));
  const spacing = 20;
  const minBX = (160 - ((3 * buttons[0][0] + 2 * spacing + spacing) / 2)) | 0;
  const minBY = (140 - ((2 * buttons[0][1] + 1 * spacing) / 2)) | 0;
  const bx = new Int32Array(6), by = new Int32Array(6);
  for (let n = 0; n < 6; n++) {
    bx[n] = minBX + (n % 3) * (buttons[0][0] + spacing);
    by[n] = minBY + ((n / 3) | 0) * (buttons[0][1] + spacing);
    vga.put(bx[n], by[n], buttons[n], 0);
  }

  let mx = input.mousex(), my = input.mousey();
  const under = new Uint8Array(2 + pointer[0] * pointer[1]);
  vga.get(mx, my, mx + pointer[0] - 1, my + pointer[1] - 1, under);
  vga.put(mx, my, pointer, 4);

  let ax = 0, ay = 60, picnum = 1, picnumi = 1;
  let dt = timing.counter();
  let returnval = -1;
  while (returnval === -1) {
    // Drifting aliens.
    for (let n = 0; n < 11; n++) {
      const oldX = (((ax - 1 + 32 * n) % 352) + 352) % 352 - 32;
      const newX = (((ax + 32 * n) % 352) + 352) % 352 - 32;
      const ey = ay + 5 * (n % 2);
      vga.eraseshape(oldX, ey, 0, 0, pics.alien[picnum - picnumi], backg, 2);
      drawalien(newX, ey, pics.alien[picnum], 0);
    }
    ax = (ax + 1) % 352;
    if (picnum >= 3) picnumi = -1;
    if (picnum <= 0) picnumi = 1;
    picnum += picnumi;

    const nmx = input.mousex(), nmy = input.mousey();
    if (nmx !== mx || nmy !== my) {
      vga.put(mx, my, under, 0);
      mx = nmx; my = nmy;
      vga.get(mx, my, mx + pointer[0] - 1, my + pointer[1] - 1, under);
      vga.put(mx, my, pointer, 4);
    }

    if (input.kbhit()) { returnval = 5; break; }

    if (input.buttonpressed()) {
      while (input.buttonpressed()) await timing.nextFrame();
      for (let n = 0; n < 6; n++) {
        // Faithful to the C: uses buttons[n][0] (width) for the height check.
        // Given the 20-px row spacing this means the hit zone slightly
        // overlaps the row below; first match wins.
        if (mx >= bx[n] && my >= by[n] &&
            mx < bx[n] + buttons[n][0] &&
            my < by[n] + buttons[n][0]) {
          returnval = n; break;
        }
      }
    }

    const t = timing.counter();
    while (timing.counter() === t) await timing.nextFrame();
    dt = t;
  }

  vga.cls();
  return returnval;
}

// =============================================================================
// show_high_scores — score table plus a floating-pixel backdrop.
// =============================================================================
export async function showHighScores() {
  const backg = await loadPic(url('underhsc.pic'));
  vga.cls();
  const x1 = 40, x2 = 280;
  const y1 = (100 - 5 * vga.yfontsize - 10) | 0;
  const y2 = (100 + 5 * vga.yfontsize + 10) | 0;
  vga.erase(x1, y1, x2, y2, 0, 0, backg);
  vga.box(x1, y1, x2, y2, 24, 4);
  vga.box(x1 + 1, y1 + 1, x2 - 1, y2 - 1, 20, 4);
  vga.box(x1 + 2, y1 + 2, x2 - 2, y2 - 2, 28, 4);

  const scores = loadScores();
  for (let n = 0; n < scores.length && n < 10; n++) {
    const { name, score } = scores[n];
    vga.drawtext(50, 100 + (n - 5) * vga.yfontsize, name, 15, 4);
    const s = String(score);
    vga.drawtext(270 - s.length * vga.xfontsize,
                 100 + (n - 5) * vga.yfontsize, s, 15, 4);
  }

  const N = 100;
  const dx = new Int32Array(N), dy = new Int32Array(N), dz = new Int32Array(N);
  for (let n = 0; n < N; n++) {
    dx[n] = (Math.random() * 320) | 0;
    dy[n] = (Math.random() * 200) | 0;
    dz[n] = ((Math.random() * 15) | 0) + 17;
  }
  while (!(input.kbhit() || input.buttonpressed())) {
    for (let n = 0; n < N; n++) {
      if (dx[n] < x1 || dx[n] > x2 || dy[n] < y1 || dy[n] > y2)
        vga.putpixel(dx[n], dy[n], 0, 0);
      dx[n] = (dx[n] + 3) % 320;
      dy[n] += (((dx[n] - 160) * (dx[n] - 160)) / 800) | 0;
      if (dy[n] < 0) dy[n] += 200;
      if (dy[n] > 199) dy[n] %= 200;
      if (dx[n] < x1 || dx[n] > x2 || dy[n] < y1 || dy[n] > y2)
        vga.putpixel(dx[n], dy[n], dz[n], 0);
    }
    await timing.nextTick();
  }
  while (input.kbhit()) input.getch();
}

// =============================================================================
// test_high_scores — check if the score qualifies, prompt for name, save.
// =============================================================================
export async function testHighScores(score) {
  const scores = loadScores();
  let rank = -1;
  for (let i = 0; i < scores.length; i++) {
    if (scores[i].score < score) { rank = i; break; }
  }
  if (rank === -1 && scores.length < 10) rank = scores.length;
  if (rank === -1) return;

  const name = (await promptName('What is Your Name?', 20)) || '';
  const next = scores.slice();
  next.splice(rank, 0, { name, score });
  saveScores(next.slice(0, 10));
  await showHighScores();
}

// =============================================================================
// show_credits — scrolling credits.
// =============================================================================
export async function showCredits() {
  const spacing = 40;
  const credit = [
    'Programming:  Jacob Ewing',
    'Design:  Jacob Ewing',
    'Special Effects:  Jacob Ewing',
    'Character Design:  Jacob Ewing',
    'Writing:  Jacob Ewing',
    'Testing:  Jacob Ewing',
    'Debugging:  Jacob Ewing',
    'Special Thanks to:  Jacob Ewing',
  ];
  const numcredits = credit.length;
  const cx = new Int32Array(numcredits), cy = new Int32Array(numcredits);
  for (let n = 0; n < numcredits; n++) {
    cx[n] = (160 - credit[n].length * vga.xfontsize / 2) | 0;
    cy[n] = 200 + n * spacing;
  }
  const backg = await loadPic(url('undercrd.pic'));
  vga.erase(0, 0, 320, 200, 0, 0, backg);

  while (!(input.kbhit() || input.buttonpressed())) {
    for (let n = 0; n < numcredits; n++) {
      if (cy[n] < 200)
        vga.erase(cx[n], cy[n], cx[n] + credit[n].length * vga.xfontsize - 1,
                  cy[n] + vga.yfontsize - 1, 0, 0, backg);
      cy[n] -= 1;
      if (cy[n] < -vga.yfontsize) {
        cy[n] = (n === 0 ? cy[numcredits - 1] : cy[n - 1]) + spacing;
      }
      if (cy[n] < 200)
        vga.drawtext(cx[n], cy[n], credit[n], 15, 4);
    }
    await timing.nextFrame();
  }
  while (input.kbhit()) input.getch();
}

// =============================================================================
// explain_game — paginated help.
// =============================================================================
export async function explainGame() {
  const backg    = await loadPic(url('underhlp.pic'));
  const pointer  = await loadPic(url('pointer.pic'));
  const leftPic  = await loadPic(url('left.pic'));
  const rightPic = await loadPic(url('right.pic'));
  const donePic  = await loadPic(url('done.pic'));
  const buttons = [
    { pic: leftPic,  x: 0, y: 0 },
    { pic: rightPic, x: 0, y: 0 },
    { pic: donePic,  x: 0, y: 0 },
  ];
  const done = buttons[2];
  done.x = 160 - (done.pic[0] / 2 | 0);
  done.y = 199 - done.pic[1];
  buttons[0].x = done.x - buttons[0].pic[0] - 2;
  buttons[0].y = 199 - buttons[0].pic[1];
  buttons[1].x = done.x + done.pic[0] + 2;
  buttons[1].y = 199 - buttons[1].pic[1];

  vga.erase(0, 0, 320, 200, 0, 0, backg);
  for (const b of buttons) vga.put(b.x, b.y, b.pic, 0);
  vga.drawtext((160 - 10.5 * vga.xfontsize) | 0, 10, 'How to Play Invaders:', 15, 4);
  await setFontFrom(url('6x6.blf'));

  let mx = input.mousex(), my = input.mousey();
  const under = new Uint8Array(2 + pointer[0] * pointer[1]);
  vga.get(mx, my, mx + pointer[0] - 1, my + pointer[1] - 1, under);

  const pages = [
    { pic: 'title.pic', text: [
      'This is a modern rendition of a classic game.',
      'The object of the game is quite simple: You are',
      'being attacked by a large array of aliens, and',
      'must destroy them before they destroy you.' ] },
    { pic: 'ship1.pic', text: [
      'This is the spaceship that you will be flying in.',
      'It is loaded with fireball cannons that you can',
      'shoot the aliens with.  Occasionally, when you',
      'shoot an alien, it will drop a packet it was',
      'carrying that contains one of many devices that',
      'you can use.  This includes such thigs as shields,',
      'high power guns, spreadfire cannons, and more.',
      'You can always see an alien that carries a packet,',
      'because some part of it\'s body will be glowing',
      'green - Wheras the other aliens will glow red.' ] },
    { pic: 'alien2a.pic', text: [
      'This is one of the many aliens that will attack',
      'you.  They fly in fleets, maintaining battle',
      'formation.  However, some will occasionally swoop',
      'down and attack you.  They also bear weapons which',
      'are not as strong as yours, but will damage your',
      'ship if you are shot.' ] },
    { pic: 'alien10a.pic', text: [
      'Every time you\'ve beaten four fleets of aliens,',
      'you will be confronted by a boss alien, such as',
      'this one.  They are considerably stronger than the',
      'others, and can launch attack vessels of their',
      'own.' ] },
  ];
  const numoptions = pages.length;
  const picy = 60;
  let optionnum = 0;

  while (true) {
    const page = pages[optionnum];
    const picture = await loadPic(url(page.pic));
    const text = page.text;
    const numlines = text.length;

    const bx1 = 160 - (picture[0] / 2 | 0) - 5;
    const bx2 = 160 + (picture[0] / 2 | 0) + 5;
    const by1 = picy - (picture[1] / 2 | 0) - 5;
    const by2 = picy + (picture[1] / 2 | 0) + 5;
    vga.put(160 - (picture[0] / 2 | 0), picy - (picture[1] / 2 | 0), picture, 4);

    const ty1 = by2 + 10;
    const ty2 = (ty1 + (numlines + 1) * 1.5 * vga.yfontsize) | 0;
    let tx1 = 160, tx2 = 160;
    let y = (ty1 + vga.yfontsize / 2) | 0;
    for (let n = 0; n < numlines; n++) {
      const x = 160 - ((vga.xfontsize * text[n].length / 2) | 0);
      vga.drawtext(x, y, text[n], 15, 4);
      if (x < tx1) { tx1 = x; tx2 = x + vga.xfontsize * text[n].length; }
      y += (1.5 * vga.yfontsize) | 0;
    }

    mx = input.mousex(); my = input.mousey();
    vga.get(mx, my, mx + pointer[0] - 1, my + pointer[1] - 1, under);
    vga.put(mx, my, pointer, 4);

    let hit = 0;
    while (!input.kbhit() && !hit) {
      if (mx !== input.mousex() || my !== input.mousey()) {
        vga.put(mx, my, under, 0);
        mx = input.mousex(); my = input.mousey();
        vga.get(mx, my, mx + pointer[0] - 1, my + pointer[1] - 1, under);
        vga.put(mx, my, pointer, 4);
      }
      if (input.buttonpressed()) {
        for (let n = 0; n < 3; n++) {
          const b = buttons[n];
          if (mx >= b.x && mx <= b.x + b.pic[0] - 1 &&
              my >= b.y && my <= b.y + b.pic[1] - 1) {
            if ((n !== 0 || optionnum > 0) &&
                (n !== 1 || optionnum < numoptions - 1)) hit = n + 1;
          }
        }
        while (input.buttonpressed()) await timing.nextFrame();
      }
      await timing.nextFrame();
    }

    vga.put(mx, my, under, 0);
    vga.erase(tx1, ty1, tx2, ty2, 0, 0, backg);
    vga.erase(bx1, by1, bx2, by2, 0, 0, backg);

    if (hit === 1 && optionnum > 0) optionnum--;
    else if (hit === 2 && optionnum < numoptions - 1) optionnum++;
    else if (hit === 3) break;

    if (input.kbhit()) {
      const k = input.getch();
      if (k === 0) {
        const scan = input.getch();
        // The C compares scan codes to 'H'/'M' (Up/Right) and 'K'/'P'
        // (Left/Down).  Preserved literally.
        if (scan === 72 || scan === 77) {
          if (optionnum < numoptions - 1) optionnum++;
        } else if (scan === 75 || scan === 80) {
          if (optionnum > 0) optionnum--;
        }
      } else {
        break;
      }
    }
  }
  vga.cls();
  await setFontFrom(url('thin.blf'));
}

// =============================================================================
// adjust_settings — Sound is the only "live" option now that we've stubbed
// audio; Level and Controls were empty in the C too.
// =============================================================================
function drawSettingsButton(x1, y1, x2, y2) {
  vga.box(x1,     y1,     x2 - 1, y2 - 1, 28, 0);
  vga.box(x1 + 1, y1 + 1, x2,     y2,     22, 0);
  vga.box(x1 + 1, y1 + 1, x2 - 1, y2 - 1, 25, 0);
}

export async function adjustSettings() {
  const backg   = await loadPic(url('underprf.pic'));
  const pointer = await loadPic(url('pointer.pic'));
  const options = ['Sound', 'Level', 'Controls', 'Fini'];
  const numoptions = options.length;
  const bx = [[0,0],[0,0],[0,0],[0,0]], by = [[0,0],[0,0],[0,0],[0,0]];

  const redraw = () => {
    vga.erase(0, 0, 320, 200, 0, 0, backg);
    vga.drawtext((160 - 4.5 * vga.xfontsize) | 0, 10, 'Settings:', 15, 4);
    for (let n = 0; n < numoptions; n++) {
      drawSettingsButton(bx[n][0], by[n][0], bx[n][1], by[n][1]);
      vga.drawtext((160 - (vga.xfontsize * options[n].length / 2)) | 0,
                   (100 - 3 * vga.yfontsize * 0.5 * numoptions
                       + n * (3 * vga.yfontsize)) | 0,
                   options[n], 15, 4);
    }
  };

  for (let n = 0; n < numoptions; n++) {
    bx[n][0] = (160 - (vga.xfontsize * options[n].length) / 2 - 5) | 0;
    by[n][0] = (100 - 3 * vga.yfontsize * 0.5 * numoptions
                    + n * (3 * vga.yfontsize) - 5) | 0;
    bx[n][1] = bx[n][0] + vga.xfontsize * options[n].length + 10;
    by[n][1] = by[n][0] + vga.yfontsize + 10;
  }
  redraw();

  let mx = input.mousex(), my = input.mousey();
  const under = new Uint8Array(2 + pointer[0] * pointer[1]);
  vga.get(mx, my, mx + pointer[0] - 1, my + pointer[1] - 1, under);
  vga.put(mx, my, pointer, 4);

  let buttondown = false, chosen = 0, fini = false;
  while (!fini) {
    if (mx !== input.mousex() || my !== input.mousey()) {
      vga.put(mx, my, under, 0);
      mx = input.mousex(); my = input.mousey();
      vga.get(mx, my, mx + pointer[0] - 1, my + pointer[1] - 1, under);
      vga.put(mx, my, pointer, 4);
    }
    if (input.buttonpressed()) buttondown = true;
    else if (buttondown) {
      buttondown = false;
      for (let n = 0; n < numoptions; n++) {
        if (mx >= bx[n][0] && mx <= bx[n][1] &&
            my >= by[n][0] && my <= by[n][1]) { chosen = n + 1; break; }
      }
    }
    if (input.kbhit()) {
      const k = input.getch();
      const ch = k >= 32 ? String.fromCharCode(k).toLowerCase() : '';
      if (ch === 's') chosen = 1;
      else if (ch === 'l') chosen = 2;
      else if (ch === 'f' || ch === 'q' || ch === 'x' || k === 27 || k === 13) chosen = 4;
    }

    if (chosen === 1) {
      vga.put(mx, my, under, 0);
      await booleanChoice('Do you want the sound on? Y/N', 'y', 'n');
      redraw();
      vga.get(mx, my, mx + pointer[0] - 1, my + pointer[1] - 1, under);
      vga.put(mx, my, pointer, 4);
    } else if (chosen === 4) {
      fini = true;
    }
    chosen = 0;
    await timing.nextFrame();
  }
}
