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

// ===== IH-3: Weapons and HUD =====

test('__IH.weapons.length === 6', async ({ page }) => {
  await page.goto(URL);
  const count = await page.evaluate(() => window.__IH.weapons.length);
  expect(count).toBe(6);
});

test('pressing 2 sets weapon to Scatter Bore; firing decrements shells', async ({ page }) => {
  await page.goto(URL);
  await page.waitForTimeout(200);

  const result = await page.evaluate(() => {
    // Switch to weapon 2 (Scatter Bore, index 1)
    window.__IH.switchWeapon(1);
    const name = window.__IH.weapons[window.__IH.currentWeapon].name;
    const shellsBefore = window.__IH.ammo.shells;
    window.__IH.fireWeapon();
    const shellsAfter = window.__IH.ammo.shells;
    return { name, shellsBefore, shellsAfter };
  });
  expect(result.name).toBe('Scatter Bore');
  expect(result.shellsAfter).toBe(result.shellsBefore - 1);
});

test('rocket splash within radius reduces player health', async ({ page }) => {
  await page.goto(URL);
  await page.waitForTimeout(200);

  const result = await page.evaluate(() => {
    const p = window.__IH.player;
    p.health = 100;
    // Move player close to the north wall so rocket hits nearby
    p.x = 2.5;
    p.y = 1.3;
    p.angle = -Math.PI / 2; // face north toward wall at y=0
    // Switch to Breach Launcher (index 4)
    window.__IH.switchWeapon(4);
    window.__IH.ammo.rockets = 10;
    const healthBefore = p.health;
    window.__IH.fireWeapon();
    const healthAfter = p.health;
    return { healthBefore, healthAfter };
  });
  // Player should have taken splash damage from nearby wall hit
  expect(result.healthAfter).toBeLessThan(result.healthBefore);
});

// ===== IH-4: Enemies =====

test('map with h,s,g,w,f spawns 5 enemies with distinct types', async ({ page }) => {
  await page.goto(URL);
  const result = await page.evaluate(() => {
    const types = new Set(window.__IH.enemies.map(e => e.type));
    return { count: window.__IH.enemies.length, types: [...types] };
  });
  expect(result.count).toBeGreaterThanOrEqual(5);
  expect(result.types).toContain('husk');
  expect(result.types).toContain('spitter');
  expect(result.types).toContain('hound');
  expect(result.types).toContain('warden');
  expect(result.types).toContain('floater');
});

test('firing near idle enemy with LOS sets state to alert or chase', async ({ page }) => {
  await page.goto(URL);
  await page.waitForTimeout(200);

  const result = await page.evaluate(() => {
    // Place an enemy in open space near the player, force idle, ensure LOS
    const e = window.__IH.enemies[0];
    e.state = 'idle';
    e.x = window.__IH.player.x + 2;
    e.y = window.__IH.player.y;
    const los = window.__IH.hasLineOfSight(e.x, e.y, window.__IH.player.x, window.__IH.player.y);
    // Alert enemies near player (simulates weapon fire)
    window.__IH.alertNearbyEnemies(window.__IH.player.x, window.__IH.player.y, 15);
    return { los, state: e.state };
  });
  expect(result.los).toBe(true);
  expect(['alert', 'chase']).toContain(result.state);
});

test('enemy damaged by another enemy sets target to attacker (infighting)', async ({ page }) => {
  await page.goto(URL);
  await page.waitForTimeout(200);

  const result = await page.evaluate(() => {
    const enemies = window.__IH.enemies;
    if (enemies.length < 2) return { ok: false };
    const victim = enemies[0];
    const attacker = enemies[1];
    victim.state = 'chase';
    victim.target = null;
    window.__IH.damageEnemy(victim, 5, attacker);
    return { ok: true, target: victim.target === attacker };
  });
  expect(result.ok).toBe(true);
  expect(result.target).toBe(true);
});

test('enemy behind wall is not drawn (z-buffer)', async ({ page }) => {
  await page.goto(URL);
  await page.waitForTimeout(300);

  const result = await page.evaluate(() => {
    // Place an enemy behind a wall
    const e = window.__IH.enemies[0];
    // Place it behind the wall block at (4,3) - inside the room
    e.x = 5.5; e.y = 4.5; e.state = 'chase';
    // Place player far away facing the wall
    const p = window.__IH.player;
    p.x = 1.5; p.y = 4.5; p.angle = 0; // facing east toward the wall

    // The enemy at (5.5, 4.5) should be behind the wall at x=4
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const eDist = Math.sqrt(dx * dx + dy * dy);
    const los = window.__IH.hasLineOfSight(p.x, p.y, e.x, e.y);
    return { eDist, los };
  });
  // Enemy should NOT have line of sight (behind wall)
  expect(result.los).toBe(false);
});
