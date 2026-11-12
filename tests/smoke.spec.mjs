import { test, expect } from '@playwright/test';

const URL = 'file://' + process.cwd().replace(/\\/g, '/') + '/ironhell.html';

// ===== IH-1: Engine basics =====

test('page loads with zero console errors', async ({ page }) => {
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));
  await page.goto(URL);
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test('canvas internal size is 320x200', async ({ page }) => {
  await page.goto(URL);
  const size = await page.evaluate(() => {
    const c = document.getElementById('c');
    return { w: c.width, h: c.height };
  });
  expect(size.w).toBe(320);
  expect(size.h).toBe(200);
});

test('__IH.player has numeric x, y, angle', async ({ page }) => {
  await page.goto(URL);
  const p = await page.evaluate(() => {
    const pl = window.__IH.player;
    return { x: typeof pl.x, y: typeof pl.y, angle: typeof pl.angle };
  });
  expect(p.x).toBe('number');
  expect(p.y).toBe('number');
  expect(p.angle).toBe('number');
});

test('KeyW moves player; wall collision prevents entering wall cell', async ({ page }) => {
  await page.goto(URL);
  await page.waitForTimeout(200);

  const before = await page.evaluate(() => {
    return { x: window.__IH.player.x, y: window.__IH.player.y };
  });

  // Simulate KeyW for 500ms
  await page.keyboard.down('w');
  await page.waitForTimeout(500);
  await page.keyboard.up('w');

  const after = await page.evaluate(() => {
    return { x: window.__IH.player.x, y: window.__IH.player.y };
  });

  // Player should have moved
  const dist = Math.sqrt((after.x - before.x) ** 2 + (after.y - before.y) ** 2);
  expect(dist).toBeGreaterThan(0.01);

  // Player should never be inside a wall cell
  const inWall = await page.evaluate(() => {
    const p = window.__IH.player;
    const mx = Math.floor(p.x);
    const my = Math.floor(p.y);
    return window.__IH.isWall(p.x, p.y);
  });
  expect(inWall).toBe(false);
});

// ===== IH-2: Textures, doors, keycards, exit =====

test('__IH.textures has >= 4 entries', async ({ page }) => {
  await page.goto(URL);
  const count = await page.evaluate(() => Object.keys(window.__IH.textures).length);
  expect(count).toBeGreaterThanOrEqual(4);
});

test('locked red door stays closed without key, opens with key', async ({ page }) => {
  await page.goto(URL);
  await page.waitForTimeout(200);

  // Find the red door and check it stays closed without key
  const closedWithoutKey = await page.evaluate(() => {
    const door = window.__IH.doors.find(d => d.locked === 'red');
    if (!door) return { found: false };
    // Player does not have red key
    const hasKey = window.__IH.player.keys.includes('red');
    // Try to open door
    window.__IH.tryUseDoor(door);
    return { found: true, hasKey, opening: door.opening, open: door.open };
  });
  expect(closedWithoutKey.found).toBe(true);
  expect(closedWithoutKey.hasKey).toBe(false);
  expect(closedWithoutKey.opening).toBe(false);

  // Give player the red key and try again
  const openedWithKey = await page.evaluate(() => {
    window.__IH.player.keys.push('red');
    const door = window.__IH.doors.find(d => d.locked === 'red');
    window.__IH.tryUseDoor(door);
    return { opening: door.opening };
  });
  expect(openedWithKey.opening).toBe(true);
});

test('activating X sets state to levelComplete', async ({ page }) => {
  await page.goto(URL);
  await page.waitForTimeout(200);

  const result = await page.evaluate(() => {
    window.__IH.activateExit();
    return window.__IH.state;
  });
  expect(result).toBe('levelComplete');
});
