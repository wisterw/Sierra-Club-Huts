The Sierra Club ski hut volunteers earn early reservation privileges through their service each fall.  This is a web-based application for the volunteers to enter their reservation requests.  The application shows the total spots requested so far for each hut-date combination, allowing requestors to adjust their requests and reduce overlap with other requestors.  It also saves time for the hut coordinator.

## For Users

The app runs as its own website. This year's workflow is ski-trip requests for existing volunteers; the coordinator continues managing work parties manually. Trip preferences are requests, not confirmed reservations.

### Logging in

Your email has already been recorded in the system by the work party leaders.  When you enter your email we will send a temporary code to that email if it is in the system.  Your browser will remember you for 7 days after a successful login.

If your email has not been recorded, contact your hut coordinator. There is no self-registration. A direct link to a page returns you to that page after sign-in when your role and the current season mode permit access.

### Navigation

Trip Requests (`/trip-requests`) is where you manage preferences and review availability. Profile (`/profile`) contains your contact details, waiver actions, and saved request summary. Administrators also have Admin (`/admin`). These URLs support bookmarking, refreshing, and browser Back/Forward. The root URL selects the current season's workflow; unavailable pages return you to an available page with an explanation.

If your session expires, sign in again in the same tab to recover unsaved trip choices for the same account. They are not saved automatically. Refreshing the page reloads saved requests, and signing in as a different volunteer or logging out clears the prior account's drafts.

### Requests tab

The request tab is split into two panels.  The left panel shows the user’s “choices list” (first choice, second choice, etc.).  The right panel is an “availability view” of sleeping spots, reflecting other volunteers' requests.

We recommend entering your preferences early, to stake out your preferences, and then checking back again closer to the deadline to see how the rest of the group has settled out.

### Profile tab

Check your profile and update any missing information.

## For administrators

### Email setup using MSMTP

The app sends emails as one of the administrators and does not have its own email system.  Set up your account so the app can send emails as you.
* you may need to adjust /data/requestors.tsv locally.  this has real email addresses, so if the repository is public we do not want them displayed.
* adjust /etc/msmtprc to use the account name and password.  For Yahoo, this requires getting an app password which is distinct from the password you use to log in to yahoo mail.  See https://github.com/wisterw/Sierra-Club-Huts/blob/main/Docs/setting%20up%20yahoo%20mail%20for%20email%20relay.png for where to find this in Yahoo Mail.  
* set the mail relay environment variables before starting the app:
  * `MSMTP_PATH` (default: `/usr/bin/msmtp`)
  * `MSMTP_CONFIG` (default: `/etc/msmtprc`)
  * `MSMTP_ACCOUNT` (default: `mail_relay_credentials`)
  * `LOGIN_EMAIL_FROM` (optional but recommended if your relay enforces sender address)
* add yourself to data/requestors.tsv as an admin user.  You must be in the requestors file to receive a login code.

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
* `PORT=3000` (or another port if you put the app behind Nginx/ALB)
* `SESSION_SECRET` (required in production)
* `TRUST_PROXY=1` (set to `1` if you terminate TLS at a load balancer or reverse proxy)
* `SESSION_SECURE=true` (set to `true` only when requests reach the app over HTTPS)
* `PUBLIC_HOST` (optional: the DNS name you want to show in logs)
* `PUBLIC_SCHEME` (optional: `https` if you want logs to show HTTPS)
* Mail relay variables from the section above if you want login codes emailed.

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

1. Configure the production session secret, HTTPS/proxy settings, and mail relay described above. Verify a login code reaches an operator-controlled test email address already recorded in the system.
2. Load eligible volunteers through Admin's volunteer TSV upload and check their credits and profiles. Keep the existing database and waiver storage persistent across deployments.
3. In **Admin → Application settings**, select **Trip Request mode** and save. The app preserves its stored mode across restart; deploying a new build does not force this setting. Work Party and Inactive modes remain available for later seasons.
4. Verify `/trip-requests`, `/profile`, and authorized `/admin` links directly over HTTPS, including refresh, Back/Forward, static assets, and a returning session. Check that non-admins cannot access Admin and unavailable workflows obey the selected mode.
5. Check the sign-in, request editor, availability summary, and request save/reload journey on a phone and desktop. On narrow screens, wide tables scroll within their own areas.

To roll back this presentation change, restore the previous application build while retaining the database, waiver storage, and session configuration. Saved volunteer and trip-request records remain compatible. Change the season mode separately through an administrator account if needed. The Drupal embedding change has been cancelled.

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

The standalone browser check uses an isolated temporary database and fresh headless Chrome, tests routing and authentication continuity, and saves mobile/desktop screenshots in the temporary directory printed on completion. Install development dependencies with `npm install` and provide Google Chrome, or set `TEST_BROWSER_CHANNEL=msedge` to use Microsoft Edge. It does not use a personal browser profile or send login emails. The API smoke check also creates its own fixture accounts instead of depending on local volunteer TSV files.

### User and admin workflows

The application supports three operating modes: `work-party`, `trip-request`, and `inactive`. In Work Party mode, requestors can review and save work-party interests. In Trip Request mode, requestors manage ski trip requests and review the availability summary. In Inactive mode, the mode-specific tabs are disabled.

The Profile tab is where requestors update contact details and optional skill fields. Admin users can also edit credits, admin status, private comments, and liability waiver date. The Admin tab is where administrators change the application mode, upload requestors, regenerate lottery numbers, run assignment, and download joined request data.
