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
* By default, the first choice request is expanded and the other choices are shown in collapsed form.
* The request details include:  
  * Hut (checkboxes).  Multiple choices are allowed.  At least one is required.  Choices are Benson, Bradley, Grubb, Ludlow, Benson-\>Bradley, and Bradley-\>Benson.  
  * For the combination trips Benson-\>Bradley and Bradley-\>Benson, both can be selectable.  In general, the user at this point is just indicating which trips they are interested in.  We will pick the one that allocates the space most efficiently to all the users and then the requestor will just take that one trip.
  * Arrival / check-in (date picker).  Required.  
  * Departure / check-in (date picker).  Required.  
  * Ideal spots requested (free-form integer). Between 1 and 15\.  Required.  
  * Minimum spots requested.  Integer between 1 and the ideal spots requested (inclusive).  Optional.  
  * Traverse date (date picker).  Available only if a combination hut is selected.  Required if a combination hut is selected.    
* Each request has a “save” button and a “delete request” button below the data entry fields.  
* The Request list works with the Requestor endpoint to add, remove, and adjust requests.  
* Treat combination / traverse requests as two separate requests of the same priority.  The traverse date is the departure / checkout date from the first hut, and also the arrival / checkin date for the second hut.

#### Availability view

The availability view occupies the right side of the Requests tab.  It shows the selected request from the left panel in context with all other users’ requests for that same priority / choice level (first choice, second choice, etc), so that the user can see if there is an opening for their desired date.  The availability view uses the requestSummary endpoint and the currently selected Request details from the left panel.

The availability view is a grid of 6 columns and 183 rows.  A header row shows headers for each column:
* Month and year
* Day of week and day of month
* One column for each hut: Benson, Bradley, Grubb, and Ludlow.
* A total column for that day

There is a row for each day from December of the current year through May of the following year (inclusive).  Saturday and Sunday are in bold.  Show the month only for the first day of the month or the first visible row of the scroll area; for other days of the month, the month column can be left blank.

For each of the cells (182 days x 4 huts), calculate but do not display the following decimals to the tenth of a spot.

* Higher-priority spots requested:  Sum the ideal requested spots for higher priorities (lower number choices) than the selected request, across all users.  For requests open to multiple huts, divide the requested spots by the number of huts in the request.  For example, user 1 for their first choice is open to Grubb or Bradley, and requesting 3 spots, Checking in February 4 and checking out February 5th.  That counts as 1.5 spots for each of Grubb or Bradley, for the night of February 4th.  
* Same-priority spots requested.   Sum the minimum requested spots for the same priority (same-numbered choice) as the selected request, across other users.  For requests open to multiple huts, divide the requested spots by the number of huts in the request.   
* Same-priority groups requesting.  Count the number of distinct groups for that hut and date.  A lottery may choose between these groups.  

Display to a precision of one-tenth of a spot the remaining hut capacity.  Remaining hut capacity = (
* the starting hut capacity (12 or 15) minus
* the higher-priority spots requested, minus
* the same-priority spots requested).

Style each cell as follows:

* Heavy border around the currently selected request hut(s) and date(s).  Check-in days are outlined with a heavy diagonal line from the lower left to upper right of the cell, and down the right side.  Check-out days also use a diagonal line from the lower left to the upper right corner, but with the left side also outlined.  Days in the request that are in the middle of the stay apply the outline to both the left and right sides of the cell.  In this way, each stay looks like a parallelogram.  
* Shade yellow if the minimum spots requested is greater than (the hut capacity minus the higher-priority spots requested, minus the same-priority spots requested).   Yellow cells are “subject to lottery.”  
* Shade the cell light red or pink if the minimum spots requested is greater than (the hut capacity minus the higher-priority spots requested).  Pink cells are “unlikely at present.”
* Otherwise the cells don't need to be shaded at all.

When hovering over a given cell for more than 1 second, pop up a helper text or tool tip on that cell that shows the hut capacity, higher-priority spots requested, same-priority spots requested, and same-priority number of groups.

The scroll for the availability grid should be set to a few days before the arrival date in the request.  If the arrival date in the request is blank, the availability grid should be scrolled to the top.

### Admin tab

The admin tab is only available to users for whom the admin flag is set to TRUE.  The admin tab allows an upload of a tab-delimited file with a header row to upload the users table and a menu for other actions.

The admin tab has a clickable list of available actions.  Actions include:

* Upload list of requestors from a tab-delimited file.  This will create new records where a requestor’s email does not exist already, and update records where the email is already present.  
* Download lists of requestors, with requests if assigned or blank if not.  Available filters / sublinks:  
  1. All requestors  
  #. All requestors including with the login code (hashed from the email address).  This enables the administrator to email login credentials to the volunteers.
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

### Hut and trip capacities

Benson=12
Bradley=15
Grubb=15
Ludlow=15
Benson->Bradley=12
Bradley->Benson=12