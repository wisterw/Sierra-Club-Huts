## MODIFIED Requirements

### Requirement: Assignment algorithm
The system SHALL run an allocation optimizer according to the trip-allocation-optimization requirements: minimize credit-level choice-score totals from highest credits to lowest, then maximize person-nights, then apply deterministic fairness ties. It SHALL record granted hut, guest count, lottery value, and explanatory audit information. It MUST preserve existing outcomes when optimization fails, is incomplete, or becomes stale, and commit successful results atomically with lottery changes and run metadata.

#### Scenario: Assignment grants available request
- **WHEN** an admin runs assignment and the optimizer selects a feasible request
- **THEN** the request is marked granted with granted hut, granted spots, lottery value, and assignment audit information

#### Scenario: Unfulfilled request is marked lost
- **WHEN** assignment completes optimally and a requestor receives no choice
- **THEN** that requestor's in-scope requests are marked lost-lottery

#### Scenario: request is not needed
- **WHEN** assignment completes and another choice of the same requestor was granted
- **THEN** the unused request is marked not-used

#### Scenario: Optimization cannot complete
- **WHEN** the optimizer times out, fails validation, or detects stale inputs
- **THEN** the admin receives an unsuccessful result with a reason and existing grants and lottery values remain unchanged

### Requirement: Assignment uses lottery number
The system SHALL use lower stored lottery numbers to prefer requestors when optimal credit-level choice scores, maximum person-nights, flexibility, years of service, and earlier deterministic fairness criteria tie. Lottery MUST NOT override superior choice scores or person-night outcomes.

#### Scenario: Lottery number breaks a tie
- **WHEN** two requestors remain tied after the allocation objectives, flexibility, and years of service
- **THEN** the requestor with the lower lottery number receives preference in the final allocation tie resolution

### Requirement: Efficiency report
The system SHALL retain group and requested-spot percentages grouped by first choice, second choice, later choices, or no choice. It SHALL additionally report the latest committed optimized run's credit-level choice-score totals, total granted person-nights, policy version, solver completion, and elapsed time. Saved run metrics MUST be identified as stale if relevant allocation inputs or outcomes have changed since that run.

#### Scenario: Efficiency report after assignment
- **WHEN** an admin loads the efficiency report after a successful optimized assignment
- **THEN** it returns existing group/spot percentage rows and the committed allocation-quality summary

#### Scenario: Requests change after assignment
- **WHEN** relevant requests or credits change after the recorded allocation run
- **THEN** the report marks the saved optimization summary stale rather than presenting it as a result for current inputs
