const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const { DATABASE_FILE, DATA_DIR, HUTS, REQUESTORS_FILE, REQUESTS_FILE, WAIVER_STORAGE_DIR } = require('../config');
const { closestSaturdayWeekKey } = require('../services/dates');
const { normalizeEmail } = require('../services/auth');
const {
  parseTsv,
  REQUESTORS_HEADERS,
  REQUESTS_HEADERS,
} = require('./tsvStore');

const APP_MODES = new Set(['work-party', 'trip-request', 'inactive']);
const WORK_PARTY_ACCEPTED_STATUSES = new Set(['', 'pending', 'accepted', 'waitlisted']);
const WORK_PARTY_ATTENDANCE_STATUSES = new Set(['', 'full attended', 'partial attended', 'no show', 'cancelled']);
const WORK_PARTY_AVAILABILITIES = new Set(['open', 'waitlist-only', 'closed']);
const RESERVATION_STATUS_FILTERS = new Set([
  'all',
  'none-submitted',
  'submitted',
  'none-granted',
  'granted',
]);
const WAIVER_STATUS_FILTERS = new Set(['all', 'approved', 'not-approved']);
const SUPPORTED_WAIVER_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png']);

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

function cleanWorkPartyAcceptedStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'accepted' || normalized === 'confirmed') return 'accepted';
  if (normalized === 'waitlist' || normalized === 'waitlisted') return 'waitlisted';
  if (normalized === 'pending' || normalized === 'requested') return 'pending';
  if (!WORK_PARTY_ACCEPTED_STATUSES.has(normalized)) {
    throw new Error('Invalid work-party accepted status.');
  }
  return normalized;
}

function cleanWorkPartyAttendanceStatus(status) {
  const normalized = String(status || '').trim().toLowerCase().replace(/-/g, ' ');
  if (!normalized) return '';
  if (!WORK_PARTY_ATTENDANCE_STATUSES.has(normalized)) {
    throw new Error('Invalid work-party attendance status.');
  }
  return normalized;
}

function cleanWorkPartyAvailability(status) {
  const normalized = String(status || 'open').trim().toLowerCase();
  const value = normalized === 'waitlist only' ? 'waitlist-only' : normalized;
  if (!WORK_PARTY_AVAILABILITIES.has(value)) {
    throw new Error('Invalid work-party availability.');
  }
  return value;
}

function cleanWorkPartyDate(value, label) {
  const cleaned = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    throw new Error(`${label} is required in YYYY-MM-DD format.`);
  }
  return cleaned;
}

function cleanWorkPartyHut(value) {
  const hut = String(value || '').trim();
  if (!HUTS.includes(hut)) {
    throw new Error('A valid hut is required.');
  }
  return hut;
}

function cleanWorkPartyCapacity(value) {
  const capacity = Number(value);
  if (!Number.isInteger(capacity) || capacity < 0) {
    throw new Error('Capacity must be a non-negative whole number.');
  }
  return capacity;
}

function workPartyKey(fridayCheckIn, hut) {
  return `${fridayCheckIn || ''}|${hut || ''}`;
}

function parseWorkPartyKey(key) {
  const [friday_check_in, hut, extra] = String(key || '').split('|');
  if (!friday_check_in || !hut || extra !== undefined) {
    throw new Error('A specific work party is required.');
  }
  return { friday_check_in, hut };
}

function dateYear(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.getUTCFullYear();
}

function isWaiverApprovedForYear(value, year) {
  return dateYear(value) === Number(year);
}

function safeWaiverExtension(name = '', mimeType = '') {
  const ext = path.extname(String(name || '')).toLowerCase();
  if (SUPPORTED_WAIVER_EXTENSIONS.has(ext)) return ext;
  if (mimeType === 'application/pdf') return '.pdf';
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/png') return '.png';
  throw new Error('Unsupported waiver file type.');
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
  const lotteryValue = row.lottery_value === null || row.lottery_value === undefined || row.lottery_value === ''
    ? null
    : Number(row.lottery_value);
  const requestor = {
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
    Lottery_value: lotteryValue,
    has_a_chainsaw: fromIntBool(row.has_a_chainsaw),
    chainsaw_user: fromIntBool(row.chainsaw_user),
    other_skills: row.other_skills || '',
    private_comments: row.private_comments || '',
    liability_waiver_date: row.liability_waiver_date || '',
    liability_waiver_file: row.liability_waiver_file || '',
    liability_waiver_submitted_at: row.liability_waiver_submitted_at || '',
  };
  return {
    ...requestor,
    requestor_id: requestor.Requestor_ID,
    email: requestor.Email,
    phone: requestor.Phone,
    comments: requestor.Comments,
    credits: requestor.Credits,
    login_code: requestor.login_code,
    code_generated_when: requestor.code_generated_when,
    admin: requestor.Admin,
    creation_date: requestor.Creation_date,
    last_mod_date: requestor.Last_mod_date,
    last_failed_login: requestor.last_failed_login,
    years_of_service: requestor.years_of_service,
    Lottery_value: requestor.Lottery_value,
    lottery_value: requestor.Lottery_value,
    has_a_chainsaw: requestor.has_a_chainsaw,
    chainsaw_user: requestor.chainsaw_user,
    other_skills: requestor.other_skills,
    private_comments: requestor.private_comments,
    liability_waiver_date: requestor.liability_waiver_date,
    liability_waiver_file: requestor.liability_waiver_file,
    liability_waiver_submitted_at: requestor.liability_waiver_submitted_at,
  };
}

function rowToTripRequest(row) {
  if (!row) return null;
  const request = {
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
  return {
    ...request,
    request_id: request.Request_ID,
    requestor_id: request.Requestor_ID,
    benson: request.Benson,
    bradley: request.Bradley,
    grubb: request.Grubb,
    ludlow: request.Ludlow,
    arrival: request.Arrival,
    departure: request.Departure,
    choice_number: request.Choice_Number,
    spots_ideal: request.Spots_ideal,
    spots_min: request.Spots_min,
    hut_granted: request.Hut_granted,
    spots_granted: request.Spots_granted,
    status: request.Status,
    lottery_value: request.Lottery_value,
    assignment_audit: request.Assignment_audit,
    creation_date: request.Creation_date,
    last_mod_date: request.Last_mod_date,
    hut_count_flexibility: request.hut_count_flexibility,
    saturday_week_number: request.saturday_week_number,
    combination_first_request: request.Combination_first_request,
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
    Leader_contact: row.leader_phone || '',
    Capacity: Number(row.capacity || 0),
    Party_comments: row.party_comments || '',
    Availability: row.availability || 'open',
  };
}

class SqliteStore {
  constructor(options = {}) {
    this.dbPath = options.dbPath || DATABASE_FILE;
    this.waiverStorageDir = options.waiverStorageDir || WAIVER_STORAGE_DIR;
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    fs.mkdirSync(DATA_DIR, { recursive: true });
    this.initWaiverStorageDir();
    this.db = new DatabaseSync(this.dbPath);
    this.db.exec('PRAGMA foreign_keys = ON');
    this.initSchema();
    this.ensureRequestorLotteryColumn();
    this.ensureRequestorWaiverColumns();
    this.ensureWorkPartyAvailabilityColumn();
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
        lottery_value REAL,
        has_a_chainsaw INTEGER NOT NULL DEFAULT 0,
        chainsaw_user INTEGER NOT NULL DEFAULT 0,
        other_skills TEXT DEFAULT '',
        private_comments TEXT DEFAULT '',
        liability_waiver_date TEXT DEFAULT '',
        liability_waiver_file TEXT DEFAULT '',
        liability_waiver_submitted_at TEXT DEFAULT ''
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
        availability TEXT NOT NULL DEFAULT 'open',
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

  ensureRequestorLotteryColumn() {
    const columns = this.db.prepare('PRAGMA table_info(requestors)').all().map((row) => row.name);
    if (!columns.includes('lottery_value')) {
      this.db.exec('ALTER TABLE requestors ADD COLUMN lottery_value REAL');
    }
  }

  ensureRequestorWaiverColumns() {
    const columns = this.db.prepare('PRAGMA table_info(requestors)').all().map((row) => row.name);
    if (!columns.includes('liability_waiver_file')) {
      this.db.exec("ALTER TABLE requestors ADD COLUMN liability_waiver_file TEXT DEFAULT ''");
    }
    if (!columns.includes('liability_waiver_submitted_at')) {
      this.db.exec("ALTER TABLE requestors ADD COLUMN liability_waiver_submitted_at TEXT DEFAULT ''");
    }
  }

  initWaiverStorageDir() {
    fs.mkdirSync(this.waiverStorageDir, { recursive: true });
  }

  ensureWorkPartyAvailabilityColumn() {
    const columns = this.db.prepare('PRAGMA table_info(work_parties)').all().map((row) => row.name);
    if (!columns.includes('availability')) {
      this.db.exec("ALTER TABLE work_parties ADD COLUMN availability TEXT NOT NULL DEFAULT 'open'");
    }
  }

  seedDefaults() {
    const stmt = this.db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    stmt.run('application_mode', 'inactive');
  }

  runTransaction(fn) {
    this.db.exec('BEGIN');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
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
        creation_date, last_mod_date, last_failed_login, years_of_service, lottery_value
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertRequest = this.db.prepare(`
      INSERT INTO ski_trip_requests (
        requestor_id, benson, bradley, grubb, ludlow, arrival, departure,
        choice_number, spots_ideal, spots_min, hut_granted, spots_granted,
        status, lottery_value, assignment_audit, creation_date, last_mod_date,
        hut_count_flexibility, saturday_week_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.runTransaction(() => {
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
          r.years_of_service || r['years of service'] || '',
          r.lottery_value ?? r.Lottery_value ?? null
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
    const {
      private_comments: _privateComments,
      liability_waiver_date: _waiver,
      liability_waiver_file: _waiverFile,
      liability_waiver_submitted_at: _waiverSubmittedAt,
      ...publicRequestor
    } = requestor;
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
        lottery_value, has_a_chainsaw, chainsaw_user, other_skills, private_comments, liability_waiver_date,
        liability_waiver_file, liability_waiver_submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        lottery_value = excluded.lottery_value,
        has_a_chainsaw = excluded.has_a_chainsaw,
        chainsaw_user = excluded.chainsaw_user,
        other_skills = excluded.other_skills,
        private_comments = excluded.private_comments,
        liability_waiver_date = excluded.liability_waiver_date,
        liability_waiver_file = excluded.liability_waiver_file,
        liability_waiver_submitted_at = excluded.liability_waiver_submitted_at
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
      partial.lottery_value ?? partial.Lottery_value ?? existing?.Lottery_value ?? null,
      intBool(partial.has_a_chainsaw ?? existing?.has_a_chainsaw ?? false),
      intBool(partial.chainsaw_user ?? existing?.chainsaw_user ?? false),
      partial.other_skills ?? existing?.other_skills ?? '',
      partial.private_comments ?? existing?.private_comments ?? '',
      partial.liability_waiver_date ?? existing?.liability_waiver_date ?? '',
      partial.liability_waiver_file ?? existing?.liability_waiver_file ?? '',
      partial.liability_waiver_submitted_at ?? existing?.liability_waiver_submitted_at ?? ''
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
      [
        'Credits',
        'Admin',
        'years_of_service',
        'private_comments',
        'liability_waiver_date',
        'liability_waiver_file',
        'liability_waiver_submitted_at',
      ].forEach((k) => allowed.add(k));
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

  saveRequestorLotteryValues(requestors = []) {
    const update = this.db.prepare(`
      UPDATE requestors
      SET lottery_value = ?, last_mod_date = ?
      WHERE requestor_id = ?
    `);
    this.runTransaction(() => {
      for (const requestor of requestors) {
        update.run(
          requestor.Lottery_value === null || requestor.Lottery_value === undefined || requestor.Lottery_value === ''
            ? null
            : Number(requestor.Lottery_value),
          nowIso(),
          Number(requestor.Requestor_ID)
        );
      }
    });
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
    this.runTransaction(() => {
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
          Number(hutCount || 0),
          closestSaturdayWeekKey(input.Arrival, input.Departure),
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
  }

  saveRequests(requests) {
    const update = this.db.prepare(`
      UPDATE ski_trip_requests SET
        hut_granted = ?, spots_granted = ?, status = ?, lottery_value = ?,
        assignment_audit = ?, last_mod_date = ?, hut_count_flexibility = ?,
        saturday_week_number = ?
      WHERE request_id = ?
    `);
    this.runTransaction(() => {
      for (const req of requests) {
        update.run(
          req.Hut_granted || '',
          Number(req.Spots_granted || 0),
          cleanStatus(req.Status),
          Number(req.Lottery_value || 0),
          req.Assignment_audit || req.Confirmed_How || '',
          req.Last_mod_date || nowIso(),
          Number(HUTS.filter((h) => req[h]).length || 0),
          closestSaturdayWeekKey(req.Arrival, req.Departure),
          Number(req.Request_ID)
        );
      }
    });
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
      Confirmation_status: cleanWorkPartyAcceptedStatus(row.confirmation_status),
      Attendance_status: cleanWorkPartyAttendanceStatus(row.attendance_status),
      Availability: row.availability || 'open',
    }));
  }

  maybePromoteWorkPartyToWaitlistOnly(fridayCheckIn, hut) {
    const row = this.db.prepare(`
      SELECT capacity, availability
      FROM work_parties
      WHERE friday_check_in = ? AND hut = ?
    `).get(fridayCheckIn, hut);
    if (!row || row.availability !== 'open') return;

    const count = this.db.prepare(`
      SELECT COUNT(*) AS count
      FROM work_party_requests
      WHERE friday_check_in = ?
        AND hut = ?
        AND lower(confirmation_status) IN ('pending', 'accepted', 'confirmed', 'waitlisted', 'waitlist')
    `).get(fridayCheckIn, hut).count;
    if (Number(count) > Number(row.capacity || 0)) {
      this.db.prepare(`
        UPDATE work_parties
        SET availability = 'waitlist-only'
        WHERE friday_check_in = ? AND hut = ? AND availability = 'open'
      `).run(fridayCheckIn, hut);
    }
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
    this.runTransaction(() => {
      for (const row of interests) {
        const fridayCheckIn = row.Friday_check_in || row.friday_check_in;
        const hut = row.Hut || row.hut;
        const interest = row.Interest || row.interest || 'no thank you';
        if (interest === 'no thank you') {
          del.run(fridayCheckIn, hut, Number(requestorId));
        } else {
          upsert.run(
            fridayCheckIn,
            hut,
            Number(requestorId),
            interest,
            cleanWorkPartyAcceptedStatus(row.Confirmation_status || row.confirmation_status || 'pending'),
            cleanWorkPartyAttendanceStatus(row.Attendance_status || row.attendance_status || ''),
            nowIso()
          );
          this.maybePromoteWorkPartyToWaitlistOnly(fridayCheckIn, hut);
        }
      }
    });
  }

  listWorkPartyFilterOptions(year = new Date().getFullYear()) {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    return this.db.prepare(`
      SELECT friday_check_in, hut, leader
      FROM work_parties
      WHERE friday_check_in BETWEEN ? AND ?
      ORDER BY friday_check_in, hut
    `).all(start, end).map((row) => ({
      key: workPartyKey(row.friday_check_in, row.hut),
      Friday_check_in: row.friday_check_in,
      Hut: row.hut,
      Leader: row.leader || '',
      label: `${row.friday_check_in} ${row.hut}${row.leader ? ` - ${row.leader}` : ''}`,
    }));
  }

  getWorkPartyRequestRows(year = new Date().getFullYear()) {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    return this.db.prepare(`
      SELECT
        wpr.friday_check_in,
        wpr.hut,
        wpr.requestor_id,
        wpr.interest,
        wpr.confirmation_status,
        wpr.attendance_status,
        wpr.added_date,
        wp.leader
      FROM work_party_requests wpr
      LEFT JOIN work_parties wp
        ON wp.friday_check_in = wpr.friday_check_in
       AND wp.hut = wpr.hut
      WHERE wpr.friday_check_in BETWEEN ? AND ?
      ORDER BY wpr.friday_check_in, wpr.hut, wpr.added_date
    `).all(start, end).map((row) => ({
      Friday_check_in: row.friday_check_in,
      Hut: row.hut,
      Requestor_ID: Number(row.requestor_id),
      Interest: row.interest || '',
      Accepted_status: cleanWorkPartyAcceptedStatus(row.confirmation_status),
      Attendance_status: cleanWorkPartyAttendanceStatus(row.attendance_status),
      Added_date: row.added_date || '',
      Leader: row.leader || '',
      key: workPartyKey(row.friday_check_in, row.hut),
    }));
  }

  listVolunteerManagementRows(filters = {}) {
    const year = Number(filters.year || new Date().getFullYear());
    const workParty = filters.workPartyKey && filters.workPartyKey !== 'all'
      ? parseWorkPartyKey(filters.workPartyKey)
      : null;
    const acceptedStatus = filters.acceptedStatus && filters.acceptedStatus !== 'all'
      ? cleanWorkPartyAcceptedStatus(filters.acceptedStatus)
      : 'all';
    const reservationStatus = RESERVATION_STATUS_FILTERS.has(String(filters.reservationStatus || 'all'))
      ? String(filters.reservationStatus || 'all')
      : 'all';
    const waiverStatus = WAIVER_STATUS_FILTERS.has(String(filters.waiverStatus || 'all'))
      ? String(filters.waiverStatus || 'all')
      : 'all';

    const requestors = this.listRequestors({ includePrivate: true });
    const workPartyRows = this.getWorkPartyRequestRows(year);
    const workPartyRowsByRequestor = new Map();
    for (const row of workPartyRows) {
      if (!workPartyRowsByRequestor.has(row.Requestor_ID)) workPartyRowsByRequestor.set(row.Requestor_ID, []);
      workPartyRowsByRequestor.get(row.Requestor_ID).push(row);
    }

    const seasonStart = `${year}-12-15`;
    const seasonEnd = `${year + 1}-04-30`;
    const seasonRequests = this.listRequests().filter((request) => (
      request.Arrival >= seasonStart && request.Arrival <= seasonEnd
    ));
    const requestsByRequestor = new Map();
    for (const request of seasonRequests) {
      if (!requestsByRequestor.has(request.Requestor_ID)) requestsByRequestor.set(request.Requestor_ID, []);
      requestsByRequestor.get(request.Requestor_ID).push(request);
    }

    return requestors.map((requestor) => {
      const workParties = workPartyRowsByRequestor.get(requestor.Requestor_ID) || [];
      const selectedWorkParty = workParty
        ? workParties.find((row) => row.Friday_check_in === workParty.friday_check_in && row.Hut === workParty.hut)
        : null;
      const requests = requestsByRequestor.get(requestor.Requestor_ID) || [];
      const hasRequests = requests.length > 0;
      const hasGranted = requests.some((request) => ['granted', 'confirmed'].includes(request.Status));
      const waiverApproved = isWaiverApprovedForYear(requestor.liability_waiver_date, year);
      return {
        Requestor_ID: requestor.Requestor_ID,
        Email: requestor.Email,
        first_name: requestor.first_name,
        last_name: requestor.last_name,
        Name: [requestor.first_name, requestor.last_name].filter(Boolean).join(' ').trim() || requestor.Email,
        Phone: requestor.Phone,
        city: requestor.city,
        years_of_service: requestor.years_of_service,
        has_a_chainsaw: requestor.has_a_chainsaw,
        chainsaw_user: requestor.chainsaw_user,
        private_comments: requestor.private_comments,
        liability_waiver_date: requestor.liability_waiver_date,
        waiver_approved_for_year: waiverApproved,
        waiver_status: waiverApproved ? 'approved' : 'not approved',
        hut_trip_request_count: requests.length,
        reservation_status: hasGranted
          ? 'granted'
          : hasRequests
            ? 'submitted'
            : 'none-submitted',
        work_parties: workParties,
        work_parties_applied_for: workParties.map((row) => {
          const statusParts = [row.Accepted_status, row.Attendance_status].filter(Boolean);
          return `${row.Hut} ${row.Friday_check_in}${statusParts.length ? ` (${statusParts.join(', ')})` : ''}`;
        }).join(', '),
        selected_work_party: selectedWorkParty || null,
        selected_work_party_status: selectedWorkParty?.Accepted_status || '',
        selected_work_party_attendance: selectedWorkParty?.Attendance_status || '',
      };
    }).filter((row) => {
      if (workParty && !row.selected_work_party) return false;
      if (acceptedStatus !== 'all') {
        const statusMatches = workParty
          ? row.selected_work_party_status === acceptedStatus
          : row.work_parties.some((party) => party.Accepted_status === acceptedStatus);
        if (!statusMatches) return false;
      }
      if (reservationStatus === 'none-submitted' && row.hut_trip_request_count !== 0) return false;
      if (reservationStatus === 'submitted' && row.hut_trip_request_count === 0) return false;
      if (reservationStatus === 'none-granted' && (row.hut_trip_request_count === 0 || row.reservation_status === 'granted')) return false;
      if (reservationStatus === 'granted' && row.reservation_status !== 'granted') return false;
      if (waiverStatus === 'approved' && !row.waiver_approved_for_year) return false;
      if (waiverStatus === 'not-approved' && row.waiver_approved_for_year) return false;
      return true;
    });
  }

  volunteerManagementPayload(filters = {}) {
    const year = Number(filters.year || new Date().getFullYear());
    return {
      filters: {
        year,
        workParties: this.listWorkPartyFilterOptions(year),
        acceptedStatuses: ['', 'pending', 'accepted', 'waitlisted'],
        attendanceStatuses: ['', 'full attended', 'partial attended', 'no show', 'cancelled'],
        reservationStatuses: ['all', 'none-submitted', 'submitted', 'none-granted', 'granted'],
        waiverStatuses: ['all', 'approved', 'not-approved'],
      },
      rows: this.listVolunteerManagementRows({ ...filters, year }),
    };
  }

  saveLiabilityWaiverFile(requestorId, file) {
    const requestor = this.getRequestorById(requestorId, { includePrivate: true });
    if (!requestor) return null;
    if (!file?.buffer?.length) {
      throw new Error('Missing waiver file upload.');
    }
    const ext = safeWaiverExtension(file.originalname, file.mimetype);
    const filename = [
      Number(requestorId),
      Date.now(),
      crypto.randomBytes(8).toString('hex'),
    ].join('-') + ext;
    const fullPath = path.join(this.waiverStorageDir, filename);
    fs.writeFileSync(fullPath, file.buffer);
    return this.updateRequestorById(requestorId, {
      liability_waiver_file: filename,
      liability_waiver_submitted_at: nowIso(),
    }, {
      allowAdminFields: true,
      includePrivate: true,
    });
  }

  resolveLiabilityWaiverPath(pointer) {
    const value = String(pointer || '').trim();
    if (!value) {
      throw new Error('No submitted waiver file is available.');
    }
    const root = path.resolve(this.waiverStorageDir);
    const fullPath = path.resolve(root, value);
    if (fullPath !== root && !fullPath.startsWith(`${root}${path.sep}`)) {
      throw new Error('Invalid waiver file pointer.');
    }
    if (!fs.existsSync(fullPath)) {
      throw new Error('Submitted waiver file was not found.');
    }
    return fullPath;
  }

  getLiabilityWaiverPathForRequestor(requestorId) {
    const requestor = this.getRequestorById(requestorId, { includePrivate: true });
    if (!requestor) return null;
    return {
      requestor,
      path: this.resolveLiabilityWaiverPath(requestor.liability_waiver_file),
    };
  }

  listLiabilityWaiverReviewQueue(year = new Date().getFullYear()) {
    return this.listRequestors({ includePrivate: true })
      .filter((requestor) => (
        requestor.liability_waiver_file
        && !isWaiverApprovedForYear(requestor.liability_waiver_date, year)
      ))
      .map((requestor) => ({
        Requestor_ID: requestor.Requestor_ID,
        Email: requestor.Email,
        Name: [requestor.first_name, requestor.last_name].filter(Boolean).join(' ').trim() || requestor.Email,
        Phone: requestor.Phone,
        city: requestor.city,
        liability_waiver_date: requestor.liability_waiver_date,
        liability_waiver_submitted_at: requestor.liability_waiver_submitted_at,
        liability_waiver_file: requestor.liability_waiver_file,
      }));
  }

  updatePrivateComments(requestorId, privateComments) {
    const requestor = this.getRequestorById(requestorId, { includePrivate: true });
    if (!requestor) return null;
    return this.updateRequestorById(requestorId, { private_comments: privateComments || '' }, {
      allowAdminFields: true,
      includePrivate: true,
    });
  }

  approveLiabilityWaiver(requestorId, date = new Date().toISOString().slice(0, 10)) {
    const requestor = this.getRequestorById(requestorId, { includePrivate: true });
    if (!requestor) return null;
    if (!requestor.liability_waiver_file) {
      throw new Error('A submitted liability waiver is required before approval.');
    }
    this.resolveLiabilityWaiverPath(requestor.liability_waiver_file);
    return this.updateRequestorById(requestorId, { liability_waiver_date: date }, {
      allowAdminFields: true,
      includePrivate: true,
    });
  }

  ensureWorkPartyKey(target = {}) {
    const key = target.workPartyKey || target.key;
    if (key) return parseWorkPartyKey(key);
    if (!target.friday_check_in || !target.hut) {
      throw new Error('A specific work party is required.');
    }
    return { friday_check_in: target.friday_check_in, hut: target.hut };
  }

  updateWorkPartyAcceptedStatus(requestorId, target, status) {
    const { friday_check_in, hut } = this.ensureWorkPartyKey(target);
    const acceptedStatus = cleanWorkPartyAcceptedStatus(status);
    if (!acceptedStatus) {
      throw new Error('Accepted status is required.');
    }
    const existing = this.db.prepare(`
      SELECT interest, attendance_status
      FROM work_party_requests
      WHERE friday_check_in = ? AND hut = ? AND requestor_id = ?
    `).get(friday_check_in, hut, Number(requestorId));
    this.db.prepare(`
      INSERT INTO work_party_requests (
        friday_check_in, hut, requestor_id, interest, confirmation_status, attendance_status, added_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(friday_check_in, hut, requestor_id) DO UPDATE SET
        confirmation_status = excluded.confirmation_status
    `).run(
      friday_check_in,
      hut,
      Number(requestorId),
      existing?.interest || 'please consider me',
      acceptedStatus,
      cleanWorkPartyAttendanceStatus(existing?.attendance_status || ''),
      nowIso()
    );
    return this.getWorkPartyRequest(requestorId, { friday_check_in, hut });
  }

  updateWorkPartyAttendanceStatus(requestorId, target, status) {
    const { friday_check_in, hut } = this.ensureWorkPartyKey(target);
    const attendanceStatus = cleanWorkPartyAttendanceStatus(status);
    if (!attendanceStatus) {
      throw new Error('Attendance status is required.');
    }
    const existing = this.db.prepare(`
      SELECT interest, confirmation_status
      FROM work_party_requests
      WHERE friday_check_in = ? AND hut = ? AND requestor_id = ?
    `).get(friday_check_in, hut, Number(requestorId));
    this.db.prepare(`
      INSERT INTO work_party_requests (
        friday_check_in, hut, requestor_id, interest, confirmation_status, attendance_status, added_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(friday_check_in, hut, requestor_id) DO UPDATE SET
        attendance_status = excluded.attendance_status
    `).run(
      friday_check_in,
      hut,
      Number(requestorId),
      existing?.interest || 'please consider me',
      cleanWorkPartyAcceptedStatus(existing?.confirmation_status || ''),
      attendanceStatus,
      nowIso()
    );
    return this.getWorkPartyRequest(requestorId, { friday_check_in, hut });
  }

  getWorkPartyRequest(requestorId, target) {
    const { friday_check_in, hut } = this.ensureWorkPartyKey(target);
    const row = this.db.prepare(`
      SELECT *
      FROM work_party_requests
      WHERE friday_check_in = ? AND hut = ? AND requestor_id = ?
    `).get(friday_check_in, hut, Number(requestorId));
    if (!row) return null;
    return {
      Friday_check_in: row.friday_check_in,
      Hut: row.hut,
      Requestor_ID: Number(row.requestor_id),
      Interest: row.interest || '',
      Accepted_status: cleanWorkPartyAcceptedStatus(row.confirmation_status),
      Attendance_status: cleanWorkPartyAttendanceStatus(row.attendance_status),
      Added_date: row.added_date || '',
    };
  }

  cleanWorkPartyManagementInput(row = {}, options = {}) {
    const current = options.current || {};
    return {
      friday_check_in: options.preserveIdentity
        ? current.friday_check_in
        : cleanWorkPartyDate(row.Friday_check_in || row.friday_check_in, 'Friday check-in date'),
      hut: options.preserveIdentity
        ? current.hut
        : cleanWorkPartyHut(row.Hut || row.hut),
      sunday_check_out: row.Sunday_check_out || row.sunday_check_out || '',
      leader: row.Leader || row.leader || '',
      leader_phone: row.Leader_phone || row.Leader_contact || row.leader_phone || row.leader_contact || '',
      capacity: cleanWorkPartyCapacity(row.Capacity ?? row.capacity ?? 0),
      party_comments: row.Party_comments || row.party_comments || '',
      availability: cleanWorkPartyAvailability(row.Availability || row.availability || 'open'),
    };
  }

  listAdminWorkParties(year = new Date().getFullYear()) {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    return this.db.prepare(`
      SELECT *
      FROM work_parties
      WHERE friday_check_in BETWEEN ? AND ?
      ORDER BY friday_check_in, hut
    `).all(start, end).map((row) => ({
      ...rowToWorkParty(row),
      key: workPartyKey(row.friday_check_in, row.hut),
    }));
  }

  listWorkPartyLeaderOptions() {
    return this.listRequestors({ includePrivate: true })
      .filter((requestor) => requestor.Admin)
      .map((requestor) => {
        const name = [requestor.first_name, requestor.last_name].filter(Boolean).join(' ').trim() || requestor.Email;
        return {
          Requestor_ID: requestor.Requestor_ID,
          Email: requestor.Email,
          Name: name,
          Phone: requestor.Phone,
          label: `${name} (${requestor.Email})`,
          contact: requestor.Phone || requestor.Email,
        };
      });
  }

  adminWorkPartyManagementPayload(year = new Date().getFullYear()) {
    return {
      year: Number(year),
      rows: this.listAdminWorkParties(year),
      leaderOptions: this.listWorkPartyLeaderOptions(),
      huts: HUTS,
      availabilities: [...WORK_PARTY_AVAILABILITIES],
    };
  }

  createWorkParty(row = {}) {
    const cleaned = this.cleanWorkPartyManagementInput(row);
    const existing = this.db.prepare(`
      SELECT 1
      FROM work_parties
      WHERE friday_check_in = ? AND hut = ?
    `).get(cleaned.friday_check_in, cleaned.hut);
    if (existing) {
      throw new Error('A work party already exists for that hut and date.');
    }
    this.upsertWorkParty(cleaned);
    return this.getAdminWorkParty(cleaned.friday_check_in, cleaned.hut);
  }

  getAdminWorkParty(fridayCheckIn, hut) {
    const row = this.db.prepare(`
      SELECT *
      FROM work_parties
      WHERE friday_check_in = ? AND hut = ?
    `).get(fridayCheckIn, hut);
    if (!row) return null;
    return {
      ...rowToWorkParty(row),
      key: workPartyKey(row.friday_check_in, row.hut),
    };
  }

  updateWorkParty(target = {}, updates = {}) {
    const { friday_check_in, hut } = this.ensureWorkPartyKey(target);
    const existing = this.db.prepare(`
      SELECT *
      FROM work_parties
      WHERE friday_check_in = ? AND hut = ?
    `).get(friday_check_in, hut);
    if (!existing) return null;
    const cleaned = this.cleanWorkPartyManagementInput(updates, {
      preserveIdentity: true,
      current: existing,
    });
    this.db.prepare(`
      UPDATE work_parties
      SET sunday_check_out = ?,
          leader = ?,
          leader_phone = ?,
          capacity = ?,
          party_comments = ?,
          availability = ?
      WHERE friday_check_in = ? AND hut = ?
    `).run(
      cleaned.sunday_check_out,
      cleaned.leader,
      cleaned.leader_phone,
      cleaned.capacity,
      cleaned.party_comments,
      cleaned.availability,
      friday_check_in,
      hut
    );
    return this.getAdminWorkParty(friday_check_in, hut);
  }

  deleteWorkParty(target = {}) {
    const { friday_check_in, hut } = this.ensureWorkPartyKey(target);
    const result = this.db.prepare(`
      DELETE FROM work_parties
      WHERE friday_check_in = ? AND hut = ?
    `).run(friday_check_in, hut);
    return result.changes > 0;
  }

  upsertWorkParty(row) {
    const hasAvailability = Object.prototype.hasOwnProperty.call(row, 'Availability')
      || Object.prototype.hasOwnProperty.call(row, 'availability');
    const availability = hasAvailability ? (row.Availability || row.availability || 'open') : null;
    this.db.prepare(`
      INSERT INTO work_parties (
        friday_check_in, hut, sunday_check_out, leader, leader_phone, capacity, party_comments, availability
      ) VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, 'open'))
      ON CONFLICT(friday_check_in, hut) DO UPDATE SET
        sunday_check_out = excluded.sunday_check_out,
        leader = excluded.leader,
        leader_phone = excluded.leader_phone,
        capacity = excluded.capacity,
        party_comments = excluded.party_comments,
        availability = COALESCE(?, work_parties.availability)
    `).run(
      row.Friday_check_in || row.friday_check_in,
      row.Hut || row.hut,
      row.Sunday_check_out || row.sunday_check_out || '',
      row.Leader || row.leader || '',
      row.Leader_phone || row.leader_phone || '',
      Number(row.Capacity || row.capacity || 0),
      row.Party_comments || row.party_comments || '',
      availability,
      availability
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
