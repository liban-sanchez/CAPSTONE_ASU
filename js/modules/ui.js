/**
 * UI & WINDOW MANAGEMENT
 * Controls the progress bar, status text updates, and enforces the fixed window size.
 */

export const feedbackFormSection = document.getElementById("feedback-form-section");
export const progressBar = document.getElementById("progress-bar");
export const currentProgress = document.getElementById("current-progress");
export const statusMessage = document.getElementById("status-message");

/**
 * The popup shows the same progress, so every update is
 * broadcast to it and stored for the next time it opens.
 */
const progressChannel = new BroadcastChannel("scraper_progress");

let lastPercentage = 0;

function reportProgress(percentage, message, isRunning) {
  const update = {
    percentage: percentage,
    message: message,
    isRunning: isRunning
  };

  progressChannel.postMessage(update);

  try {
    chrome.storage.local.set({ lastProgress: update });
  } catch (error) {
    console.warn("Could not store progress:", error);
  }
}

if (feedbackFormSection) {
  feedbackFormSection.style.display = "none";
}

/**
 * Calculates the completion percentage and animates the progress bar.
 */

export function updateProgress(currentCount, totalCount) {
  if (totalCount === 0) return;
  
  let percentage = Math.ceil((currentCount / totalCount) * 100);
  if (percentage > 100) percentage = 100;
  
  const progressPercentage = percentage + "%";

  if (currentProgress) {
    currentProgress.innerText = progressPercentage;
    currentProgress.style.display = "inline";
  }
  if (progressBar) {
    progressBar.style.display = "flex";
    progressBar.style.width = progressPercentage;
  }

  lastPercentage = percentage;
  reportProgress(percentage, statusMessage ? statusMessage.innerText : "", true);
}

/**
 * Updates the status text beneath the progress bar.
 */

export function updateStatus(message) {
  if (statusMessage) {
    statusMessage.innerText = message;
  }

  const isDone = /complete|failed/i.test(message);
  reportProgress(isDone ? 100 : lastPercentage, message, !isDone);

  if (isDone) {
    finishPageState(/failed/i.test(message));
  }
}

/**
 * Switches the crawl tab out of its "in progress" look
 * once the download is finished or has failed.
 */

function finishPageState(hasFailed) {
  const title = document.querySelector(".gb-worker-title");
  if (title) {
    title.innerText = hasFailed ? "Download failed" : "Offline copy ready";
  }

  const hint = document.querySelector(".gb-worker-hint");
  if (hint) {
    hint.style.display = "none";
  }

  if (progressBar) {
    progressBar.classList.remove("progress-bar-animated", "progress-bar-striped");
  }
}
