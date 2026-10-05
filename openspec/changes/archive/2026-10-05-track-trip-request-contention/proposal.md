## Why

The app calculates contention for individual availability-grid cells but does not retain a reservation request's overall contention state or its notification timing. Persisting these separately from the general modification timestamp will make current contention and future email decisions reliable.

## What Changes

- Add nullable, server-managed `contention_status` (`NULL`, `at-risk`, `losing`), `contention_status_changed_at`, and `contention_email_sent_at` to ski trip requests.
- Calculate each request's overall contention using the existing higher-priority and equal-priority demand rules: choose the best allowed hut across every requested night; evaluate combination-trip legs together.
- Change the status timestamp only on a status transition, including a return to no contention. Preserve it on unchanged reevaluation and ordinary saves.
- Refresh contention after saved request additions, edits, removals, and credit changes, and on startup so existing requests receive current state.
- Preserve server-owned fields across request replacement and expose them on authorized request reads and joined admin exports.
- Provide an internal repository operation to record a confirmed successful contention email send without changing the contention transition timestamp.
- Keep final assignment status independent. Automatic email sending, scheduling, message copy, and notification policy are deferred.

## Capabilities

### New Capabilities

- `trip-request-contention`: Persistent contention classification, change and email timestamps, recalculation, and server ownership.

### Modified Capabilities

- `trip-request-management`: Extend durable ski trip request records with contention fields.

## Impact

- Additive SQLite schema migration, request row mappings, replacement-save paths, and startup initialization.
- Shared request contention calculation based on existing summary logic and hut capacities; request and requestor mutations refresh derived state transactionally.
- Authorized request API payloads and joined-request report columns, plus schema and operational documentation.
- Targeted classification, timestamp, persistence, mutation, and authorization tests. No new dependencies or outbound notification workflow.
