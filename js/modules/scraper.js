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
  const savedPagesMap = new Map();

  // DEPTH 0
  if (state.maxDepthValue == 0) {
    updateStatus("Saving current page...");
    
    // Map the single page
    savedPagesMap.set(state.currentPage, getTitle(state.currentPage) + ".html");
    
    const html = await processHTML(state.currentPage);
    state.zip.file(getTitle(state.currentPage) + ".html", html);
    updateProgress(1, 1);
  }

  // DEPTH 1
  else if (state.maxDepthValue == 1) {
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

    // Map all URLs to their local file paths
    savedPagesMap.set(state.currentPage, getTitle(state.currentPage) + ".html");
    for (let url of urls) {
      savedPagesMap.set(url, "html/" + getTitle(url) + ".html");
    }

    let totalPages = urls.size + 1;
    let completedPages = 0;

    // Process Root Page
    let rootHtml = await processHTML(state.currentPage, "", savedPagesMap, true);
    state.zip.file(getTitle(state.currentPage) + ".html", rootHtml);
    completedPages++;
    updateProgress(completedPages, totalPages);

    // Process First-Level Pages
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
  } 
  

  // DEPTH > 1

  else {
    updateStatus("Depth greater than 1 is still experimental in this alpha build.");
    return; // Exit early so we don't build an empty index
  }


  // GENERATE MASTER INDEX.HTML

  updateStatus("Generating master index.html...");
  
  let indexHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Offline Index</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; background: #f7f8fa; color: #222; }
        .card { background: #fff; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border: 1px solid #e9ecef; }
        h1 { margin-top: 0; border-bottom: 2px solid #f0f2f5; padding-bottom: 10px; font-size: 1.5rem;}
        ul { list-style-type: none; padding: 0; }
        li { margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid #f0f2f5; }
        li:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        a { text-decoration: none; color: #0d6efd; font-size: 1.1rem; font-weight: 600; }
        a:hover { text-decoration: underline; }
        .url { font-size: 0.85rem; color: #6c757d; word-break: break-all; margin-top: 4px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Offline Index</h1>
        <p style="color: #6c757d; font-size: 0.9rem; margin-top: -5px; margin-bottom: 20px;">
          Archived on: ${new Date().toLocaleString()}
        </p>
        <ul>
  `;

  for (const [originalUrl, localPath] of savedPagesMap.entries()) {
    const safeTitle = getTitle(originalUrl);
    indexHtml += `
      <li>
        <a href="${localPath}">${safeTitle}</a>
        <div class="url">${originalUrl}</div>
      </li>
    `;
  }

  indexHtml += `
        </ul>
      </div>
    </body>
    </html>
  `;

  state.zip.file("index.html", indexHtml);
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