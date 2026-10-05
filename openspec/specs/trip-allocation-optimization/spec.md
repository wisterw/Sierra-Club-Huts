# trip-allocation-optimization Specification

## Purpose

Define trip allocation optimization behavior for the volunteer hut reservation application.

## Requirements

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
The system SHALL apply years of service descending, stored lottery number ascending, and requestor ID ascending only after fixing all optimal credit-level choice scores and maximum person-nights. Hut count, minimum hut flexibility across choices, and traverse route count MUST NOT influence requestor fairness order. The system SHALL use the same requestor order for remaining guest-count ties and preserve deterministic canonical hut/option resolution. It MUST preserve default lottery regeneration, the disabled-regeneration option, seeded reproducibility, and lower lottery numbers winning when earlier criteria tie. Allowed huts and linked traverse routes SHALL remain feasibility constraints.

#### Scenario: Lottery resolves otherwise equal outcomes
- **WHEN** only one of two otherwise equivalent requestors can be served and their score/person-night outcomes and years of service tie
- **THEN** the lower preserved lottery number wins, regardless of the number of allowed huts

#### Scenario: Restrictive extra choice
- **WHEN** a volunteer adds a lower choice open to only one hut
- **THEN** that restriction does not advance them in the requestor fairness order

#### Scenario: Service precedes lottery without hut-count priority
- **WHEN** two objective-equivalent allocations differ in which volunteer is favored and one volunteer has more years of service but more allowed huts
- **THEN** years of service determines the final preference before lottery rather than favoring the narrower hut choice

#### Scenario: Broader options enable both volunteers
- **WHEN** one volunteer allows Benson only, another allows Benson or Bradley, and both can be accommodated by using different huts
- **THEN** both can receive their choices through feasibility optimization without giving fewer allowed huts a fairness bonus

#### Scenario: Guest-count ties
- **WHEN** score and person-night objectives and awarded ranks are fixed but surplus guests can be distributed in multiple ways
- **THEN** remaining guest-count ties use the service/lottery/ID requestor order without a hut-count preference

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
