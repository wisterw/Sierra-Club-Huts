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
  const waiverStorageDir = path.join(path.dirname(dbPath), 'waivers');
  const port = '3002';
  const server = spawn(process.execPath, ['src/server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: port, DATABASE_FILE: dbPath, WAIVER_STORAGE_DIR: waiverStorageDir },
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

    const store = new SqliteStore({ dbPath, waiverStorageDir, importTsv: false });
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
    const volunteer = store.upsertRequestor({
      Email: 'VOLUNTEER.SMOKE@EXAMPLE.COM',
      first_name: 'Volunteer',
      last_name: 'Smoke',
      Credits: 1,
    });
    store.saveWorkPartyInterests(volunteer.Requestor_ID, [
      { Friday_check_in: '2026-08-14', Hut: 'Benson', Interest: 'please consider me', Confirmation_status: 'pending' },
    ]);
    store.replaceRequestsForRequestor(volunteer.Requestor_ID, [{
      Requestor_ID: volunteer.Requestor_ID,
      Benson: false,
      Bradley: true,
      Grubb: false,
      Ludlow: false,
      Arrival: '2026-12-27',
      Departure: '2026-12-29',
      Choice_Number: 1,
      Spots_ideal: 3,
      Spots_min: 2,
      Status: 'requested',
    }]);
    store.close();

    const volunteerProfile = await (await fetch(`${base}/requestor/${volunteer.Requestor_ID}`, { headers: authHeaders })).json();
    assert.strictEqual(volunteerProfile.Requestor_ID, volunteer.Requestor_ID, 'admin profile should target the selected requestor');
    assert.strictEqual(volunteerProfile.workPartyHistory.length, 1, 'admin target profile should include pending work-party history');
    assert.strictEqual(volunteerProfile.workPartyHistory[0].Hut, 'Benson');
    assert.strictEqual(volunteerProfile.requests.length, 1, 'admin target profile should include ski-trip requests');
    assert.strictEqual(volunteerProfile.requests[0].Bradley, true);

    await fetch(`${base}/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: volunteer.Email }),
    });
    const volunteerReader = new SqliteStore({ dbPath, importTsv: false });
    const volunteerLoginCode = volunteerReader.getRequestorById(volunteer.Requestor_ID, { includePrivate: true }).login_code;
    volunteerReader.close();
    const volunteerLogin = await fetch(`${base}/check-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: volunteer.Email, code: volunteerLoginCode }),
    });
    assert(volunteerLogin.ok, 'volunteer login should succeed');
    const volunteerCookie = (volunteerLogin.headers.get('set-cookie') || '').split(';')[0];
    const forbiddenProfile = await fetch(`${base}/requestor/${me.Requestor_ID}`, {
      headers: { 'Content-Type': 'application/json', Cookie: volunteerCookie },
    });
    assert.strictEqual(forbiddenProfile.status, 403, 'non-admin must not read another requestor profile history');

    res = await fetch(`${base}/mode`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ mode: 'work-party' }),
    });
    assert(res.ok, 'work-party mode update should succeed');

    const workPartyRes = await (await fetch(`${base}/work-parties?year=2026`, { headers: authHeaders })).json();
    assert(Array.isArray(workPartyRes.rows) && workPartyRes.rows.length > 0, 'work-party list should return rows');

    res = await fetch(`${base}/admin/work-parties`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        year: 2026,
        Friday_check_in: '2026-09-04',
        Hut: 'Grubb',
        Sunday_check_out: '2026-09-06',
        Leader: 'Admin Smoke',
        Leader_contact: 'admin-smoke@example.com',
        Capacity: 6,
        Availability: 'open',
      }),
    });
    assert(res.ok, 'admin work-party create should succeed');

    let adminWorkParties = await (await fetch(`${base}/admin/work-parties?year=2026`, { headers: authHeaders })).json();
    assert(adminWorkParties.rows.some((row) => row.key === '2026-09-04|Grubb'), 'admin work-party list should include created row');

    res = await fetch(`${base}/admin/work-parties/${encodeURIComponent('2026-09-04|Grubb')}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        year: 2026,
        Sunday_check_out: '2026-09-07',
        Leader: 'Admin Smoke Updated',
        Leader_contact: 'updated@example.com',
        Capacity: 7,
        Availability: 'closed',
      }),
    });
    assert(res.ok, 'admin work-party update should succeed');

    res = await fetch(`${base}/admin/work-parties/${encodeURIComponent('2026-09-04|Grubb')}?year=2026`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    assert(res.ok, 'admin work-party delete should succeed');

    adminWorkParties = await (await fetch(`${base}/admin/work-parties?year=2026`, { headers: authHeaders })).json();
    assert(!adminWorkParties.rows.some((row) => row.key === '2026-09-04|Grubb'), 'deleted admin work party should leave list');

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

    const volunteersRes = await (await fetch(`${base}/admin/volunteers?workPartyKey=2026-08-14%7CBenson&acceptedStatus=pending`, { headers: authHeaders })).json();
    assert(Array.isArray(volunteersRes.rows), 'volunteer grid should return rows');
    assert(volunteersRes.rows.some((row) => row.Requestor_ID === volunteer.Requestor_ID), 'volunteer grid should include pending applicant');

    res = await fetch(`${base}/admin/upload-requestors/sample`, { headers: authHeaders });
    assert(res.ok, 'requestor upload sample should download');
    assert.strictEqual(await res.text(), 'Email\tfirst_name\tlast_name\taddress\tcity\tstate\tzip\tPhone\n');

    const requestorFd = new FormData();
    requestorFd.append('file', new Blob([
      'EMAIL\tfirst_name\tcity\nBULK.SMOKE@EXAMPLE.COM\tBulk Volunteer\tTahoe City\n',
    ], { type: 'text/tab-separated-values' }), 'requestors.tsv');
    res = await fetch(`${base}/admin/upload-requestors`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: requestorFd,
    });
    assert(res.ok, 'bulk requestor upload should succeed');
    assert.deepStrictEqual(await res.json(), { ok: true, created: 1, updated: 0, skipped: 0 });
    const refreshedVolunteers = await (await fetch(`${base}/admin/volunteers`, { headers: authHeaders })).json();
    assert(refreshedVolunteers.rows.some((row) => row.Email === 'BULK.SMOKE@EXAMPLE.COM'), 'uploaded volunteer should appear after grid refresh');

    res = await fetch(`${base}/admin/volunteers/${volunteer.Requestor_ID}/private-comments`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ private_comments: 'smoke note' }),
    });
    assert(res.ok, 'private comment update should succeed');

    const waiverFd = new FormData();
    waiverFd.append('file', new Blob(['signed waiver'], { type: 'application/pdf' }), 'waiver.pdf');
    res = await fetch(`${base}/liability-waiver`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: waiverFd,
    });
    assert(res.ok, 'waiver upload should succeed');

    const waiverQueue = await (await fetch(`${base}/admin/liability-waivers?year=2026`, { headers: authHeaders })).json();
    assert(waiverQueue.rows.some((row) => row.Requestor_ID === me.Requestor_ID), 'waiver review queue should include uploaded waiver');

    res = await fetch(`${base}/admin/volunteers/${volunteer.Requestor_ID}/approve-waiver`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ date: '2026-07-14' }),
    });
    assert.strictEqual(res.status, 400, 'waiver approval without submitted waiver should fail');

    const volunteerStore = new SqliteStore({ dbPath, waiverStorageDir, importTsv: false });
    volunteerStore.saveLiabilityWaiverFile(volunteer.Requestor_ID, {
      originalname: 'volunteer-waiver.pdf',
      mimetype: 'application/pdf',
      size: 6,
      buffer: Buffer.from('signed'),
    });
    volunteerStore.close();

    res = await fetch(`${base}/admin/volunteers/${volunteer.Requestor_ID}/approve-waiver`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ date: '2026-07-14' }),
    });
    assert(res.ok, 'waiver approval should succeed after submission');

    res = await fetch(`${base}/admin/volunteers/${volunteer.Requestor_ID}/work-party-accepted-status`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ workPartyKey: '2026-08-14|Benson', status: 'accepted' }),
    });
    assert(res.ok, 'work-party accepted status update should succeed');

    res = await fetch(`${base}/admin/volunteers/${volunteer.Requestor_ID}/work-party-attendance-status`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ workPartyKey: '2026-08-14|Benson', status: 'full attended' }),
    });
    assert(res.ok, 'work-party attendance status update should succeed');

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
