## Context

Requestors are matched by email in SQLite. Volunteers have multiple ranked choices but receive at most one trip. The optimizer minimizes choice scores by descending credit level, then maximizes person-nights and resolves fairness ties. Live availability and contention are separate demand estimates. Admins can upload requestors but cannot import reservations.

## Goals / Non-Goals

**Goals:** Import external reservations through upload or paste; automatically create one non-login placeholder per booking; preserve these bookings ahead of ordinary volunteers; prevent duplicate and contradictory imports; expose occupied capacity through existing request calculations.

**Non-Goals:** Multiple awarded trips per requestor, general request impersonation, automatic lottery execution, invitations, external booking-system synchronization, or hard rejection of volunteer requests that overlap existing reservations. Availability warnings remain the normal volunteer behavior.

## Decisions

### One placeholder per reservation

Add `Is_placeholder` publicly represented as a boolean, backed by a NOT NULL SQLite boolean default false. Only dedicated admin reservation operations can create/manage placeholders; ordinary profile and volunteer-import endpoints cannot set the flag or convert real people. Use unique generated identities in the reserved `.invalid` email domain, never customer email addresses. Store a globally unique admin-supplied `Reservation_reference` association with the placeholder and request. Names identify reservations rather than people; private notes stay admin-only.

Each record owns exactly one logical choice-1 request, with one hut or two contiguous Benson/Bradley traverse legs and `Spots_min = Spots_ideal = Guests`. Keep the allocator's one-award rule. Alternative multiple-award placeholders would require changes throughout choice scoring and outcome mapping, so are excluded.

### TSV upload and paste share validation

Provide an Admin Existing reservations section, sample file, upload control and tab-separated paste box using one parser/API service. Required columns: `Reservation_reference`, `Name`, `Hut`, `Arrival`, `Departure`, `Guests`; optional `Traverse_date` and `Notes`. Dates are YYYY-MM-DD, checkout excluded; Name is required. Guests is a positive integer within the capacity of each selected hut. A whole-hut reservation uses the hut's full capacity. Reuse current season/date/maximum-stay validation; reject unsupported longer stays with an actionable error instead of truncation. A combination row uses `Benson->Bradley` or `Bradley->Benson` and a required `Traverse_date` strictly between arrival and departure, creating two linked legs under one placeholder. Each leg retains the five-night limit. Ordinary rows omit the traverse date. Store Name verbatim (trimmed) in the placeholder first_name field and keep last_name empty; show names only in admin reservation lists and exports.

References are trimmed, case-sensitive, and globally unique; duplicate references within a batch are errors. Reimport replaces that reference's reservation while preserving durable identities. Omitted references remain untouched. Parse and validate the complete final combined reservation set, including existing placeholders and proposed updates, within one transaction before mutation. Sum fixed guest occupancy per hut-night and reject capacity excess with reference/row details. Ordinary volunteer demand is allowed to overlap. No partial imports. Report created/updated counts and line-specific errors; impose a bounded file/paste size using existing upload conventions.

Provide admin listing and explicit removal by reference. Removal deletes the linked request and placeholder atomically, refreshes contention, and invalidates allocation summaries. Refuse any unexpected ownership/linkage instead of deleting unrelated volunteer data.

### Placeholder priority cannot depend on a magic credit constant

At import, store a high credit balance above ordinary volunteers. For calculations, derive one effective placeholder credit level one exact tenth above the maximum ordinary credit in the relevant snapshot, without modifying ordinary balances. Apply this shared effective-credit rule to availability, contention, alert snapshots and allocation, so later ordinary-credit increases cannot outrank reservations. Handle safe-integer overflow with explicit failure and preserved records rather than floating-point rounding. The placeholder flag remains authoritative; stored credits are descriptive, not a promise that a chosen constant will always suffice.

All placeholders occupy the first objective level and have fixed choice 1; feasible existing reservations therefore all win before ordinary choice optimization. Validate their collective feasibility both at import and before assignment to detect legacy/corrupt data. Placeholder lottery values are deterministic valid values and do not depend on email or participate in ordinary regeneration. Keep ordinary service/lottery/ID ties unchanged.

Advance policy to `credit-rank-person-nights-v3`. Fingerprints include flag, reservation identity, and request data; a concurrent import/remove invalidates an in-flight solve. Old runs remain immutable and stale after the policy change. Separate placeholder booking counts/person-nights from volunteer rank/credit statistics; total occupied person-nights includes both. Exclude placeholder guest revenue from assumptions about newly awarded volunteer revenue.

### Exclude communication and authentication at every entry

Login email requests for placeholders return the same generic response as unknown identities, without generating a code, invoking the relay, or printing a debug code. Reject code/hash authentication and sessions resolving to placeholders, including previously generated credentials. Restrict all protected volunteer APIs accordingly. Contention alert discovery, pending batches, retry and reconciliation paths must not send placeholder messages. Preserve their demand as a competitor affecting real volunteers. An admin import is an admin action; its impacts on real volunteers follow existing alert baseline, quiet-period and scheduling rules, without sending immediately.

### Show existing reservations without exposing identities

Availability includes reserved guest counts on every occupied night and distinguishes existing reservation demand from ordinary competition. No synthetic email or private note appears in volunteer payloads. A full-hut reservation displays no remaining space; partial bookings leave residual capacity. This remains a demand preview, not a rerun of allocation. Dedicated listing keeps placeholders separate from ordinary volunteer management; exports include the flag so administrative records remain identifiable.

## Risks / Trade-offs

- [Synthetic accounts leak into mail or fairness reports] -> Apply explicit flag checks at authentication, send eligibility, reporting and serialization boundaries; test direct API attempts and pending alerts.
- [Reimport doubles occupancy] -> Stable required references and atomic replacement; untouched rows are preserved.
- [Reservations conflict or exceed allocator date limits] -> Validate final combined occupancy and existing date constraints before committing; return actionable errors.
- [Imported demand changes contention] -> Use existing atomic refresh and alert impact tracking; do not suppress impacts on real volunteers or send immediately.
- [Priority semantics drift between preview and solver] -> One shared effective-credit function and boundary tests, including later credit increases.

## Migration Plan

Add schema fields and reservation associations with all old requestors defaulting to ordinary; do not infer placeholders from credits or names. Sync prerequisite allocation changes first. No import or reassignment occurs on deployment. Verify on isolated fixtures before enabling admin imports. Retain additive history. Rolling back to code unaware of the flag requires exporting/removing placeholder reservations first: older code could email them and does not guarantee their priority. Preserve a database backup and booking export for restoration.

## Open Questions

No blocking policy questions. The default scope is TSV upload plus paste, partial or full-hut bookings, and current request season/stay limits. Support for longer external bookings can be proposed separately if actual source data needs it.
