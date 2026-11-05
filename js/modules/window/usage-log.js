/**
 * USAGE LOG
 * Keeps a small record of each download on this computer only, so the
 * popup can show how many sites were saved and estimate how long the
 * next download will take. Nothing here is sent anywhere.
 *
 * What one entry holds (and nothing else):
 *   savedAt  - date and time of the download
 *   site     - the website's host name (example.org), not the full address
 *   depth    - crawl depth used
 *   pages    - pages saved
 *   seconds  - how long it took
 *   sizeKB   - ZIP size
 *   result   - "complete" or "failed"
 *
 * The popup shows this same list under "What's recorded".
 */

import { state } from './state.js';

export const USAGE_LOG_KEY = "downloadLog";
const MAX_ENTRIES = 200;

let startedAt = null;

export function markDownloadStart() {
  startedAt = Date.now();
}

function countSavedPages() {
  try {
    return Object.keys(state.zip?.files || {}).filter((name) =>
      name.endsWith(".html") && !/(^|\/)index\.html$/i.test(name)
    ).length;
  } catch (error) {
    return 0;
  }
}

function siteOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch (error) {
    return "";
  }
}

/**
 * Adds one entry. Never throws: logging must not break a download.
 */
export async function recordDownload(result, sizeBytes) {
  try {
    const entry = {
      savedAt: new Date().toISOString(),
      site: siteOf(state.startingURLInput),
      depth: Number(state.maxDepthValue) || 0,
      pages: countSavedPages(),
      seconds: startedAt ? Math.round((Date.now() - startedAt) / 1000) : null,
      sizeKB: sizeBytes ? Math.round(sizeBytes / 1024) : null,
      result
    };

    const stored = await chrome.storage.local.get(USAGE_LOG_KEY);
    const log = Array.isArray(stored[USAGE_LOG_KEY]) ? stored[USAGE_LOG_KEY] : [];
    log.push(entry);
    await chrome.storage.local.set({ [USAGE_LOG_KEY]: log.slice(-MAX_ENTRIES) });
  } catch (error) {
    console.warn("Could not record the download in the usage log:", error);
  } finally {
    startedAt = null;
  }
}
