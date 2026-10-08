# Project Scraper UI — working list

Tracks the popup and crawl tab UI only. Everything else lives in Notion.

## Done

- [x] Download opens options instead of starting blind, then reworked so the
      options live in the popup under the Download button
- [x] Right-click menu item "Download this page with Project Scraper" that
      opens the extension popup pointed at the clicked page
- [x] Long description text replaced by hover tips on small "i" badges
- [x] No more separate pop-up window. The crawl runs in a background tab and
      reports progress back to the popup
- [x] Crawl tab redesigned for a full browser window, with a finished state
      for both success and failure
- [x] Crawl depth is a 0-5 slider with a plain-language readout
- [x] Advanced options collapsed behind a toggle, progress hidden until a
      download starts
- [x] Duplicate Grey-Box logo removed and the progress bar folded into the
      download button as a ring

## To do

From the Oct 1 review.

- [ ] Warn when crawl depth is set high. Explain the exponential page growth.
      Settle the conflict between the 0-5 slider and the "Max prompts for a
      number" idea from the meeting
- [ ] Move Restrict Domain above the other switches and recommend keeping it
      on for multi-level crawls
- [ ] Combine embedded video support and local video import into one block,
      shown after Download only when the page has video
- [ ] Reasonable defaults with a timeout, so a crawl is not stalled waiting
      on input that never comes
- [ ] Package naming for versioning the downloaded ZIP
- [ ] Validate whether custom folder structure is actually needed. It was not
      in the original spec

## Known rough edges

- [ ] Closing the background crawl tab mid-run kills the crawl with no warning
- [ ] Bootstrap icons load from a CDN, so they disappear offline. The hover
      badges avoid this, the camera icon does not
- [ ] Background tabs can be throttled by Chrome. Switch the crawl tab to
      active if crawls feel slow
- [ ] "Your ZIP should now be in Finder" is Mac-only wording
