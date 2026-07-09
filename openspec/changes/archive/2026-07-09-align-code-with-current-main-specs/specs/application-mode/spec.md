## ADDED Requirements

### Requirement: Persisted application mode
The system SHALL store the current application mode as one of `work-party`, `trip-request`, or `inactive`.

#### Scenario: Mode persists across restart
- **WHEN** an administrator changes the application mode and the application restarts
- **THEN** the previously selected mode remains active

### Requirement: Admin can change mode
The system SHALL allow admin users to view and change the current application mode.

#### Scenario: Admin changes mode
- **WHEN** an admin selects Trip Request mode and saves
- **THEN** the system persists Trip Request mode and returns it in subsequent mode reads

#### Scenario: Non-admin cannot change mode
- **WHEN** a non-admin user attempts to change the application mode
- **THEN** the system rejects the request

### Requirement: End-user tabs respect mode
The frontend SHALL make Work Party the default selectable tab in Work Party mode, Trip Request the default selectable tab in Trip Request mode, and disable unavailable workflow tabs with the specified hover messages.

#### Scenario: Work Party mode tabs
- **WHEN** the current mode is Work Party
- **THEN** the Work Party tab is selected by default and the Trip Request tab is disabled with the trip-request unavailable hover message

#### Scenario: Trip Request mode tabs
- **WHEN** the current mode is Trip Request
- **THEN** the Trip Request tab is selected by default and the Work Party tab is disabled with the work-party unavailable hover message

#### Scenario: Inactive mode tabs
- **WHEN** the current mode is Inactive
- **THEN** workflow tabs are disabled and Profile remains available
