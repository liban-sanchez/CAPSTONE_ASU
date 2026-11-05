/**
 * PROGRESS UI
 * The green ring around the Download button is the progress bar.
 *
 * - While a download runs, the ring fills from 0 to 100%. Closing and
 *   reopening the popup picks the ring back up where the download is, and
 *   it keeps updating live.
 * - When the download finishes, the popup shows it as done (full ring).
 *   Once the popup has shown that and is closed, the next time it opens
 *   the ring is reset to a fresh Download button.
 * - A download that finished while the popup was closed is shown as done
 *   once, then reset the same way.
 *
 * The download tab saves its progress in chrome.storage.local
 * ("lastProgress", see js/modules/window/ui.js). "progressSeenAt" records
 * when the popup last showed a finished download.
 */

const SEEN_KEY = "progressSeenAt";
const RING_LENGTH = 2 * Math.PI * 55; // circumference, r = 55

export function initProgressUI() {
  const progressChannel = new BroadcastChannel("scraper_progress");
  const progressRing = document.getElementById("progress-ring");
  const popupProgressText = document.getElementById("current-progress");
  const popupStatus = document.getElementById("popup-status");
  const popupEta = document.getElementById("popup-eta");
  const progressSection = document.getElementById("progress-section");
  const submitButton = document.getElementById("submit-button");
  const buttonTitle = document.getElementById("button-title");
  const timeEstimate = document.getElementById("time-estimate");

  function setRing(percentage) {
    const value = Math.max(0, Math.min(100, Number(percentage) || 0));
    if (progressRing) {
      progressRing.style.strokeDasharray = String(RING_LENGTH);
      progressRing.style.strokeDashoffset = String(RING_LENGTH - (RING_LENGTH * value / 100));
    }
    if (popupProgressText) popupProgressText.innerText = value + "%";
    return value;
  }

  function showProgressSection() {
    if (progressSection) progressSection.style.display = "block";
    // While a download runs, the live time left replaces the estimate.
    if (timeEstimate) timeEstimate.style.display = "none";
  }

  function updatePopupProgress(percentage) {
    showProgressSection();
    setRing(percentage);
    if (submitButton) {
      submitButton.classList.add("gb-dial-active");
      submitButton.classList.remove("gb-dial-done");
    }
  }

  function updatePopupEta(text) {
    if (!popupEta) return;
    popupEta.textContent = text || "";
    popupEta.style.display = text ? "block" : "none";
  }

  /** The popup has now shown this finished download. */
  function markFinishedSeen() {
    try {
      chrome.storage.local.set({ [SEEN_KEY]: Date.now() });
    } catch (error) {}
  }

  function showFinished(message) {
    showProgressSection();
    if (popupStatus) popupStatus.innerText = message;
    updatePopupEta("");
    if (/complete/i.test(message)) setRing(100);
    if (submitButton) submitButton.classList.add("gb-dial-active", "gb-dial-done");
    if (buttonTitle) buttonTitle.innerText = "Download";
    markFinishedSeen();
  }

  function updatePopupStatus(message) {
    showProgressSection();
    if (popupStatus) popupStatus.innerText = message;
    if (/complete|failed|stopped/i.test(message)) showFinished(message);
  }

  /** Back to a fresh Download button, and forget the old run. */
  function resetProgressUI() {
    setRing(0);
    updatePopupEta("");
    if (popupStatus) popupStatus.innerText = "Waiting to start";
    if (progressSection) progressSection.style.display = "none";
    if (submitButton) submitButton.classList.remove("gb-dial-active", "gb-dial-done");
    if (buttonTitle) buttonTitle.innerText = "Download";
    try {
      chrome.storage.local.remove(["lastProgress", SEEN_KEY]);
    } catch (error) {}
  }

  /**
   * Called when the popup opens. workerOpen: the download tab still exists.
   */
  function restoreLastProgress(currentPage, workerOpen) {
    chrome.storage.local.get(["lastProgress", SEEN_KEY], (items) => {
      const last = items.lastProgress;
      const seenAt = Number(items[SEEN_KEY]) || 0;
      if (!last) return;

      // Still downloading: pick the ring back up and keep listening.
      if (last.isRunning && workerOpen) {
        updatePopupProgress(last.percentage);
        if (popupStatus) popupStatus.innerText = last.message || "Downloading...";
        updatePopupEta(last.eta);
        return;
      }

      // Says running, but the download tab is gone: it never finished.
      if (last.isRunning && !workerOpen) {
        if (seenAt >= (last.updatedAt || 0)) {
          resetProgressUI();
        } else {
          updatePopupProgress(last.percentage);
          showFinished("The last download stopped before it finished. Press Download to try again.");
        }
        return;
      }

      // Finished: show it once if the popup hasn't yet, otherwise reset.
      const finishedAt = Number(last.finishedAt) || Number(last.updatedAt) || 0;
      if (seenAt && seenAt >= finishedAt) {
        resetProgressUI();
      } else {
        updatePopupProgress(last.percentage);
        showFinished(last.message || "Download complete.");
      }
    });
  }

  /** A new download starts: forget the previous run. */
  function startNewRun() {
    try {
      chrome.storage.local.remove(SEEN_KEY);
      chrome.storage.local.set({
        lastProgress: {
          startedAt: Date.now(),
          updatedAt: Date.now(),
          isRunning: true,
          percentage: 0,
          message: "Starting...",
          page: currentPageForRun || ""
        }
      });
    } catch (error) {}
    updatePopupProgress(0);
  }

  let currentPageForRun = "";
  function setRunPage(page) { currentPageForRun = page || ""; }

  progressChannel.addEventListener("message", (event) => {
    const update = event.data;
    if (!update) return;
    if (typeof update.percentage === "number") updatePopupProgress(update.percentage);
    if (update.message) updatePopupStatus(update.message);
    if (typeof update.eta === "string") updatePopupEta(update.eta);
  });

  return { updatePopupStatus, updatePopupProgress, restoreLastProgress, startNewRun, setRunPage, resetProgressUI };
}
