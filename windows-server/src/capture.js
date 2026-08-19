// windows-server/src/capture.js
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');
let screenshotDesktop = null;
try {
  screenshotDesktop = require('screenshot-desktop');
} catch (e) {}

class ScreenCapturer extends EventEmitter {
  constructor(options = {}) {
    super();
    this.fps = options.fps || 45;
    this.quality = options.quality || 65;
    this.scale = options.scale || 0.65;
    this.active = false;
    this.capturerProcess = null;
    this.fallbackTimer = null;
    this.clientCount = 0;
    this.binaryPath = path.join(__dirname, '..', 'bin', 'native-capturer.exe');
  }

  setClientCount(count) {
    this.clientCount = count;
    if (this.clientCount > 0 && !this.active) {
      this.start();
    } else if (this.clientCount === 0 && this.active) {
      this.stop();
    }
  }

  start() {
    if (this.active) return;
    this.active = true;

    if (fs.existsSync(this.binaryPath)) {
      this._startNativeCapturer();
    } else {
      console.log('[Capture] Native capturer binary not found, using JS fallback.');
      this._startFallbackCapturer();
    }
  }

  _startNativeCapturer() {
    console.log(`[Capture] Launching native capturer: FPS=${this.fps}, Quality=${this.quality}%, Scale=${this.scale}`);
    this.capturerProcess = spawn(this.binaryPath, [
      '--fps', this.fps.toString(),
      '--quality', this.quality.toString(),
      '--scale', this.scale.toString()
    ]);

    let buffer = Buffer.alloc(0);
    let expectedLength = 0;

    this.capturerProcess.stdout.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);

      while (true) {
        if (expectedLength === 0) {
          if (buffer.length < 8) break;
          // Check magic header 'FRM1'
          if (buffer[0] === 0x46 && buffer[1] === 0x52 && buffer[2] === 0x4D && buffer[3] === 0x31) {
            expectedLength = (buffer[4] << 24) | (buffer[5] << 16) | (buffer[6] << 8) | buffer[7];
            buffer = buffer.subarray(8);
          } else {
            // Out of sync, scan for next header
            const idx = buffer.indexOf(Buffer.from('FRM1'));
            if (idx !== -1) {
              buffer = buffer.subarray(idx);
            } else {
              buffer = Buffer.alloc(0);
            }
            break;
          }
        }

        if (expectedLength > 0 && buffer.length >= expectedLength) {
          const frameBuffer = buffer.subarray(0, expectedLength);
          buffer = buffer.subarray(expectedLength);
          expectedLength = 0;
          this.emit('frame', frameBuffer);
        } else {
          break;
        }
      }
    });

    this.capturerProcess.stderr.on('data', (data) => {
      console.log(`[NativeCapturer] ${data.toString().trim()}`);
    });

    this.capturerProcess.on('exit', (code) => {
      console.log(`[Capture] Native capturer exited with code ${code}`);
      this.capturerProcess = null;
      if (this.active && this.clientCount > 0) {
        this._startFallbackCapturer();
      }
    });
  }

  _startFallbackCapturer() {
    if (!screenshotDesktop) return;
    const interval = Math.max(20, Math.floor(1000 / this.fps));
    const captureLoop = async () => {
      if (!this.active) return;
      try {
        const img = await screenshotDesktop({ format: 'jpeg' });
        this.emit('frame', img);
      } catch (err) {
        // silent capture error
      }
      if (this.active) {
        this.fallbackTimer = setTimeout(captureLoop, interval);
      }
    };
    captureLoop();
  }

  stop() {
    this.active = false;
    if (this.capturerProcess) {
      try {
        this.capturerProcess.kill();
      } catch (e) {}
      this.capturerProcess = null;
    }
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    console.log('[Capture] Stopped capturing (idle, 0% CPU).');
  }

  updateSettings(newSettings = {}) {
    let restartNeeded = false;
    if (newSettings.fps && newSettings.fps !== this.fps) {
      this.fps = newSettings.fps;
      restartNeeded = true;
    }
    if (newSettings.quality && newSettings.quality !== this.quality) {
      this.quality = newSettings.quality;
      restartNeeded = true;
    }
    if (newSettings.scale && newSettings.scale !== this.scale) {
      this.scale = newSettings.scale;
      restartNeeded = true;
    }
    if (restartNeeded && this.active) {
      this.stop();
      this.start();
    }
  }
}

module.exports = ScreenCapturer;
