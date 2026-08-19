# 📱 Instalace plnohodnotné nativní iOS aplikace (.IPA) na iPhone XR z Windows

Pokud chcete na svém **iPhone XR** mít skutečnou nativní aplikaci (s ikonou v systému, napsanou ve Swiftu / ARKit), zde je přesný postup, jak ji nainstalovat přímo z vašeho Windows PC.

---

## 🛠️ Co budete potřebovat:

1. **iPhone XR** připojený kabelem k Windows PC.
2. **Sideloadly pro Windows** (nejjednodušší bezplatný program pro nahrávání nativních aplikací na iPhone) – stáhněte zdarma z [sideloadly.io](https://sideloadly.io).
3. **iTunes nebo iCloud pro Windows** (potřebné pro komunikaci Windows s iPhonem).

---

## 🚀 Postup instalace:

### Krok 1: Získání souboru `.ipa` (Nativní balíček aplikace)

Zdrojové kódy nativní iOS aplikace jsou kompletně připraveny ve složce [`ios-client/`](file:///c:/Users/radoj/Documents/VR/ios-client/).

Balíček `.ipa` můžete zkompilovat:
- **Možnost A (Automaticky v cloudu přes GitHub)**:
  - Pokud máte projekt na GitHubu, připravili jsme soubor [`.github/workflows/build-ios.yml`](file:///c:/Users/radoj/Documents/VR/.github/workflows/build-ios.yml). Po nahrání na GitHub se aplikace automaticky zdarma zkompiluje v cloudu na serverech Apple (macOS) a v záložce *Actions* si stáhnete hotový soubor `SpatialVR.ipa`.
- **Možnost B (Přes Xcode na Macu)**:
  - Otevřete [`ios-client/SpatialVR.xcodeproj`](file:///c:/Users/radoj/Documents/VR/ios-client/SpatialVR.xcodeproj) v Xcode a klikněte na **Run / Build** s připojeným iPhonem XR.

---

### Krok 2: Nahrání do iPhonu XR přes Sideloadly (na Windows)

1. Spusťte **Sideloadly** na počítači.
2. Připojte iPhone XR kabelem k PC (pokud se iPhone zeptá *"Důvěřovat tomuto počítači?"*, zvolte **Důvěřovat** a zadejte kód).
3. V Sideloadly přetáhněte soubor **`SpatialVR.ipa`** do okna programu.
4. Zadejte své **Apple ID** (slouží pro bezplatné podepsání aplikace vaším účtem přímo od Applu).
5. Klikněte na tlačítko **Start**.
6. Během 30 sekund se aplikace nainstaluje přímo do vašeho iPhonu XR!

---

### Krok 3: První spuštění na iPhonu XR

1. Po instalaci přejděte na iPhonu do:  
   **Nastavení ➔ Obecné ➔ VPN a správa zařízení**
2. Klikněte na své Apple ID a zvolte **"Důvěřovat vývojáři"**.
3. Nyní můžete na ploše iPhonu XR spustit aplikaci **SpatialVR**!

---

## ⚡ Propojení s Windows:

1. Na PC spusťte **[`start-server.bat`](file:///c:/Users/radoj/Documents/VR/start-server.bat)**.
2. V aplikaci na iPhonu XR zadejte IP adresu počítače (`172.20.10.2` nebo `192.168.100.149`).
3. Zvolte **AR (Passthrough)** nebo **VR (Brýle)** a užívejte si prostorový desktop!
