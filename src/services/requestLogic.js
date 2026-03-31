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
  const arrivalDate = new Date(arrival);
  const departureDate = new Date(departure);
  const maxTripMs = 1000 * 60 * 60 * 24 * 5;
  if (departureDate.getTime() - arrivalDate.getTime() > maxTripMs) {
    return 'Trip length must be 5 days or fewer.';
  }
  const seasonStart = new Date(Date.UTC(arrivalDate.getUTCFullYear(), 11, 15));
  const seasonEnd = new Date(Date.UTC(arrivalDate.getUTCFullYear() + 1, 3, 30, 23, 59, 59, 999));
  if (arrivalDate < seasonStart || departureDate > seasonEnd) {
    return 'Arrival and departure must be between Dec 15 and Apr 30 of the current season.';
  }

  const ideal = Number(input.Spots_ideal);
  const min = Number(input.Spots_min ?? input.Spots_ideal);
  if (!Number.isInteger(ideal) || ideal < 1 || ideal > 15) {
    return 'Ideal spots must be an integer between 1 and 15.';
  }
  const maxCapacityForSelectedHuts = Math.min(...huts.map((hut) => HUT_CAPACITY[hut]));
  if (ideal > maxCapacityForSelectedHuts) {
    return `Ideal spots exceeds hut capacity (${maxCapacityForSelectedHuts}) for selected hut(s).`;
  }
  if (!Number.isInteger(min) || min < 1 || min > ideal) {
    return 'Minimum spots must be between 1 and ideal spots.';
  }

  if (!Number.isInteger(Number(input.Choice_Number)) || Number(input.Choice_Number) < 1) {
    return 'Choice number must be an integer >= 1.';
  }

  return null;
}

function summarizeByChoice(requests, choiceNumber, excludeRequestorId, requestorsById = new Map()) {
  const choice = Number(choiceNumber);
  const excludeId = excludeRequestorId ? Number(excludeRequestorId) : null;
  const summary = {};
  const getCredits = (id) => {
    if (!requestorsById) return 0;
    if (typeof requestorsById.get === 'function') {
      return Number(requestorsById.get(Number(id))?.Credits || 0);
    }
    return Number(requestorsById[Number(id)]?.Credits || 0);
  };
  const baseCredits = excludeId ? getCredits(excludeId) : 0;

  for (const req of requests) {
    const huts = hutsForRequest(req);
    if (!huts.length) continue;
    const nights = dateRangeNights(req.Arrival, req.Departure);
    const splitIdeal = Number(req.Spots_ideal) / huts.length;
    const splitMin = Number(req.Spots_min || req.Spots_ideal) / huts.length;
    const reqCredits = getCredits(req.Requestor_ID);
    const isSameChoice = Number(req.Choice_Number) === choice;
    const isHigherSameCredits = reqCredits === baseCredits && Number(req.Choice_Number) < choice;
    const isHigherCreditsFirstChoice = reqCredits > baseCredits && Number(req.Choice_Number) === 1;
    const isSameChoiceSameCredits = isSameChoice && reqCredits === baseCredits;
    const isExcluded = excludeId && Number(req.Requestor_ID) === excludeId;

    if (!isSameChoiceSameCredits && !isHigherSameCredits && !isHigherCreditsFirstChoice) continue;

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

        if (isHigherSameCredits || isHigherCreditsFirstChoice) {
          summary[key].higherPrioritySpots += splitIdeal;
        }

        if (isSameChoiceSameCredits && !isExcluded) {
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
    higherPrioritySpots: Number(row.higherPrioritySpots.toFixed(1)),
    samePrioritySpots: Number(row.samePrioritySpots.toFixed(1)),
    samePriorityGroups: row.samePriorityGroups.size,
  }));
}

module.exports = {
  validateRequest,
  summarizeByChoice,
  hutsForRequest,
};
