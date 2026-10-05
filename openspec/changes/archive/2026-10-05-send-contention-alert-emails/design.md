## Context

The app already calculates contention for every saved request and records transition and successful-email timestamps. It does not retain who caused an impact or which choice/status a volunteer has already been told about. Ordinary saves reset general modification timestamps on all supplied rows, and assignment runs also touch them, so Last_mod_date alone cannot implement this alert policy.

The expected workload is about 90 requestors and 300 requests. Alerts concern the highest-ranking remaining choice. The editor sees feedback in the app; other impacted volunteers need email. One higher-credit request can independently displace several groups.

## Goals / Non-Goals

**Goals:** Two-hour evaluation, recipient-specific one-hour quiet periods, correct progression through remaining choices, one consolidated email per recipient per run, and persistent duplicate suppression.

**Non-Goals:** Changing contention/assignment rules, notifying every lower-choice risk, announcing recoveries, treating losing as a final allocation, inferring that all logged-in volunteers saw an impact, or guaranteeing exactly-once SMTP delivery.

## Decisions

### Capture committed impact with authenticated actor context

Pass the acting session requestor ID from request-save and credit-change routes, including admin uploads. An admin editing another volunteer's profile is the actor; that volunteer is still eligible. Capture before/after logical choices and alert-relevant changes inside the same transaction as mutation and contention refresh. Exclude the actor from email impacts caused by that action and reconcile their awareness baseline to the feedback snapshot they receive in the app.

Suppress only the actor's own impact, not another recipient's, and not subsequent external changes affecting the actor. Do not treat a currently open session as proof of awareness. Worker refreshes have no human actor and must not pretend to be self-edits. Unrelated saves, assignment timestamps, and startup recalculation do not create fake mutation events.

### Persist awareness and a recipient outbox

Add private SQLite records for recipient/season awareness, immutable successful notification snapshots, and pending outbox items. Store logical choice identity (durable request IDs, paired for combinations), rank, status, relevant trip details, event revision, last relevant change time, and actor attribution. Successful snapshots retain the exact template and choice details that were sent. Per-request email timestamps remain summary facts; notification history provides the actual communicated version.

Use a per-recipient revision to avoid clearing pending changes that arrive during a send. A unique recipient/season/content-revision identity prevents ordinary retries or restarts from recreating the same successful alert. Do not expose history or actor identities in volunteer payloads or emails.

Implementation uses a private per-row notification identity in addition to the public request ID. Replacement saves retain that identity only for existing requests; new rows receive a new identity, even if SQLite reuses an old request ID. Successful sends match this identity before updating a surviving row, avoiding accidental acknowledgement of a replacement created during delivery.

### Follow the leading remaining choice without losing uncommunicated losses

Order logical choices by saved choice number and group combination rows into one choice. The awareness baseline identifies the leading choice last seen in self-edit feedback or communicated in email. Follow losses from that baseline, listing all newly losing leading choices until the first non-losing choice. That first non-losing choice is the next remaining option even if at-risk. A clear leading choice produces no lottery alert; an at-risk leading choice produces the lottery version.

Do not simply discard every currently losing row before composing: doing that would skip the choice the volunteer has just lost. After a successful bumped email, advance the baseline to the listed fallback. If choices #1 and #2 become losing before notification, send one bumped email listing both and the next remaining choice. If the fallback is at-risk, explain that exposure in the same email rather than send a second email in that run.

When a previously skipped choice recovers, silently reconcile the leading choice to the highest-ranked remaining choice; do not send a recovery-only email. A later new deterioration can produce a new alert. Reordering/removing choices through self-edit feedback reconciles their identities rather than relying on stale numeric ranks.

### Quiet period and relevance

An alert is eligible once at least 60 minutes have elapsed since the latest change affecting that recipient's pending leading/lost/fallback content. Relevant recipient choice edits also reset that recipient's quiet period or reconcile their awareness through self-edit suppression. A relevant external status/detail change resets it even if an older pending event is already eligible. An unrelated volunteer's edit does not postpone it. Use persisted event times and revisioned snapshots, not general Last_mod_date. At exactly 60 minutes the alert is eligible.

At each run recalculate contention and rebuild pending content from current requests; discard alerts that have recovered, been removed, or have been superseded by acknowledged self-edits. No reminder is sent merely because risk remains unchanged. Material new impacts produce a new revision and one consolidated alert, not one email per row or combination leg.

### Three templates with full inline details

Use the user's three variants with capitalization and terminology made consistent. Keep these meanings:

- Lottery: "Your current top-choice reservation request (listed below) is at risk of loss in a lottery to other volunteers with the same number of work-party credits as you. In a lottery situation, you could be moved to one of your lower choices."
- Bumped with choices: "Your current top-choice reservation request is currently unlikely to be available because of higher-priority requests. That choice and your next-best remaining choice are listed below."
- Bumped with no choices: "Your current top-choice reservation request (listed below) is currently unlikely to be available because of higher-priority requests. Adjust your choices to improve your chances of receiving a reservation in the lottery."

When several choices were lost, adjust singular/plural wording and list them all. Use higher-priority requests rather than claiming an actual allocation or always attributing loss to more credits: existing rules also include higher-ranked choices at equal credits. Explain that contention estimates are not confirmed reservations.

Each logical choice lists choice number, all hut options or the ordered combination route, check-in and check-out with weekday/month/day/year, traverse date with weekday for combinations, ideal people, and minimum people. Render reservation dates as calendar dates without host-timezone shifts. Send escaped HTML with plain-text equivalent and a canonical APP_PUBLIC_URL `/trip-requests` edit link. Include no login code or automatic-login credentials and no competing volunteer identities.

### Two-hour worker and delivery discipline

Provide a one-shot worker command plus a server scheduler that checks persisted next-run time and evaluates every two hours. Persist scheduling state so frequent restarts cannot continually postpone evaluation; after downtime perform one due run rather than replay missed slots. Use a renewable SQLite lease and bounded mail timeouts to prevent overlapping workers. A dry-run command previews recipient/template decisions without sending or marking success.

Require explicit alert enablement and a working relay; development defaults disabled. Reuse relay configuration while extracting shared transport from login-code composition. Missing relay configuration is failure, not the login-code console fallback. The worker operates only in trip-request mode for the current request season and excludes requestors already granted a reservation; pending records remain available while disabled, with current eligibility revalidated before sending.

Claim/revalidate a pending revision in a short transaction, release database locks before calling the relay, and record acceptance and the matching immutable snapshot in a new transaction. Update contention_email_sent_at only for the existing request rows actually represented in the email. A removed row during delivery must not cause all successful-send history to be lost: retain the immutable send snapshot and update surviving represented rows. Do not mark a newer revision as communicated when an older snapshot was sent; it remains eligible for a later run after its quiet period.

Explicit relay rejection leaves the item retryable on a later scheduled run and does not advance awareness or successful-send timestamps. Log recipient-isolated failures and continue evaluating other recipients. If a crash occurs after relay acceptance but before persistence, exactly-once delivery cannot be proven with the current relay. Persist the attempt before send; mark ambiguous attempts for operator reconciliation and do not automatically resend those attempts. Document this limited delivery trade-off rather than silently claiming exactly-once behavior.

### Initialization

Initialize private awareness records without inventing past sends or automatically mailing the existing database at deployment. Bootstrap each existing recipient's current choices as their baseline when the feature is enabled; subsequent externally caused impacts queue alerts. Existing non-null contention_email_sent_at values do not prove a specific choice/status was communicated and must not fabricate notification snapshots. New volunteers receive a baseline from their first saved choices and are eligible for later external impacts.

## Risks / Trade-offs

- [Skipped losing choices hide the actual impact] → Use awareness snapshots and pending losses before selecting the fallback.
- [Self-edit suppression hides another user's later impact] → Attribute events individually and compare revisions rather than suppressing all mail to a recent editor.
- [Send races erase newer changes] → Revalidate before send and acknowledge only the sent revision afterward.
- [SMTP acceptance and database commit cannot be one transaction] → Persist attempts and surface ambiguous completion for reconciliation instead of automatic duplicate sends.
- [Rolling back loses live alert maintenance] → Disable scheduling first and retain additive history/outbox records for revalidation on redeployment.

## Migration Plan

1. Deploy additive private tables and actor-aware mutation capture with sending disabled. Preserve existing request IDs and contention fields.
2. Run isolated fixtures and dry-run previews, including the three-group displacement example, sequential losses, combinations, and the 90-requestor workload.
3. Configure canonical origin, relay, sender, and explicit alert enablement. Bootstrap awareness and persist schedule before the first two-hour run.
4. Monitor run summaries and failures; document commands to preview, disable, and reconcile ambiguous attempts. Rollback disables the worker and preserves its tables; re-enable only after current-state reconciliation.

## Open Questions

None blocking the proposal. Enablement is explicit, migration does not initiate historical catch-up emails, and ambiguous relay outcomes require reconciliation.
