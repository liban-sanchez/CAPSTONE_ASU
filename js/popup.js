const broadcastChannel =
  new BroadcastChannel("scraper_data");

let currentPage = "";
let sourceTabId = null;

const submitButton =
  document.getElementById("submit-button");

const focusMode =
  document.getElementById("focus-mode-toggle");

const restrictDomain =
  document.getElementById("restrict-domain-toggle");

const depthMode =
  document.getElementById("choose-depth-input");


// ============================================================
// DOWNLOAD OPTIONS MODAL
// ============================================================

const advancedOptionsSection =
  document.getElementById("advanced-options");

const downloadOptionsPage =
  document.getElementById("download-options-page");


/*
 * When the user picks "Download this page" from the
 * right-click menu, background.js saves the clicked
 * tab here and opens this extension popup.
 *
 * { tabId: 123, createdAt: 1710000000000 }
 */
const CONTEXT_MENU_LAUNCH_KEY =
  "pendingContextMenuDownload";

const CONTEXT_MENU_LAUNCH_MAX_AGE_MS =
  10000;



// ============================================================
// HOVER TIPS
// ============================================================

/*
 * Long descriptions were replaced by small "i" badges.
 * Hovering (or focusing) a badge shows its text.
 *
 * Bootstrap's own tooltips are not used because the bundled
 * Bootstrap file does not include Popper.
 */

let activeHoverTip = null;


function showHoverTip(badge) {

  hideHoverTip();


  const text =
    badge.getAttribute("title") ||
    badge.dataset.gbTip ||
    "";


  if (!text) {
    return;
  }


  /*
   * Move the text out of "title" so the browser
   * does not also show its own tooltip.
   */
  badge.dataset.gbTip = text;

  badge.removeAttribute("title");


  const tip =
    document.createElement("div");

  tip.className =
    "gb-tip";

  tip.textContent =
    text;

  document.body.appendChild(tip);


  const badgeBox =
    badge.getBoundingClientRect();

  const tipBox =
    tip.getBoundingClientRect();

  const margin = 6;


  let left =
    badgeBox.left +
    (badgeBox.width / 2) -
    (tipBox.width / 2);


  left = Math.max(
    margin,
    Math.min(
      left,
      document.documentElement.clientWidth - tipBox.width - margin
    )
  );


  let top =
    badgeBox.top - tipBox.height - margin;


  /*
   * Not enough room above, so show it below.
   */
  if (top < margin) {

    top = badgeBox.bottom + margin;
  }


  tip.style.left = left + "px";

  tip.style.top = top + "px";


  activeHoverTip = tip;
}


function hideHoverTip() {

  if (activeHoverTip) {

    activeHoverTip.remove();

    activeHoverTip = null;
  }
}


document.addEventListener(
  "DOMContentLoaded",
  () => {

    const badges =
      document.querySelectorAll(".gb-info");


    badges.forEach(
      (badge) => {

        badge.addEventListener(
          "mouseenter",
          () => showHoverTip(badge)
        );

        badge.addEventListener(
          "focus",
          () => showHoverTip(badge)
        );

        badge.addEventListener(
          "mouseleave",
          hideHoverTip
        );

        badge.addEventListener(
          "blur",
          hideHoverTip
        );


        /*
         * Some badges sit inside labels, so a click
         * should not toggle the option behind them.
         */
        badge.addEventListener(
          "click",
          (e) => e.preventDefault()
        );
      }
    );


    window.addEventListener(
      "scroll",
      hideHoverTip,
      true
    );


    document.addEventListener(
      "keydown",
      (e) => {

        if (e.key === "Escape") {
          hideHoverTip();
        }
      }
    );
  }
);


// ============================================================
// LOCAL VIDEO IMPORT
// ============================================================

/*
 * These elements will be added to popup.html.
 *
 * local-video-input:
 * File picker for videos from the user's computer.
 *
 * local-video-status:
 * Optional text area showing which videos were selected.
 */
const localVideoInput =
  document.getElementById("local-video-input");

const localVideoStatus =
  document.getElementById("local-video-status");


/*
 * Stores File objects selected by the user.
 *
 * Example:
 *
 * [
 *   File {
 *     name: "training-video.mp4",
 *     type: "video/mp4",
 *     size: ...
 *   }
 * ]
 */
let selectedLocalVideos = [];


// ============================================================
// DEPTH 1 MANUAL SELECTION ELEMENTS
// ============================================================

const depthOneModeSection =
  document.getElementById(
    "depth-one-mode-section"
  );

const depthOneAllLinks =
  document.getElementById(
    "depth-one-all-links"
  );

const depthOneManualLinks =
  document.getElementById(
    "depth-one-manual-links"
  );

const manualLinkControls =
  document.getElementById(
    "manual-link-controls"
  );

const scanLinksButton =
  document.getElementById(
    "scan-links-button"
  );

const selectAllLinksButton =
  document.getElementById(
    "select-all-links-button"
  );

const clearAllLinksButton =
  document.getElementById(
    "clear-all-links-button"
  );

const manualLinksList =
  document.getElementById(
    "manual-links-list"
  );


// ============================================================
// SCRAPER STATE
// ============================================================

let isFocusMode = false;
let isRestrictDomain = false;
let maxDepthValue = 0;

let depthOneMode = "all";

let scannedLinks = [];

let selectedManualLinks = [];


// ============================================================
// LOCAL VIDEO EVENTS
// ============================================================

/*
 * When a user selects one or more videos
 * from their computer, save those File
 * objects so they can later be sent to
 * window.js and added to the ZIP.
 */
if (localVideoInput) {

  localVideoInput.addEventListener(
    "change",
    (event) => {

      const files =
        event.target.files;

      if (!files) {
        selectedLocalVideos = [];
        updateLocalVideoStatus();
        return;
      }

      /*
       * Convert FileList into a normal
       * JavaScript array.
       *
       * We keep the actual File objects.
       */
      selectedLocalVideos =
        Array.from(files).filter(
          (file) =>
            file &&
            (
              file.type.startsWith("video/") ||
              isKnownVideoExtension(file.name)
            )
        );


      console.log(
        "Local videos selected:",
        selectedLocalVideos.map(
          (file) => ({
            name: file.name,
            type: file.type,
            size: file.size
          })
        )
      );


      updateLocalVideoStatus();
    }
  );
}


/**
 * Check common video file extensions
 * in case the operating system does
 * not provide a MIME type.
 */
function isKnownVideoExtension(
  filename
) {

  if (!filename) {
    return false;
  }

  const lower =
    filename.toLowerCase();

  return (
    lower.endsWith(".mp4") ||
    lower.endsWith(".webm") ||
    lower.endsWith(".mov") ||
    lower.endsWith(".m4v") ||
    lower.endsWith(".avi") ||
    lower.endsWith(".mkv")
  );
}


/**
 * Display selected local videos
 * in the popup.
 */
function updateLocalVideoStatus() {

  if (!localVideoStatus) {
    return;
  }


  if (
    selectedLocalVideos.length === 0
  ) {

    localVideoStatus.innerHTML = `
      <div class="small text-muted">
        No local videos selected.
      </div>
    `;

    return;
  }


  /*
   * Create the display safely
   * using DOM elements instead
   * of inserting filenames into
   * raw HTML.
   */
  localVideoStatus.innerHTML = "";


  const heading =
    document.createElement("div");

  heading.className =
    "small fw-semibold";

  heading.textContent =
    selectedLocalVideos.length === 1
      ? "1 video selected:"
      : `${selectedLocalVideos.length} videos selected:`;

  localVideoStatus.appendChild(
    heading
  );


  for (
    const file
    of selectedLocalVideos
  ) {

    const fileRow =
      document.createElement("div");

    fileRow.className =
      "small text-muted";

    const sizeMb =
      (
        file.size /
        1024 /
        1024
      ).toFixed(2);

    fileRow.textContent =
      `${file.name} (${sizeMb} MB)`;

    localVideoStatus.appendChild(
      fileRow
    );
  }
}


// ============================================================
// DEPTH MODE
// ============================================================

const depthReadout =
  document.getElementById("depth-readout");


const DEPTH_LABELS = [
  "Depth 0 \u2014 just this page",
  "Depth 1 \u2014 this page and the pages it links to",
  "Depth 2 \u2014 two levels of links, slower",
  "Depth 3 \u2014 three levels of links, much slower",
  "Depth 4 \u2014 four levels, expect a long wait",
  "Depth 5 \u2014 five levels, the heaviest crawl"
];


function handleDepthChange() {

  maxDepthValue =
    Number(
      depthMode.value || 0
    );


  if (depthReadout) {

    depthReadout.innerText =
      DEPTH_LABELS[maxDepthValue] ||
      ("Depth " + maxDepthValue);
  }


  updateDepthOneUI();
}


depthMode.addEventListener(
  "input",
  handleDepthChange
);


depthMode.addEventListener(
  "change",
  handleDepthChange
);


// ============================================================
// FOCUS MODE
// ============================================================

focusMode.addEventListener(
  "change",
  (e) => {

    isFocusMode =
      Boolean(
        e.target.checked
      );

    chrome.storage.sync.set({
      isFocusMode:
        isFocusMode
    });
  }
);


// ============================================================
// RESTRICT DOMAIN
// ============================================================

restrictDomain.addEventListener(
  "change",
  (e) => {

    isRestrictDomain =
      Boolean(
        e.target.checked
      );

    chrome.storage.sync.set({
      isRestrictDomain:
        isRestrictDomain
    });
  }
);


// ============================================================
// DEPTH 1 MODE CONTROLS
// ============================================================

if (depthOneAllLinks) {

  depthOneAllLinks.addEventListener(
    "change",
    () => {

      if (
        depthOneAllLinks.checked
      ) {

        depthOneMode =
          "all";

        updateDepthOneUI();
      }
    }
  );
}


if (depthOneManualLinks) {

  depthOneManualLinks.addEventListener(
    "change",
    () => {

      if (
        depthOneManualLinks.checked
      ) {

        depthOneMode =
          "manual";

        updateDepthOneUI();
      }
    }
  );
}


if (scanLinksButton) {

  scanLinksButton.addEventListener(
    "click",
    async () => {

      await scanLinksFromCurrentPage();
    }
  );
}


if (selectAllLinksButton) {

  selectAllLinksButton.addEventListener(
    "click",
    () => {

      const checkboxes =
        manualLinksList.querySelectorAll(
          'input[type="checkbox"][data-link-url]'
        );


      selectedManualLinks = [];


      checkboxes.forEach(
        (checkbox) => {

          checkbox.checked =
            true;


          selectedManualLinks.push(
            checkbox.dataset.linkUrl
          );
        }
      );
    }
  );
}


if (clearAllLinksButton) {

  clearAllLinksButton.addEventListener(
    "click",
    () => {

      const checkboxes =
        manualLinksList.querySelectorAll(
          'input[type="checkbox"][data-link-url]'
        );


      checkboxes.forEach(
        (checkbox) => {

          checkbox.checked =
            false;
        }
      );


      selectedManualLinks = [];
    }
  );
}


// ============================================================
// CURRENT TAB
// ============================================================

/**
 * Read and clear a right-click launch
 * saved by background.js, if any.
 */
async function takeContextMenuLaunch() {

  try {

    const items =
      await chrome.storage.session.get(
        CONTEXT_MENU_LAUNCH_KEY
      );

    const launch =
      items[CONTEXT_MENU_LAUNCH_KEY];


    if (!launch) {
      return null;
    }


    await chrome.storage.session.remove(
      CONTEXT_MENU_LAUNCH_KEY
    );


    const isFresh =
      Date.now() - Number(launch.createdAt || 0) <
      CONTEXT_MENU_LAUNCH_MAX_AGE_MS;


    return isFresh &&
      Number.isInteger(launch.tabId)
      ? launch
      : null;

  } catch (error) {

    console.warn(
      "Could not read right-click launch:",
      error
    );

    return null;
  }
}


/**
 * Capture the source tab and its URL.
 *
 * From the toolbar button this is the active tab.
 * From the right-click menu it is the tab that
 * was right-clicked.
 */
async function resolveSourceTab() {

  const launch =
    await takeContextMenuLaunch();


  if (launch) {

    try {

      const tab =
        await chrome.tabs.get(launch.tabId);

      currentPage =
        tab.url ?? "";

      sourceTabId =
        tab.id ?? null;

      return;

    } catch (error) {

      console.warn(
        "Right-clicked tab is no longer available:",
        error
      );
    }
  }


  const tabs =
    await chrome.tabs.query({
      currentWindow: true,
      active: true
    });


  if (
    tabs &&
    tabs.length > 0
  ) {

    currentPage =
      tabs[0].url ?? "";

    sourceTabId =
      tabs[0].id ?? null;
  }
}


const sourceTabReady =
  resolveSourceTab();


// ============================================================
// DOWNLOAD FLAG
// ============================================================

/**
 * Updates the download flag
 * in Chrome storage.
 */
const setDownloadFlag =
  (isDownloading) => {

    chrome.storage.sync.set({
      downloadFlag:
        isDownloading
    });
  };


// ============================================================
// SAVED OPTIONS
// ============================================================

/**
 * Fill options with safe defaults.
 */
function fillOptions() {

  chrome.storage.sync.get(
    (items) => {

      isFocusMode =
        items.isFocusMode ??
        false;


      isRestrictDomain =
        items.isRestrictDomain ??
        false;


      if (focusMode) {

        focusMode.checked =
          Boolean(
            isFocusMode
          );
      }


      if (restrictDomain) {

        restrictDomain.checked =
          Boolean(
            isRestrictDomain
          );
      }
    }
  );
}


// ============================================================
// DEPTH 1 UI
// ============================================================

/**
 * Show or hide Depth 1
 * mode controls.
 */
function updateDepthOneUI() {

  if (
    !depthOneModeSection ||
    !manualLinkControls
  ) {
    return;
  }


  const isDepthOne =
    Number(
      maxDepthValue
    ) === 1;


  depthOneModeSection.style.display =
    isDepthOne
      ? "block"
      : "none";


  if (!isDepthOne) {

    manualLinkControls.style.display =
      "none";

    return;
  }


  manualLinkControls.style.display =
    depthOneMode === "manual"
      ? "block"
      : "none";
}


// ============================================================
// MANUAL LINK LIST
// ============================================================

/**
 * Render scanned links into
 * the manual link list.
 */
function renderManualLinks() {

  if (!manualLinksList) {
    return;
  }


  if (
    !scannedLinks ||
    scannedLinks.length === 0
  ) {

    manualLinksList.innerHTML = `
      <div class="small text-muted">
        No valid links found on this page.
      </div>
    `;

    return;
  }


  manualLinksList.innerHTML =
    "";


  scannedLinks.forEach(
    (link, index) => {

      const row =
        document.createElement(
          "div"
        );


      row.className =
        "form-check mb-2 pb-2 border-bottom";


      const checkbox =
        document.createElement(
          "input"
        );


      checkbox.className =
        "form-check-input";


      checkbox.type =
        "checkbox";


      checkbox.id =
        `manual-link-${index}`;


      checkbox.dataset.linkUrl =
        link.url;


      checkbox.checked =
        selectedManualLinks.includes(
          link.url
        );


      checkbox.addEventListener(
        "change",
        (e) => {

          const url =
            e.target.dataset.linkUrl;


          if (
            e.target.checked
          ) {

            if (
              !selectedManualLinks.includes(
                url
              )
            ) {

              selectedManualLinks.push(
                url
              );
            }

          } else {

            selectedManualLinks =
              selectedManualLinks.filter(
                (item) =>
                  item !== url
              );
          }
        }
      );


      const label =
        document.createElement(
          "label"
        );


      label.className =
        "form-check-label ms-1";


      label.setAttribute(
        "for",
        checkbox.id
      );


      const title =
        document.createElement(
          "div"
        );


      title.className =
        "small fw-semibold text-dark";


      title.textContent =
        link.text ||
        "(Untitled link)";


      const urlText =
        document.createElement(
          "div"
        );


      urlText.className =
        "small text-muted";


      urlText.style.wordBreak =
        "break-word";


      urlText.textContent =
        link.url;


      label.appendChild(
        title
      );


      label.appendChild(
        urlText
      );


      row.appendChild(
        checkbox
      );


      row.appendChild(
        label
      );


      manualLinksList.appendChild(
        row
      );
    }
  );
}


// ============================================================
// LINK SCANNER
// ============================================================

/**
 * Scan the current page for
 * valid links so the user
 * can choose them manually.
 */
async function scanLinksFromCurrentPage() {

  if (!sourceTabId) {

    if (manualLinksList) {

      manualLinksList.innerHTML = `
        <div class="small text-danger">
          Could not find the source tab to scan.
        </div>
      `;
    }

    return;
  }


  if (manualLinksList) {

    manualLinksList.innerHTML = `
      <div class="small text-muted">
        Scanning links...
      </div>
    `;
  }


  try {

    const results =
      await chrome.scripting.executeScript({

        target: {
          tabId:
            sourceTabId
        },


        args: [
          Boolean(
            isRestrictDomain
          ),
          String(
            currentPage || ""
          ),
          Boolean(
            isFocusMode
          )
        ],


        func: (
          restrictDomain,
          rootPage,
          focusMode
        ) => {

          const collected =
            [];


          const seen =
            new Set();


          /*
           * FOCUS MODE LITE
           *
           * If Focus Mode is enabled,
           * search the most likely
           * primary content container.
           */
          let searchScope =
            document;


          if (focusMode) {

            searchScope =
              document.querySelector(
                "article"
              ) ||

              document.querySelector(
                "main"
              ) ||

              document.querySelector(
                '[role="main"]'
              ) ||

              document.querySelector(
                ".post-content"
              ) ||

              document.querySelector(
                ".entry-content"
              ) ||

              document;
          }


          for (
            const anchor
            of searchScope.querySelectorAll(
              "a[href]"
            )
          ) {

            const rawHref =
              anchor.getAttribute(
                "href"
              );


            const absolute =
              anchor.href;


            const text =
              (
                anchor.textContent ||
                ""
              )
                .trim()
                .replace(
                  /\s+/g,
                  " "
                );


            if (
              !rawHref ||
              !absolute
            ) {
              continue;
            }


            if (
              rawHref.startsWith(
                "#"
              )
            ) {
              continue;
            }


            if (
              absolute.startsWith(
                "mailto:"
              )
            ) {
              continue;
            }


            if (
              absolute.startsWith(
                "tel:"
              )
            ) {
              continue;
            }


            if (
              absolute.startsWith(
                "javascript:"
              )
            ) {
              continue;
            }


            if (
              absolute.startsWith(
                "about:"
              )
            ) {
              continue;
            }


            if (
              !absolute.startsWith(
                "http://"
              ) &&
              !absolute.startsWith(
                "https://"
              )
            ) {
              continue;
            }


            if (
              restrictDomain
            ) {

              try {

                const startHost =
                  new URL(
                    rootPage
                  ).hostname;


                const linkHost =
                  new URL(
                    absolute
                  ).hostname;


                if (
                  startHost !==
                  linkHost
                ) {
                  continue;
                }

              } catch (e) {

                continue;
              }
            }


            if (
              seen.has(
                absolute
              )
            ) {
              continue;
            }


            seen.add(
              absolute
            );


            collected.push({
              text:
                text ||
                absolute,

              url:
                absolute
            });
          }


          return collected;
        }
      });


    const collectedLinks =
      results &&
      results[0] &&
      Array.isArray(
        results[0].result
      )
        ? results[0].result
        : [];


    /*
     * Keep popup manageable.
     */
    scannedLinks =
      collectedLinks.slice(
        0,
        50
      );


    selectedManualLinks =
      [];


    renderManualLinks();

  } catch (error) {

    console.error(
      "Error scanning links:",
      error
    );


    if (manualLinksList) {

      manualLinksList.innerHTML = `
        <div class="small text-danger">
          Failed to scan links. Check permissions or reload the extension.
        </div>
      `;
    }
  }
}


// ============================================================
// INITIAL LOAD
// ============================================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    clearStaleDownloadFlag();


    fillOptions();


    handleDepthChange();


    updateLocalVideoStatus();


    restoreProgress();


    listenForProgress();


    /*
     * Show which page will be saved, including
     * the page picked from the right-click menu.
     */
    sourceTabReady.then(
      updateDownloadOptionsPageLabel
    );
  }
);


// ============================================================
// DOWNLOAD BUTTON
// ============================================================

submitButton.addEventListener(
  "click",
  startDownloadFromPopup
);


submitButton.addEventListener(
  "keydown",
  (e) => {

    if (
      e.key === "Enter" ||
      e.key === " "
    ) {

      e.preventDefault();

      startDownloadFromPopup();
    }
  }
);


/**
 * Opens the advanced options, used when
 * something in there needs attention.
 */
function openAdvancedOptions() {

  if (
    !advancedOptionsSection ||
    typeof bootstrap === "undefined"
  ) {
    return;
  }


  bootstrap.Collapse.getOrCreateInstance(
    advancedOptionsSection
  ).show();
}


function showDownloadInProgressToast() {

  const toast =
    new bootstrap.Toast(
      $("#toast")
    );


  toast.show();
}


/**
 * Show the page being downloaded
 * in the options header.
 */
function updateDownloadOptionsPageLabel() {

  if (!downloadOptionsPage) {
    return;
  }


  let label =
    currentPage || "Current page";


  try {

    const url =
      new URL(currentPage);

    label =
      url.hostname + url.pathname;

  } catch (error) {
    // Keep the raw value.
  }


  downloadOptionsPage.textContent =
    label;

  downloadOptionsPage.title =
    currentPage || "";
}


/**
 * The download button starts the crawl
 * with whatever is set in the popup.
 */
async function startDownloadFromPopup() {

  await sourceTabReady;

  checkDownloadFlag();
}


/**
 * Checks whether a crawl
 * is already running.
 */
function checkDownloadFlag() {

  chrome.storage.sync.get(
    (items) => {

      if (
        !items.downloadFlag
      ) {

        /*
         * Manual Depth 1 requires
         * at least one selected link.
         */
        if (
          Number(
            maxDepthValue
          ) === 1 &&
          depthOneMode ===
            "manual"
        ) {

          if (
            !selectedManualLinks ||
            selectedManualLinks.length ===
              0
          ) {

            openAdvancedOptions();


            if (
              manualLinksList
            ) {

              manualLinksList.innerHTML = `
                <div class="small text-danger">
                  Please scan links and select at least one link before downloading.
                </div>
              `;
            }

            return;
          }
        }


        const buttonTitle =
          document.getElementById(
            "button-title"
          );


        if (buttonTitle) {

          buttonTitle.innerText =
            "Foreground Crawl Running...";
        }


        startCrawl();

      } else {

        showDownloadInProgressToast();
      }
    }
  );
}


// ============================================================
// SEND DATA TO WINDOW.JS
// ============================================================

/**
 * Send crawl settings and
 * selected local videos to
 * the progress window.
 *
 * File objects support the
 * browser's structured clone
 * algorithm, which BroadcastChannel
 * uses when sending messages.
 */
function sendToWindowInstance() {

  console.log(
    "Sending local videos:",
    selectedLocalVideos.map(
      (file) =>
        file.name
    )
  );


  broadcastChannel.postMessage([
    String(
      currentPage ?? ""
    ),

    Boolean(
      isFocusMode
    ),

    Boolean(
      isRestrictDomain
    ),

    Number(
      maxDepthValue || 0
    ),

    sourceTabId ?? null,

    depthOneMode,

    Array.isArray(
      selectedManualLinks
    )
      ? selectedManualLinks
      : [],

    /*
     * NEW
     *
     * Local videos selected
     * from the user's computer.
     */
    Array.isArray(
      selectedLocalVideos
    )
      ? selectedLocalVideos
      : []
  ]);
}


// ============================================================
// CRAWL WORKER TAB
// ============================================================

/*
 * The crawling, zipping and downloading run in
 * html/window.html, which needs a real page to
 * use DOMParser and the Chrome tab APIs.
 *
 * It used to open as a separate pop-up window.
 * It is now a background tab in the same browser
 * window, and progress is shown in this popup.
 */

const WORKER_PAGE_URL =
  chrome.runtime.getURL("html/window.html");


/**
 * A crawl now keeps running after the popup
 * closes, so the "already running" flag is only
 * cleared when no worker tab is left.
 */
async function clearStaleDownloadFlag() {

  try {

    const tabs =
      await chrome.tabs.query({
        url: WORKER_PAGE_URL
      });


    if (
      !tabs ||
      tabs.length === 0
    ) {

      setDownloadFlag(false);
    }

  } catch (error) {

    setDownloadFlag(false);
  }
}


/**
 * Find the worker tab, or open it
 * in the background if it is not
 * running yet.
 */
async function ensureWorkerTab() {

  const existing =
    await chrome.tabs.query({
      url: WORKER_PAGE_URL
    });


  if (
    existing &&
    existing.length > 0
  ) {
    return existing[0];
  }


  return chrome.tabs.create({
    url: WORKER_PAGE_URL,
    active: false
  });
}


/**
 * Wait until the worker tab answers,
 * so the settings are not sent before
 * anything is listening.
 */
function waitForWorkerTab(timeoutMs = 8000) {

  return new Promise(
    (resolve) => {

      const startedAt =
        Date.now();


      function onMessage(event) {

        if (
          event.data &&
          event.data.type === "worker-ready"
        ) {

          cleanUp();

          resolve(true);
        }
      }


      function cleanUp() {

        clearInterval(pingTimer);

        broadcastChannel.removeEventListener(
          "message",
          onMessage
        );
      }


      broadcastChannel.addEventListener(
        "message",
        onMessage
      );


      const pingTimer =
        setInterval(
          () => {

            if (
              Date.now() - startedAt >
              timeoutMs
            ) {

              cleanUp();

              resolve(false);

              return;
            }


            broadcastChannel.postMessage({
              type: "worker-ping"
            });
          },
          200
        );


      broadcastChannel.postMessage({
        type: "worker-ping"
      });
    }
  );
}


/**
 * Open the worker tab if needed,
 * then hand it the crawl settings.
 */
async function startCrawl() {

  updatePopupStatus(
    "Starting..."
  );


  try {

    await ensureWorkerTab();

  } catch (error) {

    console.error(
      "Could not start the download tab:",
      error
    );


    updatePopupStatus(
      "Could not start the download. Please try again."
    );

    setDownloadFlag(false);

    return;
  }


  const isReady =
    await waitForWorkerTab();


  if (!isReady) {

    updatePopupStatus(
      "The download tab did not respond. Please try again."
    );

    setDownloadFlag(false);

    return;
  }


  sendToWindowInstance();
}


// ============================================================
// PROGRESS IN THE POPUP
// ============================================================

/*
 * The worker tab reports progress on this channel.
 * The popup closes whenever the user clicks away,
 * so the last update is also kept in storage and
 * restored the next time the popup opens.
 */
const progressChannel =
  new BroadcastChannel("scraper_progress");


const progressRing =
  document.getElementById("progress-ring");

const popupProgressText =
  document.getElementById("current-progress");


/*
 * Circumference of the ring drawn around
 * the download button (r = 55).
 */
const RING_LENGTH =
  2 * Math.PI * 55;

const popupStatus =
  document.getElementById("popup-status");

const progressSection =
  document.getElementById("progress-section");


/**
 * The progress card stays hidden
 * until there is something to show.
 */
function showProgressSection() {

  if (progressSection) {

    progressSection.style.display =
      "block";
  }
}


function updatePopupProgress(percentage) {

  showProgressSection();


  const value =
    Math.max(
      0,
      Math.min(
        100,
        Number(percentage) || 0
      )
    );


  if (progressRing) {

    progressRing.style.strokeDasharray =
      String(RING_LENGTH);

    progressRing.style.strokeDashoffset =
      String(
        RING_LENGTH -
        (RING_LENGTH * value / 100)
      );
  }


  if (popupProgressText) {

    popupProgressText.innerText =
      value + "%";
  }


  /*
   * The icon gives way to the percentage
   * once a crawl is under way.
   */
  if (submitButton) {

    submitButton.classList.add(
      "gb-dial-active"
    );
  }
}


function updatePopupStatus(message) {

  showProgressSection();


  if (popupStatus) {

    popupStatus.innerText =
      message;
  }


  if (
    submitButton &&
    /complete|failed/i.test(message)
  ) {

    submitButton.classList.add(
      "gb-dial-done"
    );


    /*
     * The crawl is over, so the button
     * reads as ready again.
     */
    const buttonTitle =
      document.getElementById(
        "button-title"
      );


    if (buttonTitle) {

      buttonTitle.innerText =
        "Download This Page";
    }
  }
}


/**
 * Show whatever the worker tab
 * reported while the popup was closed.
 */
function restoreProgress() {

  chrome.storage.local.get(
    "lastProgress",
    (items) => {

      const last =
        items.lastProgress;


      if (!last) {
        return;
      }


      updatePopupProgress(
        last.percentage
      );


      updatePopupStatus(
        last.message ||
        "Waiting to start"
      );


      const buttonTitle =
        document.getElementById(
          "button-title"
        );


      if (
        last.isRunning &&
        buttonTitle
      ) {

        buttonTitle.innerText =
          "Foreground Crawl Running...";
      }
    }
  );
}


/**
 * Live updates while the popup is open.
 */
function listenForProgress() {

  progressChannel.addEventListener(
    "message",
    (event) => {

      const update =
        event.data;


      if (!update) {
        return;
      }


      if (
        typeof update.percentage === "number"
      ) {

        updatePopupProgress(
          update.percentage
        );
      }


      if (update.message) {

        updatePopupStatus(
          update.message
        );
      }
    }
  );
}