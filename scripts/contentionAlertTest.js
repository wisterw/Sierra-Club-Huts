const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { performance } = require('perf_hooks');
const { SqliteStore } = require('../src/data/sqliteStore');
const { runContentionAlerts } = require('../src/services/contentionAlertWorker');
const { choicesFor, candidate, composeAlert, HOUR } = require('../src/services/contentionAlerts');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'huts-alerts-'));
const env = { NODE_ENV: 'test', CONTENTION_ALERTS_ENABLED: 'true', APP_PUBLIC_URL: 'https://huts.example.org', MAIL_TRANSPORT: 'console' };
const row = (spots = 2, extra = {}) => ({ Benson: true, Arrival: '2026-12-20', Departure: '2026-12-22', Choice_Number: 1, Spots_ideal: spots, Spots_min: spots, ...extra });
let serial = 0;
function fixture() {
  let time = Date.parse('2026-10-05T00:00:00Z');
  const dbPath = path.join(dir, `${serial++}.sqlite`);
  const store = new SqliteStore({ dbPath, importTsv: false, clock: () => new Date(time).toISOString() });
  store.setApplicationMode('trip-request');
  const add = (name, credits = 1.5) => store.upsertRequestor({ Email: `${name}@example.org`, Credits: credits }).Requestor_ID;
  const save = (id, rows, actorId = id) => store.replaceRequestsForRequestor(id, rows, { actorId });
  const advance = (ms) => { time += ms; };
  const sent = [];
  const transport = { sendMail: async (message) => { sent.push(message); return { accepted: [message.to] }; } };
  const run = (options = {}) => runContentionAlerts(store, { environment: env, transport, force: true, ...options });
  return { store, add, save, advance, sent, transport, run, dbPath, clock: () => new Date(time).toISOString() };
}
async function testImpacts() {
  const f = fixture();
  try {
    const groups = ['a', 'b', 'c'].map((name) => f.add(name));
    groups.forEach((id) => f.save(id, [row()]));
    const editor = f.add('editor', 2.1);
    f.store.alerts.initialize();
    f.save(editor, [row(12)]);
    assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM contention_alert_recipients WHERE pending IS NOT NULL').get().n, 3);
    f.advance(45 * 60000);
    assert.equal((await f.run()).sent, 0);
    f.advance(15 * 60000);
    const before = f.store.listRequests();
    assert.equal((await f.run()).sent, 3, 'exactly one hour is eligible');
    assert.deepEqual(f.sent.map((m) => m.to).sort(), groups.map((id) => f.store.getRequestorById(id).Email).sort());
    assert(f.sent.every((m) => m.text.includes('higher-priority') && m.text.includes('Sunday, December 20, 2026') && m.text.includes('Tuesday, December 22, 2026') && m.text.includes('Minimum people: 2')));
    for (const r of f.store.listRequests()) {
      const old = before.find((v) => v.Request_ID === r.Request_ID);
      assert.equal(r.Last_mod_date, old.Last_mod_date);
      assert.equal(r.contention_status_changed_at, old.contention_status_changed_at);
    }
    assert.equal((await f.run()).sent, 0);
    const other = new SqliteStore({ dbPath: f.dbPath, importTsv: false, clock: f.clock });
    try { assert.equal((await runContentionAlerts(other, { environment: env, transport: f.transport, force: true })).sent, 0); } finally { other.close(); }
    // Remove competition: recover silently, then impact the previous editor.
    f.save(editor, []);
    f.save(editor, [row(2)]);
    const larger = f.add('larger', 3.2);
    f.save(larger, [row(12)]);
    f.advance(HOUR);
    assert.equal((await f.run()).sent, 4, 'previous editor remains eligible for later external impact');
    // An admin is the actor, not the profile being edited.
    f.save(larger, []);
    f.store.updateRequestorById(editor, { Credits: 5.1 }, { allowAdminFields: true, actorId: larger });
    f.advance(HOUR);
    assert.equal((await f.run()).sent, 0, 'clear changes do not produce emails');
    f.save(larger, [row(12)]);
    f.store.updateRequestorById(editor, { Credits: 1.5 }, { allowAdminFields: true, actorId: larger });
    f.advance(HOUR);
    await f.run();
    assert(f.sent.at(-1).to === f.store.getRequestorById(editor).Email);
  } finally { f.store.close(); }
}
async function testProgression() {
  const f = fixture();
  try {
    const user = f.add('progress'), competitor = f.add('competitor', 2.5), equal = f.add('equal');
    f.save(user, [row(), row(2, { Choice_Number: 2, Arrival: '2026-12-23', Departure: '2026-12-25' }), row(2, { Choice_Number: 3, Arrival: '2026-12-26', Departure: '2026-12-28' })]);
    f.store.alerts.initialize();
    f.save(competitor, [row(12)]);
    f.advance(HOUR);
    assert.equal((await f.run()).sent, 1);
    assert(f.sent[0].text.includes('Choice #1') && f.sent[0].text.includes('Choice #2'));
    f.save(equal, [row(2, { Arrival: '2027-01-10', Departure: '2027-01-12' }), row(11, { Choice_Number: 2, Arrival: '2026-12-23', Departure: '2026-12-25' })]);
    f.advance(HOUR);
    assert.equal((await f.run()).sent, 1);
    assert(f.sent.at(-1).text.includes('Choice #2') && !f.sent.at(-1).text.includes('Choice #1'));
    assert(f.sent.at(-1).text.includes('same number of work-party credits'));
    // Relevant later change resets the recipient's quiet period.
    f.save(competitor, [row(12, { Departure: '2026-12-25' })]);
    f.advance(50 * 60000);
    const admin = f.add('admin', 10);
    const current = f.store.getRequestsByRequestorId(user);
    f.save(user, current.map((r) => r.Choice_Number === 3 ? { ...r, Spots_ideal: 3 } : r), admin);
    f.advance(10 * 60000);
    assert.equal((await f.run()).sent, 0);
    f.advance(50 * 60000);
    assert.equal((await f.run()).sent, 1);
  } finally { f.store.close(); }
  const g = fixture();
  try {
    const user = g.add('multi'), high = g.add('high', 5);
    g.save(user, [row(), row(2, { Choice_Number: 2, Arrival: '2026-12-23', Departure: '2026-12-25' })]);
    g.store.alerts.initialize();
    g.save(high, [row(12, { Departure: '2026-12-25' })]);
    g.advance(HOUR);
    await g.run();
    assert.equal(g.sent.length, 1);
    assert(g.sent[0].text.includes('Choice #1') && g.sent[0].text.includes('Choice #2') && g.sent[0].text.includes('Adjust your choices'));
    g.save(high, []);
    g.advance(HOUR);
    assert.equal((await g.run()).sent, 0, 'recovery produces no email');
  } finally { g.store.close(); }
}
async function testOperations() {
  const f = fixture();
  try {
    const user = f.add('ops'), high = f.add('highops', 5), unrelated = f.add('unrelated');
    f.save(user, [row()]);
    f.store.alerts.initialize();
    f.save(high, [row(12)]);
    f.advance(HOUR);
    f.save(unrelated, [row(2, { Arrival: '2027-01-10', Departure: '2027-01-12' })]);
    const state = JSON.stringify(f.store.db.prepare('SELECT * FROM contention_alert_recipients').all());
    assert.equal((await f.run({ dryRun: true })).previews.length, 1);
    assert.equal(JSON.stringify(f.store.db.prepare('SELECT * FROM contention_alert_recipients').all()), state);
    assert.equal(f.sent.length, 0);
    assert.equal((await f.run({ environment: { ...env, CONTENTION_ALERTS_ENABLED: 'false' } })).skipped, 'disabled');
    await assert.rejects(() => runContentionAlerts(f.store, { environment: { ...env, MAIL_TRANSPORT: 'console' }, force: true }), /console/);
    assert.equal(f.store.alerts.acquire('test-owner', true), true);
    assert.equal((await f.run()).skipped, 'not-due-or-leased');
    f.store.alerts.release('test-owner');
    assert.equal((await f.run({ transport: { sendMail: async () => ({ rejected: [f.store.getRequestorById(user).Email] }) } })).failed, 1);
    assert.equal(f.store.getRequestsByRequestorId(user)[0].contention_email_sent_at, null);
    assert.equal((await f.run()).sent, 1);
    f.save(high, []);
    f.save(high, [row(12)]);
    f.advance(HOUR);
    assert.equal((await f.run({ transport: { sendMail: () => new Promise(() => {}) }, timeoutMs: 5 })).ambiguous, 1);
    assert.equal((await f.run()).sent, 0);
    const ambiguous = f.store.db.prepare("SELECT * FROM contention_alert_attempts WHERE outcome = 'ambiguous'").get();
    f.store.alerts.finish(ambiguous.attempt_id, 'rejected', 'verified not sent');
    assert.equal((await f.run()).sent, 1);
    // Atomic rollback leaves no impact event.
    const before = JSON.stringify(f.store.db.prepare('SELECT * FROM contention_alert_recipients').all());
    f.store.db.exec("CREATE TRIGGER fail_alert BEFORE UPDATE ON contention_alert_recipients BEGIN SELECT RAISE(ABORT, 'impact rollback'); END;");
    assert.throws(() => f.save(high, []), /impact rollback/);
    assert.equal(JSON.stringify(f.store.db.prepare('SELECT * FROM contention_alert_recipients').all()), before);
    assert.equal(f.store.getRequestsByRequestorId(high).length, 1);
    f.store.db.exec('DROP TRIGGER fail_alert');
    f.save(high, []);
    f.save(high, [row(12)]);
    f.advance(HOUR);
    f.store.setApplicationMode('inactive');
    assert.equal((await f.run()).skipped, 'mode');
    f.store.setApplicationMode('trip-request');
    const assigned = f.store.listRequests();
    assigned.find((r) => r.Requestor_ID === user).Status = 'granted';
    f.store.saveRequests(assigned);
    assert.equal((await f.run()).sent, 0);
  } finally { f.store.close(); }
}
async function testRacesAndBootstrap() {
  const f = fixture();
  try {
    const user = f.add('race'), high = f.add('highrace', 5), higher = f.add('higher', 6);
    f.save(user, [row(), row(2, { Choice_Number: 2, Arrival: '2026-12-23', Departure: '2026-12-25' })]);
    f.save(high, [row(12)]);
    f.store.alerts.initialize();
    f.advance(HOUR);
    assert.equal((await f.run()).sent, 0, 'bootstrap does not send historical risk');
    f.save(high, []);
    f.save(high, [row(12)]);
    f.advance(HOUR);
    const result = await f.run({ transport: { sendMail: async (message) => {
      assert.equal(f.store.transactionDepth, 0);
      f.sent.push(message);
      f.save(higher, [row(12, { Arrival: '2026-12-23', Departure: '2026-12-25' })]);
      return { accepted: [message.to] };
    } } });
    assert.equal(result.sent, 1);
    f.advance(HOUR);
    assert.equal((await f.run()).sent, 1);
    assert(!f.sent.at(-1).text.includes('Choice #1') && f.sent.at(-1).text.includes('Choice #2'));
    f.save(high, []); f.save(higher, []); f.save(high, [row(12)]);
    f.advance(HOUR);
    assert.equal((await f.run({ transport: { sendMail: async (message) => {
      const rows = f.store.getRequestsByRequestorId(user);
      f.save(user, rows.filter((r) => r.Choice_Number !== 1));
      return { accepted: [message.to] };
    } } })).sent, 1);
    assert.equal(f.store.getRequestsByRequestorId(user)[0].contention_email_sent_at, f.clock(), 'surviving fallback is marked sent');
    assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM contention_alert_attempts WHERE outcome = 'accepted'").get().n, 3);
    assert.equal((await f.run()).sent, 0);
  } finally { f.store.close(); }
}
async function testScheduleFailuresAndIdentity() {
  const f = fixture();
  try {
    const groups = ['schedule1', 'schedule2', 'schedule3'].map((n) => f.add(n));
    groups.forEach((id) => f.save(id, [row()]));
    const high = f.add('schedule-high', 10);
    f.store.alerts.initialize();
    f.save(high, [row(12)]);
    f.advance(HOUR);
    assert.equal((await f.run({ force: false })).skipped, 'not-due-or-leased');
    f.advance(HOUR);
    let count = 0;
    const transport = { sendMail: async (message) => {
      count += 1;
      if (count === 1) throw Object.assign(new Error('Relay refused'), { definite: true });
      return { accepted: [message.to] };
    } };
    const result = await f.run({ force: false, transport });
    assert.equal(result.sent, 2);
    assert.equal(result.failed, 1);
    assert.equal((await f.run({ force: false })).skipped, 'not-due-or-leased');
    f.advance(10 * HOUR);
    assert.equal((await f.run({ force: false })).sent, 1, 'one overdue catch-up run');
    assert.equal((await f.run({ force: false })).skipped, 'not-due-or-leased');
    f.save(high, []); f.save(high, [row(12)]); f.advance(HOUR);
    const state = f.store.alerts.eligible()[0];
    const msg = composeAlert(f.store.getRequestorById(state.requestor_id).Email, JSON.parse(state.pending), env);
    assert(f.store.alerts.acquire('crashed-worker', true));
    const attempt = f.store.alerts.claim(state, msg);
    f.advance(6 * 60000);
    assert(f.store.alerts.acquire('replacement-worker', true));
    assert.equal(f.store.db.prepare('SELECT outcome FROM contention_alert_attempts WHERE attempt_id = ?').get(attempt).outcome, 'ambiguous');
    f.store.alerts.release('replacement-worker');
    f.store.alerts.finish(attempt, 'rejected', 'operator verified no acceptance');
    const target = state.requestor_id;
    const old = f.store.getRequestsByRequestorId(target)[0];
    const oldIdentity = f.store.db.prepare('SELECT notification_identity FROM ski_trip_requests WHERE request_id = ?').get(old.Request_ID).notification_identity;
    await f.run({ transport: { sendMail: async (message) => {
      if (message.to === f.store.getRequestorById(target).Email) {
        // A replacement has a new private identity even when the public ID
        // and client-provided creation date happen to be reused.
        f.save(target, [row(2, { Creation_date: old.Creation_date })]);
      }
      return { accepted: [message.to] };
    } } });
    const replacement = f.store.getRequestsByRequestorId(target)[0];
    const newIdentity = f.store.db.prepare('SELECT notification_identity FROM ski_trip_requests WHERE request_id = ?').get(replacement.Request_ID).notification_identity;
    assert.notEqual(newIdentity, oldIdentity);
    assert.equal(replacement.contention_email_sent_at, null);
    const outOfSeason = f.add('old-season');
    f.save(outOfSeason, [row(2, { Arrival: '2025-12-20', Departure: '2025-12-22' })]);
    assert.deepEqual(choicesFor(f.store.getRequestsByRequestorId(outOfSeason), 2026), []);
  } finally { f.store.close(); }
}
function testDetailsAndLoad() {
  const f = fixture();
  try {
    const user = f.add('combo');
    f.save(user, [row(4, { Departure: '2026-12-21', Client_combo_group: 'x' }), row(4, { Benson: false, Bradley: true, Arrival: '2026-12-21', Client_combo_group: 'x' })]);
    const choices = choicesFor(f.store.getRequestsByRequestorId(user), 2026);
    assert.equal(choices.length, 1);
    choices[0].status = 'at-risk';
    const message = composeAlert('combo@example.org', candidate(choices, []), env);
    assert(message.text.includes('Benson → Bradley') && message.text.includes('Traverse: Monday, December 21, 2026'));
    choices[0].huts = [['<unsafe>']];
    assert(composeAlert('combo@example.org', candidate(choices, []), env).html.includes('&lt;unsafe&gt;'));
    const oldTimezone = process.env.TZ;
    process.env.TZ = 'Pacific/Honolulu';
    assert(composeAlert('combo@example.org', candidate(choices, []), env).text.includes('Sunday, December 20, 2026'));
    if (oldTimezone === undefined) delete process.env.TZ; else process.env.TZ = oldTimezone;
    for (let i = 0; i < 90; i += 1) {
      const id = f.add(`load${i}`, i / 10);
      f.save(id, Array.from({ length: i < 30 ? 4 : 3 }, (_, n) => row(2, { Choice_Number: n + 1, Arrival: `2027-01-${String(10 + n * 3).padStart(2, '0')}`, Departure: `2027-01-${String(12 + n * 3).padStart(2, '0')}` })));
    }
    const start = performance.now();
    f.store.alerts.initialize();
    f.store.refreshContention();
    f.store.runTransaction(() => f.store.alerts.sync());
    console.log(`Contention alert evaluation: ${(performance.now() - start).toFixed(1)} ms for 90 requestors / 300 requests plus traverse fixture.`);
  } finally { f.store.close(); }
}
async function main() {
  await testImpacts(); await testProgression(); await testOperations(); await testRacesAndBootstrap(); await testScheduleFailuresAndIdentity(); testDetailsAndLoad();
  console.log('Contention alert tests passed: impacts, progression, quiet periods, templates, delivery, races, and persistence.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
