## Context

The completed allocation optimizer fixes optimal choice-score totals by descending credit level, then maximum person-nights, then resolves ties in a requestor order. That order currently begins with the minimum number of allowed huts across any of a volunteer's choices, ahead of years of service, lottery, and ID. The same order resolves remaining guest-count ties. This can give a volunteer priority by including a single restrictive choice and can place traverses first because they have one route.

The optimizer already considers all allowed hut placements jointly. It can allocate a constrained volunteer to Benson and a flexible volunteer to Bradley when that improves outcomes without using hut count as a fairness criterion.

## Goals / Non-Goals

**Goals:** Remove the fairness advantage from fewer allowed huts and keep deterministic ranking and guest distribution using service, lottery, and ID after the primary objectives. Distinguish the revised policy in saved run metadata.

**Non-Goals:** Give an explicit bonus for more huts, guarantee that adding a hut improves every individual's outcome, change score/credit/person-night objectives, remove flexibility fields, alter export sorting, change feasible hut options or traverses, or rerun existing allocations at deployment.

## Decisions

### Use service, lottery, and ID for all requestor tie stages

Build the in-scope requestor set directly from normalized choices rather than using a minimum-flexibility map as its membership/ranking source. Order by years of service descending, lottery number ascending, and requestor ID ascending. Remove the derived `flex` ranking value from the allocation model. Keep this shared order for final rank minimization and guest-count/option stages, avoiding a residual restrictive-hut preference in guest distribution.

Allowed huts continue to create feasible options, and traverse legs remain an indivisible route. Preserve the existing canonical hut order for otherwise tied options. Calculated `hut_count_flexibility` remains stored and exported, including existing joined-export sorting; those fields describe requests and do not grant fairness priority.

Alternatives considered: reversing the hut-count comparator would explicitly reward flexibility and introduce another preference ahead of service/lottery. Keeping the comparator would continue rewarding restrictive choices. Removing it allows flexibility to help through available placements while keeping the remaining fairness rules straightforward.

### Version the revised policy without rewriting history

Advance `POLICY_VERSION` from `credit-rank-person-nights-v1` to `credit-rank-person-nights-v2`. New successful runs record the new version. Existing immutable summaries retain their original policy version and measurements. A latest summary is out of date when either its input fingerprint differs or its saved policy version differs from the active version; the existing stale-summary UI can convey that distinction without claiming the old run failed.

Do not automatically overwrite grants or regenerate lottery values. An admin deliberately running assignment may obtain different winners or guest distributions among objective-equivalent allocations. Rollback restores the earlier tie policy; keep run history and grants intact until the next deliberate assignment.

### Verify absence of a fairness bonus, not universal individual monotonicity

Replace the former fixture expecting a less-flexible winner with one where another allowed hut is occupied by a higher-credit request, making the competing allocations equal on choice scores and person-nights. The lottery/service order should decide regardless of hut counts.

Test that adding a restrictive lower choice does not change requestor fairness order, and that differing hut counts cannot override service or lottery. Check remaining guest-count ties with equal primary objectives. Retain the exhaustive allocation oracle, updating its fairness order, and verify that extra hut options still permit better placements when capacity is available. Do not assert an individual always benefits from broader options: expanding the global feasible set can change an optimal allocation while preserving or improving the objective vector.

## Risks / Trade-offs

- [Objective-equivalent winners change] → Version the policy, document the revised rules, and retain service/lottery/ID determinism.
- [Removing the ranking map accidentally omits requestors] → Build membership from all normalized logical choices and check combination and multi-choice fixtures.
- [Old run appears current after deployment] → Include active policy version in summary freshness checks while preserving historical values.
- [Pending predecessor specs overwrite the follow-up] → Sync/archive `optimize-trip-request-allocation` before this change; leave its historical artifacts intact during proposal creation.

## Migration Plan

1. Implement the comparator/membership update and policy version increment; no schema migration or new dependency is required.
2. Update objective-equivalent fairness, guest distribution, exhaustive-oracle, and report-freshness fixtures; run relevant allocation and browser/report regressions.
3. Deploy the revised policy and documentation without executing assignment automatically. Existing grants remain until a deliberate admin run.
4. Sync/archive the completed optimizer predecessor before syncing/archiving this follow-up. This proposal does not itself archive or sync either change.

## Open Questions

None. The revised final order is years of service, lottery number, then requestor ID; hut flexibility remains a feasibility property and descriptive field.
