const fs = require('fs');
const path = require('path');
const { DATA_DIR, REQUESTORS_FILE, REQUESTS_FILE, HUTS } = require('../config');
const { normalizeEmail } = require('../services/auth');

const REQUESTORS_HEADERS = [
  'Requestor_ID',
  'Email',
  'Name',
  'Phone',
  'Comments',
  'Credits',
  'Email_code_sent',
  'Admin',
  'Creation_date',
  'Last_mod_date',
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
  'Confirmed_How',
  'Creation_date',
  'Last_mod_date',
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
    this.ensureFiles();
    this.load();
    setInterval(() => this.flush(), 5000);
  }

  ensureFiles() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(REQUESTORS_FILE)) {
      fs.writeFileSync(REQUESTORS_FILE, `${REQUESTORS_HEADERS.join('\t')}\n`, 'utf8');
    }
    if (!fs.existsSync(REQUESTS_FILE)) {
      fs.writeFileSync(REQUESTS_FILE, `${REQUESTS_HEADERS.join('\t')}\n`, 'utf8');
    }
  }

  load() {
    const reqorsRaw = fs.readFileSync(REQUESTORS_FILE, 'utf8');
    const reqsRaw = fs.readFileSync(REQUESTS_FILE, 'utf8');

    const reqorsParsed = parseTsv(reqorsRaw);
    const reqsParsed = parseTsv(reqsRaw);

    this.requestors = reqorsParsed.rows.map((r) => ({
      Requestor_ID: Number(r.Requestor_ID),
      Email: normalizeEmail(r.Email),
      Name: r.Name || '',
      Phone: r.Phone || '',
      Comments: r.Comments || '',
      Credits: Number(r.Credits || 0),
      Email_code_sent: r.Email_code_sent || '',
      Admin: boolFromAny(r.Admin),
      Creation_date: r.Creation_date || '',
      Last_mod_date: r.Last_mod_date || '',
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
      Status: r.Status || 'pending',
      Confirmed_How: r.Confirmed_How || '',
      Creation_date: r.Creation_date || '',
      Last_mod_date: r.Last_mod_date || '',
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
    }));

    const requestsRows = this.requests.map((r) => ({
      ...r,
      Benson: r.Benson ? 'TRUE' : 'FALSE',
      Bradley: r.Bradley ? 'TRUE' : 'FALSE',
      Grubb: r.Grubb ? 'TRUE' : 'FALSE',
      Ludlow: r.Ludlow ? 'TRUE' : 'FALSE',
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
      existing.Name = partial.Name ?? existing.Name;
      existing.Phone = partial.Phone ?? existing.Phone;
      existing.Comments = partial.Comments ?? existing.Comments;
      existing.Credits = Number(partial.Credits ?? existing.Credits);
      existing.Admin = partial.Admin !== undefined ? Boolean(partial.Admin) : existing.Admin;
      existing.Email_code_sent = partial.Email_code_sent ?? existing.Email_code_sent;
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
      Name: partial.Name ?? '',
      Phone: partial.Phone ?? '',
      Comments: partial.Comments ?? '',
      Credits: Number(partial.Credits ?? 0),
      Email_code_sent: partial.Email_code_sent ?? '',
      Admin: Boolean(partial.Admin),
      Creation_date: now,
      Last_mod_date: now,
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
    existing.Name = updates.Name ?? existing.Name;
    existing.Phone = updates.Phone ?? existing.Phone;
    existing.Comments = updates.Comments ?? existing.Comments;
    if (updates.Credits !== undefined) {
      existing.Credits = Number(updates.Credits);
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

    for (const input of requests) {
      this.requests.push({
        Requestor_ID: rid,
        Benson: Boolean(input.Benson),
        Bradley: Boolean(input.Bradley),
        Grubb: Boolean(input.Grubb),
        Ludlow: Boolean(input.Ludlow),
        Arrival: input.Arrival,
        Departure: input.Departure,
        Choice_Number: Number(input.Choice_Number),
        Spots_ideal: Number(input.Spots_ideal),
        Spots_min: Number(input.Spots_min || input.Spots_ideal),
        Hut_granted: input.Hut_granted || '',
        Spots_granted: Number(input.Spots_granted || 0),
        Status: input.Status || 'pending',
        Confirmed_How: input.Confirmed_How || '',
        Creation_date: input.Creation_date || now,
        Last_mod_date: now,
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
