/**
 * VIDEO DETECTION
 * Scans the current page for direct vs embedded/streamed video.
 */

import { state } from './state.js';

export async function detectPageVideo() {
  const videoSection = document.getElementById("video-section");
  const videoDetectSummary = document.getElementById("video-detect-summary");
  const videoEmbeddedNotice = document.getElementById("video-embedded-notice");

  if (!videoSection || !state.sourceTabId) return;

  const { downloadFlag } = await chrome.storage.sync.get("downloadFlag");
  if (downloadFlag) return;

  let found = null;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: state.sourceTabId },
      func: () => {
        const playerHosts = /(youtube\.com|youtube-nocookie\.com|youtu\.be|vimeo\.com|dailymotion\.com|wistia\.(com|net)|loom\.com|jwplayer|brightcove|twitch\.tv|facebook\.com\/plugins\/video)/i;
        let direct = 0, streamed = 0, embedded = 0;

        for (const video of document.querySelectorAll("video")) {
          const sources = [
            video.getAttribute("src"),
            ...Array.from(video.querySelectorAll("source[src]"), (s) => s.getAttribute("src"))
          ].filter(Boolean);
          
          if (sources.some((src) => !src.startsWith("blob:"))) direct++;
          else streamed++;
        }

        for (const frame of document.querySelectorAll("iframe[src], embed[src]")) {
          if (playerHosts.test(frame.getAttribute("src") || "")) embedded++;
        }
        return { direct, streamed, embedded };
      }
    });
    found = results && results[0] ? results[0].result : null;
  } catch (error) {
    console.warn("Could not check this page for video:", error);
  }

  const plural = (count, one, many) => count === 1 ? `1 ${one}` : `${count} ${many}`;
  const direct = found ? Number(found.direct) || 0 : 0;
  const unsaveable = found ? (Number(found.streamed) || 0) + (Number(found.embedded) || 0) : 0;

  if (direct + unsaveable === 0) {
    videoSection.style.display = "none";
    return;
  }

  if (videoDetectSummary) {
    videoDetectSummary.textContent = direct > 0 ? `${plural(direct, "video", "videos")} on this page will be saved with it.` : "";
    videoDetectSummary.style.display = direct > 0 ? "block" : "none";
  }

  if (videoEmbeddedNotice) {
    videoEmbeddedNotice.textContent = `${plural(unsaveable, "embedded video player", "embedded video players")} (YouTube, Vimeo or similar) can't be saved yet. The rest of the page still saves normally. To include the video, add a copy from your computer below.`;
    videoEmbeddedNotice.style.display = unsaveable > 0 ? "block" : "none";
  }
  
  videoSection.style.display = "block";
}