# work-party-signup Specification

## Purpose
TBD - created by archiving change align-code-with-current-main-specs. Update Purpose after archive.
## Requirements
### Requirement: Current-year work party list
The system SHALL show authenticated users the current-year admin-managed work parties in chronological order with dates, hut, leader, hike-in comments, availability, user interest, and user status.

#### Scenario: User views work parties
- **WHEN** a user opens the Work Party tab in Work Party mode
- **THEN** the system displays only admin-managed work parties for the current year in chronological order

#### Scenario: Admin-created work party appears to users
- **WHEN** an admin creates a work party for the current year
- **THEN** authenticated users can see that work party in the Work Party tab

#### Scenario: Admin-deleted work party is removed from user list
- **WHEN** an admin deletes a work party
- **THEN** authenticated users no longer see that work party in the Work Party tab

### Requirement: Work party interest choices
The system SHALL allow users to save one interest value per work party: `no thank you`, `only if you need me`, or `please consider me`.

#### Scenario: User saves interest
- **WHEN** a user selects `please consider me` for a work party and saves
- **THEN** the system persists that user's interest for that work party

#### Scenario: No thank you removes explicit request
- **WHEN** a user saves `no thank you` for a work party
- **THEN** the system treats the missing work-party request as `no thank you`

### Requirement: Work party statuses are read-only to end users
The system SHALL show work party availability and the user's assignment status as read-only values for end users.

#### Scenario: End user cannot edit status
- **WHEN** a non-admin user views a work party card
- **THEN** availability and assignment status controls are not editable

### Requirement: Work party API
The system SHALL provide an authenticated work-party API that returns current-year work parties with the requesting user's selections and saves changed selections.

#### Scenario: Work-party API returns user selection
- **WHEN** an authenticated user requests work parties for a year
- **THEN** each returned work party includes that user's interest and confirmation status when present

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
