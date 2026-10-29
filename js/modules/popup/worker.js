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

export async function startWorkerCrawl(updateStatusCb) {
  updateStatusCb("Starting...");
  
  try {
    const tab = await chrome.tabs.create({ url: WORKER_PAGE_URL, active: true });
    
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