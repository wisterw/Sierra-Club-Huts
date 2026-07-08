# admin-operations Specification

## Purpose
TBD - created by archiving change assignment-lottery-tiebreaks. Update Purpose after archive.
## Requirements
### Requirement: Lottery number regeneration
The system SHALL allow an admin user to regenerate lottery numbers for requestors as a separate action from running the assignment algorithm.

#### Scenario: Admin regenerates lottery numbers
- **WHEN** an admin triggers the lottery regeneration action
- **THEN** the system assigns new random lottery numbers to requestors according to the current regeneration rules

### Requirement: Assignment uses lottery number
The system SHALL use lottery number as the final tiebreak for assignment, with lower lottery numbers winning over higher lottery numbers after all earlier preference criteria are applied.

#### Scenario: Lottery number breaks a tie
- **WHEN** two candidates remain tied after credits, request impact, flexibility, and other earlier criteria
- **THEN** the candidate with the lower lottery number is ordered first for assignment consideration

### Requirement: Assignment can optionally regenerate lottery numbers
The assignTrips endpoint SHALL accept a regeneration flag that controls whether lottery numbers are refreshed before assignment, and the default behavior SHALL regenerate them.

#### Scenario: Default regeneration
- **WHEN** an admin runs assignment without providing the regeneration flag
- **THEN** the system regenerates lottery numbers before evaluating assignment

#### Scenario: Preserve existing lottery numbers
- **WHEN** an admin runs assignment with the regeneration flag set to false
- **THEN** the system preserves existing non-null lottery numbers and only fills in missing values

### Requirement: Admin UI exposes lottery regeneration
The admin interface SHALL expose a control for regenerating lottery numbers when running assignment.

#### Scenario: Admin sees regeneration control
- **WHEN** an admin opens the assignment action in the admin UI
- **THEN** the lottery regeneration control is visible and defaulted to on

