/**
 * UI & WINDOW MANAGEMENT
 * Controls the progress bar, status text updates, and enforces the fixed window size.
 */

export const feedbackFormSection = document.getElementById("feedback-form-section");
export const progressBar = document.getElementById("progress-bar");
export const currentProgress = document.getElementById("current-progress");
export const statusMessage = document.getElementById("status-message");

const FIXED_WINDOW_WIDTH = 360;
const FIXED_WINDOW_HEIGHT = 450;

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
}

/**
 * Updates the status text beneath the progress bar.
 */

export function updateStatus(message) {
  if (statusMessage) {
    statusMessage.innerText = message;
  }
}

/**
 * Prevents the user from breaking the UI by resizing the popup window.
 */

export function enforceWindowSize() {
  try {
    window.resizeTo(FIXED_WINDOW_WIDTH, FIXED_WINDOW_HEIGHT);
  } catch (error) {
    console.warn("Unable to resize popup window:", error);
  }
}