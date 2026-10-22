/**
 * PACKAGE
 * Handles folder structure configuration and filename sanitization.
 */

// ============================================================
// DEFAULT FOLDERS
// ============================================================
export const DEFAULT_PACKAGE_FOLDERS = {
  assets: "assets",
  images: "images",
  videos: "videos",
  documents: "documents",
  styles: "styles",
  scripts: "scripts",
  pages: "pages"
};

// ============================================================
// SANITIZATION
// ============================================================
export function sanitizePackageName(value, fallback) {
  const cleaned = String(value ?? "").trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return (cleaned && cleaned !== "." && cleaned !== "..") ? cleaned : fallback;
}

export function sanitizeFolderName(value, fallback) {
  return sanitizePackageName(value, fallback);
}

// ============================================================
// CONFIGURATION
// ============================================================
export function getPackageConfig() {
  const packageOrganizationCustom = document.getElementById("package-organization-custom");
  const organizationMode = packageOrganizationCustom && packageOrganizationCustom.checked ? "custom" : "default";
  
  const folders = { ...DEFAULT_PACKAGE_FOLDERS };

  if (organizationMode === "custom") {
    folders.images = sanitizeFolderName(document.getElementById("images-folder-input")?.value, DEFAULT_PACKAGE_FOLDERS.images);
    folders.videos = sanitizeFolderName(document.getElementById("videos-folder-input")?.value, DEFAULT_PACKAGE_FOLDERS.videos);
    folders.documents = sanitizeFolderName(document.getElementById("documents-folder-input")?.value, DEFAULT_PACKAGE_FOLDERS.documents);
    folders.styles = sanitizeFolderName(document.getElementById("styles-folder-input")?.value, DEFAULT_PACKAGE_FOLDERS.styles);
    folders.scripts = sanitizeFolderName(document.getElementById("scripts-folder-input")?.value, DEFAULT_PACKAGE_FOLDERS.scripts);
    folders.pages = sanitizeFolderName(document.getElementById("pages-folder-input")?.value, DEFAULT_PACKAGE_FOLDERS.pages);
  }

  const includeReadmeToggle = document.getElementById("include-readme-toggle");

  return {
    packageName: sanitizePackageName(document.getElementById("package-name-input")?.value, "offline-website"),
    organizationMode: organizationMode,
    folders: folders,
    includeReadme: includeReadmeToggle ? Boolean(includeReadmeToggle.checked) : true
  };
}