const fs = require('fs');
const path = require('path');
const { DATA_DIR, REQUESTORS_FILE, REQUESTS_FILE, HUTS } = require('../config');
const { closestSaturdayWeekKey } = require('../services/dates');
const { normalizeEmail } = require('../services/auth');

const REQUESTORS_HEADERS = [
  'Requestor_ID',
  'Email',
  'first_name',
  'last_name',
  'address',
  'city',
  'state',
  'zip',
  'Phone',
  'Comments',
  'Credits',
  'login_code',
  'code_generated_when',
  'Admin',
  'Creation_date',
  'Last_mod_date',
  'last_failed_login',
  'years_of_service',
];

const REQUESTS_HEADERS = [
  'Requestor_ID',
  ...HUTS,
  'Arrival',
  'Departure',
  'Choice_Number',
  'Spots_ideal',
  'Spots_min',
  'Hut_granted',
  'Spots_granted',
  'Status',
  'Lottery_value',
  'Confirmed_How',
  'Creation_date',
  'Last_mod_date',
  'hut_count_flexibility',
  'saturday_week_number',
];

function parseTsv(content) {
  const lines = content.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = lines[0].split('\t');
  const rows = lines.slice(1).map((line) => {
    const cells = line.split('\t');
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? '';
    });
    return row;
  });
  return { headers, rows };
}

function toTsv(headers, rows) {
  const lines = [headers.join('\t')];
  for (const row of rows) {
    lines.push(headers.map((h) => String(row[h] ?? '').replace(/[\r\n\t]/g, ' ')).join('\t'));
  }
  return `${lines.join('\n')}\n`;
}

function boolFromAny(v) {
  return String(v).toLowerCase() === 'true' || String(v) === '1';
}

class TsvStore {
  constructor() {
    this.requestors = [];
    this.requests = [];
    this.dirty = false;
    this.validateFiles();
    this.load();
    setInterval(() => this.flush(), 5000);
  }

  validateFiles() {
    const ensureOpen = (filePath) => {
      try {
        const fd = fs.openSync(filePath, 'r+');
        fs.closeSync(fd);
      } catch (err) {
        console.error(`Data file error: cannot open ${filePath}.`, err.message);
        process.exit(1);
      }
    };

    const validateHeader = (filePath, expected) => {
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const firstLine = raw.split(/\r?\n/)[0] || '';
        const header = firstLine.replace(/^\uFEFF/, '').split('\t');
        const matches = header.length === expected.length
          && header.every((value, idx) => value === expected[idx]);
        if (!matches) {
          console.error(`Data file error: invalid header row in ${filePath}.`);
          process.exit(1);
        }
      } catch (err) {
        console.error(`Data file error: cannot read ${filePath}.`, err.message);
        process.exit(1);
      }
    };

    if (!fs.existsSync(REQUESTORS_FILE)) {
      console.error(`Data file error: missing ${REQUESTORS_FILE}.`);
      process.exit(1);
    }
    if (!fs.existsSync(REQUESTS_FILE)) {
      console.error(`Data file error: missing ${REQUESTS_FILE}.`);
      process.exit(1);
    }

    ensureOpen(REQUESTORS_FILE);
    ensureOpen(REQUESTS_FILE);
    validateHeader(REQUESTORS_FILE, REQUESTORS_HEADERS);
    validateHeader(REQUESTS_FILE, REQUESTS_HEADERS);
  }

  load() {
    const reqorsRaw = fs.readFileSync(REQUESTORS_FILE, 'utf8');
    const reqsRaw = fs.readFileSync(REQUESTS_FILE, 'utf8');

    const reqorsParsed = parseTsv(reqorsRaw);
    const reqsParsed = parseTsv(reqsRaw);

    this.requestors = reqorsParsed.rows.map((r) => ({
      Requestor_ID: Number(r.Requestor_ID),
      Email: normalizeEmail(r.Email),
      first_name: r.first_name || '',
      last_name: r.last_name || '',
      address: r.address || '',
      city: r.city || '',
      state: r.state || '',
      zip: r.zip || '',
      Phone: r.Phone || '',
      Comments: r.Comments || '',
      Credits: Number(r.Credits || 0),
      login_code: Number.isInteger(Number(r.login_code)) ? Number(r.login_code) : 0,
      code_generated_when: r.code_generated_when || r.Email_code_sent || '',
      Admin: boolFromAny(r.Admin),
      Creation_date: r.Creation_date || '',
      Last_mod_date: r.Last_mod_date || '',
      last_failed_login: r.last_failed_login || '',
      years_of_service: Number(r.years_of_service || r['years of service'] || 0),
    }));

    this.requests = reqsParsed.rows.map((r) => ({
      Requestor_ID: Number(r.Requestor_ID),
      Benson: boolFromAny(r.Benson),
      Bradley: boolFromAny(r.Bradley),
      Grubb: boolFromAny(r.Grubb),
      Ludlow: boolFromAny(r.Ludlow),
      Arrival: r.Arrival || '',
      Departure: r.Departure || '',
      Choice_Number: Number(r.Choice_Number || 0),
      Spots_ideal: Number(r.Spots_ideal || 0),
      Spots_min: Number(r.Spots_min || 0),
      Hut_granted: r.Hut_granted || '',
      Spots_granted: Number(r.Spots_granted || 0),
      Status: r.Status || 'requested',
      Lottery_value: Number(r.Lottery_value || 0),
      Confirmed_How: r.Confirmed_How || '',
      Creation_date: r.Creation_date || '',
      Last_mod_date: r.Last_mod_date || '',
      hut_count_flexibility: Number(r.hut_count_flexibility || 0),
      saturday_week_number: r.saturday_week_number || '',
    }));
  }

  markDirty() {
    this.dirty = true;
  }

  flush(force = false) {
    if (!this.dirty && !force) {
      return;
    }

    const requestorsRows = this.requestors.map((r) => ({
      ...r,
      Admin: r.Admin ? 'TRUE' : 'FALSE',
      years_of_service: Number(r.years_of_service || 0),
    }));

    const requestsRows = this.requests.map((r) => ({
      ...r,
      Benson: r.Benson ? 'TRUE' : 'FALSE',
      Bradley: r.Bradley ? 'TRUE' : 'FALSE',
      Grubb: r.Grubb ? 'TRUE' : 'FALSE',
      Ludlow: r.Ludlow ? 'TRUE' : 'FALSE',
      Lottery_value: Number(r.Lottery_value || 0),
      hut_count_flexibility: Number(r.hut_count_flexibility || 0),
      saturday_week_number: r.saturday_week_number || '',
    }));

    fs.writeFileSync(REQUESTORS_FILE, toTsv(REQUESTORS_HEADERS, requestorsRows), 'utf8');
    fs.writeFileSync(REQUESTS_FILE, toTsv(REQUESTS_HEADERS, requestsRows), 'utf8');
    this.dirty = false;
  }

  listRequestors() {
    return this.requestors.map((r) => ({ ...r }));
  }

  listRequests() {
    return this.requests.map((r) => ({ ...r }));
  }

  getRequestorById(id) {
    return this.requestors.find((r) => r.Requestor_ID === Number(id)) || null;
  }

  getRequestorByEmail(email) {
    const normalized = normalizeEmail(email);
    return this.requestors.find((r) => r.Email === normalized) || null;
  }

  getRequestsByRequestorId(id) {
    return this.requests
      .filter((r) => r.Requestor_ID === Number(id))
      .sort((a, b) => a.Choice_Number - b.Choice_Number || a.Arrival.localeCompare(b.Arrival));
  }

  upsertRequestor(partial) {
    const now = new Date().toISOString();
    const normalizedEmail = normalizeEmail(partial.Email);
    let existing = this.getRequestorByEmail(normalizedEmail);

    if (existing) {
      existing.first_name = partial.first_name ?? existing.first_name;
      existing.last_name = partial.last_name ?? existing.last_name;
      existing.address = partial.address ?? existing.address;
      existing.city = partial.city ?? existing.city;
      existing.state = partial.state ?? existing.state;
      existing.zip = partial.zip ?? existing.zip;
      existing.Phone = partial.Phone ?? existing.Phone;
      existing.Comments = partial.Comments ?? existing.Comments;
      existing.Credits = Number(partial.Credits ?? existing.Credits);
      existing.Admin = partial.Admin !== undefined ? Boolean(partial.Admin) : existing.Admin;
      existing.years_of_service = Number(partial.years_of_service ?? existing.years_of_service ?? 0);
      existing.login_code = partial.login_code !== undefined ? Number(partial.login_code || 0) : existing.login_code;
      existing.code_generated_when = partial.code_generated_when ?? existing.code_generated_when;
      existing.last_failed_login = partial.last_failed_login ?? existing.last_failed_login;
      existing.Last_mod_date = now;
      this.markDirty();
      return existing;
    }

    const used = new Set(this.requestors.map((r) => r.Requestor_ID));
    let id = 1000 + Math.floor(Math.random() * 900000);
    while (used.has(id)) {
      id = 1000 + Math.floor(Math.random() * 900000);
    }

    existing = {
      Requestor_ID: id,
      Email: normalizedEmail,
      first_name: partial.first_name ?? '',
      last_name: partial.last_name ?? '',
      address: partial.address ?? '',
      city: partial.city ?? '',
      state: partial.state ?? '',
      zip: partial.zip ?? '',
      Phone: partial.Phone ?? '',
      Comments: partial.Comments ?? '',
      Credits: Number(partial.Credits ?? 0),
      login_code: Number(partial.login_code || 0),
      code_generated_when: partial.code_generated_when ?? partial.Email_code_sent ?? '',
      Admin: Boolean(partial.Admin),
      years_of_service: Number(partial.years_of_service || 0),
      Creation_date: now,
      Last_mod_date: now,
      last_failed_login: partial.last_failed_login ?? '',
    };

    this.requestors.push(existing);
    this.markDirty();
    return existing;
  }

  updateRequestorById(id, updates) {
    const existing = this.getRequestorById(id);
    if (!existing) {
      return null;
    }
    existing.first_name = updates.first_name ?? existing.first_name;
    existing.last_name = updates.last_name ?? existing.last_name;
    existing.address = updates.address ?? existing.address;
    existing.city = updates.city ?? existing.city;
    existing.state = updates.state ?? existing.state;
    existing.zip = updates.zip ?? existing.zip;
    existing.Phone = updates.Phone ?? existing.Phone;
    existing.Comments = updates.Comments ?? existing.Comments;
    if (updates.Credits !== undefined) {
      existing.Credits = Number(updates.Credits);
    }
    if (updates.years_of_service !== undefined) {
      existing.years_of_service = Number(updates.years_of_service);
    }
    if (updates.Admin !== undefined) {
      existing.Admin = Boolean(updates.Admin);
    }
    existing.Last_mod_date = new Date().toISOString();
    this.markDirty();
    return existing;
  }

  replaceRequestsForRequestor(id, requests) {
    const now = new Date().toISOString();
    const rid = Number(id);
    this.requests = this.requests.filter((r) => r.Requestor_ID !== rid);

    const orderedChoiceNumbers = [...new Set(
      requests.map((r) => Number(r.Choice_Number)).filter((n) => Number.isFinite(n))
    )].sort((a, b) => a - b);
    const choiceMap = new Map(orderedChoiceNumbers.map((n, idx) => [n, idx + 1]));

    for (const input of requests) {
      const hutCount = HUTS.filter((h) => Boolean(input[h])).length;
      const normalizedChoice = choiceMap.get(Number(input.Choice_Number)) || 1;
      this.requests.push({
        Requestor_ID: rid,
        Benson: Boolean(input.Benson),
        Bradley: Boolean(input.Bradley),
        Grubb: Boolean(input.Grubb),
        Ludlow: Boolean(input.Ludlow),
        Arrival: input.Arrival,
        Departure: input.Departure,
        Choice_Number: normalizedChoice,
        Spots_ideal: Number(input.Spots_ideal),
        Spots_min: Number(input.Spots_min || input.Spots_ideal),
        Hut_granted: input.Hut_granted || '',
        Spots_granted: Number(input.Spots_granted || 0),
        Status: input.Status || 'requested',
        Lottery_value: Number(input.Lottery_value || 0),
        Confirmed_How: input.Confirmed_How || '',
        Creation_date: input.Creation_date || now,
        Last_mod_date: now,
        hut_count_flexibility: Number(input.hut_count_flexibility || hutCount || 0),
        saturday_week_number: input.saturday_week_number || closestSaturdayWeekKey(input.Arrival, input.Departure),
      });
    }

    this.markDirty();
  }
}

module.exports = {
  TsvStore,
  REQUESTORS_HEADERS,
  REQUESTS_HEADERS,
  parseTsv,
  toTsv,
};
