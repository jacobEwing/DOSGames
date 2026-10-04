// timing.js — fixed-step 18.2 Hz tick + rAF driver.
const TICK_MS = 1000 / 18.2;
const MAX_CATCHUP_MS = 1000;

let simTick = 0;
let lastTime = 0;
let accumulator = 0;
let presentFn = null;
let running = false;
let tickWaiters = [];

export function counter() { return simTick; }
export function nextTick() { return new Promise(resolve => tickWaiters.push(resolve)); }
export function nextFrame() { return new Promise(resolve => requestAnimationFrame(resolve)); }

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
    const waiters = tickWaiters; tickWaiters = [];
    for (const w of waiters) w();
  }
  if (presentFn) presentFn();
  requestAnimationFrame(loop);
}
