## Current Context

The Sierra Club runs 4 popular backcountry ski huts.  The huts are maintained by volunteers.  In exchange for their service, the volunteers receive preference when making reservations.  Under the current system, an administrator copies or keys-in requests from emailed forms in Word or PDF format.  Gathering all the data in a spreadsheet, the administrator manually sorts the requests by property, date, and priority to try to get everybody one of their choices.  Because requestors cannot currently see others’ reservation requests, however, they are unable to adjust their requests at the time of making them to reduce the risk of potential overlap.  As a result, requestors are asked to provide many backup choices.

## Proposal

In economics, transparency can improve the allocation of a scarce resource by allowing different market participants to trade based on their distinct priorities. The club would prefer a lottery approach over a first-come/first-serve approach.  A web-based application summarizing existing anonymized requests will help more requestors get one of their top choices, and with fewer backup choices required.  Additionally, allowing participants to do their own data entry and automating the lottery will save time for the administrator.

## Summary

Write a multi-user web-based application for a community of requestors to self-manage reservation requests for 4 backcountry huts.  The application will show the total spots requested so far for each hut-date combination, allowing requestors to adjust their requests and reduce overlap with other requestors.  There will be several components to the system:

* Data Structure.  The format for the Requestor and Requests files.  
* Backend.  Provides authenticated REST-based access to the Requestor and Request data for the user interfaces.  
* Front end interface.  Where users create and adjust their requests.  
* Admin interface.  The admin interface is for the hut administrator to manage requestor information, run the assignment process, and send out notifications.

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
  * Departure (date).  Ending date (check-out) of the stay in that hut.  Must be after Arrival.  
  * Choice\_Number (integer).  For example, 1 \= first choice, 2 \= second choice, etc.  
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

**checkLogin**.  receives a hash and email address from frontend as input (these are likely parsed from the login link the requestor has received).

* Uppercase the email and strip any leading and trailing spaces.    
* Check the email against the list of requestors to retrieve the user ID.  If it doesn’t exist, return an error.  
* Call hashEmail with the email.  Compare the result with the provided hash.  
  * If the hashes match, return the user ID for the authenticated user.  
  * If the hashes do not match, return an error.

**Requestor.**  Endpoint to get and mutate details about a specific requestor\_id, including their requests.  Returns, and accepts, requestor details.  Admins can do this for all requestors.

**requestSummary.**  Endpoint to get a read-only summary of all requests.  Accepts a choice number (first choice, second choice, etc).  Returns a count of groups and spots requested by date and hut.

## Front end Interface

### Requestors use a web browser to access the application. 

### Authenticating users

Instead of a password system, we will use a login link sent by email.  To login, users will click a link in an email.  In this link there will be 2 URL parameters: the email address for the account, and a secret code tied to that email. Pass these parameters to checkLogin to authenticate.  

When a user returns to the application after successfully logging in from that same browser and device, the application should remember them.  Otherwise they can retrieve the original email and use the included link.

### Profile tab

The Profile tab shows the following fields:

* Email (not mutable)  
* Name (mutable)  
* Phone (mutable)  
* Comments (mutable)  
* Is\_an\_admin flag (mutable by admin users only)  
* credits (mutable by admin users only)

There is a save button for persisting edits to the mutable fields.  The profile tab works with the requestor endpoint.

### Requests tab

The request tab is split into two panels.  The left panel shows the user’s “choices list” (first choice, second choice, etc.).  The right panel is a detailed “availability view” of the schedule linked to the selected choice and showing availability from a few days before until a few days after the selected date range.

#### Request list

This panel occupies the left of the Requests tab and shows the list of the user’s requests.  

* Requests are shown in priority order (first choice, second choice, etc).  
* Requests are shown in collapsed (or summary) form by default and can be expanded with a small button with a stylized plus sign, which switches to a minus sign if the choice is expanded.    
* When a request is expanded, all other requests are collapsed, leaving only one request expanded and in focus at a time.    
* Initially, the user has no requests, and one blank request is provided.     
* By default, the first choice request is expanded and the other choices are shown in collapsed form only.    
* The request details include:  
  * Hut (checkboxes).  At least one is required.  Choices are Benson, Bradley, Grubb, Ludlow, Benson-\>Bradley, and Bradley-\>Benson.  
  * Arrival (date picker).  Required.  
  * Departure (date picker).  Required.  
  * Ideal spots requested (free-form integer). Between 1 and 15\.  Required.  
  * Minimum spots requested.  Integer between 1 and the ideal spots requested (inclusive).  Optional.  
  * Traverse date (date picker).  Available only if a combination hut is selected.  Required if a combination hut is selected.    
* Each request has a “save” button and a “delete request” button below the data entry fields.  
* The Request list works with the Requestor endpoint to add, remove, and adjust requests.  
* Treat combination / traverse requests as two separate requests of the same priority.  The traverse date is the departure / checkout date from the first hut, and also the arrival / checkin date for the second hut.

#### Availability view

The availability view occupies the right side of the Requests tab.  It shows the selected request from the left panel in context with all other users’ requests for that same priority / choice level (first choice, second choice, etc), so that the user can see if there is an opening for their desired date.  The availability view uses the requestSummary endpoint and the currently selected Request details from the left panel.

The availability view is a grid of 6 columns and 183 rows.  A header row shows headers for Month, Day, and the hut names: Benson, Bradley, Grubb, and Ludlow.  There is a row for each day from December of the current year through May of the following year (inclusive).  Saturday and Sunday are in bold.  Show the month only for the first day of the month or the first visible row of the scroll area; for other days of the month, the month column can be left blank.

For each of the cells (182 days x 4 huts), calculate the following:

* Higher-priority spots requested:  Sum the ideal requested spots for higher priorities (lower number choices) than the selected request, across all users.  For requests open to multiple huts, divide the requested spots by the number of huts in the request.  For example, user 1 for their first choice is open to Grubb or Bradley, and requesting 3 spots, Checking in February 4 and checking out February 5th.  That is 1.5 spots for each of Grubb or Bradley, for the night of February 4th.  
* Same-priority spots requested.   Sum the minimum requested spots for the same priority (same-numbered choice) as the selected request, across other users.  For requests open to multiple huts, divide the requested spots by the number of huts in the request.   
* Same-priority groups requesting.  Count the number of distinct groups for that hut and date.  A lottery may choose between these groups.  

Style each cell as follows:

* Heavy border around the current user’s requested huts and dates.  Check-in days are outlined with a heavy diagonal line from the lower left to upper right of the cell, and down the right side.  Check-out days also use a diagonal line from the lower left to the upper right corner, but with the left side also outlined.  Days in the request that are in the middle of the stay apply the outline to both the left and right sides of the cell.  In this way, each stay looks like a parallelogram.  
* Shade yellow if the minimum spots requested is less than the hut capacity minus the higher-priority spots requested, minus the same-priority spots requested.   Yellow cells are “subject to lottery.”  
* Shade the cell light red or pink if the minimum spots requested is less than the hut capacity minus the higher-priority spots requested.  Pink cells are “unlikely at present.”

When hovering over a given cell for more than 1 second, pop up a helper text or tool tip on that cell that shows the hut capacity, higher-priority spots requested, same-priority spots requested, and same-priority number of groups.

### Admin tab

The admin tab is only available to users for whom the admin flag is set to TRUE.  The admin tab allows an upload of a tab-delimited file with a header row to upload the users table and a menu for other actions.

The admin tab has a clickable list of available actions.  Actions include:

* Upload list of requestors from a tab-delimited file.  This will create new records where a requestor’s email does not exist already, and update records where the email is already present.  
* Download lists of requestors, with requests if assigned or blank if not.  Available filters / sublinks:  
  1. All requestors  
  2. No pending requests  
  3. No likely requests  
  4. No assigned requests  
* Download list of requests joined with users.  sort by:   
  1. Priority choice ascending  
  2. Week \# of closest saturday from the midpoint of the request (in other words, group the requests by week)  
  3. Credits for requestor, descending  
  4. \# of days in the reservation, descending (longest reservations first)  
  5. \# of people in the reservation, descending (largest groups first)  
  6. \# of huts marked, ascending (fewest \# of huts first)  
* Run assignment algorithm.  The assignment algorithm operates similarly to the request download immediately prior and operates as follows:  
  1. Work through pending requests in order of first choice for all users, then second choice, etc.  
  2. For each choice, process one week at a time (any order).  Sequence by the closest Saturday to the middle day of the requested trip.   
  3. For each choice-week combination, work with the requestors with the most credits first.  
  4. For requestors with equivalent credits, pick the harder-to-place request first, as those are harder to place later.  This could apply to larger groups, longer trips, or fewer huts in the request (ie. fewer hut choices are harder to place).  
  5. For each request, place in the hut (of the hut choices that are selected in the request) which results in the most remaining open spots when looking at the single date of the trip that has the fewest remaining open spots (the max of the mins).  Record the assignment in the requestor record (and request) and move to the next request.  
* Efficiency report.  The % of requesting groups (and spots) who got their first choice, second choice, etc.

---

## App Quickstart

### 1. Install dependencies

```powershell
npm install
```

### 2. Set required environment variables

```powershell
$env:EMAIL_HASH_SALT='devsalt'
$env:SESSION_SECRET='dev-session-secret'
```

### 3. Start the app

```powershell
npm start
```

Open: <http://localhost:3000>

### 4. Login with seeded users

The app reads data from `data/requestors.tsv` and `data/requests.tsv`.

Seeded accounts in this repo:

- Admin user
  - Email: `ADMIN@EXAMPLE.COM`
  - Code (with `EMAIL_HASH_SALT=devsalt`): `7245`
- Standard user
  - Email: `USER@EXAMPLE.COM`
  - Code (with `EMAIL_HASH_SALT=devsalt`): `2900`

You can also pass login link style URL params:

- `http://localhost:3000/?email=ADMIN@EXAMPLE.COM&hash=7245`
