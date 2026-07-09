## ADDED Requirements

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
