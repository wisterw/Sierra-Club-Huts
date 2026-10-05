const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');
const { chromium, expect } = require('@playwright/test');
const { SqliteStore } = require('../src/data/sqliteStore');

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'huts-allocation-browser-'));
  const dbPath = path.join(dir, 'huts.sqlite');
  const store = new SqliteStore({ dbPath, importTsv: false });
  const admin = store.upsertRequestor({ Email: 'ALLOCATION.BROWSER@EXAMPLE.COM', Admin: true, Credits: 3 });
  const other = store.upsertRequestor({ Email: 'ALLOCATION.OTHER@EXAMPLE.COM', Credits: 2 });
  const year = new Date().getFullYear();
  const request = { Benson: true, Arrival: `${year}-12-20`, Departure: `${year}-12-22`, Choice_Number: 1, Spots_min: 4, Spots_ideal: 12 };
  store.replaceRequestsForRequestor(admin.Requestor_ID, [request]);
  store.replaceRequestsForRequestor(other.Requestor_ID, [{ ...request, Spots_ideal: 4 }]);
  store.updateRequestorAuthFields(admin.Requestor_ID, { login_code: 1234, code_generated_when: new Date().toISOString() });
  store.setApplicationMode('trip-request'); store.close();
  const socket = net.createServer(); await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port; await new Promise((resolve) => socket.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['src/server.js'], { cwd: path.resolve(__dirname, '..'), windowsHide: true, stdio: 'ignore',
    env: { ...process.env, NODE_ENV: 'test', DATABASE_FILE: dbPath, WAIVER_STORAGE_DIR: path.join(dir, 'waivers'), PORT: String(port), SESSION_SECURE: 'false', CONTENTION_ALERTS_ENABLED: 'false' } });
  let browser;
  try {
    await expect.poll(async () => { try { return (await fetch(origin)).status; } catch { return 0; } }).toBe(200);
    browser = await chromium.launch({ channel: process.env.TEST_BROWSER_CHANNEL || 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = []; page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${origin}/admin`);
    await page.locator('#login-email').fill(admin.Email); await page.locator('#login-code').fill('1234');
    await page.locator('#login-form button[type="submit"]').click();
    await expect(page.locator('#main-app')).toBeVisible();
    await page.locator('[data-admin-section="application-settings"]').click();
    await page.locator('#regenerate-lottery').uncheck();
    const finished = page.waitForResponse((res) => res.url() === `${origin}/api/admin/run-assignment`);
    await page.locator('#run-assignment').click();
    assert.equal((await finished).status(), 200);
    await expect(page.locator('#assign-msg')).toContainText('completed optimally: 24 person-nights');
    await expect(page.locator('#run-assignment')).toBeEnabled();
    await page.locator('[data-admin-section="efficiency-report"]').click(); await page.locator('#load-efficiency').click();
    await expect(page.locator('#eff-table')).toContainText('Optimal allocation summary');
    await expect(page.locator('#eff-table')).toContainText('3 credits: 1; 2 credits: 1');
    await page.screenshot({ path: path.join(dir, 'allocation-summary.png'), fullPage: true });
    const historyStore = new SqliteStore({ dbPath, importTsv: false });
    try {
      const saved = historyStore.db.prepare('SELECT * FROM allocation_runs ORDER BY run_id DESC LIMIT 1').get();
      const oldSummary = { ...JSON.parse(saved.summary), policyVersion: 'credit-rank-person-nights-v1' };
      historyStore.db.prepare('UPDATE allocation_runs SET summary = ? WHERE run_id = ?').run(JSON.stringify(oldSummary), saved.run_id);
    } finally { historyStore.close(); }
    await page.locator('#load-efficiency').click();
    await expect(page.locator('#eff-table')).toContainText('out of date');
    const update = await page.request.put(`${origin}/api/requestor/${other.Requestor_ID}`, { data: { Credits: 2.1 } });
    assert.equal(update.status(), 200);
    await page.locator('#load-efficiency').click();
    await expect(page.locator('#eff-table')).toContainText('out of date');
    await page.request.put(`${origin}/api/mode`, { data: { mode: 'inactive' } });
    await page.locator('[data-admin-section="application-settings"]').click();
    await page.locator('#run-assignment').click();
    await expect(page.locator('#assign-msg')).toContainText('Assignment was not saved: Run assignment in trip-request mode');
    await expect(page.locator('#run-assignment')).toBeEnabled();
    assert.deepEqual(errors, []);
    console.log(`Allocation browser test passed: run results, score/person-night summary, stale reporting and failure recovery. Screenshot: ${dir}`);
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM'); await new Promise((resolve) => server.exitCode !== null ? resolve() : server.once('exit', resolve));
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
