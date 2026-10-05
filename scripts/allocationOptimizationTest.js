const assert = require('assert');
const { solveAllocation } = require('../src/services/allocationSolver');
const { POLICY_VERSION, normalizeAllocation, validateAllocation, allocationOrderVector } = require('../src/services/allocationModel');
const { runAssignment } = require('../src/services/assignment');

const row = (id, choice = 1, minimum = 2, ideal = minimum, extra = {}) => ({ Request_ID: id * 100 + choice, Requestor_ID: id,
  Benson: true, Arrival: '2026-12-20', Departure: '2026-12-22', Choice_Number: choice, Spots_min: minimum, Spots_ideal: ideal, Status: 'requested', ...extra });
const people = (...credits) => new Map(credits.map((c, i) => [i + 1, { Requestor_ID: i + 1, Credits: c, Lottery_value: (i + 1) / 10, years_of_service: 0 }]));
function compare(a, b) { for (let i = 0; i < a.length; i += 1) { if (a[i] !== b[i]) return a[i] - b[i]; } return 0; }

// Exhaustive reference search: no MILP, solver constraints, or production
// validation are used to decide feasibility or choose the winning vector.
function oracle(model) {
  const requestors = [...model.requestors].sort((a, b) => b.years - a.years || a.lottery - b.lottery || a.id - b.id);
  const capacities = model.capacities;
  const chosen = [];
  let best = null;
  let bestVector = null;
  const occupied = {};
  function score() {
    const awards = new Map(chosen.map((a) => [model.options[a.optionId].requestorId, a]));
    const scores = model.levels.map((credit) => requestors.filter((p) => p.credits === credit).reduce((sum, p) => sum + (awards.has(p.id) ? model.options[awards.get(p.id).optionId].rank : 10), 0));
    const nights = chosen.reduce((sum, a) => sum + model.options[a.optionId].cells.length * a.guests, 0);
    return [...scores, -nights, ...requestors.map((p) => awards.has(p.id) ? model.options[awards.get(p.id).optionId].rank : 10),
      ...requestors.flatMap((p) => awards.has(p.id) ? [-awards.get(p.id).guests, awards.get(p.id).optionId] : [0, 0])];
  }
  function visit(index) {
    if (index === requestors.length) {
      const vector = score();
      if (!bestVector || compare(vector, bestVector) < 0) { bestVector = vector; best = chosen.map((a) => ({ ...a })); }
      return;
    }
    visit(index + 1);
    for (const o of model.options.filter((option) => option.requestorId === requestors[index].id)) {
      for (let guests = o.minimum; guests <= o.ideal; guests += 1) {
        if (o.cells.some((cell) => (occupied[cell] || 0) + guests > capacities[cell.split('|')[1]])) continue;
        o.cells.forEach((cell) => { occupied[cell] = (occupied[cell] || 0) + guests; });
        chosen.push({ optionId: o.id, guests }); visit(index + 1); chosen.pop();
        o.cells.forEach((cell) => { occupied[cell] -= guests; });
      }
    }
  }
  visit(0);
  return { allocation: best, vector: bestVector };
}
async function verify(rows, requestors, extra = {}) {
  const model = normalizeAllocation(rows, requestors, extra.capacities);
  const expected = oracle(model);
  const result = await solveAllocation(rows, requestors, extra);
  assert.deepEqual(allocationOrderVector(model, result.allocation), expected.vector);
  validateAllocation(model, result.allocation, result);
  return result;
}
async function main() {
  let result = await verify([row(1, 1, 4, 12), row(2, 1, 4)], people(3, 2));
  assert.deepEqual(result.allocation.map((a) => a.guests), [8, 4]);
  result = await verify([row(1, 1, 2, 12), row(2)], people(2, 2));
  assert.deepEqual(result.allocation.map((a) => a.guests), [10, 2]);
  result = await verify([row(1, 1, 4), row(2, 1, 9)], people(2, 2));
  assert.equal(result.allocation[0].optionId, 1, 'larger group wins equal choice outcomes');
  result = await verify([row(1), row(2), row(3, 1, 9)], people(2, 2, 2));
  assert.equal(result.allocation.length, 2);
  result = await verify([row(1, 1, 12), row(2)], people(1.5, 1.4));
  assert.deepEqual(result.scores, [{ credits: 1.5, score: 1 }, { credits: 1.4, score: 10 }]);
  const balanced = [row(1, 1, 12), ...[1, 2, 3, 4].map((id) => row(id, 2, 3, 3)),
    ...[2, 3, 4].map((id) => row(id, 1, 15, 15, { Benson: false, Bradley: true })), row(5, 1, 15, 15, { Benson: false, Bradley: true })];
  result = await verify(balanced, people(2, 2, 2, 2, 3));
  assert.equal(result.scores.find((s) => s.credits === 2).score, 8, 'four second choices beat a single first choice');
  result = await verify([row(1, 1, 12), row(1, 2, 12, 12, { Benson: false, Bradley: true }),
    row(2, 2, 12), row(2, 3, 12, 12, { Benson: false, Bradley: true })], people(2, 2));
  assert.equal(result.scores[0].score, 4, 'first plus third and two second choices tie');
  assert.deepEqual(result.countsByChoice, { 1: 1, 3: 1 }, 'final fairness resolves the tied allocation');
  for (const rank of [10, 11]) {
    result = await verify([row(1, rank)], people(2));
    assert.equal(result.allocation.length, rank === 10 ? 1 : 0);
  }
  result = await verify([row(1, 1, 12, 12, { Bradley: true }), row(2, 1, 12)], people(2, 2));
  assert.equal(result.allocation.length, 2, 'alternative hut preserves both awards');
  const traverse = [row(1, 2, 4, 4, { Request_ID: 101, Departure: '2026-12-21', Combination_first_request: 101 }),
    row(1, 2, 4, 4, { Request_ID: 102, Benson: false, Bradley: true, Arrival: '2026-12-21', Combination_first_request: 101 })];
  result = await verify(traverse, people(2));
  assert.equal(result.scores[0].score, 2);
  assert.equal(result.personNights, 8);
  result = await verify([...traverse, row(2, 1, 15, 15, { Benson: false, Bradley: true, Arrival: '2026-12-21' })], people(2, 3));
  assert.equal(result.allocation.length, 1);
  assert.throws(() => normalizeAllocation([{ ...traverse[0] }, { ...traverse[1], Spots_min: 3 }], people(2)), /combination/);
  const tiedPeople = people(2, 2);
  tiedPeople.get(1).Lottery_value = 0.9; tiedPeople.get(2).Lottery_value = 0.1;
  result = await verify([row(1, 1, 12), row(2, 1, 12)], tiedPeople);
  assert.equal(result.allocation[0].optionId, 1);
  tiedPeople.get(1).years_of_service = 10;
  result = await verify([row(1, 1, 12), row(2, 1, 12)], tiedPeople);
  assert.equal(result.allocation[0].optionId, 0);
  const flexPeople = people(2, 2);
  flexPeople.get(1).Lottery_value = 0.01;
  result = await verify([row(1, 1, 12, 12, { Bradley: true }), row(2, 1, 12), row(3, 1, 15, 15, { Benson: false, Bradley: true })], new Map([...flexPeople, [3, { Requestor_ID: 3, Credits: 3, Lottery_value: 0.5 }]]));
  assert(result.allocation.some((a) => a.optionId === 0), 'lower lottery wins regardless of broader hut options');
  assert.equal(result.policyVersion, POLICY_VERSION);
  flexPeople.get(2).years_of_service = 5;
  const blocked = row(3, 1, 15, 15, { Benson: false, Bradley: true });
  const fairnessPeople = new Map([...flexPeople, [3, { Requestor_ID: 3, Credits: 3, Lottery_value: 0.5 }]]);
  result = await verify([row(1, 1, 12, 12, { Bradley: true }), row(2, 1, 12), blocked], fairnessPeople);
  assert(result.allocation.some((a) => a.optionId === 2), 'service takes precedence over lottery and hut count');
  flexPeople.get(1).years_of_service = 6;
  result = await verify([row(1, 1, 12, 12, { Bradley: true }), row(2, 1, 12), blocked], fairnessPeople);
  assert(result.allocation.some((a) => a.optionId === 0), 'greater service favors the broader requestor too');
  flexPeople.get(1).years_of_service = 0; flexPeople.get(2).years_of_service = 0;
  const broadChoices = [row(1, 1, 2, 10, { Bradley: true }), row(2, 1, 2, 10), blocked];
  result = await verify(broadChoices, fairnessPeople);
  assert.equal(result.allocation.find((a) => a.optionId === 0).guests, 10, 'remaining guest ties ignore hut count');
  assert.equal(result.allocation.find((a) => a.optionId === 2).guests, 2);
  const beforeOrder = normalizeAllocation(broadChoices, fairnessPeople).requestors.map((p) => p.id);
  const withRestrictedLowerChoice = [...broadChoices, row(2, 2, 2)];
  assert.deepEqual(normalizeAllocation(withRestrictedLowerChoice, fairnessPeople).requestors.map((p) => p.id), beforeOrder, 'a restrictive lower choice cannot advance fairness order');
  flexPeople.get(2).Lottery_value = flexPeople.get(1).Lottery_value;
  result = await verify([row(1, 1, 12, 12, { Bradley: true }), row(2, 1, 12), blocked], fairnessPeople);
  assert(result.allocation.some((a) => a.optionId === 0), 'requestor ID resolves equal service and lottery');
  const priorityPeople = people(0, 100, 100);
  priorityPeople.get(1).Is_placeholder = true;
  result = await verify([row(1, 1, 4), row(2, 1, 4, 12), row(3, 1, 4)], priorityPeople);
  assert.equal(result.allocation.find((a) => a.optionId === 0).guests, 4, 'fixed placeholder wins ahead of ordinary credits');
  assert.equal(result.placeholderBookings, 1);
  assert.deepEqual(result.countsByChoice, { 1: 2 }, 'placeholder does not inflate volunteer choice statistics');
  assert.deepEqual(result.scores, [{ credits: 100, score: 2 }]);
  // Varied small overlapping fixtures exercise integer guests, ranks, credits,
  // multi-night occupancy and multi-hut options against complete enumeration.
  for (let seed = 0; seed < 12; seed += 1) {
    const rows = [1, 2, 3].flatMap((id) => [row(id, 1, 1 + ((seed + id) % 3), 3, { Bradley: (seed + id) % 2 === 0 }),
      row(id, 2, 1, 2, { Arrival: '2026-12-21', Departure: '2026-12-23', Benson: false, Bradley: true })]);
    await verify(rows, people(1.5, seed % 2 ? 1.4 : 1.5, 1.5), { capacities: { Benson: 4, Bradley: 4, Grubb: 15, Ludlow: 15 } });
  }
  const model = normalizeAllocation([row(1), row(2)], people(2, 2));
  assert.throws(() => validateAllocation(model, [{ optionId: 0, guests: 1.5 }]), /guest/);
  assert.throws(() => validateAllocation(model, [{ optionId: 0, guests: 2 }, { optionId: 0, guests: 2 }]), /choice/);
  assert.throws(() => validateAllocation(model, [], { scores: [], personNights: 1 }), /arithmetic/);
  await assert.rejects(() => solveAllocation([row(1)], people(2), {}, async () => ({ solve: () => ({ Status: 'Time limit reached' }) })), /did not prove completion/);
  const unchangedRows = [row(1)]; const unchangedPeople = people(2);
  const beforeRows = JSON.stringify(unchangedRows), beforePeople = JSON.stringify([...unchangedPeople]);
  await assert.rejects(() => runAssignment(unchangedRows, unchangedPeople, { timeoutMs: 1 }), /timed out/);
  assert.equal(JSON.stringify(unchangedRows), beforeRows); assert.equal(JSON.stringify([...unchangedPeople]), beforePeople);
  const repeat1 = [row(1, 1, 12), row(2, 1, 12)], repeat2 = structuredClone(repeat1);
  const r1 = await runAssignment(repeat1, people(2, 2), { seed: 'repeat' });
  const r2 = await runAssignment(repeat2, people(2, 2), { seed: 'repeat' });
  assert.deepEqual(r1.allocation, r2.allocation);
  const missingLottery = people(2, 2); missingLottery.get(1).Lottery_value = null; missingLottery.get(2).Lottery_value = 0;
  await runAssignment([row(1), row(2)], missingLottery, { seed: 'missing', regenerateLotteryNumbers: false });
  assert.notEqual(missingLottery.get(1).Lottery_value, null);
  assert.equal(missingLottery.get(2).Lottery_value, 0, 'zero is a valid preserved lottery value');
  console.log('Allocation optimization tests passed: exhaustive oracle, objectives, guest adjustment, traverses, fairness and incomplete-run safety.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
