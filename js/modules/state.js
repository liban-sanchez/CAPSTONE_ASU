/**
 * STATE
 * Holds the global variables, download tracking arrays, and the main ZIP file instance.
 */

export const state = {
  startingURLInput: "",
  currentPage: "",
  sourceTabId: null,
  isExcludeImages: false,
  isFocusMode: false,
  isRestrictDomain: false,
  maxDepthValue: 0,
  depthOneMode: "all",
  selectedManualLinks: [],
  selectedLocalVideos: [],
  urlList: [],
  urlCSSs: [],
  urlImages: [],
  urlVideos: [],
  urlJSs: [],
  urlPdfs: [],
  scrapingDone: false,
  zip: new JSZip(),
  extId: chrome.runtime.id
};

/**
 * Clears all asset tracking arrays and generates a fresh 
 * JSZip instance for subsequent downloads.
 */

export function resetAssetState() {
  state.urlList = [];
  state.urlCSSs = [];
  state.urlImages = [];
  state.urlVideos = [];
  state.urlJSs = [];
  state.urlPdfs = [];
  state.selectedLocalVideos = [];
  state.zip = new JSZip();
}