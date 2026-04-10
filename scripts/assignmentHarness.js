const { runAssignment } = require('../src/services/assignment');
const { HUTS } = require('../src/config');

function requestor(id, credits) {
  return { Requestor_ID: id, Credits: credits, Email: `user${id}@example.com` };
}

function requestRow({
  requestorId,
  huts,
  arrival,
  departure,
  choice,
  ideal,
  min,
}) {
  const row = {
    Requestor_ID: requestorId,
    Arrival: arrival,
    Departure: departure,
    Choice_Number: choice,
    Spots_ideal: ideal,
    Spots_min: min ?? ideal,
    Hut_granted: '',
    Spots_granted: 0,
    Status: 'requested',
    Confirmed_How: '',
    Creation_date: '',
    Last_mod_date: '',
  };
  for (const hut of HUTS) {
    row[hut] = huts.includes(hut);
  }
  return row;
}

function buildSample() {
  const requestors = new Map([
    [101, requestor(101, 3)],
    [102, requestor(102, 2)],
    [103, requestor(103, 2)],
    [104, requestor(104, 1)],
  ]);

  const requests = [
    requestRow({
      requestorId: 101,
      huts: ['Ludlow', 'Benson'],
      arrival: '2026-02-01',
      departure: '2026-02-03',
      choice: 1,
      ideal: 8,
      min: 6,
    }),
    requestRow({
      requestorId: 102,
      huts: ['Benson', 'Bradley', 'Grubb', 'Ludlow'],
      arrival: '2026-02-01',
      departure: '2026-02-03',
      choice: 1,
      ideal: 10,
      min: 8,
    }),
    requestRow({
      requestorId: 103,
      huts: ['Benson', 'Bradley'],
      arrival: '2026-02-01',
      departure: '2026-02-03',
      choice: 1,
      ideal: 6,
      min: 4,
    }),
    requestRow({
      requestorId: 104,
      huts: ['Grubb'],
      arrival: '2026-02-01',
      departure: '2026-02-02',
      choice: 2,
      ideal: 5,
      min: 4,
    }),
  ];

  return { requestors, requests };
}

function summarize(requests) {
  const rows = requests.map((r) => ({
    Requestor_ID: r.Requestor_ID,
    Choice_Number: r.Choice_Number,
    Huts: HUTS.filter((h) => r[h]).join(','),
    Arrival: r.Arrival,
    Departure: r.Departure,
    Spots_ideal: r.Spots_ideal,
    Spots_min: r.Spots_min,
    Status: r.Status,
    Hut_granted: r.Hut_granted || '-',
    Spots_granted: r.Spots_granted || 0,
  }));

  rows.sort((a, b) => a.Requestor_ID - b.Requestor_ID || a.Choice_Number - b.Choice_Number);
  return rows;
}

function run() {
  const { requestors, requests } = buildSample();
  const seed = process.argv[2];
  runAssignment(requests, requestors, { seed });
  console.table(summarize(requests));
}

run();
