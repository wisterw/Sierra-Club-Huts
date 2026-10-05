const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');
const { chromium, expect } = require('@playwright/test');
const { SqliteStore } = require('../src/data/sqliteStore');

async function freePort() {
  const socket = net.createServer();
  await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  return port;
}

async function run() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'huts-standalone-'));
  const dbPath = path.join(dir, 'huts.sqlite');
  const store = new SqliteStore({ dbPath, importTsv: false });
  const accounts = [
    { Email: 'FIRST@EXAMPLE.COM', first_name: 'First', last_name: 'Volunteer', Admin: false, Credits: 1 },
    { Email: 'SECOND@EXAMPLE.COM', first_name: 'Second', last_name: 'Volunteer', Admin: false, Credits: 1 },
    { Email: 'ADMIN@EXAMPLE.COM', first_name: 'Hut', last_name: 'Coordinator', Admin: true, Credits: 1 },
  ].map((account) => store.upsertRequestor(account));
  for (const account of accounts) {
    store.updateRequestorAuthFields(account.Requestor_ID, {
      login_code: 1234, code_generated_when: new Date().toISOString(), last_failed_login: '',
    });
  }
  store.setApplicationMode('trip-request');
  store.close();
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['src/server.js'], {
    cwd: path.resolve(__dirname, '..'), windowsHide: true, stdio: 'ignore',
    env: { ...process.env, PORT: String(port), DATABASE_FILE: dbPath, WAIVER_STORAGE_DIR: path.join(dir, 'waivers'), NODE_ENV: 'test', SESSION_SECURE: 'false' },
  });
  let browser;
  try {
    await expect.poll(async () => {
      try { return (await fetch(origin)).status; } catch { return 0; }
    }).toBe(200);
    // Use a fresh headless browser, never the operator's personal browser profile.
    browser = await chromium.launch({ channel: process.env.TEST_BROWSER_CHANNEL || 'chrome', headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    async function signedIn(tab = 'profile') {
      await expect(page.locator('#main-app')).toBeVisible();
      await expect(page.locator(`.tabs button[data-tab="${tab}"]`)).toHaveAttribute('aria-current', 'page');
    }
    async function login(account = accounts[0], tab = 'profile') {
      await page.locator('#login-email').fill(account.Email);
      await page.locator('#login-code').fill('1234');
      await page.locator('#login-form button[type="submit"]').click();
      await signedIn(tab);
    }
    async function screenshot(name) {
      await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
    }
    async function fitsViewport() {
      const sizes = await page.evaluate(() => ({ actual: document.documentElement.scrollWidth, viewport: innerWidth }));
      assert(sizes.actual <= sizes.viewport, `page overflow: ${JSON.stringify(sizes)}`);
    }
    async function expireSession() {
      // End only the isolated test session through the normal logout endpoint.
      await context.request.post(`${origin}/api/logout`);
      await page.locator('#save-all').click();
      await expect(page.locator('#login-card')).toBeVisible();
      await expect(page.locator('#main-app')).toBeHidden();
      await expect(page.locator('#login-error')).toContainText('session has expired');
      await expect(page.locator('#tab-trip-request')).toBeEmpty();
      await expect(page.locator('#session-info')).toBeEmpty();
    }

    await page.goto(`${origin}/profile`);
    await expect(page.locator('#login-card')).toBeVisible();
    await expect(page.locator('#login-card')).toContainText('not confirmed reservations');
    await page.setViewportSize({ width: 360, height: 800 });
    await fitsViewport();
    await screenshot('mobile-sign-in');
    await page.locator('#login-email').focus();
    assert.notStrictEqual(await page.locator('#login-email').evaluate((element) => getComputedStyle(element).outlineStyle), 'none');
    await page.route('**/api/send-email', (route) => route.fulfill({ json: { ok: true } }));
    await page.locator('#login-email').fill(accounts[0].Email);
    await page.locator('#send-login-code').click();
    await expect(page.locator('#login-error')).toContainText('If we have the email on file');
    await login();
    await expect(page).toHaveURL(`${origin}/profile`);
    await fitsViewport();
    await screenshot('mobile-profile');
    await page.reload();
    await signedIn();
    await page.goto(`${origin}/profile?email=${accounts[0].Email}&code=1234`);
    await signedIn();
    await expect(page).toHaveURL(`${origin}/profile`);
    await page.locator('.tabs button[data-tab="trip-request"]').click();
    await signedIn('trip-request');
    await expect(page).toHaveURL(`${origin}/trip-requests`);
    await fitsViewport();
    await screenshot('mobile-trip-requests');
    const historyLength = await page.evaluate(() => history.length);
    await page.goBack();
    await signedIn();
    await page.goForward();
    await signedIn('trip-request');
    assert.strictEqual(await page.evaluate(() => history.length), historyLength);
    await page.setViewportSize({ width: 1280, height: 900 });
    await screenshot('desktop-trip-requests');
    await page.locator('.tabs button[data-tab="profile"]').focus();
    await page.keyboard.press('Enter');
    await signedIn();
    await screenshot('desktop-profile');
    for (const url of ['/admin', '/work-parties', '/unknown']) {
      await page.goto(origin + url);
      await signedIn('trip-request');
      await expect(page).toHaveURL(`${origin}/trip-requests`);
      await expect(page.locator('#navigation-message')).not.toBeEmpty();
      await expect(page.locator('#tab-admin')).toBeEmpty();
    }
    await page.goto(origin);
    await signedIn('trip-request');
    await expect(page.locator('#navigation-message')).toBeEmpty();
    await expect(page.locator('#work-party-tab-btn')).toBeDisabled();

    const year = new Date().getFullYear();
    await page.locator('[data-k="arrival"]').fill(`${year}-12-20`);
    await page.locator('[data-k="departure"]').fill(`${year}-12-22`);
    await page.locator('[data-k="spotsIdeal"]').fill('3');
    await page.locator('#save-all').click();
    await expect(page.locator('#requests-msg')).toHaveText('All requests saved.');
    await page.reload();
    await signedIn('trip-request');
    await expect(page.locator('[data-k="spotsIdeal"]')).toHaveValue('3');
    await page.locator('[data-k="spotsIdeal"]').fill('5');
    await expireSession();
    await login(accounts[0], 'trip-request');
    await expect(page.locator('[data-k="spotsIdeal"]')).toHaveValue('5');
    let reader = new SqliteStore({ dbPath, importTsv: false });
    assert.strictEqual(reader.getRequestsByRequestorId(accounts[0].Requestor_ID)[0].Spots_ideal, 3, 'reauthentication must not auto-save');
    reader.close();
    await expireSession();
    await login(accounts[1], 'trip-request');
    await expect(page.locator('[data-k="spotsIdeal"]')).not.toHaveValue('5');
    await page.locator('#logout-btn').click();
    await expect(page).toHaveURL(`${origin}/`);
    await expect(page.locator('#main-app')).toBeHidden();
    await page.goto(`${origin}/profile?email=${accounts[0].Email}&code=1234`);
    await signedIn();
    await expect(page).toHaveURL(`${origin}/profile`);
    await page.locator('#logout-btn').click();
    await page.goto(`${origin}/profile?email=${accounts[1].Email}&hash=1234`);
    await signedIn();
    await expect(page).toHaveURL(`${origin}/profile`);
    await page.locator('#logout-btn').click();
    await page.goto(`${origin}/profile?email=MISSING%40EXAMPLE.COM&code=9999`);
    await expect(page.locator('#login-error')).not.toBeEmpty();
    await expect(page).toHaveURL(`${origin}/profile`);
    await page.goto(`${origin}/profile?returnTo=https://example.com`);
    await login(accounts[0]);
    assert.strictEqual(new URL(page.url()).origin, origin);
    await page.route('**/api/requestor/*/requests', (route) => route.fulfill({ status: 500, json: { error: 'Test server failure' } }));
    await page.goto(`${origin}/trip-requests`);
    await signedIn('trip-request');
    await page.locator('#save-all').click();
    await expect(page.locator('#requests-msg')).toHaveText('Test server failure');
    await expect(page.locator('#main-app')).toBeVisible();
    await page.unroute('**/api/requestor/*/requests');
    await page.route('**/api/requestor/*/requests', (route) => route.abort());
    await page.locator('#save-all').click();
    await expect(page.locator('#requests-msg')).toContainText('fetch');
    await expect(page.locator('#main-app')).toBeVisible();
    await page.unroute('**/api/requestor/*/requests');
    await page.goto(`${origin}/profile`);
    await signedIn();
    await context.request.post(`${origin}/api/logout`);
    await page.locator('#profile-form button[type="submit"]').click();
    await expect(page.locator('#login-card')).toBeVisible();
    await expect(page.locator('#tab-profile')).toBeEmpty();
    await login(accounts[0]);
    await page.locator('#logout-btn').click();

    await page.goto(`${origin}/admin`);
    await login(accounts[2], 'admin');
    await screenshot('desktop-admin');
    await page.setViewportSize({ width: 360, height: 800 });
    await fitsViewport();
    await screenshot('mobile-admin');
    for (const [mode, tab, expectedPath] of [['work-party', 'work-party', '/work-parties'], ['inactive', 'profile', '/profile'], ['trip-request', 'trip-request', '/trip-requests']]) {
      await page.goto(`${origin}/admin`);
      await signedIn('admin');
      await page.locator('#app-mode').selectOption(mode);
      await page.locator('#save-mode').click();
      await expect(page.locator('#mode-msg')).toHaveText('Saved.');
      await signedIn('admin');
      await page.goto(origin);
      await signedIn(tab);
      await expect(page).toHaveURL(origin + expectedPath);
      await page.goto(origin + (mode === 'trip-request' ? '/work-parties' : '/trip-requests'));
      await signedIn(tab);
      await page.goto(`${origin}/profile`);
      await signedIn();
      await page.reload();
      await signedIn();
    }
    assert.deepStrictEqual(errors, [], `unexpected browser errors: ${errors.join(', ')}`);
    console.log('Standalone browser test passed: navigation, modes, authentication, draft ownership, save/reload, and mobile layout.');
    console.log(`Visual verification screenshots: ${dir}`);
  } finally {
    if (browser) await browser.close();
    server.kill();
    await new Promise((resolve) => server.exitCode !== null ? resolve() : server.once('exit', resolve));
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
