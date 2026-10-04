// game.js — play_game() and every handler it calls.
import * as vga from 'lib/vga.js';
import * as input from 'lib/input.js';
import * as timing from 'lib/timing.js';
import { pics, loadLevelPictures } from './assets.js';
import { readLevelInfo, decodeLevelFlags, numLevels } from './level.js';
import { drawalien } from './draw.js';

// --- Constants --------------------------------------------------------------
const INFOMINX = 216, INFOMAXX = 300, INFOMINY = 20, INFOMAXY = 180;
const MAXGAMEX = 200, MINGAMEX = 20, MINGAMEY = 20, MAXGAMEY = 180;
const MAXSHIPX = 200, MINSHIPX = 20, MAXSHIPY = 180;
const MAXNUMSHOTS = 50;
const PILL_PROBABILITY = 50;
const MAXLIVES = 10;
const MAXALIENS = 36;
const NUMPILLTYPES = 8;
const SHIP_STRENGTH_DEC = 33;
const WEAKENING_RATE = 12;
const MAXEXPLOSIONS = 50;

// --- Mutable game state -----------------------------------------------------
export const ship = { x: 0, y: 0, strength: 0, shielded: 0, pic: null, lives: 0 };
export const pill = { x: 0, y: 0, xi: 0, yi: 0, pic: null, xsize: 0, ysize: 0, type: 0 };
export const shot = [];        // array of shot objects
export const explosion = [];   // array of explosion objects
export const alien = [];       // rebuilt at the start of every level

let minshipy = 130;
let levelnum = 0;
let looseProbability = 0;
let numlevels = 0;
let pilltally = 0;
let score = 0, hiscore = 0;
let pillexists = 0;
let shotSpacing = 8;
let guntype = 0;
let cycling = 0, synchronized = 0, alienstyle = 0;
let pillhad = 0, newpilltype = 0;
let maxloosealiens = 0, numloosealiens = 0;
let done = 0;
let holdpill = -1;

// Animated palette.
const palval = new Uint8Array(768);
let cycleN = 16, cycleNi = 4;

export function initPalette() {
  vga.setColour(248, 48, 0, 0);
  for (let i = 0; i < 256; i++) {
    const { r, g, b } = vga.readPalette(i);
    palval[i*3] = r; palval[i*3+1] = g; palval[i*3+2] = b;
  }
}

export function initGame() {
  pill.pic = pics.pill;
  pill.xsize = pics.pill[0];
  pill.ysize = pics.pill[1];
}

function cyclePalette() {
  cycleN += cycleNi;
  if (cycleN + cycleNi > 63 || cycleN + cycleNi < 16) cycleNi *= -1;
  palval[248*3]   = cycleN;
  palval[249*3+1] = cycleN;
  vga.setPalette(palval);
}

// ---------------------------------------------------------------------------
// Per-level setup
// ---------------------------------------------------------------------------
async function loadLevel() {
  const info = readLevelInfo(levelnum);
  maxloosealiens = info.maxLooseAliens;
  looseProbability = info.looseProb;
  minshipy = info.minshipy;
  ({ alienstyle, cycling, synchronized } = decodeLevelFlags(info.flags));
  await loadLevelPictures(levelnum);
  return info;
}

function placeShip() {
  ship.x = MINSHIPX + ((MAXSHIPX - MINSHIPX) / 2 | 0);
  ship.y = minshipy + ((MAXSHIPY - minshipy) / 2 | 0);
  input.setMousePos(ship.x, ship.y);
  vga.put(ship.x, ship.y, ship.pic, 4);
}

function drawscreen() {
  vga.box(0, 0, 319, MINGAMEY - 8, 23, 0);
  vga.box(0, MAXGAMEY + 8, 319, 199, 23, 0);
  vga.box(0, 0, MINGAMEX - 8, 199, 23, 0);
  vga.box(INFOMAXX + 8, 0, 319, 199, 23, 0);
  vga.box(MAXGAMEX + 8, 0, INFOMINX - 8, 199, 23, 0);

  vga.erase(MINGAMEX, MINGAMEY, MAXGAMEX, MAXGAMEY, 0, 0, pics.backg);

  vga.drawtext(INFOMINX, INFOMINY, 'Score:', 15, 0);
  vga.drawtext(INFOMINX, INFOMINY + vga.yfontsize, '0', 15, 0);
  vga.drawtext(INFOMINX, INFOMINY + (2.5 * vga.yfontsize | 0), 'High Score:', 15, 0);
  vga.drawtext(INFOMINX, INFOMINY + (3.5 * vga.yfontsize | 0), String(hiscore), 15, 0);
  vga.drawtext(INFOMINX, INFOMINY + 5 * vga.yfontsize, 'Level: ' + levelnum, 15, 0);

  for (let n = 0; n < NUMPILLTYPES; n++) {
    vga.put(INFOMINX + 6 + (n % 4) * (pics.pillTypes[n][0] + 4),
            INFOMINY + 7 * vga.yfontsize + ((n / 4) | 0) * (pics.pillTypes[n][1] + 4),
            pics.pillTypes[n], 0);
  }
  vga.put((INFOMINX + INFOMAXX - pics.title[0]) / 2 | 0,
          INFOMAXY - 30 - pics.title[1], pics.title, 0);

  for (let n = 1; n < 8; n++) {
    vga.box(MINGAMEX - n, MINGAMEY - n, MAXGAMEX + n, MAXGAMEY + n, n + 16, 4);
    vga.box(INFOMINX - n, INFOMINY - n, INFOMAXX + n, INFOMAXY + n, n + 16, 4);
    vga.box(n - 1, n - 1, 320 - n, 200 - n, n + 16, 4);
  }
}

function highlightPilltype(n, onoff) {
  const bx = INFOMINX + 6 + (n % 4) * (pics.pillTypes[n][0] + 4) - 1;
  const by = INFOMINY + 7 * vga.yfontsize + ((n / 4) | 0) * (pics.pillTypes[n][1] + 4) - 1;
  const colour = 249 * (onoff !== 0);
  vga.box(bx, by, bx + pics.pillTypes[n][0] + 1, by + pics.pillTypes[n][1] + 1, colour, 4);
}

// ---------------------------------------------------------------------------
// Explosions
// ---------------------------------------------------------------------------
function makeExplosion(x, y, _makenoise) {
  if (explosion.length < MAXEXPLOSIONS) {
    explosion.push({ x, y, picnum: 0 });
    vga.put(x, y, pics.explosions[0], 4);
  }
}

function handleExplosions() {
  for (let n = 0; n < explosion.length; n++) {
    const e = explosion[n];
    const pic = pics.explosions[e.picnum];
    vga.eraseshape(e.x - (pic[0] >> 1), e.y - (pic[1] >> 1), 0, 0, pic, pics.backg, 0);
    e.picnum++;
    if (e.picnum > 2) {
      explosion.splice(n, 1);
      n--;
    } else {
      const p2 = pics.explosions[e.picnum];
      vga.put(e.x - (p2[0] >> 1), e.y - (p2[1] >> 1), p2, 4);
    }
  }
}

// ---------------------------------------------------------------------------
// Weapon fire
// ---------------------------------------------------------------------------
function shoot(gt) {
  if (ship.strength <= shotSpacing + 1) return;

  const makeShot = (pic, xi, yi, type) => ({
    pic, xsize: pic[0], ysize: pic[1],
    x: ship.x + (ship.pic[0] / 2 | 0) - (pic[0] / 2 | 0),
    y: ship.y - pic[1],
    xi, yi, type,
  });

  switch (gt) {
    case 0:
      if (shot.length < MAXNUMSHOTS) {
        const s = makeShot(pics.shots[1], 0, -2, 1);
        shot.push(s);
        vga.put(s.x, s.y, s.pic, 4);
      }
      break;
    case 1:
      if (shot.length < MAXNUMSHOTS - 2) {
        const a = makeShot(pics.shots[1], 0, -1, 1);
        const b = { ...a, xi: -1 };
        const c = { ...a, xi: 1 };
        shot.push(a, b, c);
        vga.put(a.x, a.y, a.pic, 4);
        vga.put(b.x, b.y, b.pic, 4);
        vga.put(c.x, c.y, c.pic, 4);
      }
      break;
    case 2:
      if (shot.length < MAXNUMSHOTS - 1) {
        const a = makeShot(pics.shots[1], 0, -2, 1);
        const b = { ...a, x: ship.x + ship.pic[0] - a.xsize };
        shot.push(a, b);
        vga.put(a.x, a.y, a.pic, 4);
        vga.put(b.x, b.y, b.pic, 4);
      }
      break;
    case 3:
      if (shot.length < MAXNUMSHOTS) {
        const s = makeShot(pics.shots[2], 0, -2, 2);
        shot.push(s);
        vga.put(s.x, s.y, s.pic, 4);
      }
      break;
    case 4:
      if (shot.length < MAXNUMSHOTS) {
        const s = makeShot(pics.shots[3], 0, -5, 1);
        shot.push(s);
        vga.put(s.x, s.y, s.pic, 4);
      }
      break;
  }
  ship.strength -= WEAKENING_RATE;
  if (ship.strength < 0) ship.strength = 0;
}

// ---------------------------------------------------------------------------
// Hit handling
// ---------------------------------------------------------------------------
function hitAlien(n) {
  alien[n].strength--;
  score += 200;

  if (alien[n].haspill && !((alien[n].strength + 1) % (levelnum + 1))) {
    alien[n].haspill = 0;
    pillhad = 0;
    pillexists = 1;
    pill.type = newpilltype;
    pill.x = alien[n].x + (alien[n].xsize / 2 | 0) - (pill.xsize / 2 | 0);
    pill.y = alien[n].y;
    pill.xi = 0; pill.yi = 2;
  }
  if (alien[n].strength < 0) {
    if (alien[n].loose) numloosealiens--;
    vga.eraseshape(alien[n].x, alien[n].y, 0, 0, alien[n].pic, pics.backg, 2);
    alien.splice(n, 1);
  }
}

// ---------------------------------------------------------------------------
// Pill pickup
// ---------------------------------------------------------------------------
function usePill() {
  switch (pill.type) {
    case 0:
      if (!ship.shielded) ship.pic = pics.ships[0];
      guntype = 0; shotSpacing = 3;
      break;
    case 1:
      if (!ship.shielded) ship.pic = pics.ships[0];
      guntype = 1; shotSpacing = 8;
      break;
    case 2:
      if (!ship.shielded) ship.pic = pics.ships[2];
      guntype = 2; shotSpacing = 8;
      break;
    case 3:
      if (!ship.shielded) ship.pic = pics.ships[0];
      guntype = 0; shotSpacing = 8;
      // Capture each alien's position *before* hitAlien potentially
      // splices it out from under us.
      for (let n = alien.length - 1; n >= 0; n--) {
        const ax = alien[n].x + (alien[n].pic[0] / 2 | 0);
        const ay = alien[n].y + (alien[n].pic[1] / 2 | 0);
        hitAlien(n);
        makeExplosion(ax, ay, 0);
      }
      break;
    case 4:
      ship.pic = pics.ships[1];
      ship.shielded += 100;
      break;
    case 5:
      if (!ship.shielded) ship.pic = pics.ships[3];
      guntype = 3; shotSpacing = 8;
      break;
    case 6:
      for (let n = 0; n < ship.lives; n++) {
        vga.box(INFOMINX + 5*n, INFOMAXY, INFOMINX + 5*n + 1, INFOMAXY - 25, 14, 0);
        vga.box(INFOMINX + 5*n, INFOMAXY - 25, INFOMINX + 5*n + 1, INFOMAXY - 25, 0, 0);
      }
      if (ship.lives < MAXLIVES) ship.lives++;
      vga.box(INFOMINX + 5*(ship.lives-1), INFOMAXY,
              INFOMINX + 5*(ship.lives-1) + 1, INFOMAXY - (ship.strength/4|0), 14, 0);
      vga.box(INFOMINX + 5*(ship.lives-1), INFOMAXY - (ship.strength/4|0),
              INFOMINX + 5*(ship.lives-1) + 1, INFOMAXY - 25, 0, 0);
      break;
    case 7:
      if (!ship.shielded) ship.pic = pics.ships[0];
      guntype = 4; shotSpacing = 8;
      break;
  }
  input.setMouseLimits(MINSHIPX, minshipy,
                       MAXSHIPX - ship.pic[0] + 1,
                       MAXSHIPY - ship.pic[1] - 1);
}

function handlePill() {
  if (pillexists) {
    if (vga.touching(pill.x, pill.y, pill.pic, ship.x, ship.y, ship.pic, 1)) {
      highlightPilltype(pill.type, 0);
      if (alien.length > 0) usePill();
      else holdpill = pill.type;
    }
    vga.eraseshape(pill.x, pill.y, 0, 0, pill.pic, pics.backg, 2);
    pill.x += pill.xi;
    pill.y += pill.yi;
    if (pill.y >= MAXGAMEY - pill.pic[1]) {
      pillexists = 0;
      highlightPilltype(pill.type, 0);
    }
  }
  if (pillexists) vga.put(pill.x, pill.y, pill.pic, 4);
}

// ---------------------------------------------------------------------------
// Aliens
// ---------------------------------------------------------------------------
export function handleAliens() {
  let changedirection = 0;
  if (handleAliens._direction === undefined) handleAliens._direction = 1;

  for (let n = 0; n < alien.length; n++) {
    vga.eraseshape(alien[n].x, alien[n].y, 0, 0, alien[n].pic, pics.backg, 2);
    if (cycling) {
      alien[n].picnum = (alien[n].picnum + 1) % 4;
    } else {
      if (alien[n].picnum + alien[n].picnumi > 3 ||
          alien[n].picnum + alien[n].picnumi < 0) alien[n].picnumi *= -1;
      alien[n].picnum += alien[n].picnumi;
    }
    alien[n].pic = alien[n].type ? pics.bomber : pics.alien[alien[n].picnum];
    alien[n].xsize = alien[n].pic[0];
    alien[n].ysize = alien[n].pic[1];

    if (!alien[n].loose) {
      if (alien[n].x >= MAXGAMEX - alien[n].xsize && handleAliens._direction > 0)
        changedirection = 1;
      if (alien[n].x <= MINGAMEX + 1 && handleAliens._direction < 0)
        changedirection = 1;
      alien[n].x += handleAliens._direction;
      if (handleAliens._changey) {
        alien[n].y++;
        if (!alien[n].loose && alien[n].y >= ship.y - alien[n].ysize - 1) {
          alien[n].loose = 1; numloosealiens++;
          alien[n].xi = 2;
          if (Math.random() * 2 | 0) alien[n].xi *= -1;
          alien[n].yi = 1;
        }
      }
      if (numloosealiens < maxloosealiens &&
          !(Math.random() * looseProbability | 0)) {
        alien[n].loose = 1; numloosealiens++;
        alien[n].xi = 2;
        if (Math.random() * 2 | 0) alien[n].xi *= -1;
        alien[n].yi = 1;
      }
    } else {
      if (alien[n].x >= MAXGAMEX - alien[n].xsize && alien[n].xi > 0) alien[n].xi *= -1;
      if (alien[n].x <= MINGAMEX + 1 && alien[n].xi < 0) alien[n].xi *= -1;
      if (alien[n].y + alien[n].yi >= MAXGAMEY - alien[n].ysize) alien[n].y = MINGAMEY;
      if (!(Math.random() * 20 | 0)) alien[n].xi = Math.sign(ship.x - alien[n].x);
      alien[n].x += alien[n].xi;
      alien[n].y += alien[n].yi;
    }

    if (alienstyle === 1 && alien[n].type === 0 &&
        alien.length < MAXALIENS && !(Math.random() * 100 | 0)) {
      const b = {
        pic: pics.bomber,
        x: alien[n].x + (alien[n].xsize / 2 | 0) - (pics.bomber[0] / 2 | 0),
        y: alien[n].y + alien[n].ysize,
        xi: -alien[n].xi, yi: 2,
        picnum: 0, picnumi: 0,
        strength: 2, haspill: 0, type: 1, loose: 1,
        xsize: pics.bomber[0], ysize: pics.bomber[1],
      };
      alien.push(b);
    }

    drawalien(alien[n].x, alien[n].y, alien[n].pic, alien[n].haspill);
  }

  if (alien.length && shot.length < MAXNUMSHOTS && !(Math.random() * 40 | 0)) {
    const n = Math.random() * alien.length | 0;
    if (alien[n].y < MAXGAMEY - pics.shots[0][1] - alien[n].pic[1] - 5) {
      const pic = pics.shots[0];
      shot.push({
        pic, xsize: pic[0], ysize: pic[1],
        x: alien[n].x + (alien[n].xsize / 2 | 0) - (pic[0] / 2 | 0),
        y: alien[n].y + pic[1] + alien[n].ysize,
        xi: 0, yi: 1, type: 0,
      });
    }
  }

  handleAliens._changey = 0;
  if (changedirection) {
    handleAliens._direction *= -1;
    handleAliens._changey = 1;
  }
}

export function resetAlienDirection() {
  handleAliens._direction = 1;
  handleAliens._changey = 0;
}

// ---------------------------------------------------------------------------
// Shots and collisions
// ---------------------------------------------------------------------------
export function handleShotsAndAliens() {
  for (let k = 0; k < 2; k++) {
    for (let n = 0; n < shot.length; n++) {
      const s = shot[n];
      vga.eraseshape(s.x, s.y, 0, 0, s.pic, pics.backg, 2);
      s.y += s.yi;
      s.x += s.xi;

      if (s.x >= MAXGAMEX - s.pic[0] || s.x <= MINGAMEX + 1 ||
          s.y >= MAXGAMEY - s.pic[1] || s.y <= MINGAMEY + 1) {
        shot.splice(n, 1); n--; continue;
      }

      if (s.type !== 0) {
        // Player shot vs pill
        if (pillexists && vga.touching(s.x, s.y, s.pic,
                                        pill.x, pill.y, pill.pic, 1)) {
          vga.eraseshape(pill.x, pill.y, 0, 0, pill.pic, pics.backg, 2);
          makeExplosion(s.x + (s.pic[0] / 2 | 0), s.y, 1);
          highlightPilltype(pill.type, 0);
          pillexists = 0;
          if (s.type !== 2) { shot.splice(n, 1); n--; continue; }
        }
        // Player shot vs alien
        let hitAlienIdx = -1;
        for (let m = 0; m < alien.length; m++) {
          if (vga.touching(alien[m].x, alien[m].y, alien[m].pic,
                           s.x, s.y, s.pic, 1)) { hitAlienIdx = m; break; }
        }
        if (hitAlienIdx !== -1) {
          hitAlien(hitAlienIdx);
          makeExplosion(s.x + (s.pic[0] / 2 | 0),
                        s.y + (s.pic[1] / 2 | 0), 1);
          if (s.type !== 2) { shot.splice(n, 1); n--; }
        }
      } else {
        // Enemy shot vs ship
        if (vga.touching(ship.x, ship.y, ship.pic, s.x, s.y, s.pic, 1)) {
          makeExplosion(s.x + (s.pic[0] / 2 | 0), s.y, 1);
          if (ship.shielded > 0) {
            ship.shielded -= SHIP_STRENGTH_DEC;
            if (ship.shielded < 0) {
              ship.shielded = 0;
              vga.eraseshape(ship.x, ship.y, 0, 0, ship.pic, pics.backg, 2);
              ship.pic = guntype === 2 ? pics.ships[2]
                       : guntype === 3 ? pics.ships[3]
                       : pics.ships[0];
              input.setMouseLimits(MINSHIPX, minshipy,
                                   MAXSHIPX - ship.pic[0] + 1,
                                   MAXSHIPY - ship.pic[1] - 1);
              vga.put(ship.x, ship.y, ship.pic, 4);
            }
          } else {
            ship.strength -= SHIP_STRENGTH_DEC;
          }
          shot.splice(n, 1); n--;
        }
      }
    }
  }

  // Enemy shot vs player shot
  for (let n = 0; n < shot.length; n++) {
    if (shot[n].type !== 0) continue;
    for (let m = n + 1; m < shot.length; m++) {
      if (shot[m].type !== 0 &&
          vga.touching(shot[n].x, shot[n].y, shot[n].pic,
                       shot[m].x, shot[m].y, shot[m].pic, 1)) {
        makeExplosion(shot[n].x + (shot[n].pic[0] / 2 | 0), shot[n].y, 1);
        score += 50;
        if (shot[m].type !== 2) shot.splice(m, 1);
        shot.splice(n, 1);
        n--;
        break;
      }
    }
  }

  // Ship vs alien
  let n = 0;
  while (n < alien.length &&
         !vga.touching(ship.x, ship.y, ship.pic,
                       alien[n].x, alien[n].y, alien[n].pic, 1)) n++;
  if (n < alien.length) {
    const ax = alien[n].x + (alien[n].pic[0] / 2 | 0);
    const ay = alien[n].y + (alien[n].pic[1] / 2 | 0);
    makeExplosion(ax, ay, 1);
    hitAlien(n);
    if (n < alien.length) {
      makeExplosion(alien[n].x + (alien[n].pic[0] / 2 | 0),
                    alien[n].y + (alien[n].pic[1] / 2 | 0), 0);
    }
    if (ship.shielded > 0) {
      ship.shielded -= SHIP_STRENGTH_DEC;
      if (ship.shielded < 0) {
        ship.shielded = 0;
        vga.eraseshape(ship.x, ship.y, 0, 0, ship.pic, pics.backg, 2);
        ship.pic = guntype === 2 ? pics.ships[2]
                 : guntype === 3 ? pics.ships[3]
                 : pics.ships[0];
        input.setMouseLimits(MINSHIPX, minshipy,
                             MAXSHIPX - ship.pic[0] + 1,
                             MAXSHIPY - ship.pic[1] - 1);
        vga.put(ship.x, ship.y, ship.pic, 4);
      }
    } else {
      makeExplosion(ship.x + (ship.pic[0] / 2 | 0),
                    ship.y + (ship.pic[1] / 2 | 0), 1);
      ship.strength -= SHIP_STRENGTH_DEC;
    }
  }

  handleAliens();

  for (let i = 0; i < shot.length; i++) {
    vga.put(shot[i].x, shot[i].y, shot[i].pic, 4);
  }
  vga.put(ship.x, ship.y, ship.pic, 4);
}

// ---------------------------------------------------------------------------
// Ship control
// ---------------------------------------------------------------------------
export function handleShip() {
  let touchingpill = 0;
  if (pillexists)
    touchingpill = vga.touching(ship.x, ship.y, ship.pic,
                                pill.x, pill.y, pill.pic, 4);
  if (touchingpill) {
    vga.eraseshape(pill.x, pill.y, 0, 0, pill.pic, pics.backg, 2);
    pillexists = 0;
    highlightPilltype(pill.type, 0);
    score += 100;
    if (alien.length > 0) usePill();
    else holdpill = pill.type;
  }

  if (input.mousex() !== ship.x || input.mousey() !== ship.y) {
    vga.eraseshape(ship.x, ship.y, 0, 0, ship.pic, pics.backg, 2);
    ship.x = input.mousex();
    ship.y = input.mousey();
    if (pillexists)
      touchingpill = vga.touching(ship.x, ship.y, ship.pic,
                                  pill.x, pill.y, pill.pic, 4);
    if (touchingpill) {
      vga.eraseshape(pill.x, pill.y, 0, 0, pill.pic, pics.backg, 2);
      pillexists = 0;
      highlightPilltype(pill.type, 0);
      if (alien.length > 0) usePill();
      else holdpill = pill.type;
    }
    vga.put(ship.x, ship.y, ship.pic, 4);
  }
}

function handleKeypress() {
  switch (input.getch()) {
    case 27: done = 1; break;
    case 0:  input.getch(); break;
    case 9:  alien.length = 0; pillexists = 0; break;
  }
}

// ---------------------------------------------------------------------------
// play_game — the big top-level loop.
// ---------------------------------------------------------------------------
export async function playGame(initialHiscore) {
  input.setWantLock(true);
  try {
    hiscore = initialHiscore | 0;
    numlevels = numLevels();
    levelnum = 0;
    ship.lives = 3;
    score = 0;
    done = 0;
    holdpill = -1;

    while (!(done || levelnum >= numlevels) && ship.lives) {
      pilltally = 0;
      explosion.length = 0;
      ship.strength = 100;
      ship.shielded = 0;
      ship.pic = pics.ships[0];
      levelnum++;
      shot.length = 0;
      alien.length = 0;
      guntype = 0; pillexists = 0; numloosealiens = 0;
      pillhad = 0;
      let shotmade = 0;
      shotSpacing = 8;
      resetAlienDirection();

      const info = await loadLevel();
      input.setMouseLimits(MINSHIPX, minshipy,
                           MAXSHIPX - ship.pic[0] + 1,
                           MAXSHIPY - ship.pic[1] - 1);
      drawscreen();

      for (let n = 0; n < ship.lives; n++) {
        vga.box(INFOMINX + 5*n, INFOMAXY, INFOMINX + 5*n + 1, INFOMAXY - 25, 14, 0);
        vga.box(INFOMINX + 5*n, INFOMAXY - 25, INFOMINX + 5*n + 1, INFOMAXY - 25, 0, 0);
      }
      placeShip();
      for (let n = 0; n < NUMPILLTYPES; n++) highlightPilltype(n, 0);

      // Build the alien grid fresh.
      for (let n = 0; n < info.aliens; n++) {
        let picnum, picnumi;
        if (synchronized) { picnum = 0; picnumi = 1; }
        else { picnum = n % 4; picnumi = 1 - 2 * (n % 2); }
        const pic = pics.alien[picnum];
        const x = (info.xspacing + pics.alien[0][0]) * (n % info.rowsize)
                + ((MINGAMEX + MAXGAMEX) / 2 | 0)
                - ((info.rowsize / 2 | 0) * (info.xspacing + pics.alien[0][0]))
                - (pics.alien[0][0] / 2 | 0);
        const y = (info.yspacing + pics.alien[0][1]) * ((n / info.rowsize) | 0)
                + MINGAMEY + 20;
        alien.push({
          picnum, picnumi,
          type: 0, haspill: 0, loose: 0,
          strength: info.strength,
          pic, x, y, xi: 1, yi: 0,
          xsize: pic[0], ysize: pic[1],
        });
        drawalien(x, y, pic, 0);
      }

      if (holdpill > -1) { pill.type = holdpill; usePill(); }
      holdpill = -1;

      let dt = timing.counter();

      while (!done && ((alien.length || pillexists) && ship.lives)) {
        if (ship.strength < 100) ship.strength++;
        if (ship.strength < 0) {
          ship.strength = 100;
          vga.box(INFOMINX + 5*(ship.lives-1), INFOMAXY,
                  INFOMINX + 5*(ship.lives-1) + 1, INFOMAXY - 25, 0, 0);
          ship.lives--;
        }
        if (ship.lives > 0) {
          vga.box(INFOMINX + 5*(ship.lives-1), INFOMAXY,
                  INFOMINX + 5*(ship.lives-1) + 1,
                  INFOMAXY - (ship.strength / 4 | 0), 14, 0);
          vga.box(INFOMINX + 5*(ship.lives-1), INFOMAXY - (ship.strength / 4 | 0),
                  INFOMINX + 5*(ship.lives-1) + 1, INFOMAXY - 25, 0, 0);
        }

        if (pilltally < 2 * PILL_PROBABILITY) pilltally++;
        if (pilltally >= 2 * PILL_PROBABILITY &&
            !(pillexists || (Math.random() * PILL_PROBABILITY | 0))) {
          let n = 0;
          if (pillhad) {
            if (!(Math.random() * 5 | 0)) {
              for (n = 0; n < alien.length; n++) {
                if (alien[n].haspill) {
                  alien[n].haspill = 0;
                  highlightPilltype(newpilltype, 0);
                  break;
                }
              }
            } else {
              n = -1;
            }
          }
          if (n !== -1) {
            pillhad = 1;
            const m = Math.random() * alien.length | 0;
            pilltally = 0;
            alien[m].haspill = 1;
            newpilltype = Math.random() * NUMPILLTYPES | 0;
            highlightPilltype(newpilltype, 1);
          }
        }

        handlePill();
        handleShotsAndAliens();
        score++;
        vga.drawtext(INFOMINX, INFOMINY + vga.yfontsize, String(score), 15, 0);
        if (score > hiscore) {
          hiscore = score;
          vga.drawtext(INFOMINX, INFOMINY + (3.5 * vga.yfontsize | 0), String(score), 15, 0);
        }
        if (shotmade > 0) shotmade--;

        if (input.buttonpressed() && !shotmade) {
          shotmade = shotSpacing;
          shoot(guntype);
        }
        handleShip();

        const t = timing.counter();
        while (timing.counter() === t) await timing.nextFrame();
        cyclePalette();
        dt = t;
        handleExplosions();
        if (input.kbhit()) handleKeypress();
      }
    }
    return score;
  } finally {
    input.setWantLock(false);
  }
}
