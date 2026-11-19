/**
 * CRAWLER
 * Manages Chrome tab navigation, waits for pages to load, and extracts live HTML and valid links from the active tab.
 */

import { state } from './state.js';

/**
 * Retrieves the browser tab we are crawling.
 * If the user closed or navigated the original tab while multitasking,
 * this seamlessly creates a new background tab so the crawl never crashes.
 */
export async function getSourceTab() {
  if (state.sourceTabId !== null && state.sourceTabId !== undefined) {
    try {
      const tab = await chrome.tabs.get(state.sourceTabId);
      if (tab) {
        try {
          await chrome.tabs.update(tab.id, { autoDiscardable: false });
        } catch (_) {}
        return tab;
      }
    } catch (error) {
      console.warn("Source tab was closed or unavailable, creating a background tab:", error);
    }
  }

  // Fallback: Create a silent background tab without stealing user focus
  const newTab = await chrome.tabs.create({ url: "about:blank", active: false });
  state.sourceTabId = newTab.id;
  state.createdTabId = newTab.id;
  try {
    await chrome.tabs.update(newTab.id, { autoDiscardable: false });
  } catch (_) {}
  return newTab;
}

/**
 * Closes background tabs created by the crawler when cancelled.
 */
export async function closeCreatedTabs() {
  if (state.createdTabId) {
    try {
      await chrome.tabs.remove(state.createdTabId);
    } catch (_) {}
    state.createdTabId = null;
  }
}

/**
 * Listens for Chrome tab updates and resolves when the page finishes loading.
 * Also immediately detects if the user closes the tab so it doesn't hang.
 */
export function waitForTabLoad(tabId, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let timeoutId;
    
    function updateListener(updatedTabId, changeInfo, tab) {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        cleanup();
        resolve(tab);
      }
    }

    function removeListener(closedTabId) {
      if (closedTabId === tabId) {
        cleanup();
        reject(new Error(`Tab ${tabId} was closed while loading.`));
      }
    }

    function cleanup() {
      chrome.tabs.onUpdated.removeListener(updateListener);
      chrome.tabs.onRemoved.removeListener(removeListener);
      clearTimeout(timeoutId);
    }
    
    chrome.tabs.onUpdated.addListener(updateListener);
    chrome.tabs.onRemoved.addListener(removeListener);

    // Fallback: If the page takes too long or background throttling delays events, force scrape.
    timeoutId = setTimeout(() => {
      cleanup();
      console.warn(`Tab load timed out after ${timeoutMs}ms. Forcing scrape.`);
      chrome.tabs.get(tabId, (tab) => resolve(tab));
    }, timeoutMs);
  });
}

/**
 * Navigates the target tab to a new URL and waits for it to render.
 */
export async function navigateSourceTab(url) {
  const sourceTab = await getSourceTab();

  // If already at the target URL and complete, no need to navigate/reload
  if (sourceTab.url === url && sourceTab.status === "complete") {
    return sourceTab.id;
  }

  // Attach the listener before triggering navigation to avoid race conditions
  const loadPromise = waitForTabLoad(sourceTab.id);
  await chrome.tabs.update(sourceTab.id, { url: url });
  await loadPromise;
  return sourceTab.id;
}

/**
 * Injects a script to extract the fully rendered DOM from the active tab.
 * Includes a zero-overhead automatic retry for interrupted or closed tabs.
 */
export async function getForegroundPageHtml(url, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const tabId = await navigateSourceTab(url);
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => document.documentElement ? document.documentElement.outerHTML : ""
      });
      const html = (results && results[0] && results[0].result) ? results[0].result : "";

      // Success path: return immediately without any delay
      if (html && html.trim().length > 100) {
        return html;
      }
      console.warn(`Attempt ${attempt} for ${url} returned incomplete HTML, retrying...`);
    } catch (error) {
      console.warn(`Attempt ${attempt} for ${url} was interrupted:`, error);
      // Reset sourceTabId so a fresh tab is spun up on retry
      state.sourceTabId = null;
    }

    if (attempt < maxRetries) {
      await new Promise((res) => setTimeout(res, 400));
    }
  }

  return "";
}

/**
 * Injects a script to extract and normalize all valid anchor links from the page.
 * Includes a zero-overhead automatic retry for interrupted or closed tabs.
 */
export async function getForegroundLinks(url, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const tabId = await navigateSourceTab(url);
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        args: [Boolean(state.isRestrictDomain), String(state.currentPage || "")],
        func: (restrictDomain, rootPage) => {
          const links = [];
          for (const anchor of document.querySelectorAll("a[href]")) {
            const href = anchor.getAttribute("href");
            const absolute = anchor.href;
            
            if (!href || !absolute) continue;
            if (href.startsWith("#")) continue;
            if (absolute.startsWith("mailto:")) continue;
            if (absolute.startsWith("tel:")) continue;
            if (absolute.startsWith("javascript:")) continue;
            if (absolute.startsWith("about:")) continue;
            if (!absolute.startsWith("http://") && !absolute.startsWith("https://")) continue;

            if (restrictDomain) {
              try {
                const startHost = new URL(rootPage).hostname;
                const linkHost = new URL(absolute).hostname;
                if (startHost !== linkHost) continue;
              } catch (e) {
                continue;
              }
            }

            if (!links.includes(absolute)) {
              links.push(absolute);
            }
          }
          return links;
        }
      });

      if (results && results[0] && Array.isArray(results[0].result)) {
        return new Set(results[0].result);
      }
    } catch (error) {
      console.warn(`Attempt ${attempt} to scan links for ${url} was interrupted:`, error);
      state.sourceTabId = null;
    }

    if (attempt < maxRetries) {
      await new Promise((res) => setTimeout(res, 400));
    }
  }

  return new Set();
}