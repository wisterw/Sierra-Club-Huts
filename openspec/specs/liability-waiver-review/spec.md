# liability-waiver-review Specification

## Purpose
The system supports volunteer liability waiver submission, private file storage, and admin review/approval.

## Requirements
### Requirement: Blank waiver download
The system SHALL allow authenticated users to download the current blank liability waiver form from their profile.

#### Scenario: User downloads blank waiver
- **WHEN** an authenticated user selects the blank waiver download action
- **THEN** the system returns the configured blank liability waiver file

### Requirement: Waiver submission upload
The system SHALL allow authenticated users to submit a completed liability waiver file for manual review.

#### Scenario: User uploads waiver
- **WHEN** an authenticated user uploads a supported waiver document from their profile
- **THEN** the system stores the file in the waiver storage directory and records it as the requestor's current submitted waiver

#### Scenario: User uploads replacement waiver
- **WHEN** an authenticated user uploads another supported waiver document after already submitting one
- **THEN** the system replaces the current waiver pointer for that requestor without deleting prior waiver files from disk

#### Scenario: User uploads unsupported file
- **WHEN** an authenticated user uploads an unsupported or oversized waiver file
- **THEN** the system rejects the upload and does not update the requestor's current submitted waiver pointer

### Requirement: Submitted waiver privacy
The system MUST restrict submitted waiver metadata and file downloads to admins.

#### Scenario: Non-admin reads profile
- **WHEN** a non-admin user reads their profile
- **THEN** the response does not include the waiver file pointer or server filesystem path

#### Scenario: Non-admin downloads submitted waiver file
- **WHEN** a non-admin user requests a submitted waiver file
- **THEN** the system rejects the request

### Requirement: Admin waiver review queue
The system SHALL provide admins with a review queue for current-year submitted liability waivers.

#### Scenario: Admin views pending waiver queue
- **WHEN** an admin opens the Review liability waivers section for a year
- **THEN** the system lists requestors with current submitted waiver files that are not approved for that year

#### Scenario: Admin downloads submitted waiver
- **WHEN** an admin selects a submitted waiver from the review queue
- **THEN** the system returns that requestor's current submitted waiver file

### Requirement: Waiver approval
The system SHALL allow admins to approve a submitted liability waiver for a requestor.

#### Scenario: Admin approves waiver
- **WHEN** an admin approves a requestor's current submitted waiver
- **THEN** the system sets the requestor liability waiver date to the approval date and removes the requestor from the pending review queue for that year

#### Scenario: Admin approves without submitted waiver
- **WHEN** an admin attempts to approve a waiver for a requestor without a current submitted waiver file
- **THEN** the system rejects the approval
