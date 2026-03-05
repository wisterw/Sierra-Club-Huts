## Data Structure

We will use tab-delimited, row/column style files suitable for a relational approach, not hierarchical JSON files, for our persistence store.  Instantiate at startup and update / write changes back to disk periodically so that we can stay up to date in case we need to restart the application.  The cardinality of these objects is under a few thousand rows, so we don’t need a full database approach for now.  The first row should be the header row. 

* Requestors  
  * Requestor\_ID (integer).  primary key.  Auto-generated random number.  Unique.  May be used as a tiebreaking lottery number as well.  
  * Email (string).  Required.  
  * Name (string). May be null.  For email communications.  
  * Phone (string).  Backup communication method.   May be null.  
  * Comments (string).  May be null.  
  * Credits (integer).  Required.  Users with more credits are higher priority and will get to choose first.  
  * Email\_code\_sent (Datetime).  may be null.  For debugging, when did we send their email code most recently.  
  * Admin (boolean).  Does this person have admin rights.  
  * Creation\_date. (datetime).  When was the user record created.  
  * Last\_mod\_date. (datetime).  When was this user record last edited.

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

## Backend

### Internal functions

**hashEmail:** given an arbitrary text string of length 1-100 characters, returns an integer between 1000 and 9999\.  Include before the final hash calculation a secret salt string which is provided at deployment time and is not stored in the code.  This call is only available within the backend, it is not exposed externally.

### Endpoints available externally

Except for checkLogin, all of the backend endpoints require a valid session cookie.  These can be REST-based interfaces, or some other approach could work also.

**checkLogin**.  This endpoint receives an email address and optional hash, and takes the following steps:
* Uppercase the email and strip any leading and trailing spaces.    
* Check the email against the list of requestors to retrieve the user ID.  If it doesn’t exist, return an error.  
* Call hashEmail with the email address and capture the returned code.
  * For the sendEmail method, use a local sendmail endpoint to email the code to the verified address.
  * For the verify method, compare the result with the provided hash.  If the hashes match, return the user ID for the authenticated user.  Otherwise, return an error.
* trap any errors from these steps and send them back to the front end; otherwise send the received error.

**Requestor.**  Endpoint to get and mutate details about a specific requestor\_id, including their requests.  Returns, and accepts, requestor details.  Admins can do this for all requestors.

**requestSummary.**  Endpoint to get a read-only summary of all requests.  Accepts a choice number (first choice, second choice, etc).  Returns a count of groups and spots requested by date and hut.