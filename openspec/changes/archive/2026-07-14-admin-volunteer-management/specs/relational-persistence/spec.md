## ADDED Requirements

### Requirement: Work-party status persistence
The system SHALL persist work-party accepted status and attendance status independently for each requestor/work-party intersection.

#### Scenario: Accepted status survives restart
- **WHEN** an admin marks a volunteer accepted for a work party and the application restarts
- **THEN** the accepted status remains associated with that requestor and work party

#### Scenario: Attendance status survives restart
- **WHEN** an admin records attendance status for a work party request and the application restarts
- **THEN** the attendance status remains associated with that requestor and work party

### Requirement: Volunteer management data access boundary
The system SHALL provide repository or service functions for volunteer grid filtering, row shaping, and row action mutations.

#### Scenario: Volunteer grid reads through data boundary
- **WHEN** the admin volunteer grid loads filtered data
- **THEN** route handlers obtain volunteer rows through repository or service functions rather than directly composing storage internals in the route

#### Scenario: Volunteer row action writes through data boundary
- **WHEN** an admin updates private comments, waiver approval, accepted status, or attendance status
- **THEN** route handlers delegate persistence to repository or service functions

### Requirement: Current-year waiver approval persistence
The system SHALL persist enough requestor waiver approval data to determine whether a volunteer's waiver is approved for the current year.

#### Scenario: Waiver approval survives restart
- **WHEN** an admin approves a volunteer's waiver for the current year and the application restarts
- **THEN** the volunteer remains filterable as waiver approved for this year
