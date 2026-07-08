## Context

The current assignment implementation uses a mix of criteria that still leaves room for email-based ordering as a practical tie-break. The updated PRD/API/Schema now say that lottery numbers should be the final tie-break, that those numbers are generated separately from the assignment algorithm, and that the assignTrips endpoint should optionally regenerate lottery numbers before assignment.

This change touches backend assignment logic, requestor persistence, admin API behavior, and the admin-facing control surface. It also affects any reporting or seed data that assumed email ordering was the last deterministic sort key.

## Goals / Non-Goals

**Goals:**

- Make lottery number the final assignment tiebreak.
- Keep lottery generation explicit and separate from assignment execution.
- Persist lottery numbers on requestors so they survive between runs when desired.
- Provide a deterministic path for tests and seed data.
- Preserve the existing admin workflow shape while updating its semantics.

**Non-Goals:**

- Reworking the overall assignment preference list beyond the lottery/tiebreak semantics.
- Changing work-party, profile, or trip-request validation rules unrelated to lottery numbers.
- Introducing a new persistence backend; this change uses the existing relational store work.

## Decisions

### Store lottery numbers on requestors

Lottery numbers belong on the requestor record, not on individual trip requests, because the spec describes them as requestor-scoped data that can be regenerated independently of assignment. That keeps the lottery value stable across all of a user's requests and matches the admin action model.

Alternative considered: store lottery numbers on requests. That would make combination and multi-choice behavior harder to reason about and would create redundant tie-break data.

### Keep lottery generation separate from assignment

Assignment should accept a flag that controls whether lottery numbers are regenerated first. The default remains true, which preserves the existing admin habit of "run assignment and refresh randomness," while still allowing a deterministic or partially preserved run when the flag is false.

Alternative considered: always regenerate lottery numbers inside assignment. That is simpler, but it removes the ability to preserve existing lottery numbers for controlled reruns and test cases.

### Use lottery number only after all higher-precedence criteria

The final sort key should be lottery number, lowest first, after the rest of the preference list. Email address should no longer participate as the fallback ordering key for assignment decisions.

Alternative considered: keep email as a last tie-break after lottery. That would contradict the updated spec language and preserve a behavior the product no longer wants.

### Expose a dedicated admin control for regeneration

The admin surface should expose a checkbox or equivalent control labeled for regenerating lottery numbers, defaulting to on when an assignment is run. This makes the new behavior discoverable and prevents accidental reliance on hidden defaults.

Alternative considered: add a hidden API-only flag. That would satisfy the backend but leave the admin workflow opaque.

## Risks / Trade-offs

- Lottery numbers can change assignment outcomes between runs -> Default regeneration to on, but allow tests and manual reruns to preserve existing values when needed.
- Persisting lottery numbers increases the number of moving pieces in migration -> Add schema migration/backfill tests and keep the field nullable until first regeneration.
- Removing email ordering may change historical assignments -> Communicate the change clearly in admin docs and tests, and keep the rest of the preference list deterministic.
- A flag default of true can surprise operators -> Surface the checkbox in the admin UI with a clear label and default state.

## Migration Plan

1. Add `lottery_value` to requestor persistence and seed it as nullable for existing rows.
2. Update assignTrips to regenerate lottery numbers when requested, then sort by lottery value before the final assignment decision.
3. Add the admin UI/API control for regenerating lottery numbers separately from assignment.
4. Update tests and seed data to cover both regeneration-on and regeneration-off runs.
5. Keep a rollback path that restores the old ordering only if the new lottery workflow proves unstable in production.

## Open Questions

- Should the regenerate-lottery checkbox be exposed only on the assignment action, or also as a separate admin action for precomputing numbers?
- Should reports export `lottery_value` directly for auditing, or stay focused on the joined request/requestor download?
