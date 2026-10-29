/**
 * DEPTH UI
 * Handles range slider states, warnings, and custom max depth inputs.
 */

import { state } from './state.js';

export function initDepthUI(onDepthChangeCallback) {
  const depthMode = document.getElementById("choose-depth-input");
  const customDepthRow = document.getElementById("custom-depth-row");
  const customDepthInput = document.getElementById("custom-depth-input");
  const depthReadout = document.getElementById("depth-readout");
  const depthWarning = document.getElementById("depth-warning");
  const restrictDomainHint = document.getElementById("restrict-domain-hint");

  const MAX_DEPTH_STOP = 6;
  const CUSTOM_DEPTH_MIN = 6, CUSTOM_DEPTH_MAX = 20, CUSTOM_DEPTH_DEFAULT = 10;
  const LINKS_PER_PAGE_ESTIMATE = 10, DEPTH_WARNING_FROM = 2, HIGHEST_CRAWLED_DEPTH = 1;

  const DEPTH_LABELS = [
    "Depth 0 — just this page",
    "Depth 1 — this page and the pages it links to",
    "Depth 2 — two levels of links, slower",
    "Depth 3 — three levels of links, much slower",
    "Depth 4 — four levels, expect a long wait",
    "Depth 5 — five levels, the heaviest crawl"
  ];

  function readCustomDepth() {
    const raw = customDepthInput ? String(customDepthInput.value).trim() : "";
    let value = Math.round(Number(raw));
    if (raw === "" || !Number.isFinite(value)) value = CUSTOM_DEPTH_DEFAULT;
    return Math.min(CUSTOM_DEPTH_MAX, Math.max(CUSTOM_DEPTH_MIN, value));
  }

  function formatPageCount(count) {
    if (count >= 1e15) return "over a quadrillion";
    if (count < 1e6) return count.toLocaleString("en-US");
    return "about " + new Intl.NumberFormat("en-US", { notation: "compact", compactDisplay: "long", maximumFractionDigits: 0 }).format(count);
  }

  function updateDepthWarning() {
    if (!depthWarning) return;
    if (state.maxDepthValue < DEPTH_WARNING_FROM) {
      depthWarning.style.display = "none";
      return;
    }

    let total = 0;
    for (let level = 0; level <= state.maxDepthValue; level++) total += Math.pow(LINKS_PER_PAGE_ESTIMATE, level);
    
    depthWarning.textContent = "";
    const title = document.createElement("strong");
    title.textContent = "This crawl can get very large";
    
    const growth = document.createElement("div");
    growth.textContent = `Each level multiplies the number of pages. At about ${LINKS_PER_PAGE_ESTIMATE} links a page, depth ${state.maxDepthValue} can reach ${formatPageCount(total)} pages and take hours or more.${state.isRestrictDomain ? "" : " With Restrict Domain off it can be far more."}`;

    depthWarning.append(title, growth);

    if (state.maxDepthValue > HIGHEST_CRAWLED_DEPTH) {
      const note = document.createElement("div");
      note.className = "gb-depth-warning-note";
      note.textContent = `Depths above ${HIGHEST_CRAWLED_DEPTH} are not crawled yet in this alpha, so the download will be empty. Use depth 0 or 1 for now.`;
      depthWarning.append(note);
    }
    depthWarning.style.display = "block";
  }

  function updateRestrictDomainHint() {
    if (!restrictDomainHint) return;
    restrictDomainHint.style.display = (state.maxDepthValue >= 1 && !state.isRestrictDomain) ? "block" : "none";
  }

  function handleDepthChange() {
    const stop = Number(depthMode?.value || 0);
    const isMax = stop === MAX_DEPTH_STOP;

    if (customDepthRow) customDepthRow.style.display = isMax ? "flex" : "none";
    state.maxDepthValue = isMax ? readCustomDepth() : stop;

    if (depthReadout) {
      depthReadout.innerText = isMax ? `Max — ${state.maxDepthValue} levels deep, the largest crawls` : (DEPTH_LABELS[stop] || `Depth ${stop}`);
    }

    updateDepthWarning();
    updateRestrictDomainHint();
    if (onDepthChangeCallback) onDepthChangeCallback();
  }

  if (depthMode) {
    depthMode.addEventListener("input", handleDepthChange);
    depthMode.addEventListener("change", handleDepthChange);
  }

  if (customDepthInput) {
    customDepthInput.addEventListener("input", handleDepthChange);
    customDepthInput.addEventListener("change", () => {
      customDepthInput.value = String(readCustomDepth());
      handleDepthChange();
    });
  }

  return { updateDepthWarning, updateRestrictDomainHint };
}