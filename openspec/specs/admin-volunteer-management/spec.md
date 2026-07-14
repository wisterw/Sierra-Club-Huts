# admin-volunteer-management Specification

## Purpose
Admins and work-party leaders can review volunteers/requestors and take scoped operational actions from the Admin console.

## Requirements
### Requirement: Volunteer management grid
The system SHALL provide an admin-only Manage volunteers/requestors grid that lists volunteers with contact, work-party, waiver, skill, private comment, years of service, and ski trip request summary fields.

#### Scenario: Admin views volunteer grid
- **WHEN** an authenticated admin opens the Manage volunteers/requestors section
- **THEN** the system displays a grid containing volunteer name, phone, city, email, applied work parties, admin comments, years of service, chainsaw skill flags, liability waiver status, and hut trip request count

#### Scenario: Non-admin cannot view volunteer grid
- **WHEN** an authenticated non-admin attempts to access volunteer management data
- **THEN** the system rejects the request and does not expose admin-only volunteer fields

### Requirement: Volunteer grid filters
The system SHALL allow admins to filter the volunteer grid by work-party accepted status, work party, ski trip reservation status, and liability waiver approval status.

#### Scenario: Filter by work party
- **WHEN** an admin selects one hut/date work party in the Work party filter
- **THEN** the grid limits or annotates rows for that selected work party so leaders can review that work party's applications

#### Scenario: Filter by work-party accepted status
- **WHEN** an admin selects pending, accepted, or waitlisted in the work-party accepted status filter
- **THEN** the grid shows volunteers matching that accepted status for the selected work-party filter context

#### Scenario: Filter by reservation status
- **WHEN** an admin selects a reservation status filter
- **THEN** the grid filters volunteers by no requests submitted for next year, requests submitted for next year, requests but none granted, or requests granted

#### Scenario: Filter by waiver status
- **WHEN** an admin selects a liability waiver status filter
- **THEN** the grid filters volunteers by waiver approved for this year or no waiver approved for this year

### Requirement: Volunteer row actions
The system SHALL provide row actions for updating private admin comments, approving a liability waiver, and updating work-party accepted or attendance statuses.

#### Scenario: Admin updates private comments
- **WHEN** an admin submits private comments for a volunteer from the row action menu
- **THEN** the system persists the private comments and keeps them visible only to admins

#### Scenario: Admin approves waiver
- **WHEN** an admin accepts a liability waiver for a volunteer from the row action menu
- **THEN** the system records that the volunteer has a waiver approved for the current year

### Requirement: Work-party scoped row actions
The system MUST enable work-party accepted and attendance status row actions only when the Work party filter identifies exactly one work party.

#### Scenario: Work-party actions disabled without specific work party
- **WHEN** the Work party filter is set to show all work parties
- **THEN** actions for marking accepted, waitlisted, full attended, partial attended, no show, or cancelled are disabled or unavailable

#### Scenario: Work-party action targets selected work party
- **WHEN** an admin selects one work party and marks a volunteer accepted from the row action menu
- **THEN** the system updates that volunteer's work-party request for the selected work party only

#### Scenario: Backend rejects ambiguous work-party action
- **WHEN** an admin submits a work-party accepted or attendance status update without one specific work-party key
- **THEN** the system rejects the update without changing any work-party request

### Requirement: Volunteer management authorization
The system MUST restrict volunteer management reads and row actions to authenticated admin users.

#### Scenario: Non-admin attempts volunteer mutation
- **WHEN** a non-admin submits a volunteer management row action
- **THEN** the system rejects the action and leaves the target records unchanged
