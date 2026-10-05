const { performance } = require('perf_hooks');
const { runAssignment } = require('../src/services/assignment');
const { HUTS } = require('../src/config');

async function benchmark(dense) {
  const people = new Map(); const rows = [];
  for (let i = 0; i < 90; i += 1) {
    const id = i + 1;
    people.set(id, { Requestor_ID: id, Credits: Math.floor(i / 18) / 10 + 1, Lottery_value: (i + 1) / 100, years_of_service: i % 10 });
    for (let choice = 1; choice <= (i < 30 ? 4 : 3); choice += 1) {
      const date = new Date(Date.UTC(2026, 11, 20 + (dense ? 0 : (i * 2 + choice * 7) % 90)));
      const arrival = date.toISOString().slice(0, 10); date.setUTCDate(date.getUTCDate() + 2);
      rows.push({ Request_ID: rows.length + 1, Requestor_ID: id, Choice_Number: choice,
        [HUTS[(choice - 1 + (dense ? 0 : i % 4)) % 4]]: true, Arrival: arrival, Departure: date.toISOString().slice(0, 10), Spots_min: 2, Spots_ideal: dense ? 4 : 3 + (i % 3) });
    }
  }
  if (process.argv.includes('--placeholders')) {
    for (let i = 0; i < 4; i++) {
      const id = 91 + i;
      people.set(id, { Requestor_ID: id, Is_placeholder: true, Credits: 999, Lottery_value: 0, years_of_service: 0 });
      rows.push({ Request_ID: rows.length + 1, Requestor_ID: id, Choice_Number: 1, [HUTS[i]]: true,
        Arrival: '2026-12-20', Departure: '2026-12-22', Spots_min: 2, Spots_ideal: 2 });
    }
  }
  const start = performance.now();
  const result = await runAssignment(rows, people, { regenerateLotteryNumbers: false });
  const phaseTotals = {};
  for (const phase of result.phases) { const kind = phase.name.split(':')[0]; phaseTotals[kind] = (phaseTotals[kind] || 0) + phase.elapsedMs; }
  console.log(JSON.stringify({ fixture: dense ? 'dense same-night conflict' : 'representative season', requestors: people.size, rows: rows.length,
    wallMs: Math.round(performance.now() - start), solverMs: Math.round(result.elapsedMs), personNights: result.personNights,
    countsByChoice: result.countsByChoice, placeholderBookings: result.placeholderBookings, phases: result.phases.length, phaseMs: Object.fromEntries(Object.entries(phaseTotals).map(([k, v]) => [k, Math.round(v)])) }));
}
async function main() { await benchmark(false); await benchmark(true); }
main().catch((error) => { console.error(error); process.exitCode = 1; });
