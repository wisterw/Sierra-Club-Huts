## ADDED Requirements

### Requirement: Admin grid private comments
The system SHALL allow admin users to add or update private requestor comments from the volunteer management grid.

#### Scenario: Admin updates comments from grid
- **WHEN** an admin saves private comments for a volunteer from volunteer management
- **THEN** the requestor's private comments are persisted and available in admin-only views

### Requirement: Admin grid waiver approval
The system SHALL allow admin users to approve a volunteer's liability waiver from the volunteer management grid.

#### Scenario: Admin approves current-year waiver from grid
- **WHEN** an admin accepts a volunteer's liability waiver from volunteer management
- **THEN** the requestor's waiver approval status is updated for the current year

### Requirement: Private fields remain hidden from non-admins
Volunteer management MUST NOT expose private comments, admin-only waiver approval controls, or admin-only profile fields to non-admin users.

#### Scenario: Non-admin reads profile after admin grid update
- **WHEN** a non-admin reads their own profile after an admin updated private comments
- **THEN** private comments are absent from the response

