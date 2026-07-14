# admin-work-party-management Specification

## Purpose
Admins can set up and maintain work parties from the Admin console.

## Requirements
### Requirement: Admin work-party list
The system SHALL provide an admin-only current-year work-party management list.

#### Scenario: Admin views current-year work parties
- **WHEN** an admin opens the Set up work parties section
- **THEN** the system lists current-year work parties with hut, Friday check-in date, Sunday check-out date, leader, leader contact, capacity, comments, and availability

#### Scenario: Non-admin requests management list
- **WHEN** a non-admin user requests the work-party management list
- **THEN** the system rejects the request

### Requirement: Work-party creation
The system SHALL allow admins to create work parties.

#### Scenario: Admin creates work party
- **WHEN** an admin submits hut, Friday check-in date, Sunday check-out date, leader, capacity, comments, and availability for a new work party
- **THEN** the system creates the work party and it appears in the admin list

#### Scenario: Admin creates duplicate work party
- **WHEN** an admin submits a work party with the same hut and Friday check-in date as an existing work party
- **THEN** the system rejects the create request

### Requirement: Work-party editing
The system SHALL allow admins to edit non-key work-party details.

#### Scenario: Admin edits work party details
- **WHEN** an admin updates Sunday check-out date, leader, leader contact, capacity, comments, or availability for an existing work party
- **THEN** the system persists the updated details

#### Scenario: Admin attempts to edit work-party identity
- **WHEN** an admin edits an existing work party
- **THEN** hut and Friday check-in date remain unchanged

### Requirement: Work-party deletion
The system SHALL allow admins to delete work parties after confirmation.

#### Scenario: Admin deletes work party
- **WHEN** an admin confirms deletion of a work party
- **THEN** the system removes the work party and its associated volunteer applications

#### Scenario: Admin cancels deletion
- **WHEN** an admin cancels deletion of a work party
- **THEN** the system leaves the work party and associated volunteer applications unchanged

### Requirement: Leader options
The system SHALL provide admin users as leader options for work-party setup.

#### Scenario: Admin selects leader
- **WHEN** an admin selects a leader from the leader selector
- **THEN** the system populates leader display and contact fields from that admin user where available

### Requirement: Availability management
The system SHALL allow admins to set work-party availability to `open`, `waitlist-only`, or `closed`.

#### Scenario: Admin sets availability
- **WHEN** an admin saves a work party with a supported availability value
- **THEN** the system persists that availability value

#### Scenario: New applicants exceed capacity
- **WHEN** new volunteer applications make pending plus accepted plus waitlisted applicants exceed capacity for an open work party
- **THEN** the existing automatic waitlist-only transition still applies
