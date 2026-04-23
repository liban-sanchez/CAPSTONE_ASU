let startingURLInput = "";
let currentPage = "";
let sourceTabId = null;
let isExcludeImages = false;
let isFocusMode = false;
let isRestrictDomain = false;
let maxDepthValue = 0;

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
const FIXED_WINDOW_WIDTH = 430;
const FIXED_WINDOW_HEIGHT = 520;


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
    sourceTabId
  ] = event.data;

  // Normalize incoming values so executeScript args stay serializable
  startingURLInput = startingURLInput ?? "";
  isFocusMode = Boolean(isFocusMode);
  isRestrictDomain = Boolean(isRestrictDomain);
  newMaxDepthValue = Number(newMaxDepthValue || 0);
  sourceTabId = sourceTabId ?? null;

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
        if (absolute.startsWith("mailto:") || absolute.startsWith("tel:")) continue;
        if (href.startsWith("#")) continue;

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

async function processImages(htmlData, inputUrl) {
  const parser = new DOMParser();
  let doc = parser.parseFromString(htmlData, "text/html");

  const imgElements = doc.querySelectorAll("img");

  for (let imgElement of imgElements) {
    try {
      let imgSrc = imgElement.getAttribute("src");
      if (imgSrc === null || imgSrc.includes("base64")) continue;

      if (!imgSrc.startsWith("https://") && !imgSrc.startsWith("http://")) {
        imgSrc = getAbsolutePath(imgSrc, inputUrl).href;
      }

      let imageName = imgSrc
        .substring(imgSrc.lastIndexOf("/") + 1)
        .replace(/[&\/\\#,+()$~%'":*?<>{}]/g, "");

      if (!urlImages.includes(imageName)) {
        urlImages.push(imageName);

        const imageData = await urlToPromise(imgSrc);
        zip.file("img/" + imageName, imageData, { binary: true });
      }

      let imgFolderLocation = maxDepthValue === 0 ? "img/" : "../img/";
      imgElement.setAttribute("src", imgFolderLocation + imageName);
    } catch (error) {
      console.error("Image processing error:", error);
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
      if (!videoSrc || videoSrc.startsWith("data:")) continue;

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
      "Foreground crawl is running. Saving the starting page and first-level linked pages."
    );

    let urls = await getForegroundLinks(currentPage);

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
        updateStatus("Foreground crawl is running. Saving linked pages...");

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
  /* NEW: Prevent resizing by snapping back */
window.addEventListener("resize", () => {
  window.resizeTo(340, 350);
});
/* NEW: Block fullscreen key */
window.addEventListener("keydown", (e) => {
  if (e.key === "F11") {
    e.preventDefault();
  }
});
/* NEW: Block fullscreen key */
window.addEventListener("keydown", (e) => {
  if (e.key === "F11") {
    e.preventDefault();
  }
});
/* NEW: Try to snap the popup back if the user resizes or fullscreen-changes it. */
function enforceWindowSize() {
  try {
    window.resizeTo(FIXED_WINDOW_WIDTH, FIXED_WINDOW_HEIGHT);
  } catch (error) {
    console.warn("Unable to resize popup window:", error);
  }
}

/* NEW: Run once after load so the popup starts at the intended size. */
window.addEventListener("load", () => {
  enforceWindowSize();
});

/* NEW: If the popup is resized, try to return it to the fixed dimensions. */
window.addEventListener("resize", () => {
  enforceWindowSize();
});

/* NEW: Catch fullscreen state changes and try to return to the fixed popup size. */
document.addEventListener("fullscreenchange", () => {
  enforceWindowSize();
});
}