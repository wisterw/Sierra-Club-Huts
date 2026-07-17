## ADDED Requirements

### Requirement: Bulk volunteer upload controls
The system SHALL provide an admin-only bulk volunteer TSV upload control and a requestor sample-file download link within the Manage volunteers/requestors section. The interface SHALL explain that email is required, other fields are optional, and blank cells preserve existing values.

#### Scenario: Admin views bulk upload controls
- **WHEN** an authenticated admin opens Manage volunteers/requestors
- **THEN** the upload control, sample-file link, and input-semantics guidance are displayed with the volunteer management workflow

#### Scenario: Admin completes bulk upload
- **WHEN** an admin uploads a valid requestor TSV file
- **THEN** the interface reports the created, updated, and skipped counts and refreshes the volunteer grid to show committed changes

#### Scenario: Admin upload is rejected
- **WHEN** an admin uploads an invalid requestor TSV file
- **THEN** the interface displays the validation failure and retains the existing volunteer grid data

#### Scenario: Non-admin cannot access bulk upload
- **WHEN** a non-admin attempts to use the bulk upload or sample download operation
- **THEN** the system rejects the request and does not expose or change volunteer data
