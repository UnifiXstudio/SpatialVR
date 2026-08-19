// windows-server/src/input.js
// High-performance Win32 input simulator via Koffi FFI

let user32 = null;
let SetCursorPos = null;
let mouse_event = null;
let keybd_event = null;
let GetSystemMetrics = null;

// Win32 constants
const MOUSEEVENTF_MOVE = 0x0001;
const MOUSEEVENTF_LEFTDOWN = 0x0002;
const MOUSEEVENTF_LEFTUP = 0x0004;
const MOUSEEVENTF_RIGHTDOWN = 0x0008;
const MOUSEEVENTF_RIGHTUP = 0x0010;
const MOUSEEVENTF_MIDDLEDOWN = 0x0020;
const MOUSEEVENTF_MIDDLEUP = 0x0040;
const MOUSEEVENTF_WHEEL = 0x0800;
const MOUSEEVENTF_HWHEEL = 0x1000;
const MOUSEEVENTF_ABSOLUTE = 0x8000;

const KEYEVENTF_EXTENDEDKEY = 0x0001;
const KEYEVENTF_KEYUP = 0x0002;

const SM_CXSCREEN = 0;
const SM_CYSCREEN = 1;

let isInitialized = false;

function init() {
  if (isInitialized) return true;
  try {
    const koffi = require('koffi');
    user32 = koffi.load('user32.dll');

    SetCursorPos = user32.func('bool __stdcall SetCursorPos(int X, int Y)');
    mouse_event = user32.func('void __stdcall mouse_event(uint32 dwFlags, uint32 dx, uint32 dy, uint32 dwData, uintptr_t dwExtraInfo)');
    keybd_event = user32.func('void __stdcall keybd_event(uint8 bVk, uint8 bScan, uint32 dwFlags, uintptr_t dwExtraInfo)');
    GetSystemMetrics = user32.func('int __stdcall GetSystemMetrics(int nIndex)');

    isInitialized = true;
    console.log('[Input] Win32 Input API successfully initialized via Koffi.');
    return true;
  } catch (err) {
    console.warn('[Input] Failed to load Koffi Win32 FFI:', err.message);
    return false;
  }
}

function getScreenSize() {
  if (init() && GetSystemMetrics) {
    try {
      const width = GetSystemMetrics(SM_CXSCREEN);
      const height = GetSystemMetrics(SM_CYSCREEN);
      return { width, height };
    } catch (e) {}
  }
  return { width: 1920, height: 1080 };
}

/**
 * Move mouse to absolute screen coordinates (normalized 0.0 - 1.0 or pixel coordinates)
 */
function setCursor(x, y, isNormalized = true) {
  if (!init()) return;
  try {
    const screen = getScreenSize();
    const targetX = isNormalized ? Math.round(Math.max(0, Math.min(1, x)) * screen.width) : Math.round(x);
    const targetY = isNormalized ? Math.round(Math.max(0, Math.min(1, y)) * screen.height) : Math.round(y);
    SetCursorPos(targetX, targetY);
  } catch (err) {
    console.error('[Input] setCursor error:', err.message);
  }
}

/**
 * Mouse button actions: 'down', 'up', 'click', 'right-click', 'double-click'
 */
function mouseButton(action = 'click', button = 'left') {
  if (!init()) return;

  try {
    if (button === 'left') {
      if (action === 'down') mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
      else if (action === 'up') mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
      else if (action === 'click') {
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
        setTimeout(() => mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0), 15);
      } else if (action === 'double-click') {
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
        setTimeout(() => {
          mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
          mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
        }, 50);
      }
    } else if (button === 'right') {
      if (action === 'down') mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0);
      else if (action === 'up') mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0);
      else if (action === 'click' || action === 'right-click') {
        mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0);
        setTimeout(() => mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0), 15);
      }
    } else if (button === 'middle') {
      if (action === 'down') mouse_event(MOUSEEVENTF_MIDDLEDOWN, 0, 0, 0, 0);
      else if (action === 'up') mouse_event(MOUSEEVENTF_MIDDLEUP, 0, 0, 0, 0);
      else if (action === 'click') {
        mouse_event(MOUSEEVENTF_MIDDLEDOWN, 0, 0, 0, 0);
        setTimeout(() => mouse_event(MOUSEEVENTF_MIDDLEUP, 0, 0, 0, 0), 15);
      }
    }
  } catch (err) {
    console.error('[Input] mouseButton error:', err.message);
  }
}

/**
 * Scroll wheel (vertical delta, e.g. -120 or +120)
 */
function scrollWheel(deltaY = 0, deltaX = 0) {
  if (!init()) return;
  try {
    if (deltaY !== 0) {
      mouse_event(MOUSEEVENTF_WHEEL, 0, 0, deltaY, 0);
    }
    if (deltaX !== 0) {
      mouse_event(MOUSEEVENTF_HWHEEL, 0, 0, deltaX, 0);
    }
  } catch (err) {
    console.error('[Input] scrollWheel error:', err.message);
  }
}

/**
 * Keyboard key simulation (Virtual-Key codes)
 */
function sendKey(vkCode, isUp = false) {
  if (!init()) return;
  try {
    const flags = isUp ? KEYEVENTF_KEYUP : 0;
    keybd_event(vkCode, 0, flags, 0);
  } catch (err) {
    console.error('[Input] sendKey error:', err.message);
  }
}

module.exports = {
  init,
  getScreenSize,
  setCursor,
  mouseButton,
  scrollWheel,
  sendKey
};
