## ADDED Requirements

### Requirement: Work-party accepted status model
The system SHALL represent work-party accepted status separately from attendance status for each work-party request.

#### Scenario: Accepted status values
- **WHEN** a work-party request has an accepted status
- **THEN** the accepted status is blank, pending, accepted, or waitlisted

#### Scenario: Attendance status values
- **WHEN** a work-party request has an attendance status
- **THEN** the attendance status is blank, full attended, partial attended, no show, or cancelled

### Requirement: Admin can update work-party request statuses
The system SHALL allow admin users to update accepted status and attendance status for a volunteer's request to a specific work party.

#### Scenario: Admin accepts volunteer for work party
- **WHEN** an admin marks a volunteer accepted for a selected work party
- **THEN** the system stores accepted status as accepted for that volunteer and work party

#### Scenario: Admin records attendance status
- **WHEN** an admin marks a volunteer full attended, partial attended, no show, or cancelled for a selected work party
- **THEN** the system stores the selected value as attendance status without changing accepted status

