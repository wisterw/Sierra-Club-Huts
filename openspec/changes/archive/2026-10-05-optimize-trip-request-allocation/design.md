## Context

Assignment currently processes choice numbers in order, sorts candidates by credits, minimum person-nights, flexibility, years of service, and lottery, then immediately grants as many guests as fit. It never revisits a grant. This can choose a group of 4 over a group of 9 when either serves only one requestor, or give 12 spots to a minimum-2 group and exclude another group of 2. Combination rows are considered separately rather than as an atomic traverse.

The workload is approximately 90 requestors with 300 request rows. SQLite persists requests and lottery values. The synchronous admin assignment route currently writes request outcomes and lottery values separately. Availability and contention are demand estimates, not outputs of the granting algorithm.

## Goals / Non-Goals

**Goals:** Balance all choice ranks using the agreed score, preserve precedence between exact credit levels, adjust group counts within declared bounds, maximize person-nights after choice outcomes tie, grant valid traverses atomically, explain outcomes, and commit complete validated allocations safely.

**Non-Goals:** Maximize guest count ahead of volunteer outcomes, weight volunteers by party size, guarantee each individual their prior greedy choice, change requested minimums/ideals, alter contention/alert calculations, change login/credit management, or silently publish a heuristic allocation as optimal.

## Decisions

### Compare a vector of credit-level scores

For every requestor with at least one in-scope logical choice, score the selected choice number or 10 if unassigned. Each requestor contributes once, including a traverse. Requestors without in-scope choices are excluded. Convert credits to exact integer tenths using the existing conversion boundary and sort distinct credit levels descending.

For each credit level c, compute S_c = sum of requestor scores. Minimize (S_highest, S_next, ..., S_lowest) lexicographically. Once a higher-level minimum is proven, constrain its score to that value while optimizing the next level. This avoids arbitrary numeric weights or aggregate scores that allow many lower-credit benefits to override higher-credit outcomes.

Precedence protects the score of the entire higher-credit level, not each individual's rank. Individuals within that level can exchange outcomes if its total is unchanged and that permits improvements below it. Do not freeze the actual high-credit allocation prematurely: retain all allocations with the best score so later phases can change huts and guest counts.

Examples: at equal credits, [1,10,10,10] scores 31 and [2,2,2,2] scores 8; [1,3] ties [2,2] at 4. A lower-credit benefit cannot increase an already minimized higher-credit score. The unassigned penalty remains the literal constant 10; no new choice-count cap is introduced. Choice 10 ties unassigned on this objective, and choice ranks above 10 are worse under the agreed formula. Expected 3–4-choice usage avoids this edge; expose the scoring rule in documentation rather than silently clamp ranks.

### Model choices and guest counts together

Normalize rows into logical choices. An ordinary choice has one option per allowed hut, covering every night of its stay. A traverse has one linked ordered-route option covering both legs, sharing a guest count. Validate links, contiguous dates, route, rank, and compatible group bounds; inconsistent legacy combination bounds fail with a contextual error rather than changing declared requirements.

For each option o, use a binary selection x_o and integer granted guests g_o, constrained by min_o*x_o <= g_o <= ideal_o*x_o. For each requestor, sum(x_o) <= 1. For each hut-night, sum of applicable g_o <= configured capacity. Departure dates are exclusive. Traverses contribute each leg's occupied nights to capacity and person-nights without double counting the traverse day.

The choice score can be expressed as 10*N_c + sum((rank_o - 10)*x_o) for each credit level. After freezing all credit-level optima, maximize sum(g_o * occupied_nights_o). This naturally circles back: a high-credit minimum-4/ideal-12 grant can become 8 so a lower-credit group of 4 receives a choice, provided higher-credit scores do not worsen. There is no permanent ideal-size first pass and no unconditional smaller-group ranking.

A local hut-night packing rule is insufficient because entire stays, alternative huts, lower choices, and traverse legs couple capacity decisions. Use a mixed-integer optimization adapter with staged solves and integer constraints. A changed sort comparator or a minimum-only allocation followed by irreversible filling cannot express these objectives reliably.

### Resolve ties only after score and person-night objectives

Freeze maximum person-nights before applying fairness. Build a stable requestor order using fewer allowed huts (minimum option flexibility across their in-scope choices), then years of service descending, stored lottery value ascending, then requestor ID. In that order, minimize each requestor's awarded rank (unassigned 10) while preserving all previously fixed objectives. This gives lower lottery numbers preference when earlier criteria tie, without allowing fairness to displace a better volunteer score or person-night result.

Complete determinism with guest-count and option tie resolution in the same stable order, preferring more guests and then the existing canonical hut order where still tied. Traverse routes are already fixed. These are final allocation ties; the old minimum-person-night bias is removed. Preserve regeneration default/flag and seeded lottery behavior; only fill missing lottery values when regeneration is disabled.

### Isolate solver execution and require proof of completion

Package the solver behind a small adapter returning allocation, objective vector, person-nights, status, elapsed time, and termination reason. Select and pin an integer-capable packaged solver during the first implementation task after confirming optimal-status reporting, supported deployment runtime, packaging/license requirements, and deterministic behavior. Prefer a self-contained Node-compatible runtime; do not assume Python or an independently installed executable is available.

Run the solver in an isolated worker/process with a total default 30-second budget covering all objective and tie phases, enforced outside the solver. A feasible incumbent is not a proven optimal result. Timeouts, missing runtime, numerical ambiguity, or failure to finish any phase return a clear unsuccessful outcome and preserve existing grants and lottery values. No silent greedy fallback. Benchmark representative and dense-overlap workloads; report measured limits rather than assuming 300 rows always solve quickly.

Independently validate the returned integer allocation, capacities, bounds, one-choice rule, combination consistency, and objective arithmetic before persistence. Small fixtures use exhaustive enumeration as an oracle for optimality; capacity validation alone cannot prove a solver's objective is correct.

### Snapshot, validate, and commit atomically

Take a coherent snapshot of in-scope requests, requestor credits/service/lottery inputs, and capacities without holding SQLite write locks throughout the solve. Match the existing current-year December 15–following-April 30 request season and leave other seasons untouched. Restrict assignment execution to trip-request mode.

Calculate prospective lottery regeneration in memory. Before commit, use a short transaction to compare a canonical fingerprint of relevant current inputs and mode against the captured snapshot. If anything relevant changed, reject the result as stale and ask the admin to rerun. Persist all request outcomes, regenerated lottery values, and private run metadata in the same transaction. Any write failure rolls back the whole run. Competing assignment runs must not overwrite a newer committed result; include outcome/version state in snapshot concurrency checks.

Map selected ordinary rows and both traverse rows to granted with hut and guest count. Other choices of a served requestor become not-used; all choices of an unserved requestor become lost-lottery. Audit text explains global choice scoring and group-size adjustment rather than asserting that every unselected request failed a local capacity check. Keep requested guest bounds, durable IDs, combination links, notification identities, and contention timestamps intact. Assignment-only writes do not queue contention emails.

### Explain allocation quality without replacing existing reports

Add a private allocation-run record containing policy version, input fingerprint, score vector, counts by choice and credit level, person-nights, solver status, and elapsed time. Return a summary from successful assignment and expose it in the efficiency report alongside existing percentage rows. Mark a saved run summary stale after relevant requests/credits/outcomes change; do not imply it describes newer data. Show whether a run completed optimally or failed, with actionable errors and no partial-success message.

## Risks / Trade-offs

- [Integer optimization can take unpredictable time] → Isolated execution, an overall time budget, representative/dense benchmarks, explicit failure, and preservation of existing grants.
- [Aggregate credit-level scores can move individual winners] → Document group-level precedence and final fairness ties; show score summaries and audits.
- [Penalty 10 is not universally worse than every possible rank] → Preserve the explicitly agreed formula and document ranks 10 and above without changing validation silently.
- [Independent solve becomes stale during editing] → Compare relevant inputs and outcome version inside the commit transaction.
- [Floating-point solver tolerances or incorrect traversal modeling violate capacity] → Exact input units, explicit integer constraints, independent validation, and exhaustive small-instance oracles.
- [Optimized outcomes differ from live contention colors] → Keep both labeled as demand estimates versus final grant results; changing prediction semantics is a separate change.

## Migration Plan

1. Select/package the solver adapter and establish objective/feasibility oracle fixtures before replacing the assignment path.
2. Add private run metadata and atomic commit support; existing requests require no guest-bound or credit migration.
3. Compare the old and new algorithms on isolated representative fixtures; verify volunteer-score precedence and record person-night differences without writing production outcomes.
4. Deploy with documented solver runtime and timeout configuration, updated admin messages, and regression checks. Running assignment is an explicit admin action; deployment does not reassign existing requests.
5. Roll back application code while retaining additive run records; previously committed grants remain until an admin deliberately reruns assignment. Document that old code uses the former greedy policy.

## Open Questions

No policy questions block implementation. The concrete solver package/runtime and measured worst-case performance must be resolved by the first adapter task; implementation must not quietly weaken optimality or credit precedence to accommodate a backend.

### Implemented solver selection

The adapter uses pinned `highs@1.15.3` (HiGHS compiled to WebAssembly, MIT license) with its packaged CommonJS loader and WASM runtime. Node loads the packaged runtime without Python, native add-ons, or a solver executable. Each stage uses mixed-integer constraints, zero relative/absolute MIP gap, and requires the explicit `Optimal` result status. A worker thread hosts synchronous WASM execution, with an independent parent deadline terminating unfinished work. Source/API reference: https://github.com/lovasoa/highs-js.

Representative 90-requestor/300-row development benchmarks completed optimally in 6.6 seconds (season-distributed fixture) and 10.1 seconds (dense same-night competition). Both include 276 staged objective solves and stay within the 30-second default. These measurements establish fixture performance, not a universal runtime guarantee; incomplete runs preserve prior outcomes.
