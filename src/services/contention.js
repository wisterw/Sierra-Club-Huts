const { HUT_CAPACITY } = require('../config');
const { dateRangeNights } = require('./dates');
const { summarizeByChoice, hutsForRequest } = require('./requestLogic');

const STATUS_BY_SEVERITY = [null, 'at-risk', 'losing'];

// Evaluate saved preferences, independently of final assignment outcomes.
function calculateContention(requests, requestorsById) {
  const summaries = new Map();
  const severityById = new Map();
  const combinations = new Map();
  // Date expansion is identical in every requestor/choice summary. Do it once
  // for this snapshot rather than once for every pair of competing requests.
  const coverage = new Map(requests.map((request) => [request, {
    huts: hutsForRequest(request), nights: dateRangeNights(request.Arrival, request.Departure),
  }]));
  for (const request of requests) {
    const id = Number(request.Request_ID);
    const { nights, huts } = coverage.get(request);
    if (!nights.length || !huts.length) throw new Error(`Cannot calculate contention for request ${id}: missing valid dates or huts.`);
    const key = `${request.Requestor_ID}|${request.Choice_Number}`;
    if (!summaries.has(key)) {
      const summary = summarizeByChoice(requests, request.Choice_Number, request.Requestor_ID, requestorsById, coverage);
      summaries.set(key, new Map(summary.map((cell) => [`${cell.date}|${cell.hut}`, cell])));
    }
    const summary = summaries.get(key);
    const minimum = Number(request.Spots_min || request.Spots_ideal);
    const severity = Math.min(...huts.map((hut) => Math.max(...nights.map((night) => {
      const cell = summary.get(`${night}|${hut}`);
      const afterHigher = HUT_CAPACITY[hut] - (cell?.higherPrioritySpots || 0);
      if (minimum > afterHigher) return 2;
      return minimum > afterHigher - (cell?.samePrioritySpots || 0) ? 1 : 0;
    }))));
    severityById.set(id, severity);
    if (request.Combination_first_request) {
      const firstId = Number(request.Combination_first_request);
      if (!combinations.has(firstId)) combinations.set(firstId, []);
      combinations.get(firstId).push(request);
    }
  }
  for (const [firstId, rows] of combinations) {
    const ordered = rows.slice().sort((a, b) => String(a.Arrival).localeCompare(String(b.Arrival)));
    const [first, second] = ordered;
    const firstHuts = first && hutsForRequest(first);
    const secondHuts = second && hutsForRequest(second);
    const route = `${firstHuts?.[0]}->${secondHuts?.[0]}`;
    if (rows.length !== 2 || Number(first.Request_ID) !== firstId
      || Number(first.Requestor_ID) !== Number(second.Requestor_ID)
      || Number(first.Choice_Number) !== Number(second.Choice_Number)
      || first.Departure !== second.Arrival || firstHuts.length !== 1 || secondHuts.length !== 1
      || !['Benson->Bradley', 'Bradley->Benson'].includes(route)) {
      throw new Error(`Cannot calculate contention for combination request ${firstId}: expected two linked contiguous legs for one requestor and choice.`);
    }
    const worstLeg = Math.max(...rows.map((row) => severityById.get(Number(row.Request_ID))));
    for (const row of rows) severityById.set(Number(row.Request_ID), worstLeg);
  }
  return new Map([...severityById].map(([id, severity]) => [id, STATUS_BY_SEVERITY[severity]]));
}

module.exports = { calculateContention };
