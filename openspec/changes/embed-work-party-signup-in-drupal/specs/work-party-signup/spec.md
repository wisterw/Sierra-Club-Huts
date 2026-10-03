## ADDED Requirements

### Requirement: URL-selected single-party signup
The system SHALL allow an authenticated requestor to view and save interest for exactly the work party resolved from a canonical focused URL.

#### Scenario: View one selected work party
- **WHEN** an authenticated requestor opens a valid canonical work-party URL
- **THEN** the system displays only that work party with its dates, hut, leader, hike-in comments, availability, the requestor's interest, and the requestor's current accepted and attendance statuses

#### Scenario: Save interest for selected party
- **WHEN** an authenticated requestor selects an allowed interest value and saves from the focused form
- **THEN** the system persists the value only for that requestor and the URL-selected work party

#### Scenario: Client supplies a different work-party identity
- **WHEN** a focused save request includes a requestor ID, hut, or date that differs from the authenticated session and canonical route
- **THEN** the system ignores or rejects the client-supplied identity and does not modify another requestor or work party

#### Scenario: Save no thank you
- **WHEN** an authenticated requestor saves `no thank you` from the focused form
- **THEN** the system removes or omits that requestor's explicit request for the URL-selected work party

### Requirement: Focused signup status display
The system SHALL show work-party availability and the authenticated requestor's interest, accepted status, and attendance status as appropriate, while keeping administrative statuses read-only.

#### Scenario: Returning volunteer sees saved state
- **WHEN** an authenticated requestor returns to a focused work-party URL after previously saving interest
- **THEN** the form displays the saved interest and current accepted and attendance statuses

#### Scenario: End user attempts status modification
- **WHEN** a non-admin requestor uses the focused form
- **THEN** no control permits changing availability, accepted status, or attendance status

### Requirement: Focused signup requires authentication
The system MUST require an authenticated requestor before returning private interest or status data or accepting a focused interest save.

#### Scenario: Unauthenticated visitor opens a valid party
- **WHEN** a visitor without a valid session opens a valid canonical work-party URL
- **THEN** the system may show public work-party context but requires returning-user authentication or verified registration before showing private status or accepting interest

#### Scenario: Session expires before save
- **WHEN** a requestor's session expires before a focused interest save
- **THEN** the system rejects the save and returns the focused experience to authentication without changing stored interest
