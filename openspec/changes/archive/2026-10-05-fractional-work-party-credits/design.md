## Context

The app uses Node's SQLite database and exposes requestor credits as JavaScript numbers. `requestors.credits` is declared INTEGER in a non-STRICT table, so its declaration alone does not enforce whole numbers. Existing reads, imports, and writes use `Number`, and the profile number input omits `step`, giving it a whole-number browser constraint. Assignment and request-summary services compare credits numerically, including exact equality for priority groups.

The customer wants fractional credits at one decimal place and prefers exact decimal behavior. The app remains focused on trip requests; existing work-party mode is retained.

## Goals / Non-Goals

**Goals:**
- Exact persistence of credits in increments of 0.1, with a consistent validation boundary.
- Preserve existing balances, requestor identities, relationships, permissions, priority rules, and external `Credits` units.
- Reliable migration, restart behavior, imports, exports, and admin profile edits.

**Non-Goals:**
- Automatic credits from work-party attendance, credit history, or new award rules.
- Changes to assignment criteria or supported application modes.
- A general decimal library, additional precision, or a new database engine.
- Introducing a new restriction on negative balances; existing signed values remain supported.

## Decisions

### Store integer tenths in a clearly named column

Use `requestors.credits_tenths INTEGER NOT NULL DEFAULT 0`; `1.5` credits maps to `15`. Fresh databases create this column directly. Migrate existing databases by renaming the legacy `credits` column and converting its contents in a single transaction after validating every balance. Detect the column name on startup so conversion is performed once. Repository writes always bind validated integer tenths; reject values outside the JavaScript safe-integer range after scaling.

This achieves exact fixed-point storage with built-in SQLite integers. A DECIMAL declaration in SQLite does not supply native decimal arithmetic or precision enforcement. REAL plus normalization would be simpler but does not satisfy the preference for exact storage. Decimal text would complicate database sorting. Explicit units in the column name avoid accidental interpretation as whole credits and cause legacy SQL referring to `credits` to fail rather than silently read multiplied balances.

### Validate before coercion at every input boundary

Provide shared helpers to parse credit-unit numbers or decimal strings into integer tenths and convert tenths back to credit units. Parse decimal digits instead of relying on floating-point multiplication and `Number.isInteger(value * 10)`. Accept values with at most one significant fractional decimal place, including trailing zero equivalents such as `1.50`; reject `1.25`, non-finite values, booleans, null, blank explicit profile values, and unsafe scaled values. Do not silently round. Normalize negative zero to zero. Keep error messages specific to credits.

Admin profile updates reject invalid explicit values with HTTP 400 before any profile mutation. Omitted credits preserve the current balance. Admin TSV uploads retain blank-cell preservation, validate all rows before committing, and include row context for invalid credits. Startup TSV import validates before committing; invalid legacy stored values abort the migration without partial conversion. Apply the same semantics in the legacy TSV store so direct repository use cannot bypass validation.

### Keep external units and priority behavior stable

Repository outputs, API payloads, and TSV exports retain `Credits` as credit units, not tenths. Update the profile control to `step="0.1"`, with whole values displayed as `3` and fractions as `3.5`. Non-admins continue to see the disabled field and cannot change its value through API submissions.

Audit SQL expressions and raw row mappings for the renamed column. Numeric ordering of integer tenths is equivalent to ordering credit units. Existing assignment and request-summary comparisons can remain where values are canonical; comparisons or future arithmetic that need integer precision use the shared conversion. Verify equal fractional balances tie and unequal fractional balances follow existing priority criteria. TSV import/export round trips must not expose tenths or floating-point artifacts.

## Risks / Trade-offs

- [An existing database may already contain fractional or invalid balances despite INTEGER affinity] → Preflight all stored values; preserve valid tenths and fail with an actionable error for other values, without rounding or partial conversion.
- [Repeated conversion would multiply balances again] → Use the schema column name as the transactional migration marker and test multiple restarts.
- [Renaming a column affects readers outside the repository] → Audit all credit references and document the internal schema change; the public API and TSV column stay `Credits`.
- [JavaScript numbers are still used at external boundaries] → Derive them from validated safe integer tenths, serialize canonical decimal values, and use integer helpers for precision-sensitive arithmetic.
- [Old binaries cannot use the migrated schema] → Stop the service during rollout, back up the database, and require restoration of the matching database backup for rollback.

## Migration Plan

1. Back up the database and deploy with the app stopped; avoid mixed old/new processes accessing the same database.
2. On startup, detect legacy `credits`, preflight every value through the shared parser, and transactionally rename and convert to `credits_tenths`. Preserve all other fields and relationships. Abort startup on invalid data.
3. For a fresh database, initialize the new schema and convert imported TSV credit units at the repository boundary.
4. Verify representative whole and fractional balances, exports, priority calculations, and a second restart without additional conversion.
5. Document that rollback requires the old binary and its pre-migration database backup together. A rollback after new writes requires separate reconciliation; never run the old binary directly against the migrated database.

## Open Questions

None blocking. Negative balances remain supported to avoid changing existing semantics. Values more precise than tenths are rejected rather than rounded.
