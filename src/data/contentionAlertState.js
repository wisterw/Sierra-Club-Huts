const crypto = require('crypto');
const { choicesFor, candidate, recoveredBaseline, seasonYear, HOUR, INTERVAL } = require('../services/contentionAlerts');

class ContentionAlertState {
  constructor(store) {
    this.store = store;
    this.db = store.db;
    if (!this.db.prepare('PRAGMA table_info(ski_trip_requests)').all().some((c) => c.name === 'notification_identity')) {
      this.db.exec('ALTER TABLE ski_trip_requests ADD COLUMN notification_identity TEXT');
    }
    this.db.exec('UPDATE ski_trip_requests SET notification_identity = lower(hex(randomblob(16))) WHERE notification_identity IS NULL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contention_alert_recipients (
        requestor_id INTEGER NOT NULL, season INTEGER NOT NULL,
        baseline TEXT NOT NULL, observed TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0,
        pending TEXT, changed_at TEXT, actor_id INTEGER,
        PRIMARY KEY(requestor_id, season)
      );
      CREATE TABLE IF NOT EXISTS contention_alert_attempts (
        attempt_id TEXT PRIMARY KEY, requestor_id INTEGER NOT NULL, season INTEGER NOT NULL,
        revision INTEGER NOT NULL, content TEXT NOT NULL, message TEXT NOT NULL,
        started_at TEXT NOT NULL, outcome TEXT NOT NULL, finished_at TEXT, error TEXT,
        UNIQUE(requestor_id, season, revision, attempt_id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS contention_alert_success_revision
        ON contention_alert_attempts(requestor_id, season, revision) WHERE outcome = 'accepted';
      CREATE TABLE IF NOT EXISTS contention_alert_schedule (
        singleton INTEGER PRIMARY KEY CHECK(singleton = 1), next_run_at TEXT NOT NULL,
        lease_owner TEXT, lease_until TEXT
      );
    `);
  }
  now() { return this.store.contentionTimestamp(); }
  snapshots(year) {
    const identities = new Map(this.db.prepare('SELECT request_id, notification_identity FROM ski_trip_requests').all().map((r) => [Number(r.request_id), r.notification_identity]));
    const grouped = new Map();
    for (const r of this.store.listRequests()) {
      if (!grouped.has(r.Requestor_ID)) grouped.set(r.Requestor_ID, []);
      grouped.get(r.Requestor_ID).push({ ...r, notificationIdentity: identities.get(r.Request_ID) });
    }
    return new Map(this.store.listRequestors().filter((p) => !p.Is_placeholder).map((p) => [p.Requestor_ID, choicesFor(grouped.get(p.Requestor_ID) || [], year)]));
  }
  initialize() {
    return this.store.runTransaction(() => {
      const now = this.now();
      const year = seasonYear(now);
      const insert = this.db.prepare('INSERT OR IGNORE INTO contention_alert_recipients(requestor_id, season, baseline, observed) VALUES (?, ?, ?, ?)');
      for (const [id, choices] of this.snapshots(year)) {
        const json = JSON.stringify(choices); insert.run(id, year, json, json);
      }
      this.db.prepare('INSERT OR IGNORE INTO contention_alert_schedule(singleton, next_run_at) VALUES (1, ?)').run(new Date(Date.parse(now) + INTERVAL).toISOString());
    });
  }
  sync(actorId = null, acknowledgeActor = false) {
    const year = seasonYear(this.now());
    // No automatic bootstrap during deployment or ordinary repository startup.
    if (!this.db.prepare('SELECT 1 FROM contention_alert_schedule WHERE singleton = 1').get()) return;
    this.db.exec('UPDATE ski_trip_requests SET notification_identity = lower(hex(randomblob(16))) WHERE notification_identity IS NULL');
    const states = new Map(this.db.prepare('SELECT * FROM contention_alert_recipients WHERE season = ?').all(year).map((s) => [Number(s.requestor_id), s]));
    for (const [id, current] of this.snapshots(year)) {
      const observed = JSON.stringify(current);
      const state = states.get(id);
      if (!state) {
        this.db.prepare('INSERT INTO contention_alert_recipients(requestor_id, season, baseline, observed) VALUES (?, ?, ?, ?)').run(id, year, observed, observed);
        continue;
      }
      if (observed === state.observed && !(acknowledgeActor && Number(actorId) === id)) continue;
      let baseline = recoveredBaseline(current, JSON.parse(state.baseline));
      if (Number(actorId) === id || !JSON.parse(state.observed).length) baseline = current;
      const pending = Number(actorId) === id ? null : candidate(current, baseline);
      const encoded = pending ? JSON.stringify(pending) : null;
      const changed = encoded !== state.pending;
      this.db.prepare(`UPDATE contention_alert_recipients SET baseline = ?, observed = ?, pending = ?,
        revision = revision + ?, changed_at = ?, actor_id = ? WHERE requestor_id = ? AND season = ?`)
        .run(JSON.stringify(baseline), observed, encoded, changed ? 1 : 0,
          changed ? this.now() : state.changed_at, actorId, id, year);
    }
  }
  eligible() {
    const year = seasonYear(this.now());
    if (this.store.getApplicationMode() !== 'trip-request') return [];
    const granted = new Set(this.store.listRequests().filter((r) => r.Arrival >= `${year}-12-15` && r.Arrival <= `${year + 1}-04-30` && r.Status === 'granted').map((r) => r.Requestor_ID));
    return this.db.prepare(`SELECT r.* FROM contention_alert_recipients r WHERE season = ? AND pending IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM contention_alert_attempts a WHERE a.requestor_id = r.requestor_id
        AND a.season = r.season AND a.outcome IN ('sending', 'ambiguous'))`).all(year)
      .filter((s) => { const p = this.store.getRequestorById(s.requestor_id); return p && !p.Is_placeholder; })
      .filter((s) => !granted.has(Number(s.requestor_id)) && Date.parse(this.now()) - Date.parse(s.changed_at) >= HOUR);
  }
  acquire(owner, force = false) {
    return this.store.runTransaction(() => {
      const now = this.now();
      const row = this.db.prepare('SELECT * FROM contention_alert_schedule WHERE singleton = 1').get();
      if (!row || (row.lease_until && row.lease_until > now) || (!force && row.next_run_at > now)) return false;
      this.db.prepare("UPDATE contention_alert_attempts SET outcome = 'ambiguous', error = 'Interrupted delivery; reconcile before retry' WHERE outcome = 'sending'").run();
      this.db.prepare('UPDATE contention_alert_schedule SET lease_owner = ?, lease_until = ?, next_run_at = ? WHERE singleton = 1')
        .run(owner, new Date(Date.parse(now) + 5 * 60 * 1000).toISOString(), new Date(Date.parse(now) + INTERVAL).toISOString());
      return true;
    });
  }
  renew(owner) {
    return !!this.db.prepare('UPDATE contention_alert_schedule SET lease_until = ? WHERE singleton = 1 AND lease_owner = ? AND lease_until > ?')
      .run(new Date(Date.parse(this.now()) + 5 * 60 * 1000).toISOString(), owner, this.now()).changes;
  }
  release(owner) { this.db.prepare('UPDATE contention_alert_schedule SET lease_owner = NULL, lease_until = NULL WHERE singleton = 1 AND lease_owner = ?').run(owner); }
  claim(state, message) {
    return this.store.runTransaction(() => {
      this.sync();
      const valid = this.eligible().find((s) => s.requestor_id === state.requestor_id && s.revision === state.revision);
      if (!valid) return null;
      const id = crypto.randomUUID();
      this.db.prepare(`INSERT INTO contention_alert_attempts(attempt_id, requestor_id, season, revision, content, message, started_at, outcome)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'sending')`).run(id, state.requestor_id, state.season, state.revision, state.pending, JSON.stringify(message), this.now());
      return id;
    });
  }
  finish(id, outcome, error = null) {
    return this.store.runTransaction(() => {
      const a = this.db.prepare('SELECT * FROM contention_alert_attempts WHERE attempt_id = ?').get(id);
      if (!a || !['sending', 'ambiguous'].includes(a.outcome)) throw new Error('Attempt is not awaiting a delivery outcome.');
      if (this.store.getRequestorById(a.requestor_id)?.Is_placeholder) throw new Error('Placeholder alert reconciliation is prohibited.');
      const now = this.now();
      this.db.prepare('UPDATE contention_alert_attempts SET outcome = ?, finished_at = ?, error = ? WHERE attempt_id = ?').run(outcome, now, error, id);
      if (outcome !== 'accepted') return;
      const content = JSON.parse(a.content);
      for (const c of content.choices) for (const r of c.rows) {
        this.db.prepare('UPDATE ski_trip_requests SET contention_email_sent_at = ? WHERE request_id = ? AND requestor_id = ? AND notification_identity = ?').run(now, r.id, a.requestor_id, r.identity);
      }
      const state = this.db.prepare('SELECT * FROM contention_alert_recipients WHERE requestor_id = ? AND season = ?').get(a.requestor_id, a.season);
      const current = JSON.parse(state.observed);
      const baseline = new Map(JSON.parse(state.baseline).map((c) => [c.key, c]));
      const observedByKey = new Map(current.map((c) => [c.key, c]));
      for (const c of content.choices) {
        // Preserve feedback already acknowledged by a newer self-edit.
        if (JSON.stringify(baseline.get(c.key)) !== JSON.stringify(observedByKey.get(c.key))) baseline.set(c.key, c);
      }
      const reconciled = recoveredBaseline(current, [...baseline.values()]);
      const next = state.revision === a.revision ? null : candidate(current, reconciled);
      const encoded = next ? JSON.stringify(next) : null;
      this.db.prepare('UPDATE contention_alert_recipients SET baseline = ?, pending = ?, revision = revision + ? WHERE requestor_id = ? AND season = ?')
        .run(JSON.stringify(reconciled), encoded, encoded !== state.pending && state.revision !== a.revision ? 1 : 0, a.requestor_id, a.season);
    });
  }
}
module.exports = { ContentionAlertState };
