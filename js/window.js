let startingURLInput = "";
let currentPage = "";
let sourceTabId = null;
let isExcludeImages = false;
let isFocusMode = false;
let isRestrictDomain = false;
let maxDepthValue = 0;

// New depth 1 mode state
let depthOneMode = "all"; // "all" or "manual"
let selectedManualLinks = []; // [url]

let urlList = [];
let urlCSSs = [];
let urlImages = [];
let urlVideos = [];
let urlJSs = [];
let urlPdfs = [];

let scrapingDone = false;

let feedbackFormSection = document.getElementById("feedback-form-section");
feedbackFormSection.style.display = "none";

const progressBar = document.getElementById("progress-bar");
const currentProgress = document.getElementById("current-progress");
const statusMessage = document.getElementById("status-message");
const FIXED_WINDOW_WIDTH = 360;
const FIXED_WINDOW_HEIGHT = 450;


const setDownloadFlag = (isDownloading) => {
  chrome.storage.sync.set({ downloadFlag: isDownloading });
};

const setMaxDepth = (newMaxDepthValue) => {
  maxDepthValue = newMaxDepthValue;
};

const setCurrentPage = (newCurrentPage) => {
  currentPage = newCurrentPage;
};

const broadcastChannel = new BroadcastChannel("scraper_data");

broadcastChannel.addEventListener("message", (event) => {
  [
    startingURLInput,
    isFocusMode,
    isRestrictDomain,
    newMaxDepthValue,
    sourceTabId,
    depthOneMode,
    selectedManualLinks
  ] = event.data;

  // Normalize incoming values so executeScript args stay serializable
  startingURLInput = startingURLInput ?? "";
  isFocusMode = Boolean(isFocusMode);
  isRestrictDomain = Boolean(isRestrictDomain);
  newMaxDepthValue = Number(newMaxDepthValue || 0);
  sourceTabId = sourceTabId ?? null;
  depthOneMode = depthOneMode === "manual" ? "manual" : "all";
  selectedManualLinks = Array.isArray(selectedManualLinks)
    ? selectedManualLinks.map((link) => String(link))
    : [];

  setDownloadFlag(true);
  setMaxDepth(newMaxDepthValue);
  setCurrentPage(startingURLInput);
  startScrapingProcess();
});

let extId = chrome.runtime.id;
let zip = new JSZip();

/**
 * Get the original browser tab we want to crawl.
 */
async function getSourceTab() {
  if (sourceTabId === null || sourceTabId === undefined) {
    throw new Error("Source tab ID is missing.");
  }

  const tab = await chrome.tabs.get(sourceTabId);
  if (!tab) {
    throw new Error("Source tab not found.");
  }

  return tab;
}

/**
 * Wait for a tab to finish loading after navigation.
 */
function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    function listener(updatedTabId, changeInfo, tab) {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(tab);
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

/**
 * Navigate the original source tab, not the progress window.
 */
async function navigateSourceTab(url) {
  const sourceTab = await getSourceTab();
  await chrome.tabs.update(sourceTab.id, { url: url });
  await waitForTabLoad(sourceTab.id);
  return sourceTab.id;
}

/**
 * Read the fully rendered HTML from the source tab.
 */
async function getForegroundPageHtml(url) {
  const tabId = await navigateSourceTab(url);

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => document.documentElement.outerHTML
  });

  return results && results[0] ? results[0].result : "";
}

/**
 * Read all links from the live DOM of the source tab.
 */
async function getForegroundLinks(url) {
  const tabId = await navigateSourceTab(url);

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    args: [Boolean(isRestrictDomain), String(currentPage || "")],
    func: (restrictDomain, rootPage) => {
      const links = [];

      for (const anchor of document.querySelectorAll("a[href]")) {
        const href = anchor.getAttribute("href");
        const absolute = anchor.href;

        if (!href || !absolute) continue;

        // Skip non-page links
        if (href.startsWith("#")) continue;
        if (absolute.startsWith("mailto:")) continue;
        if (absolute.startsWith("tel:")) continue;
        if (absolute.startsWith("javascript:")) continue;
        if (absolute.startsWith("about:")) continue;
        if (!absolute.startsWith("http://") && !absolute.startsWith("https://")) continue;

        if (restrictDomain) {
          try {
            const startHost = new URL(rootPage).hostname;
            const linkHost = new URL(absolute).hostname;
            if (startHost !== linkHost) continue;
          } catch (e) {
            continue;
          }
        }

        if (!links.includes(absolute)) {
          links.push(absolute);
        }
      }

      return links;
    }
  });

  return new Set(results && results[0] ? results[0].result : []);
}

function calculateProgressPercentage(currentCount, totalCount) {
  if (totalCount === 0) {
    return "0%";
  }

  let percentage = Math.ceil((currentCount / totalCount) * 100);
  if (percentage > 100) {
    percentage = 100;
  }

  return percentage.toString() + "%";
}

function updateProgress(currentCount, totalCount) {
  const progressPercentage = calculateProgressPercentage(currentCount, totalCount);
  currentProgress.innerText = progressPercentage;
  currentProgress.style.display = "inline";
  progressBar.style.display = "flex";
  progressBar.style.width = progressPercentage;
}

function updateStatus(message) {
  if (statusMessage) {
    statusMessage.innerText = message;
  }
}

function isSkippableAssetUrl(url) {
  if (!url || typeof url !== "string") return true;

  return (
    url.startsWith("about:") ||
    url.startsWith("javascript:") ||
    url.startsWith("data:") ||
    url.startsWith("mailto:") ||
    url.startsWith("tel:")
  );
}

/**
 * Rewrites normal page anchors to local saved HTML files.
 */
function rewritePageLinks(htmlData, inputUrl, savedPagesMap, isRootPage = false) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlData, "text/html");

  for (const anchor of doc.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href");
    if (!href) continue;
    if (href.startsWith("#")) continue;
    if (href.startsWith("mailto:")) continue;
    if (href.startsWith("tel:")) continue;
    if (href.toLowerCase().endsWith(".pdf")) continue;

    let absoluteUrl;
    try {
      absoluteUrl = new URL(href, inputUrl).href;
    } catch (e) {
      continue;
    }

    if (savedPagesMap && savedPagesMap.has(absoluteUrl)) {
      const localFile = savedPagesMap.get(absoluteUrl);

      if (isRootPage) {
        anchor.setAttribute("href", localFile);
      } else {
        anchor.setAttribute("href", "../" + localFile);
      }
    }
  }

  return doc.documentElement.outerHTML;
}

async function processCSSAndImages(htmlData, inputUrl) {
  const parser = new DOMParser();
  let doc = parser.parseFromString(htmlData, "text/html");

  const linkElements = doc.querySelectorAll('link[rel="stylesheet"]');

  for (let linkElement of linkElements) {
    try {
      let cssHref = linkElement.getAttribute("href");
      if (!cssHref) continue;
      if (isSkippableAssetUrl(cssHref)) continue;

      if (!cssHref.startsWith("https://") && !cssHref.startsWith("http://")) {
        cssHref = getAbsolutePath(cssHref, inputUrl).href;
      }

      if (urlCSSs.includes(cssHref)) continue;
      urlCSSs.push(cssHref);

      const cssData = await getData(cssHref);

      if (cssData !== "Failed" && cssData !== "") {
        const processedCSS = await processCSSImages(cssData, cssHref);
        zip.file("css/" + getTitle(cssHref) + ".css", processedCSS);

        let cssFolderLocation = maxDepthValue === 0 ? "css/" : "../css/";
        linkElement.setAttribute(
          "href",
          cssFolderLocation + getTitle(cssHref) + ".css"
        );
      }
    } catch (error) {
      console.error("CSS processing error:", error);
    }
  }

  const styleElements = doc.querySelectorAll("style");

  for (let styleElement of styleElements) {
    try {
      let styleContent = styleElement.textContent;
      let processedStyleContent = await processCSSImages(styleContent, inputUrl);
      styleElement.textContent = processedStyleContent;
    } catch (error) {
      console.error("Inline CSS processing error:", error);
    }
  }

  return doc.documentElement.outerHTML;
}

async function processCSSImages(cssData, cssUrl) {
  const imageUrlRegex = /url\(["']?([^"')]+)["']?\)/g;
  let downloadPromises = [];

  const updatedCSS = cssData.replace(imageUrlRegex, (match, imageUrl) => {
    let resolvedUrl = imageUrl;

    if (imageUrl.startsWith("//")) {
      resolvedUrl = "https:" + imageUrl;
    } else if (
      !imageUrl.startsWith("https://") &&
      !imageUrl.startsWith("http://")
    ) {
      resolvedUrl = getAbsolutePath(imageUrl, cssUrl).href;
    }

    if (isSkippableAssetUrl(resolvedUrl)) {
      return match;
    }

    if (
      resolvedUrl.endsWith(".woff") ||
      resolvedUrl.endsWith(".woff2") ||
      resolvedUrl.endsWith(".ttf") ||
      resolvedUrl.endsWith(".otf")
    ) {
      return match;
    }

    let imageName = resolvedUrl
      .substring(resolvedUrl.lastIndexOf("/") + 1)
      .replace(/[&\/\\#,+()$~%'":*?<>{}]/g, "");

    if (!urlImages.includes(imageName)) {
      urlImages.push(imageName);

      const promise = urlToPromise(resolvedUrl)
        .then((imageData) => {
          zip.file("img/" + imageName, imageData, { binary: true });
        })
        .catch(() => {
          console.error(`Error fetching image from: ${resolvedUrl}`);
        });

      downloadPromises.push(promise);
    }

    return `url("../img/${imageName}")`;
  });

  await Promise.all(downloadPromises);
  return updatedCSS;
}

async function processPdfs(htmlData, inputUrl) {
  const parser = new DOMParser();
  let doc = parser.parseFromString(htmlData, "text/html");

  const anchorElements = doc.querySelectorAll('a[href$=".pdf"]');

  for (let anchorElement of anchorElements) {
    try {
      let pdfHref = anchorElement.getAttribute("href");
      if (!pdfHref) continue;
      if (isSkippableAssetUrl(pdfHref)) continue;

      if (!pdfHref.startsWith("https://") && !pdfHref.startsWith("http://")) {
        pdfHref = getAbsolutePath(pdfHref, inputUrl).href;
      }

      if (urlPdfs.includes(pdfHref)) continue;
      urlPdfs.push(pdfHref);

      const pdfData = await getData(pdfHref);

      if (pdfData !== "Failed" && pdfData !== "") {
        zip.file("pdf/" + getTitle(pdfHref) + ".pdf", pdfData, {
          binary: true,
        });

        let pdfFolderLocation = maxDepthValue === 0 ? "pdf/" : "../pdf/";
        anchorElement.setAttribute(
          "href",
          pdfFolderLocation + getTitle(pdfHref) + ".pdf"
        );
      }
    } catch (error) {
      console.error("PDF processing error:", error);
    }
  }

  return doc.documentElement.outerHTML;
}

async function processImages(htmlData, inputUrl, isRootPage = false) {
  const parser = new DOMParser();
  let doc = parser.parseFromString(htmlData, "text/html");

  const imgElements = doc.querySelectorAll("img");
  zip.folder("img");

  for (let imgElement of imgElements) {
    try {
      imgElement.removeAttribute("srcset");
      imgElement.removeAttribute("data-srcset");
      imgElement.removeAttribute("sizes");

      let imgSrc = imgElement.getAttribute("src") || imgElement.getAttribute("data-src");
      if (!imgSrc || imgSrc.includes("base64")) continue;

      if (imgSrc.startsWith("//")) {
        imgSrc = "https:" + imgSrc;
      } else if (!imgSrc.startsWith("https://") && !imgSrc.startsWith("http://")) {
        imgSrc = new URL(imgSrc, inputUrl).href;
      }

      let imageName = getSafeFilename(imgSrc, "png");

      if (!urlImages.includes(imageName)) {
        urlImages.push(imageName);
        console.log("⬇Attempting to download:", imgSrc);
        try {
          const imageData = await urlToPromise(imgSrc);
          zip.file("img/" + imageName, imageData, { binary: true });
        } catch (fetchErr) {
          console.error("Download Failed:", imgSrc, fetchErr);
        }
      }

      let imgFolderLocation = (maxDepthValue === 0 || isRootPage) ? "img/" : "../img/";
      imgElement.setAttribute("src", imgFolderLocation + imageName);
      
    } catch (error) {
      console.error("Image loop error:", error);
    }
  }

  return doc.documentElement.outerHTML;
}


async function processJss(htmlData, inputUrl) {
  const parser = new DOMParser();
  let doc = parser.parseFromString(htmlData, "text/html");

  const scriptElements = doc.querySelectorAll("script[src]");

  for (let scriptElement of scriptElements) {
    try {
      let scriptSrc = scriptElement.getAttribute("src");
      if (!scriptSrc) continue;
      if (isSkippableAssetUrl(scriptSrc)) continue;

      if (!scriptSrc.startsWith("https://") && !scriptSrc.startsWith("http://")) {
        scriptSrc = getAbsolutePath(scriptSrc, inputUrl).href;
      }

      if (urlJSs.includes(scriptSrc)) continue;
      urlJSs.push(scriptSrc);

      const jsData = await getData(scriptSrc);

      if (jsData !== "Failed" && jsData !== "") {
        zip.file("js/" + getTitle(scriptSrc) + ".js", jsData);

        let jsFolderLocation = maxDepthValue === 0 ? "js/" : "../js/";
        scriptElement.setAttribute(
          "src",
          jsFolderLocation + getTitle(scriptSrc) + ".js"
        );
      }
    } catch (error) {
      console.error("JS processing error:", error);
    }
  }

  return doc.documentElement.outerHTML;
}

async function processVideos(htmlData, inputUrl) {
  const parser = new DOMParser();
  let doc = parser.parseFromString(htmlData, "text/html");

  const videoElements = doc.querySelectorAll("video[src], iframe[src]");

  for (let videoElement of videoElements) {
    try {
      let videoSrc = videoElement.getAttribute("src");
      if (!videoSrc) continue;
      if (isSkippableAssetUrl(videoSrc)) continue;

      if (!videoSrc.startsWith("https://") && !videoSrc.startsWith("http://")) {
        videoSrc = getAbsolutePath(videoSrc, inputUrl).href;
      }

      let videoName = videoSrc
        .substring(videoSrc.lastIndexOf("/") + 1)
        .replace(/[&\/\\#,+()$~%'":*?<>{}]/g, "");

      if (!urlVideos.includes(videoName)) {
        urlVideos.push(videoName);

        const videoData = await urlToPromise(videoSrc);
        zip.file("video/" + videoName, videoData, { binary: true });
      }

      let videoFolderLocation = maxDepthValue === 0 ? "video/" : "../video/";
      videoElement.setAttribute("src", videoFolderLocation + videoName);
    } catch (error) {
      console.error("Video processing error:", error);
    }
  }

  return doc.documentElement.outerHTML;
}

async function processHTML(inputUrl, html = "", savedPagesMap = null, isRootPage = false) {
  let htmlData = html === "" ? await getForegroundPageHtml(inputUrl) : html;

  if (isFocusMode) {
    try {
     // added await to avoid object promise
      htmlData = await applyFocusMode(htmlData, inputUrl);
    } catch (err) {
      console.error("Focus Mode crashed.. using original HTML.", err);
    }
  }

  htmlData = await processImages(htmlData, inputUrl);
  htmlData = await processPdfs(htmlData, inputUrl);
  htmlData = await processCSSAndImages(htmlData, inputUrl);
  htmlData = await processJss(htmlData, inputUrl);
  htmlData = await processVideos(htmlData, inputUrl);

  if (savedPagesMap) {
    htmlData = rewritePageLinks(htmlData, inputUrl, savedPagesMap, isRootPage);
  }

  return htmlData;
}

async function processLinks() {
  if (maxDepthValue == 0) {
    updateStatus("Saving current page...");
    const html = await processHTML(currentPage);
    zip.file(getTitle(currentPage) + ".html", html);
    updateProgress(1, 1);
    return;
  }

  if (maxDepthValue == 1) {
    updateStatus(
      depthOneMode === "manual"
        ? "Foreground crawl is running. Saving selected linked pages."
        : "Foreground crawl is running. Saving the starting page and first-level linked pages."
    );

    let urls;

    // Combined focus mode with manual links logic
    if (depthOneMode === "manual" && selectedManualLinks.length > 0) {
      urls = new Set(
        selectedManualLinks.filter(
          (url) =>
            url &&
            !url.startsWith("javascript:") &&
            !url.startsWith("about:")
        )
      );
    } else if (isFocusMode) {
      updateStatus("Applying Focus Mode to find valid article links...");
      let rawHtml = await getForegroundPageHtml(currentPage);
      let focusedHtml = await applyFocusMode(rawHtml, currentPage);
      urls = extractLinksFromHtml(focusedHtml, currentPage, isRestrictDomain);
    } else {
      urls = await getForegroundLinks(currentPage);
    }

    const savedPagesMap = new Map();
    savedPagesMap.set(currentPage, getTitle(currentPage) + ".html");

    for (let url of urls) {
      savedPagesMap.set(url, "html/" + getTitle(url) + ".html");
    }

    let totalPages = urls.size + 1;
    let completedPages = 0;

    let rootHtml = await processHTML(currentPage, "", savedPagesMap, true);
    zip.file(getTitle(currentPage) + ".html", rootHtml);

    completedPages++;
    updateProgress(completedPages, totalPages);

    for (let url of urls) {
      try {
        updateStatus(
          depthOneMode === "manual"
            ? "Foreground crawl is running. Saving selected linked pages."
            : "Foreground crawl is running. Saving linked pages..."
        );

        let html = await processHTML(url, "", savedPagesMap, false);
        zip.file("html/" + getTitle(url) + ".html", html);

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
  console.warn("Depth > 1 is still experimental in this alpha build.");
}

async function startScrapingProcess() {
  currentProgress.innerText = "0%";
  currentProgress.style.display = "inline";
  progressBar.style.display = "flex";
  progressBar.style.width = "0%";

  updateStatus("Foreground crawl is running. Please keep this window open.");

  await processLinks();

  updateStatus("Preparing ZIP download...");
  currentProgress.innerText = "100%";
  progressBar.style.width = "100%";

  const zipName = new URL(startingURLInput).hostname;

  try {
    const content = await zip.generateAsync({ type: "blob" });

    updateStatus("Starting download...");

    const urlBlob = URL.createObjectURL(content);

    const downloadId = await chrome.downloads.download({
      url: urlBlob,
      filename: zipName + ".zip",
      saveAs: true,
    });

    chrome.downloads.onChanged.addListener(function listener(downloadItem) {
      if (
        downloadItem.id === downloadId &&
        downloadItem.state &&
        downloadItem.state.current === "complete"
      ) {
        chrome.downloads.onChanged.removeListener(listener);
        feedbackFormSection.style.display = "block";

        currentProgress.innerText = "100%";
        progressBar.style.width = "100%";
        updateStatus("Download complete. Your ZIP should now be in Finder.");

        setDownloadFlag(false);
        zip = new JSZip();
      }
    });
  } catch (error) {
    console.error("Error in ZIP/Download Process:", error);
    updateStatus("Download failed. Check the console for details.");
    setDownloadFlag(false);
  }
}

/**
 * Uses Mozilla's Readability library to extract the main content,
 * then injects it into a local HTML template.
 */
async function applyFocusMode(htmlData, inputUrl) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlData, "text/html");

  doc.querySelectorAll("a[href]").forEach(anchor => {
    try {
      let rawHref = anchor.getAttribute("href");
      if (rawHref && !rawHref.startsWith("http") && !rawHref.startsWith("mailto:") && !rawHref.startsWith("tel:") && !rawHref.startsWith("#")) {
        let absoluteUrl = new URL(rawHref, inputUrl).href;
        anchor.setAttribute("href", absoluteUrl);
      }
    } catch (e) {}
  });

  doc.querySelectorAll("img[src], video[src], source[src]").forEach(media => {
    try {
      let rawSrc = media.getAttribute("src");
      if (rawSrc && !rawSrc.startsWith("http") && !rawSrc.startsWith("data:")) {
        if (rawSrc.startsWith("//")) {
          media.setAttribute("src", "https:" + rawSrc);
        } else {
          let absoluteUrl = new URL(rawSrc, inputUrl).href;
          media.setAttribute("src", absoluteUrl);
        }
      }
    } catch (e) {}
  });

  const reader = new Readability(doc);
  const article = reader.parse();

  if (!article || !article.content) {
    console.warn("Focus Mode: Readability could not parse the page.. Saving original");
    return htmlData;
  }

  console.log("Successfully found the article content");

  const templateRes = await fetch("../html/template.html");
  let cleanHtml = await templateRes.text();

  const safeTitle = article.title || 'Saved Page';
  const safeByline = article.byline ? `<div class="byline">${article.byline}</div>` : '';

  cleanHtml = cleanHtml.replace(/{{TITLE}}/g, safeTitle);
  cleanHtml = cleanHtml.replace('{{BYLINE}}', safeByline);
  cleanHtml = cleanHtml.replace('{{CONTENT}}', article.content);

  return cleanHtml;
}

/**
 * Extracts links from an HTML string
 * Used specifically for when other links become unclickable in focus mode
 */
function extractLinksFromHtml(htmlData, rootPage, restrictDomain) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlData, "text/html");
  const links = [];

  for (const anchor of doc.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href");
    if (!href) continue;
    if (href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#")) continue;

    try {
      const absoluteUrl = new URL(href, rootPage).href;

      if (restrictDomain) {
        const startHost = new URL(rootPage).hostname;
        const linkHost = new URL(absoluteUrl).hostname;
        if (startHost !== linkHost) continue;
      }

      if (!links.includes(absoluteUrl)) {
        links.push(absoluteUrl);
      }
    } catch (e) {
      continue;
    }
  }

  return new Set(links);
}

/**
 * Extracts filename from URL so that names arent too long in file explorer.
 */
function getSafeFilename(url, defaultExt = "file") {
  let cleanUrl = url.split('?')[0].split('#')[0];
  let filename = cleanUrl.substring(cleanUrl.lastIndexOf("/") + 1);
  filename = filename.replace(/[^a-zA-Z0-9.\-_]/g, "");

  if (filename.length > 100) {
    filename = filename.substring(filename.length - 100);
  }

  if (!filename) {
    filename = "asset_" + Math.floor(Math.random() * 100000) + "." + defaultExt;
  }
  return filename;
}

/* Try to snap the popup back if the user resizes or fullscreen-changes it. */
function enforceWindowSize() {
  try {
    window.resizeTo(FIXED_WINDOW_WIDTH, FIXED_WINDOW_HEIGHT);
  } catch (error) {
    console.warn("Unable to resize popup window:", error);
  }
}

/* Run once after load so the popup starts at the intended size. */
window.addEventListener("load", () => {
  enforceWindowSize();
});

/* Prevent resizing by snapping back */
window.addEventListener("resize", () => {
  enforceWindowSize();
});

/* Catch fullscreen state changes and try to return to the fixed popup size. */
document.addEventListener("fullscreenchange", () => {
  enforceWindowSize();
});

/* Block fullscreen key */
window.addEventListener("keydown", (e) => {
  if (e.key === "F11") {
    e.preventDefault();
  }
});