const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const express = require('express');
const session = require('express-session');

async function run() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'huts-fractional-credits-'));
  process.env.DATABASE_FILE = path.join(dir, 'api.sqlite');
  process.env.WAIVER_STORAGE_DIR = path.join(dir, 'waivers');
  process.env.NODE_ENV = 'test';
  const { creditsToTenths, creditsFromTenths, normalizeCredits } = require('../src/services/credits');
  const { SqliteStore } = require('../src/data/sqliteStore');
  const { TsvStore, toTsv, parseTsv, REQUESTORS_HEADERS, REQUESTS_HEADERS } = require('../src/data/tsvStore');
  const { runAssignment, requestsJoinedReport } = require('../src/services/assignment');
  const { summarizeByChoice } = require('../src/services/requestLogic');
  const { documents, currentAgreementVersions } = require('../src/services/agreements');
  for (const [input, tenths] of [[0, 0], [-0, 0], [3, 30], ['3.0', 30], ['1.50', 15], [1.1, 11], [2.3, 23], ['.5', 5], [-0.5, -5], [' +2.50 ', 25]]) {
    assert.strictEqual(creditsToTenths(input), tenths);
    assert.strictEqual(creditsFromTenths(tenths), Number(input) || 0);
  }
  for (const value of [null, true, false, '', ' ', {}, NaN, Infinity, -Infinity, 'NaN', 'abc', 1.25, '0.01', Number.MAX_SAFE_INTEGER, '900719925474099.3']) {
    assert.throws(() => normalizeCredits(value), /Credits/);
  }
  // Exhaustive realistic balances expose multiplication/serialization edge cases.
  for (let tenths = -10000; tenths <= 10000; tenths += 1) {
    assert.strictEqual(creditsToTenths(creditsFromTenths(tenths)), tenths);
  }

  const migrationPath = path.join(dir, 'migration.sqlite');
  let fixture = new SqliteStore({ dbPath: migrationPath, importTsv: false });
  const whole = fixture.upsertRequestor({ Email: 'WHOLE@EXAMPLE.COM', Credits: 3, private_comments: 'unchanged' });
  const fractional = fixture.upsertRequestor({ Email: 'FRACTION@EXAMPLE.COM', Credits: 1.5 });
  fixture.updateRequestorAuthFields(whole.Requestor_ID, { login_code: 1234, code_generated_when: '2026-10-01' });
  fixture.replaceRequestsForRequestor(whole.Requestor_ID, [{ Benson: true, Arrival: '2026-12-20', Departure: '2026-12-22', Choice_Number: 1, Spots_ideal: 2, Spots_min: 1 }]);
  fixture.upsertWorkParty({ Friday_check_in: '2026-08-21', Sunday_check_out: '2026-08-23', Hut: 'Benson', Capacity: 8 });
  fixture.saveWorkPartyInterests(whole.Requestor_ID, [{ Friday_check_in: '2026-08-21', Hut: 'Benson', Interest: 'please consider me' }]);
  fixture.recordAgreementAcknowledgement(whole.Requestor_ID, documents);
  fixture.setApplicationMode('trip-request');
  const tables = ['ski_trip_requests', 'work_parties', 'work_party_requests', 'settings', 'agreement_documents', 'requestor_agreement_acknowledgements'];
  const snapshot = Object.fromEntries(tables.map((table) => [table, fixture.db.prepare(`SELECT * FROM ${table}`).all()]));
  const profiles = fixture.listRequestors({ includePrivate: true });
  // Recreate the pre-change column and values in this isolated fixture only.
  fixture.db.exec('ALTER TABLE requestors RENAME COLUMN credits_tenths TO credits; UPDATE requestors SET credits = credits / 10.0;');
  fixture.close();
  const backup = path.join(dir, 'pre-migration.sqlite');
  fs.copyFileSync(migrationPath, backup);
  for (let restart = 0; restart < 2; restart += 1) {
    fixture = new SqliteStore({ dbPath: migrationPath, importTsv: false });
    assert.deepStrictEqual(fixture.listRequestors({ includePrivate: true }), profiles);
    assert.strictEqual(fixture.db.prepare('SELECT credits_tenths FROM requestors WHERE requestor_id = ?').get(whole.Requestor_ID).credits_tenths, 30);
    assert.strictEqual(fixture.db.prepare('SELECT credits_tenths FROM requestors WHERE requestor_id = ?').get(fractional.Requestor_ID).credits_tenths, 15);
    for (const table of tables) assert.deepStrictEqual(fixture.db.prepare(`SELECT * FROM ${table}`).all(), snapshot[table]);
    fixture.close();
  }
  const restored = new DatabaseSync(backup);
  assert.strictEqual(restored.prepare('SELECT credits FROM requestors WHERE requestor_id = ?').get(whole.Requestor_ID).credits, 3, 'backup remains compatible with old credit units');
  restored.close();
  for (const [name, value, injectFailure] of [['precision', 1.25, false], ['invalid', 'invalid', false], ['write-failure', 3, true]]) {
    const failurePath = path.join(dir, `${name}.sqlite`);
    fs.copyFileSync(backup, failurePath);
    const db = new DatabaseSync(failurePath);
    db.prepare('UPDATE requestors SET credits = ? WHERE requestor_id = ?').run(value, whole.Requestor_ID);
    if (injectFailure) db.exec("CREATE TRIGGER fail_credit_migration BEFORE UPDATE ON requestors BEGIN SELECT RAISE(ABORT, 'injected migration failure'); END;");
    const before = db.prepare('SELECT * FROM requestors ORDER BY requestor_id').all();
    db.close();
    assert.throws(() => new SqliteStore({ dbPath: failurePath, importTsv: false }), injectFailure ? /injected migration failure/ : /Cannot migrate credits for requestor/);
    const reader = new DatabaseSync(failurePath);
    assert(reader.prepare('PRAGMA table_info(requestors)').all().some((column) => column.name === 'credits'));
    assert.deepStrictEqual(reader.prepare('SELECT * FROM requestors ORDER BY requestor_id').all(), before);
    reader.close();
  }

  const requestorsFile = path.join(dir, 'requestors.tsv');
  const requestsFile = path.join(dir, 'requests.tsv');
  fs.writeFileSync(requestsFile, toTsv(REQUESTS_HEADERS, []));
  fs.writeFileSync(requestorsFile, toTsv(REQUESTORS_HEADERS, [
    { Requestor_ID: 1001, Email: 'IMPORT@EXAMPLE.COM', Credits: '1.50' },
    { Requestor_ID: 1002, Email: 'IMPORT2@EXAMPLE.COM', Credits: 1.25 },
  ]));
  fixture = new SqliteStore({ dbPath: path.join(dir, 'import.sqlite'), importTsv: false });
  assert.throws(() => fixture.importTsv({ requestorsFile, requestsFile }), /one decimal place/);
  assert.deepStrictEqual(fixture.listRequestors(), []);
  fs.writeFileSync(requestorsFile, toTsv(REQUESTORS_HEADERS, [{ Requestor_ID: 1001, Email: 'IMPORT@EXAMPLE.COM', Credits: '1.50' }]));
  fixture.importTsv({ requestorsFile, requestsFile });
  assert.strictEqual(fixture.getRequestorById(1001).Credits, 1.5);
  fixture.close();
  // Exercise legacy repository writes without creating its recurring flush timer.
  const legacy = Object.create(TsvStore.prototype);
  legacy.requestors = []; legacy.requests = []; legacy.dirty = false;
  const legacyUser = legacy.upsertRequestor({ Email: 'LEGACY@EXAMPLE.COM', Credits: '1.50' });
  assert.strictEqual(legacyUser.Credits, 1.5);
  assert.throws(() => legacy.upsertRequestor({ Email: legacyUser.Email, first_name: 'Wrong', Credits: 1.25 }), /one decimal place/);
  assert.notStrictEqual(legacyUser.first_name, 'Wrong');
  assert.throws(() => legacy.updateRequestorById(legacyUser.Requestor_ID, { first_name: 'Wrong', Credits: null }), /Credits/);
  assert.notStrictEqual(legacyUser.first_name, 'Wrong');
  assert.strictEqual(legacy.updateRequestorById(legacyUser.Requestor_ID, { Credits: 2.3 }).Credits, 2.3);

  const request = (id, spots = 12) => ({ Requestor_ID: id, Benson: true, Arrival: '2026-12-20', Departure: '2026-12-22', Choice_Number: 1, Spots_ideal: spots, Spots_min: spots, Status: 'requested' });
  const requestors = new Map([
    [1, { Requestor_ID: 1, Credits: 1.4, years_of_service: 99, Lottery_value: 0.01 }],
    [2, { Requestor_ID: 2, Credits: 1.5, years_of_service: 1, Lottery_value: 0.99 }],
    [3, { Requestor_ID: 3, Credits: 1.5, years_of_service: 10, Lottery_value: 0.99 }],
  ]);
  let requests = [request(1), request(2)];
  await runAssignment(requests, requestors, { regenerateLotteryNumbers: false });
  assert.strictEqual(requests.find((row) => row.Status === 'granted').Requestor_ID, 2);
  requests = [request(2), request(3)];
  await runAssignment(requests, requestors, { regenerateLotteryNumbers: false });
  assert.strictEqual(requests.find((row) => row.Status === 'granted').Requestor_ID, 3, 'equal fractional credits preserve years-of-service tie-break');
  const summary = summarizeByChoice([request(1, 2), request(2, 2), request(3, 2)], 1, 2, requestors);
  assert.strictEqual(summary[0].samePriorityGroups, 1);
  assert.strictEqual(summary[0].samePrioritySpots, 2);
  assert.strictEqual(summary[0].higherPrioritySpots, 0);
  const lowerSummary = summarizeByChoice([request(1, 2), request(2, 2), request(3, 2)], 1, 1, requestors);
  assert.strictEqual(lowerSummary[0].higherPrioritySpots, 4);
  const report = requestsJoinedReport([request(1), request(2)], new Map([...requestors].filter(([id]) => id < 3)));
  assert.deepStrictEqual(report.map((row) => row.Credits), [1.5, 1.4]);

  const { apiRouter, store } = require('../src/routes/api');
  const admin = store.upsertRequestor({ Email: 'ADMIN.CREDITS@EXAMPLE.COM', Credits: 3, Admin: true });
  const volunteer = store.upsertRequestor({ Email: 'VOLUNTEER.CREDITS@EXAMPLE.COM', first_name: 'Original', Credits: 1.5 });
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'isolated-fractional-credit-test', resave: false, saveUninitialized: false }));
  app.use('/api', apiRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  try {
    async function login(account) {
      store.updateRequestorAuthFields(account.Requestor_ID, { login_code: 1234, code_generated_when: new Date().toISOString(), last_failed_login: '' });
      const response = await fetch(`${base}/check-login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: account.Email, code: 1234, agreementVersions: currentAgreementVersions() }) });
      assert.strictEqual(response.status, 200);
      return response.headers.get('set-cookie').split(';')[0];
    }
    const adminCookie = await login(admin);
    const volunteerCookie = await login(volunteer);
    const update = (credits, cookie = adminCookie, extra = {}) => fetch(`${base}/requestor/${volunteer.Requestor_ID}`, { method: 'PUT', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ Credits: credits, ...extra }) });
    for (const credits of [1.25, null, '', true, 'invalid', 'Infinity', '9007199254740992']) {
      const response = await update(credits, adminCookie, { first_name: 'Wrong' });
      assert.strictEqual(response.status, 400);
      assert.match((await response.json()).error, /Credits/);
      assert.strictEqual(store.getRequestorById(volunteer.Requestor_ID).first_name, 'Original');
      assert.strictEqual(store.getRequestorById(volunteer.Requestor_ID).Credits, 1.5);
    }
    let response = await update('2.30');
    assert.strictEqual(response.status, 200);
    assert.strictEqual((await response.json()).Credits, 2.3);
    response = await update(9.9, volunteerCookie, { first_name: 'Volunteer' });
    assert.strictEqual(response.status, 200);
    assert.strictEqual((await response.json()).Credits, 2.3);
    response = await update(undefined, adminCookie, { city: 'Test City' });
    assert.strictEqual(response.status, 200);
    assert.strictEqual((await response.json()).Credits, 2.3);
    async function upload(raw, cookie = adminCookie) {
      const form = new FormData();
      form.append('file', new Blob([raw], { type: 'text/tab-separated-values' }), 'credits.tsv');
      return fetch(`${base}/admin/upload-requestors`, { method: 'POST', headers: { Cookie: cookie }, body: form });
    }
    response = await upload(`Email\tCredits\n${volunteer.Email}\t1.4\nNEW.CREDITS@EXAMPLE.COM\t1.25\n`);
    assert.strictEqual(response.status, 400);
    assert.match((await response.json()).error, /row 3.*one decimal place/);
    assert.strictEqual(store.getRequestorById(volunteer.Requestor_ID).Credits, 2.3);
    assert.strictEqual(store.getRequestorByEmail('NEW.CREDITS@EXAMPLE.COM'), null);
    response = await upload(`Email\tCredits\n${volunteer.Email}\t\nNEW.CREDITS@EXAMPLE.COM\t1.50\n`);
    assert.strictEqual(response.status, 200);
    assert.strictEqual(store.getRequestorById(volunteer.Requestor_ID).Credits, 2.3);
    assert.strictEqual(store.getRequestorByEmail('NEW.CREDITS@EXAMPLE.COM').Credits, 1.5);
    response = await upload(`Email\tCredits\n${volunteer.Email}\t4.5\n`, volunteerCookie);
    assert.strictEqual(response.status, 403);
    response = await fetch(`${base}/admin/download/requestors`, { headers: { Cookie: adminCookie } });
    assert.strictEqual(response.status, 200);
    const exported = await response.text();
    const exportedRow = parseTsv(exported).rows.find((row) => row.Email === volunteer.Email);
    assert.strictEqual(exportedRow.Credits, '2.3');
    assert(!exported.includes('credits_tenths'));
    response = await upload(exported);
    assert.strictEqual(response.status, 200);
    assert.strictEqual(store.getRequestorById(volunteer.Requestor_ID).Credits, 2.3);
    assert.strictEqual(store.db.prepare('SELECT credits_tenths FROM requestors WHERE requestor_id = ?').get(volunteer.Requestor_ID).credits_tenths, 23);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  }
  console.log('Fractional credits test passed: exact values, atomic migration/rollback, imports/exports, authorization, and priority.');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
