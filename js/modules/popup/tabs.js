/**
 * TABS
 * Handles Chrome tab querying and context menu launch resolution.
 */

import { state } from './state.js';

const CONTEXT_MENU_LAUNCH_KEY = "pendingContextMenuDownload";
const CONTEXT_MENU_LAUNCH_MAX_AGE_MS = 10000;

// ============================================================
// CONTEXT MENU LAUNCH
// ============================================================
async function takeContextMenuLaunch() {
  try {
    const items = await chrome.storage.session.get(CONTEXT_MENU_LAUNCH_KEY);
    const launch = items[CONTEXT_MENU_LAUNCH_KEY];
    
    if (!launch) return null;
    await chrome.storage.session.remove(CONTEXT_MENU_LAUNCH_KEY);

    const isFresh = Date.now() - Number(launch.createdAt || 0) < CONTEXT_MENU_LAUNCH_MAX_AGE_MS;
    return (isFresh && Number.isInteger(launch.tabId)) ? launch : null;
  } catch (error) {
    console.warn("Could not read right-click launch:", error);
    return null;
  }
}

// ============================================================
// RESOLVE SOURCE TAB
// ============================================================
export async function resolveSourceTab() {
  const launch = await takeContextMenuLaunch();

  if (launch) {
    try {
      const tab = await chrome.tabs.get(launch.tabId);
      state.currentPage = tab.url ?? "";
      state.sourceTabId = tab.id ?? null;
      state.isContextMenuLaunch = true;
      return;
    } catch (error) {
      console.warn("Right-clicked tab is no longer available:", error);
    }
  }

  const tabs = await chrome.tabs.query({ currentWindow: true, active: true });
  if (tabs && tabs.length > 0) {
    state.currentPage = tabs[0].url ?? "";
    state.sourceTabId = tabs[0].id ?? null;
  }
}