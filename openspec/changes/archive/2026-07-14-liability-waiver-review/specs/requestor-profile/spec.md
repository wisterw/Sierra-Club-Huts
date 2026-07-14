## MODIFIED Requirements

### Requirement: Expanded profile fields
The system SHALL support profile fields for email, first name, last name, address, city, state, ZIP, phone, comments, chainsaw user, chainsaw owner/tuner, other skills, admin flag, credits, years of service, private comments, liability waiver date, and current liability waiver file pointer.

#### Scenario: User views own profile
- **WHEN** an authenticated user opens the Profile tab
- **THEN** the system displays user-editable profile fields, liability waiver download and submit actions, and hides admin-only private fields and waiver file pointer

#### Scenario: Admin views profile
- **WHEN** an admin opens a requestor profile
- **THEN** the system may include admin-only private fields and the current liability waiver file pointer

### Requirement: Field-level response shaping
The system MUST NOT expose private comments, current liability waiver file pointer, or other admin-only fields to non-admin users.

#### Scenario: Non-admin reads own profile
- **WHEN** a non-admin user requests their profile
- **THEN** private comments and current liability waiver file pointer are absent from the response
