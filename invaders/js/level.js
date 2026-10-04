// level.js — levels.dat parser.
let levData = null;

export async function loadLevels() {
  const r = await fetch(new URL('../assets/levels.dat', import.meta.url));
  if (!r.ok) throw new Error(`levels.dat: ${r.status}`);
  levData = new Uint8Array(await r.arrayBuffer());
}

export function numLevels() { return levData ? levData[0] : 0; }

// levelnum is 1-based.
export function readLevelInfo(levelnum) {
  const o = 1 + 9 * (levelnum - 1);
  return {
    aliens:         levData[o + 0],
    rowsize:        levData[o + 1],
    xspacing:       levData[o + 2],
    yspacing:       levData[o + 3],
    strength:       levData[o + 4],
    maxLooseAliens: levData[o + 5],
    looseProb:      10 * levData[o + 6],   // already ×10 in C
    flags:          levData[o + 7],
    minshipy:       levData[o + 8],
  };
}

export function decodeLevelFlags(c) {
  let alienstyle = 0, cycling = 0, synchronized = 0;
  if (c - 4 >= 0) { c -= 4; alienstyle = 1; }
  if (c - 2 >= 0) { c -= 2; cycling = 1; }
  if (c - 1 >= 0) { synchronized = 1; }
  return { alienstyle, cycling, synchronized };
}
