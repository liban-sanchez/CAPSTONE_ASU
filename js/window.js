let startingURLInput = "";
let currentPage = "";
let sourceTabId = null;

let isExcludeImages = false;
let isFocusMode = false;
let isRestrictDomain = false;

let maxDepthValue = 0;


// ============================================================
// DEPTH 1 STATE
// ============================================================

let depthOneMode = "all";

let selectedManualLinks = [];


// ============================================================
// LOCAL VIDEO IMPORT STATE
// ============================================================

/*
 * These File objects are sent from popup.js
 * through the BroadcastChannel.
 *
 * Example:
 *
 * [
 *   File("lesson.mp4"),
 *   File("training.mov")
 * ]
 */
let selectedLocalVideos = [];


// ============================================================
// DOWNLOADED ASSET TRACKING
// ============================================================

let urlList = [];

let urlCSSs = [];

let urlImages = [];

let urlVideos = [];

let urlJSs = [];

let urlPdfs = [];


let scrapingDone = false;


// ============================================================
// UI ELEMENTS
// ============================================================

let feedbackFormSection =
  document.getElementById(
    "feedback-form-section"
  );


if (feedbackFormSection) {

  feedbackFormSection.style.display =
    "none";
}


const progressBar =
  document.getElementById(
    "progress-bar"
  );


const currentProgress =
  document.getElementById(
    "current-progress"
  );


const statusMessage =
  document.getElementById(
    "status-message"
  );


const FIXED_WINDOW_WIDTH =
  360;


const FIXED_WINDOW_HEIGHT =
  450;


// ============================================================
// DOWNLOAD FLAG
// ============================================================

const setDownloadFlag =
  (isDownloading) => {

    chrome.storage.sync.set({
      downloadFlag:
        isDownloading
    });
  };


// ============================================================
// MAX DEPTH
// ============================================================

const setMaxDepth =
  (newMaxDepthValue) => {

    maxDepthValue =
      newMaxDepthValue;
  };


// ============================================================
// CURRENT PAGE
// ============================================================

const setCurrentPage =
  (newCurrentPage) => {

    currentPage =
      newCurrentPage;
  };


// ============================================================
// BROADCAST CHANNEL
// ============================================================

const broadcastChannel =
  new BroadcastChannel(
    "scraper_data"
  );


broadcastChannel.addEventListener(
  "message",
  (event) => {

    /*
     * popup.js now sends 8 values:
     *
     * 0 = current page
     * 1 = Focus Mode
     * 2 = Restrict Domain
     * 3 = max depth
     * 4 = source tab ID
     * 5 = Depth 1 mode
     * 6 = manually selected links
     * 7 = local video File objects
     */
    let newMaxDepthValue;


    [
      startingURLInput,
      isFocusMode,
      isRestrictDomain,
      newMaxDepthValue,
      sourceTabId,
      depthOneMode,
      selectedManualLinks,
      selectedLocalVideos
    ] = event.data;


    // ========================================================
    // NORMALIZE BASIC VALUES
    // ========================================================

    startingURLInput =
      startingURLInput ??
      "";


    isFocusMode =
      Boolean(
        isFocusMode
      );


    isRestrictDomain =
      Boolean(
        isRestrictDomain
      );


    newMaxDepthValue =
      Number(
        newMaxDepthValue ||
        0
      );


    sourceTabId =
      sourceTabId ??
      null;


    // ========================================================
    // NORMALIZE DEPTH 1 MODE
    // ========================================================

    depthOneMode =
      depthOneMode === "manual"
        ? "manual"
        : "all";


    // ========================================================
    // NORMALIZE MANUAL LINKS
    // ========================================================

    selectedManualLinks =
      Array.isArray(
        selectedManualLinks
      )
        ? selectedManualLinks.map(
            (link) =>
              String(link)
          )
        : [];


    // ========================================================
    // NORMALIZE LOCAL VIDEO FILES
    // ========================================================

    selectedLocalVideos =
      Array.isArray(
        selectedLocalVideos
      )
        ? selectedLocalVideos.filter(
            (file) =>
              file &&
              typeof file.name ===
                "string"
          )
        : [];


    console.log(
      "Local videos received:",
      selectedLocalVideos.map(
        (file) => ({
          name:
            file.name,

          type:
            file.type,

          size:
            file.size
        })
      )
    );


    setDownloadFlag(
      true
    );


    setMaxDepth(
      newMaxDepthValue
    );


    setCurrentPage(
      startingURLInput
    );


    startScrapingProcess();
  }
);


// ============================================================
// ZIP
// ============================================================

let extId =
  chrome.runtime.id;


let zip =
  new JSZip();


// ============================================================
// SOURCE TAB
// ============================================================

/**
 * Get the original browser tab
 * we want to crawl.
 */
async function getSourceTab() {

  if (
    sourceTabId === null ||
    sourceTabId === undefined
  ) {

    throw new Error(
      "Source tab ID is missing."
    );
  }


  const tab =
    await chrome.tabs.get(
      sourceTabId
    );


  if (!tab) {

    throw new Error(
      "Source tab not found."
    );
  }


  return tab;
}


// ============================================================
// TAB LOADING
// ============================================================

/**
 * Wait for a tab to finish
 * loading after navigation.
 */
function waitForTabLoad(
  tabId
) {

  return new Promise(
    (resolve) => {

      function listener(
        updatedTabId,
        changeInfo,
        tab
      ) {

        if (
          updatedTabId ===
            tabId &&
          changeInfo.status ===
            "complete"
        ) {

          chrome.tabs.onUpdated.removeListener(
            listener
          );


          resolve(
            tab
          );
        }
      }


      chrome.tabs.onUpdated.addListener(
        listener
      );
    }
  );
}


// ============================================================
// TAB NAVIGATION
// ============================================================

/**
 * Navigate the original source tab,
 * not the progress window.
 */
async function navigateSourceTab(
  url
) {

  const sourceTab =
    await getSourceTab();


  await chrome.tabs.update(
    sourceTab.id,
    {
      url:
        url
    }
  );


  await waitForTabLoad(
    sourceTab.id
  );


  return sourceTab.id;
}


// ============================================================
// FOREGROUND HTML
// ============================================================

/**
 * Read the fully rendered HTML
 * from the source tab.
 */
async function getForegroundPageHtml(
  url
) {

  const tabId =
    await navigateSourceTab(
      url
    );


  const results =
    await chrome.scripting.executeScript({

      target: {
        tabId:
          tabId
      },


      func: () =>
        document.documentElement.outerHTML
    });


  return (
    results &&
    results[0]
  )
    ? results[0].result
    : "";
}


// ============================================================
// FOREGROUND LINKS
// ============================================================

/**
 * Read all valid links
 * from the live DOM.
 */
async function getForegroundLinks(
  url
) {

  const tabId =
    await navigateSourceTab(
      url
    );


  const results =
    await chrome.scripting.executeScript({

      target: {
        tabId:
          tabId
      },


      args: [
        Boolean(
          isRestrictDomain
        ),

        String(
          currentPage ||
          ""
        )
      ],


      func: (
        restrictDomain,
        rootPage
      ) => {

        const links =
          [];


        for (
          const anchor
          of document.querySelectorAll(
            "a[href]"
          )
        ) {

          const href =
            anchor.getAttribute(
              "href"
            );


          const absolute =
            anchor.href;


          if (
            !href ||
            !absolute
          ) {

            continue;
          }


          if (
            href.startsWith(
              "#"
            )
          ) {

            continue;
          }


          if (
            absolute.startsWith(
              "mailto:"
            )
          ) {

            continue;
          }


          if (
            absolute.startsWith(
              "tel:"
            )
          ) {

            continue;
          }


          if (
            absolute.startsWith(
              "javascript:"
            )
          ) {

            continue;
          }


          if (
            absolute.startsWith(
              "about:"
            )
          ) {

            continue;
          }


          if (
            !absolute.startsWith(
              "http://"
            ) &&
            !absolute.startsWith(
              "https://"
            )
          ) {

            continue;
          }


          if (
            restrictDomain
          ) {

            try {

              const startHost =
                new URL(
                  rootPage
                ).hostname;


              const linkHost =
                new URL(
                  absolute
                ).hostname;


              if (
                startHost !==
                linkHost
              ) {

                continue;
              }

            } catch (e) {

              continue;
            }
          }


          if (
            !links.includes(
              absolute
            )
          ) {

            links.push(
              absolute
            );
          }
        }


        return links;
      }
    });


  return new Set(
    results &&
    results[0]
      ? results[0].result
      : []
  );
}


// ============================================================
// PROGRESS
// ============================================================

function calculateProgressPercentage(
  currentCount,
  totalCount
) {

  if (
    totalCount === 0
  ) {

    return "0%";
  }


  let percentage =
    Math.ceil(
      (
        currentCount /
        totalCount
      ) *
      100
    );


  if (
    percentage > 100
  ) {

    percentage =
      100;
  }


  return (
    percentage.toString() +
    "%"
  );
}


function updateProgress(
  currentCount,
  totalCount
) {

  const progressPercentage =
    calculateProgressPercentage(
      currentCount,
      totalCount
    );


  if (currentProgress) {

    currentProgress.innerText =
      progressPercentage;


    currentProgress.style.display =
      "inline";
  }


  if (progressBar) {

    progressBar.style.display =
      "flex";


    progressBar.style.width =
      progressPercentage;
  }
}


// ============================================================
// STATUS
// ============================================================

function updateStatus(
  message
) {

  if (
    statusMessage
  ) {

    statusMessage.innerText =
      message;
  }
}


// ============================================================
// ASSET URL CHECK
// ============================================================

function isSkippableAssetUrl(
  url
) {

  if (
    !url ||
    typeof url !==
      "string"
  ) {

    return true;
  }


  return (
    url.startsWith(
      "about:"
    ) ||

    url.startsWith(
      "javascript:"
    ) ||

    url.startsWith(
      "data:"
    ) ||

    url.startsWith(
      "mailto:"
    ) ||

    url.startsWith(
      "tel:"
    )
  );
}


// ============================================================
// PAGE LINK REWRITING
// ============================================================

/**
 * Rewrite normal page anchors
 * to local saved HTML files.
 */
function rewritePageLinks(
  htmlData,
  inputUrl,
  savedPagesMap,
  isRootPage = false
) {

  const parser =
    new DOMParser();


  const doc =
    parser.parseFromString(
      htmlData,
      "text/html"
    );


  for (
    const anchor
    of doc.querySelectorAll(
      "a[href]"
    )
  ) {

    const href =
      anchor.getAttribute(
        "href"
      );


    if (!href) {
      continue;
    }


    if (
      href.startsWith(
        "#"
      )
    ) {

      continue;
    }


    if (
      href.startsWith(
        "mailto:"
      )
    ) {

      continue;
    }


    if (
      href.startsWith(
        "tel:"
      )
    ) {

      continue;
    }


    if (
      href
        .toLowerCase()
        .endsWith(
          ".pdf"
        )
    ) {

      continue;
    }


    let absoluteUrl;


    try {

      absoluteUrl =
        new URL(
          href,
          inputUrl
        ).href;

    } catch (e) {

      continue;
    }


    if (
      savedPagesMap &&
      savedPagesMap.has(
        absoluteUrl
      )
    ) {

      const localFile =
        savedPagesMap.get(
          absoluteUrl
        );


      if (
        isRootPage
      ) {

        anchor.setAttribute(
          "href",
          localFile
        );

      } else {

        anchor.setAttribute(
          "href",
          "../" +
          localFile
        );
      }
    }
  }


  return (
    doc.documentElement.outerHTML
  );
}


// ============================================================
// CSS
// ============================================================

async function processCSSAndImages(
  htmlData,
  inputUrl
) {

  const parser =
    new DOMParser();


  let doc =
    parser.parseFromString(
      htmlData,
      "text/html"
    );


  const linkElements =
    doc.querySelectorAll(
      'link[rel="stylesheet"]'
    );


  for (
    let linkElement
    of linkElements
  ) {

    try {

      let cssHref =
        linkElement.getAttribute(
          "href"
        );


      if (
        !cssHref
      ) {

        continue;
      }


      if (
        isSkippableAssetUrl(
          cssHref
        )
      ) {

        continue;
      }


      if (
        !cssHref.startsWith(
          "https://"
        ) &&
        !cssHref.startsWith(
          "http://"
        )
      ) {

        cssHref =
          getAbsolutePath(
            cssHref,
            inputUrl
          ).href;
      }


      if (
        urlCSSs.includes(
          cssHref
        )
      ) {

        continue;
      }


      urlCSSs.push(
        cssHref
      );


      const cssData =
        await getData(
          cssHref
        );


      if (
        cssData !==
          "Failed" &&
        cssData !==
          ""
      ) {

        const processedCSS =
          await processCSSImages(
            cssData,
            cssHref
          );


        zip.file(
          "css/" +
          getTitle(
            cssHref
          ) +
          ".css",
          processedCSS
        );


        let cssFolderLocation =
          maxDepthValue === 0
            ? "css/"
            : "../css/";


        linkElement.setAttribute(
          "href",
          cssFolderLocation +
          getTitle(
            cssHref
          ) +
          ".css"
        );
      }

    } catch (
      error
    ) {

      console.error(
        "CSS processing error:",
        error
      );
    }
  }


  const styleElements =
    doc.querySelectorAll(
      "style"
    );


  for (
    let styleElement
    of styleElements
  ) {

    try {

      let styleContent =
        styleElement.textContent;


      let processedStyleContent =
        await processCSSImages(
          styleContent,
          inputUrl
        );


      styleElement.textContent =
        processedStyleContent;

    } catch (
      error
    ) {

      console.error(
        "Inline CSS processing error:",
        error
      );
    }
  }


  return (
    doc.documentElement.outerHTML
  );
}


// ============================================================
// CSS IMAGES
// ============================================================

async function processCSSImages(
  cssData,
  cssUrl
) {

  const imageUrlRegex =
    /url\(["']?([^"')]+)["']?\)/g;


  let downloadPromises =
    [];


  const updatedCSS =
    cssData.replace(
      imageUrlRegex,
      (
        match,
        imageUrl
      ) => {

        let resolvedUrl =
          imageUrl;


        if (
          imageUrl.startsWith(
            "//"
          )
        ) {

          resolvedUrl =
            "https:" +
            imageUrl;

        } else if (
          !imageUrl.startsWith(
            "https://"
          ) &&
          !imageUrl.startsWith(
            "http://"
          )
        ) {

          resolvedUrl =
            getAbsolutePath(
              imageUrl,
              cssUrl
            ).href;
        }


        if (
          isSkippableAssetUrl(
            resolvedUrl
          )
        ) {

          return match;
        }


        if (
          resolvedUrl.endsWith(
            ".woff"
          ) ||

          resolvedUrl.endsWith(
            ".woff2"
          ) ||

          resolvedUrl.endsWith(
            ".ttf"
          ) ||

          resolvedUrl.endsWith(
            ".otf"
          )
        ) {

          return match;
        }


        let imageName =
          resolvedUrl
            .substring(
              resolvedUrl
                .lastIndexOf(
                  "/"
                ) +
              1
            )
            .replace(
              /[&\/\\#,+()$~%'":*?<>{}]/g,
              ""
            );


        if (
          !urlImages.includes(
            imageName
          )
        ) {

          urlImages.push(
            imageName
          );


          const promise =
            urlToPromise(
              resolvedUrl
            )
              .then(
                (
                  imageData
                ) => {

                  zip.file(
                    "img/" +
                    imageName,
                    imageData,
                    {
                      binary:
                        true
                    }
                  );
                }
              )
              .catch(
                () => {

                  console.error(
                    `Error fetching image from: ${resolvedUrl}`
                  );
                }
              );


          downloadPromises.push(
            promise
          );
        }


        return (
          `url("../img/${imageName}")`
        );
      }
    );


  await Promise.all(
    downloadPromises
  );


  return updatedCSS;
}


// ============================================================
// PDF PROCESSING
// ============================================================

async function processPdfs(
  htmlData,
  inputUrl
) {

  const parser =
    new DOMParser();


  let doc =
    parser.parseFromString(
      htmlData,
      "text/html"
    );


  const anchorElements =
    doc.querySelectorAll(
      'a[href$=".pdf"]'
    );


  for (
    let anchorElement
    of anchorElements
  ) {

    try {

      let pdfHref =
        anchorElement.getAttribute(
          "href"
        );


      if (
        !pdfHref
      ) {

        continue;
      }


      if (
        isSkippableAssetUrl(
          pdfHref
        )
      ) {

        continue;
      }


      if (
        !pdfHref.startsWith(
          "https://"
        ) &&
        !pdfHref.startsWith(
          "http://"
        )
      ) {

        pdfHref =
          getAbsolutePath(
            pdfHref,
            inputUrl
          ).href;
      }


      if (
        urlPdfs.includes(
          pdfHref
        )
      ) {

        continue;
      }


      urlPdfs.push(
        pdfHref
      );


      const pdfData =
        await getData(
          pdfHref
        );


      if (
        pdfData !==
          "Failed" &&
        pdfData !==
          ""
      ) {

        zip.file(
          "pdf/" +
          getTitle(
            pdfHref
          ) +
          ".pdf",
          pdfData,
          {
            binary:
              true
          }
        );


        let pdfFolderLocation =
          maxDepthValue === 0
            ? "pdf/"
            : "../pdf/";


        anchorElement.setAttribute(
          "href",
          pdfFolderLocation +
          getTitle(
            pdfHref
          ) +
          ".pdf"
        );
      }

    } catch (
      error
    ) {

      console.error(
        "PDF processing error:",
        error
      );
    }
  }


  return (
    doc.documentElement.outerHTML
  );
}


// ============================================================
// IMAGE PROCESSING
// ============================================================

async function processImages(
  htmlData,
  inputUrl,
  isRootPage = false
) {

  const parser =
    new DOMParser();


  let doc =
    parser.parseFromString(
      htmlData,
      "text/html"
    );


  const imgElements =
    doc.querySelectorAll(
      "img"
    );


  zip.folder(
    "img"
  );


  for (
    let imgElement
    of imgElements
  ) {

    try {

      imgElement.removeAttribute(
        "srcset"
      );


      imgElement.removeAttribute(
        "data-srcset"
      );


      imgElement.removeAttribute(
        "sizes"
      );


      let imgSrc =
        imgElement.getAttribute(
          "src"
        ) ||

        imgElement.getAttribute(
          "data-src"
        );


      if (
        !imgSrc ||
        imgSrc.includes(
          "base64"
        )
      ) {

        continue;
      }


      if (
        imgSrc.startsWith(
          "//"
        )
      ) {

        imgSrc =
          "https:" +
          imgSrc;

      } else if (
        !imgSrc.startsWith(
          "https://"
        ) &&
        !imgSrc.startsWith(
          "http://"
        )
      ) {

        imgSrc =
          new URL(
            imgSrc,
            inputUrl
          ).href;
      }


      let imageName =
        getSafeFilename(
          imgSrc,
          "png"
        );


      if (
        !urlImages.includes(
          imageName
        )
      ) {

        urlImages.push(
          imageName
        );


        console.log(
          "⬇ Attempting to download:",
          imgSrc
        );


        try {

          const imageData =
            await urlToPromise(
              imgSrc
            );


          zip.file(
            "img/" +
            imageName,
            imageData,
            {
              binary:
                true
            }
          );

        } catch (
          fetchErr
        ) {

          console.error(
            "Download Failed:",
            imgSrc,
            fetchErr
          );
        }
      }


      let imgFolderLocation =
        (
          maxDepthValue === 0 ||
          isRootPage
        )
          ? "img/"
          : "../img/";


      imgElement.setAttribute(
        "src",
        imgFolderLocation +
        imageName
      );

    } catch (
      error
    ) {

      console.error(
        "Image loop error:",
        error
      );
    }
  }


  return (
    doc.documentElement.outerHTML
  );
}


// ============================================================
// JAVASCRIPT PROCESSING
// ============================================================

async function processJss(
  htmlData,
  inputUrl
) {

  const parser =
    new DOMParser();


  let doc =
    parser.parseFromString(
      htmlData,
      "text/html"
    );


  const scriptElements =
    doc.querySelectorAll(
      "script[src]"
    );


  for (
    let scriptElement
    of scriptElements
  ) {

    try {

      let scriptSrc =
        scriptElement.getAttribute(
          "src"
        );


      if (
        !scriptSrc
      ) {

        continue;
      }


      if (
        isSkippableAssetUrl(
          scriptSrc
        )
      ) {

        continue;
      }


      if (
        !scriptSrc.startsWith(
          "https://"
        ) &&
        !scriptSrc.startsWith(
          "http://"
        )
      ) {

        scriptSrc =
          getAbsolutePath(
            scriptSrc,
            inputUrl
          ).href;
      }


      if (
        urlJSs.includes(
          scriptSrc
        )
      ) {

        continue;
      }


      urlJSs.push(
        scriptSrc
      );


      const jsData =
        await getData(
          scriptSrc
        );


      if (
        jsData !==
          "Failed" &&
        jsData !==
          ""
      ) {

        zip.file(
          "js/" +
          getTitle(
            scriptSrc
          ) +
          ".js",
          jsData
        );


        let jsFolderLocation =
          maxDepthValue === 0
            ? "js/"
            : "../js/";


        scriptElement.setAttribute(
          "src",
          jsFolderLocation +
          getTitle(
            scriptSrc
          ) +
          ".js"
        );
      }

    } catch (
      error
    ) {

      console.error(
        "JS processing error:",
        error
      );
    }
  }


  return (
    doc.documentElement.outerHTML
  );
}


// ============================================================
// DIRECT HTML5 VIDEO PROCESSING
// ============================================================

/**
 * Process direct HTML5 video files.
 *
 * Supports:
 *
 * <video src="movie.mp4">
 *
 * and:
 *
 * <video>
 *   <source src="movie.mp4">
 * </video>
 *
 * Does NOT attempt to download
 * iframe-based video players such
 * as YouTube or Vimeo.
 */
async function processVideos(
  htmlData,
  inputUrl,
  isRootPage = false
) {

  const parser =
    new DOMParser();


  const doc =
    parser.parseFromString(
      htmlData,
      "text/html"
    );


  zip.folder(
    "video"
  );


  const videoElements =
    doc.querySelectorAll(
      "video[src], video source[src]"
    );


  for (
    const videoElement
    of videoElements
  ) {

    try {

      let videoSrc =
        videoElement.getAttribute(
          "src"
        );


      if (
        !videoSrc
      ) {

        continue;
      }


      /*
       * Blob URLs are temporary
       * browser-created URLs.
       */
      if (
        videoSrc.startsWith(
          "blob:"
        )
      ) {

        console.warn(
          "Skipping blob video:",
          videoSrc
        );


        continue;
      }


      if (
        isSkippableAssetUrl(
          videoSrc
        )
      ) {

        continue;
      }


      /*
       * Convert:
       *
       * //example.com/video.mp4
       *
       * to:
       *
       * https://example.com/video.mp4
       */
      if (
        videoSrc.startsWith(
          "//"
        )
      ) {

        videoSrc =
          "https:" +
          videoSrc;

      } else if (
        !videoSrc.startsWith(
          "https://"
        ) &&
        !videoSrc.startsWith(
          "http://"
        )
      ) {

        videoSrc =
          new URL(
            videoSrc,
            inputUrl
          ).href;
      }


      console.log(
        "Video found:",
        videoSrc
      );


      const videoName =
        getSafeFilename(
          videoSrc,
          "mp4"
        );


      if (
        !urlVideos.includes(
          videoSrc
        )
      ) {

        try {

          console.log(
            "Downloading video:",
            videoSrc
          );


          const videoData =
            await urlToPromise(
              videoSrc
            );


          zip.file(
            "video/" +
            videoName,
            videoData,
            {
              binary:
                true
            }
          );


          urlVideos.push(
            videoSrc
          );


          console.log(
            "Video successfully downloaded:",
            videoName
          );

        } catch (
          fetchError
        ) {

          console.error(
            "Video download failed:",
            videoSrc,
            fetchError
          );


          continue;
        }
      }


      const videoFolderLocation =
        (
          maxDepthValue === 0 ||
          isRootPage
        )
          ? "video/"
          : "../video/";


      videoElement.setAttribute(
        "src",
        videoFolderLocation +
        videoName
      );


      videoElement.removeAttribute(
        "crossorigin"
      );

    } catch (
      error
    ) {

      console.error(
        "Video processing error:",
        error
      );
    }
  }


  return (
    doc.documentElement.outerHTML
  );
}


// ============================================================
// LOCAL VIDEO IMPORT
// ============================================================

/**
 * Determine whether a selected file
 * appears to be a supported video.
 *
 * MIME type is preferred, but some
 * operating systems may provide an
 * empty MIME type, so common file
 * extensions are also accepted.
 */
function isLocalVideoFile(
  file
) {

  if (
    !file ||
    typeof file.name !==
      "string"
  ) {

    return false;
  }


  if (
    file.type &&
    file.type.startsWith(
      "video/"
    )
  ) {

    return true;
  }


  const lower =
    file.name.toLowerCase();


  return (
    lower.endsWith(
      ".mp4"
    ) ||

    lower.endsWith(
      ".webm"
    ) ||

    lower.endsWith(
      ".mov"
    ) ||

    lower.endsWith(
      ".m4v"
    ) ||

    lower.endsWith(
      ".avi"
    ) ||

    lower.endsWith(
      ".mkv"
    )
  );
}


/**
 * Generate a unique filename inside
 * the ZIP's video directory.
 *
 * Example:
 *
 * video.mp4
 *
 * If video.mp4 already exists:
 *
 * video_2.mp4
 *
 * Then:
 *
 * video_3.mp4
 */
function getUniqueVideoFilename(
  originalName
) {

  let safeName =
    getSafeFilename(
      originalName,
      "mp4"
    );


  if (
    !zip.file(
      "video/" +
      safeName
    )
  ) {

    return safeName;
  }


  const dotIndex =
    safeName.lastIndexOf(
      "."
    );


  let baseName =
    safeName;


  let extension =
    "";


  if (
    dotIndex > 0
  ) {

    baseName =
      safeName.substring(
        0,
        dotIndex
      );


    extension =
      safeName.substring(
        dotIndex
      );
  }


  let counter =
    2;


  let candidate =
    `${baseName}_${counter}${extension}`;


  while (
    zip.file(
      "video/" +
      candidate
    )
  ) {

    counter++;


    candidate =
      `${baseName}_${counter}${extension}`;
  }


  return candidate;
}


/**
 * Add videos selected from the
 * user's computer into:
 *
 * video/
 *
 * inside the final ZIP.
 */
async function addLocalVideosToZip() {

  if (
    !Array.isArray(
      selectedLocalVideos
    ) ||
    selectedLocalVideos.length ===
      0
  ) {

    console.log(
      "No local videos selected."
    );


    return;
  }


  zip.folder(
    "video"
  );


  console.log(
    `Adding ${selectedLocalVideos.length} local video(s) to ZIP...`
  );


  let successfullyAdded =
    0;


  for (
    const file
    of selectedLocalVideos
  ) {

    try {

      if (
        !isLocalVideoFile(
          file
        )
      ) {

        console.warn(
          "Skipping unsupported local file:",
          file.name
        );


        continue;
      }


      updateStatus(
        `Adding local video: ${file.name}`
      );


      const videoName =
        getUniqueVideoFilename(
          file.name
        );


      /*
       * Convert the File object to
       * an ArrayBuffer before giving
       * it to JSZip.
       */
      const arrayBuffer =
        await file.arrayBuffer();


      const videoData =
        new Uint8Array(
          arrayBuffer
        );


      zip.file(
        "video/" +
        videoName,
        videoData,
        {
          binary:
            true
        }
      );


      successfullyAdded++;


      console.log(
        "Local video added to ZIP:",
        videoName,
        `(${(
          file.size /
          1024 /
          1024
        ).toFixed(2)} MB)`
      );

    } catch (
      error
    ) {

      console.error(
        "Failed adding local video:",
        file &&
        file.name
          ? file.name
          : "Unknown File",
        error
      );
    }
  }


  console.log(
    `Finished adding local videos. ${successfullyAdded}/${selectedLocalVideos.length} added successfully.`
  );
}


// ============================================================
// HTML PROCESSING
// ============================================================

async function processHTML(
  inputUrl,
  html = "",
  savedPagesMap = null,
  isRootPage = false
) {

  let htmlData =
    html === ""
      ? await getForegroundPageHtml(
          inputUrl
        )
      : html;


  if (
    isFocusMode
  ) {

    try {

      htmlData =
        await applyFocusMode(
          htmlData,
          inputUrl
        );

    } catch (
      err
    ) {

      console.error(
        "Focus Mode crashed.. using original HTML.",
        err
      );
    }
  }


  htmlData =
    await processImages(
      htmlData,
      inputUrl,
      isRootPage
    );


  htmlData =
    await processPdfs(
      htmlData,
      inputUrl
    );


  htmlData =
    await processCSSAndImages(
      htmlData,
      inputUrl
    );


  htmlData =
    await processJss(
      htmlData,
      inputUrl
    );


  htmlData =
    await processVideos(
      htmlData,
      inputUrl,
      isRootPage
    );


  if (
    savedPagesMap
  ) {

    htmlData =
      rewritePageLinks(
        htmlData,
        inputUrl,
        savedPagesMap,
        isRootPage
      );
  }


  return htmlData;
}


// ============================================================
// LINK / PAGE PROCESSING
// ============================================================

async function processLinks() {

  // ==========================================================
  // DEPTH 0
  // ==========================================================

  if (
    maxDepthValue == 0
  ) {

    updateStatus(
      "Saving current page..."
    );


    const html =
      await processHTML(
        currentPage
      );


    zip.file(
      getTitle(
        currentPage
      ) +
      ".html",
      html
    );


    updateProgress(
      1,
      1
    );


    return;
  }


  // ==========================================================
  // DEPTH 1
  // ==========================================================

  if (
    maxDepthValue == 1
  ) {

    updateStatus(
      depthOneMode ===
        "manual"
        ? "Foreground crawl is running. Saving selected linked pages."
        : "Foreground crawl is running. Saving the starting page and first-level linked pages."
    );


    let urls;


    // ========================================================
    // MANUAL DEPTH 1
    // ========================================================

    if (
      depthOneMode ===
        "manual" &&
      selectedManualLinks.length >
        0
    ) {

      urls =
        new Set(
          selectedManualLinks.filter(
            (url) =>
              url &&
              !url.startsWith(
                "javascript:"
              ) &&
              !url.startsWith(
                "about:"
              )
          )
        );


    // ========================================================
    // FOCUS MODE DEPTH 1
    // ========================================================

    } else if (
      isFocusMode
    ) {

      updateStatus(
        "Applying Focus Mode to find valid article links..."
      );


      let rawHtml =
        await getForegroundPageHtml(
          currentPage
        );


      let focusedHtml =
        await applyFocusMode(
          rawHtml,
          currentPage
        );


      urls =
        extractLinksFromHtml(
          focusedHtml,
          currentPage,
          isRestrictDomain
        );


    // ========================================================
    // NORMAL DEPTH 1
    // ========================================================

    } else {

      urls =
        await getForegroundLinks(
          currentPage
        );
    }


    // ========================================================
    // MAP ONLINE URLS TO LOCAL FILES
    // ========================================================

    const savedPagesMap =
      new Map();


    savedPagesMap.set(
      currentPage,
      getTitle(
        currentPage
      ) +
      ".html"
    );


    for (
      let url
      of urls
    ) {

      savedPagesMap.set(
        url,
        "html/" +
        getTitle(
          url
        ) +
        ".html"
      );
    }


    let totalPages =
      urls.size +
      1;


    let completedPages =
      0;


    // ========================================================
    // ROOT PAGE
    // ========================================================

    let rootHtml =
      await processHTML(
        currentPage,
        "",
        savedPagesMap,
        true
      );


    zip.file(
      getTitle(
        currentPage
      ) +
      ".html",
      rootHtml
    );


    completedPages++;


    updateProgress(
      completedPages,
      totalPages
    );


    // ========================================================
    // FIRST-LEVEL PAGES
    // ========================================================

    for (
      let url
      of urls
    ) {

      try {

        updateStatus(
          depthOneMode ===
            "manual"
            ? "Foreground crawl is running. Saving selected linked pages."
            : "Foreground crawl is running. Saving linked pages..."
        );


        let html =
          await processHTML(
            url,
            "",
            savedPagesMap,
            false
          );


        zip.file(
          "html/" +
          getTitle(
            url
          ) +
          ".html",
          html
        );


        completedPages++;


        updateProgress(
          completedPages,
          totalPages
        );


        await new Promise(
          (
            resolve
          ) =>
            requestAnimationFrame(
              resolve
            )
        );

      } catch (
        error
      ) {

        console.error(
          "Failed processing page:",
          url,
          error
        );
      }
    }


    return;
  }


  // ==========================================================
  // DEPTH > 1
  // ==========================================================

  updateStatus(
    "Depth greater than 1 is still experimental in this alpha build."
  );


  console.warn(
    "Depth > 1 is still experimental in this alpha build."
  );
}


// ============================================================
// START SCRAPING
// ============================================================

async function startScrapingProcess() {

  try {

    // ========================================================
    // RESET PROGRESS
    // ========================================================

    if (
      currentProgress
    ) {

      currentProgress.innerText =
        "0%";


      currentProgress.style.display =
        "inline";
    }


    if (
      progressBar
    ) {

      progressBar.style.display =
        "flex";


      progressBar.style.width =
        "0%";
    }


    updateStatus(
      "Foreground crawl is running. Please keep this window open."
    );


    // ========================================================
    // SCRAPE WEBSITE
    // ========================================================

    await processLinks();


    // ========================================================
    // ADD LOCAL VIDEOS
    // ========================================================

    if (
      selectedLocalVideos.length >
      0
    ) {

      updateStatus(
        selectedLocalVideos.length ===
          1
          ? "Adding selected local video..."
          : `Adding ${selectedLocalVideos.length} selected local videos...`
      );


      await addLocalVideosToZip();
    }


    // ========================================================
    // PREPARE ZIP
    // ========================================================

    updateStatus(
      "Preparing ZIP download..."
    );


    if (
      currentProgress
    ) {

      currentProgress.innerText =
        "100%";
    }


    if (
      progressBar
    ) {

      progressBar.style.width =
        "100%";
    }


    const zipName =
      new URL(
        startingURLInput
      ).hostname;


    // ========================================================
    // GENERATE ZIP
    // ========================================================

    const content =
      await zip.generateAsync({
        type:
          "blob"
      });


    updateStatus(
      "Starting download..."
    );


    const urlBlob =
      URL.createObjectURL(
        content
      );


    // ========================================================
    // DOWNLOAD ZIP
    // ========================================================

    const downloadId =
      await chrome.downloads.download({

        url:
          urlBlob,

        filename:
          zipName +
          ".zip",

        saveAs:
          true
      });


    // ========================================================
    // WAIT FOR DOWNLOAD COMPLETION
    // ========================================================

    chrome.downloads.onChanged.addListener(
      function listener(
        downloadItem
      ) {

        if (
          downloadItem.id ===
            downloadId &&
          downloadItem.state &&
          downloadItem.state.current ===
            "complete"
        ) {

          chrome.downloads.onChanged.removeListener(
            listener
          );


          if (
            feedbackFormSection
          ) {

            feedbackFormSection.style.display =
              "block";
          }


          if (
            currentProgress
          ) {

            currentProgress.innerText =
              "100%";
          }


          if (
            progressBar
          ) {

            progressBar.style.width =
              "100%";
          }


          updateStatus(
            "Download complete. Your ZIP should now be in Finder."
          );


          setDownloadFlag(
            false
          );


          /*
           * Clean up the temporary
           * object URL.
           */
          URL.revokeObjectURL(
            urlBlob
          );


          /*
           * Create a fresh ZIP
           * instance for the next
           * download.
           */
          zip =
            new JSZip();


          /*
           * Reset asset tracking.
           */
          urlList =
            [];


          urlCSSs =
            [];


          urlImages =
            [];


          urlVideos =
            [];


          urlJSs =
            [];


          urlPdfs =
            [];


          selectedLocalVideos =
            [];
        }
      }
    );

  } catch (
    error
  ) {

    console.error(
      "Error in scraping/ZIP/download process:",
      error
    );


    updateStatus(
      "Download failed. Check the console for details."
    );


    setDownloadFlag(
      false
    );
  }
}


// ============================================================
// FOCUS MODE
// ============================================================

/**
 * Uses Mozilla's Readability
 * library to extract the main
 * content and inject it into
 * a local HTML template.
 */
async function applyFocusMode(
  htmlData,
  inputUrl
) {

  const parser =
    new DOMParser();


  const doc =
    parser.parseFromString(
      htmlData,
      "text/html"
    );


  // ==========================================================
  // NORMALIZE LINKS
  // ==========================================================

  doc
    .querySelectorAll(
      "a[href]"
    )
    .forEach(
      (
        anchor
      ) => {

        try {

          let rawHref =
            anchor.getAttribute(
              "href"
            );


          if (
            rawHref &&
            !rawHref.startsWith(
              "http"
            ) &&
            !rawHref.startsWith(
              "mailto:"
            ) &&
            !rawHref.startsWith(
              "tel:"
            ) &&
            !rawHref.startsWith(
              "#"
            )
          ) {

            let absoluteUrl =
              new URL(
                rawHref,
                inputUrl
              ).href;


            anchor.setAttribute(
              "href",
              absoluteUrl
            );
          }

        } catch (
          e
        ) {}
      }
    );


  // ==========================================================
  // NORMALIZE MEDIA SOURCES
  // ==========================================================

  doc
    .querySelectorAll(
      "img[src], video[src], source[src]"
    )
    .forEach(
      (
        media
      ) => {

        try {

          let rawSrc =
            media.getAttribute(
              "src"
            );


          if (
            rawSrc &&
            !rawSrc.startsWith(
              "http"
            ) &&
            !rawSrc.startsWith(
              "data:"
            )
          ) {

            if (
              rawSrc.startsWith(
                "//"
              )
            ) {

              media.setAttribute(
                "src",
                "https:" +
                rawSrc
              );

            } else {

              let absoluteUrl =
                new URL(
                  rawSrc,
                  inputUrl
                ).href;


              media.setAttribute(
                "src",
                absoluteUrl
              );
            }
          }

        } catch (
          e
        ) {}
      }
    );


  // ==========================================================
  // READABILITY
  // ==========================================================

  const reader =
    new Readability(
      doc
    );


  const article =
    reader.parse();


  if (
    !article ||
    !article.content
  ) {

    console.warn(
      "Focus Mode: Readability could not parse the page.. Saving original"
    );


    return htmlData;
  }


  console.log(
    "Successfully found the article content"
  );


  // ==========================================================
  // LOAD TEMPLATE
  // ==========================================================

  const templateRes =
    await fetch(
      "../html/template.html"
    );


  let cleanHtml =
    await templateRes.text();


  const safeTitle =
    article.title ||
    "Saved Page";


  const safeByline =
    article.byline
      ? `<div class="byline">${article.byline}</div>`
      : "";


  cleanHtml =
    cleanHtml.replace(
      /{{TITLE}}/g,
      safeTitle
    );


  cleanHtml =
    cleanHtml.replace(
      "{{BYLINE}}",
      safeByline
    );


  cleanHtml =
    cleanHtml.replace(
      "{{CONTENT}}",
      article.content
    );


  return cleanHtml;
}


// ============================================================
// FOCUS MODE LINK EXTRACTION
// ============================================================

/**
 * Extract links from an HTML
 * string.
 *
 * Used specifically when links
 * become inaccessible or changed
 * through Focus Mode.
 */
function extractLinksFromHtml(
  htmlData,
  rootPage,
  restrictDomain
) {

  const parser =
    new DOMParser();


  const doc =
    parser.parseFromString(
      htmlData,
      "text/html"
    );


  const links =
    [];


  for (
    const anchor
    of doc.querySelectorAll(
      "a[href]"
    )
  ) {

    const href =
      anchor.getAttribute(
        "href"
      );


    if (
      !href
    ) {

      continue;
    }


    if (
      href.startsWith(
        "mailto:"
      ) ||

      href.startsWith(
        "tel:"
      ) ||

      href.startsWith(
        "#"
      )
    ) {

      continue;
    }


    try {

      const absoluteUrl =
        new URL(
          href,
          rootPage
        ).href;


      if (
        restrictDomain
      ) {

        const startHost =
          new URL(
            rootPage
          ).hostname;


        const linkHost =
          new URL(
            absoluteUrl
          ).hostname;


        if (
          startHost !==
          linkHost
        ) {

          continue;
        }
      }


      if (
        !links.includes(
          absoluteUrl
        )
      ) {

        links.push(
          absoluteUrl
        );
      }

    } catch (
      e
    ) {

      continue;
    }
  }


  return new Set(
    links
  );
}


// ============================================================
// SAFE FILENAME
// ============================================================

/**
 * Extract a safe filename from
 * a URL or local filename.
 */
function getSafeFilename(
  url,
  defaultExt = "file"
) {

  let cleanUrl =
    String(
      url ||
      ""
    )
      .split(
        "?"
      )[0]
      .split(
        "#"
      )[0];


  let filename =
    cleanUrl.substring(
      cleanUrl.lastIndexOf(
        "/"
      ) +
      1
    );


  filename =
    filename.replace(
      /[^a-zA-Z0-9.\-_]/g,
      ""
    );


  if (
    filename.length >
    100
  ) {

    filename =
      filename.substring(
        filename.length -
        100
      );
  }


  if (
    !filename
  ) {

    filename =
      "asset_" +
      Math.floor(
        Math.random() *
        100000
      ) +
      "." +
      defaultExt;
  }


  return filename;
}


// ============================================================
// WINDOW SIZE
// ============================================================

/**
 * Try to snap the popup back
 * if the user resizes or
 * fullscreen-changes it.
 */
function enforceWindowSize() {

  try {

    window.resizeTo(
      FIXED_WINDOW_WIDTH,
      FIXED_WINDOW_HEIGHT
    );

  } catch (
    error
  ) {

    console.warn(
      "Unable to resize popup window:",
      error
    );
  }
}


// ============================================================
// WINDOW LOAD
// ============================================================

window.addEventListener(
  "load",
  () => {

    enforceWindowSize();
  }
);


// ============================================================
// WINDOW RESIZE
// ============================================================

window.addEventListener(
  "resize",
  () => {

    enforceWindowSize();
  }
);


// ============================================================
// FULLSCREEN
// ============================================================

document.addEventListener(
  "fullscreenchange",
  () => {

    enforceWindowSize();
  }
);


// ============================================================
// BLOCK F11
// ============================================================

window.addEventListener(
  "keydown",
  (
    e
  ) => {

    if (
      e.key ===
      "F11"
    ) {

      e.preventDefault();
    }
  }
);