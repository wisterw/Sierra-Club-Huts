## Context

Ski trip requests have general creation/modification timestamps and a final assignment `Status`, but no persistent contention fields. `summarizeByChoice` calculates demand by date/hut using credits and choice priority. The browser compares a selected choice's minimum spots against remaining capacity and colors individual cells. This classification can change when another volunteer edits a request or an admin changes credits.

The SQLite repository's profile request save deletes and reinserts the requestor's rows, retaining IDs where supplied. New server-owned fields must survive that path. Combination trips consist of two linked rows sharing a choice number. Current summaries consider saved preferences independently of their assignment outcomes; this change retains those demand semantics.

## Goals / Non-Goals

**Goals:**
- Persist current contention and dedicated transition/email timestamps for each request.
- Define predictable aggregation across nights, alternative huts, and combination legs.
- Keep derived state current on dependency changes and protect it from client updates.
- Prepare a trusted success-recording boundary for a later notification workflow.

**Non-Goals:**
- Sending emails, automatic notification schedules, debounce rules, retries, or message templates.
- Replacing the lottery, simulating assignment outcomes, or guaranteeing a reservation.
- A notification history or an assertion that the last email described the current state.
- New user-facing badges or changes to the existing cell-color legend.

## Decisions

### Add three nullable server-owned fields

Add `contention_status TEXT CHECK (contention_status IS NULL OR contention_status IN ('at-risk', 'losing'))`, `contention_status_changed_at TEXT`, and `contention_email_sent_at TEXT`, all defaulting to NULL. Use server-generated ISO 8601 UTC timestamps with the app's existing convention. The status describes current competition for saved preferences and is independent of final assignment status.

Expose these exact snake_case names on existing authorized request payloads and joined admin TSV exports. Empty request rows in the outer-joined report have blank contention columns. No public route or direct mutation endpoint is added. The API and repository ignore supplied contention fields in ordinary request updates, including admin updates.

NULL denotes no contention after evaluation. Immediately after migration it is also the initial value before the mandatory startup refresh. A NULL-to-NULL evaluation leaves the transition timestamp NULL; the initial discovery of at-risk or losing sets the timestamp to evaluation time. No historical transition or send timestamps are fabricated.

### Classify cells using existing summary rules

For a saved request, obtain its requestor/choice-specific summary using the existing demand calculations, including fractional credits, ideal higher-priority demand, minimum equal-priority demand, and splitting competing multi-hut requests across their allowed huts. Preserve the existing exclusion of the current requestor from equal-choice/equal-credit competition. Preserve existing handling of that requestor's higher choices as higher-priority demand.

For every occupied night and allowed hut, use the same comparisons as the availability grid:

1. `minimum > capacity - higherPrioritySpots` yields losing.
2. Otherwise, `minimum > capacity - higherPrioritySpots - samePrioritySpots` yields at-risk.
3. Otherwise, it yields NULL (clear).

Equality means the group fits. Missing summary cells have zero competing demand and the configured hut capacity. Dates cover arrival inclusively through the night before departure. Existing saved-demand and summary precision conventions are retained so the persisted classification does not introduce an alternative competition formula.

### Aggregate feasible whole-trip options

Order severity as NULL < at-risk < losing. For an ordinary request, take the worst night for each allowed hut, then the best of those hut-level results. This requires one hut for the entire stay; a clear hut on night one and a different clear hut on night two does not make an ordinary request clear.

For a valid combination trip, calculate both linked legs using their own dates, huts, and minimum spots, then use the worse leg as the shared overall status of both rows. Each row retains its own durable ID and email timestamp. Existing linked rows retain equal status/change timestamps after a shared transition; a newly introduced link or segment can acquire its initial transition timestamp independently. Broken legacy combination linkage fails refresh clearly rather than silently calculating a misleading whole-trip status.

Extract a reusable, pure server-side classifier that returns status by Request_ID without reading or writing storage. This supports focused tests and keeps persistence and scheduling concerns outside the competition calculations. There is no change to assignment ranking or browser cell shading.

### Persist only real status transitions

The repository refresh reads one consistent snapshot of all requestors and requests, calculates statuses, and updates only rows whose persisted status differs, with a single server timestamp for the refresh. A transition to NULL records that time rather than clearing it. Leave `contention_email_sent_at` untouched and do not change `last_mod_date` for contention-only maintenance.

Ordinary request saves preserve prior server-owned values by durable ID, ignore client-provided values, initialize new rows with NULLs, finish choice renumbering/combination relinking, and then refresh contention. Assignment saves preserve the fields; refresh must not turn an assignment outcome into a contention classification.

### Refresh transactionally at repository boundaries

For the initial small application, refresh all saved requests after a relevant mutation. It is simpler and more reliable than trying to identify every affected hut/date/priority group, especially after a credit change or a deleted request. Reuse summaries for common requestor/choice contexts within a refresh where straightforward.

The expected workload is approximately 90 requestors and 300 saved requests. Expand each request's nights/huts once per refresh and reuse that coverage in the existing summary calculation. Include a representative 300-request refresh and credit-update timing measurement in verification, with machine-specific results rather than a deployment latency guarantee.

Run refresh after request replacement (including removals), request import, and effective requestor credit changes or requestor deletion if such an operation exists. Perform mutation and refresh in one transaction; a refresh failure rolls back the initiating mutation. Bulk requestor uploads refresh once after all rows are applied, using final credit values and preserving upload atomicity. Refactor transaction boundaries to avoid nested BEGIN statements when direct upserts and bulk operations share the path.

Run one refresh after schema migration and any startup TSV import, before serving request APIs. Subsequent startups reevaluate against configured hut capacities without resetting unchanged timestamps. Mode changes and lottery regeneration do not change the contention formula and need no transition. Assignment runs do not change demand inputs and must preserve dedicated timestamps unless an actual calculation input changes.

### Record successful sends independently

Provide an internal repository function accepting durable request ID(s) for a confirmed successful contention notification. Use server completion time to update only `contention_email_sent_at`, transactionally if a single email covers several requests. An unknown/deleted request ID reports failure without partially updating the batch. Do not call this function from profile saves, recalculations, login-code emails, or speculative send attempts.

This change introduces no mail sender or public recording API. Failed sends leave the timestamp unchanged. A later notification design must define how to identify the status/version actually emailed: comparing the two timestamps alone is insufficient if status changes during a send. The email timestamp remains a fact about the most recent successful send even if the status subsequently changes or clears.

## Risks / Trade-offs

- [Aggregate contention is a demand estimate, not a final lottery result] → Keep final Status separate and document the definition of losing.
- [Replacement saves can erase history or accept forged values] → Preserve fields by Request_ID, initialize only new rows, and whitelist client-editable fields.
- [Cross-request recalculation can add work to writes] → Start with a consistent full refresh and cache shared calculations; optimize only with measured need.
- [Credit edits and bulk import transactions can nest] → Use one outer transaction and internal mutation helpers, with refresh once per logical operation.
- [Legacy combination links may be invalid] → Validate before recording a combined status and fail with request context so data can be corrected deliberately.
- [A send timestamp cannot prove which status an email contained] → Defer automatic email policy and status/version send history to the notification change.

## Migration Plan

1. Back up the database and add missing nullable columns idempotently; preserve request IDs, existing timestamps, assignment outcomes, and all other records.
2. After normal initialization/import, calculate current contention before serving APIs. Timestamp newly detected non-null contention with the actual refresh time; leave all send timestamps NULL.
3. Verify unchanged reevaluations, transitions, replacement saves, credit changes, authorized reads, and exports against an isolated database and a second startup.
4. Update schema and operational documentation. Rolling back to the preceding build can retain these additive columns, but that build will not refresh or reliably preserve them through replacement saves. On redeployment, refresh statuses and treat history produced during that older build as unavailable rather than inventing timestamps.

## Open Questions

None blocking this change. Automatic notification policy, delivery guarantees, grouping, and tracking the exact status emailed are deferred to a subsequent proposal.
