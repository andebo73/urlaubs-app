// End-to-End-Test mit Playwright/Chromium. Startet einen kleinen statischen
// Server, lädt die App und treibt sie über window.TammoTest.
// Ausführen: node test/run.mjs   (nach: npm i -D playwright)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 8123;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent(req.url.split('?')[0]);
      if (urlPath === '/') urlPath = '/index.html';
      const filePath = path.join(ROOT, urlPath);
      if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

async function runDesktop(browser, baseUrl) {
  console.log('\n== Desktop ==');
  const page = await browser.newPage({ viewport: { width: 1024, height: 700 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto(baseUrl);
  await page.waitForFunction(() => window.TammoTest && window.TammoTest.ready, { timeout: 10000 });
  check('Seite geladen, TammoTest.ready', true);
  check('keine Konsolen-/Seitenfehler beim Laden', errors.length === 0);
  if (errors.length) console.error('    Fehler:', errors.slice(0, 5));

  // Deterministischer Seed.
  await page.evaluate(() => window.TammoTest.reset(12345));

  // Canvas rendert (nicht leer).
  const notBlank = await page.evaluate(() => {
    window.TammoTest.frame();
    return !window.TammoTest.canvasIsBlank();
  });
  check('Canvas rendert (nicht einfarbig)', notBlank);

  // Bewegung ändert Position und bleibt außerhalb von Wänden.
  const moveRes = await page.evaluate(() => {
    const before = window.TammoTest.getPlayer();
    let inWall = false;
    for (let i = 0; i < 12; i++) {
      window.TammoTest.move(1);
      if (window.TammoTest.isWallAtPlayer()) inWall = true;
    }
    const after = window.TammoTest.getPlayer();
    return { moved: before.x !== after.x || before.y !== after.y, inWall };
  });
  check('Spieler bewegt sich', moveRes.moved);
  check('Spieler betritt keine Wand', !moveRes.inWall);

  // Encounter -> Kampfmodus.
  const combat = await page.evaluate(() => {
    window.TammoTest.forceEncounterNearest();
    return window.TammoTest.getState().mode;
  });
  check("Kampf startet (mode==='combat')", combat === 'combat');

  // Angriffe bis Sieg -> XP und ggf. Level-up.
  const fight = await page.evaluate(() => {
    const before = window.TammoTest.getState();
    let xp = 0;
    let defeated = false;
    let leveled = false;
    for (let i = 0; i < 40 && !defeated; i++) {
      const r = window.TammoTest.attack();
      xp += r.xpGained;
      if (r.leveledUp) leveled = true;
      if (r.enemyDefeated) defeated = true;
      if (r.playerDefeated) break;
    }
    const after = window.TammoTest.getState();
    return { defeated, xp, leveled, beforeEnemies: before.enemyCount, afterEnemies: after.enemyCount };
  });
  check('Gegner besiegt', fight.defeated);
  check('XP erhalten (> 0)', fight.xp > 0);
  check('Gegnerzahl gesunken', fight.afterEnemies < fight.beforeEnemies);

  // Karte aufsammeln -> Inventar wächst.
  const card = await page.evaluate(() => {
    const before = window.TammoTest.getInventory().length;
    const id = window.TammoTest.pickupNearest();
    const after = window.TammoTest.getInventory();
    return { grew: after.length === before + 1, contains: id != null && after.includes(id), id };
  });
  check('Inventar wächst um 1', card.grew);
  check('aufgesammelte Karte im Inventar', card.contains);

  await page.close();
}

async function runMobile(browser, baseUrl) {
  console.log('\n== Mobile (Touch) ==');
  const device = devices['Pixel 5'];
  const context = await browser.newContext({ ...device });
  const page = await context.newPage();
  await page.goto(baseUrl);
  await page.waitForFunction(() => window.TammoTest && window.TammoTest.ready, { timeout: 10000 });
  await page.evaluate(() => window.TammoTest.reset(12345));

  // Touch-Steuerung sichtbar.
  const joyVisible = await page.locator('#tc-joystick').isVisible();
  check('Touch-Joystick sichtbar', joyVisible);
  const attackVisible = await page.locator('#tc-take').isVisible();
  check('Touch-Buttons sichtbar', attackVisible);

  // Kein horizontales Scrollen.
  const noHScroll = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1
  );
  check('kein horizontales Scrollen', noHScroll);

  // Simulierter Tap auf den Joystick + Ziehen bewegt den Spieler.
  const before = await page.evaluate(() => window.TammoTest.getPlayer());
  const box = await page.locator('#tc-joystick').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 4); // nach oben = vorwärts
  await page.waitForTimeout(400); // ein paar Frames laufen lassen
  await page.mouse.up();
  const after = await page.evaluate(() => window.TammoTest.getPlayer());
  check('Joystick bewegt den Spieler', before.x !== after.x || before.y !== after.y);

  // Screenshot zur Sichtprüfung.
  const shot = path.join(ROOT, 'test', 'mobile-screenshot.png');
  await page.screenshot({ path: shot });
  console.log(`  → Screenshot: ${shot}`);

  await context.close();
}

async function main() {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${PORT}/`;
  // Vorinstalliertes Chromium nutzen (Revision passt evtl. nicht zum npm-Treiber).
  const execPath = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
  const launchOpts = { headless: true };
  if (fs.existsSync(execPath)) launchOpts.executablePath = execPath;
  const browser = await chromium.launch(launchOpts);
  try {
    await runDesktop(browser, baseUrl);
    await runMobile(browser, baseUrl);
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`\nErgebnis: ${passed} bestanden, ${failed} fehlgeschlagen`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
