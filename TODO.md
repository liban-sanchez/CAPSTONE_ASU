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
      block when it finds one (js/modules/popup/video.js). Note: on pages
      with no video there is no way to add a local video. Revisit if that
      matters.
- [x] Reasonable defaults with a timeout:
      - No Save As dialog. The ZIP goes straight to the downloads folder,
        and a failed download now reports "Download failed" instead of
        hanging.
      - A page that never finishes loading is given 10 s
        (waitForTabLoad in js/modules/window/crawler.js), then the crawl
        saves what has loaded and moves on.
      - Restrict Domain on by default (see above).
- [x] Package naming: name_YYYY-MM-DD_HHMM_depthN.zip, for example
      example.org_2026-11-05_0602_depth1.zip
      (js/modules/window/package-name.js). The name is the custom package
      name when one is set, otherwise the site. Before this, every ZIP on
      main was "offline-website.zip". Duplicates get a numbered suffix
      instead of overwriting.
- [x] Custom folder structure: the team built it in the Oct 29 merge
      (js/modules/popup/package.js, packageConfig.folders). On Oct 28 I had
      recommended dropping it; the team went ahead, which is fine.
- [ ] The popup has no controls for package name or custom folders yet
      (package-name-input, package-organization-custom, ...), so every
      download uses the defaults. Add the controls or drop the feature.

## From the meeting recordings (Sep 17, Sep 24, Oct 1)

Checked against the Fathom summaries on Oct 29. UI items assigned to Samuel:

- [x] Sep 17: move long explanations into hover tips
- [ ] Sep 17: evaluate the Chrome side panel as a replacement for the popup
      and write up pros and cons (not written up anywhere yet)
- [ ] Sep 17: confirm access to the Greybox Figma account
- [x] Sep 24: streamlined layout, advanced options toggle, depth slider
- [ ] Sep 24: test the new-tab crawling against the agreed test protocol
- [x] Sep 24: push the UI work to GitHub (samuel-kim branch, merged into
      main on Oct 29 and Nov 5)
- [x] Oct 1: remove the redundant logo, fold progress into the main button

To confirm with the team:

- Oct 1 describes advanced options on a second screen after clicking
  Download. The popup instead keeps them in a collapsed section under the
  Download button (the Oct 8 rework). Check that this still matches what
  Nathan wants.
- Sep 17 asked for a non-blocking flow that names the exact file a user
  should add when a video can't be saved. That is Liban's work
  (requestFallbackVideo in js/modules/window/ui.js); check that the popup's
  video block and that flow say the same thing.

## From the Oct 29 meeting

- [x] Restrict Domain on by default (already done)
- [x] Stop repeating save/download (Valentin: "save, save, save"): one round
      button with "Download" inside it. The separate "Download This Page"
      pill and the "Saves this page for offline browsing" line are gone
- [x] No "alpha": the popup, feedback text, depth warning and extension
      name now just say Project Scraper
- [x] Advanced options in its own card towards the end, above Feedback
      (Focus Mode and Download multiple URLs stay inside it)
- [x] The download tab opens in the background, so the user stays on their
      page and the popup stays open with the progress ring. A "Go to
      download tab" link switches to it while it is open
- [x] Fixed an unclosed <div> around the popup title (from the Oct 29 merge)
- [ ] Samuel: copy the feedback form into the shared drive (the current
      form is on a personal account). Then update the "Provide Feedback"
      link in html/popup.html
- [ ] Samuel: create a backlog item for usage tracking (e.g. number of
      sites saved)
- [ ] Samuel: update hours and post a November work plan
- Team: Liban records the demo video and leads the task tracker cleanup;
  sprint meeting to clean up the tracker; user stories use personas such as
  "elementary school teacher"; publish to the Chrome Web Store if the demo
  is approved

## Board tasks (Nov 5)

- [x] Download time: estimate before downloading ("Estimated time: about
      2 minutes for 15 pages"), from the user's own past downloads or about
      8 s a page; time left in the popup and the crawl tab
- [x] Logging downloads: kept on the user's computer only
      (js/modules/window/usage-log.js); popup shows "N downloads from N
      sites", "What's recorded?" and Clear history
- [x] Popup no longer shows an old download's status on a different page
- [ ] Feedback form: rebuild in the shared drive (docs/FEEDBACK_FORM.md),
      then swap the link in html/popup.html and html/window.html
- [ ] Chrome Web Store: listing, permission reasons and privacy policy in
      docs/STORE_LISTING.md and docs/PRIVACY_POLICY.md; promo tile in
      docs/store/. Still needed: screenshots, a hosted privacy policy, a
      Grey-Box developer account. Removed the unused webRequest permission
      and the CDN icon stylesheet; version 3.3.0. Build the upload ZIP with:
      zip -r -X dist/project-scraper-3.3.0.zip manifest.json html css js lib images

## Merge history

- Oct 29: Dharshan merged most of samuel-kim into main by hand
  ("merged code").
- Nov 5: the rest went in on main: versioned ZIP names, no Save As dialog,
  interrupted downloads reported as failed, this TODO list and the README
  line.

## Known rough edges

- [ ] Closing the background crawl tab mid-run kills the crawl with no
      warning. Dharshan's Nov 5 tab reopening covers the page being crawled;
      check whether it covers the crawl tab too
- [ ] Background tabs can be throttled by Chrome. The Nov 5 commit keeps
      both tabs from being discarded; retest whether crawls still slow down
- [x] "Your ZIP should now be in Finder" is Mac-only wording. Now names the
      ZIP and says it is in the downloads folder
- [x] The camera icon came from the CDN and vanished offline. Removed with
      the old video block
