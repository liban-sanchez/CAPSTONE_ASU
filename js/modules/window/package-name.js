/**
 * PACKAGE NAME
 * Builds the file name of the downloaded ZIP so that saving the same
 * site twice gives two clearly versioned packages instead of
 * "offline-website.zip", "offline-website (1).zip", ...
 *
 *   example.org_2026-11-05_0602_depth1.zip
 *
 * name, local date and time of the save, crawl depth.
 * Names sort by date in any file browser.
 *
 * The name part is the custom package name from packageConfig when the
 * user set one, otherwise the site's host name.
 */

const DEFAULT_PACKAGE_NAME = "offline-website";

function pad(number) {
  return String(number).padStart(2, "0");
}

function cleanName(value) {
  return String(value ?? "")
    .trim()
    .replace(/^www\./i, "")
    .replace(/[^a-zA-Z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
}

export function buildPackageName(startUrl, depth, customName, savedAt = new Date()) {
  let name = "";

  // A package name the user chose wins over the site name.
  if (customName && customName !== DEFAULT_PACKAGE_NAME) {
    name = cleanName(customName);
  }

  if (!name) {
    try {
      name = cleanName(new URL(startUrl).hostname);
    } catch (error) {
      // Fall through to the default below.
    }
  }

  if (!name) {
    name = DEFAULT_PACKAGE_NAME;
  }

  const date =
    savedAt.getFullYear() + "-" +
    pad(savedAt.getMonth() + 1) + "-" +
    pad(savedAt.getDate());

  const time = pad(savedAt.getHours()) + pad(savedAt.getMinutes());

  const level = Number(depth) || 0;

  return `${name}_${date}_${time}_depth${level}.zip`;
}
