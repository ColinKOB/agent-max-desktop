/**
 * Workspace API Server
 *
 * HTTP server that exposes workspace functionality to the Python backend.
 * Runs on port 3847 and provides endpoints for:
 * - Browser-based workspace management
 * - Web navigation (go to URL, search, back, forward)
 * - Input injection (click, type, scroll)
 * - Page content extraction
 * - Frame capture for PiP
 * - Credentials retrieval
 */

const http = require('http');
const url = require('url');

// Import workspace manager
const { workspaceManager } = require('../workspace/workspaceManager.cjs');

// Store references
let mainWindow = null;
let server = null;

// Port for the API server
const API_PORT = 3847;

/**
 * Parse JSON body from request
 */
async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

/**
 * Send JSON response
 */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

/**
 * Handle workspace API requests
 */
async function handleRequest(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  try {
    // =========================================================================
    // Health & Status
    // =========================================================================

    if (pathname === '/health' && req.method === 'GET') {
      return sendJson(res, 200, {
        status: 'ok',
        timestamp: new Date().toISOString(),
        workspaceActive: workspaceManager.getIsActive()
      });
    }

    // =========================================================================
    // Workspace Management
    // =========================================================================

    if (pathname === '/workspace/create' && req.method === 'POST') {
      const body = await parseBody(req);
      const width = body.width || 1280;
      const height = body.height || 800;

      const result = await workspaceManager.create(width, height);
      return sendJson(res, result.success ? 200 : 500, result);
    }

    if (pathname === '/workspace/destroy' && req.method === 'POST') {
      const result = workspaceManager.destroy();
      return sendJson(res, 200, result);
    }

    if (pathname === '/workspace/status') {
      const tabs = workspaceManager.listTabs();
      return sendJson(res, 200, {
        active: workspaceManager.getIsActive(),
        windowId: workspaceManager.getWindowId(),
        url: workspaceManager.getCurrentUrl(),
        title: workspaceManager.getPageTitle(),
        activeTabId: tabs.activeTabId,
        totalTabs: tabs.totalTabs
      });
    }

    // =========================================================================
    // Tab Management
    // =========================================================================

    if (pathname === '/workspace/tab/create' && req.method === 'POST') {
      const body = await parseBody(req);
      const url = body.url || 'https://www.google.com';
      const result = await workspaceManager.createTab(url);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/workspace/tab/close' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.tabId) {
        return sendJson(res, 400, { success: false, error: 'tabId required' });
      }
      const result = workspaceManager.closeTab(body.tabId);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/workspace/tab/switch' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.tabId) {
        return sendJson(res, 400, { success: false, error: 'tabId required' });
      }
      const result = workspaceManager.switchTab(body.tabId);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/workspace/tabs/list' && req.method === 'GET') {
      const result = workspaceManager.listTabs();
      return sendJson(res, 200, result);
    }

    if (pathname === '/workspace/tab/info' && req.method === 'GET') {
      const parsedUrl = url.parse(req.url, true);
      const tabId = parsedUrl.query.tabId ? parseInt(parsedUrl.query.tabId, 10) : null;
      if (!tabId) {
        return sendJson(res, 400, { success: false, error: 'tabId required' });
      }
      const result = workspaceManager.getTabInfo(tabId);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    // =========================================================================
    // Frame Capture
    // =========================================================================

    if (pathname === '/workspace/capture-frame' && req.method === 'POST') {
      const frame = await workspaceManager.captureFrame();
      if (frame) {
        return sendJson(res, 200, { success: true, frame });
      }
      return sendJson(res, 400, { success: false, error: 'Capture failed' });
    }

    if (pathname === '/workspace/get-frame' && req.method === 'GET') {
      const frame = workspaceManager.getLastFrame();
      if (frame) {
        return sendJson(res, 200, { success: true, frame });
      }
      return sendJson(res, 400, { success: false, error: 'No frame available' });
    }

    // =========================================================================
    // Navigation
    // =========================================================================

    if (pathname === '/workspace/navigate' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.url) {
        return sendJson(res, 400, { success: false, error: 'URL required' });
      }
      const result = await workspaceManager.navigateTo(body.url);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/workspace/back' && req.method === 'POST') {
      const result = await workspaceManager.goBack();
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/workspace/forward' && req.method === 'POST') {
      const result = await workspaceManager.goForward();
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/workspace/reload' && req.method === 'POST') {
      const result = await workspaceManager.reload();
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/workspace/search' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.query) {
        return sendJson(res, 400, { success: false, error: 'Query required' });
      }
      const result = await workspaceManager.searchGoogle(body.query);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    // =========================================================================
    // Input Actions
    // =========================================================================

    if (pathname === '/workspace/click' && req.method === 'POST') {
      const body = await parseBody(req);
      if (body.x === undefined || body.y === undefined) {
        return sendJson(res, 400, { success: false, error: 'x and y coordinates required' });
      }
      const result = await workspaceManager.clickAt(body.x, body.y, {
        button: body.button || 'left',
        clickCount: body.clickCount || 1
      });
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/workspace/double-click' && req.method === 'POST') {
      const body = await parseBody(req);
      if (body.x === undefined || body.y === undefined) {
        return sendJson(res, 400, { success: false, error: 'x and y coordinates required' });
      }
      const result = await workspaceManager.doubleClick(body.x, body.y);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/workspace/right-click' && req.method === 'POST') {
      const body = await parseBody(req);
      if (body.x === undefined || body.y === undefined) {
        return sendJson(res, 400, { success: false, error: 'x and y coordinates required' });
      }
      const result = await workspaceManager.rightClick(body.x, body.y);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/workspace/type' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.text) {
        return sendJson(res, 400, { success: false, error: 'Text required' });
      }
      const result = await workspaceManager.typeText(body.text);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/workspace/press-key' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.key) {
        return sendJson(res, 400, { success: false, error: 'Key required' });
      }
      const result = await workspaceManager.pressKey(body.key, body.modifiers || []);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/workspace/scroll' && req.method === 'POST') {
      const body = await parseBody(req);
      const result = await workspaceManager.scroll(
        body.deltaX || 0,
        body.deltaY || 0,
        body.x,
        body.y
      );
      return sendJson(res, result.success ? 200 : 400, result);
    }

    // =========================================================================
    // Element-based Actions
    // =========================================================================

    if (pathname === '/workspace/click-element' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.selector) {
        return sendJson(res, 400, { success: false, error: 'Selector required' });
      }
      const result = await workspaceManager.clickElement(body.selector);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/workspace/type-into-element' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.selector || !body.text) {
        return sendJson(res, 400, { success: false, error: 'Selector and text required' });
      }
      const result = await workspaceManager.typeIntoElement(body.selector, body.text);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/workspace/find-elements' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.selector) {
        return sendJson(res, 400, { success: false, error: 'Selector required' });
      }
      const result = await workspaceManager.findElements(body.selector);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    // =========================================================================
    // Smart Shopping Tools
    // =========================================================================

    if (pathname === '/workspace/search-site' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.site || !body.query) {
        return sendJson(res, 400, { success: false, error: 'Site and query required' });
      }
      const result = await workspaceManager.searchSite(body.site, body.query);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/workspace/click-by-text' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.text) {
        return sendJson(res, 400, { success: false, error: 'Text required' });
      }
      const result = await workspaceManager.clickByText(body.text, {
        exact: body.exact || false,
        index: body.index || 0
      });
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/workspace/wait-for-element' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.selector) {
        return sendJson(res, 400, { success: false, error: 'Selector required' });
      }
      const result = await workspaceManager.waitForElement(body.selector, {
        timeout: body.timeout || 10000,
        interval: body.interval || 200
      });
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/workspace/wait-for-text' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.text) {
        return sendJson(res, 400, { success: false, error: 'Text required' });
      }
      const result = await workspaceManager.waitForText(body.text, {
        timeout: body.timeout || 10000,
        interval: body.interval || 200
      });
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/workspace/get-cart-count' && req.method === 'GET') {
      const result = await workspaceManager.getCartCount();
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/workspace/get-product-links' && req.method === 'GET') {
      const parsedUrl = url.parse(req.url, true);
      const limit = parsedUrl.query.limit ? parseInt(parsedUrl.query.limit, 10) : 10;
      const result = await workspaceManager.getProductLinks({ limit });
      return sendJson(res, result.success ? 200 : 400, result);
    }

    // =========================================================================
    // Page Content
    // =========================================================================

    if (pathname === '/workspace/get-text' && req.method === 'GET') {
      const result = await workspaceManager.getPageText();
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/workspace/get-html' && req.method === 'GET') {
      const result = await workspaceManager.getPageHtml();
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/workspace/get-links' && req.method === 'GET') {
      const result = await workspaceManager.getLinks();
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/workspace/get-buttons' && req.method === 'GET') {
      const result = await workspaceManager.getButtons();
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/workspace/get-inputs' && req.method === 'GET') {
      const result = await workspaceManager.getInputFields();
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/workspace/execute-script' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.script) {
        return sendJson(res, 400, { success: false, error: 'Script required' });
      }
      const result = await workspaceManager.executeScript(body.script);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    // =========================================================================
    // Workspace Window Management
    // =========================================================================

    if (pathname === '/workspace/minimize' && req.method === 'POST') {
      const result = workspaceManager.minimize();
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/workspace/restore' && req.method === 'POST') {
      const result = workspaceManager.restore();
      return sendJson(res, result.success ? 200 : 400, result);
    }

    // =========================================================================
    // Activity Log API Routes
    // =========================================================================

    if (pathname === '/workspace/activity-log' && req.method === 'GET') {
      const parsedUrl = url.parse(req.url, true);
      const { limit, sessionId, actionType } = parsedUrl.query;
      const log = workspaceManager.getActivityLog({
        limit: limit ? parseInt(limit, 10) : 100,
        sessionId: sessionId || null,
        actionType: actionType || null
      });
      return sendJson(res, 200, { success: true, log });
    }

    if (pathname === '/workspace/sessions' && req.method === 'GET') {
      const sessions = workspaceManager.getSessions();
      return sendJson(res, 200, { success: true, sessions });
    }

    if (pathname === '/workspace/activity-log/clear' && req.method === 'POST') {
      const result = workspaceManager.clearActivityLog();
      return sendJson(res, 200, result);
    }

    // =========================================================================
    // Credentials API Routes
    // =========================================================================

    if (pathname === '/credentials/list' && req.method === 'GET') {
      if (!mainWindow) {
        return sendJson(res, 500, { success: false, error: 'Main window not available' });
      }

      try {
        const credentials = await mainWindow.webContents.executeJavaScript(`
          (async () => {
            const { getCredentialsSummary } = await import('./src/services/credentialsManager.js');
            return await getCredentialsSummary();
          })()
        `);
        return sendJson(res, 200, { success: true, credentials });
      } catch (e) {
        console.error('[WorkspaceAPI] Failed to get credentials:', e);
        return sendJson(res, 500, { success: false, error: e.message });
      }
    }

    if (pathname === '/credentials/get-for-service' && req.method === 'POST') {
      const body = await parseBody(req);
      const { service } = body;

      if (!service) {
        return sendJson(res, 400, { success: false, error: 'Service name required' });
      }

      if (!mainWindow) {
        return sendJson(res, 500, { success: false, error: 'Main window not available' });
      }

      try {
        const credentials = await mainWindow.webContents.executeJavaScript(`
          (async () => {
            const { getCredentialsForService } = await import('./src/services/credentialsManager.js');
            return await getCredentialsForService('${service.replace(/'/g, "\\'")}');
          })()
        `);
        return sendJson(res, 200, { success: true, credentials });
      } catch (e) {
        console.error('[WorkspaceAPI] Failed to get credentials for service:', e);
        return sendJson(res, 500, { success: false, error: e.message });
      }
    }

    if (pathname === '/credentials/get-decrypted' && req.method === 'POST') {
      const body = await parseBody(req);
      const { id } = body;

      if (!id) {
        return sendJson(res, 400, { success: false, error: 'Credential ID required' });
      }

      if (!mainWindow) {
        return sendJson(res, 500, { success: false, error: 'Main window not available' });
      }

      try {
        const credential = await mainWindow.webContents.executeJavaScript(`
          (async () => {
            const { getCredentialDecrypted } = await import('./src/services/credentialsManager.js');
            return await getCredentialDecrypted('${id.replace(/'/g, "\\'")}');
          })()
        `);
        return sendJson(res, 200, { success: true, credential });
      } catch (e) {
        console.error('[WorkspaceAPI] Failed to get decrypted credential:', e);
        return sendJson(res, 500, { success: false, error: e.message });
      }
    }

    // 404 for unknown routes
    return sendJson(res, 404, { error: 'Not found', path: pathname });

  } catch (e) {
    console.error('[WorkspaceAPI] Request error:', e);
    return sendJson(res, 500, { error: e.message });
  }
}

/**
 * Start the workspace API server
 */
function startServer(window) {
  mainWindow = window;

  if (server) {
    console.log('[WorkspaceAPI] Server already running');
    return;
  }

  server = http.createServer(handleRequest);

  server.listen(API_PORT, '127.0.0.1', () => {
    console.log(`[WorkspaceAPI] Server listening on http://127.0.0.1:${API_PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[WorkspaceAPI] Port ${API_PORT} already in use, server not started`);
    } else {
      console.error('[WorkspaceAPI] Server error:', err);
    }
  });
}

/**
 * Stop the workspace API server
 */
function stopServer() {
  // Destroy workspace if active
  if (workspaceManager.getIsActive()) {
    workspaceManager.destroy();
  }

  if (server) {
    server.close(() => {
      console.log('[WorkspaceAPI] Server stopped');
    });
    server = null;
  }
}

/**
 * Update the main window reference
 */
function setMainWindow(window) {
  mainWindow = window;
}

/**
 * Get workspace manager for direct access
 */
function getWorkspaceManager() {
  return workspaceManager;
}

module.exports = {
  startServer,
  stopServer,
  setMainWindow,
  getWorkspaceManager
};
