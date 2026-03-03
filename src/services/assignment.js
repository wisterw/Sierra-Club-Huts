const { HUTS, HUT_CAPACITY } = require('../config');
const { dateRangeNights, closestSaturdayWeekKey } = require('./dates');
const { hutsForRequest } = require('./requestLogic');

function requestDifficultyScore(req) {
  const nights = dateRangeNights(req.Arrival, req.Departure).length;
  const huts = hutsForRequest(req).length;
  return {
    nights,
    spots: Number(req.Spots_ideal),
    huts,
  };
}

function buildOccupancy(requests) {
  const occ = {};
  for (const req of requests) {
    if (req.Status !== 'confirmed' || !req.Hut_granted) continue;
    for (const night of dateRangeNights(req.Arrival, req.Departure)) {
      const key = `${night}|${req.Hut_granted}`;
      occ[key] = (occ[key] || 0) + Number(req.Spots_granted || 0);
    }
  }
  return occ;
}

function fitScore(req, hut, occupancy) {
  const nights = dateRangeNights(req.Arrival, req.Departure);
  const spots = Number(req.Spots_min || req.Spots_ideal);
  let minRemaining = Infinity;

  for (const night of nights) {
    const key = `${night}|${hut}`;
    const used = occupancy[key] || 0;
    const remaining = HUT_CAPACITY[hut] - used - spots;
    if (remaining < minRemaining) {
      minRemaining = remaining;
    }
  }

  return minRemaining;
}

function commitAssignment(req, hut, occupancy) {
  const grant = Number(req.Spots_ideal);
  for (const night of dateRangeNights(req.Arrival, req.Departure)) {
    const key = `${night}|${hut}`;
    occupancy[key] = (occupancy[key] || 0) + grant;
  }
  req.Hut_granted = hut;
  req.Spots_granted = grant;
  req.Status = 'confirmed';
  req.Confirmed_How = 'won-lottery';
  req.Last_mod_date = new Date().toISOString();
}

function runAssignment(requests, requestorsById) {
  for (const req of requests) {
    if (!req.Status || req.Status === 'pending') {
      req.Status = 'pending';
      req.Hut_granted = '';
      req.Spots_granted = 0;
      req.Confirmed_How = '';
    }
  }

  const pending = requests.filter((r) => r.Status === 'pending');
  const occupancy = buildOccupancy(requests);

  const byChoice = new Map();
  for (const req of pending) {
    const c = Number(req.Choice_Number);
    if (!byChoice.has(c)) byChoice.set(c, []);
    byChoice.get(c).push(req);
  }

  const sortedChoices = [...byChoice.keys()].sort((a, b) => a - b);

  for (const choice of sortedChoices) {
    const reqs = byChoice.get(choice);
    const byWeek = new Map();

    for (const req of reqs) {
      const w = closestSaturdayWeekKey(req.Arrival, req.Departure);
      if (!byWeek.has(w)) byWeek.set(w, []);
      byWeek.get(w).push(req);
    }

    for (const week of byWeek.keys()) {
      const block = byWeek.get(week);
      block.sort((a, b) => {
        const ra = requestorsById.get(Number(a.Requestor_ID));
        const rb = requestorsById.get(Number(b.Requestor_ID));
        const ca = Number(ra?.Credits || 0);
        const cb = Number(rb?.Credits || 0);
        if (cb !== ca) return cb - ca;

        const da = requestDifficultyScore(a);
        const db = requestDifficultyScore(b);
        if (db.huts !== da.huts) return da.huts - db.huts;
        if (db.nights !== da.nights) return db.nights - da.nights;
        if (db.spots !== da.spots) return db.spots - da.spots;

        return Number(a.Requestor_ID) - Number(b.Requestor_ID);
      });

      for (const req of block) {
        const huts = hutsForRequest(req);
        let bestHut = null;
        let bestScore = -Infinity;

        for (const hut of huts) {
          const score = fitScore(req, hut, occupancy);
          if (score > bestScore) {
            bestScore = score;
            bestHut = hut;
          }
        }

        if (bestHut && bestScore >= 0) {
          commitAssignment(req, bestHut, occupancy);
        } else {
          req.Status = 'lost-lottery';
          req.Last_mod_date = new Date().toISOString();
        }
      }
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
    if (req.Status !== 'confirmed') continue;
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
      Name: requestor?.Name || '',
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
