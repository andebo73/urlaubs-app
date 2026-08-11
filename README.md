# Meine Apps

Eine kleine Sammlung eigenständiger Browser-Apps, gehostet über GitHub Pages.
Die **Startseite** (`index.html` im Root) verlinkt die einzelnen Apps; jede App
liegt in einem eigenen Unterordner.

Alle Apps sind **Standalone-HTML ohne Build-Schritt** – reines Vanilla-JS
(ES-Module), keine Frameworks, keine externen Bibliotheken, keine fremden Bilder,
Fonts oder Sounds. Damit ist alles lizenzfrei und überall hostbar.

## Apps

- **[Tammo Stadt](./tammo-stadt/)** – ein 3D-Labyrinth-Abenteuer (Raycasting).
  Klasse wählen, Rohstoffe sammeln, Kobolde bekämpfen, Türen/Truhen öffnen und
  beim Händler zur Meister-Stufe aufsteigen. Details siehe
  [`tammo-stadt/`](./tammo-stadt/).
- *(weitere Apps folgen als eigene Unterordner)*

## Lokal starten

Da ES-Module verwendet werden, muss über HTTP ausgeliefert werden (nicht per
`file://`):

```bash
python3 -m http.server 8000
# Startseite:   http://localhost:8000/
# Tammo Stadt:  http://localhost:8000/tammo-stadt/
```

## Tests (Tammo Stadt)

Die Spiellogik ist strikt vom Rendering getrennt und deterministisch (geseedeter
Zufall), damit sie automatisiert getestet werden kann.

```bash
npm run test:logic         # reine Logik (kein Browser)
npm i -D playwright        # einmalig; nur der Treiber
npm run test:e2e           # End-to-End (startet selbst einen Testserver)
```

Der E2E-Test prüft u. a. die Startseite (Launcher → App) sowie in der App:
Laden ohne Fehler, Rendering, Bewegung/Kollision, Kampf, Rohstoffe/Stufenkarten,
Türen/Truhen/Schlüssel, Katakomben-Licht, Aufträge, Händler-Shop und Ausrüstung.
Über `window.TammoTest` lässt sich das Spiel deterministisch fernsteuern.

## Projektstruktur

```
index.html                 Startseite (Launcher, verlinkt die Apps)
tammo-stadt/               App „Tammo Stadt"
  index.html               Einstieg (Canvas + HUD)
  styles.css               Layout/HUD (nur System-Fonts)
  src/
    main.js                Bootstrap + Test-API (window.TammoTest)
    input.js               Tastatur-Eingabe
    touchcontrols.js       On-Screen-Steuerung (Smartphone)
    logic/                 reine Spiellogik (ohne DOM, testbar)
    engine/                Rendering (Raycasting, Sprites, Minikarte, HUD, Sound)
    assets/                selbst geschriebene SVGs + Farbpalette
test/                      Logik-Tests + Playwright-Harness
.github/workflows/pages.yml  Deploy auf GitHub Pages
```

## Hosting auf GitHub Pages

Der Workflow `.github/workflows/pages.yml` veröffentlicht das Repository bei jedem
Push auf `main` automatisch. `.nojekyll` sorgt dafür, dass Pfade unter Unterordnern
unverändert ausgeliefert werden. Alle Asset-Pfade sind relativ, sodass die Apps
unter `https://<user>.github.io/urlaubs-app/` und `.../urlaubs-app/tammo-stadt/`
funktionieren.

## Lizenz

Eigenständiges Werk. Alle Grafiken, Texte, Sounds und der Code sind selbst
erstellt; es werden keinerlei fremde Marken oder Assets verwendet.
