const { HUTS, HUT_CAPACITY } = require('../config');
const { dateRangeNights, toIsoDate } = require('./dates');

function hutsForRequest(r) {
  return HUTS.filter((h) => Boolean(r[h]));
}

function validateRequest(input) {
  const huts = hutsForRequest(input);
  if (huts.length < 1) {
    return 'At least one hut must be selected.';
  }

  const arrival = toIsoDate(input.Arrival);
  const departure = toIsoDate(input.Departure);
  if (!arrival || !departure || new Date(departure) <= new Date(arrival)) {
    return 'Arrival and departure are required and departure must be after arrival.';
  }

  const ideal = Number(input.Spots_ideal);
  const min = Number(input.Spots_min ?? input.Spots_ideal);
  if (!Number.isInteger(ideal) || ideal < 1 || ideal > 15) {
    return 'Ideal spots must be an integer between 1 and 15.';
  }
  if (!Number.isInteger(min) || min < 1 || min > ideal) {
    return 'Minimum spots must be between 1 and ideal spots.';
  }

  if (!Number.isInteger(Number(input.Choice_Number)) || Number(input.Choice_Number) < 1) {
    return 'Choice number must be an integer >= 1.';
  }

  return null;
}

function summarizeByChoice(requests, choiceNumber, excludeRequestorId) {
  const choice = Number(choiceNumber);
  const excludeId = excludeRequestorId ? Number(excludeRequestorId) : null;
  const summary = {};

  for (const req of requests) {
    const huts = hutsForRequest(req);
    if (!huts.length) continue;
    const nights = dateRangeNights(req.Arrival, req.Departure);
    const splitIdeal = Number(req.Spots_ideal) / huts.length;
    const splitMin = Number(req.Spots_min || req.Spots_ideal) / huts.length;
    const isSame = Number(req.Choice_Number) === choice;
    const isHigher = Number(req.Choice_Number) < choice;
    const isExcluded = excludeId && Number(req.Requestor_ID) === excludeId;

    if (!isSame && !isHigher) continue;

    for (const date of nights) {
      for (const hut of huts) {
        const key = `${date}|${hut}`;
        if (!summary[key]) {
          summary[key] = {
            date,
            hut,
            capacity: HUT_CAPACITY[hut],
            higherPrioritySpots: 0,
            samePrioritySpots: 0,
            samePriorityGroups: new Set(),
          };
        }

        if (isHigher) {
          summary[key].higherPrioritySpots += splitIdeal;
        }

        if (isSame && !isExcluded) {
          summary[key].samePrioritySpots += splitMin;
          summary[key].samePriorityGroups.add(req.Requestor_ID);
        }
      }
    }
  }

  return Object.values(summary).map((row) => ({
    date: row.date,
    hut: row.hut,
    capacity: row.capacity,
    higherPrioritySpots: Number(row.higherPrioritySpots.toFixed(2)),
    samePrioritySpots: Number(row.samePrioritySpots.toFixed(2)),
    samePriorityGroups: row.samePriorityGroups.size,
  }));
}

module.exports = {
  validateRequest,
  summarizeByChoice,
  hutsForRequest,
};
