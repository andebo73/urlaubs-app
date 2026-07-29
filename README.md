# Tammo Stadt 🏰

Ein kleines **3D-Labyrinth-Abenteuer** im Browser: Streife in der Ego-Perspektive
durch die Kobold-Stadt, sammle alle Sammelkarten, kämpfe gegen Kobolde, steige
Stufen auf und werde stärker.

Die App ist eine **Standalone-HTML-App ohne Build-Schritt** – reines Vanilla-JS
(ES-Module), keine Frameworks, keine externen Bibliotheken, keine fremden Bilder,
Fonts oder Sounds. Alle Grafiken sind selbst geschriebene SVGs. Damit ist alles
lizenzfrei und überall (z. B. GitHub Pages) hostbar.

## Spielen

Spielbar auf **Desktop und Smartphone**.

**Desktop:**
- Bewegen: `W A S D` oder Pfeiltasten
- Umsehen: Maus ziehen oder `◀`/`▶`
- Nehmen / Interagieren: `Leertaste`
- Angreifen (im Kampf): `F`
- Neustart: `R`

**Smartphone:**
- Bewegen: Joystick unten links
- Umsehen: über die Ansicht wischen
- Aktionen: Buttons „Nehmen“, „Angreifen“, „Fliehen“

Ziel: Finde alle **6 Sammelkarten** im Labyrinth, ohne von den Kobolden besiegt
zu werden.

## Lokal starten

Da ES-Module verwendet werden, muss die Seite über HTTP ausgeliefert werden
(nicht per Doppelklick / `file://`):

```bash
python3 -m http.server 8000
# dann im Browser: http://localhost:8000
```

## Tests

Die Spiellogik ist strikt vom Rendering getrennt und deterministisch (geseedeter
Zufall), damit sie automatisiert getestet werden kann.

```bash
# Reine Logik (kein Browser nötig)
npm run test:logic

# End-to-End mit Playwright/Chromium (startet selbst einen Testserver)
npm i -D playwright        # einmalig; nur der Treiber
npm run test:e2e
```

Der E2E-Test prüft u. a.: Laden ohne Fehler, Canvas rendert, Bewegung +
Kollision, Kampf → EP/Stufe, Kartenaufnahme sowie die Touch-Steuerung im
Handy-Viewport. Über `window.TammoTest` lässt sich das Spiel deterministisch
fernsteuern.

## Projektstruktur

```
index.html            Einstieg (Canvas + HUD)
styles.css            Layout/HUD (nur System-Fonts)
src/
  main.js             Bootstrap + Test-API (window.TammoTest)
  input.js            Tastatur-Eingabe
  touchcontrols.js    On-Screen-Steuerung (Smartphone)
  logic/              reine Spiellogik (ohne DOM, testbar)
  engine/             Rendering (Raycasting, Sprites, Minikarte, HUD)
  assets/             selbst geschriebene SVGs + Farbpalette
test/                 Logik-Tests + Playwright-Harness
```

## Hosting auf GitHub Pages

Ein Workflow (`.github/workflows/pages.yml`) veröffentlicht das Repository bei
jedem Push auf `main` automatisch auf GitHub Pages. Alternativ in den
Repo-Einstellungen unter *Pages* „Deploy from a branch“ → `main` / root wählen.
Die Datei `.nojekyll` sorgt dafür, dass Pfade unter `src/` unverändert
ausgeliefert werden.

## Lizenz

Eigenständiges Werk. Alle Grafiken, Texte und Code sind selbst erstellt; es
werden keinerlei fremde Marken oder Assets verwendet.
