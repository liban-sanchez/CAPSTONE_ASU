/**
 * USAGE SUMMARY
 * Shows how many sites were saved on this computer, explains exactly what
 * the usage log records, and lets the user clear it. The log itself is
 * written by js/modules/window/usage-log.js and never leaves the computer.
 */

const USAGE_LOG_KEY = "downloadLog";

export async function renderUsageSummary() {
  const summary = document.getElementById("usage-summary");
  if (!summary) return;

  let log = [];
  try {
    const stored = await chrome.storage.local.get(USAGE_LOG_KEY);
    log = Array.isArray(stored[USAGE_LOG_KEY]) ? stored[USAGE_LOG_KEY] : [];
  } catch (error) {}

  const done = log.filter((e) => e && e.result === "complete");
  const sites = new Set(done.map((e) => e.site).filter(Boolean));

  if (done.length === 0) {
    summary.textContent = "No downloads yet";
  } else {
    const downloads = done.length === 1 ? "1 download" : `${done.length} downloads`;
    const siteText = sites.size === 1 ? "1 site" : `${sites.size} sites`;
    summary.textContent = `${downloads} from ${siteText} so far`;
  }
}

export function initUsageSummary() {
  const clearButton = document.getElementById("usage-clear");
  if (clearButton) {
    clearButton.addEventListener("click", async () => {
      try {
        await chrome.storage.local.remove(USAGE_LOG_KEY);
      } catch (error) {}
      renderUsageSummary();
    });
  }
  renderUsageSummary();
}
