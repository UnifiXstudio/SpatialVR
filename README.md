# 🥽 Spatial VR Desktop – Phone to Meta Quest 3 Experience

Systém pro prostorové zobrazení (Spatial Computing) a VR, který promění **iPhone** v AR/VR headset ve stylu Meta Quest 3 nebo Apple Vision Pro a propojí jej s **Windows PC** pro bezdrátový streaming obrazovek, virtuálních monitorů a ovládání.

---

## 📁 Struktura projektu

- 🖥️ **`windows-server/`**: Windows hostitelská aplikace s ultra-rychlým záchytem obrazovky (C# .NET native capturer + Node.js WebSockets/HTTPS streaming a emulace myši Win32).
- 🌐 **`web-spatial-client/`**: WebXR / Three.js prostorový klient fungující přímo v Safari na iPhonu s podporou AR Passthrough, Stereo SBS VR a Gaze ovládání.
- 📱 **`ios-client/`**: Nativní Swift / ARKit / SceneKit projekt pro Xcode s podporou 6DoF prostorového trackingu.
- 📚 **`docs/`**: Návody k použití, nastavení VR brýlí a tipy pro nízkou latenci.
- ⚡ **`start-server.bat`**: Skript pro spuštění serveru jedním kliknutím.

---

## 🚀 Jak začít

1. Dvakrát klikněte na **`start-server.bat`**.
2. Naskenujte vygenerovaný **QR kód** fotoaparátem iPhonu.
3. V Safari povolte senzory a zvolte si **AR Passthrough** (pokoje) nebo **VR Headset** (brýle).

Podrobné návody naleznete ve složce [`docs/`](file:///c:/Users/radoj/Documents/VR/docs/).
