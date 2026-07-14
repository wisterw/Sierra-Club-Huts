
Requestors use a web browser to access the application. 

# Application title
The title of the application is "Sierra Club Ski Huts".
The subtitle of the application is "Volunteer pre-reservation request system".

# Authenticating users (login page)

Instead of a password system, we will send a code to the email of record.  The code will be valid for approximately 10 minutes.  The login page should show the following controls:
* email.  Text field for user to enter their email.
* "send login code to email" button.  This button should call the sendEmail endpoint.  Show a message here that "If we have the email on file, a code has been sent.  Please note that it can take up to 1 minute for the email to come through"
* code.  Numeric field for user to enter the 4-digit code they received in their email.
* "Login" button.  This button should call the checkLogin endpoint.

When a user returns to the application within 7 days of a successful login using that same browser, the application should remember them.  If after 7 days, they can ask for a new code to be emailed.

# Work Party tab

The work party tab is the default tab in "Work party" mode and is disabled (not selectable) in "trip request" mode.  The work party tab shows all the work parties for that year, with the current status of the overall work party as well as any or all the assignments between the current user and that work party. The list is filtered to show just the current year work parties.

When the application is in trip request mode, the work tab is disabled and displays an informational message on hover: "Work party selection has not opened or is already completed"

The Work-party tab uses the workParty service to get, set, and mutate workParty assignments.

## Work Party list

Users visit the work party tab to select the work parties that they would like to join.  The work parties are displayed as landscape-aspect cards with a border stacked vertically down the page (just the parties for the current year).  They are presented in chronological order (first to last).  Changing this page adds and edits records in the "work party requests" table.  The data fields are repeated for each work party card and include:
* Dates: (read-only, from and to, usually a Friday to Sunday)
* Hut name: (read-only, Ludlow, Bradley, Benson, or Grubb)
* Leader name and email: (read-only)
* Hike-in comments: (read-only, distance and elevation, and can one drive)
* Work party availability: open, waitlist-only, closed.  (read-only by end-users)
* Interest: This is an end-user-editable radio group, the choices are "No thank you", "Only if you need me" and "Please consider me".  The default selection is "No thank you"
* status: (blank), pending, waitlisted, or accepted (read-only).  The default value is blank. 

There is a save button at the bottom of the tab that captures each user's changes across all the work party cards.

# Trip Request tab

The Trip Request tab is the default tab in Trip Request mode and is disabled (not selectable) in Work Party mode.  The purpose of the Trip Request tab is for the user to set and manage their lodging requests for the upcoming ski season.  These requests are not confirmed reservations at this point but the eventual winners from this lottery will be able to confirm their reserations with Clair Tappaan Lodge (CTL), which manages the huts.  

The Trip Request tab is split into two panels.  The left panel shows the user’s “choices list” (first choice, second choice, etc.).  The right panel is a detailed “availability view” of the schedule linked to the selected choice and showing availability from a few days before until a few days after the selected date range.

When the application is in Work Party mode, the Trip Request tab is disabled and displays an informational message on hover: "Ski hut trip request has not opened or is already completed"

## Choices list

This panel occupies the left of the Trip Request tab and shows the list of the user’s reservation requests.  

* Reservation requests are shown in priority order (first choice, second choice, etc).  Next to the choice number, offer a small info icon which shows on hover: "Add your requests in priority order. Check the availability preview on the right to reduce overlap." 
* Reservation requests are shown in collapsed (or summary) form by default and can be expanded with a small button with a stylized plus sign, which switches to a minus sign if the choice is expanded.    
* When a reservation request is expanded, all other reservation requests are collapsed, leaving only one request expanded and in focus at a time.    
* Initially, the user has no reservation requests, and one blank reservation request is provided.     
* By default, the first choice reservation request is expanded and the other choices are shown in collapsed form.
* The reservation request details include:  
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
* When saving a reservation request, adjust the reservation request numbers to keep them in the same relative order but close any gaps.  For example, if the choices are 1, 2, and 4, renumber choice 4 to be 3, resulting in 1, 2, 3.
* The maximum trip length is 5 days.  Verify that the difference between the arrival and departure dates is 5 days or fewer.
* Verify that the arrival and departure dates are no earlier than December 15th of the current year and no later than April 30th of next year.
* Update calculated fields (hut_count_flexibility, saturday_week_number) every time a reservation request changes.

## Availability view

The availability view occupies the right side of the Trip Requests tab.  It shows the selected request from the left panel in context with all other users’ requests for that same priority / choice level (first choice, second choice, etc), so that the user can see if there is an opening for their desired date.  The availability view uses the requestSummary endpoint and the currently selected Request details from the left panel.

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

# Profile tab

The Profile tab is the third tab.  The Profile tab is always available and shows the following fields:

* Email (mutable)  
* First name (mutable)  
* Last name (mutable)  
* Address (mutable)  
* City (mutable)  
* State (mutable)  
* ZIP (mutable)  
* Phone (mutable)  
* Comments (mutable)  
* I am an experienced chainsaw user (mutable, checkbox)
* I own a chainsaw and know how to tune it (mutable, checkbox)
* Is\_an\_admin flag (mutable for admins only; immutable for non-admins)  
* work party credits (mutable for admins only; immutable for non-admins)
* years of service (mutable for admins only; immutable for non-admins) -- this is a string concatenating all the years, separated by spaces, in which the volunteer did work parties.  It is populated by the system during the assignment process.
* received signed liability waiver date (mutable for admins only; immutable for non-admins).  When we last received a properly executed liability waiver from the volunteer.  include a link to the liability waiver, which is persisted on the server.

An info box on the "experienced chainsaw user" checkbox shows on hover the help text "Can execute a directional fell without binding".

An info box on the "own a chainsaw" checkbox shows on hover the help text "tension, sharpen, lube, adjust carb".

Next to the "received signed liability waiver" date field, show underlined "download blank" and "submit" links.  The download link downloads the latest liability waiver.  On pressing this, show a message "complete, scan, and submit the waiver".  The "submit" link pops up a file dialog allowing the user to choose and upload an image file from their device.  Upon a user successfully submitting a document, show a message "Your waiver will be reviewed manually over the next few days"

There is a save button for persisting edits to the mutable fields.  The profile tab works with the requestor endpoint.

Below the profile fields, show the past and current pending work party history for that user.

Below the work party history, show the current ski trip reservation requests for that user.

# Appendix: Hut and trip capacities

Benson=12
Bradley=15
Grubb=15
Ludlow=15
Benson->Bradley=12 (2-hut traverse)
Bradley->Benson=12 (2-hut traverse)
