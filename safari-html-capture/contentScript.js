// contentScript.js
// Runs in all frames; responds to capture requests from the extension

const MAX_DEFAULT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB default; can be overridden per request

function serializeDoctype(doc) {
  const dt = doc.doctype;
  if (!dt) return "";
  const name = dt.name || "html";
  const publicId = dt.publicId || "";
  const systemId = dt.systemId || "";

  if (!publicId && !systemId) {
    return `<!DOCTYPE ${name}>\n`;
  }

  let id = "";
  if (publicId) {
    id += ` PUBLIC \"${publicId}\"`;
  }
  if (systemId) {
    if (!publicId) {
      id += " SYSTEM";
    }
    id += ` \"${systemId}\"`;
  }
  return `<!DOCTYPE ${name}${id}>\n`;
}

function safeGetFrameInfo(win) {
  try {
    const doc = win.document;
    const url = doc.location && doc.location.href ? doc.location.href : "about:blank";
    const title = doc.title || url;
    return { accessible: true, url, title };
  } catch (e) {
    return { accessible: false, url: null, title: "Cross-origin frame (locked)" };
  }
}

function listTopLevelFrames() {
  const frames = [];
  // index 0 is always top-level document
  frames.push({
    index: 0,
    isTop: true,
    accessible: true,
    url: window.location.href,
    title: document.title || window.location.href,
  });

  for (let i = 0; i < window.frames.length; i++) {
    const info = safeGetFrameInfo(window.frames[i]);
    frames.push({
      index: i + 1, // 0 reserved for top-level
      isTop: false,
      accessible: info.accessible,
      url: info.url,
      title: info.title,
    });
  }

  return frames;
}

function captureDocument(targetDoc, sizeLimitBytes) {
  const doctype = serializeDoctype(targetDoc);
  const html = targetDoc.documentElement ? targetDoc.documentElement.outerHTML : "";
  const full = doctype + html;
  const size = new Blob([full]).size;

  if (sizeLimitBytes && size > sizeLimitBytes) {
    return {
      ok: false,
      error: "SIZE_LIMIT_EXCEEDED",
      size,
      sizeLimitBytes,
    };
  }

  return {
    ok: true,
    html: full,
    size,
  };
}

async function performCapture(options) {
  const {
    delayMs = 0,
    frameIndex = 0,
    sizeLimitBytes = MAX_DEFAULT_SIZE_BYTES,
  } = options || {};

  if (delayMs && delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  let targetDoc = document;

  if (frameIndex && frameIndex > 0) {
    const idx = frameIndex - 1;
    if (idx >= 0 && idx < window.frames.length) {
      try {
        targetDoc = window.frames[idx].document;
      } catch (e) {
        return {
          ok: false,
          error: "FRAME_INACCESSIBLE",
          message:
            "The selected frame is cross-origin and cannot be accessed due to browser security policy.",
        };
      }
    } else {
      return {
        ok: false,
        error: "FRAME_INDEX_OUT_OF_RANGE",
        message: "Requested frame index is out of range for this page.",
      };
    }
  }

  try {
    if (!targetDoc.documentElement) {
      return {
        ok: false,
        error: "NO_DOCUMENT_ELEMENT",
        message: "The page does not have a root HTML element to serialize.",
      };
    }

    // Attempt to detect non-HTML documents (very rough heuristic)
    const contentType = targetDoc.contentType || "";
    if (contentType && !/html/i.test(contentType)) {
      return {
        ok: false,
        error: "NON_HTML_DOCUMENT",
        contentType,
        message:
          "The current page is not HTML (e.g., PDF or binary file). Try downloading the original resource instead.",
      };
    }

    return captureDocument(targetDoc, sizeLimitBytes);
  } catch (e) {
    return {
      ok: false,
      error: "CAPTURE_EXCEPTION",
      message: e && e.message ? e.message : String(e),
    };
  }
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  if (message.type === "LIST_FRAMES") {
    try {
      const frames = listTopLevelFrames();
      sendResponse({ ok: true, frames });
    } catch (e) {
      sendResponse({ ok: false, error: "LIST_FRAMES_FAILED", message: String(e) });
    }
    return true; // async response allowed
  }

  if (message.type === "CAPTURE_HTML") {
    const options = message.options || {};

    performCapture(options)
      .then((result) => {
        sendResponse(result);
      })
      .catch((e) => {
        sendResponse({ ok: false, error: "CAPTURE_EXCEPTION", message: String(e) });
      });

    return true; // keep the message channel open for async
  }
});
