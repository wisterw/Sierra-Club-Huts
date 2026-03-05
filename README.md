The Sierra Club hut volunteers earn early reservation privileges through their service each fall.  Voles (Volunteer Engage and Ski) is a web-based application for the volunteers to enter their reservation requests.  The application shows the total spots requested so far for each hut-date combination, allowing requestors to adjust their requests and reduce overlap with other requestors.  It also saves time for the hut coordinator.

### Authenticating users

You will receive an email with a login link.  Click the link to login to Voles.  Come back to this email or bookmark the link -- it will work for the reservation period and there is no other password.

### Profile tab

Check your profile and update any missing information.

### Requests tab

The request tab is split into two panels.  The left panel shows the user’s “choices list” (first choice, second choice, etc.).  The right panel is a detailed “availability view” of the schedule linked to the selected choice and showing availability from a few days before until a few days after the selected date range.

Add your requests in priority order.  As you go, check the right side availability preview to reduce the risk of overlap.  Check as many huts as you are able to, and be flexible with your group size, since that will improve your chances.   You can also enter different huts as different choices (e.g. second choice) if you favor one hut over another.


In the availability view:
* The heavy border indicates your selected dates and huts.
* The yellow cells are vulnerable in a lottery because other group(s) have pending requests of the same priority.  You may want to find other dates or choose more huts or reduce your group size.
* The pink cells are not available because of higher-priority requests.    Find other dates or choose more huts or reduce your group size.  Or, you can hope the other requestor(s) change their requests before the cut-off date.

### For administrators

The app sends emails as one of the administrators and does not have its own email system.  Set up your account so the app can send emails as you.
* adjust /data/requestors.tsv locally.  this has real email addresses, as long as the repository is public we do not want them displayed.
* adjust /etc/msmtprc to use the account name and password.  For Yahoo, this requires getting an app password which is distinct from the password you use to log in to yahoo mail.  See https://github.com/wisterw/Sierra-Club-Huts/blob/main/Docs/setting%20up%20yahoo%20mail%20for%20email%20relay.png for where to find this in Yahoo Mail.  
* set the mail relay environment variables before starting the app:
  * `MSMTP_PATH` (default: `/usr/bin/msmtp`)
  * `MSMTP_CONFIG` (default: `/etc/msmtprc`)
  * `MSMTP_ACCOUNT` (default: `mail_relay_credentials`)
  * `LOGIN_EMAIL_FROM` (optional but recommended if your relay enforces sender address)
* add yourself to data/requestors.tsv as an admin user.  You must be in the requestors file to receive a login code.
