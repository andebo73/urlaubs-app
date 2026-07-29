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

  // Klassenwahl erscheint beim Laden.
  const classShown = await page
    .locator('#class-overlay')
    .evaluate((el) => el.classList.contains('show'));
  check('Klassenwahl wird angezeigt', classShown);

  // Klasse per Klick wählen -> Overlay weg, Modus explore.
  await page.click('.class-card[data-class="kaempfer"]');
  const afterPick = await page.evaluate(() => ({
    shown: document.getElementById('class-overlay').classList.contains('show'),
    mode: window.TammoTest.getState().mode,
    cls: window.TammoTest.getClass().id,
  }));
  check('nach Klassenwahl: Overlay weg & Modus explore', !afterPick.shown && afterPick.mode === 'explore');
  check('gewählte Klasse ist Kämpfer', afterPick.cls === 'kaempfer');

  // Deterministischer Seed + feste Klasse.
  await page.evaluate(() => window.TammoTest.reset(12345, 'kaempfer'));

  const notBlank = await page.evaluate(() => {
    window.TammoTest.frame();
    return !window.TammoTest.canvasIsBlank();
  });
  check('Canvas rendert (nicht einfarbig)', notBlank);

  // Bewegung + Kollision.
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

  // Kampf -> Beute-Rohstoff.
  const fight = await page.evaluate(() => {
    window.TammoTest.forceEncounterNearest();
    const before = window.TammoTest.getResources().reduce((s, r) => s + r.count, 0);
    let defeated = false;
    let drop = null;
    for (let i = 0; i < 40 && !defeated; i++) {
      const r = window.TammoTest.attack();
      if (r.enemyDefeated) {
        defeated = true;
        drop = r.drop;
      }
      if (r.playerDefeated) break;
    }
    const after = window.TammoTest.getResources().reduce((s, r) => s + r.count, 0);
    return { defeated, drop, grew: after > before, mode: window.TammoTest.getState().mode };
  });
  check("Kampf startet und endet (mode zurück auf explore)", fight.mode === 'explore');
  check('Gegner besiegt', fight.defeated);
  check('Beute-Rohstoff erhalten', fight.drop != null && fight.grew);

  // Rohstoff aufsammeln.
  const pick = await page.evaluate(() => {
    const id = window.TammoTest.pickupNearest();
    const c = window.TammoTest.getResources().find((r) => r.id === id);
    return { id, count: c ? c.count : 0 };
  });
  check('Rohstoff aufgesammelt', pick.id != null && pick.count >= 1);

  // Beim Händler abgeben -> Stufenaufstieg.
  const level = await page.evaluate(() => {
    const before = window.TammoTest.getPlayer().level;
    window.TammoTest.grantGuildResources(5);
    const res = window.TammoTest.handInAtHaendler();
    const after = window.TammoTest.getPlayer().level;
    return { before, after, type: res.type };
  });
  check('Händler: Aufstieg nach Abgabe von 5 Rohstoffen', level.type === 'levelup' && level.after === level.before + 1);

  // Spielanleitung öffnet mit aktuellen Werten.
  await page.click('#hud');
  const guide = await page.evaluate(() => ({
    shown: document.getElementById('guide-overlay').classList.contains('show'),
    text: document.getElementById('guide-content').innerText,
  }));
  check('Anleitung öffnet bei Header-Klick', guide.shown);
  check(
    'Anleitung ist datengetrieben (Klasse + Stufenkarte + Viertel)',
    /Spielanleitung/.test(guide.text) && /Stufenkarte/.test(guide.text) && /Viertel/.test(guide.text)
  );
  await page.click('#guide-close');

  // Minikarte: Klick vergrößert / verkleinert.
  const rect1 = await page.evaluate(() => {
    window.TammoTest.frame();
    return window.TammoTest.game.minimapRect;
  });
  await page.mouse.click(rect1.x + rect1.size / 2, rect1.y + rect1.size / 2);
  const zoomed = await page.evaluate(() => window.TammoTest.game.minimapZoom);
  check('Minikarte vergrößert nach Klick', zoomed === true);
  const rect2 = await page.evaluate(() => window.TammoTest.game.minimapRect);
  await page.mouse.click(rect2.x + rect2.size / 2, rect2.y + rect2.size / 2);
  const back = await page.evaluate(() => window.TammoTest.game.minimapZoom);
  check('Minikarte wieder normal nach erneutem Klick', back === false);

  // --- Stufe 2 ---
  // Schlüssel aufsammeln.
  const key = await page.evaluate(() => {
    window.TammoTest.reset(12345, 'kaempfer');
    const before = window.TammoTest.getKeys();
    const after = window.TammoTest.pickupNearestKey();
    return { before, after };
  });
  check('Schlüssel aufgesammelt', key.after === key.before + 1);

  // Schurke öffnet Tür und Truhe ohne Schlüssel.
  const rogue = await page.evaluate(() => {
    window.TammoTest.reset(12345, 'schurke');
    const door = window.TammoTest.openFacingDoor();
    const invBefore = window.TammoTest.getResources().reduce((s, r) => s + r.count, 0);
    const chest = window.TammoTest.openNearestChest();
    const invAfter = window.TammoTest.getResources().reduce((s, r) => s + r.count, 0);
    return { door: !!(door && door.opened), chest: !!(chest && chest.opened), loot: invAfter > invBefore };
  });
  check('Schurke öffnet Tür ohne Schlüssel', rogue.door);
  check('Schurke öffnet Truhe (Beute erhalten)', rogue.chest && rogue.loot);

  // Katakomben dunkel (Kämpfer) vs. hell (Magier = Zauberlicht).
  const light = await page.evaluate(() => {
    window.TammoTest.reset(12345, 'kaempfer');
    const k = window.TammoTest.teleportToViertel('katakomben').light;
    window.TammoTest.reset(12345, 'magier');
    const m = window.TammoTest.teleportToViertel('katakomben').light;
    return { k, m };
  });
  check('Katakomben dunkel für Kämpfer', light.k < 1);
  check('Katakomben hell für Magier (Zauberlicht)', light.m === 1);

  // Bewohner vergibt einen Auftrag.
  const quest = await page.evaluate(() => {
    window.TammoTest.reset(7, 'kaempfer');
    const q = window.TammoTest.talkBewohner();
    return { state: q.state, has: !!window.TammoTest.getQuest() };
  });
  check('Bewohner vergibt einen Auftrag', quest.state === 'new' && quest.has);

  await page.close();
}

async function runMobile(browser, baseUrl) {
  console.log('\n== Mobile (Touch) ==');
  const device = devices['Pixel 5'];
  const context = await browser.newContext({ ...device });
  const page = await context.newPage();
  await page.goto(baseUrl);
  await page.waitForFunction(() => window.TammoTest && window.TammoTest.ready, { timeout: 10000 });
  // Klasse wählen (schließt das Overlay), dann deterministisch setzen.
  await page.evaluate(() => window.TammoTest.reset(12345, 'kaempfer'));

  const joyVisible = await page.locator('#tc-joystick').isVisible();
  check('Touch-Joystick sichtbar', joyVisible);
  const takeVisible = await page.locator('#tc-take').isVisible();
  check('Touch-Buttons sichtbar', takeVisible);

  const noHScroll = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1
  );
  check('kein horizontales Scrollen', noHScroll);

  const before = await page.evaluate(() => window.TammoTest.getPlayer());
  const box = await page.locator('#tc-joystick').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 4);
  await page.waitForTimeout(400);
  await page.mouse.up();
  const after = await page.evaluate(() => window.TammoTest.getPlayer());
  check('Joystick bewegt den Spieler', before.x !== after.x || before.y !== after.y);

  const shot = path.join(ROOT, 'test', 'mobile-screenshot.png');
  await page.screenshot({ path: shot });
  console.log(`  → Screenshot: ${shot}`);

  await context.close();
}

async function main() {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${PORT}/`;
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
