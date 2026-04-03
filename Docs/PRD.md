## Current Context

The Sierra Club runs 4 popular backcountry ski huts.  The huts are maintained by volunteers.  In exchange for their service, the volunteers receive preference when making reservations.  Under the current process, an administrator enters requests from emailed forms in Word or PDF format.  Gathering all the data in a spreadsheet, the administrator manually sorts the requests by property, date, and priority to try to get everybody one of their choices.  Because requestors cannot currently see others’ reservation requests, however, they are unable to adjust their requests at the time of making them to reduce the risk of potential overlap.  As a result, requestors are asked to provide many backup choices.

## Proposal

A web-based application summarizing existing requests will help requestors navigate around other requests, improving the chances that everyone gets one of their top choices.  Additionally, allowing participants to do their own data entry and automating the lottery will save time for the administrator.

## Summary

Write a multi-user web-based application for a community of requestors to self-manage reservation requests for 4 backcountry huts.  The application will show the total spots requested so far for each hut-date combination, allowing requestors to adjust their requests and reduce overlap with other requestors.  There will be several components to the system:

* Data Structure.  The format for the Requestor and Requests files.  
* Backend.  Provides authenticated REST-based access to the Requestor and Request data for the user interfaces.  
* Front end interface.  Where users create and adjust their requests.  
* Admin interface.  The admin interface is for the hut administrator to manage requestor information, run the assignment process, and send out notifications.

## Key Workflows
### End User (Requestor)
* Check and optionally update profile information
* Enter preferred reservation locations and dates as a series of requests -- first choice, second choice, etc.  Each request can have an ideal and minimum party size and can have a choice of huts (in case the user has no strong preference on hut choice).
* Adjust requests based on feedback in the app or an email reminder.  If some locations or weekends are especially busy, users with more flexibility may choose to go on different dates or to a different hut.

### Admin User
* Collect list of volunteers (happens prior) and loads it into the app.
* Send out a personalized email to all volunteers with their login code.
* Remind users to review their requests prior to the deadline and make sure they are taking advantage of openings.
* Lock requests and run the lottery, assigning huts to requestors.

## Front end Interface

Requestors use a web browser to access the application. 

### Application title
The title of the application is "Sierra Club Ski Huts".
The subtitle of the application is "Volunteer pre-reservation request system".

### Authenticating users (login page)

Instead of a password system, we will send a code to the email of record.  The code will be valid for approximately 10 minutes.  The login page should show the following controls:
* email.  Text field for user to enter their email.
* "send login code to email" button.  This button should call the sendEmail endpoint.  Show a message here that "If we have the email on file, a code has been sent.  Please note that it can take up to 1 minute for the email to come through"
* code.  Numeric field for user to enter the 4-digit code they received in their email.
* "Login" button.  This button should call the checkLogin endpoint.

When a user returns to the application within 7 days of a successful login using that same browser, the application should remember them.  If after 7 days, they can ask for a new code to be emailed.

### Requests tab

The requests tab is the default tab.  The requests tab is split into two panels.  The left panel shows the user’s “choices list” (first choice, second choice, etc.).  The right panel is a detailed “availability view” of the schedule linked to the selected choice and showing availability from a few days before until a few days after the selected date range.

#### Request list

This panel occupies the left of the Requests tab and shows the list of the user’s requests.  

* Requests are shown in priority order (first choice, second choice, etc).  Next to the choice number, offer a small info icon which shows on hover: "Add your requests in priority order. Check the availability preview on the right to reduce overlap." 
* Requests are shown in collapsed (or summary) form by default and can be expanded with a small button with a stylized plus sign, which switches to a minus sign if the choice is expanded.    
* When a request is expanded, all other requests are collapsed, leaving only one request expanded and in focus at a time.    
* Initially, the user has no requests, and one blank request is provided.     
* By default, the first choice request is expanded and the other choices are shown in collapsed form.
* The request details include:  
  * Hut (checkboxes).  Multiple choices are allowed.  At least one is required.  Choices are Benson, Bradley, Grubb, Ludlow, Benson-\>Bradley, and Bradley-\>Benson.  Offer a small "circle-i" info icon which shows the following on hover: "Including more huts helps your odds, but you may end up with any hut.  Use extra choices for lower priorities."
  * For the combination trips Benson-\>Bradley and Bradley-\>Benson, both can be selectable.  In general, the user at this point is just indicating which trips they are interested in.  We will pick the one that allocates the space most efficiently to all the users and then the requestor will just take that one trip.
  * Arrival / check-in (date picker).  Required.  
  * Departure / check-in (date picker).  Required.  
  * Ideal spots requested (free-form integer). Between 1 and 15\.  Required.  
  * Minimum spots requested.  Integer between 1 and the ideal spots requested (inclusive).  Optional.  
  * Traverse date (date picker).  Available only if a combination hut is selected.  Required if a combination hut(s) is/are selected.    
* Each request has a “save” button and a “delete request” button below the data entry fields.  
* Layout proposals
  * can put the Arrival and Departure dates side-by-side to save vertical space.
  * can list the hut options in two columns to save vertical space.
  * can put the Ideal and Minimum spots side-by-side to save vertical space.
* The Request list works with the Requestor endpoint to add, remove, and adjust requests.  
* Treat combination / traverse requests as two separate requests of the same priority.  The traverse date is the departure / checkout date from the first hut, and also the arrival / checkin date for the second hut.
* Verify the departure date is after the arrival date when saving
* For combination trips, verify the traverse date is after the arrival date and before the departure date.
* Verify the minimum spots requested is the same or fewer than the ideal spots requested.
* Verify the choice numbers are 1 or greater.
* When saving a request, adjust the request numbers to keep them in the same relative order but close any gaps.  For example, if the choices are 1, 2, and 4, renumber choice 4 to be 3, resulting in 1, 2, 3.
* The maximum trip length is 5 days.  Verify that the difference between the arrival and departure dates is 5 days or fewer.
* Verify that the arrival and departure dates are no earlier than December 15th of the current year and no later than April 30th of next year.
* Update calculated fields (hut_count_flexibility, saturday_week_number) every time a request changes.

#### Availability view

The availability view occupies the right side of the Requests tab.  It shows the selected request from the left panel in context with all other users’ requests for that same priority / choice level (first choice, second choice, etc), so that the user can see if there is an opening for their desired date.  The availability view uses the requestSummary endpoint and the currently selected Request details from the left panel.

The availability view is a grid of 6 or 7 columns including some header columns, and 138 rows (139 when the upcoming year is a leap year) including a header row.  The header row shows headers for each column:
* Month and year
* Day of week and day of month
* One column for each hut: Benson, Bradley, Grubb, and Ludlow.

There is a row for each day from December 15th of the current year through April 30th of the following year (inclusive).  Saturday and Sunday are in bold.  Show the month only for the first day of the month or the first visible row of the scroll area; for other days of the month, the month column can be left blank.

For each of the cells (182 days x 4 huts), calculate but do not display the following decimals to the tenth of a spot.

* Higher-priority spots requested:  Sum the following:
  * ideal requested spots for higher priorities (lower number choices) than the selected request, across all users with the same credit level.  For requests open to multiple huts, divide the requested spots by the number of huts in the request.  
  * ideal requested spots for choice 1 requests across all users with a higher credit level.  For requests open to multiple huts, divide the requested spots by the number of huts in the request.
  For example, user 101 for their first choice is open to Grubb or Bradley, and requesting 3 spots, checking in February 4 and checking out February 5th.  That counts as 1.5 spots for each of Grubb and Bradley, for the night of February 4th.  
* Same-priority spots requested.   Sum the minimum requested spots for the same priority (same-numbered choice) as the selected request, across users with the same # of credits.  For requests open to multiple huts, divide the requested spots by the number of huts in the request.   
* Same-priority groups requesting.  Count the number of distinct groups for that hut and date.  A lottery may choose between these groups.  

Display to a precision of one-tenth of a spot the remaining hut capacity.  Remaining hut capacity = (
* the starting hut capacity (12 or 15) minus
* the higher-priority spots requested, minus
* the same-priority spots requested).

Style each cell as follows:

* Heavy border around the currently selected request hut(s) and date(s).  
* Shade yellow if the minimum spots requested is greater than (the hut capacity minus the higher-priority spots requested, minus the same-priority spots requested).   Yellow cells are “subject to lottery.”  
* Shade the cell light red or pink if the minimum spots requested is greater than (the hut capacity minus the higher-priority spots requested).  Pink cells are “unlikely at present.”
* Otherwise the cells don't need to be shaded at all.

When hovering over a given cell for more than 1 second, pop up a helper text or tool tip on that cell that shows the hut capacity, higher-priority spots requested ("Higher-pri spots req."), same-priority spots requested ("Same-pri spots req."), and same-priority number of groups.

There is a legend above the availability grid with three small example squares and the following labels for each:
* heavy border styling: "Current choice"
* yellow shading: "Other groups also have this as the same choice # -- may be subject to lottery"
* red shading: "Groups with more credits or a higher-priority choice have requested this -- may be unavailable"

The scroll for the availability grid should be set to a few days before the arrival date in the request.  If the arrival date in the request is blank, the availability grid should be scrolled to the top.

### Profile tab

The Profile tab is the second tab.  The Profile tab shows the following fields:

* Email (not mutable)  
* First name (mutable)  
* Last name (mutable)  
* Address (mutable)  
* City (mutable)  
* State (mutable)  
* ZIP (mutable)  
* Phone (mutable)  
* Comments (mutable)  
* Is\_an\_admin flag (mutable by admin users only)  
* credits (mutable by admin users only)

There is a save button for persisting edits to the mutable fields.  The profile tab works with the requestor endpoint.

### Admin tab

The admin tab is only available to users for whom the admin flag is set to TRUE.  The admin tab allows an upload of a tab-delimited file with a header row to upload the users table and a menu for other actions.

The admin tab has a clickable list of available actions.  Actions include:

#### Upload list of requestors 
Upload a tab-delimited file.  This will create new records where a requestor’s email does not exist already, and update records where the email is already present.  

#### Download requests
This action provides an administrator a look at the full data set, with requests and requestors joined together.  Include the following fields:
 * From requestors:
   * Requestor\_ID  
   * Email
   * first_name
   * last_name
   * address
   * city
   * state
   * zip
   * Phone
   * Comments 
   * Credits
   * code_generated_when 
   * Admin (boolean)
   * Creation\_date 
   * Last\_mod\_date
   * last\_failed\_login
   * years_of_service
 * From requests:
   * Benson
   * Bradley
   * Grubb
   * Ludlow
   * Arrival 
   * Departure 
   * Choice\_Number
   * Spots\_ideal
   * Spots\_min
   * Hut\_granted
   * Spots\_granted
   * Status
   * Lottery_value 
   * Creation\_date  
   * Last\_mod\_date
   * hut_count_flexibility
   * saturday_week_number

Run the join as an outer join, where a row is included for each requestor even if they have no requests.

Sort the results by:   
  1. Saturday_week_number
  2. Requestor credits descending
  3. Choice_number ascending  
  4. hut_count_flexibility
  5. Lottery_value
  
Provide a radio group next to this action which has three options:
* Include all requests
* Granted requests only
* Requestors with no requests

#### Run assignment algorithm
(as described below in this document)

#### Efficiency report
Calculate the % of requesting groups (and spots) who got their first choice, second choice, etc.

## Assignment Algorithm

The goal of the assignment algorithm is to match requests to huts to maximize the number of requestors receiving a choice as close as possible to their first choice, while respecting the priorities of the different requestors.  The algorithm operates as follows:  
### Setup
1. Set all requests to "requested" to reset from prior runs.
2. Set all request spots_granted to spots_ideal.  These may be decremented in the case of contention between groups as the algorithm proceeds.
3. hut_count_flexibility should be set already but can re-calculate this for all rows in case there have been edits to the requests file from some other source.
4. saturday_week_number should be set already but can re-calculate this for all rows in case there have been edits to the requests file from some other source.
### Build Lottery Groups
Group requests.  Skip requests with status "not-needed". Process in order:
* requestors with the highest credit first.
* within requestors with the same credit level, requests with the lowest choice number first.
* within requests with the same credit level and choice number, group by the same saturday_week_number.
* For each combination of credit level, choice number, and week, group by hut_count_flexibility (4,3,2,1), working with the highest hut_count_flexibility first.
### Run Lotteries
* For all the requests of the same credit level, choice number, saturday_week_number, and hut_count_flexibility, assign a random lottery # to Lottery_value.
* Skip over requests with status "not-needed" -- these requestors already have received their request.
* Working through the requests in order of their Lottery_value:
  * Calculate the available spots for each hut and for each night of the requested trip.
  * Compare to the requested ideal # of spots in that request.
     * If there are spots available, set hut_granted to the hut with the most available spots.  If there are multiple huts with the same # of available spots, and the request is open to multiple huts, favor Ludlow, then Benson, then Bradley, then Grubb (from the subset of options the user has indicated they are open to).  Set request status to granted.  Set the lower-choice requests for this requestor to "not-needed".
     * (else) If there are not enough available spots, reduce the spots_granted by 1 and try again.  Continue decrementing spots_granted as long as it is at or equal to spots_min.
     * If we have reduced spots_granted to spots_min and request now fits (there are spots available), set hut_granted to the identified hut.  Set status to granted.  Set the lower-choice requests for this requestor to "not-needed".
     * (else) There are still not enough available spots in any hut, we can try to reduce the other requests to free up spots:
        * For each night and hut in the request, calculate the maximum available spots (as if each other request were at its spots_min).
        * If the maximum available spots is less than the current request spots_min for any date, there is no way to fit the current request.  Set request status to lost-lottery.
        * (else) There are spots available for all requested dates by reducing other requests.  
          * Identify all the other requests for any of the requested huts and all of the contentious dates, including across requests of higher credit levels and choice numbers.  
          * As you go, sum the available potential spots if we were to reduce those requests from spots_ideal to spots_min.
          * Narrow the search to the hut with the most available potential spots in a spot reduction.
          * Working through the other requests in random order, reduce spots_granted in those other requests by one (if there is room to reduce without falling below that request's minimum required spots) until the spot deficit becomes zero.
          * Set hut_granted.
          * Set status to granted.
          * Set the lower-choice requests for this requestor to "not-needed".

## Appendix: Hut and trip capacities

Benson=12
Bradley=15
Grubb=15
Ludlow=15
Benson->Bradley=12
Bradley->Benson=12
