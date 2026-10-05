## Why

The optimizer still favors volunteers open to fewer huts when allocation objectives tie, which can reward restricting preferences. Global allocation already accounts for constrained choices, so remove this fairness preference and let additional hut options expand feasible placements.

## What Changes

- Remove hut count and minimum hut flexibility across choices from the requestor fairness order.
- After optimal credit-level choice scores and person-nights are fixed, order requestors by years of service descending, lottery number ascending, and requestor ID ascending.
- Use that same order for remaining guest-count ties; preserve deterministic option/hut resolution.
- Continue using allowed huts and linked traverse routes as feasibility constraints and retaining calculated flexibility fields for display/export.
- Advance the allocation policy version and identify saved summaries from the earlier policy as out of date without automatically reassigning existing grants.
- Update regression fixtures and documentation to verify restrictive choices no longer provide a fairness advantage.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `trip-allocation-optimization`: Remove hut flexibility from deterministic final fairness ties. This capability is introduced by the completed, unarchived `optimize-trip-request-allocation` change, which precedes this change.
- `admin-operations`: Update lottery tiebreak semantics and identify earlier-policy allocation summaries as out of date.

## Impact

- `src/services/allocationModel.js`, its fairness-dependent solver stages and oracle fixtures, allocation policy metadata/report freshness, README, and assignment tests.
- Builds on `optimize-trip-request-allocation`; sync/archive that predecessor's specs before syncing/archiving this follow-up so its modified requirements have the correct baseline.
- No new dependency, credit/group-bound migration, or automatic assignment run.
