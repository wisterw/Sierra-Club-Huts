const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { SqliteStore } = require('../src/data/sqliteStore');

function makeTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sierra-club-huts-smoke-'));
  return path.join(dir, 'huts.sqlite');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(url) {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch (err) {
      // keep polling
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function run() {
  const dbPath = makeTempDb();
  const port = '3002';
  const server = spawn(process.execPath, ['src/server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: port, DATABASE_FILE: dbPath },
    stdio: 'ignore',
    windowsHide: true,
  });

  try {
    await waitFor(`http://127.0.0.1:${port}/`);
    const base = `http://127.0.0.1:${port}/api`;
    const adminEmail = 'HUT.COORD@YAHOO.COM';

    await fetch(`${base}/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail }),
    });

    const store = new SqliteStore({ dbPath, importTsv: false });
    const admin = store.getRequestorByEmail(adminEmail, { includePrivate: true });
    assert(admin, 'expected admin requestor');
    const code = admin.login_code;

    const loginRes = await fetch(`${base}/check-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, code }),
    });
    assert(loginRes.ok, 'login should succeed');
    const cookie = (loginRes.headers.get('set-cookie') || '').split(';')[0];
    const authHeaders = { 'Content-Type': 'application/json', Cookie: cookie };

    const me = await (await fetch(`${base}/me`, { headers: authHeaders })).json();
    assert.strictEqual(me.Admin, true);

    let res = await fetch(`${base}/mode`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ mode: 'trip-request' }),
    });
    assert(res.ok, 'mode update should succeed');
    res = await fetch(`${base}/mode`, { headers: authHeaders });
    const mode = await res.json();
    assert.strictEqual(mode.mode, 'trip-request');

    const requestPayload = {
      requests: [
        {
          Requestor_ID: me.Requestor_ID,
          Benson: true,
          Bradley: false,
          Grubb: false,
          Ludlow: false,
          Arrival: '2026-12-20',
          Departure: '2026-12-22',
          Choice_Number: 1,
          Spots_ideal: 2,
          Spots_min: 1,
          Hut_granted: '',
          Spots_granted: 0,
          Status: 'requested',
          Confirmed_How: '',
          Assignment_audit: '',
          Creation_date: '',
          Last_mod_date: '',
        },
      ],
    };
    res = await fetch(`${base}/requestor/${me.Requestor_ID}/requests`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(requestPayload),
    });
    assert(res.ok, 'request save should succeed');

    const requestSummary = await (await fetch(`${base}/request-summary?choiceNumber=1&excludeRequestorId=${me.Requestor_ID}`, { headers: authHeaders })).json();
    assert(Array.isArray(requestSummary.rows), 'request summary should return rows');

    store.upsertWorkParty({
      Friday_check_in: '2026-08-14',
      Hut: 'Benson',
      Sunday_check_out: '2026-08-16',
      Leader: 'Leader One',
      Leader_phone: '555-111-2222',
      Capacity: 8,
      Party_comments: 'Trail work',
    });
    store.close();

    res = await fetch(`${base}/mode`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ mode: 'work-party' }),
    });
    assert(res.ok, 'work-party mode update should succeed');

    const workPartyRes = await (await fetch(`${base}/work-parties?year=2026`, { headers: authHeaders })).json();
    assert(Array.isArray(workPartyRes.rows) && workPartyRes.rows.length > 0, 'work-party list should return rows');

    res = await fetch(`${base}/work-parties`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        year: 2026,
        requestorId: me.Requestor_ID,
        interests: [
          { Friday_check_in: '2026-08-14', Hut: 'Benson', Interest: 'please consider me' },
        ],
      }),
    });
    assert(res.ok, 'work-party save should succeed');

    res = await fetch(`${base}/admin/regenerate-lottery`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    });
    assert(res.ok, 'lottery regeneration should succeed');

    res = await fetch(`${base}/admin/run-assignment`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ regenerateLotteryNumbers: false }),
    });
    assert(res.ok, 'assignment should succeed');

    res = await fetch(`${base}/admin/download/requests-joined?filter=all`, { headers: authHeaders });
    assert(res.ok, 'joined download should succeed');

    console.log('browser smoke test passed.');
  } finally {
    server.kill('SIGTERM');
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
