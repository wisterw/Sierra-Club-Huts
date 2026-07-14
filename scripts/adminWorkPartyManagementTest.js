const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { SqliteStore } = require('../src/data/sqliteStore');

function makeTempDb(prefix = 'sierra-club-huts-admin-work-parties-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
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
    } catch {
      // keep polling
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function runStoreAssertions() {
  const dbPath = makeTempDb();
  const store = new SqliteStore({ dbPath, importTsv: false });

  const leader = store.upsertRequestor({
    Email: 'LEADER.WORKPARTY@EXAMPLE.COM',
    first_name: 'Leader',
    last_name: 'One',
    Phone: '555-1212',
    Admin: true,
  });
  const volunteer = store.upsertRequestor({ Email: 'WORKPARTY.VOLUNTEER@EXAMPLE.COM' });

  const created = store.createWorkParty({
    Friday_check_in: '2026-08-14',
    Hut: 'Benson',
    Sunday_check_out: '2026-08-16',
    Leader: 'Leader One',
    Leader_contact: '555-1212',
    Capacity: 8,
    Availability: 'open',
    Party_comments: 'Trail work',
  });
  assert.strictEqual(created.Hut, 'Benson');
  assert.strictEqual(created.Leader_contact, '555-1212');

  assert.throws(
    () => store.createWorkParty({ Friday_check_in: '2026-08-14', Hut: 'Benson', Capacity: 8 }),
    /already exists/i,
    'duplicate hut/date create should fail'
  );

  let payload = store.adminWorkPartyManagementPayload(2026);
  assert(payload.rows.some((row) => row.key === '2026-08-14|Benson'), 'created work party should appear in admin list');
  assert(payload.leaderOptions.some((row) => row.Requestor_ID === leader.Requestor_ID), 'admin user should appear as leader option');

  const updated = store.updateWorkParty({ workPartyKey: '2026-08-14|Benson' }, {
    Friday_check_in: '2026-09-01',
    Hut: 'Bradley',
    Sunday_check_out: '2026-08-17',
    Leader: 'Leader Updated',
    Leader_contact: 'leader@example.com',
    Capacity: 9,
    Availability: 'closed',
    Party_comments: 'Updated',
  });
  assert.strictEqual(updated.Friday_check_in, '2026-08-14', 'identity date should remain unchanged');
  assert.strictEqual(updated.Hut, 'Benson', 'identity hut should remain unchanged');
  assert.strictEqual(updated.Sunday_check_out, '2026-08-17');
  assert.strictEqual(updated.Availability, 'closed');

  store.saveWorkPartyInterests(volunteer.Requestor_ID, [
    { Friday_check_in: '2026-08-14', Hut: 'Benson', Interest: 'please consider me' },
  ]);
  assert.strictEqual(store.db.prepare('SELECT COUNT(*) AS c FROM work_party_requests').get().c, 1);
  assert.strictEqual(store.deleteWorkParty({ workPartyKey: '2026-08-14|Benson' }), true);
  assert.strictEqual(store.db.prepare('SELECT COUNT(*) AS c FROM work_party_requests').get().c, 0, 'delete should cascade requests');
  assert.strictEqual(store.deleteWorkParty({ workPartyKey: '2026-08-14|Benson' }), false);

  store.close();
}

async function runApiAssertions() {
  const dbPath = makeTempDb('sierra-club-huts-admin-work-parties-api-');
  const port = '3015';
  const server = spawn(process.execPath, ['src/server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: port, DATABASE_FILE: dbPath },
    stdio: 'ignore',
    windowsHide: true,
  });

  try {
    await waitFor(`http://127.0.0.1:${port}/`);
    const base = `http://127.0.0.1:${port}/api`;
    const store = new SqliteStore({ dbPath, importTsv: false });
    const admin = store.upsertRequestor({ Email: 'ADMIN.WORKPARTY.API@EXAMPLE.COM', Admin: true });
    const user = store.upsertRequestor({ Email: 'USER.WORKPARTY.API@EXAMPLE.COM', Admin: false });
    store.close();

    async function login(email) {
      await fetch(`${base}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const reader = new SqliteStore({ dbPath, importTsv: false });
      const requestor = reader.getRequestorByEmail(email, { includePrivate: true });
      reader.close();
      const res = await fetch(`${base}/check-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: requestor.login_code }),
      });
      assert(res.ok, `login should succeed for ${email}`);
      return (res.headers.get('set-cookie') || '').split(';')[0];
    }

    const userCookie = await login(user.Email);
    let res = await fetch(`${base}/admin/work-parties?year=2026`, { headers: { Cookie: userCookie } });
    assert.strictEqual(res.status, 403, 'non-admin list should be rejected');

    const adminCookie = await login(admin.Email);
    const adminHeaders = { 'Content-Type': 'application/json', Cookie: adminCookie };
    res = await fetch(`${base}/admin/work-parties`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        year: 2026,
        Friday_check_in: '2026-08-14',
        Hut: 'Benson',
        Sunday_check_out: '2026-08-16',
        Leader: 'API Leader',
        Leader_contact: 'api@example.com',
        Capacity: 8,
        Availability: 'open',
      }),
    });
    assert(res.ok, 'admin create should succeed');
    let payload = await res.json();
    assert(payload.payload.rows.some((row) => row.key === '2026-08-14|Benson'));

    res = await fetch(`${base}/admin/work-parties`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ Friday_check_in: '2026-08-14', Hut: 'Benson', Capacity: 8 }),
    });
    assert.strictEqual(res.status, 400, 'duplicate create should fail');

    res = await fetch(`${base}/admin/work-parties/${encodeURIComponent('2026-08-14|Benson')}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        year: 2026,
        Friday_check_in: '2026-09-01',
        Hut: 'Bradley',
        Sunday_check_out: '2026-08-17',
        Leader: 'Edited API Leader',
        Leader_contact: 'edited@example.com',
        Capacity: 9,
        Availability: 'waitlist-only',
      }),
    });
    assert(res.ok, 'admin update should succeed');
    payload = await res.json();
    assert.strictEqual(payload.row.Friday_check_in, '2026-08-14');
    assert.strictEqual(payload.row.Hut, 'Benson');
    assert.strictEqual(payload.row.Availability, 'waitlist-only');

    res = await fetch(`${base}/work-parties?year=2026`, { headers: adminHeaders });
    payload = await res.json();
    assert(payload.rows.some((row) => row.Hut === 'Benson'), 'created work party should appear in signup API');

    res = await fetch(`${base}/admin/work-parties/${encodeURIComponent('2026-08-14|Benson')}?year=2026`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    assert(res.ok, 'admin delete should succeed');

    res = await fetch(`${base}/work-parties?year=2026`, { headers: adminHeaders });
    payload = await res.json();
    assert(!payload.rows.some((row) => row.Hut === 'Benson'), 'deleted work party should leave signup API');
  } finally {
    server.kill('SIGTERM');
  }
}

async function run() {
  runStoreAssertions();
  await runApiAssertions();
  console.log('admin work party management test passed.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
