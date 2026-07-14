The admin tab is only available to users for whom the admin flag is set to TRUE.  

The admin tab has various sections or subtabs:

# Application settings

## Season mode
This is a pull-down which manually sets the application to one of a few values:
 * Work Party mode.  Volunteers sign up for work parties to earn their trip credits.  Typically active in August and September.
 * Trip Request mode.  Trip requests is where volunteers set their desired ski trip dates, which will turn into reservations.  Typically active in November.
 * Inactive mode.  All other times.
The application mode should be stored in a database table and have an admin service supporting it.

## Run assignment lottery
There is a button: "run lottery" and a checkbox: "regenerate lottery numbers".  The checkbox is defaulted to true.  

The lottery number used for assignment is stored on the requestor record, and assignment uses the lowest lottery number as the final tiebreak after all other ranking criteria are applied.  If regeneration is disabled, existing non-null lottery numbers are preserved.


# Manage volunteers / requestors
A grid lists all the volunteers.  There are filters and actions above the grid that control what it shows.

## Filters
There are a few filters:
- Work party accepted status.  Pulldown.  Limit the rows to just those volunteers of a certain status for a work party.  Show all, or pending, accepted, or waitlisted.  Default is show all.  This helps work party leaders look at just pending, or accepted requests, for their work party.
- Work party.  Pulldown.  Show all, or hut and date combination.  This helps work party leaders review pending requests for their work party.
- Reservation status.  Pulldown.  Show all, or "no requests submitted for next year", "requests submitted for next year", "requests but none granted", or "requests granted".  This helps identify requestors who may not have received any choices in the lottery.
- Liability waiver filter.  Show all, or "waiver approved for this year" or "no waiver approved for this year".  This helps identify any volunteers who have not yet submitted a liability waiver so the leader can move that person to waitlisted status.  Default is to show all.

## Actions
For each row on the grid, the volunteer name is a hyperlink.  By clicking on the hyperlink, the admin can go to the profile page for that volunteer / requestor.

On each row, there is a small actions menu with three vertical dots (sometimes called a kebab menu) showing the actions available for that volunteer.  These actions are:
- mark as "accepted" to currently-filtered work party (enabled if a work party is set in the filters, otherwise disabled)
- mark as "waitlisted" currently-filtered work party (enabled if a work party is set in the filters, otherwise disabled)
- mark as "full attended" for currently-filtered work party (enabled if a work party is set in the filters, otherwise disabled).  This updates attendance status.
- mark as "no show" for currently-filtered work party (enabled if a work party is set in the filters, otherwise disabled).  This updates attendance status.
- mark as "cancelled" for currently-filtered work party (enabled if a work party is set in the filters, otherwise disabled).  This updates attendance status.
- mark as "partial attended" for currently-filtered work party (enabled if a work party is set in the filters, otherwise disabled).  This updates attendance status.
- accept liability waiver
- add admin comments.  Some volunteers add work to the leader or pose safety risks to others.  Admin comments are private and due to regression risks are not exposed on the profile page.  This action pops up a little window where the trip leader can make private comments about the user (visible only to admins).  This is to share internal findings about a volunteer indicating their usefulness or maybe if they are underwhelming somehow.

## Columns
- Name
- phone
- city
- email
- Work parties applied for.  This is a concatenation of the work parties the volunteer has applied for, indicated by hut name and date, and that user's status for that work party.  Separate by commas.
- Admin comments
- years of service
- Has chainsaw skills
- Has a chainsaw
- liability waiver status
- Hut trip requests.  The number of choices submitted for the upcoming ski season.

# Review liability waivers

This sub-tab lets admins scroll through the received work party liability waivers for the current year, check the signatures, and check a box which will mark the associated volunteer as having completed their waiver correctly.

Liability waivers are persisted to a dedicated folder in the file system and we store a pointer to the file in the database.

We don't need to keep pointers in the database for prior-year waivers.  We will just update the pointer to point to the current-year waiver and record the approval date of that current-year waiver.  The prior-year waivers themselves can sit around in the file system.  They may or may not be reduced periodically in the file system by a super-admin, but that functionality should not be exposed in this admin tab.

# Download requests
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

# Efficiency report
Calculate the % of requesting groups (and spots) who got their first choice, second choice, etc, or no choice.

# Set up work parties
This section of the Admin tab allows admin users to add and edit work parties.  It is complicated enough to warrant taking over most of the page when active (like in a sub-tab).

Show a read-only list of current work parties for the current year with hut, date, and leader.  Each row has an edit pencil or a trash can icon for deleting that work party.  There is a form below for adding a new work party.  If the user clicks on one of the work party edit pencils, the form is populated with the details of the work party.  All the fields are editable except the hut and the date.  The leader name is a pull-down showing the admin users.  The leader email is populated based on the name selected.  The Friday check-in date is a date picker.  

