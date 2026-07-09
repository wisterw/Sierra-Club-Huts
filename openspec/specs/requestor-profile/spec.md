# requestor-profile Specification

## Purpose
TBD - created by archiving change align-code-with-current-main-specs. Update Purpose after archive.
## Requirements
### Requirement: Expanded profile fields
The system SHALL support profile fields for email, first name, last name, address, city, state, ZIP, phone, comments, chainsaw user, chainsaw owner/tuner, other skills, admin flag, credits, years of service, private comments, and liability waiver date.

#### Scenario: User views own profile
- **WHEN** an authenticated user opens the Profile tab
- **THEN** the system displays user-editable profile fields and hides admin-only private fields

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
The system MUST NOT expose private comments or other admin-only fields to non-admin users.

#### Scenario: Non-admin reads own profile
- **WHEN** a non-admin user requests their profile
- **THEN** private comments are absent from the response

