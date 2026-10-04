// screens.js
import * as vga from 'lib/vga.js';
import * as input from 'lib/input.js';
import * as timing from 'lib/timing.js';
import { menubox } from 'lib/ui.js';
import { loadPic } from 'lib/assets.js';
import { state } from './state.js';
import { loadFontInto, taketext, drainKeyboard } from './helpers.js';

// ------------------------------------------------------------------ opscreen
export async function opscreen() {
  const pics = await Promise.all([
    loadPic('assets/a2.pic'), loadPic('assets/r.pic'),
    loadPic('assets/k.pic'),  loadPic('assets/a.pic'),
    loadPic('assets/n.pic'),  loadPic('assets/n2.pic'),
  ]);
  const xpicsize = pics[0][0], ypicsize = pics[0][1];
  const x = new Int32Array(6), y = new Int32Array(6);
  const xi = new Int32Array(6), yi = new Int32Array(6);
  for (let n = 0; n < 6; n++) {
    x[n] = (320 + n * (3 * xpicsize) / 2) | 0;
    y[n] = 50; xi[n] = -8; yi[n] = 0;
  }
  let last = timing.counter();
  while (x[5] > -xpicsize) {
    if (timing.counter() === last) await timing.nextTick();
    last = timing.counter();
    for (let n = 0; n < 6; n++) {
      if (x[n] < 320) yi[n] += 1;
      if (y[n] + yi[n] > 199 - ypicsize) yi[n] = 1 - yi[n];
      vga.put(x[n], y[n], pics[n], 1);
      x[n] += xi[n]; y[n] += yi[n];
      vga.put(x[n], y[n], pics[n], 1);
    }
  }
}

// ----------------------------------------------------------------- mainmenu
export async function mainmenu() {
  const xf = vga.xfontsize, yf = vga.yfontsize;
  const xoptionsize = 14 * xf, yoptionsize = yf + 4;
  const numoptions = 5, numbs = 12;
  const menux = 160 - 7 * xf, menuy = 68;

  const pointer = await loadPic('assets/pointer.pic');
  const ballPics = await Promise.all(
    [1, 2, 3, 4, 5, 6].map(i => loadPic(`assets/ball${i}.pic`))
  );

  vga.cls();

  // Title box
  menubox((160 - 10.5 * xf) | 0, 18, (160 + 10.5 * xf) | 0, 21 + 2 * yf);
  vga.drawtext((160 - 3.5 * xf) | 0, 20, 'Arkann!', 15, 4);
  vga.drawtext((160 - 10 * xf) | 0, 20 + yf, '(C)1997, Jacob Ewing', 15, 4);

  // Menu options
  const labels = ['Play the Game', 'High Scores', 'Credits', 'How to Play', 'Exit'];
  {
    let x = menux, y = menuy;
    for (let n = 0; n < numoptions; n++) {
      menubox(x, y, x + xoptionsize - 1, y + yoptionsize - 1);
      vga.drawtext(x + 2, y + 2, labels[n], 15, 4);
      y += (yoptionsize * 3) >> 1;
    }
  }

  // Bouncing balls
  const bx = new Int32Array(numbs), by = new Int32Array(numbs);
  const bxi = new Int32Array(numbs), byi = new Int32Array(numbs);
  const underb = new Array(numbs);
  for (let n = 0; n < numbs; n++) {
    bx[n] = (Math.random() * 300 | 0) + 10;
    by[n] = (Math.random() * 100 | 0) + 30;
    bxi[n] = (Math.random() * 4 | 0) + 1;
    if (!(Math.random() * 2 | 0)) bxi[n] = -bxi[n];
    byi[n] = Math.random() * 4 | 0;
    if (!(Math.random() * 2 | 0)) byi[n] = -byi[n];
    const bp = ballPics[n % 6];
    underb[n] = new Uint8Array(2 + bp[0] * bp[1]);
    vga.get(bx[n], by[n], bx[n] + bp[0] - 1, by[n] + bp[1] - 1, underb[n]);
  }

  // Pointer
  let mx = input.mousex(), my = input.mousey();
  const underPointer = new Uint8Array(2 + pointer[0] * pointer[1]);
  vga.get(mx, my, mx + pointer[0] - 1, my + pointer[1] - 1, underPointer);
  vga.put(mx, my, pointer, 4);
  let mouseshowing = true;

  let gotone = false, m = 0;
  let last = timing.counter();

  while (!gotone) {
    if (timing.counter() === last) await timing.nextTick();
    last = timing.counter();

    // Erase pointer/balls that overlap.
    for (let n = 0; n < numbs; n++) {
      const bp = ballPics[n % 6];
      if (mouseshowing &&
          bx[n] - mx <= pointer[0] && bx[n] - mx >= -bp[0] &&
          by[n] - my <= pointer[1] && by[n] - my >= -bp[1]) {
        vga.put(mx, my, underPointer, 0); mouseshowing = false;
      }
      vga.put(bx[n], by[n], underb[n], 0);
    }
    // Update ball positions and save new underb.
    for (let n = 0; n < numbs; n++) {
      const bp = ballPics[n % 6];
      byi[n]++;
      if (bx[n] + bxi[n] >= 319 || bx[n] + bxi[n] <= 0) bxi[n] = -bxi[n];
      if (by[n] + byi[n] >= 199 || by[n] + byi[n] <= 0) byi[n] = 1 - byi[n];
      by[n] += byi[n]; bx[n] += bxi[n];
      if (mouseshowing &&
          bx[n] - mx <= pointer[0] && bx[n] - mx >= -bp[0] &&
          by[n] - my <= pointer[1] && by[n] - my >= -bp[1]) {
        vga.put(mx, my, underPointer, 0); mouseshowing = false;
      }
      vga.get(bx[n], by[n], bx[n] + bp[0] - 1, by[n] + bp[1] - 1, underb[n]);
    }
    for (let n = 0; n < numbs; n++)
      vga.put(bx[n], by[n], ballPics[n % 6], 5);

    // Pointer update.
    if (!mouseshowing || mx !== input.mousex() || my !== input.mousey()) {
      if (mouseshowing && (mx !== input.mousex() || my !== input.mousey()))
        vga.put(mx, my, underPointer, 0);
      mx = input.mousex(); my = input.mousey();
      vga.get(mx, my, mx + pointer[0] - 1, my + pointer[1] - 1, underPointer);
      vga.put(mx, my, pointer, 4);
      mouseshowing = true;
    }

    // Menu selection.
    gotone = false;
    if (input.buttonpressed()) {
      let x = menux, y = menuy;
      for (let opt = 0; opt < numoptions && !gotone; opt++) {
        if (mx >= x && my >= y && mx <= x + xoptionsize - 1 &&
            my <= y + yoptionsize - 1) { m = opt; gotone = true; }
        y += (yoptionsize * 3) >> 1;
      }
    }
    if (!gotone && input.kbhit()) {
      const k = input.getch();
      if (k === 0) input.getch();  // extended key, ignore
      else {
        if      (k === 112||k===80||k===103||k===71||k===97||k===65||k===13) m = 0;
        else if (k === 104||k===72||k===115||k===83) m = 1;
        else if (k ===  99||k===67) m = 2;
        else if (k ===  63||k===47) m = 3;
        else if (k === 101||k===69||k===120||k===88||k===27) m = 4;
        else m = -1;
        if (m >= 0) gotone = true;
      }
    }
  }

  if (mouseshowing) vga.put(mx, my, underPointer, 0);
  vga.cls();
  return m;
}

// --------------------------------------------------------------- show_credits
export async function show_credits() {
  const numcredits = 12, spacing = 40;
  await input.waitForButtonRelease?.();  // placeholder if not exported
  while (input.buttonpressed()) await timing.nextFrame();

  await loadFontInto('assets/6x6.blf');
  const xf = vga.xfontsize, yf = vga.yfontsize;

  const credits = [
    'Programming:  Jacob Ewing',
    'Design:  Jacob Ewing',
    'Special Effects:  Jacob Ewing',
    'Character Design:  Jacob Ewing',
    'Writing:  Jacob Ewing',
    'Testing:  Jacob Ewing',
    'Debugging:  Jacob Ewing',
    'Special Thanks to:  Jacob Ewing',
    'All Hail the Great:  Jacob Ewing',
    'Please Send Money to:  Jacob Ewing',
    'I ' + String.fromCharCode(3) + ':  Jacob Ewing',
    ' ',
  ];

  const cx = new Int32Array(numcredits), cy = new Int32Array(numcredits);
  for (let n = 0; n < numcredits; n++) {
    cx[n] = (160 - (credits[n].length * xf) / 2) | 0;
    cy[n] = 200 + n * spacing;
    vga.drawtext(cx[n], cy[n], credits[n], 15, 1);
  }

  // Diagonal striped background.
  for (let dx = 0; dx < 320; dx++) {
    for (let dy = 0; dy < 200; dy++) {
      let x = 319 + (dx + 1) - ((dy + 1) / 3 | 0);
      if (x > 319) x -= 319;
      const y = (dy + 1) + ((dx + 1) / 3 | 0);
      vga.vmem[dx + 320 * dy] = (((x / 80 | 0) ^ (y / 80 | 0)) % 2) * 14;
    }
  }

  let last = timing.counter();
  while (!(input.kbhit() || input.buttonpressed())) {
    if (timing.counter() === last) await timing.nextTick();
    last = timing.counter();
    for (let n = 0; n < numcredits; n++) {
      if (cy[n] < 200) vga.drawtext(cx[n], cy[n], credits[n], 15, 1);
      cy[n] -= 1;
      if (cy[n] < -yf) {
        cy[n] = (n === 0) ? cy[numcredits - 1] + spacing : cy[n - 1] + spacing;
      }
      if (cy[n] < 200) vga.drawtext(cx[n], cy[n], credits[n], 15, 1);
    }
  }
  drainKeyboard();
  while (input.buttonpressed()) await timing.nextFrame();
  await loadFontInto('assets/11x12.blf');
}

// --------------------------------------------------------- show_high_score_list
export async function show_high_score_list() {
  while (input.buttonpressed()) await timing.nextFrame();
  await loadFontInto('assets/scrib.blf');
  const xf = vga.xfontsize, yf = vga.yfontsize;

  const { numscores, pname, highscore } = await loadHighScores();

  const xboxsize = 25 * xf, yboxsize = 13 * yf;
  const x1 = (160 - xboxsize / 2) | 0, x2 = x1 + xboxsize;
  const y1 = (100 - yboxsize / 2) | 0, y2 = y1 + yboxsize;

  vga.cls();
  menubox(x1, y1, x2, y2);
  vga.drawtext(108, y1 + 3, 'High Scores:', 15, 4);

  let x = x1 + 2, y = y1 + 2 * yf;
  for (let n = 0; n < 10; n++) {
    if (n < numscores) {
      vga.drawtext(x, y, pname[n], 15, 4);
      const numStr = String(highscore[n]);
      vga.drawtext(x2 - numStr.length * xf - 2, y, numStr, 15, 4);
    } else {
      vga.drawtext(x, y, '....................', 15, 4);
    }
    y += yf;
  }

  const numstars = 200;
  const starx = new Int32Array(numstars), stary = new Int32Array(numstars);
  const starz = new Int32Array(numstars);
  for (let n = 0; n < numstars; n++) {
    starx[n] = Math.random() * 320 | 0;
    stary[n] = Math.random() * 200 | 0;
    starz[n] = Math.random() * 10  | 0;
  }

  let tally = 0;
  while (!(input.kbhit() || input.buttonpressed())) {
    // Original ran this at delay(5), i.e. far faster than the 18.2 Hz tick.
    await timing.nextFrame();
    tally = (tally + 1) % 100;
    for (let n = 0; n < numstars; n++) {
      if (!(tally % (starz[n] + 1))) {
        if (starx[n] < x1 || starx[n] > x2 || stary[n] < y1 || stary[n] > y2)
          vga.putpixel(starx[n], stary[n], 0, 0);
        stary[n]++;
        starx[n] += 10 - Math.abs(((100 - stary[n]) / 10) | 0);
        if (starx[n] >= 320) starx[n] %= 320;
        if (starx[n] < 0) starx[n] += 320;
        if (stary[n] > 199) {
          stary[n] = 0;
          starx[n] = Math.random() * 320 | 0;
          starz[n] = Math.random() * 10  | 0;
        }
        if (starx[n] < x1 || starx[n] > x2 || stary[n] < y1 || stary[n] > y2)
          vga.putpixel(starx[n], stary[n], 30 - starz[n], 0);
      }
    }
  }
  drainKeyboard();
  while (input.buttonpressed()) await timing.nextFrame();
  await loadFontInto('assets/11x12.blf');
}

// ------------------------------------------------------------- explain_game
export async function explain_game() {
  const pointer = await loadPic('assets/pointer.pic');
  const background = await loadPic('assets/underhlp.pic');
  const buttons = [
    { x: 0, y: 0, pic: await loadPic('assets/left.pic') },
    { x: 0, y: 0, pic: await loadPic('assets/right.pic') },
    { x: 0, y: 0, pic: await loadPic('assets/done.pic') },
  ];
  buttons[2].x = (160 - buttons[2].pic[0] / 2) | 0;
  buttons[2].y = 199 - buttons[2].pic[1];
  buttons[0].x = buttons[2].x - buttons[0].pic[0] - 2;
  buttons[0].y = 199 - buttons[0].pic[1];
  buttons[1].x = buttons[2].x + buttons[2].pic[0] + 2;
  buttons[1].y = 199 - buttons[1].pic[1];

  const pics = {
    pad:    await loadPic('assets/pad1.pic'),
    ball1:  await loadPic('assets/ball1.pic'),
    brick1: await loadPic('assets/brick1.pic'),
    brick2: await loadPic('assets/brick2.pic'),
    brick8: await loadPic('assets/brick8.pic'),
    pill1:  await loadPic('assets/pill1.pic'),
    pill2:  await loadPic('assets/pill2.pic'),
    pill3:  await loadPic('assets/pill3.pic'),
    pill4:  await loadPic('assets/pill4.pic'),
    pill5:  await loadPic('assets/pill5.pic'),
    pill6:  await loadPic('assets/pill6.pic'),
    pill7:  await loadPic('assets/pill7.pic'),
    pill8:  await loadPic('assets/pill8.pic'),
    shot:   await loadPic('assets/shot.pic'),
  };

  vga.erase(0, 0, 319, 199, 0, 0, background);
  for (const b of buttons) vga.put(b.x, b.y, b.pic, 0);
  vga.drawtext((160 - 9 * vga.xfontsize) | 0, 10, 'How to Play Arkann:', 15, 4);

  await loadFontInto('assets/6x6.blf');
  const xf = vga.xfontsize, yf = vga.yfontsize;

  // ---- Pointer show/hide with correct save/restore ----
  const pointerUnder = new Uint8Array(2 + pointer[0] * pointer[1]);
  let pointerX = 0, pointerY = 0, pointerVisible = false;

  function drawPointerAt(x, y) {
    pointerX = x; pointerY = y;
    vga.get(x, y, x + pointer[0] - 1, y + pointer[1] - 1, pointerUnder);
    vga.put(x, y, pointer, 4);
    pointerVisible = true;
  }
  function undrawPointer() {
    if (!pointerVisible) return;
    vga.put(pointerX, pointerY, pointerUnder, 0);
    pointerVisible = false;
  }
  function movePointerTo(x, y) {
    undrawPointer();
    drawPointerAt(x, y);
  }

  drawPointerAt(input.mousex(), input.mousey());

  const numoptions = 18;
  let optionnum = 0;
  let done = false;
  let last = -1;
  let tx1 = 0, tx2 = 0, ty1 = 0, ty2 = 0;
  let bx1 = 0, bx2 = 0, by1 = 0, by2 = 0;
  let prevButton = false;

  while (!done) {
    if (optionnum !== last) {
      undrawPointer();
      if (last >= 0) {
        vga.erase(tx1, ty1, tx2, ty2, 0, 0, background);
        vga.erase(bx1, by1, bx2, by2, 0, 0, background);
      }
      const { text, numlines, have_picture, picture } = getHelpPage(optionnum, pics);
      let ty1c;
      if (have_picture) {
        bx1 = 160 - picture[0] - 5; bx2 = 160 + picture[0] + 5;
        by1 = 100 - picture[1] - 5; by2 = 100 + picture[1] + 5;
        menubox(bx1, by1, bx2, by2);
        vga.put(160 - (picture[0] / 2 | 0), 100 - (picture[1] / 2 | 0), picture, 4);
        ty1c = by2 + 10;
      } else {
        bx1 = bx2 = by1 = by2 = 0;
        ty1c = (100 - 0.75 * (numlines * yf)) | 0;
      }
      ty1 = ty1c;
      ty2 = ty1 + ((numlines + 1) * 1.5 * yf) | 0;
      tx1 = 160; tx2 = 160;
      let y = (ty1 + yf / 2) | 0;
      for (let n = 0; n < numlines; n++) {
        const x = (160 - xf * (text[n].length / 2)) | 0;
        vga.drawtext(x, y, text[n], 14, 4);
        if (x < tx1) { tx1 = x; tx2 = x + xf * text[n].length; }
        y += (1.5 * yf) | 0;
      }
      last = optionnum;
      drawPointerAt(input.mousex(), input.mousey());
    }

    let hit = 0;
    while (!(input.kbhit() || hit)) {
      const nmx = input.mousex(), nmy = input.mousey();
      if (nmx !== pointerX || nmy !== pointerY) movePointerTo(nmx, nmy);

      const bp = input.buttonpressed();
      if (bp && !prevButton) {
        for (let n = 0; n < 3; n++) {
          const b = buttons[n];
          if (pointerX >= b.x && pointerX <= b.x + b.pic[0] - 1 &&
              pointerY >= b.y && pointerY <= b.y + b.pic[1] - 1) {
            if ((n !== 0 || optionnum > 0) && (n !== 1 || optionnum < numoptions - 1)) {
              hit = n + 1;
            }
            break;
          }
        }
      }
      prevButton = bp;
      await timing.nextFrame();
    }

    undrawPointer();
    vga.erase(tx1, ty1, tx2, ty2, 0, 0, background);
    vga.erase(bx1, by1, bx2, by2, 0, 0, background);

    if (hit === 1 && optionnum > 0) optionnum--;
    else if (hit === 2 && optionnum < numoptions - 1) optionnum++;
    else if (hit === 3) done = true;

    if (input.kbhit()) {
      const k = input.getch();
      if (k === 0) {
        const scan = input.getch();
        if      (scan === 72 || scan === 77) { if (optionnum < numoptions - 1) optionnum++; }
        else if (scan === 75 || scan === 80) { if (optionnum > 0) optionnum--; }
      } else {
        done = true;
      }
    }
  }

  vga.cls();
  await loadFontInto('assets/11x12.blf');
}

// Page content table. `pics` carries the pre-loaded sprites.
function getHelpPage(optionnum, pics) {
  const t = new Array(16).fill('');
  let numlines = 0, have_picture = true;
  let picture = null;
  switch (optionnum) {
    case 0: have_picture = false;
      t[0]='Arkann is a beautifully simple and extremely';
      t[1]='addictive game.  This is how it works:';
      t[2]='When playing, you will see a large array of';
      t[3]='bricks at the top of the screen.  At the bottom';
      t[4]='of the screen you will also see a flat pad with';
      t[5]='a ball attatched to it.  If you push the mouse';
      t[6]='button, the ball will start flying toward the';
      t[7]='top of the screen.  When it hits a brick, it';
      t[8]='will bounce back down toward the bottom of the';
      t[9]='screen, after breaking the brick.';
      t[10]='  ';
      t[11]='The object of the game is to break every';
      t[12]='brick on the screen.  Once you\'ve done that,';
      t[13]='you are sent on to the next level.';
      numlines = 14; break;
    case 1: have_picture = false;
      t[0]='You will also see that there are capsules';
      t[1]='trapped inside some of the bricks, which fall';
      t[2]='down after you break the bricks they\'re trapped';
      t[3]='in.  If you catch these capsules, they will';
      t[4]='reward you by doing things such as slowing the';
      t[5]='ball down, widening your pad, giving you guns';
      t[6]='to shoot the bricks with, and many more!';
      numlines = 7; break;
    case 2: picture = pics.pad;    numlines = 2;
      t[0]='This is the pad that you rescue the ball';
      t[1]='with.  You can control it with the mouse'; break;
    case 3: picture = pics.ball1;  numlines = 4;
      t[0]='This is the ball with which you can';
      t[1]='break the bricks.  Just don\'t let it';
      t[2]='hit the bottom of the screen, or you\'ll';
      t[3]='loose a life.'; break;
    case 4: picture = pics.brick1; numlines = 3;
      t[0]='This is one of the many bricks that you';
      t[1]='can break.  They come in several colours,';
      t[2]='but they are all the same size and shape.'; break;
    case 5: picture = pics.brick2; numlines = 3;
      t[0]='This brick is a bit tougher than most of';
      t[1]='the others.  You may have to hit it two or';
      t[2]='three times to break it.'; break;
    case 6: picture = pics.brick8; numlines = 3;
      t[0]='This brick is very special because it can\'t';
      t[1]='be broken.  Of course, you don\'t have to';
      t[2]='break it to finish the level.'; break;
    case 7: picture = pics.pill1;  numlines = 1;
      t[0]='This capsule makes your pad magnetic.'; break;
    case 8: picture = pics.pill2;  numlines = 1;
      t[0]='This capsule sends you to the next level.'; break;
    case 9: picture = pics.pill3;  numlines = 2;
      t[0]='This capsule makes the ball hot enough';
      t[1]='to drill through the bricks.'; break;
    case 10: picture = pics.pill4; numlines = 1;
      t[0]='This capsule will give you an extra pad.'; break;
    case 11: picture = pics.pill5; numlines = 1;
      t[0]='This capsule makes your pad wider.'; break;
    case 12: picture = pics.pill6; numlines = 1;
      t[0]='This capsule slows the ball down.'; break;
    case 13: picture = pics.pill7; numlines = 2;
      t[0]='This capsule divides your ball to give';
      t[1]='you two more.'; break;
    case 14: picture = pics.pill8; numlines = 1;
      t[0]='This capsule gives you guns to shoot with.'; break;
    case 15: picture = pics.shot;  numlines = 2;
      t[0]='This is one of the fireballs that you can';
      t[1]='shoot with if you catch the silver capsule.'; break;
    case 16: have_picture = false;
      t[0]='SCORING:'; t[1]='  ';
      t[2]='Every time you break a brick, the amount that';
      t[3]='your score changes by is increased by one.  Every';
      t[4]='time the ball hits your pad, this amount is set';
      t[5]='back to zero.  For example, if you break six';
      t[6]='bricks, but the ball touches your pad after every';
      t[7]='one, your score will increase by (1+1+1+1+1+1) = 6';
      t[8]='points.  If, however, you break six bricks';
      t[9]='without the ball touching the pad, your score';
      t[10]='will increase by (1+2+3+4+5+6) = 21 points.';
      t[11]='  ';
      t[12]='You will also receive points for catching any';
      t[13]='capsules that fall.  Their values are between';
      t[14]='five and thirty points.';
      numlines = 15; break;
    case 17: have_picture = false;
      t[0]='KEYS:'; t[1]='  ';
      t[2]='While playing the game, you can use the following';
      t[3]='keys:';
      t[4]='[ESC] ......................... Quits.';
      t[5]='[TAB] ....... Skips to the next level.';
      t[6]='[SPACE] ............. Pauses the game.';
      t[7]='  ';
      t[8]='The following keys can be used with the menus:';
      t[9]='[ESC] ............. Exits the program.';
      t[10]='[ENTER] ............. Starts the game.';
      t[11]='[H] .... Lets you see the high scores.';
      t[12]='[?] ....... Explains the game for you.';
      t[13]='[C] ........... Shows you the credits.';
      numlines = 14; break;
  }
  return { text: t, numlines, have_picture, picture };
}

// -------------------------------------------------------------- test_high_scores
export async function test_high_scores(score) {
  const { numscores, pname, highscore } = await loadHighScores();
  let gotone = false, rank = -1;

  for (let n = 0; n < numscores && !gotone; n++) {
    if (highscore[n] < score) {
      for (let m = numscores - 1; m > n; m--) {
        highscore[m] = highscore[m - 1];
        pname[m] = pname[m - 1];
      }
      rank = n;
      gotone = true;
      highscore[n] = score;
      pname[n] = (await taketext('What is Your Name?', 20)) || '';
    }
  }
  if (numscores < 10 && !gotone) {
    highscore[numscores] = score;
    pname[numscores] = (await taketext('What is Your Name?', 20)) || '';
    rank = numscores;
    gotone = true;
  }

  let newCount = numscores;
  if (numscores < 10) newCount = numscores + 1;

  if (gotone) {
    saveHighScores(newCount, pname, highscore);
    await show_high_score_list();
  }
}

// ---------------------------------------------------- highscores persistence
const HS_KEY = 'arkann.highscores.v1';

export async function loadHighScores() {
  const stored = localStorage.getItem(HS_KEY);
  if (stored) {
    try {
      const arr = JSON.parse(stored);
      const numscores = Math.min(10, arr.length);
      const pname = arr.map(e => e.name || ' ');
      const highscore = arr.map(e => e.score | 0);
      while (pname.length < 10) { pname.push(' '); highscore.push(0); }
      return { numscores, pname, highscore };
    } catch (e) { /* fall through */ }
  }
  // Seed from hscr.dat if it exists.
  try {
    const resp = await fetch('assets/hscr.dat');
    if (resp.ok) {
      const text = await resp.text();
      const lines = text.split(/\r?\n/);
      const pname = [], highscore = [];
      for (let n = 0; n < 10 && n * 2 + 1 < lines.length; n++) {
        const name = lines[n * 2], sc = parseInt(lines[n * 2 + 1], 10);
        if (!name || isNaN(sc)) break;
        pname.push(name.substring(0, 20));
        highscore.push(sc);
      }
      while (pname.length < 10) { pname.push(' '); highscore.push(0); }
      return { numscores: pname.length, pname, highscore };
    }
  } catch (e) { /* no seed file */ }
  return {
    numscores: 0,
    pname: new Array(10).fill(' '),
    highscore: new Array(10).fill(0),
  };
}

export function saveHighScores(count, pname, highscore) {
  const arr = [];
  for (let n = 0; n < count; n++) {
    arr.push({ name: pname[n] || ' ', score: highscore[n] | 0 });
  }
  localStorage.setItem(HS_KEY, JSON.stringify(arr));
}
