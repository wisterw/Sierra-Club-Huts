const { creditsToTenths, creditsFromTenths } = require('./credits');

function effectiveRequestors(people) {
  const source = people instanceof Map ? people : new Map(Object.entries(people || {}).map(([id, p]) => [Number(id), p]));
  if (![...source.values()].some((p) => p.Is_placeholder)) return source;
  const ordinary = [...source.values()].filter((p) => !p.Is_placeholder).map((p) => creditsToTenths(p.Credits ?? 0));
  const highest = ordinary.length ? Math.max(...ordinary) : 0;
  if (!Number.isSafeInteger(highest + 1)) throw new Error('Cannot establish placeholder priority: credit limit reached.');
  const credits = creditsFromTenths(highest + 1);
  return new Map([...source].map(([id, p]) => [id, p.Is_placeholder ? { ...p, Credits: credits, Lottery_value: 0 } : p]));
}
module.exports = { effectiveRequestors };
