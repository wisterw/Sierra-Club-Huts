# work-party-signup Specification

## Purpose
TBD - created by archiving change align-code-with-current-main-specs. Update Purpose after archive.
## Requirements
### Requirement: Current-year work party list
The system SHALL show authenticated users the current-year work parties in chronological order with dates, hut, leader, hike-in comments, availability, user interest, and user status.

#### Scenario: User views work parties
- **WHEN** a user opens the Work Party tab in Work Party mode
- **THEN** the system displays only work parties for the current year in chronological order

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

