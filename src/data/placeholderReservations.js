const crypto = require('crypto');
const { HUTS, HUT_CAPACITY } = require('../config');
const { validateRequestSet } = require('../services/requestLogic');
const { dateRangeNights } = require('../services/dates');
const { effectiveRequestors } = require('../services/placeholderPriority');

const HEADERS = ['Reservation_reference', 'Name', 'Hut', 'Arrival', 'Traverse_date', 'Departure', 'Guests', 'Notes'];
const MAX_BYTES = 2 * 1024 * 1024;
function initPlaceholderSchema(store) {
  const columns = new Set(store.db.prepare('PRAGMA table_info(requestors)').all().map((c) => c.name));
  if (!columns.has('is_placeholder')) store.db.exec('ALTER TABLE requestors ADD COLUMN is_placeholder INTEGER NOT NULL DEFAULT 0 CHECK(is_placeholder IN (0, 1))');
  if (!columns.has('reservation_reference')) store.db.exec('ALTER TABLE requestors ADD COLUMN reservation_reference TEXT');
  store.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS reservation_reference_unique ON requestors(reservation_reference) WHERE reservation_reference IS NOT NULL');
}
function parseReservations(raw, year = new Date().getFullYear()) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') > MAX_BYTES) throw new Error('Reservation TSV must be at most 2 MB.');
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/);
  const headers = lines.shift().split('\t').map((h) => h.trim().toLowerCase());
  for (const h of ['Reservation_reference', 'Name', 'Hut', 'Arrival', 'Departure', 'Guests']) if (!headers.includes(h.toLowerCase())) throw new Error(`Missing ${h} header.`);
  if (new Set(headers).size !== headers.length) throw new Error('Duplicate TSV headers.');
  const refs = new Set();
  const bookings = [];
  lines.forEach((line, i) => {
    if (!line.trim()) return;
    try {
      const cells = line.split('\t');
      const value = (name) => (cells[headers.indexOf(name.toLowerCase())] || '').trim();
      const reference = value('Reservation_reference'), name = value('Name');
      if (!reference || !name || reference.length > 200 || name.length > 200) throw new Error('Reservation_reference and Name are required (maximum 200 characters).');
      if (refs.has(reference)) throw new Error(`Duplicate reference ${reference}.`);
      refs.add(reference);
      const hutText = value('Hut');
      const huts = hutText.split('->').map((h) => HUTS.find((known) => known.toLowerCase() === h.trim().toLowerCase()));
      if (huts.some((h) => !h) || huts.length > 2 || (huts.length === 2 && !['Benson->Bradley', 'Bradley->Benson'].includes(huts.join('->')))) throw new Error('Hut must name one hut or Benson->Bradley / Bradley->Benson.');
      const arrival = value('Arrival'), departure = value('Departure'), traverse = value('Traverse_date');
      for (const d of [arrival, departure, ...(traverse ? [traverse] : [])]) if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !Number.isFinite(Date.parse(d)) || new Date(d).toISOString().slice(0, 10) !== d) throw new Error('Dates must be valid YYYY-MM-DD dates.');
      if (arrival < `${year}-12-15` || departure > `${year + 1}-04-30`) throw new Error('Dates must be in the current December 15–April 30 request season.');
      if (huts.length === 2 ? !(arrival < traverse && traverse < departure) : !!traverse) throw new Error('Combination trips require a traverse date strictly between arrival and departure; ordinary trips omit it.');
      const guests = Number(value('Guests'));
      const leg = (hut, a, d) => ({ [hut]: true, Arrival: a, Departure: d, Choice_Number: 1, Spots_min: guests, Spots_ideal: guests, ...(huts.length === 2 ? { Client_combo_group: reference } : {}) });
      const requests = huts.length === 2 ? [leg(huts[0], arrival, traverse), leg(huts[1], traverse, departure)] : [leg(huts[0], arrival, departure)];
      const error = validateRequestSet(requests); if (error) throw new Error(error);
      bookings.push({ reference, name, notes: value('Notes'), requests });
    } catch (error) { throw new Error(`TSV row ${i + 2}: ${error.message}`); }
  });
  if (!bookings.length) throw new Error('Reservation TSV has no data rows.');
  return bookings;
}
function listReservations(store) {
  return store.listRequestors({ includePrivate: true }).filter((p) => p.Is_placeholder).map((p) => ({
    Reservation_reference: p.Reservation_reference, Name: p.first_name, Notes: p.private_comments,
    Requestor_ID: p.Requestor_ID, requests: store.getRequestsByRequestorId(p.Requestor_ID),
  }));
}
function validateOccupancy(bookings) {
  const occupied = new Map();
  for (const b of bookings) {
    if (!b.requests.length || b.requests.length > 2) throw new Error(`Invalid reservation linkage ${b.reference}.`);
    const validatedRows = b.requests.map((r) => ({ ...r, Client_combo_group: b.requests.length === 2 ? b.reference : undefined }));
    const error = validateRequestSet(validatedRows); if (error) throw new Error(`${b.reference}: ${error}`);
    if (b.requests.length === 2 && Number(b.requests[0].Spots_ideal) !== Number(b.requests[1].Spots_ideal)) throw new Error(`Incompatible traverse guest counts ${b.reference}.`);
    for (const r of b.requests) {
      const huts = HUTS.filter((h) => r[h]);
      if (huts.length !== 1 || Number(r.Choice_Number) !== 1 || Number(r.Spots_min) !== Number(r.Spots_ideal)) throw new Error(`Invalid placeholder reservation ${b.reference}.`);
      for (const night of dateRangeNights(r.Arrival, r.Departure)) {
        const key = `${night}|${huts[0]}`;
        const used = (occupied.get(key) || 0) + Number(r.Spots_ideal);
        if (used > HUT_CAPACITY[huts[0]]) throw new Error(`Reservation ${b.reference} exceeds capacity at ${key}.`);
        occupied.set(key, used);
      }
    }
  }
}
function importReservations(store, raw, actorId) {
  const bookings = parseReservations(raw);
  return store.runTransaction(() => {
    const existing = new Map(listReservations(store).map((b) => [b.Reservation_reference, b]));
    const final = new Map(existing);
    for (const b of bookings) final.set(b.reference, b);
    validateOccupancy([...final.values()].map((b) => ({ ...b, reference: b.reference ?? b.Reservation_reference })));
    let created = 0, updated = 0;
    for (const b of bookings) {
      const old = existing.get(b.reference);
      if (old && !old.requests.length) throw new Error(`Reservation ${b.reference} has no linked request.`);
      let id = old?.Requestor_ID;
      if (!id) {
        const p = store.upsertRequestor({ Email: `reservation-${crypto.randomUUID()}@placeholder.invalid`, first_name: b.name, Lottery_value: 0 });
        id = p.Requestor_ID;
        store.db.prepare('UPDATE requestors SET is_placeholder = 1, reservation_reference = ? WHERE requestor_id = ?').run(b.reference, id);
        created++;
      } else updated++;
      const priority = effectiveRequestors(new Map(store.listRequestors().map((p) => [p.Requestor_ID, p]))).get(id).Credits;
      const { creditsToTenths } = require('../services/credits');
      store.db.prepare('UPDATE requestors SET first_name = ?, last_name = ?, private_comments = ?, credits_tenths = ?, lottery_value = 0, last_mod_date = ? WHERE requestor_id = ?')
        .run(b.name, '', b.notes, creditsToTenths(priority), new Date().toISOString(), id);
      store.replaceRequestsForRequestor(id, b.requests.map((r, index) => ({ ...r, Request_ID: old?.requests[index]?.Request_ID })));
    }
    return { created, updated };
  }, { actorId });
}
function removeReservation(store, reference, actorId) {
  return store.runTransaction(() => {
    const p = store.db.prepare('SELECT * FROM requestors WHERE reservation_reference = ? AND is_placeholder = 1').get(reference);
    if (!p) throw new Error('Reservation not found.');
    const rows = store.getRequestsByRequestorId(Number(p.requestor_id));
    if (!rows.length || new Set(rows.map((r) => r.Choice_Number)).size !== 1) throw new Error('Unexpected reservation ownership; removal refused.');
    store.replaceRequestsForRequestor(Number(p.requestor_id), []);
    store.db.prepare('DELETE FROM requestors WHERE requestor_id = ? AND is_placeholder = 1').run(p.requestor_id);
    store.contentionRefreshPending = true;
  }, { actorId });
}
module.exports = { HEADERS, MAX_BYTES, initPlaceholderSchema, parseReservations, listReservations, validateOccupancy, importReservations, removeReservation };
