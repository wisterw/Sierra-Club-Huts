function toIsoDate(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d.toISOString().slice(0, 10);
}

function dateRangeNights(arrival, departure) {
  const start = new Date(arrival);
  const end = new Date(departure);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return [];
  }

  const out = [];
  const cur = new Date(start);
  while (cur < end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function closestSaturdayWeekKey(arrival, departure) {
  const start = new Date(arrival);
  const end = new Date(departure);
  const mid = new Date((start.getTime() + end.getTime()) / 2);
  const day = mid.getUTCDay();
  const offsetToSat = 6 - day;
  const before = new Date(mid);
  before.setUTCDate(mid.getUTCDate() + offsetToSat - 7);
  const after = new Date(mid);
  after.setUTCDate(mid.getUTCDate() + offsetToSat);
  const chosen = Math.abs(mid - before) <= Math.abs(mid - after) ? before : after;
  return chosen.toISOString().slice(0, 10);
}

function winterSeasonBoundsForDate(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  const month = d.getUTCMonth();
  const startYear = month >= 11 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return {
    start: new Date(Date.UTC(startYear, 11, 15)),
    end: new Date(Date.UTC(startYear + 1, 3, 30, 23, 59, 59, 999)),
  };
}

module.exports = {
  toIsoDate,
  dateRangeNights,
  closestSaturdayWeekKey,
  winterSeasonBoundsForDate,
};
