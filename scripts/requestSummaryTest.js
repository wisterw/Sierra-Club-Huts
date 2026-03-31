const { summarizeByChoice } = require('../src/services/requestLogic');

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} expected ${expected}, got ${actual}`);
  }
}

function rowKey(row) {
  return `${row.date}|${row.hut}`;
}

function getRow(rows, date, hut) {
  return rows.find((r) => r.date === date && r.hut === hut);
}

function run() {
  const requestorsById = new Map([
    [1, { Requestor_ID: 1, Credits: 2 }],
    [2, { Requestor_ID: 2, Credits: 2 }],
    [3, { Requestor_ID: 3, Credits: 3 }],
    [4, { Requestor_ID: 4, Credits: 1 }],
    [5, { Requestor_ID: 5, Credits: 2 }],
    [6, { Requestor_ID: 6, Credits: 2 }],
  ]);

  const requests = [
    // Target requestor (excluded from same-priority counts)
    {
      Requestor_ID: 1,
      Benson: true,
      Bradley: true,
      Grubb: false,
      Ludlow: false,
      Arrival: '2026-02-01',
      Departure: '2026-02-02',
      Choice_Number: 2,
      Spots_ideal: 4,
      Spots_min: 2,
    },
    // Same credits, higher-priority (choice 1)
    {
      Requestor_ID: 2,
      Benson: false,
      Bradley: false,
      Grubb: true,
      Ludlow: false,
      Arrival: '2026-02-01',
      Departure: '2026-02-02',
      Choice_Number: 1,
      Spots_ideal: 6,
      Spots_min: 4,
    },
    // Same credits, same choice (choice 2)
    {
      Requestor_ID: 2,
      Benson: true,
      Bradley: true,
      Grubb: false,
      Ludlow: false,
      Arrival: '2026-02-01',
      Departure: '2026-02-02',
      Choice_Number: 2,
      Spots_ideal: 4,
      Spots_min: 2,
    },
    // Higher credits, first choice only
    {
      Requestor_ID: 3,
      Benson: true,
      Bradley: true,
      Grubb: false,
      Ludlow: false,
      Arrival: '2026-02-01',
      Departure: '2026-02-02',
      Choice_Number: 1,
      Spots_ideal: 3,
      Spots_min: 2,
    },
    // Higher credits, non-first choice should not count
    {
      Requestor_ID: 3,
      Benson: true,
      Bradley: false,
      Grubb: false,
      Ludlow: false,
      Arrival: '2026-02-01',
      Departure: '2026-02-02',
      Choice_Number: 2,
      Spots_ideal: 5,
      Spots_min: 3,
    },
    // Lower credits should not affect counts
    {
      Requestor_ID: 4,
      Benson: true,
      Bradley: false,
      Grubb: false,
      Ludlow: false,
      Arrival: '2026-02-01',
      Departure: '2026-02-02',
      Choice_Number: 1,
      Spots_ideal: 2,
      Spots_min: 2,
    },
    // Multi-night same-credits higher-priority (choice 1), single hut
    {
      Requestor_ID: 5,
      Benson: true,
      Bradley: false,
      Grubb: false,
      Ludlow: false,
      Arrival: '2026-02-03',
      Departure: '2026-02-05',
      Choice_Number: 1,
      Spots_ideal: 4,
      Spots_min: 3,
    },
    // Combination trip (Benson then Bradley) same credits, same choice
    {
      Requestor_ID: 6,
      Benson: true,
      Bradley: false,
      Grubb: false,
      Ludlow: false,
      Arrival: '2026-02-06',
      Departure: '2026-02-07',
      Choice_Number: 2,
      Spots_ideal: 4,
      Spots_min: 2,
    },
    {
      Requestor_ID: 6,
      Benson: false,
      Bradley: true,
      Grubb: false,
      Ludlow: false,
      Arrival: '2026-02-07',
      Departure: '2026-02-08',
      Choice_Number: 2,
      Spots_ideal: 4,
      Spots_min: 2,
    },
  ];

  const rows = summarizeByChoice(requests, 2, 1, requestorsById);
  const byKey = new Map(rows.map((r) => [rowKey(r), r]));

  const benson = getRow(rows, '2026-02-01', 'Benson');
  const bradley = getRow(rows, '2026-02-01', 'Bradley');
  const grubb = getRow(rows, '2026-02-01', 'Grubb');
  const bensonFeb03 = getRow(rows, '2026-02-03', 'Benson');
  const bensonFeb04 = getRow(rows, '2026-02-04', 'Benson');
  const bensonFeb06 = getRow(rows, '2026-02-06', 'Benson');
  const bradleyFeb07 = getRow(rows, '2026-02-07', 'Bradley');

  if (!benson || !bradley || !grubb || !bensonFeb03 || !bensonFeb04 || !bensonFeb06 || !bradleyFeb07) {
    throw new Error('Missing expected rows for 2026-02-01.');
  }

  // Benson + Bradley: higher-priority from higher-credits first choice (3 split over 2 huts = 1.5)
  // Same-priority from same-credits choice 2 (min 2 split over 2 huts = 1.0)
  assertEqual(benson.higherPrioritySpots, 1.5, 'Benson higherPrioritySpots');
  assertEqual(benson.samePrioritySpots, 1.0, 'Benson samePrioritySpots');
  assertEqual(benson.samePriorityGroups, 1, 'Benson samePriorityGroups');

  assertEqual(bradley.higherPrioritySpots, 1.5, 'Bradley higherPrioritySpots');
  assertEqual(bradley.samePrioritySpots, 1.0, 'Bradley samePrioritySpots');
  assertEqual(bradley.samePriorityGroups, 1, 'Bradley samePriorityGroups');

  // Grubb: higher-priority from same-credits choice 1 (ideal 6 split over 1 hut = 6)
  assertEqual(grubb.higherPrioritySpots, 6.0, 'Grubb higherPrioritySpots');
  assertEqual(grubb.samePrioritySpots, 0.0, 'Grubb samePrioritySpots');
  assertEqual(grubb.samePriorityGroups, 0, 'Grubb samePriorityGroups');

  // Multi-night higher-priority on Benson (same credits, choice 1) for 2 nights
  assertEqual(bensonFeb03.higherPrioritySpots, 4.0, 'Benson Feb 3 higherPrioritySpots');
  assertEqual(bensonFeb04.higherPrioritySpots, 4.0, 'Benson Feb 4 higherPrioritySpots');
  assertEqual(bensonFeb03.samePrioritySpots, 0.0, 'Benson Feb 3 samePrioritySpots');
  assertEqual(bensonFeb04.samePrioritySpots, 0.0, 'Benson Feb 4 samePrioritySpots');

  // Combination trip same choice, same credits => same-priority spots on both huts
  assertEqual(bensonFeb06.samePrioritySpots, 2.0, 'Benson Feb 6 samePrioritySpots');
  assertEqual(bensonFeb06.samePriorityGroups, 1, 'Benson Feb 6 samePriorityGroups');
  assertEqual(bradleyFeb07.samePrioritySpots, 2.0, 'Bradley Feb 7 samePrioritySpots');
  assertEqual(bradleyFeb07.samePriorityGroups, 1, 'Bradley Feb 7 samePriorityGroups');

  // Sanity: no unexpected rows for different date
  if (byKey.has('2026-02-02|Benson')) {
    throw new Error('Unexpected row for 2026-02-02.');
  }

  console.log('requestSummary test passed.');
}

run();
