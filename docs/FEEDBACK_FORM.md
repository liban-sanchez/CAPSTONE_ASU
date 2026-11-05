# Feedback form: copy for the Grey-Box shared drive

**Done Nov 5:** the new form is https://forms.gle/bC5gwJt6jbT8bodA9 and the
extension links to it (popup and download tab). The old form below is no
longer linked.

Valentin (Oct 29): the current form is owned by a former student, so
nobody on the team can read the answers. Rebuild it **as is** in the
scraper project's shared drive, then point the extension at the new link.

Current form: https://forms.gle/p6quKSCDj5PoyVb37 ("Grey-Box Web Scraper",
5 pages; it says it was created inside grey-box.ca, so the owner may be a
grey-box.ca student account that can't be shared).

## Steps (about 15 minutes)

1. In Google Drive, open the scraper project's **shared drive** (not My Drive).
2. New > More > Google Forms > Blank form. Title: **Grey-Box Web Scraper**.
3. Add the 5 sections and questions below (in Forms, a "section" = a page).
4. Responses tab > Link to Sheets > create the sheet **in the same shared drive**.
5. Settings: don't require sign-in; don't collect email addresses.
6. Send > link > shorten URL > copy.
7. Replace `https://forms.gle/p6quKSCDj5PoyVb37` with the new link in:
   - `html/popup.html` (Provide Feedback button)
   - `html/window.html` (Provide feedback button on the finished screen)
8. Share the form and the sheet with Valentin and the team; tick
   "Fix google form for feedback" on the board.

## Questions, exactly as in the current form

**Page 1 (no title)**
1. How was your experience using the chrome extension? (Linear scale 1-5, 1 = Very Good, 5 = Very Bad)
2. What was easy/hard to use? (Paragraph)
3. Any bugs/glitches encountered? (describe them below) (Paragraph)

**Page 2: Features and Purpose**
4. Which features did you find most useful? (Paragraph)
5. Were there any features that you felt could be improved? (Paragraph)
6. Describe any features that you felt were missing from the extension below. (Paragraph)
7. How often do you think you would use this extension? (Linear scale 1-5, 1 = Very Often, 5 = Never)
8. What problems does this extension solve for you? (Paragraph)

**Page 3: Interface**
9. How was the interface of the extension? (Linear scale 1-5, 1 = Very Good, 5 = Very Bad)
10. Was the interface intuitive? (Linear scale 1-5, 1 = Very Intuitive, 5 = Not Very Intuitive)
11. Describe any parts of the interface that you found confusing/difficult to navigate. (Paragraph)

**Page 4: Comparison and Feedback**
12. Have you used any similar Chrome extensions? (Multiple choice: Yes / No)
13. Describe how this extension compares to others that you have used previously. (Paragraph)
14. Have you used other web-scrapers in the past? (Multiple choice: Yes / No)
15. Describe how you used those other web-scrapers previously. (Paragraph)
16. Any suggestions/feedback that you would like to share directly with the developers? (Paragraph)
17. How likely are you to recommend this extension to a colleague? (Linear scale 1-5, 1 = Very Likely, 5 = Not Very Likely)

**Page 5: Demographics**
18. Age (Short answer)
19. Gender (Multiple choice: Male / Female / Prefer not to say / Other: ___)
20. Occupation (Short answer)

## Optional additions (Valentin said improvements are welcome)

- Page 1: "Did the time estimate match how long the download took?" (Yes / Roughly / No)
- Page 2: "Which depth did you use?" (Just this page / This page and its links / Deeper)
- Page 5: make Age a range (Under 18, 18-24, 25-34, ...) instead of free text,
  so no exact ages are stored.
