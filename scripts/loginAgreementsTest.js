const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const session = require('express-session');

async function run() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'huts-agreements-'));
  const dbPath = path.join(dir, 'huts.sqlite');
  process.env.DATABASE_FILE = dbPath;
  process.env.WAIVER_STORAGE_DIR = path.join(dir, 'waivers');
  process.env.MAIL_TRANSPORT = 'console';
  process.env.APP_PUBLIC_URL = 'https://huts.example.org';
  process.env.NODE_ENV = 'test';
  const { documents, currentAgreementVersions, loadAgreementDocuments, renderAgreementPage } = require('../src/services/agreements');
  const { LOGIN_EMAIL_NOTICE, appPublicOrigin, composeLoginCodeEmail, sendLoginCodeEmail, validateLoginEmailConfiguration } = require('../src/services/auth');
  const { SqliteStore } = require('../src/data/sqliteStore');

  // Simulate an existing database that predates the additive agreement schema.
  let fixture = new SqliteStore({ dbPath, importTsv: false });
  const volunteer = fixture.upsertRequestor({ Email: 'AGREEMENTS@EXAMPLE.COM', first_name: 'Agreement', Admin: true, Credits: 1 });
  fixture.setApplicationMode('trip-request');
  fixture.db.exec('DROP TABLE requestor_agreement_acknowledgements; DROP TABLE agreement_documents;');
  fixture.close();
  const { apiRouter, store } = require('../src/routes/api');
  const count = () => store.db.prepare('SELECT COUNT(*) AS count FROM requestor_agreement_acknowledgements').get().count;
  const resetCode = (expired = false) => store.updateRequestorAuthFields(volunteer.Requestor_ID, {
    login_code: 1234, code_generated_when: expired ? '2000-01-01T00:00:00.000Z' : new Date().toISOString(), last_failed_login: '',
  });
  resetCode();
  assert.strictEqual(count(), 0, 'migration must not fabricate agreement records');
  assert.strictEqual(store.getApplicationMode(), 'trip-request');
  assert.strictEqual(store.getRequestorById(volunteer.Requestor_ID).Email, volunteer.Email);

  for (const document of Object.values(documents)) {
    fs.writeFileSync(path.join(dir, document.kind === 'termsOfUse' ? 'TERMS OF USE.md' : 'PRIVACY POLICY.md'), '\uFEFF' + document.content.replace(/\n/g, '\r\n'));
    const html = renderAgreementPage(document);
    assert(!html.includes('/js/app.js'), 'public documents must not initialize private application code');
    assert(html.includes(document.lastUpdated));
  }
  const normalized = loadAgreementDocuments(dir);
  assert.strictEqual(normalized.termsOfUse.version, documents.termsOfUse.version, 'BOM/line-ending normalization must not change version');
  fs.appendFileSync(path.join(dir, 'TERMS OF USE.md'), '\nTest-only revision.');
  const revised = loadAgreementDocuments(dir);
  assert.notStrictEqual(revised.termsOfUse.version, documents.termsOfUse.version);
  assert.strictEqual(revised.privacyPolicy.version, documents.privacyPolicy.version);
  assert.throws(() => loadAgreementDocuments(path.join(dir, 'missing')), /Cannot load agreement document/);
  assert(!renderAgreementPage({ title: 'Test', content: 'Test\n<script>alert(1)</script>\n• <img src=x onerror=alert(1)>' }).includes('<script>'));

  const message = composeLoginCodeEmail(volunteer.Email, 1234, { NODE_ENV: 'production', APP_PUBLIC_URL: 'https://huts.example.org', LOGIN_EMAIL_FROM: 'COORDINATOR@EXAMPLE.COM', HOST: 'attacker.example' });
  const expectedEmailNotice = 'By using this code to log into the web app, you agree to our Terms of Use and Privacy Policy. Because these requests are for backcountry ski huts, logging in constitutes your explicit acceptance of the inherent risks of backcountry travel (such as avalanche, hypothermia, and lack of emergency services) and our volunteer limitation of liability.';
  assert.strictEqual(LOGIN_EMAIL_NOTICE, expectedEmailNotice);
  assert.strictEqual(message.subject, 'Sierra Club Huts login code');
  assert(message.text.includes('Your login code is 1234. It expires in 10 minutes.'));
  assert(message.text.includes(expectedEmailNotice));
  assert(message.text.includes('Terms of Use: https://huts.example.org/terms-of-use'));
  assert(message.text.includes('Privacy Policy: https://huts.example.org/privacy-policy'));
  assert(!message.text.includes('attacker.example'));
  assert.strictEqual(message.from, 'noreply@tahoe-ski-huts.rsvp');
  assert.throws(() => appPublicOrigin({ NODE_ENV: 'production' }), /APP_PUBLIC_URL/);
  for (const origin of ['http://example.org', 'https://example.org/subpath', 'https://user:pass@example.org', 'https://example.org/?query=1', 'https://example.org/#fragment']) {
    assert.throws(() => appPublicOrigin({ NODE_ENV: 'production', APP_PUBLIC_URL: origin }), /APP_PUBLIC_URL/);
  }
  assert.strictEqual(appPublicOrigin({ PORT: 3333 }), 'http://localhost:3333');
  assert.throws(() => validateLoginEmailConfiguration({ NODE_ENV: 'production' }), /APP_PUBLIC_URL/);
  let captured;
  await sendLoginCodeEmail(volunteer.Email, 1234, { transport: { sendMail: async (mail) => { captured = mail; return { accepted: [volunteer.Email] }; } } });
  assert.strictEqual(captured.text, composeLoginCodeEmail(volunteer.Email, 1234).text);
  assert.strictEqual(count(), 0, 'composing/sending an email is not acknowledgement');

  const app = express();
  app.use(express.json());
  const sessions = new session.MemoryStore();
  const originalSet = sessions.set.bind(sessions);
  let failSessionSave = false;
  sessions.set = (id, value, callback) => failSessionSave ? callback(new Error('Injected session storage failure')) : originalSet(id, value, callback);
  app.use(session({ store: sessions, secret: 'isolated-agreement-tests', resave: false, saveUninitialized: false }));
  app.use('/api', apiRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const login = (payload) => fetch(`${base}/check-login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const valid = { email: volunteer.Email, code: 1234, agreementVersions: currentAgreementVersions() };
  try {
    const metadata = await fetch(`${base}/agreements`, { headers: { Host: 'attacker.example' } });
    assert.strictEqual(metadata.status, 200);
    assert.strictEqual(metadata.headers.get('cache-control'), 'no-store');
    assert.strictEqual((await metadata.json()).termsOfUse.path, '/terms-of-use');
    for (const agreementVersions of [undefined, {}, { termsOfUse: 'invalid', privacyPolicy: 'invalid' }]) {
      assert.strictEqual((await login({ ...valid, agreementVersions })).status, 400);
      assert.strictEqual(count(), 0);
    }
    assert.strictEqual((await login({ ...valid, agreementVersions: { ...valid.agreementVersions, termsOfUse: '0'.repeat(64) } })).status, 409);
    assert.strictEqual(count(), 0);
    assert.strictEqual((await login({ ...valid, code: 9999 })).status, 401);
    assert.strictEqual(count(), 0);
    resetCode(true);
    assert.strictEqual((await login(valid)).status, 401);
    assert.strictEqual(count(), 0);
    resetCode();
    store.db.exec(`CREATE TRIGGER fail_ack BEFORE INSERT ON requestor_agreement_acknowledgements BEGIN SELECT RAISE(ABORT, 'Injected persistence failure'); END;`);
    const failed = await login(valid);
    assert.strictEqual(failed.status, 503);
    assert.strictEqual(failed.headers.get('set-cookie'), null);
    assert.strictEqual(count(), 0);
    assert.strictEqual(store.db.prepare('SELECT COUNT(*) AS count FROM agreement_documents').get().count, 0, 'failure must roll back snapshots too');
    store.db.exec('DROP TRIGGER fail_ack');

    failSessionSave = true;
    const sessionFailed = await login(valid);
    assert.strictEqual(sessionFailed.status, 503);
    const invalidCookie = (sessionFailed.headers.get('set-cookie') || '').split(';')[0];
    assert.strictEqual((await fetch(`${base}/me`, { headers: { Cookie: invalidCookie } })).status, 401);
    failSessionSave = false;
    const success = await login(valid);
    assert.strictEqual(success.status, 200);
    const cookie = success.headers.get('set-cookie').split(';')[0];
    const profile = await (await fetch(`${base}/me`, { headers: { Cookie: cookie } })).json();
    assert.strictEqual(profile.Requestor_ID, volunteer.Requestor_ID);
    assert(!JSON.stringify(profile).includes('terms_version'));
    assert(!JSON.stringify(profile).includes(valid.agreementVersions.termsOfUse));
    const exported = await (await fetch(`${base}/admin/download/requestors`, { headers: { Cookie: cookie } })).text();
    assert(!exported.includes('acknowledged_at'));
    assert(!exported.includes(valid.agreementVersions.termsOfUse));
    const first = store.db.prepare('SELECT acknowledged_at FROM requestor_agreement_acknowledgements').get().acknowledged_at;
    assert(!Number.isNaN(Date.parse(first)));
    assert.strictEqual((await login(valid)).status, 200);
    assert.strictEqual(count(), 1);
    assert.strictEqual(store.db.prepare('SELECT acknowledged_at FROM requestor_agreement_acknowledgements').get().acknowledged_at, first);
    store.recordAgreementAcknowledgement(volunteer.Requestor_ID, revised);
    assert.strictEqual(count(), 2);
    assert.strictEqual(store.db.prepare('SELECT COUNT(*) AS count FROM agreement_documents').get().count, 3);
    const reopened = new SqliteStore({ dbPath, importTsv: false });
    assert.strictEqual(reopened.db.prepare('SELECT COUNT(*) AS count FROM requestor_agreement_acknowledgements').get().count, 2);
    assert.strictEqual(reopened.db.prepare('SELECT content FROM agreement_documents WHERE version = ?').get(documents.termsOfUse.version).content, documents.termsOfUse.content);
    reopened.close();
    store.db.prepare('DELETE FROM requestors WHERE requestor_id = ?').run(volunteer.Requestor_ID);
    assert.strictEqual(count(), 0, 'requestor deletion must cascade acknowledgements');
    assert.strictEqual(store.db.prepare('SELECT COUNT(*) AS count FROM agreement_documents').get().count, 3);
    console.log('Login agreement API/store/email tests passed. No messages sent to real volunteers.');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
