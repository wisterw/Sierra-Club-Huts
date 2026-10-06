The Sierra Club ski hut volunteers earn early reservation privileges through their service each fall.  This is a web-based application for the volunteers to enter their reservation requests.  The application shows the total spots requested so far for each hut-date combination, allowing requestors to adjust their requests and reduce overlap with other requestors.  It also saves time for the hut coordinator.

## For Users

The app runs as its own website. This year's workflow is ski-trip requests for existing volunteers; the coordinator continues managing work parties manually. Trip preferences are requests, not confirmed reservations.

### Logging in

Your email has already been recorded in the system by the work party leaders.  When you enter your email we will send a temporary code to that email if it is in the system.  Your browser will remember you for 7 days after a successful login.

If your email has not been recorded, contact your hut coordinator. There is no self-registration. A direct link to a page returns you to that page after sign-in when your role and the current season mode permit access.

The notice beside the code field explains that entering your code and logging in acknowledges the Privacy Policy and Terms of Use, including backcountry risk and volunteer liability provisions. Both documents are available before sign-in at `/privacy-policy` and `/terms-of-use`, and through the footer after sign-in. Their links open in a new tab so your form and unsaved trip choices remain in the original tab. The code email includes the supplied risk/liability notice and links to both documents.

Existing email/code and email/hash login links now prefill the form and wait for you to select **Sign in**. Opening the link, requesting a code, or reading an email does not record agreement. A valid existing session continues to work normally.

### Navigation

Trip Requests (`/trip-requests`) is where you manage preferences and review availability. Profile (`/profile`) contains your contact details, waiver actions, and saved request summary. Administrators also have Admin (`/admin`). These URLs support bookmarking, refreshing, and browser Back/Forward. The root URL selects the current season's workflow; unavailable pages return you to an available page with an explanation.

If your session expires, sign in again in the same tab to recover unsaved trip choices for the same account. They are not saved automatically. Refreshing the page reloads saved requests, and signing in as a different volunteer or logging out clears the prior account's drafts.

### Requests tab

The request tab is split into two panels.  The left panel shows the user’s “choices list” (first choice, second choice, etc.).  The right panel is an “availability view” of sleeping spots, reflecting other volunteers' requests.

We recommend entering your preferences early, to stake out your preferences, and then checking back again closer to the deadline to see how the rest of the group has settled out.

### Profile tab

Check your profile and update any missing information.

## For administrators

### Email setup using Amazon SES

Login codes and contention alerts are sent from `noreply@tahoe-ski-huts.rsvp` through Amazon SES in `us-east-2` (Ohio). The sender is fixed; legacy sender and MSMTP variables are unused.

* Verify the sender address or its domain in SES in `us-east-2`. Verification is region-specific. If the account is in the SES sandbox, recipients must also be verified; request production access before sending to ordinary volunteers. See [SES sending requirements](https://docs.aws.amazon.com/ses/latest/APIReference/API_SendEmail.html).
* Give the host's AWS role or credentials `ses:SendEmail` permission for the sender. The SDK uses the [default credential provider chain](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html); an EC2 instance role avoids storing keys in the repository. SES SMTP credentials are not used.
* Set `NODE_ENV=production`, `MAIL_TRANSPORT=ses`, and `APP_PUBLIC_URL` to the canonical HTTPS app origin. SES is the default in production. Console mode is rejected in production.
* Outside production, mail defaults to `MAIL_TRANSPORT=console`, which prints login codes locally without AWS calls. Set `MAIL_TRANSPORT=ses` explicitly to send from another environment. Invalid modes are rejected. SES failures never fall back to printing codes.
* Keep real volunteer data private. A recipient must exist in the requestors table to receive a login code.

After deployment, run `npm install`, restart the app, request one login code for your recorded address, and check receipt (including spam) and server logs. A message ID confirms SES acceptance, not inbox delivery. Confirm regional sandbox status and sending quotas if rejected. Local tests use mocks; live SES delivery has not been verified from the laptop.

For alerts, first run `npm run alerts:contention -- --dry-run`, then verify a controlled eligible alert on the host before enabling broad sending. Preserve the reconciliation steps below for uncertain outcomes. SES automatic send retries are disabled because [server errors and timeouts can occur after acceptance](https://docs.aws.amazon.com/ses/latest/dg/troubleshoot-error-messages.html).

To roll back, restore the prior application build, install its dependencies, and restore its MSMTP host configuration. No database migration is required. Keep alert history and reconcile ambiguous attempts before retrying.

### Deploying to AWS EC2

These steps assume an Ubuntu instance, but the same ideas apply to other distros.

1. Launch an EC2 instance and attach an EBS volume if you want data persistence beyond the instance lifecycle.
1. In the security group, allow inbound `22` (SSH) and either `80/443` (recommended with a reverse proxy) or the app port (default `3000`) if you plan to expose it directly.
1. SSH into the instance and install Node.js LTS plus build tools.
1. Clone this repo onto the instance and run `npm install`.
1. Create a systemd service (recommended) to keep the app running after reboots.
1. Configure environment variables (see list below).
1. Start the service and confirm you can load the site.

**Recommended environment variables**
* `NODE_ENV=production`
* `PORT=3000` (or another port if you put the app behind Nginx/ALB). The server listens on `0.0.0.0` (all IPv4 interfaces).
* `SESSION_SECRET` (required in production)
* `TRUST_PROXY=1` (set to `1` if you terminate TLS at a load balancer or reverse proxy)
* `SESSION_SECURE=true` (set to `true` only when requests reach the app over HTTPS)
* `PUBLIC_HOST` (optional: the DNS name you want to show in logs)
* `PUBLIC_SCHEME` (optional: `https` if you want logs to show HTTPS)
* `APP_PUBLIC_URL` (required for production login email links; an HTTPS origin without a path, query, credentials, or fragment)
* SES mail configuration from the section above for login emails.

**Systemd example**
```ini
[Unit]
Description=Sierra Club Huts app
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/sierra-club-huts
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=SESSION_SECRET=change-me
Environment=TRUST_PROXY=1
Environment=SESSION_SECURE=true
ExecStart=/usr/bin/node src/server.js
Restart=on-failure
User=ubuntu

[Install]
WantedBy=multi-user.target
```

**Reverse proxy note**
If you want HTTPS, terminate TLS with an AWS load balancer or Nginx and forward to `http://127.0.0.1:3000`. When you do this, set `TRUST_PROXY=1` and `SESSION_SECURE=true` so cookies are marked secure only over HTTPS. If you are accessing the app over plain HTTP, keep `SESSION_SECURE` unset (or `false`) or the session cookie will not be accepted.

### Standalone deployment and season activation

Host the app at the root of its own HTTPS hostname. Forward page routes, `/api/*`, `/css/*`, and `/js/*` to Express and preserve the pathname so direct links load correctly. Drupal, iframe markup, and a `/lps/workparties` proxy prefix are not required. `PUBLIC_HOST` and `PUBLIC_SCHEME` affect startup logging; configure DNS, TLS, and proxy routing separately.

Before opening trip requests to volunteers:

1. Configure the production session secret, HTTPS/proxy settings, and SES delivery described above. Verify a login code reaches an operator-controlled test email address already recorded in the system.
2. Load eligible volunteers through Admin's volunteer TSV upload and check their credits and profiles. Keep the existing database and waiver storage persistent across deployments.
3. In **Admin → Application settings**, select **Trip Request mode** and save. The app preserves its stored mode across restart; deploying a new build does not force this setting. Work Party and Inactive modes remain available for later seasons.
4. Verify `/trip-requests`, `/profile`, and authorized `/admin` links directly over HTTPS, including refresh, Back/Forward, static assets, and a returning session. Check that non-admins cannot access Admin and unavailable workflows obey the selected mode.
5. Check the sign-in, request editor, availability summary, and request save/reload journey on a phone and desktop. On narrow screens, wide tables scroll within their own areas.

To roll back this presentation change, restore the previous application build while retaining the database, waiver storage, and session configuration. Saved volunteer and trip-request records remain compatible. Change the season mode separately through an administrator account if needed. The Drupal embedding change has been cancelled.

### Agreement documents and acknowledgements

Package `openspec/specs/TERMS OF USE.md` and `openspec/specs/PRIVACY POLICY.md` with the application. The server reads only these two files at startup and publishes their full text on the public agreement pages. Missing files or missing `Last Updated:` labels prevent startup. Use UTF-8 text and retain the intended wording and dates when updating the documents.

After revising either document, restart the app to publish a consistent snapshot and new content-derived version IDs. Existing sessions are not forcibly signed out; subsequent code sign-ins acknowledge the current pair. If an open form carries older versions, sign-in pauses, reloads agreement metadata, and asks the volunteer to review the documents and submit again.

The additive SQLite tables `agreement_documents` and `requestor_agreement_acknowledgements` retain document snapshots and the first server timestamp for each requestor/version pair. These records are private, excluded from profiles and ordinary TSV downloads, and contain no IP addresses or user agents. Requestor deletion cascades their acknowledgement rows. Existing volunteers receive no fabricated historical acceptance records.

API clients that call `POST /api/check-login` must obtain current versions from public `GET /api/agreements` and submit `agreementVersions: { termsOfUse: metadata.termsOfUse.version, privacyPolicy: metadata.privacyPolicy.version }` alongside `email` and `code`. Missing or malformed versions return 400, stale versions return 409, and acknowledgement/session persistence failures return 503 without successful sign-in. Invalid or expired codes retain generic authentication errors.

`APP_PUBLIC_URL` configures absolute email links independently of startup-log settings and request Host headers. Development defaults to `http://localhost:<PORT>`; production email requires an explicitly configured HTTPS origin. Rolling back to the prior application build can retain the new tables and records, but that prior build will not enforce agreement acknowledgement. Do not delete historical acknowledgement records as part of a rollback.

## For Developers

### Project specs and build notes

The overall product spec is in `Docs/PRD.md`. Implementation guidance lives in `Docs/technical design requirements.md` and `Docs/AGENTS.md`. This project was originally built by Codex from those specs.

### Request summary test harness

There is a lightweight sanity test for the request-summary credit rules:
* `node scripts/requestSummaryTest.js`
* or `npm run test:summary`

### Assignment harness

To exercise the assignment algorithm on a small synthetic dataset:
* `node scripts/assignmentHarness.js`

### Database setup and rollback

The app stores its relational data in `data/huts.sqlite` by default. On first start it imports from the TSV files in `data/`. If you want to reset a development database, stop the app and delete `data/huts.sqlite`; the next start will rebuild it from the TSV inputs.

If you want to point the app at another database file, set `DATABASE_FILE` before starting the server. That is the cleanest way to isolate experiments without touching the checked-in data files.

### Fractional work-party credits

Admins can edit credits in increments of 0.1, such as `1.5` or `2.3`. Whole values display as `3`; fractions display as `3.5`. The API and TSV files retain `Credits` in ordinary credit units. SQLite stores exact integer tenths in `requestors.credits_tenths` (`1.5` credits becomes `15`), with no decimal dependency. Negative balances remain supported.

Profile updates and imports reject invalid numbers and values more precise than tenths, such as `1.25`, without rounding. Trailing-zero equivalents such as `1.50` are accepted. Values must fit safe integer tenths and round-trip through public JavaScript numbers without losing a tenth. Omitted profile credits and blank admin-upload Credits cells preserve the current balance. Invalid uploads are rejected as a whole.

Before deploying this schema change, stop the app and back up its database. Startup validates legacy balances and transactionally renames/converts `credits` to `credits_tenths` once. Existing whole and fractional balances keep their meaning; unrelated records remain intact. Invalid legacy balances stop startup with an error identifying the requestor; correct the source balance deliberately and retry. Never run old and new builds simultaneously against the database.

To roll back the credit schema change, restore the previous build together with its pre-migration database backup. The previous build cannot use `credits_tenths`; do not point it at the migrated database. If volunteers or admins have made changes since the backup, reconcile those separately before restoring it.

### Trip request contention tracking

Each saved ski trip request has three server-owned fields exposed in authorized request reads and joined admin exports:

| Field | Meaning |
| --- | --- |
| `contention_status` | `null` (clear), `at-risk`, or `losing` |
| `contention_status_changed_at` | UTC timestamp of the latest actual status transition, including a return to clear |
| `contention_email_sent_at` | UTC completion timestamp of the last confirmed successful contention-email send |

`losing` means the minimum group size exceeds remaining capacity after higher-priority demand. `at-risk` means it fits after higher-priority demand but equal-priority competition may require a lottery. The calculation retains the availability summary's credit/choice priority, demand splitting, and rounding rules. These are demand estimates, independent of final assignment `Status`.

For an ordinary trip, each allowed hut must cover the entire stay; use its worst night and choose the best hut. A different available hut on each night does not make a whole stay clear. Linked Benson/Bradley combination trips require both legs and share the worse leg's status. Invalid legacy combination links stop refresh with a contextual error so they can be corrected deliberately.

After saved request changes, removals, imports, or effective credit changes, the app refreshes all requests synchronously in the same transaction. Bulk uploads refresh their final combined state once; a failed refresh rolls back the mutation. Startup also refreshes before serving requests. Date expansion is cached once per snapshot to support the expected workload of roughly 90 requestors and 300 requests. Run the contention tests to measure refresh/update time on the deployment machine.

Recalculating an unchanged status preserves its transition timestamp. Contention-only updates leave the ordinary request modification time and email timestamp untouched. Normal request saves preserve these fields by durable ID and ignore client-supplied values. Mode changes, lottery regeneration, and assignment outcomes do not reset them.

The optional contention alert worker records successful delivery with immutable notification snapshots and updates surviving represented rows' email timestamps. The separate `store.recordContentionEmailSent(requestIdOrIds)` helper updates email time alone and rejects unknown IDs atomically; the timestamp alone does not identify the status/version emailed. Failed sends and login-code emails do not record a contention send. See the contention alert configuration below.

Back up the database before deployment. Startup adds missing nullable columns idempotently and evaluates current demand. Initial non-null contention gets the actual evaluation time; initially clear rows and all migrated email timestamps remain NULL, with no invented historical events. Rolling back to a build with the preceding schema can retain these additive columns, but that build will not refresh them and may lose them during replacement saves. Re-evaluate on redeployment; history lost during the old build cannot be reconstructed. The separate fractional-credit migration still requires its own matching database backup for rollback.

### Optimized trip allocation

Run lottery now compares whole allocations rather than permanently filling requests in order. Each requesting volunteer contributes their granted choice rank, or **10 if unassigned**. The optimizer minimizes the sum separately for each exact credit level, from highest credits to lowest. A lower-credit improvement cannot worsen the best score of a higher-credit level. Within one credit level, individuals can exchange outcomes if that level's total stays unchanged. For example, four second choices score 8 and beat one first choice with three unassigned volunteers (score 31).

Guest counts can be reduced from ideal toward minimum to make room for other volunteers while preserving the choice-score objectives. Once every credit-level score is fixed, the optimizer maximizes granted person-nights. Thus a larger group wins when smaller groups would not improve choice outcomes. Traverses count as one choice, require capacity on both legs, and share one granted group size. The unassigned score remains literally 10; choice 10 ties unassigned before person-nights, and ranks above 10 can be less desirable than remaining unassigned under this formula.

Final ties use more years of service, then lower lottery number, then lower requestor ID. Allowed hut options determine feasible placements; hut count gives no fairness priority. After rank ties, remaining guest/hut ties are resolved deterministically. These fairness rules never override better choice scores or person-nights. The existing regenerate-lottery checkbox still defaults to on; turning it off preserves non-null values and generates only missing ones.

The packaged, pinned `highs@1.15.3` WebAssembly solver runs locally in a Node worker thread; no Python, native solver installation, or external service is needed. Install dependencies through the committed package lock (`npm ci`). Its MIT license is included in the installed package. `ALLOCATION_TIMEOUT_MS` controls the total execution budget, including loading and all objective/tie phases: default 30000 ms, supported range 1–300000 ms. A timeout or incomplete proof fails the run without saving a partial allocation. There is no automatic greedy fallback.

Assignment is available in trip-request mode and processes the current calendar year's December 15–following-April 30 request season. Other seasons are preserved. Deployment does not reassign requests automatically. Inputs are checked again after solving; if volunteers edit requests, credits/lottery values change, or another assignment commits during the solve, the stale result is rejected. Request outcomes, any regenerated lottery values, and private run metadata commit together. On failure, existing grants and lottery values remain unchanged; the admin sees a reason and can rerun after correcting it.

The efficiency report retains its existing percentage rows and adds per-credit choice scores, granted person-nights, policy version, optimal completion, and solve time. A saved summary is marked out of date after relevant inputs or outcomes change, or when its saved policy differs from the active policy (`credit-rank-person-nights-v3`). Earlier policy versions and metrics remain in history, and existing grants remain intact until an admin deliberately runs assignment again. Grant audits explain the selected choice and reductions below ideal. Live availability colors and contention emails remain demand estimates and do not promise to predict the optimized result.

Use `npm run test:allocation` for exhaustive small-instance comparisons and isolated persistence/API tests. `npm run test:allocation-browser` checks assignment results, score/person-night display, stale summaries, and failure recovery in an isolated headless browser. Use `npm run benchmark:allocation` for representative and dense same-night 90-volunteer/300-row workloads. On the development machine, these completed optimally in approximately 6.6 and 10.1 seconds respectively; deployment performance and different conflict patterns can vary. Benchmark on the deployment machine before increasing workloads or changing the budget.

For rollback, restore the previous application build and its matching dependencies. Additive allocation-run records can remain. Previously committed grants remain until an admin deliberately reruns assignment; the earlier build will use the former greedy assignment policy. The separate fractional-credit migration still requires its documented database/build rollback procedure.

### Verification scripts

The repo includes focused checks for the database migration, application mode, trip request rules, profile access, work-party signup, and assignment behavior:
* `npm run test:migration`
* `npm run test:mode`
* `npm run test:summary`
* `npm run test:profile`
* `npm run test:trip-request`
* `npm run test:work-party`
* `npm run test:assignment-status`
* `npm run test:assignment-lottery-flag`
* `npm run test:smoke`
* `npm run test:standalone`
* `npm run test:login-agreements`
* `npm run test:credits`
* `npm run test:contention`

The standalone browser check uses an isolated temporary database and fresh headless Chrome, tests routing and authentication continuity, and saves mobile/desktop screenshots in the temporary directory printed on completion. Install development dependencies with `npm install` and provide Google Chrome, or set `TEST_BROWSER_CHANNEL=msedge` to use Microsoft Edge. It does not use a personal browser profile or send login emails. The API smoke check also creates its own fixture accounts instead of depending on local volunteer TSV files.

The login-agreement check uses an isolated database and captured mail transport to verify document versions, acknowledgement privacy/deduplication, additive migration, authentication failure cases, and exact email notice text. The standalone browser check also verifies agreement-page source fidelity, accessible notice/link behavior, metadata outages, stale-version recovery, and legacy-link acknowledgement. No test sends agreement emails to real volunteers.

The fractional-credit check uses isolated databases and local API sessions to verify exact conversion, migration/restart behavior, rollback on invalid data or write failure, fractional import/export, admin permissions, and priority comparisons. The standalone browser check also saves fractional credits through the profile in all three modes and checks volunteer read-only display.

The contention checks cover full-trip classifications, combined legs, status transitions, unchanged timestamps, additive migration/restart, forged fields, transactional rollback, authorized exports, and internal successful-send recording without real emails. They also print representative timing for full refreshes and a credit update using an isolated 90-requestor/300-request fixture; timings are machine-specific.

### User and admin workflows

The application supports three operating modes: `work-party`, `trip-request`, and `inactive`. In Work Party mode, requestors can review and save work-party interests. In Trip Request mode, requestors manage ski trip requests and review the availability summary. In Inactive mode, the mode-specific tabs are disabled.

The Profile tab is where requestors update contact details and optional skill fields. Admin users can also edit credits, admin status, private comments, and liability waiver date. The Admin tab is where administrators change the application mode, upload requestors, regenerate lottery numbers, run assignment, and download joined request data.
# Contention alert emails

Contention alerts run every two hours and wait at least one hour after the latest change relevant to each recipient. They follow the highest-ranking remaining choice, consolidate newly lost choices, and omit impacts caused by the recipient's own edit. Merely being logged in does not suppress an alert. Unchanged contention does not generate reminders.

Sending defaults to disabled. To enable it, configure `CONTENTION_ALERTS_ENABLED=true`, `MAIL_TRANSPORT=ses`, and `APP_PUBLIC_URL` (the canonical application origin, HTTPS in production). The worker shares the login SES client and fixed sender; console mode cannot send alerts. Dry-run previews work locally without AWS access. The worker operates only in `trip-request` mode, for the current calendar year's December 15–April 30 request season, and excludes volunteers already granted a reservation in that season.

On first enablement, existing choices become an awareness baseline without historical catch-up emails. Future impacts are recorded atomically with request saves and credit changes. The server checks the persisted two-hour schedule every minute; restart runs a due batch once rather than replaying missed intervals. SQLite leases prevent overlapping server/command workers. Each send has a 30-second timeout, and database write locks are released before contacting SES.

Operator commands:

- `npm run alerts:contention -- --dry-run`: preview currently eligible recipient messages without sending or updating awareness/success records. Configure the origin and sender for previews too. Before first enablement, there are no pending messages to preview.
- `npm run alerts:contention`: evaluate a due batch when explicitly enabled.
- `npm run alerts:contention -- --force`: evaluate now, retaining the one-hour quiet period and overlap protection.
- `npm run alerts:contention -- --attempts`: list interrupted or ambiguous delivery attempts.
- `npm run alerts:contention -- --reconcile ATTEMPT_ID accepted`: after verifying SES acceptance, record that exact snapshot as sent.
- `npm run alerts:contention -- --reconcile ATTEMPT_ID rejected`: after verifying it was not accepted, allow a later scheduled retry.

Run summaries report sent, failed, and ambiguous counts. Definite SES rejection is retryable; unknown outcomes, timeouts, or a crash between acceptance and recording require operator reconciliation and are not automatically resent. Exactly-once delivery across SES and SQLite is not guaranteed. Private history retains the exact message and represented choices; public volunteer payloads do not expose actor/history records.

To disable or roll back sending, set `CONTENTION_ALERTS_ENABLED=false` and restart the server (and stop external worker invocations). Retain the additive notification tables. Re-enabling revalidates pending impacts against current choices; it does not reset the original awareness baseline. Use `npm run test:contention-alerts` for isolated fake-clock/fake-transport coverage, with no live emails.


### Existing priority reservations

Admins can use **Admin ? Existing reservations** to upload a TSV or paste spreadsheet cells. Download the sample header there. Required columns are `Reservation_reference`, `Name`, `Hut`, `Arrival`, `Departure`, and `Guests`; optional columns are `Traverse_date` and `Notes`. Names identify the original booking and are stored on its placeholder requestor. Notes and names are visible in admin reservation management/exports, while volunteer availability shows only reserved bed counts.

Use YYYY-MM-DD dates in the current calendar year's December 15?following-April 30 request season. Checkout day is excluded. A single-hut row leaves Traverse_date blank. A combination row uses `Benson->Bradley` or `Bradley->Benson` and a traverse date strictly between check-in and checkout. Each leg can occupy at most five nights. Guests must be a positive integer within every selected hut's capacity; specify full capacity to reserve the whole hut.

References are required, trimmed, case-sensitive and globally unique. Reimporting a reference updates the same placeholder and booking; omitted references remain intact. Use reimport to edit a booking and Remove to release it. Conflicts among retained and imported priority reservations reject the whole batch, including newly created placeholders. Ordinary volunteer demand may overlap: availability marks existing reserved beds and retains warning-based submissions.

Each booking gets one flagged placeholder with a non-deliverable generated identity and one logical first choice, including two linked legs for a traverse. Minimum and ideal guests are equal. Effective placeholder credits always exceed ordinary volunteers in preview, contention and allocation, even if ordinary balances later increase; exceeding the supported numeric boundary fails clearly. Placeholders cannot log in or receive login/alert emails and are excluded from volunteer management and fairness statistics. Their demand can trigger the normal delayed contention alerts for real volunteers.

Imports and removals do not run the lottery or send invitations. An admin must deliberately Run lottery to grant the fixed bookings and allocate residual capacity. Policy `credit-rank-person-nights-v3` reports priority booking counts/person-nights separately from volunteer choice scores; total occupied person-nights includes both. Earlier summaries remain historical and stale, with grants unchanged until a successful new run. Relevant imports/removals invalidate in-flight results.

Run `npm run test:reservations` and `npm run test:reservations-browser` for isolated coverage. `npm run benchmark:allocation -- --placeholders` adds four priority bookings to the 90-volunteer/300-request fixture. Local checks completed both season-distributed and dense fixtures in approximately 4.5 seconds (94 requestors, 304 rows); these timings are not production guarantees.

Before rolling back to a build unaware of placeholders, export and remove imported reservations and preserve a database backup: the older build does not enforce their authentication exclusion or effective priority. Do not discard the booking list or allocation history.
