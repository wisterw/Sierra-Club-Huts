## ADDED Requirements

### Requirement: Scheduled recipient-specific evaluation
When explicitly enabled, the system SHALL evaluate alerts every two hours in trip-request mode for the current season. It SHALL defer a recipient's pending alert until at least one hour after its latest relevant change. Unrelated changes MUST NOT postpone that recipient. Evaluation SHALL use current contention and exclude volunteers already granted a reservation. Runs MUST NOT overlap, and restart SHALL preserve scheduling and pending history.

#### Scenario: Recent impact is deferred
- **WHEN** the job runs 45 minutes after a change affecting a volunteer's pending alert
- **THEN** it sends no email to that volunteer and reevaluates the pending alert on the next scheduled run

#### Scenario: Quiet period completed
- **WHEN** exactly 60 minutes have elapsed since the latest relevant change and the impact remains eligible
- **THEN** the alert is eligible at the scheduled run

#### Scenario: Unrelated edit
- **WHEN** another volunteer edits a non-overlapping request without changing this recipient's alert
- **THEN** the recipient's quiet period remains unchanged

### Requirement: Actor-aware impacted recipients
The system SHALL attribute request and credit mutations to their authenticated actor and persist impacts atomically with contention changes. It MUST NOT email the actor about the impact of their own action. It SHALL reconcile the actor's awareness to their in-app feedback, while allowing subsequent external impacts to alert them. Administrative changes SHALL suppress the acting admin, not the distinct affected volunteer. Session presence alone MUST NOT suppress alerts.

#### Scenario: One request impacts three groups
- **WHEN** a higher-credit volunteer submits a request that makes three other volunteers' leading choices losing
- **THEN** the system queues one independent alert for each affected volunteer and none for the submitter about that action

#### Scenario: Editor is impacted later
- **WHEN** a different volunteer subsequently causes the previous editor's leading choice to become losing
- **THEN** the previous editor is eligible for that externally caused alert after their quiet period

#### Scenario: Admin changes another volunteer's credits
- **WHEN** an admin changes credits on another volunteer's behalf and causes alert-relevant impacts
- **THEN** recipient suppression uses the admin's authenticated identity rather than the edited requestor's identity

### Requirement: Leading remaining choice progression
The system SHALL persist recipient awareness and communicated choice snapshots. It SHALL follow the highest-ranked remaining logical choice, advance past communicated losses, and retain newly losing leading choices for the email explaining that loss. Multiple uncommunicated leading losses SHALL be consolidated with the next non-losing choice. Combination legs SHALL form one logical choice. Recovered choices SHALL be reconciled without recovery-only emails.

#### Scenario: Earlier loss already communicated
- **WHEN** choice #1 was previously communicated as losing and choice #2 now becomes at-risk
- **THEN** the lottery alert concerns choice #2 and does not repeat the old choice #1 loss

#### Scenario: Two losses during quiet period
- **WHEN** choices #1 and #2 become losing before either loss has been communicated
- **THEN** one email lists both newly lost choices and the highest-ranked remaining choice, if any

#### Scenario: No remaining options
- **WHEN** every choice remaining from the volunteer's awareness baseline is losing
- **THEN** the email uses the no-more-choices version and lists newly lost choices

### Requirement: Three complete email variants
The system SHALL compose lottery, bumped-with-choices, and bumped-with-no-choices emails with the meanings and wording defined in the design. Every listed choice SHALL include choice number, hut options or ordered route, check-in and check-out dates with weekdays, traverse date where applicable, ideal people, and minimum people. Date formatting MUST preserve calendar dates. Each email SHALL include a canonical edit link, HTML and plain-text equivalents, and no competing identities or login credentials. Messages MUST distinguish contention estimates from final reservations.

#### Scenario: Lottery email
- **WHEN** the leading remaining choice becomes at-risk
- **THEN** the email explains equal-credit lottery exposure and possible movement to lower choices and lists that choice's complete details

#### Scenario: Bumped with an at-risk fallback
- **WHEN** a leading choice becomes losing and its next remaining choice is at-risk
- **THEN** one bumped-with-choices email lists both, identifies the fallback's lottery exposure, and does not describe it as guaranteed available

#### Scenario: Combination dates
- **WHEN** an email lists a Benson-to-Bradley combination choice
- **THEN** it lists both legs as one choice with check-in, traverse, and check-out calendar dates and correct weekdays

### Requirement: Persistent batching and duplicate suppression
The system SHALL send at most one consolidated alert per recipient per run and MUST NOT repeat unchanged communicated content merely because two hours passed. Successful history SHALL record the exact sent snapshot and version. Pending content SHALL be rebuilt from current data and discarded if recovered, deleted, or superseded by acknowledged self-edit feedback. A send SHALL acknowledge only its own revision, preserving newer impacts for later evaluation.

#### Scenario: Unchanged risk across runs
- **WHEN** the same choice/status/details were successfully communicated and remain unchanged
- **THEN** later runs send no repeat alert for that content

#### Scenario: Recovery before send
- **WHEN** a pending losing choice becomes clear before the scheduled email
- **THEN** the outdated loss email is discarded

#### Scenario: New impact arrives during delivery
- **WHEN** another relevant mutation commits while an older alert is being sent
- **THEN** successful recording acknowledges the sent version and preserves the newer pending revision

### Requirement: Successful send and failure handling
Only confirmed relay acceptance SHALL advance successful-send history and recipient awareness. The system SHALL update contention_email_sent_at on surviving request rows represented by that email without changing contention transition or general modification timestamps. Explicit failure SHALL retain an eligible retry for a later run. Missing relay configuration MUST NOT be treated as success. Ambiguous attempts SHALL be persisted for operator reconciliation without automatic resend. Mail operations MUST NOT hold SQLite write transactions open.

#### Scenario: Explicit relay failure
- **WHEN** the relay rejects an alert
- **THEN** successful-send timestamps and awareness are unchanged, the alert remains retryable, and other recipients continue to be processed

#### Scenario: Successful send while a row is removed
- **WHEN** the relay accepts a claimed snapshot but a represented request was removed during delivery
- **THEN** immutable send history is retained, surviving represented rows are updated, and newer pending state is preserved

#### Scenario: Unknown outcome after crash
- **WHEN** a persisted send attempt has no recorded definitive outcome after interruption
- **THEN** it is surfaced for reconciliation and is not automatically resent as if the previous attempt never happened

### Requirement: Controlled initialization and operational visibility
The system SHALL initialize awareness from current choices without fabricating historical notifications or mailing existing contention merely on deployment. Sending SHALL default to disabled in development and require explicit configuration. Dry-run previews MUST NOT send, advance awareness, or record success. Operators SHALL have run summaries, disable controls, and a documented ambiguous-attempt reconciliation path. Actor and recipient history MUST remain private.

#### Scenario: Feature enabled on existing data
- **WHEN** the feature is first enabled with existing at-risk or losing requests
- **THEN** their current choices become the baseline and later external impacts can alert them, without automatic historical catch-up mail

#### Scenario: Preview
- **WHEN** an operator runs a dry-run evaluation
- **THEN** recipient/template/detail decisions are reviewable and no mail or success/awareness updates occur
