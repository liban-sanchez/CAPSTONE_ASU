/**
 * WORKER TAB ORCHESTRATION
 * Opens window.html as a new foreground tab and transmits configurations.
 */

import { state } from './state.js';

const WORKER_PAGE_URL = chrome.runtime.getURL("html/window.html");
const broadcastChannel = new BroadcastChannel("scraper_data");

const DEFAULT_PACKAGE_CONFIG = {
  packageName: "offline-website",
  organizationMode: "default",
  folders: {
    assets: "assets", images: "images", videos: "videos",
    documents: "documents", styles: "styles", scripts: "scripts", pages: "pages"
  },
  includeReadme: true
};

export async function clearStaleDownloadFlag() {
  try {
    const tabs = await chrome.tabs.query({ url: WORKER_PAGE_URL });
    if (!tabs || tabs.length === 0) chrome.storage.sync.set({ downloadFlag: false });
  } catch (error) {
    chrome.storage.sync.set({ downloadFlag: false });
  }
}

/**
 * Switches to the download tab, if one is open.
 * Returns false when there is no download tab.
 */
export async function focusWorkerTab() {
  try {
    const tabs = await chrome.tabs.query({ url: WORKER_PAGE_URL });
    if (!tabs || tabs.length === 0) return false;
    const tab = tabs[0];
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
    return true;
  } catch (error) {
    console.warn("Could not switch to the download tab:", error);
    return false;
  }
}

/**
 * True when a download tab is open.
 */
export async function hasWorkerTab() {
  try {
    const tabs = await chrome.tabs.query({ url: WORKER_PAGE_URL });
    return Boolean(tabs && tabs.length > 0);
  } catch (error) {
    return false;
  }
}

export async function startWorkerCrawl(updateStatusCb) {
  updateStatusCb("Starting...");
  
  try {
    // Open in the background: the user stays on their page and can
    // switch to the download tab from the popup whenever they like.
    const tab = await chrome.tabs.create({ url: WORKER_PAGE_URL, active: false });
    updateStatusCb("Downloading in a background tab. You can keep browsing.");
    
    // Protect both tabs from being discarded by Chrome Memory Saver during background multitasking
    try {
      await chrome.tabs.update(tab.id, { autoDiscardable: false });
      if (state.sourceTabId) {
        await chrome.tabs.update(state.sourceTabId, { autoDiscardable: false });
      }
    } catch (_) {}

    chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
      if (tabId === tab.id && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        
        broadcastChannel.postMessage([
          state.currentPage || "",
          Boolean(state.isFocusMode),
          Boolean(state.isRestrictDomain),
          Number(state.maxDepthValue || 0),
          state.sourceTabId || null,
          state.depthOneMode,
          Array.isArray(state.selectedManualLinks) ? state.selectedManualLinks : [],
          Array.isArray(state.selectedLocalVideos) ? state.selectedLocalVideos : [],
          DEFAULT_PACKAGE_CONFIG
        ]);
      }
    });
  } catch (error) {
    console.error("Could not open the download tab:", error);
    updateStatusCb("Could not start the download. Please try again.");
    chrome.storage.sync.set({ downloadFlag: false });
  }
}