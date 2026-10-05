## MODIFIED Requirements

### Requirement: Assignment uses lottery number
The system SHALL use lower stored lottery numbers to prefer requestors when optimal credit-level choice scores, maximum person-nights, and years of service tie, followed by requestor ID for determinism. Hut flexibility MUST NOT precede or override service or lottery in requestor fairness or remaining guest-count tie resolution. Lottery MUST NOT override superior choice scores or person-night outcomes.

#### Scenario: Lottery number breaks a tie
- **WHEN** two requestors remain tied after the allocation objectives and years of service
- **THEN** the requestor with the lower lottery number receives preference in the final allocation tie resolution regardless of allowed hut counts

### Requirement: Efficiency report
The system SHALL retain group and requested-spot percentages grouped by first choice, second choice, later choices, or no choice. It SHALL additionally report the latest committed optimized run's credit-level choice-score totals, total granted person-nights, policy version, solver completion, and elapsed time. Saved run metrics MUST be identified as stale if relevant allocation inputs or outcomes have changed since that run or the saved policy version differs from the active allocation policy. Historical metrics and policy versions MUST NOT be rewritten to imply a new assignment ran.

#### Scenario: Efficiency report after assignment
- **WHEN** an admin loads the efficiency report after a successful optimized assignment under the active policy
- **THEN** it returns existing group/spot percentage rows and the committed allocation-quality summary

#### Scenario: Requests change after assignment
- **WHEN** relevant requests or credits change after the recorded allocation run
- **THEN** the report marks the saved optimization summary stale rather than presenting it as a result for current inputs

#### Scenario: Earlier tie policy
- **WHEN** the latest recorded allocation used the earlier policy that prioritized fewer huts and inputs are otherwise unchanged
- **THEN** the report retains that run's metrics and earlier policy version and marks its summary out of date until an admin completes a new assignment
