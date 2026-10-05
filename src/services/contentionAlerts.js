const { HUTS } = require('../config');
const { appPublicOrigin } = require('./auth');

const HOUR = 60 * 60 * 1000;
const INTERVAL = 2 * HOUR;
function seasonYear(now) { return new Date(now).getUTCFullYear(); }
function choicesFor(requests, year) {
  const groups = new Map();
  for (const r of requests) {
    if (r.Arrival < `${year}-12-15` || r.Arrival > `${year + 1}-04-30`) continue;
    const key = r.Combination_first_request || r.Request_ID;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return [...groups.values()].map((rows) => {
    rows.sort((a, b) => a.Arrival.localeCompare(b.Arrival));
    return {
      key: rows.map((r) => `${r.Request_ID}:${r.notificationIdentity || r.Creation_date}`).join('|'),
      rows: rows.map((r) => ({ id: r.Request_ID, identity: r.notificationIdentity, created: r.Creation_date })),
      choice: rows[0].Choice_Number,
      huts: rows.map((r) => HUTS.filter((h) => r[h])),
      arrival: rows[0].Arrival, departure: rows.at(-1).Departure,
      traverse: rows.length > 1 ? rows[0].Departure : null,
      ideal: rows[0].Spots_ideal, minimum: rows[0].Spots_min,
      status: rows.some((r) => r.contention_status === 'losing') ? 'losing'
        : rows.some((r) => r.contention_status === 'at-risk') ? 'at-risk' : null,
    };
  }).sort((a, b) => a.choice - b.choice);
}
function candidate(current, baseline) {
  const known = new Map(baseline.map((c) => [c.key, c]));
  const lost = [];
  let fallback = null;
  for (const choice of current) {
    if (choice.status === 'losing') {
      if (known.get(choice.key)?.status !== 'losing') lost.push(choice);
    } else { fallback = choice; break; }
  }
  if (lost.length) return { variant: fallback ? 'bumped-with-choices' : 'bumped-no-choices', choices: [...lost, ...(fallback ? [fallback] : [])] };
  if (fallback?.status === 'at-risk' && JSON.stringify(fallback) !== JSON.stringify(known.get(fallback.key))) {
    return { variant: 'lottery', choices: [fallback] };
  }
  return null;
}
function recoveredBaseline(current, baseline) {
  const byKey = new Map(current.map((c) => [c.key, c]));
  return baseline.filter((c) => byKey.has(c.key)).map((c) => {
    const next = byKey.get(c.key);
    return (c.status === 'losing' && next.status !== 'losing') || !next.status ? next : c;
  });
}
function calendarDate(value) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function composeAlert(email, content, environment = process.env) {
  let intro;
  const plural = content.choices.filter((c) => c.status === 'losing').length > 1;
  if (content.variant === 'lottery') {
    intro = 'Your current top-choice reservation request (listed below) is at risk of loss in a lottery to other volunteers with the same number of work-party credits as you. In a lottery situation, you could be moved to one of your lower choices.';
  } else {
    intro = plural ? 'Your leading reservation requests are currently unlikely to be available because of higher-priority requests.'
      : 'Your current top-choice reservation request is currently unlikely to be available because of higher-priority requests.';
    intro += content.variant === 'bumped-with-choices'
      ? ' The affected choices and your next-best remaining choice are listed below.'
      : ' The affected choices are listed below. Adjust your choices to improve your chances of receiving a reservation in the lottery.';
  }
  const details = content.choices.map((c) => [
    `Choice #${c.choice} (${c.status || 'no current contention'})`,
    `Hut(s): ${c.huts.map((options) => options.join(' or ')).join(' → ')}`,
    `Check-in: ${calendarDate(c.arrival)}`, `Check-out: ${calendarDate(c.departure)}`,
    ...(c.traverse ? [`Traverse: ${calendarDate(c.traverse)}`] : []),
    `Ideal people: ${c.ideal}`, `Minimum people: ${c.minimum}`,
  ].join('\n')).join('\n\n');
  const fallbackRisk = content.variant === 'bumped-with-choices' && content.choices.at(-1).status === 'at-risk'
    ? '\n\nYour next remaining choice is also at risk in a lottery with equal-credit volunteers.' : '';
  const link = `${appPublicOrigin(environment)}/trip-requests`;
  const text = `${intro}\n\n${details}${fallbackRisk}\n\nThese contention estimates are not confirmed reservations.\nReview and edit your choices: ${link}`;
  return { to: email, from: environment.CONTENTION_ALERT_FROM || environment.LOGIN_EMAIL_FROM,
    subject: 'Sierra Club Huts: reservation request contention update', text,
    html: text.split('\n\n').map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('')
      .replace(escapeHtml(link), `<a href="${escapeHtml(link)}">${escapeHtml(link)}</a>`) };
}
module.exports = { HOUR, INTERVAL, seasonYear, choicesFor, candidate, recoveredBaseline, composeAlert };
