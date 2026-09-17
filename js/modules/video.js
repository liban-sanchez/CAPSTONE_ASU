/**
 * VIDEO PROCESSING
 * Downloads direct HTML5 video elements and handles adding user-selected local video files into the ZIP.
 */

import { state } from './state.js';
import { updateStatus } from './ui.js';
import { isSkippableAssetUrl, getSafeFilename } from './assets.js';


/**
 * Downloads direct HTML5 <video> elements and rewrites their paths. 
 * (Does not support iframes like YouTube/Vimeo).
 */

export async function processVideos(htmlData, inputUrl, isRootPage = false) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlData, "text/html");
  state.zip.folder("video");

  for (const videoElement of doc.querySelectorAll("video[src], video source[src]")) {
    try {
      let videoSrc = videoElement.getAttribute("src");
      if (!videoSrc) continue;
      if (videoSrc.startsWith("blob:")) {
        console.warn("Skipping blob video:", videoSrc);
        continue;
      }
      if (isSkippableAssetUrl(videoSrc)) continue;

      if (videoSrc.startsWith("//")) {
        videoSrc = "https:" + videoSrc;
      } else if (!videoSrc.startsWith("https://") && !videoSrc.startsWith("http://")) {
        videoSrc = new URL(videoSrc, inputUrl).href;
      }

      const videoName = getSafeFilename(videoSrc, "mp4");
      if (!state.urlVideos.includes(videoSrc)) {
        try {
          const videoData = await urlToPromise(videoSrc);
          state.zip.file("video/" + videoName, videoData, { binary: true });
          state.urlVideos.push(videoSrc);
        } catch (fetchError) {
          console.error("Video download failed:", videoSrc, fetchError);
          continue;
        }
      }

      const videoFolderLocation = (state.maxDepthValue === 0 || isRootPage) ? "video/" : "../video/";
      videoElement.setAttribute("src", videoFolderLocation + videoName);
      videoElement.removeAttribute("crossorigin");
    } catch (error) {
      console.error("Video processing error:", error);
    }
  }
  return doc.documentElement.outerHTML;
}

/**
 * Validates whether a user-selected file is a supported video format.
 */

export function isLocalVideoFile(file) {
  if (!file || typeof file.name !== "string") return false;
  if (file.type && file.type.startsWith("video/")) return true;

  const lower = file.name.toLowerCase();
  return (
    lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov") ||
    lower.endsWith(".m4v") || lower.endsWith(".avi") || lower.endsWith(".mkv")
  );
}

/**
 * Appends an incremental counter to prevent overwriting videos with the same name.
 */

export function getUniqueVideoFilename(originalName) {
  let safeName = getSafeFilename(originalName, "mp4");
  if (!state.zip.file("video/" + safeName)) return safeName;

  const dotIndex = safeName.lastIndexOf(".");
  let baseName = safeName;
  let extension = "";

  if (dotIndex > 0) {
    baseName = safeName.substring(0, dotIndex);
    extension = safeName.substring(dotIndex);
  }

  let counter = 2;
  let candidate = `${baseName}_${counter}${extension}`;

  while (state.zip.file("video/" + candidate)) {
    counter++;
    candidate = `${baseName}_${counter}${extension}`;
  }
  return candidate;
}

/**
 * Injects user-selected local video files directly into the ZIP buffer.
 */

export async function addLocalVideosToZip() {
  if (!Array.isArray(state.selectedLocalVideos) || state.selectedLocalVideos.length === 0) return;
  
  state.zip.folder("video");
  let successfullyAdded = 0;

  for (const file of state.selectedLocalVideos) {
    try {
      if (!isLocalVideoFile(file)) continue;

      updateStatus(`Adding local video: ${file.name}`);
      const videoName = getUniqueVideoFilename(file.name);
      
      const arrayBuffer = await file.arrayBuffer();
      const videoData = new Uint8Array(arrayBuffer);
      
      state.zip.file("video/" + videoName, videoData, { binary: true });
      successfullyAdded++;
    } catch (error) {
      console.error("Failed adding local video:", file?.name || "Unknown File", error);
    }
  }
}