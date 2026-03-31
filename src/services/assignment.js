const { HUTS, HUT_CAPACITY } = require('../config');
const { dateRangeNights, closestSaturdayWeekKey } = require('./dates');
const { hutsForRequest } = require('./requestLogic');

const HUT_TIEBREAK_ORDER = ['Ludlow', 'Benson', 'Bradley', 'Grubb'];
const STATUS_GRANTED = new Set(['granted', 'confirmed']);
const STATUS_REQUESTED = new Set(['requested', 'pending']);

function isGranted(req) {
  return STATUS_GRANTED.has(req.Status);
}

function normalizeStatus(req) {
  if (!req.Status || STATUS_REQUESTED.has(req.Status)) {
    req.Status = 'requested';
  }
}

function buildOccupancy(requests) {
  const occ = {};
  for (const req of requests) {
    if (!isGranted(req) || !req.Hut_granted) continue;
    for (const night of dateRangeNights(req.Arrival, req.Departure)) {
      const key = `${night}|${req.Hut_granted}`;
      occ[key] = (occ[key] || 0) + Number(req.Spots_granted || 0);
    }
  }
  return occ;
}

function adjustOccupancy(occupancy, req, delta) {
  if (!req.Hut_granted) return;
  for (const night of dateRangeNights(req.Arrival, req.Departure)) {
    const key = `${night}|${req.Hut_granted}`;
    occupancy[key] = (occupancy[key] || 0) + delta;
  }
}

function availableMinRemaining(hut, nights, occupancy) {
  let minRemaining = Infinity;
  for (const night of nights) {
    const key = `${night}|${hut}`;
    const used = occupancy[key] || 0;
    const remaining = HUT_CAPACITY[hut] - used;
    if (remaining < minRemaining) minRemaining = remaining;
  }
  return minRemaining;
}

function chooseBestHut(huts, nights, occupancy, spotsNeeded) {
  let bestHut = null;
  let bestRemaining = -Infinity;

  for (const hut of huts) {
    const minRemaining = availableMinRemaining(hut, nights, occupancy);
    if (minRemaining < spotsNeeded) continue;
    if (minRemaining > bestRemaining) {
      bestRemaining = minRemaining;
      bestHut = hut;
    } else if (minRemaining === bestRemaining && bestHut) {
      const order = new Map(HUT_TIEBREAK_ORDER.map((h, idx) => [h, idx]));
      if ((order.get(hut) ?? 99) < (order.get(bestHut) ?? 99)) {
        bestHut = hut;
      }
    }
  }

  return bestHut;
}

function commitAssignment(req, hut, occupancy) {
  const grant = Number(req.Spots_granted || 0);
  req.Hut_granted = hut;
  req.Status = 'granted';
  req.Confirmed_How = 'won-lottery';
  req.Last_mod_date = new Date().toISOString();
  adjustOccupancy(occupancy, req, grant);
}

function markLowerChoicesNotNeeded(requests, requestorId, choiceNumber) {
  const now = new Date().toISOString();
  for (const r of requests) {
    if (Number(r.Requestor_ID) !== Number(requestorId)) continue;
    if (Number(r.Choice_Number) > Number(choiceNumber)) {
      r.Status = 'not-needed';
      r.Last_mod_date = now;
    }
  }
}

function overlapAny(nightsSet, req) {
  for (const night of dateRangeNights(req.Arrival, req.Departure)) {
    if (nightsSet.has(night)) return true;
  }
  return false;
}

function maxPotentialRemaining(hut, nights, requests, excludeReq) {
  let minRemaining = Infinity;
  for (const night of nights) {
    let usedMin = 0;
    for (const r of requests) {
      if (r === excludeReq) continue;
      if (!isGranted(r)) continue;
      if (r.Hut_granted !== hut) continue;
      if (!overlapAny(new Set([night]), r)) continue;
      const minSpots = Number(r.Spots_min || r.Spots_ideal || 0);
      usedMin += minSpots;
    }
    const remaining = HUT_CAPACITY[hut] - usedMin;
    if (remaining < minRemaining) minRemaining = remaining;
  }
  return minRemaining;
}

function reduceOthersUntilFit(req, hut, nights, occupancy, requests) {
  const nightsSet = new Set(nights);
  const candidates = requests.filter((r) => (
    r !== req
    && isGranted(r)
    && r.Hut_granted === hut
    && overlapAny(nightsSet, r)
  ));

  const minSpots = Number(req.Spots_min || req.Spots_ideal || 0);
  const fitsNow = () => availableMinRemaining(hut, nights, occupancy) >= minSpots;

  let progress = true;
  while (!fitsNow() && progress) {
    progress = false;
    const shuffled = candidates.slice().sort(() => Math.random() - 0.5);
    for (const other of shuffled) {
      const otherMin = Number(other.Spots_min || other.Spots_ideal || 0);
      if (Number(other.Spots_granted || 0) <= otherMin) continue;
      other.Spots_granted = Number(other.Spots_granted || 0) - 1;
      adjustOccupancy(occupancy, other, -1);
      progress = true;
      if (fitsNow()) break;
    }
  }

  return fitsNow();
}

function processRequest(req, requests, occupancy) {
  const huts = hutsForRequest(req);
  if (!huts.length) {
    req.Status = 'lost-lottery';
    req.Last_mod_date = new Date().toISOString();
    return;
  }

  const nights = dateRangeNights(req.Arrival, req.Departure);
  const minSpots = Number(req.Spots_min || req.Spots_ideal || 0);
  const idealSpots = Number(req.Spots_ideal || 0);

  for (let spots = idealSpots; spots >= minSpots; spots -= 1) {
    req.Spots_granted = spots;
    const bestHut = chooseBestHut(huts, nights, occupancy, spots);
    if (bestHut) {
      commitAssignment(req, bestHut, occupancy);
      markLowerChoicesNotNeeded(requests, req.Requestor_ID, req.Choice_Number);
      return;
    }
  }

  req.Spots_granted = minSpots;

  const potential = huts
    .map((hut) => ({
      hut,
      potential: maxPotentialRemaining(hut, nights, requests, req),
    }))
    .filter((row) => row.potential >= minSpots);

  if (!potential.length) {
    req.Status = 'lost-lottery';
    req.Last_mod_date = new Date().toISOString();
    return;
  }

  potential.sort((a, b) => {
    if (b.potential !== a.potential) return b.potential - a.potential;
    return HUT_TIEBREAK_ORDER.indexOf(a.hut) - HUT_TIEBREAK_ORDER.indexOf(b.hut);
  });

  const targetHut = potential[0].hut;
  const success = reduceOthersUntilFit(req, targetHut, nights, occupancy, requests);
  if (!success) {
    req.Status = 'lost-lottery';
    req.Last_mod_date = new Date().toISOString();
    return;
  }

  commitAssignment(req, targetHut, occupancy);
  markLowerChoicesNotNeeded(requests, req.Requestor_ID, req.Choice_Number);
}

function runAssignment(requests, requestorsById) {
  const now = new Date().toISOString();
  for (const req of requests) {
    normalizeStatus(req);
    req.Status = 'requested';
    req.Hut_granted = '';
    req.Spots_granted = Number(req.Spots_ideal || 0);
    req.Confirmed_How = '';
    req.Last_mod_date = now;
  }

  const occupancy = buildOccupancy(requests);
  const groups = new Map();

  for (const req of requests) {
    if (req.Status === 'not-needed') continue;
    const credits = Number(requestorsById.get(Number(req.Requestor_ID))?.Credits || 0);
    const choice = Number(req.Choice_Number || 0);
    const week = closestSaturdayWeekKey(req.Arrival, req.Departure);
    const flex = hutsForRequest(req).length;
    const key = `${credits}|${choice}|${week}|${flex}`;
    if (!groups.has(key)) {
      groups.set(key, {
        credits,
        choice,
        week,
        flex,
        requests: [],
      });
    }
    groups.get(key).requests.push(req);
  }

  const orderedGroups = [...groups.values()].sort((a, b) => {
    if (b.credits !== a.credits) return b.credits - a.credits;
    if (a.choice !== b.choice) return a.choice - b.choice;
    if (a.week !== b.week) return a.week.localeCompare(b.week);
    if (b.flex !== a.flex) return b.flex - a.flex;
    return 0;
  });

  for (const group of orderedGroups) {
    const shuffled = group.requests
      .map((req) => ({ req, lottery: Math.random() }))
      .sort((a, b) => a.lottery - b.lottery)
      .map((entry) => entry.req);

    for (const req of shuffled) {
      if (req.Status === 'not-needed') continue;
      processRequest(req, requests, occupancy);
    }
  }
}

function efficiencyReport(requests) {
  const byRequestor = new Map();
  for (const req of requests) {
    if (!byRequestor.has(req.Requestor_ID)) {
      byRequestor.set(req.Requestor_ID, []);
    }
    byRequestor.get(req.Requestor_ID).push(req);
  }

  const groups = byRequestor.size || 1;
  const totalSpots = requests.reduce((sum, r) => sum + Number(r.Spots_ideal || 0), 0) || 1;

  const byChoice = new Map();
  for (const req of requests) {
    if (!isGranted(req)) continue;
    const c = Number(req.Choice_Number);
    if (!byChoice.has(c)) byChoice.set(c, { groups: new Set(), spots: 0 });
    byChoice.get(c).groups.add(req.Requestor_ID);
    byChoice.get(c).spots += Number(req.Spots_granted || 0);
  }

  return [...byChoice.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([choice, v]) => ({
      choice,
      groupsPercent: Number(((v.groups.size / groups) * 100).toFixed(2)),
      spotsPercent: Number(((v.spots / totalSpots) * 100).toFixed(2)),
    }));
}

function requestsJoinedReport(requests, requestorsById) {
  const out = requests.map((req) => {
    const requestor = requestorsById.get(Number(req.Requestor_ID));
    const hutsCount = HUTS.filter((h) => req[h]).length;
    const nights = dateRangeNights(req.Arrival, req.Departure).length;
    return {
      ...req,
      Email: requestor?.Email || '',
      first_name: requestor?.first_name || '',
      last_name: requestor?.last_name || '',
      Credits: Number(requestor?.Credits || 0),
      Week_Key: closestSaturdayWeekKey(req.Arrival, req.Departure),
      Nights: nights,
      Huts_Marked: hutsCount,
    };
  });

  out.sort((a, b) => {
    if (a.Choice_Number !== b.Choice_Number) return a.Choice_Number - b.Choice_Number;
    if (a.Week_Key !== b.Week_Key) return a.Week_Key.localeCompare(b.Week_Key);
    if (a.Credits !== b.Credits) return b.Credits - a.Credits;
    if (a.Nights !== b.Nights) return b.Nights - a.Nights;
    if (a.Spots_ideal !== b.Spots_ideal) return b.Spots_ideal - a.Spots_ideal;
    if (a.Huts_Marked !== b.Huts_Marked) return a.Huts_Marked - b.Huts_Marked;
    return a.Requestor_ID - b.Requestor_ID;
  });

  return out;
}

module.exports = {
  runAssignment,
  efficiencyReport,
  requestsJoinedReport,
};
