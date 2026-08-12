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
      if (urlPath.endsWith('/')) urlPath += 'index.html'; // Verzeichnis -> index.html
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

async function runLauncher(browser, rootUrl, gameUrl) {
  console.log('\n== Startseite (Launcher) ==');
  const page = await browser.newPage({ viewport: { width: 1024, height: 700 } });
  await page.goto(rootUrl);
  const title = await page.title();
  check('Launcher lädt', /App/i.test(title));
  const link = await page.locator('a.card[href="./tammo-stadt/"]').count();
  check('Launcher verlinkt Tammo Stadt', link === 1);
  const link2 = await page.locator('a.card[href="./code-garten/"]').count();
  check('Launcher verlinkt Code-Garten', link2 === 1);
  // Klick auf die Karte führt zur App.
  await page.click('a.card[href="./tammo-stadt/"]');
  await page.waitForFunction(() => window.TammoTest && window.TammoTest.ready, { timeout: 10000 });
  check('Tammo Stadt startet aus dem Launcher', page.url().includes('/tammo-stadt/'));
  await page.close();
}

async function runCodeGarten(browser, baseUrl) {
  console.log('\n== Code-Garten ==');
  const page = await browser.newPage({ viewport: { width: 1024, height: 700 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto(baseUrl);
  await page.waitForFunction(() => window.CodeGartenTest && window.CodeGartenTest.ready, { timeout: 10000 });
  check('Code-Garten geladen, CodeGartenTest.ready', true);
  check('keine Konsolen-/Seitenfehler beim Laden', errors.length === 0);
  if (errors.length) console.error('    Fehler:', errors.slice(0, 5));

  const notBlank = await page.evaluate(() => {
    window.CodeGartenTest.frame();
    return !window.CodeGartenTest.canvasIsBlank();
  });
  check('Rasen-Szene rendert (nicht einfarbig)', notBlank);

  // Laufen: bewegt den Avatar; Drehen ändert die Blickrichtung.
  const walk = await page.evaluate(() => {
    window.CodeGartenTest.reset();
    const before = window.CodeGartenTest.getPlayer();
    const after = window.CodeGartenTest.tick({ move: 1 }, 0.1, 15);
    const turned = window.CodeGartenTest.tick({ turn: 1 }, 0.1, 5);
    return {
      dist: Math.hypot(after.x - before.x, after.z - before.z),
      yawBefore: before.yaw,
      yawAfter: turned.yaw,
    };
  });
  check('Avatar läuft (Position ändert sich)', walk.dist > 1);
  check('Umsehen dreht den Avatar', walk.yawAfter !== walk.yawBefore);

  // Springen: hebt ab und landet wieder auf der Plattform.
  const jump = await page.evaluate(() => {
    window.CodeGartenTest.reset(); // Spawn steht geerdet am Ring
    window.CodeGartenTest.tick({ jump: true }, 0.05, 1);
    let maxY = 0;
    for (let i = 0; i < 40; i++) {
      const p = window.CodeGartenTest.tick({}, 0.05, 1);
      maxY = Math.max(maxY, p.y);
    }
    return { maxY, grounded: window.CodeGartenTest.getPlayer().grounded };
  });
  check('Springen hebt den Avatar an', jump.maxY > 2);
  check('nach dem Sprung wieder gelandet', jump.grounded === true);

  // Von der Plattform fallen -> Respawn am Brunnen.
  const fall = await page.evaluate(() => {
    window.CodeGartenTest.reset();
    const before = window.CodeGartenTest.getPlayer().respawnCount;
    window.CodeGartenTest.place(30, 0, 0); // außerhalb der Plattform
    let respawned = false;
    for (let i = 0; i < 150; i++) {
      const p = window.CodeGartenTest.tick({}, 0.05, 1);
      if (p.respawnCount > before) { respawned = true; break; }
    }
    return { respawned, onPlatform: window.CodeGartenTest.getPlayer().onPlatform };
  });
  check('Fallen von der Plattform löst Respawn aus', fall.respawned && fall.onPlatform);

  // Obby: auf der Ziel-Plattform landen -> Code freischalten + zurück teleportiert.
  const obby = await page.evaluate(async () => {
    window.CodeGartenTest.reset();
    window.CodeGartenTest.place(88, 0, 19); // über der Ziel-Plattform
    await new Promise((r) => setTimeout(r, 600)); // Render-Loop lässt landen + Belohnung
    return {
      overlay: document.getElementById('obby-overlay').classList.contains('show'),
      code: document.getElementById('obby-code').textContent.trim(),
      onPlatform: window.CodeGartenTest.getPlayer().onPlatform,
    };
  });
  check('Obby-Abschluss schaltet einen Code frei', obby.overlay && obby.code.length > 1);
  check('nach dem Abschluss zurück auf die Map teleportiert', obby.onPlatform === true);

  // Freigeschalteten Code aus dem Abschluss-Fenster einlösen.
  const claimed = await page.evaluate(async () => {
    document.getElementById('obby-redeem').click();
    await new Promise((r) => setTimeout(r, 60));
    const val = document.getElementById('code-input').value;
    document.getElementById('code-submit').click();
    return { val, total: window.CodeGartenTest.totalItems() };
  });
  check('freigeschalteter Code lässt sich einlösen', claimed.val.length > 1 && claimed.total >= 1);

  // Seiten-Knopf öffnet das Eingabefeld.
  await page.evaluate(() => window.CodeGartenTest.reset());
  check('Seiten-Knopf sichtbar', await page.locator('#code-open').isVisible());
  await page.click('#code-open');
  const panelShown = await page
    .locator('#code-overlay')
    .evaluate((el) => el.classList.contains('show'));
  check('Eingabefeld erscheint nach Knopfdruck', panelShown);

  // Gültigen Code eingeben und einlösen.
  await page.fill('#code-input', 'willkommen');
  await page.click('#code-submit');
  const redeemed = await page.evaluate(() => ({
    total: window.CodeGartenTest.totalItems(),
    has: window.CodeGartenTest.has('stern'),
    ok: document.getElementById('code-result').classList.contains('ok'),
  }));
  check('gültiger Code vergibt ein Item', redeemed.total === 1 && redeemed.has);
  check('Erfolgsmeldung erscheint', redeemed.ok);

  // Item taucht im Rucksack auf.
  await page.click('#code-close');
  await page.click('#pack-btn');
  const invCount = await page.locator('#inv-list .inv-item').count();
  check('Item erscheint im Rucksack', invCount === 1);
  await page.click('#inv-close');
  await page.click('#code-open');

  // Unbekannter Code wird abgewiesen (kein neues Item).
  await page.fill('#code-input', 'quatschcode');
  await page.click('#code-submit');
  const bad = await page.evaluate(() => ({
    total: window.CodeGartenTest.totalItems(),
    err: document.getElementById('code-result').classList.contains('err'),
  }));
  check('unbekannter Code gibt kein Item', bad.total === 1 && bad.err);

  // Derselbe Code lässt sich nicht doppelt einlösen.
  await page.fill('#code-input', 'WILLKOMMEN');
  await page.click('#code-submit');
  const dup = await page.evaluate(() => window.CodeGartenTest.totalItems());
  check('Code nicht doppelt einlösbar', dup === 1);

  // Keine Beispielcode-Chips mehr (Codes kommen aus der Obby).
  const chips = await page.locator('#code-examples').count();
  check('keine Beispielcode-Chips mehr', chips === 0);

  await page.close();
}

async function runCodeGartenMobile(browser, baseUrl) {
  console.log('\n== Code-Garten (Mobile) ==');
  const device = devices['Pixel 5'];
  const context = await browser.newContext({ ...device });
  const page = await context.newPage();
  await page.goto(baseUrl);
  await page.waitForFunction(() => window.CodeGartenTest && window.CodeGartenTest.ready, { timeout: 10000 });

  const noHScroll = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1
  );
  check('kein horizontales Scrollen', noHScroll);
  check('Seiten-Knopf auf dem Handy sichtbar', await page.locator('#code-open').isVisible());

  await page.tap('#code-open');
  await page.fill('#code-input', 'KRONE');
  await page.tap('#code-submit');
  const ok = await page.evaluate(() => window.CodeGartenTest.has('krone'));
  check('Code auf dem Handy einlösbar', ok);

  await context.close();
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

  // --- Stufe 3 ---
  // Händler öffnet den Shop.
  const shop = await page.evaluate(() => window.TammoTest.openShopAtHaendler());
  check('Händler öffnet den Shop', shop.type === 'shop' && shop.shopOpen === true);
  const shopVisible = await page
    .locator('#shop-overlay')
    .evaluate((el) => el.classList.contains('show'));
  check('Shop-Overlay sichtbar', shopVisible);
  await page.evaluate(() => window.TammoTest.closeShop());

  // Waffe kaufen erhöht Stufe und Angriff; Viewmodel zeigt die Waffe.
  const weapon = await page.evaluate(() => {
    window.TammoTest.reset(12345, 'kaempfer');
    window.TammoTest.grantResources('rune', 20);
    const before = window.TammoTest.getEquipment();
    const r = window.TammoTest.buyWeapon();
    const after = window.TammoTest.getEquipment();
    window.TammoTest.frame();
    const hasSvg = !!document.querySelector('#weapon svg');
    return { ok: r.ok, tierUp: after.weaponTier === before.weaponTier + 1, atkUp: after.attackPower > before.attackPower, hasSvg };
  });
  check('Waffe kaufen erhöht Waffenstufe', weapon.ok && weapon.tierUp);
  check('Angriff steigt mit der Waffe', weapon.atkUp);
  check('Waffe wird unten angezeigt (Viewmodel)', weapon.hasSvg);

  // Rüstung kaufen erhöht Rüstungsstufe.
  const armor = await page.evaluate(() => {
    const before = window.TammoTest.getEquipment().armorTier;
    const r = window.TammoTest.buyArmor();
    return { ok: r.ok, after: window.TammoTest.getEquipment().armorTier, before };
  });
  check('Rüstung kaufen erhöht Rüstungsstufe', armor.ok && armor.after === armor.before + 1);

  // Ton an/aus umschaltbar (ohne Fehler).
  const mute = await page.evaluate(() => {
    const m1 = window.TammoTest.toggleMute();
    const m2 = window.TammoTest.toggleMute();
    return { m1, m2 };
  });
  check('Ton lässt sich stummschalten und wieder aktivieren', mute.m1 === true && mute.m2 === false);

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
  const rootUrl = `http://127.0.0.1:${PORT}/`;
  const gameUrl = `${rootUrl}tammo-stadt/`;
  const gartenUrl = `${rootUrl}code-garten/`;
  const execPath = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
  const launchOpts = { headless: true };
  if (fs.existsSync(execPath)) launchOpts.executablePath = execPath;
  const browser = await chromium.launch(launchOpts);
  try {
    await runLauncher(browser, rootUrl, gameUrl);
    await runDesktop(browser, gameUrl);
    await runMobile(browser, gameUrl);
    await runCodeGarten(browser, gartenUrl);
    await runCodeGartenMobile(browser, gartenUrl);
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
