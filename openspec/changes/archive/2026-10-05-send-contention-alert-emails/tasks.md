## 1. Persistent notification state and impact capture

- [x] 1.1 Add additive private SQLite tables for recipient/season awareness, revisioned pending alerts, immutable delivery snapshots, attempts, and scheduler leases; preserve existing request contention fields.
- [x] 1.2 Implement logical-choice snapshots, grouping combination legs and preserving identity through reorder/removal, and initialize awareness without creating historical send records or catch-up emails.
- [x] 1.3 Pass authenticated actor context through request saves, credit edits, and admin uploads; atomically capture relevant before/after impacts with the committed contention refresh.
- [x] 1.4 Reconcile the actor's awareness to app feedback while queuing other impacted recipients; verify rollback discards notification events and later external impacts remain eligible.

## 2. Alert selection and quiet periods

- [x] 2.1 Implement progression from the last acknowledged leading choice through newly losing choices to the highest-ranking remaining fallback, consolidating simultaneous losses and treating combinations as one choice.
- [x] 2.2 Persist recipient-specific relevant-change times and enforce the 60-minute quiet period, including the exact boundary and relevant fallback/detail changes without postponement from unrelated edits.
- [x] 2.3 Revalidate pending content against current contention, silently reconcile recoveries, cancel removed or self-acknowledged impacts, and suppress repeated unchanged alerts.
- [x] 2.4 Scope evaluation to trip-request mode and the current season, excluding volunteers already granted reservations; retain and revalidate pending state across disablement.

## 3. Email composition and transport

- [x] 3.1 Implement lottery, bumped-with-choices, and bumped-with-no-choices templates using the design wording, including plural losses, at-risk fallbacks, and the distinction between contention estimates and confirmed reservations.
- [x] 3.2 Render escaped HTML and equivalent plain text with choice number, hut options or traverse route, weekday-bearing check-in/check-out and traverse dates, ideal/minimum party sizes, and the canonical trip-request edit link.
- [x] 3.3 Extract shared relay transport without changing login-code email behavior; require configured transport for alerts, bounded delivery timeouts, and explicit feature enablement with development disabled by default.

## 4. Scheduled delivery and durable outcomes

- [x] 4.1 Add a one-shot worker and persisted two-hour server schedule with restart catch-up, renewable leases, and overlap prevention; provide dry-run previews without sending or advancing awareness.
- [x] 4.2 Claim and revalidate recipient revisions in short transactions, release database locks during delivery, and persist attempts before contacting the relay.
- [x] 4.3 On confirmed acceptance, record the immutable sent snapshot and update only surviving represented request rows; advance only the communicated revision and preserve newer pending impacts.
- [x] 4.4 Retry definite failures on later runs without advancing successful-send state, continue other recipients, and expose ambiguous attempts for operator reconciliation without automatic resend.

## 5. Verification and operations

- [x] 5.1 Add isolated fake-clock/fake-mail tests for the three-group displacement example, self-editor suppression, later external impacts, admin actor identity, and open sessions that do not suppress mail.
- [x] 5.2 Test previously communicated first-choice loss followed by second-choice risk, multiple losses in one quiet window, no remaining choices, recovery, combinations, fractional credits, full inline details, and calendar dates across timezones.
- [x] 5.3 Test quiet-period boundaries, unrelated edits, duplicate suppression across restarts, concurrent worker claims, changes/deletions during sends, rejected or missing transport, ambiguous completion, initialization, dry runs, and mode/season eligibility.
- [x] 5.4 Run relevant contention, request, profile, credits, migration, and login-email regression checks; verify worker behavior against approximately 90 requestors and 300 requests.
- [x] 5.5 Document configuration, enablement/bootstrap behavior, two-hour scheduling, preview/run commands, delivery monitoring, ambiguous-attempt reconciliation, and rollback by disabling the worker while retaining history.
