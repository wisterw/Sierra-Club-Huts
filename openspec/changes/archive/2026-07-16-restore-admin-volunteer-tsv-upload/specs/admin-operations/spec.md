## MODIFIED Requirements

### Requirement: Upload requestors
The system SHALL allow admin users to upload a tab-delimited requestor file that atomically creates requestors for new emails and updates existing requestors by email. The upload MUST contain a case-insensitively matched Email header, each nonblank data row MUST contain a nonblank email, and all other supported fields SHALL be optional. Header names and all field values SHALL have leading and trailing whitespace removed, while whitespace inside field values SHALL be preserved. The system SHALL accept and ignore unrecognized additional columns. For an existing requestor, a supported column that is omitted or has a blank cell MUST leave the stored value unchanged.

#### Scenario: Existing requestor upload
- **WHEN** an uploaded row has an email matching an existing requestor case-insensitively
- **THEN** the system updates that requestor rather than creating a duplicate

#### Scenario: New requestor with only email
- **WHEN** a valid uploaded row contains an email and no other populated supported fields
- **THEN** the system creates the requestor using defaults for the optional fields

#### Scenario: Case-insensitive and trimmed input
- **WHEN** an upload uses different letter casing or surrounding whitespace in recognized headers and contains surrounding whitespace in field values
- **THEN** the system recognizes the headers, trims the surrounding whitespace from values, and preserves whitespace inside values

#### Scenario: Blank update value
- **WHEN** an existing requestor's row omits a supported column or contains a blank value for it
- **THEN** the system leaves the existing stored value unchanged

#### Scenario: Additional columns
- **WHEN** a valid upload includes columns that the requestor importer does not recognize
- **THEN** the system ignores those columns and imports the recognized values

#### Scenario: Missing email header
- **WHEN** an uploaded file does not contain a case-insensitively matched Email header
- **THEN** the system rejects the file without creating or updating any requestors

#### Scenario: Data row without email
- **WHEN** a nonblank uploaded data row has no email value
- **THEN** the system rejects the file without creating or updating any requestors

#### Scenario: Import persistence failure
- **WHEN** any requestor row cannot be persisted during an upload
- **THEN** the system rolls back every requestor change from that upload and reports the failure

#### Scenario: Successful import summary
- **WHEN** an upload commits successfully
- **THEN** the system reports separate created, updated, and skipped row counts

### Requirement: Requestor upload sample
The system SHALL provide admins a downloadable TSV sample containing only the headers `Email`, `first_name`, `last_name`, `address`, `city`, `state`, `zip`, and `Phone`.

#### Scenario: Admin downloads sample
- **WHEN** an authenticated admin requests the requestor upload sample
- **THEN** the system downloads a tab-delimited file with the basic header row and no required data rows

#### Scenario: Non-admin requests sample
- **WHEN** a non-admin requests the requestor upload sample
- **THEN** the system rejects the request
