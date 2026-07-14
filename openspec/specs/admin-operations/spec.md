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
The system SHALL use lottery number as the final tiebreak for assignment, with lower lottery numbers winning over higher lottery numbers after all earlier preference criteria are applied.

#### Scenario: Lottery number breaks a tie
- **WHEN** two candidates remain tied after credits, request impact, flexibility, and other earlier criteria
- **THEN** the candidate with the lower lottery number is ordered first for assignment consideration

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
The system SHALL allow admin users to upload a tab-delimited requestor file that creates requestors for new emails and updates existing requestors by email.

#### Scenario: Existing requestor upload
- **WHEN** an uploaded row has an email matching an existing requestor case-insensitively
- **THEN** the system updates that requestor rather than creating a duplicate

### Requirement: Download joined requests
The system SHALL allow admin users to download an outer-joined report containing requestor fields and request fields sorted by Saturday week number, credits descending, choice number, hut flexibility, and lottery value.

#### Scenario: Requestor without requests appears
- **WHEN** an admin downloads all requests and a requestor has no trip requests
- **THEN** the report includes one row for that requestor with blank request fields

#### Scenario: Granted-only filter
- **WHEN** an admin chooses the granted-only download filter
- **THEN** the report contains only granted request rows

### Requirement: Assignment algorithm
The system SHALL run an assignment algorithm that grants requests according to the documented preference order and records audit information describing how each granted request was assigned.

#### Scenario: Assignment grants available request
- **WHEN** an admin runs assignment and a request can be fulfilled within hut capacity
- **THEN** the request is marked granted with granted hut, granted spots, lottery value, and assignment audit information

#### Scenario: Unfulfilled request is marked lost
- **WHEN** assignment completes and a request was not available to be fulfilled 
- **THEN** the request is marked `lost-lottery`

#### Scenario: request is not needed
- **WHEN** assignment completes and a request was not used because a higher-priority choice was fulfilled
- **THEN** the request is marked `not-used`

### Requirement: Efficiency report
The system SHALL calculate the percentage of requesting groups and requested spots that received first choice, second choice, later choices, or no choice.

#### Scenario: Efficiency report after assignment
- **WHEN** an admin loads the efficiency report after assignment
- **THEN** the report returns group and spot percentages grouped by outcome

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
