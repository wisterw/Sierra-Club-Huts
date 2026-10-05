## Why

The current greedy assignment favors low minimum person-night requests even when doing so helps no additional volunteers, and grants ideal group sizes before considering other requests. Compare complete allocations to improve volunteer choice outcomes while preserving credit precedence, then fill capacity to increase person-nights.

## What Changes

- Replace request-by-request greedy granting with allocation optimization across overlapping dates, allowed huts, and ranked choices.
- Count each requestor once: a granted choice contributes its rank, and unassigned contributes 10. Minimize the summed score separately for each exact credit level, comparing highest-credit levels first.
- Reconsider earlier allocations and reduce granted guests toward declared minimums to accommodate others without worsening higher-credit score outcomes.
- Among equal choice-score vectors, maximize granted person-nights up to ideal guest counts; do not automatically prefer smaller groups.
- Treat linked traverse legs as one indivisible choice with a consistent guest count and capacity checks on both legs.
- Retain lottery regeneration controls; apply flexibility, years of service, and lottery only after the allocation objectives tie.
- Report allocation scores, person-nights, and optimization completion; validate and commit only complete proven-optimal results, preserving existing grants if optimization cannot finish safely.

## Capabilities

### New Capabilities

- `trip-allocation-optimization`: Feasible allocation modeling, credit-level choice scoring, guest-count adjustment, person-night optimization, deterministic ties, and solver completion guarantees.

### Modified Capabilities

- `admin-operations`: Optimized assignment behavior, final lottery tiebreak semantics, and allocation-quality reporting while preserving existing controls and report fields.

## Impact

- `src/services/assignment.js`, assignment API execution/persistence, efficiency report UI/API, and assignment verification fixtures.
- A solver adapter and packaged optimization dependency/runtime selected and verified during implementation; deployment must support bounded execution without blocking the web server.
- Linked combination assignment correctness, audit explanations, and atomic persistence of request outcomes and any regenerated lottery values.
- Existing availability/contention estimates and alert rules remain demand-based estimates; this change does not promise they predict the optimized allocation.
