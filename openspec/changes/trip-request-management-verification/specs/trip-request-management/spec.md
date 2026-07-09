## ADDED Requirements

### Requirement: Durable ski trip request records
The system SHALL store each ski trip request with a durable `Request_ID`, requestor association, hut booleans, dates, choice number, spot counts, granted values, status, lottery value, timestamps, flexibility count, Saturday week number, and optional combination linkage.

#### Scenario: New request receives ID
- **WHEN** a user saves a new ski trip request
- **THEN** the system stores the request with a durable request ID

### Requirement: Trip request validation
The system SHALL validate trip requests before saving according to date order, season bounds, trip length, hut selection, spot counts, choice number, and combination-trip rules.

#### Scenario: Invalid date order is rejected
- **WHEN** a request has a departure date on or before its arrival date
- **THEN** the system rejects the save with a validation error

#### Scenario: Combination traverse date is validated
- **WHEN** a combination trip has a traverse date outside the arrival-departure range
- **THEN** the system rejects the save with a validation error

### Requirement: Choice numbers remain sequential
The system SHALL renumber saved choices to preserve relative order while closing gaps.

#### Scenario: Choice gap is closed
- **WHEN** a user saves choices numbered 1, 2, and 4
- **THEN** the system stores them as choices 1, 2, and 3 in the same relative order

### Requirement: Calculated request fields update on change
The system SHALL update `hut_count_flexibility` and `saturday_week_number` whenever a ski trip request changes.

#### Scenario: Multi-hut request updates flexibility
- **WHEN** a request is saved with Benson and Bradley selected
- **THEN** the stored `hut_count_flexibility` is 2

### Requirement: Availability summary
The system SHALL calculate availability summaries by date and hut for the selected choice number and requestor using higher-priority spots, same-priority spots, and same-priority group counts.

#### Scenario: Higher credit first choices count as higher priority
- **WHEN** a higher-credit requestor has a first-choice request on the same hut and date
- **THEN** those ideal spots contribute to higher-priority spots for the selected requestor's availability summary

#### Scenario: Same-priority groups are counted
- **WHEN** multiple same-credit requestors have the same choice number on a hut and date
- **THEN** the summary includes their minimum spots and distinct group count

### Requirement: Combination trips use linked rows
The system SHALL represent Benson-to-Bradley and Bradley-to-Benson trips as two linked ski trip request rows with the same choice number and contiguous dates.

#### Scenario: Combination trip is saved
- **WHEN** a user saves a Benson-to-Bradley trip with a traverse date
- **THEN** the system stores a Benson segment and a Bradley segment linked by `Combination_first_request`
