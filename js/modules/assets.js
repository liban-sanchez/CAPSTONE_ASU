/**
 * ASSET PROCESSING
 * Finds, downloads, and rewrites local paths for static assets like CSS, JavaScript, images, and PDFs.
 */

import { state } from './state.js';

/**
 * Checks if a URL is a mailto, tel, javascript, or data URI.
 */

export function isSkippableAssetUrl(url) {
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
 * Rewrites standard page anchors to point to locally saved HTML files.
 */

export function rewritePageLinks(htmlData, inputUrl, savedPagesMap, isRootPage = false) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlData, "text/html");

  for (const anchor of doc.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.toLowerCase().endsWith(".pdf")) continue;

    let absoluteUrl;
    try {
      absoluteUrl = new URL(href, inputUrl).href;
    } catch (e) {
      continue;
    }

    if (savedPagesMap && savedPagesMap.has(absoluteUrl)) {
      const localFile = savedPagesMap.get(absoluteUrl);
      anchor.setAttribute("href", isRootPage ? localFile : "../" + localFile);
    }
  }
  return doc.documentElement.outerHTML;
}

/**
 * Downloads external stylesheets and processes inline <style> blocks.
 */

export async function processCSSAndImages(htmlData, inputUrl) {
  const parser = new DOMParser();
  let doc = parser.parseFromString(htmlData, "text/html");

  for (let linkElement of doc.querySelectorAll('link[rel="stylesheet"]')) {
    try {
      let cssHref = linkElement.getAttribute("href");
      if (!cssHref || isSkippableAssetUrl(cssHref)) continue;

      if (!cssHref.startsWith("https://") && !cssHref.startsWith("http://")) {
        cssHref = getAbsolutePath(cssHref, inputUrl).href;
      }

      if (state.urlCSSs.includes(cssHref)) continue;
      state.urlCSSs.push(cssHref);

      const cssData = await getData(cssHref);
      if (cssData !== "Failed" && cssData !== "") {
        const processedCSS = await processCSSImages(cssData, cssHref);
        state.zip.file("css/" + getTitle(cssHref) + ".css", processedCSS);
        let cssFolderLocation = state.maxDepthValue === 0 ? "css/" : "../css/";
        linkElement.setAttribute("href", cssFolderLocation + getTitle(cssHref) + ".css");
      }
    } catch (error) {
      console.error("CSS processing error:", error);
    }
  }

  for (let styleElement of doc.querySelectorAll("style")) {
    try {
      let processedStyleContent = await processCSSImages(styleElement.textContent, inputUrl);
      styleElement.textContent = processedStyleContent;
    } catch (error) {
      console.error("Inline CSS processing error:", error);
    }
  }
  return doc.documentElement.outerHTML;
}

/**
 * Parses CSS text via regex to download background images and rewrite paths.
 */

export async function processCSSImages(cssData, cssUrl) {
  const imageUrlRegex = /url\(["']?([^"')]+)["']?\)/g;
  let downloadPromises = [];

  const updatedCSS = cssData.replace(imageUrlRegex, (match, imageUrl) => {
    let resolvedUrl = imageUrl;
    if (imageUrl.startsWith("//")) {
      resolvedUrl = "https:" + imageUrl;
    } else if (!imageUrl.startsWith("https://") && !imageUrl.startsWith("http://")) {
      resolvedUrl = getAbsolutePath(imageUrl, cssUrl).href;
    }

    if (isSkippableAssetUrl(resolvedUrl) || resolvedUrl.endsWith(".woff") || resolvedUrl.endsWith(".woff2") || resolvedUrl.endsWith(".ttf") || resolvedUrl.endsWith(".otf")) {
      return match;
    }

    let imageName = resolvedUrl.substring(resolvedUrl.lastIndexOf("/") + 1).replace(/[&\/\\#,+()$~%'":*?<>{}]/g, "");

    if (!state.urlImages.includes(imageName)) {
      state.urlImages.push(imageName);
      const promise = urlToPromise(resolvedUrl)
        .then((imageData) => {
          state.zip.file("img/" + imageName, imageData, { binary: true });
        })
        .catch(() => console.error(`Error fetching image from: ${resolvedUrl}`));
      downloadPromises.push(promise);
    }
    return `url("../img/${imageName}")`;
  });

  await Promise.all(downloadPromises);
  return updatedCSS;
}

/**
 * Finds and downloads linked PDF documents.
 */

export async function processPdfs(htmlData, inputUrl) {
  const parser = new DOMParser();
  let doc = parser.parseFromString(htmlData, "text/html");

  for (let anchorElement of doc.querySelectorAll('a[href$=".pdf"]')) {
    try {
      let pdfHref = anchorElement.getAttribute("href");
      if (!pdfHref || isSkippableAssetUrl(pdfHref)) continue;

      if (!pdfHref.startsWith("https://") && !pdfHref.startsWith("http://")) {
        pdfHref = getAbsolutePath(pdfHref, inputUrl).href;
      }

      if (state.urlPdfs.includes(pdfHref)) continue;
      state.urlPdfs.push(pdfHref);

      const pdfData = await getData(pdfHref);
      if (pdfData !== "Failed" && pdfData !== "") {
        state.zip.file("pdf/" + getTitle(pdfHref) + ".pdf", pdfData, { binary: true });
        let pdfFolderLocation = state.maxDepthValue === 0 ? "pdf/" : "../pdf/";
        anchorElement.setAttribute("href", pdfFolderLocation + getTitle(pdfHref) + ".pdf");
      }
    } catch (error) {
      console.error("PDF processing error:", error);
    }
  }
  return doc.documentElement.outerHTML;
}

/**
 * Downloads standard <img> elements and updates their source to the local /img folder.
 */

export async function processImages(htmlData, inputUrl, isRootPage = false) {
  const parser = new DOMParser();
  let doc = parser.parseFromString(htmlData, "text/html");
  state.zip.folder("img");

  for (let imgElement of doc.querySelectorAll("img")) {
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
      if (!state.urlImages.includes(imageName)) {
        state.urlImages.push(imageName);
        try {
          const imageData = await urlToPromise(imgSrc);
          state.zip.file("img/" + imageName, imageData, { binary: true });
        } catch (fetchErr) {
          console.error("Download Failed:", imgSrc, fetchErr);
        }
      }

      let imgFolderLocation = (state.maxDepthValue === 0 || isRootPage) ? "img/" : "../img/";
      imgElement.setAttribute("src", imgFolderLocation + imageName);
    } catch (error) {
      console.error("Image loop error:", error);
    }
  }
  return doc.documentElement.outerHTML;
}

/**
 * Downloads external JavaScript files and rewrites script tags.
 */

export async function processJss(htmlData, inputUrl) {
  const parser = new DOMParser();
  let doc = parser.parseFromString(htmlData, "text/html");

  for (let scriptElement of doc.querySelectorAll("script[src]")) {
    try {
      let scriptSrc = scriptElement.getAttribute("src");
      if (!scriptSrc || isSkippableAssetUrl(scriptSrc)) continue;

      if (!scriptSrc.startsWith("https://") && !scriptSrc.startsWith("http://")) {
        scriptSrc = getAbsolutePath(scriptSrc, inputUrl).href;
      }

      if (state.urlJSs.includes(scriptSrc)) continue;
      state.urlJSs.push(scriptSrc);

      const jsData = await getData(scriptSrc);
      if (jsData !== "Failed" && jsData !== "") {
        state.zip.file("js/" + getTitle(scriptSrc) + ".js", jsData);
        let jsFolderLocation = state.maxDepthValue === 0 ? "js/" : "../js/";
        scriptElement.setAttribute("src", jsFolderLocation + getTitle(scriptSrc) + ".js");
      }
    } catch (error) {
      console.error("JS processing error:", error);
    }
  }
  return doc.documentElement.outerHTML;
}

/**
 * Strips invalid filesystem characters from a URL to generate a safe local filename.
 */

export function getSafeFilename(url, defaultExt = "file") {
  let cleanUrl = String(url || "").split("?")[0].split("#")[0];
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