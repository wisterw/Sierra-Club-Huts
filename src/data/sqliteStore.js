const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { DATABASE_FILE, DATA_DIR, HUTS, REQUESTORS_FILE, REQUESTS_FILE } = require('../config');
const { closestSaturdayWeekKey } = require('../services/dates');
const { normalizeEmail } = require('../services/auth');
const {
  parseTsv,
  REQUESTORS_HEADERS,
  REQUESTS_HEADERS,
} = require('./tsvStore');

const APP_MODES = new Set(['work-party', 'trip-request', 'inactive']);

function boolFromAny(v) {
  return v === true || String(v).toLowerCase() === 'true' || String(v) === '1';
}

function intBool(v) {
  return boolFromAny(v) ? 1 : 0;
}

function fromIntBool(v) {
  return Number(v) === 1;
}

function nowIso() {
  return new Date().toISOString();
}

function cleanStatus(status) {
  if (status === 'pending') return 'requested';
  if (status === 'confirmed') return 'granted';
  if (status === 'not-needed') return 'not-used';
  return status || 'requested';
}

function assertHeaders(actual, expected, filePath) {
  const normalized = actual.map((h, idx) => (idx === 0 ? h.replace(/^\uFEFF/, '') : h));
  const matches = normalized.length === expected.length
    && normalized.every((value, idx) => value === expected[idx]);
  if (!matches) {
    throw new Error(`Invalid header row in ${filePath}.`);
  }
}

function rowToRequestor(row) {
  if (!row) return null;
  return {
    Requestor_ID: Number(row.requestor_id),
    Email: row.email || '',
    first_name: row.first_name || '',
    last_name: row.last_name || '',
    address: row.address || '',
    city: row.city || '',
    state: row.state || '',
    zip: row.zip || '',
    Phone: row.phone || '',
    Comments: row.comments || '',
    Credits: Number(row.credits || 0),
    login_code: Number(row.login_code || 0),
    code_generated_when: row.code_generated_when || '',
    Admin: fromIntBool(row.admin),
    Creation_date: row.creation_date || '',
    Last_mod_date: row.last_mod_date || '',
    last_failed_login: row.last_failed_login || '',
    years_of_service: row.years_of_service || '',
    has_a_chainsaw: fromIntBool(row.has_a_chainsaw),
    chainsaw_user: fromIntBool(row.chainsaw_user),
    other_skills: row.other_skills || '',
    private_comments: row.private_comments || '',
    liability_waiver_date: row.liability_waiver_date || '',
  };
}

function rowToTripRequest(row) {
  if (!row) return null;
  return {
    Request_ID: Number(row.request_id),
    Requestor_ID: Number(row.requestor_id),
    Benson: fromIntBool(row.benson),
    Bradley: fromIntBool(row.bradley),
    Grubb: fromIntBool(row.grubb),
    Ludlow: fromIntBool(row.ludlow),
    Arrival: row.arrival || '',
    Departure: row.departure || '',
    Choice_Number: Number(row.choice_number || 0),
    Spots_ideal: Number(row.spots_ideal || 0),
    Spots_min: Number(row.spots_min || 0),
    Hut_granted: row.hut_granted || '',
    Spots_granted: Number(row.spots_granted || 0),
    Status: cleanStatus(row.status),
    Lottery_value: Number(row.lottery_value || 0),
    Confirmed_How: row.assignment_audit || '',
    Assignment_audit: row.assignment_audit || '',
    Creation_date: row.creation_date || '',
    Last_mod_date: row.last_mod_date || '',
    hut_count_flexibility: Number(row.hut_count_flexibility || 0),
    saturday_week_number: row.saturday_week_number || '',
    Combination_first_request: row.combination_first_request ? Number(row.combination_first_request) : null,
  };
}

function rowToWorkParty(row) {
  if (!row) return null;
  return {
    Friday_check_in: row.friday_check_in,
    Hut: row.hut,
    Sunday_check_out: row.sunday_check_out || '',
    Leader: row.leader || '',
    Leader_phone: row.leader_phone || '',
    Capacity: Number(row.capacity || 0),
    Party_comments: row.party_comments || '',
  };
}

class SqliteStore {
  constructor(options = {}) {
    this.dbPath = options.dbPath || DATABASE_FILE;
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    fs.mkdirSync(DATA_DIR, { recursive: true });
    this.db = new DatabaseSync(this.dbPath);
    this.db.exec('PRAGMA foreign_keys = ON');
    this.initSchema();
    this.seedDefaults();
    if (options.importTsv !== false) {
      this.importTsvIfEmpty({
        requestorsFile: options.requestorsFile || REQUESTORS_FILE,
        requestsFile: options.requestsFile || REQUESTS_FILE,
      });
    }
  }

  close() {
    this.db.close();
  }

  initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS requestors (
        requestor_id INTEGER PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        first_name TEXT DEFAULT '',
        last_name TEXT DEFAULT '',
        address TEXT DEFAULT '',
        city TEXT DEFAULT '',
        state TEXT DEFAULT '',
        zip TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        comments TEXT DEFAULT '',
        credits INTEGER NOT NULL DEFAULT 0,
        login_code INTEGER,
        code_generated_when TEXT,
        admin INTEGER NOT NULL DEFAULT 0,
        creation_date TEXT,
        last_mod_date TEXT,
        last_failed_login TEXT,
        years_of_service TEXT DEFAULT '',
        has_a_chainsaw INTEGER NOT NULL DEFAULT 0,
        chainsaw_user INTEGER NOT NULL DEFAULT 0,
        other_skills TEXT DEFAULT '',
        private_comments TEXT DEFAULT '',
        liability_waiver_date TEXT DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS ski_trip_requests (
        request_id INTEGER PRIMARY KEY,
        requestor_id INTEGER NOT NULL REFERENCES requestors(requestor_id) ON DELETE CASCADE,
        benson INTEGER NOT NULL DEFAULT 0,
        bradley INTEGER NOT NULL DEFAULT 0,
        grubb INTEGER NOT NULL DEFAULT 0,
        ludlow INTEGER NOT NULL DEFAULT 0,
        arrival TEXT NOT NULL,
        departure TEXT NOT NULL,
        choice_number INTEGER NOT NULL,
        spots_ideal INTEGER NOT NULL,
        spots_min INTEGER NOT NULL,
        hut_granted TEXT DEFAULT '',
        spots_granted INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'requested',
        lottery_value REAL NOT NULL DEFAULT 0,
        assignment_audit TEXT DEFAULT '',
        creation_date TEXT,
        last_mod_date TEXT,
        hut_count_flexibility INTEGER NOT NULL DEFAULT 0,
        saturday_week_number TEXT DEFAULT '',
        combination_first_request INTEGER REFERENCES ski_trip_requests(request_id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS work_parties (
        friday_check_in TEXT NOT NULL,
        hut TEXT NOT NULL,
        sunday_check_out TEXT,
        leader TEXT DEFAULT '',
        leader_phone TEXT DEFAULT '',
        capacity INTEGER NOT NULL DEFAULT 0,
        party_comments TEXT DEFAULT '',
        PRIMARY KEY (friday_check_in, hut)
      );

      CREATE TABLE IF NOT EXISTS work_party_requests (
        friday_check_in TEXT NOT NULL,
        hut TEXT NOT NULL,
        requestor_id INTEGER NOT NULL REFERENCES requestors(requestor_id) ON DELETE CASCADE,
        interest TEXT NOT NULL,
        confirmation_status TEXT DEFAULT '',
        attendance_status TEXT DEFAULT '',
        added_date TEXT,
        PRIMARY KEY (friday_check_in, hut, requestor_id),
        FOREIGN KEY (friday_check_in, hut) REFERENCES work_parties(friday_check_in, hut) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  seedDefaults() {
    const stmt = this.db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    stmt.run('application_mode', 'inactive');
  }

  importTsvIfEmpty({ requestorsFile, requestsFile }) {
    const count = this.db.prepare('SELECT COUNT(*) AS count FROM requestors').get().count;
    if (Number(count) > 0) return;
    if (!fs.existsSync(requestorsFile) || !fs.existsSync(requestsFile)) return;
    this.importTsv({ requestorsFile, requestsFile });
  }

  importTsv({ requestorsFile = REQUESTORS_FILE, requestsFile = REQUESTS_FILE } = {}) {
    const requestorsRaw = fs.readFileSync(requestorsFile, 'utf8');
    const requestsRaw = fs.readFileSync(requestsFile, 'utf8');
    const requestorsParsed = parseTsv(requestorsRaw);
    const requestsParsed = parseTsv(requestsRaw);
    assertHeaders(requestorsParsed.headers, REQUESTORS_HEADERS, requestorsFile);
    assertHeaders(requestsParsed.headers, REQUESTS_HEADERS, requestsFile);

    const insertRequestor = this.db.prepare(`
      INSERT OR REPLACE INTO requestors (
        requestor_id, email, first_name, last_name, address, city, state, zip,
        phone, comments, credits, login_code, code_generated_when, admin,
        creation_date, last_mod_date, last_failed_login, years_of_service
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertRequest = this.db.prepare(`
      INSERT INTO ski_trip_requests (
        requestor_id, benson, bradley, grubb, ludlow, arrival, departure,
        choice_number, spots_ideal, spots_min, hut_granted, spots_granted,
        status, lottery_value, assignment_audit, creation_date, last_mod_date,
        hut_count_flexibility, saturday_week_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = this.db.transaction(() => {
      for (const r of requestorsParsed.rows) {
        insertRequestor.run(
          Number(r.Requestor_ID),
          normalizeEmail(r.Email),
          r.first_name || '',
          r.last_name || '',
          r.address || '',
          r.city || '',
          r.state || '',
          r.zip || '',
          r.Phone || '',
          r.Comments || '',
          Number(r.Credits || 0),
          Number(r.login_code || 0),
          r.code_generated_when || r.Email_code_sent || '',
          intBool(r.Admin),
          r.Creation_date || '',
          r.Last_mod_date || '',
          r.last_failed_login || '',
          r.years_of_service || r['years of service'] || ''
        );
      }

      for (const r of requestsParsed.rows) {
        const hutCount = HUTS.filter((h) => boolFromAny(r[h])).length;
        insertRequest.run(
          Number(r.Requestor_ID),
          intBool(r.Benson),
          intBool(r.Bradley),
          intBool(r.Grubb),
          intBool(r.Ludlow),
          r.Arrival || '',
          r.Departure || '',
          Number(r.Choice_Number || 0),
          Number(r.Spots_ideal || 0),
          Number(r.Spots_min || r.Spots_ideal || 0),
          r.Hut_granted || '',
          Number(r.Spots_granted || 0),
          cleanStatus(r.Status),
          Number(r.Lottery_value || 0),
          r.Confirmed_How || '',
          r.Creation_date || '',
          r.Last_mod_date || '',
          Number(r.hut_count_flexibility || hutCount || 0),
          r.saturday_week_number || closestSaturdayWeekKey(r.Arrival, r.Departure)
        );
      }
    });
    tx();
  }

  listRequestors(options = {}) {
    const rows = this.db.prepare('SELECT * FROM requestors ORDER BY email').all();
    return rows.map(rowToRequestor).map((r) => this.shapeRequestor(r, options));
  }

  getRequestorById(id, options = {}) {
    const row = this.db.prepare('SELECT * FROM requestors WHERE requestor_id = ?').get(Number(id));
    return this.shapeRequestor(rowToRequestor(row), options);
  }

  getRequestorByEmail(email, options = {}) {
    const row = this.db.prepare('SELECT * FROM requestors WHERE email = ?').get(normalizeEmail(email));
    return this.shapeRequestor(rowToRequestor(row), options);
  }

  shapeRequestor(requestor, options = {}) {
    if (!requestor) return null;
    if (options.includePrivate) return requestor;
    const { private_comments: _privateComments, liability_waiver_date: _waiver, ...publicRequestor } = requestor;
    return publicRequestor;
  }

  upsertRequestor(partial = {}) {
    const now = nowIso();
    const normalizedEmail = normalizeEmail(partial.Email);
    const existing = this.getRequestorByEmail(normalizedEmail, { includePrivate: true });
    const id = existing?.Requestor_ID || this.nextRequestorId();
    const creation = existing?.Creation_date || now;
    this.db.prepare(`
      INSERT INTO requestors (
        requestor_id, email, first_name, last_name, address, city, state, zip,
        phone, comments, credits, login_code, code_generated_when, admin,
        creation_date, last_mod_date, last_failed_login, years_of_service,
        has_a_chainsaw, chainsaw_user, other_skills, private_comments, liability_waiver_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        address = excluded.address,
        city = excluded.city,
        state = excluded.state,
        zip = excluded.zip,
        phone = excluded.phone,
        comments = excluded.comments,
        credits = excluded.credits,
        login_code = excluded.login_code,
        code_generated_when = excluded.code_generated_when,
        admin = excluded.admin,
        last_mod_date = excluded.last_mod_date,
        last_failed_login = excluded.last_failed_login,
        years_of_service = excluded.years_of_service,
        has_a_chainsaw = excluded.has_a_chainsaw,
        chainsaw_user = excluded.chainsaw_user,
        other_skills = excluded.other_skills,
        private_comments = excluded.private_comments,
        liability_waiver_date = excluded.liability_waiver_date
    `).run(
      id,
      normalizedEmail,
      partial.first_name ?? existing?.first_name ?? '',
      partial.last_name ?? existing?.last_name ?? '',
      partial.address ?? existing?.address ?? '',
      partial.city ?? existing?.city ?? '',
      partial.state ?? existing?.state ?? '',
      partial.zip ?? existing?.zip ?? '',
      partial.Phone ?? partial.phone ?? existing?.Phone ?? '',
      partial.Comments ?? partial.comments ?? existing?.Comments ?? '',
      Number(partial.Credits ?? partial.credits ?? existing?.Credits ?? 0),
      Number(partial.login_code ?? existing?.login_code ?? 0),
      partial.code_generated_when ?? existing?.code_generated_when ?? '',
      intBool(partial.Admin ?? partial.admin ?? existing?.Admin ?? false),
      creation,
      now,
      partial.last_failed_login ?? existing?.last_failed_login ?? '',
      partial.years_of_service ?? existing?.years_of_service ?? '',
      intBool(partial.has_a_chainsaw ?? existing?.has_a_chainsaw ?? false),
      intBool(partial.chainsaw_user ?? existing?.chainsaw_user ?? false),
      partial.other_skills ?? existing?.other_skills ?? '',
      partial.private_comments ?? existing?.private_comments ?? '',
      partial.liability_waiver_date ?? existing?.liability_waiver_date ?? ''
    );
    return this.getRequestorByEmail(normalizedEmail, { includePrivate: true });
  }

  nextRequestorId() {
    const used = new Set(this.db.prepare('SELECT requestor_id FROM requestors').all().map((r) => Number(r.requestor_id)));
    let id = 1000 + Math.floor(Math.random() * 900000);
    while (used.has(id)) {
      id = 1000 + Math.floor(Math.random() * 900000);
    }
    return id;
  }

  updateRequestorById(id, updates = {}, options = {}) {
    const existing = this.getRequestorById(id, { includePrivate: true });
    if (!existing) return null;
    const allowed = new Set([
      'first_name', 'last_name', 'address', 'city', 'state', 'zip',
      'Phone', 'Comments', 'has_a_chainsaw', 'chainsaw_user', 'other_skills',
    ]);
    if (options.allowAdminFields) {
      ['Credits', 'Admin', 'years_of_service', 'private_comments', 'liability_waiver_date'].forEach((k) => allowed.add(k));
    }
    const next = { ...existing };
    for (const [key, value] of Object.entries(updates)) {
      if (allowed.has(key) && value !== undefined) next[key] = value;
    }
    next.Email = existing.Email;
    this.upsertRequestor(next);
    return this.getRequestorById(id, { includePrivate: options.includePrivate });
  }

  updateRequestorAuthFields(id, updates = {}) {
    const existing = this.getRequestorById(id, { includePrivate: true });
    if (!existing) return null;
    this.db.prepare(`
      UPDATE requestors
      SET login_code = COALESCE(?, login_code),
          code_generated_when = COALESCE(?, code_generated_when),
          last_failed_login = COALESCE(?, last_failed_login),
          last_mod_date = ?
      WHERE requestor_id = ?
    `).run(
      updates.login_code ?? null,
      updates.code_generated_when ?? null,
      updates.last_failed_login ?? null,
      nowIso(),
      Number(id)
    );
    return this.getRequestorById(id, { includePrivate: true });
  }

  listRequests() {
    return this.db.prepare('SELECT * FROM ski_trip_requests ORDER BY choice_number, arrival, request_id')
      .all()
      .map(rowToTripRequest);
  }

  getRequestsByRequestorId(id) {
    return this.db.prepare('SELECT * FROM ski_trip_requests WHERE requestor_id = ? ORDER BY choice_number, arrival, request_id')
      .all(Number(id))
      .map(rowToTripRequest);
  }

  replaceRequestsForRequestor(id, requests) {
    const rid = Number(id);
    const now = nowIso();
    const existing = this.getRequestsByRequestorId(rid);
    const existingById = new Map(existing.map((r) => [Number(r.Request_ID), r]));
    const orderedChoiceNumbers = [...new Set(
      requests.map((r) => Number(r.Choice_Number)).filter((n) => Number.isFinite(n))
    )].sort((a, b) => a - b);
    const choiceMap = new Map(orderedChoiceNumbers.map((n, idx) => [n, idx + 1]));
    const insert = this.db.prepare(`
      INSERT INTO ski_trip_requests (
        request_id, requestor_id, benson, bradley, grubb, ludlow, arrival, departure,
        choice_number, spots_ideal, spots_min, hut_granted, spots_granted, status,
        lottery_value, assignment_audit, creation_date, last_mod_date,
        hut_count_flexibility, saturday_week_number, combination_first_request
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM ski_trip_requests WHERE requestor_id = ?').run(rid);
      const saved = [];
      for (const input of requests) {
        const previous = input.Request_ID ? existingById.get(Number(input.Request_ID)) : null;
        const hutCount = HUTS.filter((h) => Boolean(input[h])).length;
        const normalizedChoice = choiceMap.get(Number(input.Choice_Number)) || 1;
        const requestId = input.Request_ID && previous ? Number(input.Request_ID) : null;
        const result = insert.run(
          requestId,
          rid,
          intBool(input.Benson),
          intBool(input.Bradley),
          intBool(input.Grubb),
          intBool(input.Ludlow),
          input.Arrival,
          input.Departure,
          normalizedChoice,
          Number(input.Spots_ideal),
          Number(input.Spots_min || input.Spots_ideal),
          input.Hut_granted || '',
          Number(input.Spots_granted || 0),
          cleanStatus(input.Status),
          Number(input.Lottery_value || 0),
          input.Assignment_audit || input.Confirmed_How || '',
          previous?.Creation_date || input.Creation_date || now,
          now,
          Number(input.hut_count_flexibility || hutCount || 0),
          input.saturday_week_number || closestSaturdayWeekKey(input.Arrival, input.Departure),
          input.Combination_first_request || null
        );
        saved.push({ input, requestId: requestId || Number(result.lastInsertRowid) });
      }

      const byClientGroup = new Map();
      for (const row of saved) {
        if (!row.input.Client_combo_group) continue;
        if (!byClientGroup.has(row.input.Client_combo_group)) byClientGroup.set(row.input.Client_combo_group, []);
        byClientGroup.get(row.input.Client_combo_group).push(row);
      }
      const updateCombo = this.db.prepare('UPDATE ski_trip_requests SET combination_first_request = ? WHERE request_id = ?');
      for (const groupRows of byClientGroup.values()) {
        groupRows.sort((a, b) => String(a.input.Arrival).localeCompare(String(b.input.Arrival)));
        const firstId = groupRows[0]?.requestId;
        for (const row of groupRows) {
          updateCombo.run(firstId, row.requestId);
        }
      }
    });
    tx();
  }

  saveRequests(requests) {
    const update = this.db.prepare(`
      UPDATE ski_trip_requests SET
        hut_granted = ?, spots_granted = ?, status = ?, lottery_value = ?,
        assignment_audit = ?, last_mod_date = ?, hut_count_flexibility = ?,
        saturday_week_number = ?
      WHERE request_id = ?
    `);
    const tx = this.db.transaction(() => {
      for (const req of requests) {
        update.run(
          req.Hut_granted || '',
          Number(req.Spots_granted || 0),
          cleanStatus(req.Status),
          Number(req.Lottery_value || 0),
          req.Assignment_audit || req.Confirmed_How || '',
          req.Last_mod_date || nowIso(),
          Number(req.hut_count_flexibility || HUTS.filter((h) => req[h]).length || 0),
          req.saturday_week_number || closestSaturdayWeekKey(req.Arrival, req.Departure),
          Number(req.Request_ID)
        );
      }
    });
    tx();
  }

  getApplicationMode() {
    return this.db.prepare('SELECT value FROM settings WHERE key = ?').get('application_mode')?.value || 'inactive';
  }

  setApplicationMode(mode) {
    if (!APP_MODES.has(mode)) {
      throw new Error('Invalid application mode.');
    }
    this.db.prepare(`
      INSERT INTO settings (key, value) VALUES ('application_mode', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(mode);
    return mode;
  }

  listWorkParties(year, requestorId) {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    const rows = this.db.prepare(`
      SELECT wp.*, wpr.interest, wpr.confirmation_status, wpr.attendance_status
      FROM work_parties wp
      LEFT JOIN work_party_requests wpr
        ON wpr.friday_check_in = wp.friday_check_in
       AND wpr.hut = wp.hut
       AND wpr.requestor_id = ?
      WHERE wp.friday_check_in BETWEEN ? AND ?
      ORDER BY wp.friday_check_in, wp.hut
    `).all(Number(requestorId), start, end);
    return rows.map((row) => ({
      ...rowToWorkParty(row),
      Interest: row.interest || 'no thank you',
      Confirmation_status: row.confirmation_status || '',
      Attendance_status: row.attendance_status || '',
      Availability: this.workPartyAvailability(row),
    }));
  }

  workPartyAvailability(row) {
    const count = this.db.prepare(`
      SELECT COUNT(*) AS count
      FROM work_party_requests
      WHERE friday_check_in = ? AND hut = ? AND confirmation_status = 'Confirmed'
    `).get(row.friday_check_in, row.hut).count;
    if (Number(row.capacity || 0) <= Number(count)) return 'closed';
    return 'open';
  }

  saveWorkPartyInterests(requestorId, interests = []) {
    const upsert = this.db.prepare(`
      INSERT INTO work_party_requests (
        friday_check_in, hut, requestor_id, interest, confirmation_status, attendance_status, added_date
      ) VALUES (?, ?, ?, ?, COALESCE(?, ''), COALESCE(?, ''), ?)
      ON CONFLICT(friday_check_in, hut, requestor_id) DO UPDATE SET
        interest = excluded.interest
    `);
    const del = this.db.prepare('DELETE FROM work_party_requests WHERE friday_check_in = ? AND hut = ? AND requestor_id = ?');
    const tx = this.db.transaction(() => {
      for (const row of interests) {
        const interest = row.Interest || row.interest || 'no thank you';
        if (interest === 'no thank you') {
          del.run(row.Friday_check_in || row.friday_check_in, row.Hut || row.hut, Number(requestorId));
        } else {
          upsert.run(
            row.Friday_check_in || row.friday_check_in,
            row.Hut || row.hut,
            Number(requestorId),
            interest,
            row.Confirmation_status || row.confirmation_status || '',
            row.Attendance_status || row.attendance_status || '',
            nowIso()
          );
        }
      }
    });
    tx();
  }

  upsertWorkParty(row) {
    this.db.prepare(`
      INSERT INTO work_parties (
        friday_check_in, hut, sunday_check_out, leader, leader_phone, capacity, party_comments
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(friday_check_in, hut) DO UPDATE SET
        sunday_check_out = excluded.sunday_check_out,
        leader = excluded.leader,
        leader_phone = excluded.leader_phone,
        capacity = excluded.capacity,
        party_comments = excluded.party_comments
    `).run(
      row.Friday_check_in || row.friday_check_in,
      row.Hut || row.hut,
      row.Sunday_check_out || row.sunday_check_out || '',
      row.Leader || row.leader || '',
      row.Leader_phone || row.leader_phone || '',
      Number(row.Capacity || row.capacity || 0),
      row.Party_comments || row.party_comments || ''
    );
  }

  markDirty() {}

  flush() {}
}

module.exports = {
  APP_MODES,
  SqliteStore,
  boolFromAny,
  intBool,
};
