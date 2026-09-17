/**
 * SCRAPER ORCHESTRATION
 * The main engine that runs the crawl loop across different depths and generates the final ZIP download.
 */

import { state, resetAssetState } from './state.js';
import { updateProgress, updateStatus, feedbackFormSection, currentProgress, progressBar } from './ui.js';
import { getForegroundPageHtml, getForegroundLinks } from './crawler.js';
import { processImages, processPdfs, processCSSAndImages, processJss, rewritePageLinks } from './assets.js';
import { processVideos, addLocalVideosToZip } from './video.js';
import { applyFocusMode, extractLinksFromHtml } from './focus-mode.js';

const setDownloadFlag = (isDownloading) => {
  chrome.storage.sync.set({ downloadFlag: isDownloading });
};

/**
 * Passes a single page's HTML through all asset, video, and focus-mode processors.
 */

async function processHTML(inputUrl, html = "", savedPagesMap = null, isRootPage = false) {
  let htmlData = html === "" ? await getForegroundPageHtml(inputUrl) : html;

  if (state.isFocusMode) {
    try {
      htmlData = await applyFocusMode(htmlData, inputUrl);
    } catch (err) {
      console.error("Focus Mode crashed.. using original HTML.", err);
    }
  }

  htmlData = await processImages(htmlData, inputUrl, isRootPage);
  htmlData = await processPdfs(htmlData, inputUrl);
  htmlData = await processCSSAndImages(htmlData, inputUrl);
  htmlData = await processJss(htmlData, inputUrl);
  htmlData = await processVideos(htmlData, inputUrl, isRootPage);

  if (savedPagesMap) {
    htmlData = rewritePageLinks(htmlData, inputUrl, savedPagesMap, isRootPage);
  }
  return htmlData;
}

/**
 * Handles the crawl depth logic (Depth 0 or Depth 1) and queues pages for processing.
 */

async function processLinks() {
  if (state.maxDepthValue == 0) {
    updateStatus("Saving current page...");
    const html = await processHTML(state.currentPage);
    state.zip.file(getTitle(state.currentPage) + ".html", html);
    updateProgress(1, 1);
    return;
  }

  if (state.maxDepthValue == 1) {
    updateStatus(state.depthOneMode === "manual" 
      ? "Foreground crawl is running. Saving selected linked pages." 
      : "Foreground crawl is running. Saving the starting page and first-level linked pages.");

    let urls;
    if (state.depthOneMode === "manual" && state.selectedManualLinks.length > 0) {
      urls = new Set(state.selectedManualLinks.filter((url) => url && !url.startsWith("javascript:") && !url.startsWith("about:")));
    } else if (state.isFocusMode) {
      updateStatus("Applying Focus Mode to find valid article links...");
      let rawHtml = await getForegroundPageHtml(state.currentPage);
      let focusedHtml = await applyFocusMode(rawHtml, state.currentPage);
      urls = extractLinksFromHtml(focusedHtml, state.currentPage, state.isRestrictDomain);
    } else {
      urls = await getForegroundLinks(state.currentPage);
    }

    const savedPagesMap = new Map();
    savedPagesMap.set(state.currentPage, getTitle(state.currentPage) + ".html");
    for (let url of urls) {
      savedPagesMap.set(url, "html/" + getTitle(url) + ".html");
    }

    let totalPages = urls.size + 1;
    let completedPages = 0;

    let rootHtml = await processHTML(state.currentPage, "", savedPagesMap, true);
    state.zip.file(getTitle(state.currentPage) + ".html", rootHtml);
    completedPages++;
    updateProgress(completedPages, totalPages);

    for (let url of urls) {
      try {
        updateStatus(state.depthOneMode === "manual" ? "Foreground crawl is running. Saving selected linked pages." : "Foreground crawl is running. Saving linked pages...");
        let html = await processHTML(url, "", savedPagesMap, false);
        state.zip.file("html/" + getTitle(url) + ".html", html);
        completedPages++;
        updateProgress(completedPages, totalPages);
        await new Promise((resolve) => requestAnimationFrame(resolve));
      } catch (error) {
        console.error("Failed processing page:", url, error);
      }
    }
    return;
  }
  updateStatus("Depth greater than 1 is still experimental in this alpha build.");
}

/**
 * Orchestrates the entire crawl, local video imports, and final ZIP generation/download.
 */

export async function startScrapingProcess() {
  try {
    if (currentProgress) {
      currentProgress.innerText = "0%";
      currentProgress.style.display = "inline";
    }
    if (progressBar) {
      progressBar.style.display = "flex";
      progressBar.style.width = "0%";
    }
    updateStatus("Foreground crawl is running. Please keep this window open.");

    await processLinks();

    if (state.selectedLocalVideos.length > 0) {
      updateStatus(state.selectedLocalVideos.length === 1 ? "Adding selected local video..." : `Adding ${state.selectedLocalVideos.length} selected local videos...`);
      await addLocalVideosToZip();
    }

    updateStatus("Preparing ZIP download...");
    if (currentProgress) currentProgress.innerText = "100%";
    if (progressBar) progressBar.style.width = "100%";

    const zipName = new URL(state.startingURLInput).hostname;
    const content = await state.zip.generateAsync({ type: "blob" });
    
    updateStatus("Starting download...");
    const urlBlob = URL.createObjectURL(content);

    const downloadId = await chrome.downloads.download({
      url: urlBlob,
      filename: zipName + ".zip",
      saveAs: true
    });

    chrome.downloads.onChanged.addListener(function listener(downloadItem) {
      if (downloadItem.id === downloadId && downloadItem.state && downloadItem.state.current === "complete") {
        chrome.downloads.onChanged.removeListener(listener);
        if (feedbackFormSection) feedbackFormSection.style.display = "block";
        if (currentProgress) currentProgress.innerText = "100%";
        if (progressBar) progressBar.style.width = "100%";
        
        updateStatus("Download complete. Your ZIP should now be in Finder.");
        setDownloadFlag(false);
        URL.revokeObjectURL(urlBlob);
        resetAssetState();
      }
    });
  } catch (error) {
    console.error("Error in scraping/ZIP/download process:", error);
    updateStatus("Download failed. Check the console for details.");
    setDownloadFlag(false);
  }
}