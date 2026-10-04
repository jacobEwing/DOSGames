// timing.js
// Fixed-step clock at 18.2 Hz (one BIOS tick), plus a per-frame driver.

const TICK_MS = 1000 / 18.2;   // ≈ 54.945 ms
const MAX_CATCHUP_MS = 1000;

let simTick = 0;
let lastTime = 0;
let accumulator = 0;
let presentFn = null;
let running = false;

let tickWaiters = [];

export function counter() {
  // The original returned a 16-bit value; anything that fits in a JS number is fine.
  return simTick;
}

export function nextTick() {
  return new Promise(resolve => tickWaiters.push(resolve));
}

// Resolves on the next requestAnimationFrame — used by input polling loops
// that need to run faster than the 18.2 Hz game tick.
export function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(resolve));
}

export function startLoop(present) {
  presentFn = present;
  running = true;
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

export function stopLoop() { running = false; }

function loop(now) {
  if (!running) return;

  let dt = now - lastTime;
  lastTime = now;
  if (dt > MAX_CATCHUP_MS) dt = MAX_CATCHUP_MS;
  accumulator += dt;

  let advanced = false;
  while (accumulator >= TICK_MS) {
    accumulator -= TICK_MS;
    simTick++;
    advanced = true;
  }

  if (advanced) {
    const waiters = tickWaiters;
    tickWaiters = [];
    for (const w of waiters) w();
  }

  if (presentFn) presentFn();
  requestAnimationFrame(loop);
}
