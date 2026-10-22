/**
 * POPUP STATE
 * A centralized state object for the extension popup UI.
 * Tracks user configuration, selected media, and tab data.
 */

export const state = {
  // ============================================================
  // TAB & CONTEXT DATA
  // ============================================================
  currentPage: "",
  sourceTabId: null,
  isContextMenuLaunch: false,

  // ============================================================
  // LOCAL MEDIA
  // ============================================================
  selectedLocalVideos: [],

  // ============================================================
  // ADVANCED SCRAPER SETTINGS
  // ============================================================
  isFocusMode: false,
  isRestrictDomain: false,
  maxDepthValue: 0,

  // ============================================================
  // DEPTH 1 MANUAL SELECTION
  // ============================================================
  depthOneMode: "all",
  scannedLinks: [],
  selectedManualLinks: []
};