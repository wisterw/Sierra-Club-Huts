const { HUT_CAPACITY } = require('../config');
const { hutsForRequest } = require('./requestLogic');
const { dateRangeNights } = require('./dates');
const { creditsToTenths, creditsFromTenths } = require('./credits');

const POLICY_VERSION = 'credit-rank-person-nights-v3';
const HUT_ORDER = ['Ludlow', 'Benson', 'Bradley', 'Grubb'];
function normalizeAllocation(requests, people, capacities = HUT_CAPACITY) {
  people = require('./placeholderPriority').effectiveRequestors(people);
  const groups = new Map();
  const ids = new Map(requests.map((r, index) => [Number(r.Request_ID), index]));
  requests.forEach((r, index) => {
    const rid = Number(r.Requestor_ID);
    if (!people.has(rid)) throw new Error(`Missing requestor ${rid}.`);
    const huts = hutsForRequest(r);
    if (huts.some((hut) => !Number.isInteger(capacities[hut]) || capacities[hut] < 0)) throw new Error('Missing or invalid hut capacity.');
    const duration = Date.parse(r.Departure) - Date.parse(r.Arrival);
    if (!Number.isFinite(duration) || duration <= 0 || duration > 5 * 86400000 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(r.Arrival) || !/^\d{4}-\d{2}-\d{2}$/.test(r.Departure)) throw new Error(`Invalid allocation dates for request ${r.Request_ID ?? index}.`);
    if (new Date(r.Arrival).toISOString().slice(0, 10) !== r.Arrival || new Date(r.Departure).toISOString().slice(0, 10) !== r.Departure) throw new Error('Invalid allocation calendar date.');
    const nights = dateRangeNights(r.Arrival, r.Departure);
    if (!huts.length || !nights.length || nights.length > 5 || !Number.isSafeInteger(Number(r.Choice_Number)) || Number(r.Choice_Number) < 1 ||
      !Number.isInteger(Number(r.Spots_min ?? r.Spots_ideal)) || !Number.isInteger(Number(r.Spots_ideal)) ||
      Number(r.Spots_min ?? r.Spots_ideal) < 1 || Number(r.Spots_ideal) < Number(r.Spots_min ?? r.Spots_ideal)) throw new Error(`Invalid allocation request ${r.Request_ID ?? index}.`);
    const key = r.Combination_first_request ? `combo:${r.Combination_first_request}` : `row:${index}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ r, index, huts, nights });
  });
  const options = [];
  const ranks = new Set();
  const requestorIds = new Set();
  for (const rows of groups.values()) {
    rows.sort((a, b) => a.r.Arrival.localeCompare(b.r.Arrival));
    const first = rows[0].r;
    const combo = !!first.Combination_first_request;
    const rankKey = `${first.Requestor_ID}:${first.Choice_Number}`;
    if (ranks.has(rankKey)) throw new Error(`Duplicate logical choice ${rankKey}.`);
    ranks.add(rankKey);
    if (combo) {
      const second = rows[1]?.r;
      if (rows.length !== 2 || ids.get(Number(first.Combination_first_request)) !== rows[0].index ||
        !second || Number(first.Requestor_ID) !== Number(second.Requestor_ID) || Number(first.Choice_Number) !== Number(second.Choice_Number) ||
        first.Departure !== second.Arrival || rows.some((row) => row.huts.length !== 1) ||
        !['Benson->Bradley', 'Bradley->Benson'].includes(rows.map((row) => row.huts[0]).join('->')) ||
        Number(first.Spots_min ?? first.Spots_ideal) !== Number(second.Spots_min ?? second.Spots_ideal) || Number(first.Spots_ideal) !== Number(second.Spots_ideal)) {
        throw new Error(`Invalid or incompatible combination request ${first.Combination_first_request}.`);
      }
    }
    const rid = Number(first.Requestor_ID);
    requestorIds.add(rid);
    const variants = combo ? [rows.map((row) => row.huts[0])] : rows[0].huts.map((h) => [h]);
    variants.sort((a, b) => HUT_ORDER.indexOf(a[0]) - HUT_ORDER.indexOf(b[0]));
    for (const huts of variants) {
      const cells = rows.flatMap((row, leg) => row.nights.map((night) => `${night}|${huts[leg]}`));
      if (new Set(cells).size !== cells.length) throw new Error('Duplicate occupied traverse night.');
      options.push({ id: options.length, requestorId: rid, rank: Number(first.Choice_Number),
        minimum: Number(first.Spots_min ?? first.Spots_ideal), ideal: Number(first.Spots_ideal),
        rows: rows.map((row) => row.index), huts, cells, nights: cells.length });
    }
  }
  const requestors = [...requestorIds].map((id) => {
    const p = people.get(id);
    const lottery = p.Lottery_value ?? p.lottery_value;
    if (!Number.isFinite(Number(lottery)) || lottery === null || lottery === undefined) throw new Error('Allocation requires generated lottery values.');
    return { id, placeholder: !!p.Is_placeholder, credits: creditsToTenths(p.Credits ?? 0), years: Number(p.years_of_service) || 0, lottery: Number(lottery) };
  }).sort((a, b) => b.years - a.years || a.lottery - b.lottery || a.id - b.id);
  const placeholderCells = new Map();
  for (const p of requestors.filter((p) => p.placeholder)) {
    const own = options.filter((o) => o.requestorId === p.id);
    if (own.length !== 1 || own[0].rank !== 1 || own[0].minimum !== own[0].ideal) throw new Error('Placeholder must have one fixed first-choice booking.');
    for (const cell of own[0].cells) {
      const used = (placeholderCells.get(cell) || 0) + own[0].ideal;
      if (used > capacities[cell.split('|')[1]]) throw new Error('Placeholder reservations exceed capacity.');
      placeholderCells.set(cell, used);
    }
  }
  for (const capacity of Object.values(capacities)) if (!Number.isInteger(capacity) || capacity < 0) throw new Error('Invalid hut capacity.');
  return { options, requestors, levels: [...new Set(requestors.map((p) => p.credits))].sort((a, b) => b - a), capacities };
}
function measureAllocation(model, allocation) {
  const selected = new Map(allocation.map((a) => [model.options[a.optionId].requestorId, a]));
  const objectiveScores = model.levels.map((level) => ({ credits: creditsFromTenths(level), score: model.requestors.filter((p) => p.credits === level)
    .reduce((sum, p) => sum + (selected.has(p.id) ? model.options[selected.get(p.id).optionId].rank : 10), 0) }));
  const scores = objectiveScores.filter((s) => model.requestors.some((p) => !p.placeholder && p.credits === creditsToTenths(s.credits)));
  const personNights = allocation.reduce((sum, a) => sum + model.options[a.optionId].nights * a.guests, 0);
  const countsByChoice = {};
  const countsByCredit = scores.map((s) => ({ credits: s.credits, assigned: 0, unassigned: 0 }));
  for (const p of model.requestors) {
    if (p.placeholder) continue;
    const a = selected.get(p.id);
    const rank = a ? model.options[a.optionId].rank : 'none';
    countsByChoice[rank] = (countsByChoice[rank] || 0) + 1;
    countsByCredit.find((c) => c.credits === creditsFromTenths(p.credits))[a ? 'assigned' : 'unassigned'] += 1;
  }
  const placeholders = allocation.filter((a) => model.requestors.find((p) => p.id === model.options[a.optionId].requestorId).placeholder);
  return { scores, objectiveScores, personNights, countsByChoice, countsByCredit,
    placeholderBookings: placeholders.length, placeholderPersonNights: placeholders.reduce((sum, a) => sum + model.options[a.optionId].nights * a.guests, 0) };
}
function validateAllocation(model, allocation, metrics) {
  if (!Array.isArray(allocation)) throw new Error('Invalid solver allocation.');
  const selected = new Set();
  const occupancy = new Map();
  for (const a of allocation) {
    const o = model.options[a.optionId];
    if (!Number.isInteger(a.optionId) || !o || selected.has(o.requestorId) || !Number.isInteger(a.guests) || a.guests < o.minimum || a.guests > o.ideal) throw new Error('Invalid solver choice or guest count.');
    selected.add(o.requestorId);
    for (const cell of o.cells) {
      const used = (occupancy.get(cell) || 0) + a.guests;
      if (used > model.capacities[cell.split('|')[1]]) throw new Error(`Solver exceeded capacity at ${cell}.`);
      occupancy.set(cell, used);
    }
  }
  const measured = measureAllocation(model, allocation);
  if (model.requestors.some((p) => p.placeholder && !selected.has(p.id))) throw new Error('Solver omitted a priority reservation.');
  if (metrics && (JSON.stringify(measured.scores) !== JSON.stringify(metrics.scores) || measured.personNights !== metrics.personNights)) throw new Error('Solver objective arithmetic mismatch.');
  return measured;
}
function allocationOrderVector(model, allocation) {
  const selected = new Map(allocation.map((a) => [model.options[a.optionId].requestorId, a]));
  return [...measureAllocation(model, allocation).objectiveScores.map((s) => s.score), -measureAllocation(model, allocation).personNights,
    ...model.requestors.map((p) => selected.has(p.id) ? model.options[selected.get(p.id).optionId].rank : 10),
    ...model.requestors.flatMap((p) => { const a = selected.get(p.id); return a ? [-a.guests, model.options[a.optionId].id] : [0, 0]; })];
}
module.exports = { POLICY_VERSION, normalizeAllocation, measureAllocation, validateAllocation, allocationOrderVector };
