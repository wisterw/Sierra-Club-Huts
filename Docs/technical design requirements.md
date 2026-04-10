## Data Structure

We will use tab-delimited, row/column style files suitable for a relational approach, not hierarchical JSON files, for our persistence store.  Instantiate at startup and update / write changes back to disk periodically so that we can stay up to date in case we need to restart the application.  The cardinality of these objects is under a few thousand rows, so we don’t need a full database approach for now.  The first row should be the header row. 

* Requestors  
  * Requestor\_ID (integer).  primary key.  Auto-generated random number.  Unique.  
  * Email (string).  Required.  
  * first_name (string). May be null.
  * last_name (string).  May be null.
  * address (string)
  * city (string)
  * state (string).  US state.
  * zip (string).  ZIP code.
  * Phone (string).  Backup communication method.   May be null.  
  * Comments (string).  May be null.  
  * Credits (integer).  Required.  Users with more credits are higher priority and will get to choose first.  
  * login_code (integer).  May be null if never logged in.
  * code_generated_when (Datetime).  may be null.  For code expiry, when did we send their email code most recently.  
  * Admin (boolean).  Does this person have admin rights.  
  * Creation\_date. (datetime).  When was the user record created.  
  * Last\_mod\_date. (datetime).  When was this user record last edited.
  * last\_failed\_login (datetime).  When was the last bad login code entered (for limiting brute force attacks)
  * years of service.  How many of the prior 3 years the requestor has volunteered.

* Requests.
  * Request\_ID (integer).  Primary key.
  * Requestor\_ID (Integer).  
  * Benson.  Boolean.  
  * Bradley.  Boolean.  
  * Grubb.  Boolean  
  * Ludlow.  Boolean.  
  * Arrival (date).  Check-in date.   For combination trips, the second arrival should be the same as the first departure.
  * Departure (date).  Ending date (check-out) of the hut stay.  Must be after Arrival.  
  * Choice\_Number (integer).  For example, 1 \= first choice, 2 \= second choice, etc.  A combination trip will have the same choice number twice with contiguous (non-overlapping) dates, for example a first choice with Benson and another first choice with Bradley, and the arrival date for the second request matches the departure date for the first request.
  * Spots\_ideal.  Number of people requested.  Required to be between 1 and 15 (12 max for some huts).    
  * Spots\_min.  The fewest \# of spots the requestor would accept without going to their next choice.  
  * Hut\_granted.  Which hut was selected of the options.  
  * Spots\_granted.  Spots that were available for confirmed requests.  
  * Status. (string).  requested, granted, lost-lottery, not-needed.  Default is "requested".  (Legacy values pending/confirmed should be treated as requested/granted.)
  * Lottery_value.  random # generated for the assignment lottery.  
  * Creation\_date. (datetime).  When was the request created.  
  * Last\_mod\_date. (datetime).  When was this request last edited.
  * hut_count_flexibility (integer).  How many huts the request is open to.  This is a calculated field, based on the # of huts marked TRUE.
  * saturday_week_number (integer).  This is a calculated field.  Using the saturday closest to the midpoint of the trip, which saturday does the trip cover.  This is calculated from the (departure date - arrival date) / 2 to get the midpoint, then find the closest saturday to that midpoint and calculate the week number for that saturday.
  * Combination_first_request.  (integer).  The Request\_ID of the first hut.

* Request list verification when saving:
  * Departure is after arrival.
  * For combination trips, the arrival for the second request matches the departure for the first hut request.
  * For combination trips, Grubb and Ludlow are both false (for both the first and second request).
  * minimum spots requested is less than or equal to ideal spots requested.
  * choice numbers are 1 or greater; close gaps to keep them sequential.
  * trip length is 5 days or fewer.
  * arrival and departure are between Dec 15 (current year) and Apr 30 (next year) inclusive.

## Constants and settings
The standard error message for authentication errors is "Login failure, please try again later or contact the hut administrator."
For sending email, use msmtp as a mail relay via nodemailer. Use the account named mail_relay_credentials in /etc/msmtprc The binary for msmtp is at /usr/bin/msmtp 

## Backend

### At Startup

At startup, open the requestors and requests files to make sure they are not locked.  If the files are locked, do not exist, or exist but do not have a valid header row, throw an error to the console and exit.

### Endpoints available externally

Except for checkLogin, all of the backend endpoints require a valid session cookie.  These can be REST-based interfaces, or some other approach could work also.

**sendEmail**.  This endpoint receives an email address from a user and enables valid users to login to the app:
* Strip any leading and trailing spaces.    
* Check the email against the list of requestors to retrieve the user ID (case insensitive lookup).  If the provided email doesn’t exist, log an error quietly in back-end logs but return success to the front end ("code sent") to reduce the risk of user enumeration due to distinct error behavior.
* if the provided email exists in the requestors file, generate a 4-digit random integer from 1000-9999.
* write/persist the integer to the login_code column of the requestors file.  Write also the current time to the "code_generated_when" timestamp.  
* Use msmtp to email the code to the verified address.  
* For any internal errors caught while trying to send an email, append them to a local logfile 

**checkLogin**.  This endpoint receives an email address and a login code, and takes the following steps:
* strip any leading and trailing spaces.    
* Check the email against the list of requestors (case-insensitive).  If the provided email doesn’t exist, log an error quietly in back end logs but return the standard error message to the front end to reduce the risk of user enumeration due to distinct error behavior.
* Check the "last_failed_login" attribute for that user and verify that the current time is 1 minute or more after last_failed_login.  If less than 1 minute in the past, return the standard error message.
* Check the "code_generated_when" timestamp from the Requestors file.  If more than 10 minutes in the past, return the standard error message.
* Retrieve the code as persisted in the login_code column of the Requestors file.
* Compare the result with the code entered in the web form.  If the codes match, return the user ID for the authenticated user.  If the codes do not match, return the standard error message and write the current time to  "last_failed_login" for that user.

**Requestor.**  Endpoint to get and mutate details about a specific requestor\_id, including their requests.  Returns, and accepts, requestor details.  Admins can do this for all requestors.

**requestSummary.**  Endpoint to get a read-only summary of all requests.  Accepts a choice number (first choice, second choice, etc) and the requestor id for the currently selected request.  Returns per date and hut:
* higher-priority spots requested = ideal spots requested by higher-priority choices for requestors with the same credits as the selected requestor, plus ideal spots requested by first-choice requests from requestors with higher credits.  Split spots across all huts marked on a request.
* same-priority spots requested = minimum spots requested for the same choice number from requestors with the same credits as the selected requestor.  Split spots across all huts marked on a request.
* same-priority groups requesting = number of distinct requestors for the same choice number and credits for that hut and date.
