// web-spatial-client/app.js
// Spatial AR/VR Desktop Client for iPhone and WebXR

(function() {
  'use strict';

  // State
  let currentMode = '2d'; // '2d', 'ar', 'vr'
  let isConnected = false;
  let currentEnv = 'grid';

  // Config
  let screenDistance = 2.2;
  let screenScale = 1.5;
  let screenCurvature = 25; // degrees of curve
  let ipd = 0.064; // 64mm in meters

  // Three.js instances
  let scene, camera, renderer;
  let leftCamera, rightCamera;
  let monitorMesh, monitorMaterial, monitorTexture;
  let envGroup;
  let raycaster, gazeTargetUV = null;

  // Gaze dwell click
  let gazeDwellStart = 0;
  const GAZE_DWELL_TIME_MS = 1200;
  let lastGazePoint = null;

  // Device orientation
  let baseOrientationQuat = new THREE.Quaternion();
  let deviceQuat = new THREE.Quaternion();
  let hasGyro = false;

  // Video / Stream
  let wsStream = null;
  let wsControl = null;
  let frameCount = 0;
  let lastFpsTime = performance.now();
  let currentFps = 0;
  let lastPingTime = 0;

  // DOM Elements
  const glCanvas = document.getElementById('glCanvas');
  const arVideo = document.getElementById('arVideo');
  const gazePointer = document.getElementById('gazePointer');
  const gazeCircle = document.getElementById('gazeCircle');
  const connStatus = document.getElementById('connStatus');
  const fpsCounter = document.getElementById('fpsCounter');
  const pingCounter = document.getElementById('pingCounter');
  const topBar = document.getElementById('topBar');
  const modeBar = document.getElementById('modeBar');
  const vrDivider = document.getElementById('vrDivider');
  const settingsModal = document.getElementById('settingsModal');

  // Initialize
  window.addEventListener('DOMContentLoaded', () => {
    init3D();
    initUI();
    initWebSockets();
    animate();
  });

  // -------------------------------------------------------------
  // 1. Three.js Scene Setup
  // -------------------------------------------------------------
  function init3D() {
    scene = new THREE.Scene();

    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(70, aspect, 0.1, 100);
    camera.position.set(0, 0, 0);

    // VR Stereo cameras
    leftCamera = new THREE.PerspectiveCamera(70, aspect / 2, 0.1, 100);
    rightCamera = new THREE.PerspectiveCamera(70, aspect / 2, 0.1, 100);

    renderer = new THREE.WebGLRenderer({
      canvas: glCanvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0); // Transparent for AR

    raycaster = new THREE.Raycaster();

    // Default Canvas Texture for Monitor
    const canvas2d = document.createElement('canvas');
    canvas2d.width = 1920;
    canvas2d.height = 1080;
    const ctx = canvas2d.getContext('2d');
    ctx.fillStyle = '#101420';
    ctx.fillRect(0, 0, 1920, 1080);
    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Čekání na obraz ze serveru Windows...', 960, 540);

    monitorTexture = new THREE.CanvasTexture(canvas2d);
    monitorTexture.minFilter = THREE.LinearFilter;
    monitorTexture.magFilter = THREE.LinearFilter;
    monitorTexture.generateMipmaps = false;

    monitorMaterial = new THREE.MeshBasicMaterial({
      map: monitorTexture,
      side: THREE.DoubleSide
    });

    createCurvedMonitor();
    createEnvironment(currentEnv);

    window.addEventListener('resize', onWindowResize);
  }

  function createCurvedMonitor() {
    if (monitorMesh) {
      scene.remove(monitorMesh);
      if (monitorMesh.geometry) monitorMesh.geometry.dispose();
    }

    const width = 2.4 * screenScale;
    const height = 1.35 * screenScale;
    const segments = 48;
    const curveRad = (screenCurvature * Math.PI) / 180;

    let geometry;
    if (curveRad < 0.05) {
      geometry = new THREE.PlaneGeometry(width, height, 1, 1);
    } else {
      // Create curved cylindrical arc geometry
      const radius = width / curveRad;
      geometry = new THREE.CylinderGeometry(
        radius, radius, height, segments, 1, true,
        Math.PI * 1.5 - curveRad / 2, curveRad
      );
      // Flip normals inside so cylinder faces camera
      geometry.scale(-1, 1, 1);
    }

    monitorMesh = new THREE.Mesh(geometry, monitorMaterial);
    monitorMesh.position.set(0, 0, -screenDistance);
    scene.add(monitorMesh);
  }

  function createEnvironment(type) {
    if (envGroup) {
      scene.remove(envGroup);
    }
    envGroup = new THREE.Group();

    if (currentMode === 'ar') {
      scene.add(envGroup);
      return; // No virtual environment in AR mode
    }

    if (type === 'grid') {
      const grid = new THREE.GridHelper(30, 30, 0x00f0ff, 0x1f2b45);
      grid.position.y = -1.2;
      envGroup.add(grid);

      // Top ceiling grid
      const ceilingGrid = new THREE.GridHelper(30, 30, 0x9d4edd, 0x111625);
      ceilingGrid.position.y = 3.5;
      envGroup.add(ceilingGrid);
    } else if (type === 'cinema') {
      // Dark movie room floor
      const floorGeo = new THREE.PlaneGeometry(20, 20);
      const floorMat = new THREE.MeshBasicMaterial({ color: 0x06070a });
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -1.2;
      envGroup.add(floor);
    } else if (type === 'gradient') {
      // Particle stars
      const starGeo = new THREE.BufferGeometry();
      const starCount = 300;
      const positions = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 20;
        positions[i + 1] = (Math.random() - 0.5) * 20;
        positions[i + 2] = (Math.random() - 0.5) * 20;
      }
      starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const starMat = new THREE.PointsMaterial({ color: 0x5588cc, size: 0.08 });
      const stars = new THREE.Points(starGeo, starMat);
      envGroup.add(stars);
    }

    scene.add(envGroup);
  }

  function onWindowResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    leftCamera.aspect = (w / 2) / h;
    leftCamera.updateProjectionMatrix();

    rightCamera.aspect = (w / 2) / h;
    rightCamera.updateProjectionMatrix();

    renderer.setSize(w, h);
  }

  // -------------------------------------------------------------
  // 2. WebSocket Video Streaming & Control
  // -------------------------------------------------------------
  function initWebSockets() {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;

    connectStream(`${proto}//${host}/stream`);
    connectControl(`${proto}//${host}/control`);
  }

  function connectStream(url) {
    connStatus.textContent = 'Připojování...';
    connStatus.className = 'badge connecting';

    wsStream = new WebSocket(url);
    wsStream.binaryType = 'blob';

    wsStream.onopen = () => {
      isConnected = true;
      connStatus.textContent = 'Online';
      connStatus.className = 'badge connected';
      console.log('[Stream] Video socket connected.');
    };

    wsStream.onmessage = (event) => {
      frameCount++;
      const now = performance.now();
      if (now - lastFpsTime >= 1000) {
        currentFps = frameCount;
        frameCount = 0;
        lastFpsTime = now;
        fpsCounter.textContent = `${currentFps} FPS`;
      }

      if (event.data instanceof Blob) {
        const blobUrl = URL.createObjectURL(event.data);
        const img = new Image();
        img.onload = () => {
          if (monitorTexture.image !== img) {
            monitorTexture.image = img;
            monitorTexture.needsUpdate = true;
          }
          URL.revokeObjectURL(blobUrl);
        };
        img.src = blobUrl;
      }
    };

    wsStream.onclose = () => {
      isConnected = false;
      connStatus.textContent = 'Odpojeno';
      connStatus.className = 'badge connecting';
      setTimeout(() => connectStream(url), 2000);
    };
  }

  function connectControl(url) {
    wsControl = new WebSocket(url);

    wsControl.onopen = () => {
      console.log('[Control] Control socket connected.');
      // Ping interval
      setInterval(() => {
        if (wsControl.readyState === WebSocket.OPEN) {
          lastPingTime = performance.now();
          wsControl.send(JSON.stringify({ type: 'ping', clientTime: Date.now() }));
        }
      }, 1000);
    };

    wsControl.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'pong') {
          const rtt = Math.round(performance.now() - lastPingTime);
          pingCounter.textContent = `${rtt} ms`;
        }
      } catch (e) {}
    };

    wsControl.onclose = () => {
      setTimeout(() => connectControl(url), 2000);
    };
  }

  function sendControl(data) {
    if (wsControl && wsControl.readyState === WebSocket.OPEN) {
      wsControl.send(JSON.stringify(data));
    }
  }

  // -------------------------------------------------------------
  // 3. Sensor & Orientation Engine (ARKit / DeviceOrientation)
  // -------------------------------------------------------------
  function setupDeviceOrientation() {
    if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then(response => {
          if (response === 'granted') {
            window.addEventListener('deviceorientation', onOrientationChange, true);
            hasGyro = true;
          }
        })
        .catch(console.error);
    } else if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', onOrientationChange, true);
      hasGyro = true;
    }
  }

  function onOrientationChange(event) {
    if (!event.alpha && !event.beta && !event.gamma) return;

    const alpha = THREE.MathUtils.degToRad(event.alpha || 0);
    const beta = THREE.MathUtils.degToRad(event.beta || 0);
    const gamma = THREE.MathUtils.degToRad(event.gamma || 0);

    const orient = window.orientation ? THREE.MathUtils.degToRad(window.orientation) : 0;

    const euler = new THREE.Euler(beta, alpha, -gamma, 'YXZ');
    deviceQuat.setFromEuler(euler);

    // Correct for screen orientation
    const q0 = new THREE.Quaternion();
    q0.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -orient);
    deviceQuat.multiply(q0);

    // Invert for camera
    const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
    deviceQuat.multiply(q1);
  }

  function recenterOrientation() {
    baseOrientationQuat.copy(deviceQuat).invert();
    console.log('[Orientation] View centered.');
  }

  // -------------------------------------------------------------
  // 4. Interaction & Gaze Raycasting
  // -------------------------------------------------------------
  function updateGazeRaycast() {
    if (currentMode === '2d') {
      gazePointer.classList.add('hidden');
      return;
    }

    gazePointer.classList.remove('hidden');

    // Raycast straight from center of view
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObject(monitorMesh);

    if (intersects.length > 0) {
      const hit = intersects[0];
      if (hit.uv) {
        gazeTargetUV = { x: hit.uv.x, y: 1.0 - hit.uv.y }; // Flip Y for Windows desktop
        sendControl({
          type: 'mouse_move',
          x: gazeTargetUV.x,
          y: gazeTargetUV.y,
          isNormalized: true
        });

        // Dwell Click Progress
        const now = performance.now();
        if (!lastGazePoint || Math.hypot(hit.uv.x - lastGazePoint.x, hit.uv.y - lastGazePoint.y) > 0.05) {
          lastGazePoint = { x: hit.uv.x, y: hit.uv.y };
          gazeDwellStart = now;
        }

        const elapsed = now - gazeDwellStart;
        const progress = Math.min(100, (elapsed / GAZE_DWELL_TIME_MS) * 100);
        gazeCircle.setAttribute('stroke-dasharray', `${progress}, 100`);

        if (elapsed >= GAZE_DWELL_TIME_MS) {
          triggerClick('left');
          gazeDwellStart = now + 500; // brief cooldown
        }
      }
    } else {
      gazeTargetUV = null;
      lastGazePoint = null;
      gazeCircle.setAttribute('stroke-dasharray', '0, 100');
    }
  }

  function triggerClick(button = 'left') {
    sendControl({
      type: 'mouse_button',
      action: 'click',
      button: button
    });
    // Haptic feedback if available
    if (navigator.vibrate) navigator.vibrate(20);
  }

  // -------------------------------------------------------------
  // 5. Render Loop & Mode Handlers
  // -------------------------------------------------------------
  function animate() {
    requestAnimationFrame(animate);

    // Apply orientation
    if (hasGyro) {
      const currentCamQuat = new THREE.Quaternion().copy(baseOrientationQuat).multiply(deviceQuat);
      camera.quaternion.copy(currentCamQuat);
      leftCamera.quaternion.copy(currentCamQuat);
      rightCamera.quaternion.copy(currentCamQuat);
    }

    updateGazeRaycast();

    // Render mode
    const w = window.innerWidth;
    const h = window.innerHeight;

    if (currentMode === 'vr') {
      // Stereoscopic Side-by-Side
      renderer.setScissorTest(true);

      // Left Eye
      leftCamera.position.set(-ipd / 2, 0, 0);
      renderer.setViewport(0, 0, w / 2, h);
      renderer.setScissor(0, 0, w / 2, h);
      renderer.render(scene, leftCamera);

      // Right Eye
      rightCamera.position.set(ipd / 2, 0, 0);
      renderer.setViewport(w / 2, 0, w / 2, h);
      renderer.setScissor(w / 2, 0, w / 2, h);
      renderer.render(scene, rightCamera);

      renderer.setScissorTest(false);
    } else {
      // Monoscopic 2D / AR
      renderer.setViewport(0, 0, w, h);
      renderer.render(scene, camera);
    }
  }

  // -------------------------------------------------------------
  // 6. UI & Mode Switcher
  // -------------------------------------------------------------
  function initUI() {
    const btn2D = document.getElementById('btnMode2D');
    const btnAR = document.getElementById('btnModeAR');
    const btnVR = document.getElementById('btnModeVR');
    const btnRecenter = document.getElementById('btnRecenter');
    const btnFullscreen = document.getElementById('btnFullscreen');
    const btnSettings = document.getElementById('btnSettings');
    const btnCloseSettings = document.getElementById('btnCloseSettings');
    const btnRequestGyro = document.getElementById('btnRequestGyro');

    const sliderCurvature = document.getElementById('sliderCurvature');
    const sliderDistance = document.getElementById('sliderDistance');
    const sliderScale = document.getElementById('sliderScale');
    const sliderIPD = document.getElementById('sliderIPD');
    const envSelect = document.getElementById('envSelect');

    btn2D.addEventListener('click', () => setMode('2d'));
    btnAR.addEventListener('click', () => setMode('ar'));
    btnVR.addEventListener('click', () => setMode('vr'));
    btnRecenter.addEventListener('click', recenterOrientation);

    btnFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    btnSettings.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    btnCloseSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));
    btnRequestGyro.addEventListener('click', () => {
      setupDeviceOrientation();
      settingsModal.classList.add('hidden');
    });

    sliderCurvature.addEventListener('input', (e) => {
      screenCurvature = parseFloat(e.target.value);
      document.getElementById('valCurvature').textContent = `${screenCurvature}°`;
      createCurvedMonitor();
    });

    sliderDistance.addEventListener('input', (e) => {
      screenDistance = parseFloat(e.target.value);
      document.getElementById('valDistance').textContent = `${screenDistance.toFixed(1)} m`;
      createCurvedMonitor();
    });

    sliderScale.addEventListener('input', (e) => {
      screenScale = parseFloat(e.target.value);
      document.getElementById('valScale').textContent = `${screenScale.toFixed(1)}x`;
      createCurvedMonitor();
    });

    sliderIPD.addEventListener('input', (e) => {
      ipd = parseFloat(e.target.value) / 1000.0;
      document.getElementById('valIPD').textContent = `${e.target.value} mm`;
    });

    envSelect.addEventListener('change', (e) => {
      currentEnv = e.target.value;
      createEnvironment(currentEnv);
    });

    // Tap anywhere on screen to click in VR/AR mode
    window.addEventListener('pointerdown', (e) => {
      if (e.target.closest('#topBar') || e.target.closest('#modeBar') || e.target.closest('#settingsModal')) {
        return;
      }
      if (currentMode === '2d') {
        // Direct touch raycast
        const rect = glCanvas.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);
        const hits = raycaster.intersectObject(monitorMesh);
        if (hits.length > 0 && hits[0].uv) {
          sendControl({
            type: 'mouse_move',
            x: hits[0].uv.x,
            y: 1.0 - hits[0].uv.y,
            isNormalized: true
          });
          triggerClick(e.button === 2 ? 'right' : 'left');
        }
      } else {
        triggerClick('left');
      }
    });
  }

  function setMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));

    if (mode === '2d') {
      document.getElementById('btnMode2D').classList.add('active');
      stopARCamera();
      vrDivider.classList.add('hidden');
      topBar.style.opacity = '1';
      modeBar.style.opacity = '1';
    } else if (mode === 'ar') {
      document.getElementById('btnModeAR').classList.add('active');
      startARCamera();
      vrDivider.classList.add('hidden');
      setupDeviceOrientation();
    } else if (mode === 'vr') {
      document.getElementById('btnModeVR').classList.add('active');
      stopARCamera();
      vrDivider.classList.remove('hidden');
      setupDeviceOrientation();
      // Auto enter fullscreen
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    }

    createEnvironment(currentEnv);
    onWindowResize();
  }

  function startARCamera() {
    arVideo.style.display = 'block';
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      })
      .then(stream => {
        arVideo.srcObject = stream;
      })
      .catch(err => {
        console.warn('[AR] Camera permission or device error:', err);
      });
    }
  }

  function stopARCamera() {
    arVideo.style.display = 'none';
    if (arVideo.srcObject) {
      arVideo.srcObject.getTracks().forEach(track => track.stop());
      arVideo.srcObject = null;
    }
  }

})();
