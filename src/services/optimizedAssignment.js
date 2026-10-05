const { normalizeAllocation, validateAllocation } = require('./allocationModel');
const { optimizeInWorker } = require('./allocationExecution');
const { hutsForRequest } = require('./requestLogic');
const { closestSaturdayWeekKey } = require('./dates');

async function runAssignment(requests, requestorsById, options = {}) {
  // Prospective changes stay local until every solve phase and validation pass.
  const people = new Map([...requestorsById].sort(([a], [b]) => Number(a) - Number(b)).map(([id, p]) => [Number(id), { ...p }]));
  const changed = require('./assignment').assignLotteryValues(people, { seed: options.seed, regenerate: options.regenerateLotteryNumbers !== false });
  const model = normalizeAllocation(requests, people, options.capacities);
  const result = await optimizeInWorker(requests, people, options);
  if (result.status !== 'Optimal') throw new Error('Allocation was not proven optimal.');
  const measured = validateAllocation(model, result.allocation, result);
  const granted = new Map();
  const served = new Map();
  for (const a of result.allocation) {
    const o = model.options[a.optionId];
    served.set(o.requestorId, o.rank);
    o.rows.forEach((index, leg) => granted.set(index, { guests: a.guests, hut: o.huts[leg], rank: o.rank }));
  }
  const now = new Date().toISOString();
  const updates = requests.map((r, index) => {
    const award = granted.get(index);
    const selectedRank = served.get(Number(r.Requestor_ID));
    let audit;
    if (award) audit = `Granted choice ${award.rank}: ${award.guests} spot(s) at ${award.hut}. Optimized credit-level choice scores, then person-nights.${award.guests < Number(r.Spots_ideal) ? ` Reduced from ideal ${r.Spots_ideal}, within minimum ${r.Spots_min ?? r.Spots_ideal}, to achieve the optimized allocation.` : ''}`;
    else if (selectedRank !== undefined) audit = `Not used because choice ${selectedRank} was granted by the global allocation optimizer.`;
    else audit = 'No choice selected in the optimal credit-level choice-score and person-night allocation.';
    return { ...r, Status: award ? 'granted' : selectedRank !== undefined ? 'not-used' : 'lost-lottery',
      Hut_granted: award?.hut || '', Spots_granted: award?.guests || 0,
      Lottery_value: people.get(Number(r.Requestor_ID)).Lottery_value,
      Assignment_audit: audit, Confirmed_How: audit, Last_mod_date: now,
      hut_count_flexibility: hutsForRequest(r).length, saturday_week_number: closestSaturdayWeekKey(r.Arrival, r.Departure) };
  });
  updates.forEach((r, i) => Object.assign(requests[i], r));
  for (const p of changed) Object.assign(requestorsById.get(p.Requestor_ID), p);
  return { ...result, ...measured, requestorsToPersist: changed };
}
module.exports = { runAssignment };
