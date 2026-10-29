/**
 * PROGRESS UI
 * Translates BroadcastChannel progress events to circular ring UI and text.
 */

export function initProgressUI() {
  const progressChannel = new BroadcastChannel("scraper_progress");
  const progressRing = document.getElementById("progress-ring");
  const popupProgressText = document.getElementById("current-progress");
  const popupStatus = document.getElementById("popup-status");
  const progressSection = document.getElementById("progress-section");
  const submitButton = document.getElementById("submit-button");
  const buttonTitle = document.getElementById("button-title");
  
  const RING_LENGTH = 2 * Math.PI * 55; // Circumference (r=55)

  function showProgressSection() {
    if (progressSection) progressSection.style.display = "block";
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

  function updatePopupStatus(message) {
    showProgressSection();
    if (popupStatus) popupStatus.innerText = message;
    
    if (submitButton && /complete|failed/i.test(message)) {
      submitButton.classList.add("gb-dial-done");
      if (buttonTitle) buttonTitle.innerText = "Download This Page";
    }
  }

  chrome.storage.local.get("lastProgress", (items) => {
    const last = items.lastProgress;
    if (!last) return;
    updatePopupProgress(last.percentage);
    updatePopupStatus(last.message || "Waiting to start");
    if (last.isRunning && buttonTitle) buttonTitle.innerText = "Foreground Crawl Running...";
  });

  progressChannel.addEventListener("message", (event) => {
    const update = event.data;
    if (!update) return;
    if (typeof update.percentage === "number") updatePopupProgress(update.percentage);
    if (update.message) updatePopupStatus(update.message);
  });

  return { updatePopupStatus, updatePopupProgress };
}