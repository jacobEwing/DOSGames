// assets.js — picture loading for Invaders.  All filenames lowercase.
import { loadPic } from 'lib/assets.js';

export const pics = {
  bomber: null,
  title: null,
  letters: new Array(8).fill(null),
  shots: new Array(4).fill(null),    // [0]=alien bomb, [1..3]=player
  ships: new Array(4).fill(null),
  pill: null,
  pillTypes: new Array(8).fill(null),
  explosions: new Array(3).fill(null),
  alien: new Array(4).fill(null),
  backg: null,
};

const BASE = new URL('../assets/', import.meta.url);
const url = (name) => new URL(name, BASE).href;

export async function loadAllPictures() {
  const letterNames = ['i.pic','n.pic','v.pic','a.pic','d.pic','e.pic','r.pic','s.pic'];
  const [bomber, title, letters, s2, s3, s1, sh1, sh2, sh3, sh4, pill, pillTypes,
         ex1, ex2, ex3] = await Promise.all([
    loadPic(url('bomber.pic')),
    loadPic(url('title.pic')),
    Promise.all(letterNames.map(f => loadPic(url(f)))),
    loadPic(url('shot2.pic')),
    loadPic(url('shot3.pic')),
    loadPic(url('shot1.pic')),
    loadPic(url('ship1.pic')),
    loadPic(url('ship2.pic')),
    loadPic(url('ship3.pic')),
    loadPic(url('ship4.pic')),
    loadPic(url('pill.pic')),
    Promise.all(Array.from({length: 8}, (_, i) => loadPic(url(`ptype${i+1}.pic`)))),
    loadPic(url('explode1.pic')),
    loadPic(url('explode2.pic')),
    loadPic(url('explode3.pic')),
  ]);
  pics.bomber = bomber; pics.title = title;
  for (let i = 0; i < 8; i++) pics.letters[i] = letters[i];
  pics.shots[1] = s2; pics.shots[2] = s3; pics.shots[3] = s1;
  pics.ships[0] = sh1; pics.ships[1] = sh2; pics.ships[2] = sh3; pics.ships[3] = sh4;
  pics.pill = pill;
  for (let i = 0; i < 8; i++) pics.pillTypes[i] = pillTypes[i];
  pics.explosions[0] = ex1; pics.explosions[1] = ex2; pics.explosions[2] = ex3;
}

export async function loadLevelPictures(levelnum) {
  const [bg, a, b, c, d, bomb] = await Promise.all([
    loadPic(url(`backg${levelnum}.pic`)),
    loadPic(url(`alien${levelnum}a.pic`)),
    loadPic(url(`alien${levelnum}b.pic`)),
    loadPic(url(`alien${levelnum}c.pic`)),
    loadPic(url(`alien${levelnum}d.pic`)),
    loadPic(url(`bomb${levelnum}.pic`)),
  ]);
  pics.backg = bg;
  pics.alien[0] = a; pics.alien[1] = b; pics.alien[2] = c; pics.alien[3] = d;
  pics.shots[0] = bomb;
}

export async function loadMenuAliens() {
  const [a, b, c, d] = await Promise.all([
    loadPic(url('alien6a.pic')),
    loadPic(url('alien6b.pic')),
    loadPic(url('alien6c.pic')),
    loadPic(url('alien6d.pic')),
  ]);
  pics.alien[0] = a; pics.alien[1] = b; pics.alien[2] = c; pics.alien[3] = d;
}
