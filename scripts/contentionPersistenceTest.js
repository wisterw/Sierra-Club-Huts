const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { performance } = require('perf_hooks');
const express = require('express');
const session = require('express-session');

const contentionFields = ['contention_status', 'contention_status_changed_at', 'contention_email_sent_at'];
const row = (spots = 4, extras = {}) => ({ Benson: true, Arrival: '2026-12-20', Departure: '2026-12-22',
  Choice_Number: 1, Spots_ideal: spots, Spots_min: spots, Status: 'requested', ...extras });
const withoutContention = (request) => Object.fromEntries(Object.entries(request).filter(([key]) => !contentionFields.includes(key)));

async function run() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'huts-contention-'));
  // Set isolation before loading config or the router's singleton repository.
  process.env.DATABASE_FILE = path.join(dir, 'api.sqlite');
  process.env.WAIVER_STORAGE_DIR = path.join(dir, 'waivers');
  process.env.MSMTP_PATH = path.join(dir, 'no-mail-relay');
  process.env.NODE_ENV = 'test';
  const { SqliteStore } = require('../src/data/sqliteStore');
  const { currentAgreementVersions, documents } = require('../src/services/agreements');
  const { runAssignment, assignLotteryValues } = require('../src/services/assignment');
  const { toTsv, parseTsv, REQUESTORS_HEADERS, REQUESTS_HEADERS } = require('../src/data/tsvStore');
  let time = '2026-10-05T00:00:00.000Z';
  const clock = () => time;
  const store = new SqliteStore({ dbPath: path.join(dir, 'timestamps.sqlite'), importTsv: false, clock });
  try {
    const first = store.upsertRequestor({ Email: 'FIRST.CONTENTION@EXAMPLE.COM', Credits: 1.5 });
    const second = store.upsertRequestor({ Email: 'SECOND.CONTENTION@EXAMPLE.COM', Credits: 1.5 });
    store.replaceRequestsForRequestor(first.Requestor_ID, [row()]);
    const firstId = store.getRequestsByRequestorId(first.Requestor_ID)[0].Request_ID;
    const getFirst = () => store.getRequestsByRequestorId(first.Requestor_ID)[0];
    assert.deepStrictEqual(contentionFields.map((field) => getFirst()[field]), [null, null, null]);
    const originalModified = getFirst().Last_mod_date;
    time = '2026-10-05T01:00:00.000Z';
    store.replaceRequestsForRequestor(second.Requestor_ID, [row(9)]);
    const secondId = store.getRequestsByRequestorId(second.Requestor_ID)[0].Request_ID;
    assert.strictEqual(getFirst().contention_status, 'at-risk');
    assert.strictEqual(getFirst().contention_status_changed_at, time);
    assert.strictEqual(getFirst().Last_mod_date, originalModified, 'competition maintenance does not edit request modification time');
    time = '2026-10-05T02:00:00.000Z';
    const sentAt = store.recordContentionEmailSent([firstId, secondId]);
    assert.strictEqual(sentAt, time);
    assert.strictEqual(getFirst().contention_email_sent_at, time);
    assert.strictEqual(getFirst().contention_status_changed_at, '2026-10-05T01:00:00.000Z');
    assert.strictEqual(getFirst().Last_mod_date, originalModified);
    assert.throws(() => store.recordContentionEmailSent([]), /valid request IDs/);
    time = '2026-10-05T02:30:00.000Z';
    assert.throws(() => store.recordContentionEmailSent([firstId, 999999]), /missing request/);
    assert.strictEqual(getFirst().contention_email_sent_at, sentAt);
    time = '2026-10-05T03:00:00.000Z';
    assert.strictEqual(store.refreshContention().changed, 0);
    store.replaceRequestsForRequestor(first.Requestor_ID, [{ ...getFirst(), contention_status: 'losing', contention_status_changed_at: 'forged', contention_email_sent_at: 'forged' }]);
    assert.strictEqual(getFirst().contention_status, 'at-risk');
    assert.strictEqual(getFirst().contention_status_changed_at, '2026-10-05T01:00:00.000Z');
    assert.strictEqual(getFirst().contention_email_sent_at, sentAt);
    time = '2026-10-05T04:00:00.000Z';
    store.updateRequestorById(second.Requestor_ID, { Credits: 2.1 }, { allowAdminFields: true });
    assert.strictEqual(getFirst().contention_status, 'losing');
    assert.strictEqual(getFirst().contention_status_changed_at, time);
    const stableRequests = store.listRequests();
    const stableProfiles = store.listRequestors({ includePrivate: true });
    store.db.exec("CREATE TRIGGER fail_contention BEFORE UPDATE OF contention_status ON ski_trip_requests BEGIN SELECT RAISE(ABORT, 'injected contention failure'); END;");
    assert.throws(() => store.updateRequestorById(second.Requestor_ID, { Credits: 1.5, first_name: 'Wrong' }, { allowAdminFields: true }), /injected contention failure/);
    assert.deepStrictEqual(store.listRequestors({ includePrivate: true }), stableProfiles);
    assert.deepStrictEqual(store.listRequests(), stableRequests);
    assert.throws(() => store.replaceRequestsForRequestor(second.Requestor_ID, []), /injected contention failure/);
    assert.deepStrictEqual(store.listRequests(), stableRequests);
    store.db.exec('DROP TRIGGER fail_contention');
    let refreshes = 0;
    const refresh = store.refreshContentionInTransaction.bind(store);
    store.refreshContentionInTransaction = () => { refreshes += 1; return refresh(); };
    store.bulkUpsertRequestors([{ Email: second.Email, Credits: 3 }, { Email: second.Email, Credits: 2.1 }]);
    assert.strictEqual(refreshes, 1, 'bulk uploads refresh final state once');
    assert.deepStrictEqual(store.listRequests(), stableRequests, 'intermediate credit states do not create transitions');
    refreshes = 0;
    store.upsertRequestor({ Email: second.Email, Credits: 2.1, city: 'Test City' });
    assert.strictEqual(refreshes, 0, 'unchanged credits do not trigger refresh');
    time = '2026-10-05T05:00:00.000Z';
    store.replaceRequestsForRequestor(second.Requestor_ID, []);
    assert.strictEqual(getFirst().contention_status, null);
    assert.strictEqual(getFirst().contention_status_changed_at, time);
    assert.strictEqual(getFirst().contention_email_sent_at, sentAt);
    const assignmentBefore = contentionFields.map((field) => getFirst()[field]);
    const assignmentRows = store.listRequests();
    const people = new Map(store.listRequestors().map((person) => [person.Requestor_ID, person]));
    const lottery = assignLotteryValues(assignmentRows, people);
    store.saveRequestorLotteryValues(lottery.requestorUpdates);
    await runAssignment(assignmentRows, people, { regenerateLotteryNumbers: false });
    store.saveRequests(assignmentRows);
    assert.deepStrictEqual(contentionFields.map((field) => getFirst()[field]), assignmentBefore);
    store.setApplicationMode('trip-request');
    assert.deepStrictEqual(contentionFields.map((field) => getFirst()[field]), assignmentBefore);
    assert.throws(() => store.db.prepare('UPDATE ski_trip_requests SET contention_status = ? WHERE request_id = ?').run('invalid', firstId), /CHECK constraint/);
    time = '2026-10-05T05:30:00.000Z';
    const combo = [row(4, { Departure: '2026-12-21', Client_combo_group: 'traverse' }),
      row(4, { Benson: false, Bradley: true, Arrival: '2026-12-21', Client_combo_group: 'traverse' })];
    store.replaceRequestsForRequestor(first.Requestor_ID, combo);
    store.replaceRequestsForRequestor(second.Requestor_ID, [row(12, { Benson: false, Bradley: true })]);
    let linked = store.getRequestsByRequestorId(first.Requestor_ID);
    assert(linked.every((request) => request.contention_status === 'losing' && request.contention_status_changed_at === time));
    store.recordContentionEmailSent(linked.map((request) => request.Request_ID));
    const linkedBefore = store.listRequests();
    assert.throws(() => store.replaceRequestsForRequestor(first.Requestor_ID, [linked[0]]), /combination request/);
    assert.deepStrictEqual(store.listRequests(), linkedBefore);
    time = '2026-10-05T05:45:00.000Z';
    store.replaceRequestsForRequestor(first.Requestor_ID, linked.slice().reverse());
    linked = store.getRequestsByRequestorId(first.Requestor_ID);
    assert(linked.every((request) => request.contention_status_changed_at === '2026-10-05T05:30:00.000Z'
      && request.contention_email_sent_at === '2026-10-05T05:30:00.000Z'));
    store.replaceRequestsForRequestor(second.Requestor_ID, []);
    assert(store.getRequestsByRequestorId(first.Requestor_ID).every((request) => request.contention_status === null && request.contention_status_changed_at === time));
  } finally { store.close(); }

  // Additive migration, initial detection, unrelated data preservation and restart.
  const migrationPath = path.join(dir, 'migration.sqlite');
  let fixture = new SqliteStore({ dbPath: migrationPath, importTsv: false, clock });
  const migrant = fixture.upsertRequestor({ Email: 'MIGRATION.CONTENTION@EXAMPLE.COM', Credits: 1.5, private_comments: 'unchanged' });
  const competitor = fixture.upsertRequestor({ Email: 'COMPETITOR.CONTENTION@EXAMPLE.COM', Credits: 1.5 });
  fixture.replaceRequestsForRequestor(migrant.Requestor_ID, [row()]);
  fixture.replaceRequestsForRequestor(competitor.Requestor_ID, [row(9)]);
  fixture.recordAgreementAcknowledgement(migrant.Requestor_ID, documents);
  fixture.upsertWorkParty({ Friday_check_in: '2026-08-21', Sunday_check_out: '2026-08-23', Hut: 'Benson', Capacity: 8 });
  fixture.saveWorkPartyInterests(migrant.Requestor_ID, [{ Friday_check_in: '2026-08-21', Hut: 'Benson', Interest: 'please consider me' }]);
  fixture.setApplicationMode('trip-request');
  const oldRequests = fixture.listRequests().map(withoutContention);
  const tables = ['requestors', 'work_parties', 'work_party_requests', 'settings', 'agreement_documents', 'requestor_agreement_acknowledgements'];
  const snapshots = Object.fromEntries(tables.map((table) => [table, fixture.db.prepare(`SELECT * FROM ${table}`).all()]));
  for (const column of contentionFields) fixture.db.exec(`ALTER TABLE ski_trip_requests DROP COLUMN ${column}`);
  fixture.close();
  time = '2026-10-05T06:00:00.000Z';
  fixture = new SqliteStore({ dbPath: migrationPath, importTsv: false, clock });
  assert.deepStrictEqual(fixture.listRequests().map(withoutContention), oldRequests);
  for (const table of tables) assert.deepStrictEqual(fixture.db.prepare(`SELECT * FROM ${table}`).all(), snapshots[table]);
  assert(fixture.listRequests().every((request) => request.contention_status === 'at-risk' && request.contention_status_changed_at === time && request.contention_email_sent_at === null));
  const migrated = fixture.listRequests();
  fixture.close();
  time = '2026-10-05T07:00:00.000Z';
  fixture = new SqliteStore({ dbPath: migrationPath, importTsv: false, clock });
  assert.deepStrictEqual(fixture.listRequests(), migrated);
  fixture.close();

  // Startup TSV import computes statuses but does not invent send history.
  const requestorsFile = path.join(dir, 'requestors.tsv');
  const requestsFile = path.join(dir, 'requests.tsv');
  fs.writeFileSync(requestorsFile, toTsv(REQUESTORS_HEADERS, [{ Requestor_ID: 1, Email: 'TSV1@EXAMPLE.COM', Credits: 1.5 }, { Requestor_ID: 2, Email: 'TSV2@EXAMPLE.COM', Credits: 1.5 }]));
  fs.writeFileSync(requestsFile, toTsv(REQUESTS_HEADERS, [row(4, { Requestor_ID: 1 }), row(9, { Requestor_ID: 2 })].map((request) => ({ ...request, Benson: 'TRUE' }))));
  fixture = new SqliteStore({ dbPath: path.join(dir, 'import.sqlite'), requestorsFile, requestsFile, clock });
  assert(fixture.listRequests().every((request) => request.contention_status === 'at-risk' && request.contention_email_sent_at === null));
  fixture.close();

  // Representative workload: 90 requestors with 3/4 choices, exactly 300 rows.
  fixture = new SqliteStore({ dbPath: path.join(dir, 'benchmark.sqlite'), importTsv: false, clock });
  const benchmarkPeople = Array.from({ length: 90 }, (_, index) => fixture.upsertRequestor({ Email: `BENCH${index}@EXAMPLE.COM`, Credits: (index % 5) / 10 + 1 }));
  fixture.runTransaction(() => {
    for (const [index, person] of benchmarkPeople.entries()) {
      fixture.replaceRequestsForRequestor(person.Requestor_ID, Array.from({ length: index < 30 ? 4 : 3 }, (_, choice) => {
        const offset = (index * 7 + choice * 5) % 45;
        const start = new Date(Date.UTC(2026, 11, 20 + offset));
        const end = new Date(start); end.setUTCDate(end.getUTCDate() + 2);
        return row(4, { Choice_Number: choice + 1, Arrival: start.toISOString().slice(0, 10), Departure: end.toISOString().slice(0, 10), Bradley: index % 3 === 0 });
      }));
    }
  });
  assert.strictEqual(fixture.listRequests().length, 300);
  const timings = [];
  for (let iteration = 0; iteration < 10; iteration += 1) {
    const start = performance.now();
    assert.strictEqual(fixture.refreshContention().evaluated, 300);
    timings.push(performance.now() - start);
  }
  timings.sort((a, b) => a - b);
  console.log(`300-request refresh timing: median ${timings[5].toFixed(1)} ms, maximum ${timings[9].toFixed(1)} ms (90 requestors, local test machine).`);
  const updateStart = performance.now();
  fixture.upsertRequestor({ Email: benchmarkPeople[0].Email, Credits: 3 });
  console.log(`Credit update plus 300-request refresh: ${(performance.now() - updateStart).toFixed(1)} ms.`);
  fixture.close();

  // Router integration: protected fields, exports, rollback and login mail separation.
  const { apiRouter, store: apiStore } = require('../src/routes/api');
  const admin = apiStore.upsertRequestor({ Email: 'ADMIN.CONTENTION@EXAMPLE.COM', Admin: true, Credits: 1.5 });
  const volunteer = apiStore.upsertRequestor({ Email: 'VOLUNTEER.CONTENTION@EXAMPLE.COM', Credits: 1.5 });
  apiStore.replaceRequestsForRequestor(volunteer.Requestor_ID, [row()]);
  apiStore.replaceRequestsForRequestor(admin.Requestor_ID, [row(9)]);
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'isolated-contention-test', resave: false, saveUninitialized: false }));
  app.use('/api', apiRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  try {
    async function login(person) {
      apiStore.updateRequestorAuthFields(person.Requestor_ID, { login_code: 1234, code_generated_when: new Date().toISOString(), last_failed_login: '' });
      const response = await fetch(`${base}/check-login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: person.Email, code: 1234, agreementVersions: currentAgreementVersions() }) });
      assert.strictEqual(response.status, 200);
      return response.headers.get('set-cookie').split(';')[0];
    }
    const cookies = { admin: await login(admin), volunteer: await login(volunteer) };
    async function api(url, cookie = cookies.admin, body, method = body === undefined ? 'GET' : 'PUT') {
      return fetch(base + url, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    }
    let response = await api('/me', cookies.volunteer);
    const request = (await response.json()).requests[0];
    assert.strictEqual(request.contention_status, 'at-risk');
    assert.strictEqual(request.contention_email_sent_at, null);
    assert.strictEqual((await api(`/requestor/${admin.Requestor_ID}`, cookies.volunteer)).status, 403);
    assert.strictEqual((await api('/admin/download/requests-joined', cookies.volunteer)).status, 403);
    assert.strictEqual((await api(`/requestor/${admin.Requestor_ID}/requests`, cookies.volunteer, { requests: [] })).status, 403);
    apiStore.contentionClock = () => '2026-10-05T08:00:00.000Z';
    apiStore.recordContentionEmailSent(request.Request_ID);
    const tracked = apiStore.getRequestsByRequestorId(volunteer.Requestor_ID)[0];
    for (const cookie of [cookies.admin, cookies.volunteer]) {
      response = await api(`/requestor/${volunteer.Requestor_ID}/requests`, cookie, { requests: [{ ...tracked, contention_status: 'losing', contention_status_changed_at: 'forged', contention_email_sent_at: 'forged' }] });
      assert.strictEqual(response.status, 200);
      const saved = (await response.json()).requests[0];
      for (const field of contentionFields) assert.strictEqual(saved[field], tracked[field]);
    }
    const noRequest = apiStore.upsertRequestor({ Email: 'NO.REQUEST@EXAMPLE.COM' });
    response = await api('/admin/download/requests-joined');
    const exported = parseTsv(await response.text());
    for (const field of contentionFields) assert(exported.headers.includes(field));
    const exportedRequest = exported.rows.find((item) => Number(item.Request_ID) === request.Request_ID);
    assert.strictEqual(exportedRequest.contention_status, 'at-risk');
    assert.strictEqual(exportedRequest.contention_email_sent_at, '2026-10-05T08:00:00.000Z');
    const absent = exported.rows.find((item) => Number(item.Requestor_ID) === noRequest.Requestor_ID);
    for (const field of contentionFields) assert.strictEqual(absent[field], '');
    let snapshot = apiStore.listRequests();
    apiStore.db.exec("CREATE TRIGGER fail_contention BEFORE UPDATE OF contention_status ON ski_trip_requests BEGIN SELECT RAISE(ABORT, 'injected contention failure'); END;");
    response = await api(`/requestor/${admin.Requestor_ID}/requests`, cookies.admin, { requests: [] });
    assert.strictEqual(response.status, 503);
    assert.deepStrictEqual(apiStore.listRequests(), snapshot);
    response = await api(`/requestor/${admin.Requestor_ID}`, cookies.admin, { Credits: 2.1, city: 'Wrong' });
    assert.strictEqual(response.status, 503);
    assert.strictEqual(apiStore.getRequestorById(admin.Requestor_ID).Credits, 1.5);
    assert.notStrictEqual(apiStore.getRequestorById(admin.Requestor_ID).city, 'Wrong');
    const form = new FormData();
    form.append('file', new Blob([`Email\tCredits\n${admin.Email}\t2.1\nNEW.ROLLBACK@EXAMPLE.COM\t1.5\n`]), 'credits.tsv');
    response = await fetch(`${base}/admin/upload-requestors`, { method: 'POST', headers: { Cookie: cookies.admin }, body: form });
    assert.strictEqual(response.status, 400);
    assert.strictEqual(apiStore.getRequestorByEmail('NEW.ROLLBACK@EXAMPLE.COM'), null);
    assert.deepStrictEqual(apiStore.listRequests(), snapshot);
    apiStore.db.exec('DROP TRIGGER fail_contention');
    // Capture login mail without contacting a relay or changing the real service.
    const auth = require('../src/services/auth');
    snapshot = apiStore.listRequests();
    const composed = auth.composeLoginCodeEmail(volunteer.Email, 1234);
    await auth.sendLoginCodeEmail(volunteer.Email, 1234, { transport: { sendMail: async (message) => { assert.strictEqual(message.text, composed.text); return { accepted: [volunteer.Email] }; } } });
    assert.deepStrictEqual(apiStore.listRequests(), snapshot);
    await assert.rejects(() => auth.sendLoginCodeEmail(volunteer.Email, 1234, { transport: { sendMail: async () => { throw new Error('injected mail failure'); } } }), /injected mail failure/);
    assert.deepStrictEqual(apiStore.listRequests(), snapshot, 'failed mail does not record a successful contention send');
    apiStore.contentionClock = () => '2026-10-05T09:00:00.000Z';
    response = await api(`/requestor/${admin.Requestor_ID}/requests`, cookies.admin, { requests: [] });
    assert.strictEqual(response.status, 200);
    const cleared = apiStore.getRequestsByRequestorId(volunteer.Requestor_ID)[0];
    assert.strictEqual(cleared.contention_status, null);
    assert.strictEqual(cleared.contention_status_changed_at, '2026-10-05T09:00:00.000Z');
    assert.strictEqual(cleared.contention_email_sent_at, tracked.contention_email_sent_at);
    response = await api(`/requestor/${volunteer.Requestor_ID}/requests`, cookies.volunteer, { requests: [row(4, {
      contention_status: 'losing', contention_status_changed_at: 'forged', contention_email_sent_at: 'forged',
    })] });
    assert.strictEqual(response.status, 200);
    const fresh = (await response.json()).requests[0];
    for (const field of contentionFields) assert.strictEqual(fresh[field], null, 'new clear rows ignore forged contention fields');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    apiStore.close();
  }
  console.log('Contention persistence/API test passed: timestamps, atomic refresh, migration, authorization and exports.');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
