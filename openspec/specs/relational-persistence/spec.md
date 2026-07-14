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

### Requirement: Database-backed persistence
The system SHALL persist requestors, ski trip requests, work parties, work-party requests, and application settings in a lightweight relational database.

#### Scenario: Data survives restart
- **WHEN** a requestor profile or trip request is saved and the application restarts
- **THEN** the saved data is loaded from the database after restart

#### Scenario: Missing database is initialized
- **WHEN** the application starts without an existing database
- **THEN** the system creates the required schema before serving authenticated API requests

### Requirement: Existing TSV data can be migrated
The system SHALL provide a repeatable migration or import path from the existing requestors and requests TSV files into the relational database.

#### Scenario: Existing requestors are imported
- **WHEN** the import runs against a valid requestors TSV file
- **THEN** each valid row is represented as a requestor record in the database

#### Scenario: Existing trip requests are imported
- **WHEN** the import runs against a valid requests TSV file
- **THEN** each valid row is represented as a ski trip request record associated with its requestor

### Requirement: Data access boundary
Backend route handlers MUST access persisted data through repository or service functions rather than directly mutating storage internals.

#### Scenario: Route saves through repository
- **WHEN** an authenticated requestor updates profile data
- **THEN** the route delegates persistence to the requestor data access boundary

### Requirement: Startup validation
The system SHALL fail startup with a console error when required persistence inputs are unavailable or structurally invalid.

#### Scenario: Invalid migration source
- **WHEN** a configured TSV import source exists but has an invalid header row
- **THEN** the import fails with a clear error and does not partially import data

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
