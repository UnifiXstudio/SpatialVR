// windows-server/src/index.js
const express = require('express');
const http = require('http');
const https = require('https');
const { WebSocketServer } = require('ws');
const path = require('path');
const cors = require('cors');
const qrcode = require('qrcode');

const ScreenCapturer = require('./capture');
const input = require('./input');
const { getLocalIPAddresses, getOrCreateCertificates } = require('./network');

const HTTP_PORT = process.env.HTTP_PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// Initialize Win32 Input API
input.init();

const app = express();
app.use(cors());
app.use(express.json());

// Serve static web spatial client
const publicDir = path.join(__dirname, '..', '..', 'web-spatial-client');
app.use(express.static(publicDir));

// Screen capturer instance
const capturer = new ScreenCapturer({
  fps: 45,
  quality: 70,
  scale: 0.65
});

// Setup WebSocket servers
const wssStream = new WebSocketServer({ noServer: true });
const wssControl = new WebSocketServer({ noServer: true });

let streamClients = new Set();
let controlClients = new Set();

// Forward frames to connected streaming clients
let frameCounter = 0;
let lastFpsCheck = Date.now();
let currentBroadcastFps = 0;

capturer.on('frame', (jpegBuffer) => {
  frameCounter++;
  const now = Date.now();
  if (now - lastFpsCheck >= 1000) {
    currentBroadcastFps = frameCounter;
    frameCounter = 0;
    lastFpsCheck = now;
  }

  for (const client of streamClients) {
    if (client.readyState === 1) { // OPEN
      try {
        client.send(jpegBuffer);
      } catch (err) {
        // client write error
      }
    }
  }
});

// Handle WebSocket upgrades
function handleUpgrade(request, socket, head) {
  const { pathname } = new URL(request.url, `http://${request.headers.host}`);
  if (pathname === '/stream') {
    wssStream.handleUpgrade(request, socket, head, (ws) => {
      wssStream.emit('connection', ws, request);
    });
  } else if (pathname === '/control') {
    wssControl.handleUpgrade(request, socket, head, (ws) => {
      wssControl.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
}

// Stream WS events
wssStream.on('connection', (ws) => {
  streamClients.add(ws);
  capturer.setClientCount(streamClients.size);
  console.log(`[Stream] Client connected. Active stream clients: ${streamClients.size}`);

  ws.on('close', () => {
    streamClients.delete(ws);
    capturer.setClientCount(streamClients.size);
    console.log(`[Stream] Client disconnected. Active stream clients: ${streamClients.size}`);
  });

  ws.on('error', () => {
    streamClients.delete(ws);
    capturer.setClientCount(streamClients.size);
  });
});

// Control WS events
wssControl.on('connection', (ws) => {
  controlClients.add(ws);
  console.log(`[Control] Client connected.`);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'mouse_move') {
        input.setCursor(data.x, data.y, data.isNormalized !== false);
      } else if (data.type === 'mouse_button') {
        input.mouseButton(data.action || 'click', data.button || 'left');
      } else if (data.type === 'mouse_scroll') {
        input.scrollWheel(data.deltaY || 0, data.deltaX || 0);
      } else if (data.type === 'key') {
        input.sendKey(data.code, data.isUp);
      } else if (data.type === 'ping') {
        ws.send(JSON.stringify({
          type: 'pong',
          clientTime: data.clientTime,
          serverTime: Date.now(),
          fps: currentBroadcastFps
        }));
      }
    } catch (err) {
      console.warn('[Control] Error processing message:', err.message);
    }
  });

  ws.on('close', () => {
    controlClients.delete(ws);
    console.log('[Control] Client disconnected.');
  });
});

// REST API endpoints
app.get('/api/status', (req, res) => {
  const screenSize = input.getScreenSize();
  res.json({
    status: 'online',
    screen: screenSize,
    fps: currentBroadcastFps,
    targetFps: capturer.fps,
    quality: capturer.quality,
    scale: capturer.scale,
    streamClients: streamClients.size,
    controlClients: controlClients.size
  });
});

app.post('/api/settings', (req, res) => {
  const { fps, quality, scale } = req.body;
  capturer.updateSettings({ fps, quality, scale });
  res.json({ success: true, fps: capturer.fps, quality: capturer.quality, scale: capturer.scale });
});

async function startServer() {
  const httpServer = http.createServer(app);
  httpServer.on('upgrade', handleUpgrade);

  let httpsServer = null;
  try {
    const certs = await getOrCreateCertificates();
    httpsServer = https.createServer(certs, app);
    httpsServer.on('upgrade', handleUpgrade);
  } catch (err) {
    console.warn('[HTTPS] Could not initialize HTTPS server:', err.message);
  }

  const localIPs = getLocalIPAddresses();
  const primaryIP = localIPs.length > 0 ? localIPs[0].address : 'localhost';

  httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`🚀 SPATIAL VR DESKTOP SERVER RUNNING`);
    console.log(`======================================================`);
    console.log(`📡 Local Web Client (HTTP):  http://${primaryIP}:${HTTP_PORT}`);
    if (httpsServer) {
      console.log(`🔒 Spatial AR/VR (HTTPS):    https://${primaryIP}:${HTTPS_PORT}`);
      console.log(`   (Použijte HTTPS na iPhonu pro přístup k AR a gyroskopu)`);
    }
    console.log(`🖥️ Screen Resolution:       ${input.getScreenSize().width}x${input.getScreenSize().height}`);
    console.log(`======================================================\n`);

    const urlToScan = httpsServer ? `https://${primaryIP}:${HTTPS_PORT}` : `http://${primaryIP}:${HTTP_PORT}`;
    qrcode.toString(urlToScan, { type: 'terminal', small: true }, (err, qr) => {
      if (!err) {
        console.log('📱 Naskenujte tento QR kód fotoaparátem iPhonu:');
        console.log(qr);
        console.log(`Nebo otevřete v Safari: ${urlToScan}\n`);
      }
    });
  });

  if (httpsServer) {
    httpsServer.listen(HTTPS_PORT, '0.0.0.0');
  }
}

startServer();
