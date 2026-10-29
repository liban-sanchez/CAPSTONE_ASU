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

- [x] Warn when crawl depth is set high. Depth 2 and up shows a warning with
      the estimated page count (about 10 links a page, so x10 per level:
      111 pages at depth 2, about 11 billion at depth 10). It also says
      plainly that depths above 1 are not crawled yet in this alpha.
- [x] "Max" depth, as the Oct 1 recording asks: the slider's last stop is
      Max, which shows a "Levels deep" number field (6-20, starts at 10)
      plus the same warning. It is an inline field, not a blocking prompt,
      so a crawl never waits on input. Empty or invalid entries fall back
      to 10. (This reverses the Oct 28 call to drop Max.)
- [x] Restrict Domain is now the first switch, and on by default. With depth 1
      or higher and the switch off, a hint recommends turning it on.
      (The old markup had an HTML comment inside the <label> tag; fixed.)
- [x] Embedded video notice and local video import are one "Video on this
      page" block under Download. The popup checks the page for <video>
      elements and embedded players (YouTube, Vimeo, ...) and only shows the
      block when it finds one. Note: on pages with no video there is now no
      way to add a local video. Revisit if that matters.
- [x] Reasonable defaults with a timeout:
      - No Save As dialog. The ZIP goes straight to the downloads folder,
        and a failed download now reports "Download failed" instead of
        hanging.
      - A page that never finishes loading is given 30 s
        (PAGE_LOAD_TIMEOUT_MS in crawler.js), then the crawl saves what has
        loaded and moves on.
      - Restrict Domain on by default (see above).
- [x] Package naming: site_YYYY-MM-DD_HHMM_depthN.zip, for example
      example.org_2026-10-28_1152_depth1.zip (js/modules/package-name.js).
      Duplicate names get Chrome's numbered suffix instead of overwriting.
- [x] Custom folder structure: checked, not needed. Nothing on any branch
      implements it, it was not in the original spec, and the offline copy
      depends on the fixed layout (root page + html/, css/, js/, img/, pdf/,
      video/): 17 hard-coded relative paths in assets.js, video.js and
      scraper.js. Supporting custom layouts would mean reworking every path
      rewrite. Recommend dropping it unless the sponsor asks for it.

## From the meeting recordings (Sep 17, Sep 24, Oct 1)

Checked against the Fathom summaries on Oct 29. UI items assigned to Samuel:

- [x] Sep 17: move long explanations into hover tips
- [ ] Sep 17: evaluate the Chrome side panel as a replacement for the popup
      and write up pros and cons (not written up anywhere yet)
- [ ] Sep 17: confirm access to the Greybox Figma account
- [x] Sep 24: streamlined layout, advanced options toggle, depth slider
- [ ] Sep 24: test the new-tab crawling against the agreed test protocol
- [ ] Sep 24: push the UI work to GitHub. Committed locally; the push has
      to be run from your own machine
- [x] Oct 1: remove the redundant logo, fold progress into the main button

To confirm with the team:

- Oct 1 describes advanced options on a second screen after clicking
  Download. The popup instead keeps them in a collapsed section under the
  Download button (the Oct 8 rework). Check that this still matches what
  Nathan wants.
- Sep 17 asked for a non-blocking flow that names the exact file a user
  should add when a video can't be saved. That is Liban's work on
  origin/main; the popup's video block will need to point at it after the
  merge.

## Merge note

origin/main has large rewrites of scraper.js and video.js that this branch
does not have yet. The scraper.js changes here are small on purpose: import
buildPackageName, build zipName with it, saveAs: false with
conflictAction: "uniquify", the "interrupted" branch in the onChanged
listener, and the "downloads folder" message. Re-apply those by hand if the
merge conflicts.

## Known rough edges

- [ ] Closing the background crawl tab mid-run kills the crawl with no warning
- [ ] Background tabs can be throttled by Chrome. Switch the crawl tab to
      active if crawls feel slow
- [x] "Your ZIP should now be in Finder" is Mac-only wording. Now names the
      ZIP and says it is in the downloads folder
- [x] The camera icon came from the CDN and vanished offline. Removed with
      the old video block
