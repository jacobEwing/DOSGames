// hscr.js — high score persistence via localStorage.
//
// The original wrote a flat text file with alternating name/score lines.
// We keep the same data in JSON form; the file format itself is gone.
const KEY = 'invaders.highscores';
const MAX = 10;

export function loadScores() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(e => e && typeof e.name === 'string' && Number.isFinite(e.score))
      .slice(0, MAX);
  } catch (_) {
    return [];
  }
}

export function saveScores(scores) {
  try { localStorage.setItem(KEY, JSON.stringify(scores.slice(0, MAX))); }
  catch (_) { /* ignore quota / privacy-mode errors */ }
}

export function topScore(scores) {
  return scores.length ? scores[0].score : 0;
}

// Insert a new score.  Returns { scores, rank } where rank is -1 if the
// score didn't make the table.
export function insertScore(scores, name, score) {
  const next = scores.slice();
  let rank = -1;
  for (let i = 0; i < next.length; i++) {
    if (next[i].score < score) { rank = i; break; }
  }
  if (rank === -1) {
    if (next.length < MAX) rank = next.length;
    else return { scores: next, rank: -1 };
  }
  next.splice(rank, 0, { name, score });
  return { scores: next.slice(0, MAX), rank };
}
