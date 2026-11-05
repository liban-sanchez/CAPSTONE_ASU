/**
 * DOWNLOAD TIME ESTIMATE
 * Tells the user, before they click Download, roughly how long it will take.
 *
 *   time = pages x seconds per page
 *
 * Pages: 1 at depth 0; at depth 1 the starting page plus its links (the
 * links picked by hand, or every link the page has).
 * Seconds per page: the median of the user's own recent downloads (from the
 * usage log), or 8 seconds until there is any history.
 */

import { state } from './state.js';
import { scanLinks } from './scanner.js';

const USAGE_LOG_KEY = "downloadLog";
const DEFAULT_SECONDS_PER_PAGE = 8;
const ZIP_OVERHEAD_SECONDS = 3;
const HISTORY_SIZE = 20;

let linkCountCache = { key: "", count: null };

export async function secondsPerPage() {
  try {
    const stored = await chrome.storage.local.get(USAGE_LOG_KEY);
    const log = Array.isArray(stored[USAGE_LOG_KEY]) ? stored[USAGE_LOG_KEY] : [];
    const rates = log
      .filter((e) => e && e.result === "complete" && e.pages > 0 && e.seconds > 0)
      .slice(-HISTORY_SIZE)
      .map((e) => e.seconds / e.pages)
      .sort((a, b) => a - b);

    if (rates.length === 0) return { value: DEFAULT_SECONDS_PER_PAGE, fromHistory: 0 };
    const middle = Math.floor(rates.length / 2);
    const median = rates.length % 2 ? rates[middle] : (rates[middle - 1] + rates[middle]) / 2;
    return { value: median, fromHistory: rates.length };
  } catch (error) {
    return { value: DEFAULT_SECONDS_PER_PAGE, fromHistory: 0 };
  }
}

async function countPageLinks() {
  const key = [state.currentPage, state.isRestrictDomain, state.isFocusMode].join("|");
  if (linkCountCache.key === key && linkCountCache.count !== null) return linkCountCache.count;
  if (!state.sourceTabId) return null;

  try {
    const links = await scanLinks(state.sourceTabId, state.isRestrictDomain, state.currentPage, state.isFocusMode);
    linkCountCache = { key, count: links.length };
    return links.length;
  } catch (error) {
    return null;
  }
}

/**
 * { pages, seconds, fromHistory } or null when there is nothing honest to say
 * (depth 2 and up are not crawled yet; links could not be read).
 */
export async function estimateDownload() {
  const depth = Number(state.maxDepthValue) || 0;
  let pages;

  if (depth === 0) {
    pages = 1;
  } else if (depth === 1) {
    if (state.depthOneMode === "manual") {
      pages = 1 + state.selectedManualLinks.length;
    } else {
      const links = await countPageLinks();
      if (links === null) return null;
      pages = 1 + links;
    }
  } else {
    return null;
  }

  const rate = await secondsPerPage();
  return {
    pages,
    seconds: Math.round(pages * rate.value + ZIP_OVERHEAD_SECONDS),
    fromHistory: rate.fromHistory
  };
}

export function describeDuration(seconds) {
  const rounded = Math.max(5, Math.round(seconds / 5) * 5);
  if (rounded < 60) {
    return `about ${rounded} seconds`;
  }
  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? "about 1 minute" : `about ${minutes} minutes`;
}

export function describeEstimate(estimate) {
  if (!estimate) return "";
  const time = describeDuration(estimate.seconds);
  return estimate.pages === 1
    ? `Estimated time: ${time}`
    : `Estimated time: ${time} for ${estimate.pages} pages`;
}
