const { performance } = require('perf_hooks');
const { normalizeAllocation, validateAllocation, POLICY_VERSION } = require('./allocationModel');
let runtimePromise;

function expression(terms) {
  const nonzero = terms.filter(([, c]) => c !== 0);
  return nonzero.length ? nonzero.map(([v, c]) => `${c >= 0 ? '+' : '-'} ${Math.abs(c)} ${v}`).join(' ') : '0 dummy';
}
async function solveAllocation(requests, people, options = {}, solverFactory = null) {
  const start = performance.now();
  const model = normalizeAllocation(requests, people, options.capacities);
  if (!model.options.length) return { allocation: [], ...validateAllocation(model, []), policyVersion: POLICY_VERSION, status: 'Optimal', elapsedMs: performance.now() - start, phases: [] };
  const highs = await (solverFactory ? solverFactory() : (runtimePromise ||= require('highs')()));
  const constraints = [];
  for (const p of model.requestors) constraints.push(`${expression(model.options.filter((o) => o.requestorId === p.id).map((o) => [`x${o.id}`, 1]))} <= 1`);
  const cells = new Map();
  for (const o of model.options) {
    constraints.push(`g${o.id} - ${o.minimum} x${o.id} >= 0`, `g${o.id} - ${o.ideal} x${o.id} <= 0`);
    for (const cell of o.cells) { if (!cells.has(cell)) cells.set(cell, []); cells.get(cell).push([`g${o.id}`, 1]); }
  }
  for (const [cell, terms] of cells) constraints.push(`${expression(terms)} <= ${model.capacities[cell.split('|')[1]]}`);
  const fixes = [];
  const phases = [];
  const objectives = [];
  let result;
  const budget = options.timeoutMs ?? 30000;
  function stage(name, terms, maximize = false) {
    if (!terms.some(([, c]) => c !== 0)) return;
    const remaining = budget - (performance.now() - start);
    if (remaining <= 0) throw new Error('Allocation optimization timed out before proving completion.');
    const phaseStart = performance.now();
    const lp = `${maximize ? 'Maximize' : 'Minimize'}\n obj: ${expression(terms)}\nSubject To\n${[...constraints, ...fixes].map((c, i) => ` c${i}: ${c}`).join('\n')}\nBounds\n dummy = 0\n${model.options.map((o) => ` 0 <= g${o.id} <= ${o.ideal}`).join('\n')}\nGenerals\n ${model.options.map((o) => `g${o.id}`).join(' ')}\nBinaries\n ${model.options.map((o) => `x${o.id}`).join(' ')}\nEnd`;
    result = highs.solve(lp, { output_flag: false, time_limit: remaining / 1000, mip_rel_gap: 0, mip_abs_gap: 0, random_seed: 0 });
    if (result.Status !== 'Optimal') throw new Error(`Allocation optimization did not prove completion: ${result.Status} (${name}).`);
    const value = Math.round(result.ObjectiveValue);
    if (!Number.isSafeInteger(value) || Math.abs(result.ObjectiveValue - value) > 1e-6) throw new Error('Non-integer allocation objective.');
    fixes.push(`${expression(terms)} = ${value}`);
    objectives.push({ terms, value });
    phases.push({ name, elapsedMs: performance.now() - phaseStart, value });
  }
  for (const level of model.levels) {
    const ids = new Set(model.requestors.filter((p) => p.credits === level).map((p) => p.id));
    stage(`credit:${level}`, model.options.filter((o) => ids.has(o.requestorId)).map((o) => [`x${o.id}`, o.rank - 10]));
  }
  stage('person-nights', model.options.map((o) => [`g${o.id}`, o.nights]), true);
  for (const p of model.requestors) stage(`fairness:${p.id}`, model.options.filter((o) => o.requestorId === p.id).map((o) => [`x${o.id}`, o.rank - 10]));
  for (const p of model.requestors) {
    const own = model.options.filter((o) => o.requestorId === p.id);
    stage(`guests:${p.id}`, own.map((o) => [`g${o.id}`, 1]), true);
    stage(`hut:${p.id}`, own.map((o) => [`x${o.id}`, o.id]));
  }
  const allocation = [];
  for (const o of model.options) {
    const selected = result.Columns[`x${o.id}`].Primal;
    const guests = result.Columns[`g${o.id}`].Primal;
    if (!Number.isFinite(selected) || !Number.isFinite(guests) || ![0, 1].includes(Math.round(selected)) ||
      Math.abs(selected - Math.round(selected)) > 1e-6 || Math.abs(guests - Math.round(guests)) > 1e-6) throw new Error('Solver returned fractional or invalid guests or choices.');
    if (Math.round(selected)) allocation.push({ optionId: o.id, guests: Math.round(guests) });
    else if (Math.round(guests) !== 0) throw new Error('Solver assigned guests to an unselected choice.');
  }
  for (const objective of objectives) {
    const actual = objective.terms.reduce((sum, [variable, coefficient]) => sum + coefficient * Math.round(result.Columns[variable].Primal), 0);
    if (actual !== objective.value) throw new Error('Solver did not preserve a previously optimized objective.');
  }
  return { allocation, ...validateAllocation(model, allocation), policyVersion: POLICY_VERSION, status: 'Optimal', elapsedMs: performance.now() - start, phases };
}
module.exports = { solveAllocation };
