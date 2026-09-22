import { state } from './modules/state.js';
import { startScrapingProcess } from './modules/scraper.js';

// ============================================================
// BROADCAST CHANNEL LISTENER
// ============================================================
const broadcastChannel = new BroadcastChannel("scraper_data");

// This page runs as a background tab. The popup pings it before
// sending settings, so nothing is sent while it is still loading.
broadcastChannel.addEventListener("message", (event) => {
  if (event.data && event.data.type === "worker-ping") {
    broadcastChannel.postMessage({ type: "worker-ready" });
    return;
  }

  // Anything that is not the settings array is ignored.
  if (!Array.isArray(event.data)) return;

  let startingURLInput, isFocusMode, isRestrictDomain, newMaxDepthValue, sourceTabId, depthOneMode, selectedManualLinks, selectedLocalVideos;

  [
    startingURLInput,
    isFocusMode,
    isRestrictDomain,
    newMaxDepthValue,
    sourceTabId,
    depthOneMode,
    selectedManualLinks,
    selectedLocalVideos
  ] = event.data;

  // Normalize and assign to our new state object
  state.startingURLInput = startingURLInput ?? "";
  state.currentPage = state.startingURLInput;
  state.isFocusMode = Boolean(isFocusMode);
  state.isRestrictDomain = Boolean(isRestrictDomain);
  state.maxDepthValue = Number(newMaxDepthValue || 0);
  state.sourceTabId = sourceTabId ?? null;
  state.depthOneMode = depthOneMode === "manual" ? "manual" : "all";
  state.selectedManualLinks = Array.isArray(selectedManualLinks) ? selectedManualLinks.map(String) : [];
  state.selectedLocalVideos = Array.isArray(selectedLocalVideos) ? selectedLocalVideos.filter((file) => file && typeof file.name === "string") : [];

  // Show which site is being saved at the top of the page.
  const targetLabel = document.getElementById("crawl-target");
  if (targetLabel && state.startingURLInput) {
    try {
      const url = new URL(state.startingURLInput);
      targetLabel.textContent = url.hostname + url.pathname;
    } catch (error) {
      targetLabel.textContent = state.startingURLInput;
    }
    targetLabel.title = state.startingURLInput;
  }

  console.log("Local videos received:", state.selectedLocalVideos.map((file) => ({ name: file.name, type: file.type, size: file.size })));

  // Set the download flag directly in chrome storage
  chrome.storage.sync.set({ downloadFlag: true });

  // Trigger the scraper
  startScrapingProcess();
});

// Tell the popup this tab is ready, in case it is already waiting.
broadcastChannel.postMessage({ type: "worker-ready" });
