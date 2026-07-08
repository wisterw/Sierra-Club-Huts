# relational-persistence Specification

## Purpose
TBD - created by archiving change assignment-lottery-tiebreaks. Update Purpose after archive.
## Requirements
### Requirement: Requestor lottery value persistence
The system SHALL persist a `lottery_value` field on requestors for use as the assignment tie-break value.

#### Scenario: Lottery value survives reload
- **WHEN** a requestor has a lottery value assigned and the application restarts
- **THEN** the requestor's stored lottery value remains available for later assignment runs

### Requirement: Nullable initial lottery value
The system SHALL allow requestor lottery values to be null or empty until the first lottery regeneration or assignment run assigns them.

#### Scenario: Existing requestor imported without lottery value
- **WHEN** an existing requestor is imported from legacy data that has no lottery value column
- **THEN** the requestor record is created with a null or empty lottery value

### Requirement: Lottery value updates do not alter requestor identity
Updating a requestor's lottery value SHALL NOT change the requestor's identity or any unrelated profile fields.

#### Scenario: Lottery value is refreshed
- **WHEN** the system regenerates a requestor's lottery value
- **THEN** the requestor's email, credits, and other profile fields remain unchanged

