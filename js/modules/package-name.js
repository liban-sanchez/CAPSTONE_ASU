/**
 * PACKAGE NAME
 * Builds the file name of the downloaded ZIP so that saving the same
 * site twice gives two clearly versioned packages instead of
 * "example.com.zip", "example.com (1).zip", ...
 *
 *   example.org_2026-10-28_1152_depth1.zip
 *
 * site name, local date and time of the save, crawl depth.
 * Names sort by date in any file browser.
 */

const FALLBACK_SITE_NAME = "offline-site";

function pad(number) {
  return String(number).padStart(2, "0");
}

export function buildPackageName(startUrl, depth, savedAt = new Date()) {
  let site = FALLBACK_SITE_NAME;

  try {
    site = new URL(startUrl).hostname || FALLBACK_SITE_NAME;
  } catch (error) {
    // Keep the fallback name.
  }

  site = site
    .replace(/^www\./i, "")
    .replace(/[^a-zA-Z0-9.-]/g, "-");

  const date =
    savedAt.getFullYear() + "-" +
    pad(savedAt.getMonth() + 1) + "-" +
    pad(savedAt.getDate());

  const time = pad(savedAt.getHours()) + pad(savedAt.getMinutes());

  const level = Number(depth) || 0;

  return `${site}_${date}_${time}_depth${level}.zip`;
}
