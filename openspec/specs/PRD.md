
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
* Work party availability: open, waitlist, closed.  (read-only by end-users)
* Interest: This is an end-user-editable radio group, the choices are "No thank you", "Only if you need me" and "Please consider me".  The default selection is "No thank you"
* My status: (blank), pending, waitlisted, confirmed (read-only).  The default value is blank. 

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
* Is\_an\_admin flag (immutable on this page)  
* credits (immutable on this page)
* years participated (immutable on this page) -- this is a string concatenating all the years, separated by spaces, in which the volunteer did work parties.  It is populated by the system during the assignment process.
* received signed liability waiver date (immutable on this page).  When we last received a properly executed liability waiver from the volunteer.

An info box on the "experienced chainsaw user" checkbox shows on hover the help text "Can execute a directional fell without binding".

An info box on the "own a chainsaw" checkbox shows on hover the help text "tension, sharpen, lube, adjust carb".

Next to the "received signed liability waiver" date field, show underlined "download blank" and "submit" links.  The download link downloads the latest liability waiver.  On pressing this, show a message "complete, scan, and submit the waiver".  The "submit" link pops up a file dialog allowing the user to choose and upload an image file from their device.  Upon a user successfully submitting a document, show a message "Your waiver will be reviewed manually over the next few days"

There is a save button for persisting edits to the mutable fields.  The profile tab works with the requestor endpoint.

# Admin tab

The admin tab is only available to users for whom the admin flag is set to TRUE.  The admin tab allows an upload of a tab-delimited file with a header row to upload the users table and a menu for other actions.

The admin tab has various sections including:

## Change application mode
This is a pull-down which manually sets the application to one of a few values:
 * Work Party mode.  Volunteers sign up for work parties to earn their trip credits.  Typically active in August and September.
 * Trip Request mode.  Trip requests is where volunteers set their desired ski trip dates, which will turn into reservations.  Typically active in November.
 * Inactive mode.  All other times.
The application mode should be stored in a database table and have an admin service supporting it.

## Manage volunteers 
This section is for admins to manage volunteers, including uploading a tab-delimited file of new volunteers, or editing the attributes of existing volunteers.  Uploading volunteers will create new records where a requestor’s email does not exist already, and update rows where the email is already present.  

Admins can also edit existing volunteers in the system by adding or editing private admin comments about the volunteers.

## Review liability waivers

This section or sub-tab lets admins scroll through the received liability waivers, check the signatures, and check a box which will mark the associated volunteer as having completed their waiver correctly.

## Run assignment algorithm
This task exposes a checkbox which is defaulted to true, which is to "regenerate lottery numbers".  The value of this checkbox should be passed with the request to run the assignment algorithm.  The admin surface also exposes a separate action to regenerate lottery numbers before running assignment.

The lottery number used for assignment is stored on the requestor record, and assignment uses the lowest lottery number as the final tiebreak after all other ranking criteria are applied.  If regeneration is disabled, existing non-null lottery numbers are preserved.

## Download requests
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
 * lottery_value
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
* All requests
* Granted requests only
* Requestors with no requests

## Efficiency report
Calculate the % of requesting groups (and spots) who got their first choice, second choice, etc, or no choice.

## Set up work parties and accept volunteers
This section of the Admin tab allows admin users to add and edit work parties.  It is complicated enough to warrant taking over most of the page when active (like in a sub-tab).

Show a read-only list of current work parties for the current year with hut, date, and leader.  Each row has an edit pencil or a trash can icon for deleting that work party.  There is a form below for adding a new work party.  If the user clicks on one of the work party edit pencils, the form is populated with the details of the work party.  All the fields are editable except the hut and the date.  The leader name is a pull-down showing the admin users.  The leader email is populated based on the name selected.  The Friday check-in date is a date picker.  

Below the work party attributes, show the list of volunteers who have expressed interest so far.  Include attributes such as chainsaw experience, chainsaw ownership, years of experience, and private admin comments.   List the "Please consider me" volunteers first, in order of sign-up date (earliest first), then the "Only if you need me" volunteers.  For each volunteer, show a small set of mutually-exclusive toggle buttons indicating if that person is pending (default), accepted, or waitlisted.

# Appendix: Hut and trip capacities

Benson=12
Bradley=15
Grubb=15
Ludlow=15
Benson->Bradley=12 (2-hut traverse)
Bradley->Benson=12 (2-hut traverse)
