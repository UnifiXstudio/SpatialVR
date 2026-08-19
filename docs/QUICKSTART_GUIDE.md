# 🚀 Rychlý návod: Spuštění Spatial VR (Windows & iPhone)

Tento systém vám umožní proměnit váš iPhone v AR/VR prostorový headset (styl Meta Quest 3 / Apple Vision Pro) a bezdrátově streamovat obrazovku z vašeho Windows PC.

---

## Krok 1: Spuštění Windows Serveru

1. Otevřete složku projektu v Průzkumníku Windows.
2. Dvakrát klikněte na soubor **`start-server.bat`** (nebo v terminálu spusťte `npm start` uvnitř `windows-server`).
3. Server automaticky:
   - Nastaví ultra-rychlý nativní záchyt obrazovky (45-60 FPS).
   - Spustí zabezpečený **HTTPS server** (nezbytný pro senzory a kameru na iOS).
   - V terminálu zobrazí **QR kód** pro okamžité připojení iPhonem.

---

## Krok 2: Připojení iPhonem (Okamžitě bez instalace přes Safari)

1. Ujistěte se, že iPhone je připojen na **stejnou Wi-Fi síť** (ideálně 5GHz) nebo USB tethering jako počítač.
2. Otevřete **Fotoaparát na iPhonu** a naskenujte QR kód z terminálu (nebo zadejte do Safari adresu z terminálu, např. `https://192.168.1.xxx:3443`).
3. Safari zobrazí varování o vlastním certifikátu:
   - Klikněte na **Zobrazit podrobnosti** -> **Přejít na tento web**.
4. Povolte přístup k **pohybovým senzorům (gyroskopu)** a **fotoaparátu (pro AR)**.

---

## Krok 3: Výběr režimu

V dolní liště aplikace na iPhonu si můžete vybrat ze 3 režimů:

### 1. 👁️ AR Passthrough (Meta Quest 3 / Vision Pro styl)
- Zapne zadní kameru telefonu (vidíte svůj pokoj).
- Windows plocha se vznáší jako 3D monitor přímo ve vašem pokoji!
- Můžete se volně pohybovat po pokoji, obrazovka drží své místo v prostoru.

### 2. 🥽 VR Headset (Stereo SBS pro VR Brýle)
- Rozdělí obraz na levé a pravé oko se stereo perspektivou.
- Vložte iPhone do jakýchkoliv brýlí na telefon (Google Cardboard, Shinecon, VR Box, BoboVR).
- Rozhlížením v 360° vidíte obří plovoucí monitor ve virtuálním cyberpunkovém prostředí nebo virtuálním kině.

### 3. 📱 2D Touch
- Klasické prostorové dotykové ovládání monitoru na displeji telefonu.

---

## 🎮 Ovládání a gesta

- **Zamíření (Gaze)**: Ve VR/AR režimu stačí namířit střed pohledu (křížek) na jakýkoliv prvek na obrazovce Windows.
- **Kliknutí pohledem (Dwell Click)**: Podržte pohled na jednom místě po dobu 1,2 sekundy pro automatické kliknutí.
- **Okamžité kliknutí**: Klepněte kdekoliv na displej telefonu pro okamžité levé kliknutí na Windows.
- **Pohodlné ovládání z PC**: Pokud sedíte u stolu, můžete stále používat svou běžnou fyzickou myš a klávesnici z Windows!
