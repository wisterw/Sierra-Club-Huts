## 1. Solver foundation and allocation inputs

- [x] 1.1 Select and pin an integer-capable solver with proven-optimal status reporting; verify packaging, license/runtime compatibility, staged objectives, and isolated execution on the deployment platform, recording the decision in design.md.
- [x] 1.2 Normalize current-season requests into logical choices and hut/route options with occupied nights, exact credit tenths, guest bounds, and one-requestor scoring; reject invalid or incompatible traverse links before solving.
- [x] 1.3 Add a coherent allocation-input snapshot and canonical fingerprint including relevant requestor inputs, capacities, mode, and outcome/version state.
- [x] 1.4 Create small exhaustive-enumeration oracle fixtures for feasible assignments, credit-level scores, and person-nights independent of the production solver.

## 2. Optimization objectives and validation

- [x] 2.1 Build binary choice/option and integer guest variables with one-choice-per-requestor, full-stay hut capacity, guest-bound, and shared-count traverse constraints.
- [x] 2.2 Implement staged minimization of credit-level choice-rank totals in descending credit order, using literal unassigned score 10 and retaining allocation freedom after each score is fixed.
- [x] 2.3 Maximize person-nights after fixing every score optimum, allowing earlier guest counts and hut allocations to change within the constraints.
- [x] 2.4 Implement deterministic final flexibility/service/lottery fairness and option/guest ties without worsening score or person-night objectives; preserve regeneration flags and seeded behavior.
- [x] 2.5 Run all solve phases in an isolated worker/process with an enforced total timeout, structured termination reasons, and failure on incomplete optimality proof without a greedy fallback.
- [x] 2.6 Independently validate returned integer allocations, per-night capacities, bounds, combination consistency, one-choice outcomes, and objective arithmetic before accepting solver output.

## 3. Safe assignment integration

- [x] 3.1 Map optimized logical choices to granted/not-used/lost-lottery rows with global-allocation audit explanations, preserving original bounds, identities, combination links, and contention notification fields.
- [x] 3.2 Add private allocation-run metadata and one repository transaction that verifies snapshot freshness and commits all outcomes, prospective lottery changes, and run metrics atomically.
- [x] 3.3 Replace the synchronous greedy assignment route with isolated optimization and explicit success/failure responses; reject stale inputs, concurrent-run overwrites, wrong mode, and out-of-scope reassignment.
- [x] 3.4 Extend efficiency reporting and admin result display with per-credit score totals, person-nights, policy/completion/time information, and stale-summary detection while retaining existing rows and controls.

## 4. Verification and documentation

- [x] 4.1 Verify balanced-rank, fractional-credit precedence, within-tier score ties, and literal rank-10-and-above behavior against the exhaustive oracle.
- [x] 4.2 Verify minimum/ideal redistribution, two small groups versus a larger group, larger-group selection when scores tie, alternative huts, overlapping multi-night stays, and indivisible traverses.
- [x] 4.3 Verify lottery/service/flexibility ties, repeatability, preserved lottery values, timeout/incomplete proof, invalid solver output, stale edits, concurrent runs, atomic write failure, other seasons, and unchanged alert state.
- [x] 4.4 Benchmark representative 90-requestor/300-row and dense-conflict workloads, report solve-phase timing and completion within the total budget, and tune the adapter without weakening the agreed objectives.
- [x] 4.5 Run relevant assignment, credits, trip-request, migration, admin-console/report, and contention-alert regression checks; document scoring, fairness, runtime/timeout configuration, failure recovery, deployment, and rollback.
