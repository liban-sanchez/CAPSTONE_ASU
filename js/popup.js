const broadcastChannel = new BroadcastChannel("scraper_data");

let currentPage = "";
let sourceTabId = null;

const submitButton = document.getElementById("submit-button");
const focusMode = document.getElementById("focus-mode-toggle");
const restrictDomain = document.getElementById("restrict-domain-toggle");
const depthMode = document.getElementById("choose-depth-input");

// New Depth 1 manual selection elements
const depthOneModeSection = document.getElementById("depth-one-mode-section");
const depthOneAllLinks = document.getElementById("depth-one-all-links");
const depthOneManualLinks = document.getElementById("depth-one-manual-links");
const manualLinkControls = document.getElementById("manual-link-controls");
const scanLinksButton = document.getElementById("scan-links-button");
const selectAllLinksButton = document.getElementById("select-all-links-button");
const clearAllLinksButton = document.getElementById("clear-all-links-button");
const manualLinksList = document.getElementById("manual-links-list");

let isFocusMode = false;
let isRestrictDomain = false;
let maxDepthValue = 0;

// New manual mode state
let depthOneMode = "all"; // "all" or "manual"
let scannedLinks = []; // [{ text, url }]
let selectedManualLinks = []; // [url]

depthMode.addEventListener("change", (e) => {
  maxDepthValue = Number(e.target.value || 0);
  updateDepthOneUI();
});

focusMode.addEventListener("change", (e) => {
  isFocusMode = Boolean(e.target.checked);
  chrome.storage.sync.set({ isFocusMode: isFocusMode }); // Saves to browser state
});

restrictDomain.addEventListener("change", (e) => {
  isRestrictDomain = Boolean(e.target.checked);
  chrome.storage.sync.set({ isRestrictDomain: isRestrictDomain }); // Saves to browser state
});

if (depthOneAllLinks) {
  depthOneAllLinks.addEventListener("change", () => {
    if (depthOneAllLinks.checked) {
      depthOneMode = "all";
      updateDepthOneUI();
    }
  });
}

if (depthOneManualLinks) {
  depthOneManualLinks.addEventListener("change", () => {
    if (depthOneManualLinks.checked) {
      depthOneMode = "manual";
      updateDepthOneUI();
    }
  });
}

if (scanLinksButton) {
  scanLinksButton.addEventListener("click", async () => {
    await scanLinksFromCurrentPage();
  });
}

if (selectAllLinksButton) {
  selectAllLinksButton.addEventListener("click", () => {
    const checkboxes = manualLinksList.querySelectorAll(
      'input[type="checkbox"][data-link-url]'
    );
    selectedManualLinks = [];

    checkboxes.forEach((checkbox) => {
      checkbox.checked = true;
      selectedManualLinks.push(checkbox.dataset.linkUrl);
    });
  });
}

if (clearAllLinksButton) {
  clearAllLinksButton.addEventListener("click", () => {
    const checkboxes = manualLinksList.querySelectorAll(
      'input[type="checkbox"][data-link-url]'
    );
    checkboxes.forEach((checkbox) => {
      checkbox.checked = false;
    });
    selectedManualLinks = [];
  });
}

/**
 * Capture the current active tab and source tab ID.
 */
chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
  if (tabs && tabs.length > 0) {
    currentPage = tabs[0].url ?? "";
    sourceTabId = tabs[0].id ?? null;
  }
});

/**
 * Updates the 'flagDownload' in chrome storage.
 */
const setDownloadFlag = (isDownloading) => {
  chrome.storage.sync.set({ downloadFlag: isDownloading });
};

/**
 * Fill options with safe defaults.
 */
function fillOptions() {
  chrome.storage.sync.get((items) => {
    isFocusMode = items.isFocusMode ?? false;
    isRestrictDomain = items.isRestrictDomain ?? false;

    if (focusMode) {
      focusMode.checked = Boolean(isFocusMode);
    }

    if (restrictDomain) {
      restrictDomain.checked = Boolean(isRestrictDomain);
    }
  });
}

/**
 * Show/hide Depth 1 mode controls.
 */
function updateDepthOneUI() {
  if (!depthOneModeSection || !manualLinkControls) return;

  const isDepthOne = Number(maxDepthValue) === 1;

  depthOneModeSection.style.display = isDepthOne ? "block" : "none";

  if (!isDepthOne) {
    manualLinkControls.style.display = "none";
    return;
  }

  manualLinkControls.style.display =
    depthOneMode === "manual" ? "block" : "none";
}

/**
 * Render the scanned links into the manual link list.
 */
function renderManualLinks() {
  if (!manualLinksList) return;

  if (!scannedLinks || scannedLinks.length === 0) {
    manualLinksList.innerHTML = `
      <div class="small text-muted">
        No valid links found on this page.
      </div>
    `;
    return;
  }

  manualLinksList.innerHTML = "";

  scannedLinks.forEach((link, index) => {
    const row = document.createElement("div");
    row.className = "form-check mb-2 pb-2 border-bottom";

    const checkbox = document.createElement("input");
    checkbox.className = "form-check-input";
    checkbox.type = "checkbox";
    checkbox.id = `manual-link-${index}`;
    checkbox.dataset.linkUrl = link.url;

    // default unchecked; user chooses explicitly
    checkbox.checked = selectedManualLinks.includes(link.url);

    checkbox.addEventListener("change", (e) => {
      const url = e.target.dataset.linkUrl;

      if (e.target.checked) {
        if (!selectedManualLinks.includes(url)) {
          selectedManualLinks.push(url);
        }
      } else {
        selectedManualLinks = selectedManualLinks.filter((item) => item !== url);
      }
    });

    const label = document.createElement("label");
    label.className = "form-check-label ms-1";
    label.setAttribute("for", checkbox.id);

    const title = document.createElement("div");
    title.className = "small fw-semibold text-dark";
    title.textContent = link.text || "(Untitled link)";

    const urlText = document.createElement("div");
    urlText.className = "small text-muted";
    urlText.style.wordBreak = "break-word";
    urlText.textContent = link.url;

    label.appendChild(title);
    label.appendChild(urlText);

    row.appendChild(checkbox);
    row.appendChild(label);

    manualLinksList.appendChild(row);
  });
}

/**
 * Scan the current page for valid links so the user can choose manually.
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
    const results = await chrome.scripting.executeScript({
      target: { tabId: sourceTabId },
      // Pass the Focus Mode state into the injected script
      args: [Boolean(isRestrictDomain), String(currentPage || ""), Boolean(isFocusMode)],
      func: (restrictDomain, rootPage, focusMode) => {
        const collected = [];
        const seen = new Set();

        // FOCUS MODE LITE: If enabled, restrict our search to the main article body
        let searchScope = document;
        if (focusMode) {
          searchScope = document.querySelector('article') ||
                        document.querySelector('main') ||
                        document.querySelector('[role="main"]') ||
                        document.querySelector('.post-content') ||
                        document.querySelector('.entry-content') ||
                        document; // fallback to whole document if no clear tag is found
        }

        // Search for links ONLY within the defined scope
        for (const anchor of searchScope.querySelectorAll("a[href]")) {
          const rawHref = anchor.getAttribute("href");
          const absolute = anchor.href;
          const text = (anchor.textContent || "").trim().replace(/\s+/g, " ");

          if (!rawHref || !absolute) continue;

          // Skip junk links
          if (rawHref.startsWith("#")) continue;
          if (absolute.startsWith("mailto:")) continue;
          if (absolute.startsWith("tel:")) continue;
          if (absolute.startsWith("javascript:")) continue;
          if (absolute.startsWith("about:")) continue;
          if (!absolute.startsWith("http://") && !absolute.startsWith("https://")) continue;

          if (restrictDomain) {
            try {
              const startHost = new URL(rootPage).hostname;
              const linkHost = new URL(absolute).hostname;
              if (startHost !== linkHost) continue;
            } catch (e) {
              continue;
            }
          }

          if (seen.has(absolute)) continue;
          seen.add(absolute);

          collected.push({
            text: text || absolute,
            url: absolute
          });
        }

        return collected;
      }
    });

    const collectedLinks = results && results[0] && Array.isArray(results[0].result) ? results[0].result : [];

    // Keep popup manageable by slicing top 50
    scannedLinks = collectedLinks.slice(0, 50);
    selectedManualLinks = [];
    renderManualLinks();

  } catch (error) {
    console.error("Error scanning links:", error);

    if (manualLinksList) {
      manualLinksList.innerHTML = `
        <div class="small text-danger">
          Failed to scan links. Check permissions or reload the extension.
        </div>
      `;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setDownloadFlag(false);
  fillOptions();
  updateDepthOneUI();
  openWindow();
});

submitButton.addEventListener("click", checkDownloadFlag);

/**
 * Checks whether a crawl is already running.
 */
function checkDownloadFlag() {
  chrome.storage.sync.get((items) => {
    if (!items.downloadFlag) {
      if (Number(maxDepthValue) === 1 && depthOneMode === "manual") {
        if (!selectedManualLinks || selectedManualLinks.length === 0) {
          if (manualLinksList) {
            manualLinksList.innerHTML = `
              <div class="small text-danger">
                Please scan links and select at least one link before downloading.
              </div>
            `;
          }
          return;
        }
      }

      const buttonTitle = document.getElementById("button-title");
      if (buttonTitle) {
        buttonTitle.innerText = "Foreground Crawl Running...";
      }

      sendToWindowInstance();
    } else {
      const toast = new bootstrap.Toast($("#toast"));
      toast.show();
    }
  });
}

/**
 * Send crawl settings to the progress window safely.
 */
function sendToWindowInstance() {
  broadcastChannel.postMessage([
    String(currentPage ?? ""),
    Boolean(isFocusMode),
    Boolean(isRestrictDomain),
    Number(maxDepthValue || 0),
    sourceTabId ?? null,
    depthOneMode,
    Array.isArray(selectedManualLinks) ? selectedManualLinks : []
  ]);
}

/**
 * Open the separate progress window.
 */
function openWindow() {
  let params = `
    scrollbars=no,
    resizable=no,
    status=no,
    location=no,
    toolbar=no,
    menubar=no,
    width=340,
    height=350,
    left=100,
    top=100,
    dependent=yes
  `;

  let popupWindow = window.open(
    "../html/window.html",
    "scraper_window",
    params
  );

  if (
    !popupWindow ||
    popupWindow.closed ||
    typeof popupWindow.closed == "undefined"
  ) {
    alert("Please allow pop-ups for this website in order to download it.");
  }
}