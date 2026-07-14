# requestor-profile Specification

## Purpose
TBD - created by archiving change align-code-with-current-main-specs. Update Purpose after archive.
## Requirements
### Requirement: Expanded profile fields
The system SHALL support profile fields for email, first name, last name, address, city, state, ZIP, phone, comments, chainsaw user, chainsaw owner/tuner, other skills, admin flag, credits, years of service, private comments, liability waiver date, and current liability waiver file pointer.

#### Scenario: User views own profile
- **WHEN** an authenticated user opens the Profile tab
- **THEN** the system displays user-editable profile fields, liability waiver download and submit actions, and hides admin-only private fields and waiver file pointer

#### Scenario: Admin views profile
- **WHEN** an admin opens a requestor profile
- **THEN** the system may include admin-only private fields and the current liability waiver file pointer

### Requirement: User-editable profile fields
The system SHALL allow users to update their mutable non-admin profile fields.

#### Scenario: User saves chainsaw fields
- **WHEN** a user saves chainsaw skill values on their profile
- **THEN** the system persists those values for the requestor

### Requirement: Admin-only profile fields
The system MUST restrict admin flag, credits, private comments, and liability waiver date mutation to admin users.

#### Scenario: Non-admin attempts admin field update
- **WHEN** a non-admin user submits an update containing credits or admin-only fields
- **THEN** the system ignores or rejects those admin-only changes

#### Scenario: Admin updates another requestor
- **WHEN** an admin updates credits or liability waiver date for a requestor
- **THEN** the system persists the admin-only field changes

### Requirement: Field-level response shaping
The system MUST NOT expose private comments, current liability waiver file pointer, or other admin-only fields to non-admin users.

#### Scenario: Non-admin reads own profile
- **WHEN** a non-admin user requests their profile
- **THEN** private comments and current liability waiver file pointer are absent from the response

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
