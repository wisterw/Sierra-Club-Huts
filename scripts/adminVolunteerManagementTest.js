const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { SqliteStore } = require('../src/data/sqliteStore');

function makeTempDb(prefix = 'sierra-club-huts-admin-volunteers-') {
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
  const waiverStorageDir = path.join(path.dirname(dbPath), 'waivers');
  const store = new SqliteStore({ dbPath, waiverStorageDir, importTsv: false });

  const admin = store.upsertRequestor({ Email: 'ADMIN.VOLUNTEERS@EXAMPLE.COM', Admin: true });
  const volunteer = store.upsertRequestor({
    Email: 'VOLUNTEER.ONE@EXAMPLE.COM',
    first_name: 'Val',
    last_name: 'One',
    Phone: '555-1111',
    city: 'Truckee',
    years_of_service: '2024 2025',
    has_a_chainsaw: true,
    chainsaw_user: false,
    private_comments: 'initial note',
  });

  store.upsertWorkParty({
    Friday_check_in: '2026-08-14',
    Hut: 'Benson',
    Sunday_check_out: '2026-08-16',
    Leader: 'Leader One',
    Capacity: 8,
  });
  store.upsertWorkParty({
    Friday_check_in: '2026-08-21',
    Hut: 'Bradley',
    Sunday_check_out: '2026-08-23',
    Leader: 'Leader Two',
    Capacity: 8,
  });
  store.saveWorkPartyInterests(volunteer.Requestor_ID, [
    { Friday_check_in: '2026-08-14', Hut: 'Benson', Interest: 'please consider me', Confirmation_status: 'pending' },
    { Friday_check_in: '2026-08-21', Hut: 'Bradley', Interest: 'only if you need me', Confirmation_status: 'waitlisted' },
  ]);
  store.replaceRequestsForRequestor(volunteer.Requestor_ID, [
    {
      Requestor_ID: volunteer.Requestor_ID,
      Benson: true,
      Bradley: false,
      Grubb: false,
      Ludlow: false,
      Arrival: '2026-12-20',
      Departure: '2026-12-22',
      Choice_Number: 1,
      Spots_ideal: 2,
      Spots_min: 1,
      Status: 'requested',
    },
  ]);

  const options = store.listWorkPartyFilterOptions(2026);
  assert.strictEqual(options.length, 2, 'expected work-party filter options');
  const bensonKey = options.find((row) => row.Hut === 'Benson').key;
  const bradleyKey = options.find((row) => row.Hut === 'Bradley').key;

  let payload = store.volunteerManagementPayload({ year: 2026, workPartyKey: bensonKey, acceptedStatus: 'pending' });
  assert(payload.rows.some((row) => row.Requestor_ID === volunteer.Requestor_ID), 'expected pending Benson volunteer');
  const row = payload.rows.find((x) => x.Requestor_ID === volunteer.Requestor_ID);
  assert.strictEqual(row.private_comments, 'initial note');
  assert.strictEqual(row.selected_work_party_status, 'pending');
  assert.strictEqual(row.hut_trip_request_count, 1);
  assert.strictEqual(row.waiver_status, 'not approved');

  payload = store.volunteerManagementPayload({ year: 2026, workPartyKey: bradleyKey, acceptedStatus: 'waitlisted' });
  assert(payload.rows.some((x) => x.Requestor_ID === volunteer.Requestor_ID), 'expected waitlisted Bradley volunteer');

  const commentsUpdated = store.updatePrivateComments(volunteer.Requestor_ID, 'updated private');
  assert.strictEqual(commentsUpdated.private_comments, 'updated private');
  const publicView = store.getRequestorById(volunteer.Requestor_ID);
  assert(!Object.prototype.hasOwnProperty.call(publicView, 'private_comments'), 'non-admin public view must hide private comments');

  store.saveLiabilityWaiverFile(volunteer.Requestor_ID, {
    originalname: 'waiver.pdf',
    mimetype: 'application/pdf',
    size: 6,
    buffer: Buffer.from('signed'),
  });
  store.approveLiabilityWaiver(volunteer.Requestor_ID, '2026-07-14');
  payload = store.volunteerManagementPayload({ year: 2026, waiverStatus: 'approved' });
  assert(payload.rows.some((x) => x.Requestor_ID === volunteer.Requestor_ID), 'expected approved waiver filter match');

  store.updateWorkPartyAcceptedStatus(volunteer.Requestor_ID, { workPartyKey: bensonKey }, 'accepted');
  store.updateWorkPartyAttendanceStatus(volunteer.Requestor_ID, { workPartyKey: bensonKey }, 'full attended');
  const updated = store.getWorkPartyRequest(volunteer.Requestor_ID, { workPartyKey: bensonKey });
  assert.strictEqual(updated.Accepted_status, 'accepted');
  assert.strictEqual(updated.Attendance_status, 'full attended');

  assert.throws(
    () => store.updateWorkPartyAcceptedStatus(volunteer.Requestor_ID, {}, 'accepted'),
    /specific work party/i,
    'ambiguous work-party update should fail'
  );

  store.close();
  return { adminEmail: admin.Email };
}

async function runApiAuthorizationAssertions() {
  const dbPath = makeTempDb('sierra-club-huts-admin-volunteers-api-');
  const port = '3013';
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
    const admin = store.upsertRequestor({ Email: 'ADMIN.API@EXAMPLE.COM', Admin: true });
    const user = store.upsertRequestor({ Email: 'USER.API@EXAMPLE.COM', Admin: false });
    store.upsertWorkParty({
      Friday_check_in: '2026-08-14',
      Hut: 'Benson',
      Sunday_check_out: '2026-08-16',
      Leader: 'Leader One',
      Capacity: 8,
    });
    store.saveWorkPartyInterests(user.Requestor_ID, [
      { Friday_check_in: '2026-08-14', Hut: 'Benson', Interest: 'please consider me', Confirmation_status: 'pending' },
    ]);
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
    let res = await fetch(`${base}/admin/volunteers`, {
      headers: { Cookie: userCookie },
    });
    assert.strictEqual(res.status, 403, 'non-admin volunteer grid read should be rejected');

    res = await fetch(`${base}/admin/volunteers/${user.Requestor_ID}/private-comments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: userCookie },
      body: JSON.stringify({ private_comments: 'bad' }),
    });
    assert.strictEqual(res.status, 403, 'non-admin volunteer mutation should be rejected');

    const adminCookie = await login(admin.Email);
    res = await fetch(`${base}/admin/volunteers`, {
      headers: { Cookie: adminCookie },
    });
    assert(res.ok, 'admin volunteer grid read should succeed');
    const payload = await res.json();
    const benson = payload.filters.workParties.find((row) => row.Hut === 'Benson');
    assert(benson, 'expected work party filter option');

    res = await fetch(`${base}/admin/volunteers/${user.Requestor_ID}/work-party-accepted-status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ status: 'accepted' }),
    });
    assert.strictEqual(res.status, 400, 'ambiguous work-party API mutation should be rejected');

    res = await fetch(`${base}/admin/volunteers/${user.Requestor_ID}/work-party-accepted-status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ workPartyKey: benson.key, status: 'accepted' }),
    });
    assert(res.ok, 'specific work-party accepted update should succeed');
  } finally {
    server.kill('SIGTERM');
  }
}

async function run() {
  runStoreAssertions();
  await runApiAuthorizationAssertions();
  console.log('admin volunteer management test passed.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
