## 1. Contention calculation

- [x] 1.1 Add a pure request contention classifier using existing summary priority, exclusion, fractional-credit, capacity, and demand precision rules.
- [x] 1.2 Implement worst-night/best-hut aggregation for ordinary requests and shared worst-leg classification for valid combination trips, with contextual errors for invalid links.
- [x] 1.3 Add focused calculation tests for clear/at-risk/losing thresholds, equality, self-exclusion, multi-night alternatives, competing multi-hut demand, and linked combinations.

## 2. Persistence and timestamps

- [x] 2.1 Add idempotent nullable contention columns and constrained status values to fresh and existing SQLite schemas; map the fields on request reads.
- [x] 2.2 Implement transactional contention refresh with an injectable test clock, transition-only updates, and preserved email/general modification timestamps.
- [x] 2.3 Preserve server-owned fields by durable ID during request replacement, ignore client-supplied contention values, and initialize new rows independently.
- [x] 2.4 Add an internal successful-email recording operation for one or more request IDs, with a server timestamp, batch atomicity, and rejection of missing requests.

## 3. Refresh integration and visibility

- [x] 3.1 Integrate refresh into request saves/removals/imports and effective credit changes, including bulk uploads; use one outer transaction and refresh final batch state once.
- [x] 3.2 Refresh after startup initialization/import before serving APIs, and cover requestor deletion if supported; preserve contention through assignment and lottery operations.
- [x] 3.3 Expose fields through authorized request payloads and joined admin exports, with blank export values for NULLs and absent requests.

## 4. Verification and documentation

- [x] 4.1 Add isolated migration/restart tests proving preserved identities and unrelated records, initial timestamps without fabricated history, and stable unchanged reevaluation.
- [x] 4.2 Add repository/API tests for transitions back to NULL, competing edits/removals, fractional credit changes, replacement preservation, forged fields, authorization, export shape, and rollback on refresh failure.
- [x] 4.3 Test successful-send timestamp recording and missing-ID batch rollback without sending real emails; prove login-code operations and status refresh do not record contention sends.
- [x] 4.4 Update schema and README with contention semantics, timestamp ownership, startup refresh, additive migration/rollback limits, and deferred notification scope.
- [x] 4.5 Run relevant profile, trip request, summary, credit, migration, admin export/assignment, login agreement, and browser regression checks; measure 300-request refresh/update timing, run strict OpenSpec validation and mark verified tasks complete.
