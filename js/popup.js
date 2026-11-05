/**
 * POPUP CONTROLLER (Matches popup_2.html)
 * Wires up the UI, handles user input, and broadcasts settings to the worker tab.
 */

import { state } from './modules/popup/state.js';
import { resolveSourceTab } from './modules/popup/tabs.js';
import { scanLinks } from './modules/popup/scanner.js';
import { initTooltips } from './modules/popup/tooltips.js';
import { detectPageVideo } from './modules/popup/video.js';
import { initDepthUI } from './modules/popup/depth.js';
import { initProgressUI } from './modules/popup/progress.js';
import { clearStaleDownloadFlag, startWorkerCrawl, focusWorkerTab, hasWorkerTab } from './modules/popup/worker.js';
import { estimateDownload, describeEstimate } from './modules/popup/estimate.js';
import { initUsageSummary } from './modules/popup/usage.js';

// ============================================================
// DOM ELEMENTS
// ============================================================
const submitButton = document.getElementById("submit-button");
const focusMode = document.getElementById("focus-mode-toggle");
const restrictDomain = document.getElementById("restrict-domain-toggle");
const downloadOptionsPage = document.getElementById("download-options-page");

// Video Elements
const localVideoInput = document.getElementById("local-video-input");
const localVideoStatus = document.getElementById("local-video-status");

// Depth 1 Elements
const depthOneModeSection = document.getElementById("depth-one-mode-section");
const depthOneAllLinks = document.getElementById("depth-one-all-links");
const depthOneManualLinks = document.getElementById("depth-one-manual-links");
const manualLinkControls = document.getElementById("manual-link-controls");
const scanLinksButton = document.getElementById("scan-links-button");
const selectAllLinksButton = document.getElementById("select-all-links-button");
const clearAllLinksButton = document.getElementById("clear-all-links-button");
const manualLinksList = document.getElementById("manual-links-list");

const sourceTabReady = resolveSourceTab();
let depthUIHandlers = null;
let progressUIHandlers = null;

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  clearStaleDownloadFlag();
  initTooltips();
  progressUIHandlers = initProgressUI();
  initUsageSummary();
  depthUIHandlers = initDepthUI(updateDepthOneUI);

  chrome.storage.sync.get((items) => {
    state.isFocusMode = items.isFocusMode ?? false;
    state.isRestrictDomain = items.isRestrictDomain ?? true; 
    if (focusMode) focusMode.checked = state.isFocusMode;
    if (restrictDomain) restrictDomain.checked = state.isRestrictDomain;
    if (depthUIHandlers) depthUIHandlers.updateRestrictDomainHint();
  });

  updateDepthOneUI();
  updateLocalVideoStatus();

  sourceTabReady.then(() => {
    if (downloadOptionsPage) {
      let label = state.currentPage || "Current page";
      try {
        const url = new URL(state.currentPage);
        label = url.hostname + url.pathname;
      } catch (error) {}
      downloadOptionsPage.textContent = label;
      downloadOptionsPage.title = state.currentPage || "";
    }
    
    detectPageVideo();

    // Replay progress only for a download that is still running, or one
    // that just finished on this page.
    hasWorkerTab().then((workerOpen) => {
      progressUIHandlers.restoreLastProgress(state.currentPage, workerOpen);
    });

    refreshTimeEstimate();
  });
});

// ============================================================
// UI UPDATERS
// ============================================================
function updateDepthOneUI() {
  if (!depthOneModeSection || !manualLinkControls) return;
  const isDepthOne = state.maxDepthValue === 1;
  depthOneModeSection.style.display = isDepthOne ? "block" : "none";
  manualLinkControls.style.display = (isDepthOne && state.depthOneMode === "manual") ? "block" : "none";
}

function updateLocalVideoStatus() {
  if (!localVideoStatus) return;
  if (state.selectedLocalVideos.length === 0) {
    localVideoStatus.innerHTML = `<div class="small text-muted">No local videos selected.</div>`;
    return;
  }
  
  localVideoStatus.innerHTML = "";
  const heading = document.createElement("div");
  heading.className = "small fw-semibold";
  heading.textContent = state.selectedLocalVideos.length === 1 ? "1 video selected:" : `${state.selectedLocalVideos.length} videos selected:`;
  localVideoStatus.appendChild(heading);

  for (const file of state.selectedLocalVideos) {
    const fileRow = document.createElement("div");
    fileRow.className = "small text-muted";
    fileRow.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
    localVideoStatus.appendChild(fileRow);
  }
}

function renderManualLinks() {
  if (!manualLinksList) return;
  if (!state.scannedLinks || state.scannedLinks.length === 0) {
    manualLinksList.innerHTML = `<div class="small text-muted">No valid links found on this page.</div>`;
    return;
  }

  manualLinksList.innerHTML = "";
  state.scannedLinks.forEach((link, index) => {
    const row = document.createElement("div");
    row.className = "form-check mb-2 pb-2 border-bottom";

    const checkbox = document.createElement("input");
    checkbox.className = "form-check-input";
    checkbox.type = "checkbox";
    checkbox.id = `manual-link-${index}`;
    checkbox.dataset.linkUrl = link.url;
    checkbox.checked = state.selectedManualLinks.includes(link.url);

    checkbox.addEventListener("change", (e) => {
      const url = e.target.dataset.linkUrl;
      if (e.target.checked) {
        if (!state.selectedManualLinks.includes(url)) state.selectedManualLinks.push(url);
      } else {
        state.selectedManualLinks = state.selectedManualLinks.filter((item) => item !== url);
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

// ============================================================
// EVENT LISTENERS
// ============================================================
focusMode.addEventListener("change", (e) => {
  state.isFocusMode = Boolean(e.target.checked);
  chrome.storage.sync.set({ isFocusMode: state.isFocusMode });
});

restrictDomain.addEventListener("change", (e) => {
  state.isRestrictDomain = Boolean(e.target.checked);
  chrome.storage.sync.set({ isRestrictDomain: state.isRestrictDomain });
  if (depthUIHandlers) {
    depthUIHandlers.updateRestrictDomainHint();
    depthUIHandlers.updateDepthWarning();
  }
});

if (depthOneAllLinks) {
  depthOneAllLinks.addEventListener("change", () => {
    if (depthOneAllLinks.checked) {
      state.depthOneMode = "all";
      updateDepthOneUI();
    }
  });
}

if (depthOneManualLinks) {
  depthOneManualLinks.addEventListener("change", () => {
    if (depthOneManualLinks.checked) {
      state.depthOneMode = "manual";
      updateDepthOneUI();
    }
  });
}

if (localVideoInput) {
  localVideoInput.addEventListener("change", (event) => {
    const files = event.target.files;
    if (!files) {
      state.selectedLocalVideos = [];
      updateLocalVideoStatus();
      return;
    }
    state.selectedLocalVideos = Array.from(files).filter(file => file && (file.type.startsWith("video/") || file.name.match(/\.(mp4|webm|mov|m4v|avi|mkv)$/i)));
    updateLocalVideoStatus();
  });
}

if (scanLinksButton) {
  scanLinksButton.addEventListener("click", async () => {
    if (!state.sourceTabId) return;
    if (manualLinksList) manualLinksList.innerHTML = `<div class="small text-muted">Scanning links...</div>`;
    
    try {
      const links = await scanLinks(state.sourceTabId, state.isRestrictDomain, state.currentPage, state.isFocusMode);
      state.scannedLinks = links.slice(0, 50);
      state.selectedManualLinks = [];
      renderManualLinks();
    } catch (e) {
      if (manualLinksList) manualLinksList.innerHTML = `<div class="small text-danger">Failed to scan links.</div>`;
    }
  });
}

if (selectAllLinksButton) {
  selectAllLinksButton.addEventListener("click", () => {
    manualLinksList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.checked = true;
      if (!state.selectedManualLinks.includes(cb.dataset.linkUrl)) state.selectedManualLinks.push(cb.dataset.linkUrl);
    });
  });
}

if (clearAllLinksButton) {
  clearAllLinksButton.addEventListener("click", () => {
    manualLinksList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    state.selectedManualLinks = [];
  });
}

// ============================================================
// DOWNLOAD EXECUTION
// ============================================================
submitButton.addEventListener("click", handleStartDownload);
submitButton.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleStartDownload(); }
});

function handleStartDownload() {
  chrome.storage.sync.get((items) => {
    if (!items.downloadFlag) {
      if (state.maxDepthValue === 1 && state.depthOneMode === "manual" && state.selectedManualLinks.length === 0) {
        const advancedCollapse = document.getElementById("advanced-options");
        if (advancedCollapse && typeof bootstrap !== "undefined") {
          bootstrap.Collapse.getOrCreateInstance(advancedCollapse).show();
        }
        if (manualLinksList) manualLinksList.innerHTML = `<div class="small text-danger">Please scan links and select at least one link.</div>`;
        return;
      }
      
      if (document.getElementById("button-title")) document.getElementById("button-title").innerText = "Download";
      progressUIHandlers.setRunPage(state.currentPage);
      progressUIHandlers.startNewRun();
      startWorkerCrawl(progressUIHandlers.updatePopupStatus).then(updateOpenWorkerTabLink);
    } else {
      const toastEl = document.getElementById("toast");
      if (toastEl && typeof bootstrap !== "undefined") new bootstrap.Toast(toastEl).show();
    }
  });
}

// ============================================================
// GO TO DOWNLOAD TAB
// The download runs in a background tab; this link switches to it.
// Shown only while that tab is open.
// ============================================================
const openWorkerTabLink = document.getElementById("open-worker-tab");

async function updateOpenWorkerTabLink() {
  if (!openWorkerTabLink) return;
  openWorkerTabLink.style.display = (await hasWorkerTab()) ? "block" : "none";
}

if (openWorkerTabLink) {
  openWorkerTabLink.addEventListener("click", async () => {
    const switched = await focusWorkerTab();
    if (!switched) openWorkerTabLink.style.display = "none";
  });

  updateOpenWorkerTabLink();
}


// ============================================================
// TIME ESTIMATE
// "For each download, tell the user how long it will take."
// Recomputed whenever a setting changes; see estimate.js.
// ============================================================
const timeEstimate = document.getElementById("time-estimate");
let estimateTimer = null;
let estimateRun = 0;

async function refreshTimeEstimate() {
  if (!timeEstimate) return;

  const { downloadFlag } = await chrome.storage.sync.get("downloadFlag");
  if (downloadFlag) {
    timeEstimate.style.display = "none";
    return;
  }

  const run = ++estimateRun;
  const estimate = await estimateDownload();
  if (run !== estimateRun) return; // a newer change already started

  const text = describeEstimate(estimate);
  timeEstimate.textContent = text;
  timeEstimate.title = estimate && estimate.fromHistory
    ? `Based on your last ${estimate.fromHistory} downloads`
    : "Based on about 8 seconds a page";
  timeEstimate.style.display = text ? "block" : "none";
}

function scheduleTimeEstimate() {
  clearTimeout(estimateTimer);
  estimateTimer = setTimeout(refreshTimeEstimate, 250);
}

// Any setting change (depth, switches, link picks, scan buttons).
document.addEventListener("change", scheduleTimeEstimate);
document.addEventListener("input", scheduleTimeEstimate);
for (const id of ["select-all-links-button", "clear-all-links-button", "scan-links-button"]) {
  const button = document.getElementById(id);
  if (button) button.addEventListener("click", () => setTimeout(scheduleTimeEstimate, 50));
}
