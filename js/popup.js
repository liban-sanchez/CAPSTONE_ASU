const broadcastChannel = new BroadcastChannel("scraper_data");

let currentPage = "";
let sourceTabId = null;

const submitButton = document.getElementById("submit-button");
const focusMode = document.getElementById("focus-mode-toggle");
const restrictDomain = document.getElementById("restrict-domain-toggle");
const depthMode = document.getElementById("choose-depth-input");

let isFocusMode = false;
let isRestrictDomain = false;
let maxDepthValue = 0;

depthMode.addEventListener("change", (e) => {
  maxDepthValue = Number(e.target.value || 0);
});

focusMode.addEventListener("change", (e) => {
  isFocusMode = Boolean(e.target.checked);
});

restrictDomain.addEventListener("change", (e) => {
  isRestrictDomain = Boolean(e.target.checked);
});

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

document.addEventListener("DOMContentLoaded", () => {
  setDownloadFlag(false);
  fillOptions();
  openWindow();
});

submitButton.addEventListener("click", checkDownloadFlag);

/**
 * Checks whether a crawl is already running.
 */
function checkDownloadFlag() {
  chrome.storage.sync.get((items) => {
    if (!items.downloadFlag) {
      const buttonTitle = document.getElementById("button-title");
      if (buttonTitle) {
        buttonTitle.innerText = "Foreground Crawl Running...";
      }

      sendToWindowInstance();
    } else {
      var toast = new bootstrap.Toast($("#toast"));
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
    sourceTabId ?? null
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