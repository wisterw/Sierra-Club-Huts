## Data Structure

We will use tab-delimited, row/column style files suitable for a relational approach, not hierarchical JSON files, for our persistence store.  Instantiate at startup and update / write changes back to disk periodically so that we can stay up to date in case we need to restart the application.  The cardinality of these objects is under a few thousand rows, so we don’t need a full database approach for now.  The first row should be the header row. 

* Requestors  
  * Requestor\_ID (integer).  primary key.  Auto-generated random number.  Unique.  May be used as a tiebreaking lottery number as well.  
  * Email (string).  Required.  
  * Name (string). May be null.  For email communications.  
  * Phone (string).  Backup communication method.   May be null.  
  * Comments (string).  May be null.  
  * Credits (integer).  Required.  Users with more credits are higher priority and will get to choose first.  
  * login_code (integer).  May be null if never logged in.
  * code_generated_when (Datetime).  may be null.  For code expiry, when did we send their email code most recently.  
  * Admin (boolean).  Does this person have admin rights.  
  * Creation\_date. (datetime).  When was the user record created.  
  * Last\_mod\_date. (datetime).  When was this user record last edited.
  * last\_failed\_login (datetime).  When was the last bad login code entered (for limiting brute force attacks)

* Requests.  The primary key consists of four columns: Requestor\_ID, Hut, arrival date, and departure date.  
  * Requestor\_ID (Integer).  
  * Benson.  Boolean.  
  * Bradley.  Boolean.  
  * Grubb.  Boolean  
  * Ludlow.  Boolean.  
  * Arrival (date).  Check-in date.   
  * Departure (date).  Ending date (check-out) of the hut stay.  Must be after Arrival.  
  * Choice\_Number (integer).  For example, 1 \= first choice, 2 \= second choice, etc.  A combination trip will have the same choice number twice with contiguous (non-overlapping) dates, for example a first choice with Benson and another first choice with Bradley, and the arrival date for the second request matches the departure date for the first request.
  * Spots\_ideal.  Number of people requested.  Required to be between 1 and 15 (12 max for some huts).    
  * Spots\_min.  The fewest \# of spots the requestor would accept without going to their next choice.  
  * Hut\_granted.  Which hut was selected of the options.  
  * Spots\_granted.  Spots that were available for confirmed requests.  
  * Status. (string).  Pending, lost-lottery, confirmed, not-used  
  * Confirmed\_How (string).  won-lottery, default  
  * Creation\_date. (datetime).  When was the request created.  
  * Last\_mod\_date. (datetime).  When was this request last edited.

## String constants
The standard error message for authentication errors is "Login failure, please try again later or contact the hut administrator."

## Backend

### Endpoints available externally

Except for checkLogin, all of the backend endpoints require a valid session cookie.  These can be REST-based interfaces, or some other approach could work also.

**sendEmail**.  This endpoint receives an email address from a user and enables valid users to login to the app:
* Strip any leading and trailing spaces.    
* Check the email against the list of requestors to retrieve the user ID (case insensitive lookup).  If the provided email doesn’t exist, log an error quietly in back-end logs but return success to the front end ("code sent") to reduce the risk of user enumeration due to distinct error behavior.
* if the provided email exists in the requestors file, generate a 4-digit random integer from 1000-9999.
* write/persist the integer to the login_code column of the requestors file.  Write also the current time to the "code_generated_when" timestamp.  
* Use a local sendmail endpoint to email the code to the verified address.

**checkLogin**.  This endpoint receives an email address and a login code, and takes the following steps:
* strip any leading and trailing spaces.    
* Check the email against the list of requestors (case-insensitive).  If the provided email doesn’t exist, log an error quietly in back end logs but return the standard error message to the front end to reduce the risk of user enumeration due to distinct error behavior.
* Check the "last_failed_login" attribute for that user and verify that the current time is 1 minute or more after last_failed_login.  If less than 1 minute in the past, return the standard error message.
* Check the "code_generated_when" timestamp from the Requestors file.  If more than 10 minutes in the past, return the standard error message.
* Retrieve the code as persisted in the login_code column of the Requestors file.
* Compare the result with the code entered in the web form.  If the codes match, return the user ID for the authenticated user.  If the codes do not match, return the standard error message and write the current time to  "last_failed_login" for that user.

**Requestor.**  Endpoint to get and mutate details about a specific requestor\_id, including their requests.  Returns, and accepts, requestor details.  Admins can do this for all requestors.

**requestSummary.**  Endpoint to get a read-only summary of all requests.  Accepts a choice number (first choice, second choice, etc).  Returns a count of groups and spots requested by date and hut.