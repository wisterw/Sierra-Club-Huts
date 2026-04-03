* lint the code (or run a node --check) automatically after making changes.
* Check /Docs/PRD.md and '/Docs/technical design requirements.md' for changes and see if any updates to the code are required.
* In UI design:
  * make sure checkboxes are vertically aligned with the label for that checkbox.
  * make sure you can type a 4-digit year into the date picker year field without being blocked
  * make sure in numeric fields the user can type the number directly, not just use the up and down controls to adjust the number.
  * for the login page, size the fields more proportionately to the data they will hold, like 20 characters vs 100.  And you can make the buttons smaller, that way the page will be easier to read.
  * the field where the user enters their 4-digit code is too small.  make it a little larger or remove the up/down buttons, which are not useful in this context anyway.
  * For aesthetics, the fields in a form, and the forms in a card, should not extend over the boundaries of that card.  Otherwise they could cross over into the next card in the grid which would look messy.
* when calling MSMTP, try to get detailed results and output them to the console so it's easier to debug if there are issues.
* When I commit changes to the main branch requirements documents under the Doc directory, implement the changes.