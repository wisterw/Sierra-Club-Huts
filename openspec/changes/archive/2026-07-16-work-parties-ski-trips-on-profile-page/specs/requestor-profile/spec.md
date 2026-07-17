## ADDED Requirements

### Requirement: Profile work-party history
The system SHALL display below the profile fields a read-only work-party history for the requestor whose profile is being viewed. The history SHALL include that requestor's past work-party request records and current or future work-party request records that remain pending, and SHALL identify each work party by hut and date while showing its recorded request, accepted, and attendance statuses when available.

#### Scenario: User has past and pending work parties
- **WHEN** an authenticated user opens their profile and has both a past work-party request and a current or future pending work-party request
- **THEN** the Profile tab displays both records below the profile fields with their hut, date, and available statuses

#### Scenario: Completed future work party is not history
- **WHEN** a requestor has a future work-party request whose accepted status is no longer pending
- **THEN** the Profile tab does not include that future record in the past-and-pending work-party history

#### Scenario: No matching work-party history
- **WHEN** the profile requestor has no past or current/future pending work-party requests
- **THEN** the Profile tab displays a clear empty-state message in the work-party history section

### Requirement: Profile current ski-trip requests
The system SHALL display below the work-party history a read-only summary of the profile requestor's current stored ski-trip reservation requests, including each request's choice number, selected hut or huts, arrival and departure dates, requested spot counts, and status.

#### Scenario: User has current ski-trip requests
- **WHEN** an authenticated user opens their profile and has current stored ski-trip reservation requests
- **THEN** the Profile tab displays those requests below the work-party history in choice order with their request details and status

#### Scenario: No current ski-trip requests
- **WHEN** the profile requestor has no current stored ski-trip reservation requests
- **THEN** the Profile tab displays a clear empty-state message in the ski-trip request section

### Requirement: Profile history follows the authorized profile target
The system MUST load work-party history and ski-trip requests for the requestor whose profile was authorized and opened, rather than always loading data for the signed-in requestor.

#### Scenario: Admin views another requestor
- **WHEN** an admin opens another requestor's profile
- **THEN** the work-party history and ski-trip request sections display that requestor's records

#### Scenario: Non-admin requests another requestor's history
- **WHEN** a non-admin attempts to open another requestor's profile
- **THEN** the system denies access without exposing that requestor's work-party history or ski-trip requests
