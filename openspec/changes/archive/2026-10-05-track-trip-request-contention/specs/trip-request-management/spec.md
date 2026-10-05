## MODIFIED Requirements

### Requirement: Durable ski trip request records
The system SHALL store each ski trip request with a durable `Request_ID`, requestor association, hut booleans, dates, choice number, spot counts, granted values, status, lottery value, timestamps, flexibility count, Saturday week number, and optional combination linkage. Each request SHALL also persist nullable server-managed `contention_status`, `contention_status_changed_at`, and `contention_email_sent_at` fields according to the trip-request-contention requirements.

#### Scenario: New request receives ID
- **WHEN** a user saves a new ski trip request
- **THEN** the system stores the request with a durable request ID

#### Scenario: Contention data survives request save
- **WHEN** an existing request is saved with its durable request ID
- **THEN** the system preserves its server-managed contention timestamps except for an actual calculated status transition
- **AND** client-supplied contention fields do not override persisted values
