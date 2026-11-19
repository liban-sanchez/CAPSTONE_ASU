/**
 * UI & WINDOW MANAGEMENT
 *
 * Controls:
 * - progress bar
 * - status text
 * - video fallback UI
 * - fixed window size
 */

import { state, resetAssetState } from './state.js';

const progressChannel = new BroadcastChannel("scraper_progress");

export const feedbackFormSection =
  document.getElementById("feedback-form-section");

export const progressBar =
  document.getElementById("progress-bar");

export const currentProgress =
  document.getElementById("current-progress");

export const statusMessage =
  document.getElementById("status-message");


// ============================================================
// VIDEO FALLBACK ELEMENTS
// ============================================================

export const videoFallbackSection =
  document.getElementById("video-fallback-section");

export const fallbackVideoInput =
  document.getElementById("fallback-video-input");

export const fallbackVideoName =
  document.getElementById("fallback-video-name");

export const useFallbackVideoButton =
  document.getElementById("use-fallback-video-button");

export const continueWithoutVideoButton =
  document.getElementById("continue-without-video-button");


// ============================================================
// WINDOW SIZE
// ============================================================

const FIXED_WINDOW_WIDTH = 360;

/*
 * Slightly taller because the video fallback
 * needs room when it appears.
 */
const NORMAL_WINDOW_HEIGHT = 450;

const VIDEO_FALLBACK_WINDOW_HEIGHT = 650;


// ============================================================
// INITIAL STATE
// ============================================================

if (feedbackFormSection) {
  feedbackFormSection.style.display = "none";
}

if (videoFallbackSection) {
  videoFallbackSection.style.display = "none";
}


// ============================================================
// PROGRESS
// ============================================================

// ============================================================
// DOWNLOAD TIME ESTIMATOR
// ============================================================

const estimatedTimeRemaining =
  document.getElementById("estimated-time-remaining");

let downloadStartTime = null;
let lastProgressTime = null;
let lastProgressFraction = 0;
let smoothedProgressRate = null;
let pauseStartTime = null;
let totalPausedMs = 0;

/*
 * Everything the popup shows about a running download is also saved
 * here, so a popup opened mid-crawl (or after it) shows the same thing.
 * The popup picks a running download back up when reopened. Once a
 * download has finished (finishedAt is set) and the popup has shown
 * that, the next popup starts fresh; see js/modules/popup/progress.js.
 */
let progressSnapshot = {
  startedAt: Date.now(),
  isRunning: true,
  percentage: 0
};

function saveProgressSnapshot(patch) {
  progressSnapshot = {
    ...progressSnapshot,
    ...patch,
    page: state.startingURLInput || "",
    updatedAt: Date.now()
  };

  try {
    chrome.storage.local.set({ lastProgress: progressSnapshot });
  } catch (error) {
    // Progress display only; never break the crawl over it.
  }
}

/**
 * Shows the time estimate in this tab and in the popup.
 */
export function setEta(text) {
  if (estimatedTimeRemaining) {
    estimatedTimeRemaining.innerText = text;
  }

  progressChannel.postMessage({ eta: text });
  saveProgressSnapshot({ eta: text });
}

export function startDownloadTimer() {
  downloadStartTime = performance.now();
  lastProgressTime = null;
  lastProgressFraction = 0;
  smoothedProgressRate = null;
  pauseStartTime = null;
  totalPausedMs = 0;
  setEta("Calculating time left...");
}

export function finishDownloadTimer() {
  downloadStartTime = null;
  lastProgressTime = null;
  smoothedProgressRate = null;
  pauseStartTime = null;
  totalPausedMs = 0;
  setEta("");
}

export function formatRemainingTime(seconds) {
  const totalSeconds = Math.max(
    0,
    Math.ceil(seconds)
  );
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}

export function updateProgress(currentCount, totalCount) {
  if (totalCount <= 0) {
    return;
  }

  const fraction = Math.max(
    0,
    Math.min(currentCount / totalCount, 1)
  );

  const percentage = Math.ceil(fraction * 100);

  progressChannel.postMessage({ percentage });
  saveProgressSnapshot({ percentage, isRunning: true });

  const progressPercentage = `${percentage}%`;

  if (currentProgress) {
    currentProgress.innerText = progressPercentage;
    currentProgress.style.display = "inline";
  }

  if (progressBar) {
    progressBar.style.display = "flex";
    progressBar.style.width = progressPercentage;
  }

  // If paused, keep ETA as "Paused" and do not recalculate rates
  if (state.isPaused) {
    return;
  }

  // Calculate estimated time remaining.
  if (downloadStartTime === null) {
    startDownloadTimer();
  }

  if (fraction >= 1) {
    setEta("Finishing the ZIP...");
    return;
  }

  const now = performance.now();
  const elapsedSeconds =
    Math.max(0.1, ((now - downloadStartTime) - totalPausedMs) / 1000);

  // Wait for enough progress before estimating.
  if (elapsedSeconds < 3 || fraction < 0.05) {
    setEta("Calculating time left...");
    return;
  }

  if (
    lastProgressTime !== null &&
    fraction > lastProgressFraction
  ) {
    const timeDifference =
      (now - lastProgressTime) / 1000;
    const progressDifference =
      fraction - lastProgressFraction;

    if (timeDifference > 0) {
      const currentRate =
        progressDifference / timeDifference;
      smoothedProgressRate =
        smoothedProgressRate === null
          ? currentRate
          : (0.3 * currentRate) +
            (0.7 * smoothedProgressRate);
    }
  }

  // Use average progress rate until enough
  // samples are available.
  const averageRate = fraction / elapsedSeconds;
  const rate =
    smoothedProgressRate ?? averageRate;

  if (rate <= 0) {
    setEta("Calculating time left...");
    return;
  }

  const remainingSeconds =
    (1 - fraction) / rate;

  setEta(`About ${formatRemainingTime(remainingSeconds)} left`);

  lastProgressTime = now;
  lastProgressFraction = fraction;
}

// ============================================================
// STATUS
// ============================================================

export function updateStatus(message) {

  const finished = /complete|failed|stopped|cancelled/i.test(message);

  // Save first, so finishedAt is stored before the popup hears about it.
  saveProgressSnapshot({
    message,
    isRunning: !finished,
    finishedAt: finished
      ? (progressSnapshot.finishedAt || Date.now())
      : null
  });

  progressChannel.postMessage({ message, finished });

  if (statusMessage) {
    statusMessage.innerText = message;
  }
}


// ============================================================
// VIDEO FALLBACK
// ============================================================

/**
 * Ask the user whether they want to:
 *
 * 1. provide a replacement video
 *
 * OR
 *
 * 2. continue without video
 *
 * Returns:
 *
 * File
 *
 * OR
 *
 * null
 */
export function requestFallbackVideo() {

  return new Promise((resolve) => {

    if (
      !videoFallbackSection ||
      !fallbackVideoInput ||
      !useFallbackVideoButton ||
      !continueWithoutVideoButton
    ) {

      console.warn(
        "Video fallback UI is unavailable."
      );

      resolve(null);

      return;
    }


    let selectedFile =
      null;


    // --------------------------------------------------------
    // RESET UI
    // --------------------------------------------------------

    videoFallbackSection.style.display =
      "block";


    fallbackVideoInput.value =
      "";


    useFallbackVideoButton.disabled =
      true;


    if (fallbackVideoName) {

      fallbackVideoName.innerText =
        "No replacement video selected.";
    }


    updateStatus(
      "Website video could not be downloaded. Choose a replacement video or continue without it."
    );


    // Give the fallback controls more room.
    try {

      window.resizeTo(
        FIXED_WINDOW_WIDTH,
        VIDEO_FALLBACK_WINDOW_HEIGHT
      );

    } catch (error) {

      console.warn(
        "Unable to resize popup for video fallback:",
        error
      );
    }


    // --------------------------------------------------------
    // FILE SELECTION
    // --------------------------------------------------------

    const handleFileChange =
      () => {

        const files =
          fallbackVideoInput.files;


        if (
          !files ||
          files.length === 0
        ) {

          selectedFile =
            null;


          useFallbackVideoButton.disabled =
            true;


          if (fallbackVideoName) {

            fallbackVideoName.innerText =
              "No replacement video selected.";
          }


          return;
        }


        selectedFile =
          files[0];


        useFallbackVideoButton.disabled =
          false;


        if (fallbackVideoName) {

          const sizeMb =
            (
              selectedFile.size /
              1024 /
              1024
            ).toFixed(2);


          fallbackVideoName.innerText =
            `${selectedFile.name} (${sizeMb} MB)`;
        }
      };


    // --------------------------------------------------------
    // CLEANUP
    // --------------------------------------------------------

    const cleanup =
      () => {

        fallbackVideoInput.removeEventListener(
          "change",
          handleFileChange
        );


        useFallbackVideoButton.removeEventListener(
          "click",
          handleUseVideo
        );


        continueWithoutVideoButton.removeEventListener(
          "click",
          handleContinue
        );


        videoFallbackSection.style.display =
          "none";


        try {

          window.resizeTo(
            FIXED_WINDOW_WIDTH,
            NORMAL_WINDOW_HEIGHT
          );

        } catch (error) {

          console.warn(
            "Unable to restore popup size:",
            error
          );
        }
      };


    // --------------------------------------------------------
    // USE VIDEO
    // --------------------------------------------------------

    const handleUseVideo =
      () => {

        if (!selectedFile) {
          return;
        }


        cleanup();


        resolve(
          selectedFile
        );
      };


    // --------------------------------------------------------
    // CONTINUE WITHOUT VIDEO
    // --------------------------------------------------------

    const handleContinue =
      () => {

        cleanup();


        resolve(
          null
        );
      };


    // --------------------------------------------------------
    // LISTENERS
    // --------------------------------------------------------

    fallbackVideoInput.addEventListener(
      "change",
      handleFileChange
    );


    useFallbackVideoButton.addEventListener(
      "click",
      handleUseVideo
    );


    continueWithoutVideoButton.addEventListener(
      "click",
      handleContinue
    );

  });
}


// ============================================================
// WINDOW MANAGEMENT
// ============================================================

export function enforceWindowSize() {
  /*
   * Only resize if this is running in a popup/standalone window.
   * If running in a regular browser tab with menubar/tabbar, do not
   * resize the user's entire browser window so multitasking is not disrupted.
   */
  if (window.menubar && window.menubar.visible) {
    return;
  }

  /*
   * Don't shrink the window while the
   * fallback UI is visible.
   */
  const fallbackVisible =
    videoFallbackSection &&
    videoFallbackSection.style.display !==
      "none";


  const targetHeight =
    fallbackVisible
      ? VIDEO_FALLBACK_WINDOW_HEIGHT
      : NORMAL_WINDOW_HEIGHT;


  try {

    window.resizeTo(
      FIXED_WINDOW_WIDTH,
      targetHeight
    );

  } catch (error) {

    console.warn(
      "Unable to resize popup window:",
      error
    );
  }
}

// ============================================================
// CRAWLER CONTROLS: PAUSE / RESUME, STOP, CANCEL
// ============================================================

/**
 * Checks if crawling is paused or cancelled.
 * If paused, blocks and awaits resume.
 * If stopped or cancelled, throws corresponding error to abort.
 */
export async function checkPauseOrAbort() {
  if (state.isCancelled) {
    throw new Error("SCRAPING_CANCELLED");
  }

  if (state.isStopped) {
    throw new Error("SCRAPING_STOPPED");
  }

  if (state.isPaused) {
    await new Promise((resolve) => {
      state.resumeResolve = resolve;
    });
  }

  if (state.isCancelled) {
    throw new Error("SCRAPING_CANCELLED");
  }

  if (state.isStopped) {
    throw new Error("SCRAPING_STOPPED");
  }
}

export function disableControls() {
  const pauseBtn = document.getElementById("pause-resume-button");
  const stopBtn = document.getElementById("stop-button");
  const cancelBtn = document.getElementById("cancel-button");

  if (pauseBtn) pauseBtn.disabled = true;
  if (stopBtn) stopBtn.disabled = true;
  if (cancelBtn) cancelBtn.disabled = true;
}

export function togglePauseResume() {
  if (state.isCancelled || state.scrapingDone || state.isStopped) return;

  const pauseBtn = document.getElementById("pause-resume-button");
  const pauseText = document.getElementById("pause-resume-text");
  const pauseIcon = document.getElementById("pause-resume-icon");

  if (!state.isPaused) {
    // PAUSE
    state.isPaused = true;
    if (pauseStartTime === null) {
      pauseStartTime = performance.now();
    }

    if (pauseText) pauseText.textContent = "Resume";
    if (pauseIcon) pauseIcon.textContent = "▶";
    if (pauseBtn) {
      pauseBtn.classList.remove("btn-outline-primary");
      pauseBtn.classList.add("btn-primary");
    }

    if (progressBar) {
      progressBar.classList.remove("progress-bar-animated");
    }

    state.statusBeforePause = statusMessage ? statusMessage.innerText : "";
    updateStatus("Download paused. Click Resume to continue.");
    setEta("Paused");
  } else {
    // RESUME
    state.isPaused = false;
    if (pauseStartTime !== null) {
      totalPausedMs += (performance.now() - pauseStartTime);
      pauseStartTime = null;
    }

    if (pauseText) pauseText.textContent = "Pause";
    if (pauseIcon) pauseIcon.textContent = "❚❚";
    if (pauseBtn) {
      pauseBtn.classList.remove("btn-primary");
      pauseBtn.classList.add("btn-outline-primary");
    }

    if (progressBar) {
      progressBar.classList.add("progress-bar-animated");
    }

    updateStatus(state.statusBeforePause || "Foreground crawl is running.");
    setEta("Calculating time left...");

    if (typeof state.resumeResolve === "function") {
      const resolve = state.resumeResolve;
      state.resumeResolve = null;
      resolve();
    }
  }
}

export function handleStopDownload() {
  if (state.isCancelled || state.scrapingDone || state.isStopped) return;

  state.isStopped = true;

  // If paused, unpause immediately to allow loop to proceed directly to ZIP packaging
  if (state.isPaused) {
    state.isPaused = false;
    if (typeof state.resumeResolve === "function") {
      const resolve = state.resumeResolve;
      state.resumeResolve = null;
      resolve();
    }
  }

  disableControls();
  updateStatus("Stopping crawl. Packaging pages collected so far into ZIP...");
  setEta("Finishing the ZIP...");
}

export async function handleCancelDownload() {
  if (state.isCancelled || state.scrapingDone) return;

  const confirmed = window.confirm("Are you sure you want to cancel the download? All progress will be discarded.");
  if (!confirmed) return;

  state.isCancelled = true;

  // If paused, unpause immediately so any waiting promise unblocks and aborts
  if (state.isPaused) {
    state.isPaused = false;
    if (typeof state.resumeResolve === "function") {
      const resolve = state.resumeResolve;
      state.resumeResolve = null;
      resolve();
    }
  }

  disableControls();

  updateStatus("Download cancelled. No files were saved.");
  setEta("");

  if (progressBar) {
    progressBar.style.width = "0%";
    progressBar.classList.remove("progress-bar-animated");
  }
  if (currentProgress) {
    currentProgress.innerText = "Cancelled";
  }

  // Close created background tabs if any
  try {
    const { closeCreatedTabs } = await import('./crawler.js');
    await closeCreatedTabs();
  } catch (_) {}

  // Reset asset/zip state and download flag
  resetAssetState();
  try {
    chrome.storage.sync.set({ downloadFlag: false });
  } catch (_) {}
  finishDownloadTimer();
}

export function initCrawlerControls() {
  const pauseBtn = document.getElementById("pause-resume-button");
  const stopBtn = document.getElementById("stop-button");
  const cancelBtn = document.getElementById("cancel-button");

  if (pauseBtn && !pauseBtn.dataset.bound) {
    pauseBtn.dataset.bound = "true";
    pauseBtn.addEventListener("click", togglePauseResume);
  }
  if (stopBtn && !stopBtn.dataset.bound) {
    stopBtn.dataset.bound = "true";
    stopBtn.addEventListener("click", handleStopDownload);
  }
  if (cancelBtn && !cancelBtn.dataset.bound) {
    cancelBtn.dataset.bound = "true";
    cancelBtn.addEventListener("click", handleCancelDownload);
  }
}

// Auto-initialize controls on DOM ready
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCrawlerControls);
  } else {
    initCrawlerControls();
  }
}
