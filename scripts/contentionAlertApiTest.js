const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'huts-alert-api-'));
  process.env.DATABASE_FILE = path.join(dir, 'api.sqlite');
  process.env.WAIVER_STORAGE_DIR = path.join(dir, 'waivers');
  process.env.NODE_ENV = 'test';
  const { SqliteStore } = require('../src/data/sqliteStore');
  const seed = new SqliteStore({ importTsv: false });
  const admin = seed.upsertRequestor({ Email: 'alertadmin@example.org', Credits: 5, Admin: true }).Requestor_ID;
  const user = seed.upsertRequestor({ Email: 'alertuser@example.org', Credits: 1.5 }).Requestor_ID;
  const competitor = seed.upsertRequestor({ Email: 'alertcompetitor@example.org', Credits: 1.5 }).Requestor_ID;
  seed.close();
  const { apiRouter, store } = require('../src/routes/api');
  store.contentionClock = () => '2026-10-05T00:00:00Z';
  store.setApplicationMode('trip-request');
  const app = express();
  app.use(express.json());
  // Test-only session injection exercises authenticated route actor plumbing.
  app.use((req, _res, next) => { req.session = { userId: Number(req.headers['x-test-user']) }; next(); });
  app.use('/api', apiRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const request = { Benson: true, Arrival: '2026-12-20', Departure: '2026-12-22', Choice_Number: 1, Spots_ideal: 2, Spots_min: 2 };
  async function save(id, requests, actor = id) {
    const response = await fetch(`${base}/requestor/${id}/requests`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-test-user': String(actor) }, body: JSON.stringify({ requests }) });
    assert.equal(response.status, 200, await response.text());
  }
  const state = (id) => store.db.prepare('SELECT * FROM contention_alert_recipients WHERE requestor_id = ?').get(id);
  try {
    await save(user, [request]);
    store.alerts.initialize();
    await save(competitor, [{ ...request, Spots_ideal: 11, Spots_min: 11 }]);
    assert.equal(state(user).actor_id, competitor);
    assert(state(user).pending, 'an impacted user is notified even while their test session is available');
    assert.equal(state(competitor).pending, null, 'editor gets app feedback');
    await save(user, store.getRequestsByRequestorId(user));
    assert.equal(state(user).pending, null, 'saving unchanged choices still acknowledges current app feedback');
    const response = await fetch(`${base}/requestor/${user}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-test-user': String(admin) }, body: JSON.stringify({ Credits: 0.5 }) });
    assert.equal(response.status, 200);
    assert.equal(state(user).actor_id, admin);
    assert.equal(JSON.parse(state(user).pending).variant, 'bumped-no-choices');
    const form = new FormData();
    form.append('file', new Blob(['Email\tCredits\nalertcompetitor@example.org\t0.1\n']), 'credits.tsv');
    const upload = await fetch(`${base}/admin/upload-requestors`, { method: 'POST', headers: { 'x-test-user': String(admin) }, body: form });
    assert.equal(upload.status, 200, await upload.text());
    assert.equal(state(competitor).actor_id, admin);
    assert(state(competitor).pending, 'uploaded credits attribute impact to the admin');
    await save(competitor, store.getRequestsByRequestorId(competitor).map((r) => ({ ...r, Spots_ideal: 10, Spots_min: 10 })));
    assert.equal(state(competitor).pending, null);
    const publicResponse = await fetch(`${base}/requestor/${competitor}/requests`, { headers: { 'x-test-user': String(competitor) } });
    assert(!(await publicResponse.text()).includes('notification_identity'));
    console.log('Contention alert API tests passed: authenticated saves, admin edits/uploads, feedback suppression and privacy.');
  } finally { await new Promise((resolve) => server.close(resolve)); store.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
