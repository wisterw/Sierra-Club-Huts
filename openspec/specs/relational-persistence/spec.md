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

