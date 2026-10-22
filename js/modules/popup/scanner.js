/**
 * SCANNER
 * Injects the link discovery script into the active tab for manual Depth 1 selection.
 */

// ============================================================
// LINK SCANNER
// ============================================================
export async function scanLinks(sourceTabId, isRestrictDomain, currentPage, isFocusMode) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: sourceTabId },
      args: [Boolean(isRestrictDomain), String(currentPage || ""), Boolean(isFocusMode)],
      func: (restrictDomain, rootPage, focusMode) => {
        const collected = [];
        const seen = new Set();
        let searchScope = document;

        if (focusMode) {
          searchScope = document.querySelector("article") || document.querySelector("main") ||
            document.querySelector('[role="main"]') || document.querySelector("#mw-content-text") ||
            document.querySelector(".post-content") || document.querySelector(".entry-content") || document;
        }

        for (const anchor of searchScope.querySelectorAll("a[href]")) {
          if (anchor.offsetWidth === 0 || anchor.offsetHeight === 0) continue;
          
          const rawHref = anchor.getAttribute("href");
          const absolute = anchor.href;
          const text = (anchor.textContent || "").trim().replace(/\s+/g, " ");

          if (!rawHref || !absolute) continue;
          if (rawHref.startsWith("#") || absolute.startsWith("mailto:") || absolute.startsWith("tel:")) continue;
          if (absolute.includes("/w/index.php") || absolute.includes("/wiki/Special:") || 
              absolute.includes("/wiki/Wikipedia:") || absolute.includes("/wiki/Help:")) continue;
          if (absolute.startsWith("javascript:") || absolute.startsWith("about:")) continue;
          if (!absolute.startsWith("http://") && !absolute.startsWith("https://")) continue;

          if (restrictDomain) {
            try {
              if (new URL(rootPage).hostname !== new URL(absolute).hostname) continue;
            } catch (e) { continue; }
          }

          if (seen.has(absolute)) continue;
          seen.add(absolute);
          collected.push({ text: text || absolute, url: absolute });
        }
        return collected;
      }
    });

    return (results && results[0] && Array.isArray(results[0].result)) ? results[0].result : [];
  } catch (error) {
    console.error("Error scanning links:", error);
    throw error;
  }
}