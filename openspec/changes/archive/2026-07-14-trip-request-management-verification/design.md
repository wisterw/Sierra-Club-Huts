## Context

The application already supports trip requests, availability summaries, and assignment. The remaining gap is a formal, testable contract for request verification and request bookkeeping so the implementation can be checked against a stable spec instead of scattered assumptions.

## Goals / Non-Goals

**Goals:**
- Define the validation rules for saving ski trip requests.
- Define how choice numbers are renumbered and how calculated fields are refreshed.
- Define how availability summaries are computed for a selected request.
- Define the storage shape for combination trips.

**Non-Goals:**
- Changing the assignment algorithm.
- Changing work-party behavior.
- Reworking profile or admin permissions.

## Decisions

- Keep verification rules as a single request-management capability so the save flow, summary view, and combination-trip behavior stay aligned.
- Treat the backend as the enforcement point for request validation, with the front end mirroring the same rules for immediate feedback.
- Preserve combination trips as two linked rows instead of introducing a separate composite record type. That matches the existing storage model and keeps summary and assignment logic simple.
- Renumber choice numbers on save rather than requiring users to manage gaps manually. This keeps ordering deterministic and easier to reason about in tests.

## Risks / Trade-offs

- Validation duplicated across front end and backend -> Keep the backend as source of truth and use the same rule set in UI checks.
- Combination-trip linkage can be brittle if one row is edited independently -> Require the paired row relationship to be refreshed together on save.
- Season-bound date rules are easy to drift between docs and code -> Capture them in the spec and test them directly.
