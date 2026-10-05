## ADDED Requirements

### Requirement: Credit-level choice score objective
The system SHALL score each requestor with in-scope choices once using the granted logical choice number or 10 when unassigned. It SHALL minimize summed scores separately for exact credit levels, comparing levels lexicographically from highest credits to lowest. Lower-credit improvements MUST NOT worsen the optimal score of a higher-credit level. Group size MUST NOT weight the requestor score.

#### Scenario: Balanced ranks beat one first choice
- **WHEN** equal-credit feasible alternatives grant one first choice and leave three unassigned, or grant four second choices
- **THEN** the system prefers score 8 over score 31

#### Scenario: Credit precedence
- **WHEN** serving lower-credit requestors would increase the best higher-credit score
- **THEN** the system preserves the higher-credit score even if an unrestricted total score would improve

#### Scenario: Score tie across ranks
- **WHEN** equal-credit alternatives grant ranks 1 and 3 or ranks 2 and 2
- **THEN** both score 4 and later objectives decide the allocation

#### Scenario: Literal unassigned penalty
- **WHEN** a requestor has a choice numbered 10 or greater
- **THEN** the granted score is that literal rank, unassigned remains 10, and no silent clamping or new choice-count limit occurs

### Requirement: Joint feasible choice and group-size allocation
The system SHALL allocate at most one logical choice per requestor, grant integer guests between that choice's minimum and ideal, use one allowed hut for an ordinary choice's entire stay, and respect capacity on every occupied hut-night. It SHALL reconsider earlier hut and guest allocations across all credit levels while preserving superior score objectives. It MUST NOT permanently grant ideal guest counts before evaluating other requestors.

#### Scenario: Reduce ideal to accommodate another volunteer
- **WHEN** a higher-credit group requests minimum 4 and ideal 12 at a 12-person hut and a lower-credit group requests 4 on the same nights
- **THEN** both choices are granted when feasible without worsening higher-credit scores, with the first group receiving 8 and the second receiving 4

#### Scenario: Flexible minimum does not consume capacity prematurely
- **WHEN** equal-credit groups request minimum 2 ideal 12 and minimum 2 ideal 2 at the same 12-person hut
- **THEN** both receive their choices, with the first group receiving 10 guests and the second 2

#### Scenario: Multi-night capacity
- **WHEN** a selected hut has capacity on all but one occupied night
- **THEN** the system respects the limiting night and does not substitute a different hut for part of an ordinary stay

### Requirement: Atomic traverse choices
The system SHALL treat linked combination legs as one logical choice for scoring and selection, require feasible capacity on both legs, and grant the same guest count on both. Invalid links or incompatible guest bounds MUST fail before any grant is persisted.

#### Scenario: Both legs required
- **WHEN** a traverse's first leg fits but the second cannot fit its minimum
- **THEN** neither leg is granted as that choice

#### Scenario: Traverse counts once
- **WHEN** both legs of choice 2 are granted to one requestor
- **THEN** that requestor contributes score 2 once and person-nights count each occupied leg night once

### Requirement: Person-night objective after choice scores
Among allocations with identical optimal scores at every credit level, the system SHALL maximize granted guests multiplied by occupied nights, up to requested ideals. Smaller groups SHALL receive no unconditional preference when they do not improve choice scores.

#### Scenario: Larger group when volunteer outcomes tie
- **WHEN** equal-credit groups requiring 4 or 9 guests compete for the same 12-person hut on identical dates and only one can fit
- **THEN** the 9-person group is granted because the score vectors tie and it yields more person-nights

#### Scenario: Smaller groups improve outcomes
- **WHEN** two equal-credit groups of 2 compete against a group of 9 on identical dates at the same 12-person hut
- **THEN** both smaller groups win because their combined choice-score outcome is better despite fewer person-nights

### Requirement: Deterministic final fairness ties
The system SHALL apply flexibility, years of service, and stored lottery fairness only after fixing all optimal choice scores and maximum person-nights, using the deterministic order defined in the design. It MUST preserve default lottery regeneration, the disabled-regeneration option, seeded reproducibility, and lower lottery numbers winning when earlier criteria tie.

#### Scenario: Lottery resolves otherwise equal outcomes
- **WHEN** only one of two otherwise equivalent requestors can be served and their score/person-night outcomes and earlier fairness criteria tie
- **THEN** the lower preserved lottery number wins

### Requirement: Proven completion and safe persistence
The system SHALL solve within an enforced execution budget outside the web request event loop, independently validate returned allocations, and persist only complete proven-optimal results across all phases. It SHALL revalidate snapshot inputs and commit outcomes, prospective lottery changes, and run metadata atomically. Failure, timeout, stale inputs, or incomplete proof MUST preserve existing grants and lottery values.

#### Scenario: Feasible but unfinished solve
- **WHEN** the solver reaches its deadline with a feasible incumbent but has not proved the required objectives optimal
- **THEN** the run reports failure and does not overwrite existing outcomes

#### Scenario: Concurrent request edit
- **WHEN** a relevant request or credit changes after the solve snapshot and before commit
- **THEN** the stale allocation is rejected without writing grants or lottery values

#### Scenario: Atomic write failure
- **WHEN** any outcome, lottery, or run-metadata write fails during commit
- **THEN** all writes from that assignment run roll back

### Requirement: Scoped and explainable outcomes
The system SHALL optimize the current request season in trip-request mode, preserve other seasons, and explain globally selected choices and guest reductions in audits. Unselected choices of served requestors SHALL become not-used; choices of unserved requestors SHALL become lost-lottery. Existing request identities, group bounds, combination links, and contention notification fields MUST be preserved.

#### Scenario: Later choice granted
- **WHEN** a requestor receives choice 3 under the optimized allocation
- **THEN** its other choices are not-used and audit text identifies the awarded choice rather than claiming each alternative failed a local capacity test

#### Scenario: Assignment preserves alert state
- **WHEN** an optimized allocation commits
- **THEN** assignment-only changes do not reset contention transition/email timestamps or queue contention alerts
