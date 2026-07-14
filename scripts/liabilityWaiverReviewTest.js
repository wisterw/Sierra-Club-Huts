const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { SqliteStore } = require('../src/data/sqliteStore');

function makeTempPaths(prefix = 'sierra-club-huts-waivers-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return {
    dir,
    dbPath: path.join(dir, 'huts.sqlite'),
    waiverStorageDir: path.join(dir, 'waivers'),
  };
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
  const paths = makeTempPaths();
  const store = new SqliteStore({
    dbPath: paths.dbPath,
    waiverStorageDir: paths.waiverStorageDir,
    importTsv: false,
  });
  const requestor = store.upsertRequestor({
    Email: 'WAIVER.STORE@EXAMPLE.COM',
    first_name: 'Wendy',
    last_name: 'Waiver',
  });

  assert.throws(
    () => store.approveLiabilityWaiver(requestor.Requestor_ID, '2026-07-14'),
    /submitted liability waiver/i,
    'approval should require a submitted waiver file'
  );

  const first = store.saveLiabilityWaiverFile(requestor.Requestor_ID, {
    originalname: 'signed.pdf',
    mimetype: 'application/pdf',
    size: 5,
    buffer: Buffer.from('first'),
  });
  assert(first.liability_waiver_file.endsWith('.pdf'));
  const firstPath = store.resolveLiabilityWaiverPath(first.liability_waiver_file);
  assert(fs.existsSync(firstPath), 'first waiver file should exist');

  const second = store.saveLiabilityWaiverFile(requestor.Requestor_ID, {
    originalname: 'replacement.png',
    mimetype: 'image/png',
    size: 6,
    buffer: Buffer.from('second'),
  });
  assert.notStrictEqual(second.liability_waiver_file, first.liability_waiver_file);
  assert(fs.existsSync(firstPath), 'replacement should not delete prior waiver file');
  assert(fs.existsSync(store.resolveLiabilityWaiverPath(second.liability_waiver_file)));

  let queue = store.listLiabilityWaiverReviewQueue(2026);
  assert(queue.some((row) => row.Requestor_ID === requestor.Requestor_ID), 'queue should include unapproved submitted waiver');

  store.approveLiabilityWaiver(requestor.Requestor_ID, '2026-07-14');
  queue = store.listLiabilityWaiverReviewQueue(2026);
  assert(!queue.some((row) => row.Requestor_ID === requestor.Requestor_ID), 'approved waiver should leave queue');

  assert.throws(
    () => store.resolveLiabilityWaiverPath('../outside.pdf'),
    /invalid waiver file pointer/i,
    'path traversal should be rejected'
  );

  const publicView = store.getRequestorById(requestor.Requestor_ID);
  assert(!Object.prototype.hasOwnProperty.call(publicView, 'liability_waiver_file'));
  assert(!Object.prototype.hasOwnProperty.call(publicView, 'liability_waiver_submitted_at'));

  store.close();
}

async function runApiAssertions() {
  const paths = makeTempPaths('sierra-club-huts-waivers-api-');
  const port = '3014';
  const server = spawn(process.execPath, ['src/server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      PORT: port,
      DATABASE_FILE: paths.dbPath,
      WAIVER_STORAGE_DIR: paths.waiverStorageDir,
    },
    stdio: 'ignore',
    windowsHide: true,
  });

  try {
    await waitFor(`http://127.0.0.1:${port}/`);
    const base = `http://127.0.0.1:${port}/api`;
    const store = new SqliteStore({
      dbPath: paths.dbPath,
      waiverStorageDir: paths.waiverStorageDir,
      importTsv: false,
    });
    const admin = store.upsertRequestor({ Email: 'WAIVER.ADMIN@EXAMPLE.COM', Admin: true });
    const user = store.upsertRequestor({ Email: 'WAIVER.USER@EXAMPLE.COM', Admin: false });
    const noFile = store.upsertRequestor({ Email: 'WAIVER.NOFILE@EXAMPLE.COM', Admin: false });
    store.close();

    async function login(email) {
      await fetch(`${base}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const reader = new SqliteStore({
        dbPath: paths.dbPath,
        waiverStorageDir: paths.waiverStorageDir,
        importTsv: false,
      });
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
    let res = await fetch(`${base}/liability-waiver/blank`, {
      headers: { Cookie: userCookie },
    });
    assert(res.ok, 'blank waiver download should succeed for authenticated user');

    const badFd = new FormData();
    badFd.append('file', new Blob(['bad'], { type: 'text/plain' }), 'waiver.txt');
    res = await fetch(`${base}/liability-waiver`, {
      method: 'POST',
      headers: { Cookie: userCookie },
      body: badFd,
    });
    assert.strictEqual(res.status, 400, 'unsupported upload should be rejected');

    const fd = new FormData();
    fd.append('file', new Blob(['signed waiver'], { type: 'application/pdf' }), 'waiver.pdf');
    res = await fetch(`${base}/liability-waiver`, {
      method: 'POST',
      headers: { Cookie: userCookie },
      body: fd,
    });
    assert(res.ok, 'waiver upload should succeed');
    const uploadPayload = await res.json();
    assert.strictEqual(uploadPayload.message, 'Your waiver will be reviewed manually over the next few days');
    assert(!Object.prototype.hasOwnProperty.call(uploadPayload.requestor, 'liability_waiver_file'));

    res = await fetch(`${base}/me`, { headers: { Cookie: userCookie } });
    const me = await res.json();
    assert(!Object.prototype.hasOwnProperty.call(me, 'liability_waiver_file'), 'non-admin me response should hide pointer');

    res = await fetch(`${base}/admin/liability-waivers/${user.Requestor_ID}/download`, {
      headers: { Cookie: userCookie },
    });
    assert.strictEqual(res.status, 403, 'non-admin submitted waiver download should be rejected');

    const adminCookie = await login(admin.Email);
    res = await fetch(`${base}/admin/liability-waivers?year=2026`, {
      headers: { Cookie: adminCookie },
    });
    assert(res.ok, 'admin waiver queue should load');
    let queue = await res.json();
    assert(queue.rows.some((row) => row.Requestor_ID === user.Requestor_ID), 'admin queue should include uploaded waiver');

    res = await fetch(`${base}/admin/liability-waivers/${user.Requestor_ID}/download`, {
      headers: { Cookie: adminCookie },
    });
    assert(res.ok, 'admin submitted waiver download should succeed');

    res = await fetch(`${base}/admin/liability-waivers/${noFile.Requestor_ID}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ date: '2026-07-14' }),
    });
    assert.strictEqual(res.status, 400, 'approval without a submitted waiver should be rejected');

    res = await fetch(`${base}/admin/liability-waivers/${user.Requestor_ID}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ date: '2026-07-14' }),
    });
    assert(res.ok, 'admin approval should succeed for submitted waiver');

    res = await fetch(`${base}/admin/liability-waivers?year=2026`, {
      headers: { Cookie: adminCookie },
    });
    queue = await res.json();
    assert(!queue.rows.some((row) => row.Requestor_ID === user.Requestor_ID), 'approved waiver should leave queue');
  } finally {
    server.kill('SIGTERM');
  }
}

async function run() {
  runStoreAssertions();
  await runApiAssertions();
  console.log('liability waiver review test passed.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
