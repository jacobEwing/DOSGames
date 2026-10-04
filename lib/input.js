// input.js — DOS-style keyboard + mouse, with Pointer Lock.
const KEY_QUEUE = [];
const MAX_QUEUE = 64;

let mouseAccumX = 0, mouseAccumY = 0;
let mouseButtons = 0;
let cursorX = 160, cursorY = 100;
let canvasEl = null;
let targetEl = null;
let wantLock = false;
let locked = false;
let lockSupported = false;

const EXT_MAP = {
  ArrowUp: 72, ArrowDown: 80, ArrowLeft: 75, ArrowRight: 77,
  Home: 71, End: 79, PageUp: 73, PageDown: 81, Insert: 82, Delete: 83,
  F1: 59, F2: 60, F3: 61, F4: 62, F5: 63, F6: 64,
  F7: 65, F8: 66, F9: 67, F10: 68, F11: 87, F12: 88,
};
const PREVENT = new Set([
  ' ', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Home', 'End', 'PageUp', 'PageDown',
  'F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12',
]);

function pushKey(b) { if (KEY_QUEUE.length < MAX_QUEUE) KEY_QUEUE.push(b & 0xff); }

function onKeyDown(e) {
  if (PREVENT.has(e.key)) e.preventDefault();
  if (e.repeat) return;
  if (e.key.length === 1) pushKey(e.key.charCodeAt(0));
  else if (e.key === 'Escape')    pushKey(27);
  else if (e.key === 'Enter')     pushKey(13);
  else if (e.key === 'Backspace') pushKey(8);
  else if (e.key === 'Tab')       pushKey(9);
  else if (EXT_MAP[e.key] !== undefined) { pushKey(0); pushKey(EXT_MAP[e.key]); }
}

function updateCursor(e) {
  if (!canvasEl) return;
  const rect = canvasEl.getBoundingClientRect();
  const scaleX = 320 / rect.width;
  const scaleY = 200 / rect.height;
  const dx = e.movementX * scaleX;
  const dy = e.movementY * scaleY;
  mouseAccumX += dx; mouseAccumY += dy;
  cursorX += dx; cursorY += dy;
  if (cursorX < 0) cursorX = 0;
  if (cursorX > 319) cursorX = 319;
  if (cursorY < 0) cursorY = 0;
  if (cursorY > 199) cursorY = 199;
}

function onMouseDown(e) {
  mouseButtons |= (1 << e.button);
  if (targetEl) e.preventDefault();
  if (wantLock && !locked && lockSupported) canvasEl.requestPointerLock();
}
function onMouseUp(e) { mouseButtons &= ~(1 << e.button); }
function onMouseMove(e) {
  if (e.movementX !== undefined) updateCursor(e);
  else {
    const rect = canvasEl.getBoundingClientRect();
    const nx = (e.clientX - rect.left) * 320 / rect.width;
    const ny = (e.clientY - rect.top)  * 200 / rect.height;
    mouseAccumX += nx - cursorX; mouseAccumY += ny - cursorY;
    cursorX = nx; cursorY = ny;
  }
}
function onPointerLockChange() { locked = (document.pointerLockElement === canvasEl); }

export function initInput(canvas, target = window) {
  canvasEl = canvas;
  targetEl = target;
  lockSupported = 'requestPointerLock' in Element.prototype;
  window.addEventListener('keydown', onKeyDown);
  target.addEventListener('mousedown', onMouseDown);
  target.addEventListener('mouseup',   onMouseUp);
  target.addEventListener('mousemove', onMouseMove);
  target.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('pointerlockchange', onPointerLockChange);
}

export function kbhit() { return KEY_QUEUE.length > 0; }
export function getch() { return KEY_QUEUE.length ? KEY_QUEUE.shift() : 0; }

export function readmousediff() {
  const d = { x: Math.round(mouseAccumX), y: Math.round(mouseAccumY) };
  mouseAccumX -= d.x; mouseAccumY -= d.y;
  return d;
}
export function readmousepos() {
  // Original returned the raw 640x200 mickey counts.  We store position in
  // 320x200 screen space, so the raw form is just x*2.
  return { x: cursorX * 2, y: cursorY };
}
export function buttonpressed() { return mouseButtons !== 0; }
export function mousex() { return cursorX | 0; }
export function mousey() { return cursorY | 0; }
export function setMousePos(x, y) {
  cursorX = Math.max(0, Math.min(319, x));
  cursorY = Math.max(0, Math.min(199, y));
}
export function setMouseLimits(_x1, _y1, _x2, _y2) {}
export function showMouse(_onoff) {}
export function setWantLock(want) {
  wantLock = want;
  if (!want && document.pointerLockElement) document.exitPointerLock();
}
export function isPointerLocked() { return locked; }

// Returns the same bitmask DOS INT 33h AX=3 returns: bit 0 = left,
// bit 1 = right.  Middle button is ignored, matching the original.
export function buttonmask() {
  let m = 0;
  if (mouseButtons & 1) m |= 1;  // DOM button 0 = left
  if (mouseButtons & 4) m |= 2;  // DOM button 2 = right
  return m;
}
