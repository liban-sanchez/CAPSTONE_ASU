/**
 * PROGRESS UI
 * Translates BroadcastChannel progress events to the circular ring,
 * the status line and the time left.
 */

const REPLAY_FINISHED_FOR_MS = 30 * 60 * 1000;

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

  const RING_LENGTH = 2 * Math.PI * 55; // Circumference (r=55)

  function showProgressSection() {
    if (progressSection) progressSection.style.display = "block";
    // While a download runs, the live time left replaces the estimate.
    if (timeEstimate) timeEstimate.style.display = "none";
  }

  function updatePopupProgress(percentage) {
    showProgressSection();
    const value = Math.max(0, Math.min(100, Number(percentage) || 0));
    if (progressRing) {
      progressRing.style.strokeDasharray = String(RING_LENGTH);
      progressRing.style.strokeDashoffset = String(RING_LENGTH - (RING_LENGTH * value / 100));
    }
    if (popupProgressText) popupProgressText.innerText = value + "%";
    if (submitButton) submitButton.classList.add("gb-dial-active");
  }

  function updatePopupEta(text) {
    if (!popupEta) return;
    popupEta.textContent = text || "";
    popupEta.style.display = text ? "block" : "none";
  }

  function updatePopupStatus(message) {
    showProgressSection();
    if (popupStatus) popupStatus.innerText = message;

    if (/complete|failed|stopped/i.test(message)) {
      updatePopupEta("");
      if (submitButton) submitButton.classList.add("gb-dial-done");
      if (buttonTitle) buttonTitle.innerText = "Download";
    }
  }

  /**
   * Replays the saved progress, but only while that download is still
   * running, or when it finished recently on this same page. An old run on
   * another site is not shown.
   */
  function restoreLastProgress(currentPage, workerOpen) {
    chrome.storage.local.get("lastProgress", (items) => {
      const last = items.lastProgress;
      if (!last) return;

      const running = Boolean(last.isRunning && workerOpen);
      const recentSamePage =
        !last.isRunning &&
        last.page && last.page === currentPage &&
        Date.now() - (last.updatedAt || 0) < REPLAY_FINISHED_FOR_MS;

      if (!running && !recentSamePage) return;

      updatePopupProgress(last.percentage);
      updatePopupStatus(last.message || "Waiting to start");
      if (running) updatePopupEta(last.eta);
    });
  }

  progressChannel.addEventListener("message", (event) => {
    const update = event.data;
    if (!update) return;
    if (typeof update.percentage === "number") updatePopupProgress(update.percentage);
    if (update.message) updatePopupStatus(update.message);
    if (typeof update.eta === "string") updatePopupEta(update.eta);
  });

  return { updatePopupStatus, updatePopupProgress, restoreLastProgress };
}
