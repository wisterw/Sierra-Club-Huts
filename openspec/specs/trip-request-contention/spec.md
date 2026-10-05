# trip-request-contention Specification

## Purpose

Define trip request contention behavior for the volunteer hut reservation application.

## Requirements

### Requirement: Persistent contention fields
Every saved ski trip request SHALL have nullable `contention_status`, `contention_status_changed_at`, and `contention_email_sent_at` fields. Allowed status values SHALL be NULL, `at-risk`, and `losing`. Non-null timestamps SHALL use server-generated ISO 8601 UTC values. Contention status SHALL be independent of final assignment Status.

#### Scenario: New clear request
- **WHEN** a new saved request has no contention
- **THEN** all three contention fields are NULL

#### Scenario: Initial contention is detected
- **WHEN** a newly saved or migrated request is first evaluated as at-risk
- **THEN** its status is `at-risk`, its change timestamp is the evaluation time, and its email timestamp remains NULL

#### Scenario: Assignment remains separate
- **WHEN** an assignment run marks a request granted, lost-lottery, or not-used without changing demand inputs
- **THEN** the request retains its independently calculated contention status and dedicated timestamps

### Requirement: Cell-level contention calculation
The system SHALL classify each requested hut/night using the existing availability-summary priority, requestor-exclusion, multi-hut demand splitting, and precision rules. A cell SHALL be losing when minimum requested spots exceed capacity minus higher-priority spots. Otherwise it SHALL be at-risk when minimum spots exceed capacity minus higher-priority and same-priority spots. Otherwise it SHALL be clear. Arrival SHALL be inclusive and departure exclusive; absent competing demand SHALL count as zero.

#### Scenario: Higher-priority demand makes a cell losing
- **WHEN** hut capacity is 12, higher-priority demand is 9, and the request's minimum is 4
- **THEN** the cell is losing

#### Scenario: Equal-priority demand makes a cell at risk
- **WHEN** hut capacity is 12, higher-priority demand is 4, same-priority demand is 5, and the request's minimum is 4
- **THEN** the cell is at-risk

#### Scenario: Exact remaining capacity is sufficient
- **WHEN** minimum spots equal capacity minus higher-priority and same-priority demand
- **THEN** the cell is clear

#### Scenario: Current request does not compete with itself
- **WHEN** contention is evaluated for a saved request
- **THEN** the current requestor's equal-choice/equal-credit requests are excluded from equal-priority competing demand under existing summary rules

### Requirement: Whole-trip contention aggregation
For an ordinary request the system SHALL calculate the worst cell severity across all requested nights for each allowed hut, then use the best allowed hut's severity as the request's overall status. For a valid linked combination trip, the system SHALL use the worse of the two legs' severities as the overall status stored on both rows. Clear SHALL map to NULL; severity SHALL increase from clear to at-risk to losing. Invalid combination linkage MUST cause refresh to fail with request context rather than record an incomplete trip classification.

#### Scenario: One complete alternative is clear
- **WHEN** one allowed hut is clear on every requested night and another is losing
- **THEN** the request's overall status is NULL

#### Scenario: Different huts are clear on different nights
- **WHEN** each allowed hut has at least one losing night and no single hut can fit the whole stay
- **THEN** the ordinary request's overall status is losing even if each night has some clear hut

#### Scenario: Best complete alternative is at risk
- **WHEN** no allowed hut is clear for the whole stay, one hut's worst night is at-risk, and another hut's worst night is losing
- **THEN** the overall status is at-risk

#### Scenario: Combination requires both legs
- **WHEN** one combination leg is clear and the other is losing
- **THEN** both linked request rows have overall status losing

### Requirement: Status timestamps reflect transitions only
The system SHALL update `contention_status_changed_at` only when persisted contention status changes, including a transition to NULL. Reevaluation of unchanged status MUST preserve the timestamp. Contention-only maintenance MUST NOT change general Last_mod_date or the email timestamp. A refresh SHALL use a consistent server timestamp for its transitions.

#### Scenario: Unchanged reevaluation
- **WHEN** an at-risk request is saved or reevaluated and remains at-risk
- **THEN** its contention change and email timestamps remain unchanged

#### Scenario: Losing request becomes clear
- **WHEN** a losing request's current calculation becomes clear
- **THEN** its status becomes NULL and its change timestamp records that transition time
- **AND** its existing email timestamp is preserved

#### Scenario: Competition changes another request
- **WHEN** a competing request causes an existing request to change from clear to at-risk
- **THEN** the affected request records the transition time without changing its general Last_mod_date

### Requirement: Current and atomic contention refresh
The system SHALL refresh contention for all saved requests after request additions, edits, removals, imports, and effective requestor credit changes, including bulk uploads and requestor deletion where supported. Mutation and refresh SHALL be atomic. Startup SHALL refresh after initialization/import and before serving request APIs. Unchanged restart evaluations MUST preserve existing timestamps. Bulk updates SHALL evaluate their final combined state.

#### Scenario: Competitor withdraws
- **WHEN** a competing request is removed and a previously at-risk request becomes clear
- **THEN** the removal and affected contention transition commit together

#### Scenario: Fractional credit changes priority
- **WHEN** an admin changes a competing requestor's credits from 1.4 to 1.5 and this changes another request's calculated contention
- **THEN** the affected request's persisted status and transition timestamp are refreshed in the credit-update transaction

#### Scenario: Refresh failure rolls back mutation
- **WHEN** contention calculation or persistence fails during a request save or credit upload
- **THEN** the initiating mutation and every contention update are rolled back and the operation reports failure

#### Scenario: Restart preserves stable state
- **WHEN** the application restarts with unchanged demand and capacities
- **THEN** current contention is available before request APIs are served and existing transition/email timestamps are preserved

### Requirement: Trusted successful-email tracking
The system SHALL provide an internal repository operation to record server completion time for a confirmed successful contention email against one or more durable request IDs. It SHALL update only `contention_email_sent_at`, atomically for a batch. Unknown request IDs MUST reject the operation without partial updates. Failed or unattempted sends, recalculation, request edits, and login-code emails MUST NOT update this timestamp. This change SHALL NOT introduce automatic contention email sending or a public timestamp mutation endpoint.

#### Scenario: Confirmed successful send
- **WHEN** trusted application code records a successful contention email for an existing request
- **THEN** the email timestamp records server completion time and status/change/general modification timestamps remain unchanged

#### Scenario: Failed send
- **WHEN** a contention email attempt fails
- **THEN** its last successful-send timestamp remains unchanged

#### Scenario: Batch contains deleted request
- **WHEN** a success-recording batch includes an unknown or deleted request ID
- **THEN** no email timestamp in that batch is updated and the operation reports failure

### Requirement: Server ownership and authorized visibility
The system SHALL expose all three fields on existing authorized request reads and joined admin request exports while retaining current access restrictions. Ordinary request saves MUST ignore client-supplied contention fields and preserve existing server values by durable request ID. New rows SHALL initialize server-owned values independently of client input.

#### Scenario: Client attempts to overwrite timestamps
- **WHEN** a volunteer or admin includes fabricated contention values in a request save
- **THEN** those values are ignored and persisted values follow server calculation and success-recording rules

#### Scenario: Authorized export
- **WHEN** an admin downloads the joined request TSV
- **THEN** it includes contention_status, contention_status_changed_at, and contention_email_sent_at for each request, with blank values for NULLs or absent requests

#### Scenario: Unauthorized request read
- **WHEN** a volunteer attempts to read another volunteer's private request data
- **THEN** existing authorization rejects access, including to contention fields

### Requirement: Additive migration without invented history
The system SHALL add the three nullable columns idempotently while preserving existing IDs, records, general timestamps, and assignment data. It SHALL compute current contention on startup without inventing historical transition or email times. Initial non-null contention SHALL receive the actual evaluation timestamp, and existing clear requests SHALL retain NULL transition timestamps until a later transition occurs.

#### Scenario: Existing database is migrated
- **WHEN** a database without contention columns starts under the new build
- **THEN** the columns are added and current statuses are calculated, with all email timestamps NULL
- **AND** existing identities, relationships, and unrelated values are preserved

#### Scenario: Migration runs again
- **WHEN** an already migrated database starts again
- **THEN** no duplicate columns or fabricated history are created
