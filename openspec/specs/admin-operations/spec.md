# admin-operations Specification

## Purpose
TBD - created by archiving change assignment-lottery-tiebreaks. Update Purpose after archive.
## Requirements
### Requirement: Lottery number regeneration
The system SHALL allow an admin user to regenerate lottery numbers for requestors as a separate action from running the assignment algorithm.

#### Scenario: Admin regenerates lottery numbers
- **WHEN** an admin triggers the lottery regeneration action
- **THEN** the system assigns new random lottery numbers to requestors according to the current regeneration rules

### Requirement: Assignment uses lottery number
The system SHALL use lower stored lottery numbers to prefer requestors when optimal credit-level choice scores, maximum person-nights, and years of service tie, followed by requestor ID for determinism. Hut flexibility MUST NOT precede or override service or lottery in requestor fairness or remaining guest-count tie resolution. Lottery MUST NOT override superior choice scores or person-night outcomes.

#### Scenario: Lottery number breaks a tie
- **WHEN** two requestors remain tied after the allocation objectives and years of service
- **THEN** the requestor with the lower lottery number receives preference in the final allocation tie resolution regardless of allowed hut counts

### Requirement: Assignment can optionally regenerate lottery numbers
The assignTrips endpoint SHALL accept a regeneration flag that controls whether lottery numbers are refreshed before assignment, and the default behavior SHALL regenerate them.

#### Scenario: Default regeneration
- **WHEN** an admin runs assignment without providing the regeneration flag
- **THEN** the system regenerates lottery numbers before evaluating assignment

#### Scenario: Preserve existing lottery numbers
- **WHEN** an admin runs assignment with the regeneration flag set to false
- **THEN** the system preserves existing non-null lottery numbers and only fills in missing values

### Requirement: Admin UI exposes lottery regeneration
The admin interface SHALL expose a control for regenerating lottery numbers when running assignment.

#### Scenario: Admin sees regeneration control
- **WHEN** an admin opens the assignment action in the admin UI
- **THEN** the lottery regeneration control is visible and defaulted to on

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

### Requirement: Download joined requests
The system SHALL allow admin users to download an outer-joined report containing requestor fields and request fields sorted by Saturday week number, credits descending, choice number, hut flexibility, and lottery value.

#### Scenario: Requestor without requests appears
- **WHEN** an admin downloads all requests and a requestor has no trip requests
- **THEN** the report includes one row for that requestor with blank request fields

#### Scenario: Granted-only filter
- **WHEN** an admin chooses the granted-only download filter
- **THEN** the report contains only granted request rows

### Requirement: Assignment algorithm
The system SHALL run an allocation optimizer according to the trip-allocation-optimization requirements: minimize credit-level choice-score totals from highest credits to lowest, then maximize person-nights, then apply deterministic fairness ties. It SHALL record granted hut, guest count, lottery value, and explanatory audit information. It MUST preserve existing outcomes when optimization fails, is incomplete, or becomes stale, and commit successful results atomically with lottery changes and run metadata.

#### Scenario: Assignment grants available request
- **WHEN** an admin runs assignment and the optimizer selects a feasible request
- **THEN** the request is marked granted with granted hut, granted spots, lottery value, and assignment audit information

#### Scenario: Unfulfilled request is marked lost
- **WHEN** assignment completes optimally and a requestor receives no choice
- **THEN** that requestor's in-scope requests are marked lost-lottery

#### Scenario: request is not needed
- **WHEN** assignment completes and another choice of the same requestor was granted
- **THEN** the unused request is marked not-used

#### Scenario: Optimization cannot complete
- **WHEN** the optimizer times out, fails validation, or detects stale inputs
- **THEN** the admin receives an unsuccessful result with a reason and existing grants and lottery values remain unchanged

### Requirement: Efficiency report
The system SHALL retain group and requested-spot percentages grouped by first choice, second choice, later choices, or no choice. It SHALL additionally report the latest committed optimized run's credit-level choice-score totals, total granted person-nights, policy version, solver completion, and elapsed time. Saved run metrics MUST be identified as stale if relevant allocation inputs or outcomes have changed since that run or the saved policy version differs from the active allocation policy. Historical metrics and policy versions MUST NOT be rewritten to imply a new assignment ran.

#### Scenario: Efficiency report after assignment
- **WHEN** an admin loads the efficiency report after a successful optimized assignment under the active policy
- **THEN** it returns existing group/spot percentage rows and the committed allocation-quality summary

#### Scenario: Requests change after assignment
- **WHEN** relevant requests or credits change after the recorded allocation run
- **THEN** the report marks the saved optimization summary stale rather than presenting it as a result for current inputs

#### Scenario: Earlier tie policy
- **WHEN** the latest recorded allocation used the earlier policy that prioritized fewer huts and inputs are otherwise unchanged
- **THEN** the report retains that run's metrics and earlier policy version and marks its summary out of date until an admin completes a new assignment

### Requirement: Admin authorization
The system MUST restrict admin operations to authenticated users with the admin flag.

#### Scenario: Non-admin requests admin report
- **WHEN** a non-admin user requests an admin download or assignment action
- **THEN** the system rejects the request

### Requirement: Admin operation placement
The admin interface SHALL present assignment lottery, request download, and efficiency report controls within the organized Admin console sections.

#### Scenario: Assignment lottery appears in Application settings
- **WHEN** an admin opens the Application settings section
- **THEN** the run lottery control and regenerate lottery numbers checkbox are available with the regenerate checkbox defaulted to on

#### Scenario: Download requests appears in Download requests section
- **WHEN** an admin opens the Download requests section
- **THEN** the joined request download action and its request filter options are available

#### Scenario: Efficiency report appears in Efficiency report section
- **WHEN** an admin opens the Efficiency report section
- **THEN** the control for loading the efficiency report is available

### Requirement: Existing admin operations remain compatible
Reorganizing the Admin console MUST NOT change the behavior of existing assignment lottery, request download, or efficiency report operations.

#### Scenario: Admin operation after reorganization
- **WHEN** an admin runs an existing admin operation from its organized console section
- **THEN** the operation uses the existing backend behavior and returns the same kind of result as before the reorganization
