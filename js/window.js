import { state } from './modules/state.js';
import { enforceWindowSize } from './modules/ui.js';
import { startScrapingProcess } from './modules/scraper.js';

// ============================================================
// WINDOW EVENTS
// ============================================================
window.addEventListener("load", enforceWindowSize);
window.addEventListener("resize", enforceWindowSize);
document.addEventListener("fullscreenchange", enforceWindowSize);

window.addEventListener("keydown", (e) => {
  if (e.key === "F11") e.preventDefault();
});

// ============================================================
// BROADCAST CHANNEL LISTENER
// ============================================================
const broadcastChannel = new BroadcastChannel("scraper_data");

broadcastChannel.addEventListener("message", (event) => {
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

  console.log("Local videos received:", state.selectedLocalVideos.map((file) => ({ name: file.name, type: file.type, size: file.size })));

  // Set the download flag directly in chrome storage
  chrome.storage.sync.set({ downloadFlag: true });

  // Trigger the scraper
  startScrapingProcess();
});