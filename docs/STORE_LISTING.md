# Chrome Web Store submission: Project Scraper 3.3.0

Everything the Developer Dashboard asks for, ready to paste. Task on the
board: "Coordinate Chrome Web Store submission" (Liban, Samuel, Dharshan).

## Before you start

- [ ] **Publish from a Grey-Box account, not a personal one.** Valentin was
      clear on Oct 29 that project resources must belong to the
      organization. Ask him which grey-box.ca Google account owns the
      developer account (one-time $5 registration fee).
- [ ] Upload file: `dist/project-scraper-3.3.0.zip` (built from this
      commit; manifest, html, css, js, lib, images only).
- [ ] Host `docs/PRIVACY_POLICY.md` at a public URL (a page on the
      Grey-Box site is best; GitHub Pages works). The store rejects a
      repository front page as a privacy policy.
- [ ] Liban's demo video approved (Oct 29: publish only after that).

## Store listing tab

**Name** (75 max): Project Scraper by Grey-box

**Summary** (132 max):
Save any web page, or a page and the pages it links to, as an offline copy that opens in any browser.

**Description:**

Project Scraper saves a web page so it can be read later without an internet
connection. Open the page you want, click the Project Scraper icon, and press
Download. You get a ZIP file with the page, its images, styles and documents,
organized into folders, that opens in any modern browser. No extension or
special app is needed to read it.

- Save just the current page, or the page plus the pages it links to.
- Restrict Domain (on by default) keeps the copy on the same website.
- Focus Mode keeps the main article and drops menus and ads.
- See how long a download will take before you start, and the time left while
  it runs.
- Downloads run in a background tab, so you can keep browsing.
- Pages with video: videos on the page are saved; for embedded players such as
  YouTube you can add a copy of the video from your computer.

Built by Grey-Box for people who need web content offline, such as teachers
preparing lessons for classrooms with poor connections.

Privacy: Project Scraper does not collect or send any data. A short history
of your own downloads stays on your computer and can be cleared at any time.

**Category:** Tools (alternative: Productivity)
**Language:** English

**Graphics:**
- [ ] Store icon 128x128: `images/icons/grey-box_128.png` (already correct size)
- [ ] Small promo tile 440x280 (required): `docs/store/promo-tile-440x280.png`
- [ ] Screenshots 1280x800, at least 1, up to 5. Take them from the real
      extension (reviewers check they match):
      1. The popup open on an article, showing the Download button and the
         time estimate.
      2. The popup during a download (progress ring + time left).
      3. The finished offline copy open in a browser, with its folder list.
      Tip: take a full-window screenshot on a 1280x800 window, or place the
      capture on a 1280x800 canvas. PNG, no transparency.
- [ ] Optional: marquee tile 1400x560; link to Liban's demo video on YouTube.

## Privacy practices tab

**Single purpose:**
Project Scraper saves the web page the user chooses, and optionally the pages
it links to, as an offline ZIP copy that opens in any browser.

**Permission justifications:**

| Permission | Justification |
|---|---|
| `activeTab` | Reads the page the user is on when they click Download, so that page can be saved. |
| `scripting` | Runs a script in that page to read its rendered content, its links (for depth 1 and the time estimate) and its videos, when the user starts a download. |
| `tabs` | Finds the page being saved, opens the download progress tab in the background, and lets the user switch to it from the popup. |
| `downloads` | Saves the finished ZIP file to the user's downloads folder. |
| `storage` | Remembers the user's settings (Restrict Domain, Focus Mode), the progress of a running download, and a local history of the user's own downloads used to count saved sites and estimate download times. Nothing is sent anywhere. |
| `contextMenus` | Adds "Download this page with Project Scraper" to the right-click menu. |
| Host permission `<all_urls>` | The user can save a page from any website, so the extension must be able to read that page and download the images, styles, scripts, documents and videos it uses. It only does so when the user starts a download. |

**Remote code:** No, I am not using remote code. (All scripts ship in the
package; no external scripts are loaded.)

**Data usage:** Tick nothing. Project Scraper does not collect or transmit
user data. The download history is kept only in the browser's local storage
on the user's computer.

Certify all three statements (no selling data, no unrelated use, no credit
use).

**Privacy policy URL:** the hosted copy of `docs/PRIVACY_POLICY.md`.

## Distribution tab

- Visibility: start with **Unlisted** for stakeholder testing (only people
  with the link can install), then switch to Public.
- Regions: all regions.

## Notes for the reviewer (Test instructions field)

No account or login is needed. Open any article page (for example a
Wikipedia article), click the Project Scraper icon and press Download. A
background tab shows progress and a ZIP is saved to the downloads folder. Open
the ZIP's index.html to see the offline copy. Advanced options (depth, Restrict
Domain, Focus Mode) are at the bottom of the popup.

## After submitting

- Review usually takes a few days; broad host permissions can make it longer.
- For updates: raise `version` in manifest.json, rebuild the ZIP, upload under
  Package.
