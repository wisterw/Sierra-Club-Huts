## Why

Volunteers can earn partial work-party credits, but the documented integer field and whole-number profile input do not support that workflow consistently. Support one decimal place while preserving exact credit values and their role in trip-request priority.

## What Changes

- Accept whole credits and fractional credits in increments of 0.1 in admin profile edits and imports.
- Store credits exactly as integer tenths internally; retain `Credits` in credit units in the UI, API, and TSV files.
- Migrate existing balances without changing their meaning and prevent repeated conversion on later startups.
- Reject invalid numbers and precision beyond one decimal place rather than silently rounding.
- Preserve fractional values in profile reads, imports, exports, assignment priority, and availability summaries.
- Keep credits editable only by admins and display whole values without a forced `.0`.

## Capabilities

### New Capabilities

- `fractional-work-party-credits`: Exact credits at one-decimal precision, validation, migration, presentation, and consistent priority behavior across the app.

### Modified Capabilities

None. The new capability supplements existing profile, persistence, and assignment requirements without changing their authorization or priority rules.

## Impact

- SQLite requestor schema, migration, read/write mapping, and TSV persistence/import paths.
- Requestor profile input and API validation; admin volunteer imports and report exports.
- Credit comparisons in trip assignment and availability summaries, with targeted regression coverage.
- Schema documentation and deployment/rollback guidance. No new runtime dependencies or automatic credit-awarding workflow.
