The Sierra Club hut volunteers earn early reservation privileges through their service each fall.  This is a web-based application for the volunteers to enter their reservation requests.  The application shows the total spots requested so far for each hut-date combination, allowing requestors to adjust their requests and reduce overlap with other requestors.  It also saves time for the hut coordinator.

### Project specs and build notes

The overall product spec is in `Docs/PRD.md`. Implementation guidance lives in `Docs/technical design requirements.md` and `Docs/AGENTS.md`. This project was originally built by Codex from those specs.

### Request summary test harness

There is a lightweight sanity test for the request-summary credit rules:
* `node scripts/requestSummaryTest.js`
* or `npm run test:summary`

### Assignment harness

To exercise the assignment algorithm on a small synthetic dataset:
* `node scripts/assignmentHarness.js`

### Authenticating users

Your email has already been recorded in the system by the work party leaders.  When you enter your email we will send a temporary code to that email if it is in the system.  Your browser will remember you for 7 days after a successful login.

### Profile tab

Check your profile and update any missing information.

### Requests tab

The request tab is split into two panels.  The left panel shows the user’s “choices list” (first choice, second choice, etc.).  The right panel is a detailed “availability view” of the schedule linked to the selected choice and showing availability from a few days before until a few days after the selected date range.

Add your requests in priority order.  As you go, check the right side availability preview to reduce the risk of overlap.  Check as many huts as you are able to, and be flexible with your group size, since that will improve your chances.   You can also enter different huts as different choices (e.g. second choice) if you favor one hut over another.


In the availability view:
The grid covers December 15 of the current year through April 30 of the following year (inclusive).
There is a legend above the grid that explains the current choice border and the yellow/red shading.
* The heavy border indicates your selected dates and huts.
* The yellow cells are vulnerable in a lottery because other group(s) have pending requests of the same priority.  You may want to find other dates or choose more huts or reduce your group size.
* The pink cells are not available because of higher-priority requests.    Find other dates or choose more huts or reduce your group size.  Or, you can hope the other requestor(s) change their requests before the cut-off date.

### For administrators

The app sends emails as one of the administrators and does not have its own email system.  Set up your account so the app can send emails as you.
* you may need to adjust /data/requestors.tsv locally.  this has real email addresses, so if the repository is public we do not want them displayed.
* adjust /etc/msmtprc to use the account name and password.  For Yahoo, this requires getting an app password which is distinct from the password you use to log in to yahoo mail.  See https://github.com/wisterw/Sierra-Club-Huts/blob/main/Docs/setting%20up%20yahoo%20mail%20for%20email%20relay.png for where to find this in Yahoo Mail.  
* set the mail relay environment variables before starting the app:
  * `MSMTP_PATH` (default: `/usr/bin/msmtp`)
  * `MSMTP_CONFIG` (default: `/etc/msmtprc`)
  * `MSMTP_ACCOUNT` (default: `mail_relay_credentials`)
  * `LOGIN_EMAIL_FROM` (optional but recommended if your relay enforces sender address)
* add yourself to data/requestors.tsv as an admin user.  You must be in the requestors file to receive a login code.

### Deploying to AWS EC2 (quick guide)

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
If you want HTTPS, terminate TLS with an AWS load balancer or Nginx and forward to `http://127.0.0.1:3000`. When you do this, set `TRUST_PROXY=1` and `SESSION_SECURE=true` so cookies are marked secure only over HTTPS.
