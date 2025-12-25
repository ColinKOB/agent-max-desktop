/**
 * AI Workspace Manager
 *
 * Creates and manages an isolated BrowserWindow where the AI can perform
 * web browsing, research, and other tasks without hijacking the user's
 * mouse and keyboard.
 *
 * Features:
 * - Isolated browser window with full web capabilities
 * - Screenshot capture for PiP viewer
 * - Programmatic navigation and interaction
 * - Click, type, scroll actions via coordinates or selectors
 */

const { BrowserWindow, screen, desktopCapturer, ipcMain } = require('electron');
const path = require('path');
const crypto = require('crypto');

// Generate UUID v4 using built-in crypto (works in CJS without ESM uuid package)
function uuidv4() {
  return crypto.randomUUID();
}

class WorkspaceManager {
  constructor() {
    this.workspaceWindow = null;
    this.isActive = false;
    this.isMinimized = false;  // Track if window is minimized (hidden but running)
    this.captureInterval = null;
    this.lastFrame = null;
    this.frameListeners = new Set();

    // Default workspace size
    this.width = 1280;
    this.height = 800;

    // Activity logging - track all AI actions
    this.activityLog = [];
    this.currentSessionId = null;
    this.maxLogEntries = 1000;  // Keep last 1000 entries
  }

  // ===========================================================================
  // Activity Logging
  // ===========================================================================

  /**
   * Log an activity to the activity log
   */
  logActivity(action, parameters = {}, result = 'success', error = null) {
    if (!this.currentSessionId) {
      this.currentSessionId = uuidv4();
    }

    const entry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      sessionId: this.currentSessionId,
      action,
      parameters,
      result: error ? 'error' : result,
      error: error || null,
      pageTitle: this.getPageTitle() || '',
      pageUrl: this.getCurrentUrl() || ''
    };

    this.activityLog.push(entry);

    // Trim log if too long
    if (this.activityLog.length > this.maxLogEntries) {
      this.activityLog = this.activityLog.slice(-this.maxLogEntries);
    }

    console.log(`[Workspace Activity] ${action}:`, JSON.stringify(parameters).slice(0, 100));
    return entry;
  }

  /**
   * Get the activity log
   */
  getActivityLog(options = {}) {
    const { limit = 100, sessionId = null, actionType = null } = options;

    let log = [...this.activityLog];

    // Filter by session if specified
    if (sessionId) {
      log = log.filter(entry => entry.sessionId === sessionId);
    }

    // Filter by action type if specified
    if (actionType) {
      log = log.filter(entry => entry.action === actionType);
    }

    // Return most recent entries up to limit
    return log.slice(-limit).reverse();
  }

  /**
   * Clear the activity log
   */
  clearActivityLog() {
    this.activityLog = [];
    console.log('[Workspace] Activity log cleared');
    return { success: true };
  }

  /**
   * Get unique sessions from the activity log
   */
  getSessions() {
    const sessions = new Map();

    for (const entry of this.activityLog) {
      if (!sessions.has(entry.sessionId)) {
        sessions.set(entry.sessionId, {
          sessionId: entry.sessionId,
          startTime: entry.timestamp,
          endTime: entry.timestamp,
          actionCount: 0
        });
      }
      const session = sessions.get(entry.sessionId);
      session.endTime = entry.timestamp;
      session.actionCount++;
    }

    return Array.from(sessions.values()).reverse();
  }

  /**
   * Create the AI workspace window
   */
  async create(width = 1280, height = 800) {
    if (this.workspaceWindow && !this.workspaceWindow.isDestroyed()) {
      console.log('[Workspace] Already exists, returning existing window');
      return { success: true, windowId: this.workspaceWindow.id };
    }

    this.width = width;
    this.height = height;

    // Get primary display to position workspace
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    // Create the workspace window with Max's Computer branding
    // Using hiddenInset titleBarStyle for custom look on macOS
    this.workspaceWindow = new BrowserWindow({
      width: this.width,
      height: this.height,
      x: Math.floor((screenWidth - this.width) / 2),
      y: Math.floor((screenHeight - this.height) / 2),
      show: false, // Start hidden, show when ready
      frame: true,
      titleBarStyle: 'hiddenInset', // Allows custom title bar overlay
      trafficLightPosition: { x: 12, y: 12 }, // Position traffic lights
      title: "Max's Computer",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        // Enable features needed for web browsing
        allowRunningInsecureContent: false,
        experimentalFeatures: false,
        // Preload script for workspace-specific functionality
        preload: path.join(__dirname, 'workspacePreload.cjs')
      },
      // Show in taskbar so user knows it's Max's window
      skipTaskbar: false,
      // Distinctive purple/blue background for Max branding
      backgroundColor: '#1a1a2e'
    });

    // Set user agent to standard Chrome
    this.workspaceWindow.webContents.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Handle window events
    this.workspaceWindow.on('closed', () => {
      this.cleanup();
    });

    // Inject "Max's Computer" branding header after each page load
    this.workspaceWindow.webContents.on('did-finish-load', () => {
      this.injectBrandingHeader();
    });

    // Load a start page
    await this.workspaceWindow.loadURL('https://www.google.com');

    // Show the window
    this.workspaceWindow.show();
    this.isActive = true;
    this.isMinimized = false;

    // Start a new session
    this.currentSessionId = uuidv4();
    this.logActivity('session_start', { width, height });

    // NOTE: Frame capture disabled for performance
    // The 10 FPS capture was causing significant slowdown
    // Re-enable with this.startFrameCapture(2) if PiP viewer is needed
    // this.startFrameCapture();

    console.log('[Workspace] Created workspace window:', this.workspaceWindow.id);
    return { success: true, windowId: this.workspaceWindow.id };
  }

  /**
   * Destroy the workspace window (ends session completely)
   */
  destroy() {
    this.logActivity('session_end', {});
    this.cleanup();

    if (this.workspaceWindow && !this.workspaceWindow.isDestroyed()) {
      this.workspaceWindow.close();
      this.workspaceWindow = null;
    }

    this.isActive = false;
    this.isMinimized = false;
    // Start a new session ID for next time
    this.currentSessionId = null;
    console.log('[Workspace] Destroyed');
    return { success: true };
  }

  /**
   * Minimize the workspace (hides PiP but keeps running)
   */
  minimize() {
    if (!this.getIsActive()) {
      return { success: false, error: 'Workspace not active' };
    }

    this.isMinimized = true;
    this.logActivity('minimize', {});
    console.log('[Workspace] Minimized (still running in background)');
    return { success: true, isMinimized: true };
  }

  /**
   * Restore/show the workspace after minimizing
   */
  restore() {
    if (!this.getIsActive()) {
      return { success: false, error: 'Workspace not active' };
    }

    this.isMinimized = false;
    this.logActivity('restore', {});
    console.log('[Workspace] Restored from minimized state');
    return { success: true, isMinimized: false };
  }

  /**
   * Check if workspace is minimized
   */
  getIsMinimized() {
    return this.isMinimized;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
    this.frameListeners.clear();
    this.lastFrame = null;
    this.isActive = false;
    this.isMinimized = false;
  }

  /**
   * Inject the "Max's Computer" branding header into the page
   * This creates a distinctive visual boundary so users know this is Max's browser
   */
  injectBrandingHeader() {
    if (!this.getIsActive()) return;

    const brandingCSS = `
      #max-computer-header {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 38px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        -webkit-app-region: drag;
        user-select: none;
      }
      #max-computer-header .max-logo {
        width: 20px;
        height: 20px;
        background: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 8px;
        font-weight: bold;
        font-size: 12px;
        color: #764ba2;
      }
      #max-computer-header .max-title {
        color: white;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.3px;
      }
      #max-computer-header .max-subtitle {
        color: rgba(255,255,255,0.8);
        font-size: 11px;
        margin-left: 8px;
      }
      body {
        margin-top: 38px !important;
        padding-top: 0 !important;
      }
    `;

    const brandingHTML = `
      <div id="max-computer-header">
        <div class="max-logo">M</div>
        <span class="max-title">Max's Computer</span>
        <span class="max-subtitle">Isolated Browser</span>
      </div>
    `;

    // Inject the branding
    this.workspaceWindow.webContents.insertCSS(brandingCSS).catch(() => {});
    this.workspaceWindow.webContents.executeJavaScript(`
      if (!document.getElementById('max-computer-header')) {
        document.body.insertAdjacentHTML('afterbegin', \`${brandingHTML.replace(/`/g, '\\`')}\`);
      }
    `).catch(() => {});
  }

  /**
   * Check if workspace is active
   */
  getIsActive() {
    return this.isActive && this.workspaceWindow && !this.workspaceWindow.isDestroyed();
  }

  /**
   * Get workspace window ID
   */
  getWindowId() {
    if (!this.workspaceWindow || this.workspaceWindow.isDestroyed()) return 0;
    return this.workspaceWindow.id;
  }

  /**
   * Start periodic frame capture for PiP viewer
   */
  startFrameCapture(fps = 10) {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
    }

    const captureFrame = async () => {
      if (!this.getIsActive()) return;

      try {
        const image = await this.workspaceWindow.webContents.capturePage();
        this.lastFrame = image.toDataURL();

        // Notify listeners
        for (const listener of this.frameListeners) {
          try {
            listener(this.lastFrame);
          } catch (e) {
            console.error('[Workspace] Frame listener error:', e);
          }
        }
      } catch (e) {
        // Window might be destroyed
      }
    };

    // Capture at specified FPS
    this.captureInterval = setInterval(captureFrame, 1000 / fps);

    // Capture first frame immediately
    captureFrame();
  }

  /**
   * Get the latest captured frame
   */
  getLastFrame() {
    return this.lastFrame;
  }

  /**
   * Capture current frame immediately
   */
  async captureFrame() {
    if (!this.getIsActive()) return null;

    try {
      const image = await this.workspaceWindow.webContents.capturePage();
      this.lastFrame = image.toDataURL();
      return this.lastFrame;
    } catch (e) {
      console.error('[Workspace] Capture error:', e);
      return null;
    }
  }

  /**
   * Add a frame listener for real-time updates
   */
  addFrameListener(callback) {
    this.frameListeners.add(callback);
  }

  /**
   * Remove a frame listener
   */
  removeFrameListener(callback) {
    this.frameListeners.delete(callback);
  }

  // ===========================================================================
  // Navigation Actions
  // ===========================================================================

  /**
   * Navigate to a URL
   */
  async navigateTo(url) {
    if (!this.getIsActive()) return { success: false, error: 'Workspace not active' };

    try {
      // Add protocol if missing
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      await this.workspaceWindow.loadURL(url);
      this.logActivity('navigate', { url });
      return { success: true, url };
    } catch (e) {
      this.logActivity('navigate', { url }, 'error', e.message);
      return { success: false, error: e.message };
    }
  }

  /**
   * Go back in history
   */
  async goBack() {
    if (!this.getIsActive()) return { success: false, error: 'Workspace not active' };

    if (this.workspaceWindow.webContents.canGoBack()) {
      this.workspaceWindow.webContents.goBack();
      this.logActivity('back', {});
      return { success: true };
    }
    return { success: false, error: 'Cannot go back' };
  }

  /**
   * Go forward in history
   */
  async goForward() {
    if (!this.getIsActive()) return { success: false, error: 'Workspace not active' };

    if (this.workspaceWindow.webContents.canGoForward()) {
      this.workspaceWindow.webContents.goForward();
      this.logActivity('forward', {});
      return { success: true };
    }
    return { success: false, error: 'Cannot go forward' };
  }

  /**
   * Reload the page
   */
  async reload() {
    if (!this.getIsActive()) return { success: false, error: 'Workspace not active' };

    this.workspaceWindow.webContents.reload();
    return { success: true };
  }

  /**
   * Get current URL
   */
  getCurrentUrl() {
    if (!this.getIsActive()) return null;
    return this.workspaceWindow.webContents.getURL();
  }

  /**
   * Get page title
   */
  getPageTitle() {
    if (!this.getIsActive()) return null;
    return this.workspaceWindow.webContents.getTitle();
  }

  // ===========================================================================
  // Input Actions
  // ===========================================================================

  /**
   * Click at coordinates
   */
  async clickAt(x, y, options = {}) {
    if (!this.getIsActive()) return { success: false, error: 'Workspace not active' };

    const { button = 'left', clickCount = 1 } = options;

    try {
      // Send mouse events to the webContents
      const webContents = this.workspaceWindow.webContents;

      // Move mouse to position
      webContents.sendInputEvent({
        type: 'mouseMove',
        x: Math.round(x),
        y: Math.round(y)
      });

      // Mouse down
      webContents.sendInputEvent({
        type: 'mouseDown',
        x: Math.round(x),
        y: Math.round(y),
        button,
        clickCount
      });

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 50));

      // Mouse up
      webContents.sendInputEvent({
        type: 'mouseUp',
        x: Math.round(x),
        y: Math.round(y),
        button,
        clickCount
      });

      this.logActivity('click', { x, y, button, clickCount });
      return { success: true };
    } catch (e) {
      this.logActivity('click', { x, y, button, clickCount }, 'error', e.message);
      return { success: false, error: e.message };
    }
  }

  /**
   * Double click at coordinates
   */
  async doubleClick(x, y) {
    return this.clickAt(x, y, { clickCount: 2 });
  }

  /**
   * Right click at coordinates
   */
  async rightClick(x, y) {
    return this.clickAt(x, y, { button: 'right' });
  }

  /**
   * Type text
   */
  async typeText(text) {
    if (!this.getIsActive()) return { success: false, error: 'Workspace not active' };

    try {
      const webContents = this.workspaceWindow.webContents;

      // Type each character
      for (const char of text) {
        webContents.sendInputEvent({
          type: 'char',
          keyCode: char
        });
        // Small delay between characters for reliability
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Log a preview of the text (don't log full text for privacy)
      const textPreview = text.length > 20 ? text.substring(0, 20) + '...' : text;
      this.logActivity('type', { textPreview, length: text.length });
      return { success: true };
    } catch (e) {
      this.logActivity('type', { length: text.length }, 'error', e.message);
      return { success: false, error: e.message };
    }
  }

  /**
   * Press a key
   */
  async pressKey(key, modifiers = []) {
    if (!this.getIsActive()) return { success: false, error: 'Workspace not active' };

    try {
      const webContents = this.workspaceWindow.webContents;

      // Build modifiers array
      const mods = [];
      if (modifiers.includes('shift')) mods.push('shift');
      if (modifiers.includes('control') || modifiers.includes('ctrl')) mods.push('control');
      if (modifiers.includes('alt') || modifiers.includes('option')) mods.push('alt');
      if (modifiers.includes('meta') || modifiers.includes('command') || modifiers.includes('cmd')) mods.push('meta');

      // Key down
      webContents.sendInputEvent({
        type: 'keyDown',
        keyCode: key,
        modifiers: mods
      });

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 50));

      // Key up
      webContents.sendInputEvent({
        type: 'keyUp',
        keyCode: key,
        modifiers: mods
      });

      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Scroll the page
   */
  async scroll(deltaX = 0, deltaY = 0, x = null, y = null) {
    if (!this.getIsActive()) return { success: false, error: 'Workspace not active' };

    try {
      const webContents = this.workspaceWindow.webContents;

      // Default to center of window if no position specified
      const scrollX = x !== null ? x : Math.round(this.width / 2);
      const scrollY = y !== null ? y : Math.round(this.height / 2);

      webContents.sendInputEvent({
        type: 'mouseWheel',
        x: scrollX,
        y: scrollY,
        deltaX: deltaX,
        deltaY: deltaY
      });

      this.logActivity('scroll', { deltaX, deltaY, direction: deltaY > 0 ? 'down' : 'up' });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ===========================================================================
  // Advanced Actions
  // ===========================================================================

  /**
   * Execute JavaScript in the page context
   */
  async executeScript(script) {
    if (!this.getIsActive()) return { success: false, error: 'Workspace not active' };

    try {
      const result = await this.workspaceWindow.webContents.executeJavaScript(script);
      return { success: true, result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Click on element by CSS selector
   */
  async clickElement(selector) {
    if (!this.getIsActive()) return { success: false, error: 'Workspace not active' };

    try {
      const result = await this.executeScript(`
        (function() {
          const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
          if (!el) return { found: false };

          const rect = el.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;

          return { found: true, x, y };
        })()
      `);

      if (!result.success || !result.result.found) {
        this.logActivity('click_element', { selector }, 'error', 'Element not found');
        return { success: false, error: 'Element not found' };
      }

      this.logActivity('click_element', { selector });
      return this.clickAt(result.result.x, result.result.y);
    } catch (e) {
      this.logActivity('click_element', { selector }, 'error', e.message);
      return { success: false, error: e.message };
    }
  }

  /**
   * Click on element by visible text content
   * More robust than CSS selectors for dynamic pages like Amazon
   */
  async clickByText(searchText, options = {}) {
    if (!this.getIsActive()) return { success: false, error: 'Workspace not active' };

    const { exact = false, index = 0 } = options;

    try {
      const result = await this.executeScript(`
        (function() {
          const searchText = '${searchText.replace(/'/g, "\\'")}';
          const exact = ${exact};
          const targetIndex = ${index};
          const searchLower = searchText.toLowerCase();

          // Strategy 1: Find clickable elements (a, button) that contain the text anywhere inside
          const clickables = document.querySelectorAll('a, button, [role="button"], [role="link"], [onclick], input[type="submit"], input[type="button"]');
          const matches = [];
          const seen = new Set();

          clickables.forEach(el => {
            const rect = el.getBoundingClientRect();
            // Element must be visible and reasonably sized
            if (rect.width < 10 || rect.height < 10) return;
            if (rect.top < 0 || rect.left < 0) return;
            if (rect.top > window.innerHeight || rect.left > window.innerWidth) return;

            // Get ALL text inside this clickable element (including nested spans)
            const text = (el.innerText || el.textContent || el.value || el.getAttribute('aria-label') || '').trim();

            // Check for match
            const isMatch = exact ? text === searchText : text.toLowerCase().includes(searchLower);
            if (isMatch) {
              // Avoid duplicate matches at same position
              const key = Math.round(rect.left) + ',' + Math.round(rect.top);
              if (seen.has(key)) return;
              seen.add(key);

              matches.push({
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
                width: rect.width,
                height: rect.height,
                text: text.slice(0, 150),
                tag: el.tagName.toLowerCase(),
                href: el.href || null
              });
            }
          });

          // Strategy 2: If no clickable matches, find ANY element with text and look for clickable ancestor
          if (matches.length === 0) {
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
            let node;
            while (node = walker.nextNode()) {
              const text = node.textContent.trim();
              if (!text) continue;
              const isMatch = exact ? text === searchText : text.toLowerCase().includes(searchLower);
              if (!isMatch) continue;

              // Found matching text, look for clickable ancestor
              let el = node.parentElement;
              while (el && el !== document.body) {
                const tag = el.tagName.toLowerCase();
                const isClickable = tag === 'a' || tag === 'button' ||
                                   el.getAttribute('role') === 'button' ||
                                   el.getAttribute('role') === 'link' ||
                                   el.onclick || el.getAttribute('onclick');
                if (isClickable) {
                  const rect = el.getBoundingClientRect();
                  if (rect.width > 10 && rect.height > 10) {
                    const key = Math.round(rect.left) + ',' + Math.round(rect.top);
                    if (!seen.has(key)) {
                      seen.add(key);
                      matches.push({
                        x: rect.left + rect.width / 2,
                        y: rect.top + rect.height / 2,
                        width: rect.width,
                        height: rect.height,
                        text: text.slice(0, 150),
                        tag: tag,
                        href: el.href || null,
                        foundVia: 'ancestor'
                      });
                    }
                  }
                  break;
                }
                el = el.parentElement;
              }
            }
          }

          // Sort by position (top-left first) for consistent ordering
          matches.sort((a, b) => (a.y - b.y) || (a.x - b.x));

          if (matches.length === 0) {
            // Debug: count how many times the text appears at all
            const allText = document.body.innerText || '';
            const occurrences = (allText.toLowerCase().match(new RegExp(searchLower, 'g')) || []).length;
            return {
              found: false,
              error: 'No clickable element found with text: ' + searchText +
                     ' (text appears ' + occurrences + ' times on page but not in clickable elements)'
            };
          }

          if (targetIndex >= matches.length) {
            return { found: false, error: 'Index ' + targetIndex + ' out of range, only ' + matches.length + ' matches found' };
          }

          return {
            found: true,
            x: matches[targetIndex].x,
            y: matches[targetIndex].y,
            matchedText: matches[targetIndex].text,
            tag: matches[targetIndex].tag,
            href: matches[targetIndex].href,
            totalMatches: matches.length
          };
        })()
      `);

      if (!result.success) {
        this.logActivity('click_by_text', { searchText }, 'error', result.error);
        return { success: false, error: result.error };
      }

      if (!result.result.found) {
        this.logActivity('click_by_text', { searchText }, 'error', result.result.error);
        return { success: false, error: result.result.error };
      }

      this.logActivity('click_by_text', {
        searchText,
        matchedText: result.result.matchedText,
        tag: result.result.tag,
        totalMatches: result.result.totalMatches
      });

      return this.clickAt(result.result.x, result.result.y);
    } catch (e) {
      this.logActivity('click_by_text', { searchText }, 'error', e.message);
      return { success: false, error: e.message };
    }
  }

  /**
   * Build a search URL for common sites - much faster than typing into search box
   * Supports: amazon, google, target, walmart, ebay, youtube, bing
   */
  buildSearchUrl(site, query) {
    const encodedQuery = encodeURIComponent(query);
    const searchUrls = {
      'amazon': `https://www.amazon.com/s?k=${encodedQuery}`,
      'google': `https://www.google.com/search?q=${encodedQuery}`,
      'target': `https://www.target.com/s?searchTerm=${encodedQuery}`,
      'walmart': `https://www.walmart.com/search?q=${encodedQuery}`,
      'ebay': `https://www.ebay.com/sch/i.html?_nkw=${encodedQuery}`,
      'youtube': `https://www.youtube.com/results?search_query=${encodedQuery}`,
      'bing': `https://www.bing.com/search?q=${encodedQuery}`,
      'bestbuy': `https://www.bestbuy.com/site/searchpage.jsp?st=${encodedQuery}`,
      'etsy': `https://www.etsy.com/search?q=${encodedQuery}`,
    };

    const url = searchUrls[site.toLowerCase()];
    if (!url) {
      return { success: false, error: `Unknown site: ${site}. Supported: ${Object.keys(searchUrls).join(', ')}` };
    }
    return { success: true, url, site, query };
  }

  /**
   * Navigate directly to search results - combines buildSearchUrl + navigate
   */
  async searchSite(site, query) {
    const urlResult = this.buildSearchUrl(site, query);
    if (!urlResult.success) {
      return urlResult;
    }

    this.logActivity('search_site', { site, query, url: urlResult.url });
    return this.navigateTo(urlResult.url);
  }

  /**
   * Wait for an element to appear on the page
   * More reliable than fixed waits
   */
  async waitForElement(selector, options = {}) {
    if (!this.getIsActive()) return { success: false, error: 'Workspace not active' };

    const { timeout = 10000, interval = 200 } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const result = await this.executeScript(`
          (function() {
            const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
            if (el) {
              const rect = el.getBoundingClientRect();
              return {
                found: true,
                visible: rect.width > 0 && rect.height > 0,
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
              };
            }
            return { found: false };
          })()
        `);

        if (result.success && result.result.found && result.result.visible) {
          this.logActivity('wait_for_element', { selector, elapsed: Date.now() - startTime });
          return {
            success: true,
            selector,
            elapsed: Date.now() - startTime,
            x: result.result.x,
            y: result.result.y
          };
        }
      } catch (e) {
        // Continue waiting
      }

      await new Promise(resolve => setTimeout(resolve, interval));
    }

    this.logActivity('wait_for_element', { selector }, 'error', 'Timeout waiting for element');
    return { success: false, error: `Timeout waiting for element: ${selector}` };
  }

  /**
   * Wait for text to appear on the page
   */
  async waitForText(searchText, options = {}) {
    if (!this.getIsActive()) return { success: false, error: 'Workspace not active' };

    const { timeout = 10000, interval = 200 } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const result = await this.executeScript(`
          (function() {
            const body = document.body.innerText || '';
            return body.toLowerCase().includes('${searchText.toLowerCase().replace(/'/g, "\\'")}');
          })()
        `);

        if (result.success && result.result) {
          this.logActivity('wait_for_text', { searchText, elapsed: Date.now() - startTime });
          return { success: true, searchText, elapsed: Date.now() - startTime };
        }
      } catch (e) {
        // Continue waiting
      }

      await new Promise(resolve => setTimeout(resolve, interval));
    }

    this.logActivity('wait_for_text', { searchText }, 'error', 'Timeout waiting for text');
    return { success: false, error: `Timeout waiting for text: ${searchText}` };
  }

  /**
   * Get shopping cart count (works on Amazon, Target, Walmart, etc.)
   */
  async getCartCount() {
    if (!this.getIsActive()) return { success: false, error: 'Workspace not active' };

    try {
      const result = await this.executeScript(`
        (function() {
          // Amazon cart count
          let el = document.getElementById('nav-cart-count');
          if (el) return { site: 'amazon', count: parseInt(el.innerText) || 0 };

          // Target cart count
          el = document.querySelector('[data-test="cart-icon-count"]');
          if (el) return { site: 'target', count: parseInt(el.innerText) || 0 };

          // Walmart cart count
          el = document.querySelector('[data-testid="cart-item-count"]');
          if (el) return { site: 'walmart', count: parseInt(el.innerText) || 0 };

          // Generic cart badge
          el = document.querySelector('.cart-count, .cart-badge, [class*="cart"] [class*="count"]');
          if (el) return { site: 'generic', count: parseInt(el.innerText) || 0 };

          return { site: 'unknown', count: null, error: 'Could not find cart count element' };
        })()
      `);

      if (result.success) {
        this.logActivity('get_cart_count', result.result);
        return { success: true, ...result.result };
      }
      return { success: false, error: result.error };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Get product links from search results page
   * Returns structured data about products
   */
  async getProductLinks(options = {}) {
    if (!this.getIsActive()) return { success: false, error: 'Workspace not active' };

    const { limit = 10 } = options;

    try {
      const result = await this.executeScript(`
        (function() {
          const products = [];

          // Amazon product cards
          document.querySelectorAll('[data-component-type="s-search-result"]').forEach((card, i) => {
            if (i >= ${limit}) return;
            const link = card.querySelector('h2 a');
            const priceWhole = card.querySelector('.a-price-whole');
            const priceFraction = card.querySelector('.a-price-fraction');
            const rating = card.querySelector('[data-cy="reviews-ratings-count"]');

            if (link) {
              products.push({
                name: link.innerText.trim().slice(0, 150),
                href: link.href,
                price: priceWhole ? '$' + priceWhole.innerText + (priceFraction ? priceFraction.innerText : '') : null,
                rating: rating ? rating.innerText : null,
                index: i
              });
            }
          });

          // If no Amazon results, try generic product links
          if (products.length === 0) {
            document.querySelectorAll('a[href*="/dp/"], a[href*="/product/"], a[href*="/p/"]').forEach((link, i) => {
              if (i >= ${limit}) return;
              const rect = link.getBoundingClientRect();
              if (rect.width > 50 && rect.height > 20) {
                products.push({
                  name: link.innerText.trim().slice(0, 150),
                  href: link.href,
                  index: i
                });
              }
            });
          }

          return products;
        })()
      `);

      if (result.success) {
        this.logActivity('get_product_links', { count: result.result.length });
        return { success: true, products: result.result };
      }
      return { success: false, error: result.error };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Type into element by CSS selector
   */
  async typeIntoElement(selector, text, options = {}) {
    if (!this.getIsActive()) return { success: false, error: 'Workspace not active' };

    const { clearFirst = true, pressEnter = false } = options;

    try {
      // Click the element first to focus it
      const clickResult = await this.clickElement(selector);
      if (!clickResult.success) return clickResult;

      // Wait for focus
      await new Promise(resolve => setTimeout(resolve, 100));

      // Clear existing content first (select all + delete)
      if (clearFirst) {
        const webContents = this.workspaceWindow.webContents;
        // Select all (Cmd+A on macOS)
        webContents.sendInputEvent({ type: 'keyDown', keyCode: 'a', modifiers: ['meta'] });
        webContents.sendInputEvent({ type: 'keyUp', keyCode: 'a', modifiers: ['meta'] });
        await new Promise(resolve => setTimeout(resolve, 50));
        // Delete selected text
        webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Backspace' });
        webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Backspace' });
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Type the text (strip any trailing newlines - we'll handle Enter separately)
      const cleanText = text.replace(/\n+$/, '');
      const typeResult = await this.typeText(cleanText);
      if (!typeResult.success) return typeResult;

      // Press Enter to submit if requested
      if (pressEnter) {
        await new Promise(resolve => setTimeout(resolve, 50));
        const webContents = this.workspaceWindow.webContents;
        webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' });
        webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Return' });
        this.logActivity('pressEnter', { afterTyping: true });
      }

      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Get page content as text
   */
  async getPageText() {
    if (!this.getIsActive()) return { success: false, error: 'Workspace not active' };

    try {
      const result = await this.executeScript(`
        document.body.innerText
      `);
      return { success: true, text: result.result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Get page HTML
   */
  async getPageHtml() {
    if (!this.getIsActive()) return { success: false, error: 'Workspace not active' };

    try {
      const result = await this.executeScript(`
        document.documentElement.outerHTML
      `);
      return { success: true, html: result.result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Find elements matching selector and return their info
   */
  async findElements(selector) {
    if (!this.getIsActive()) return { success: false, error: 'Workspace not active' };

    try {
      const result = await this.executeScript(`
        (function() {
          const elements = document.querySelectorAll('${selector.replace(/'/g, "\\'")}');
          return Array.from(elements).map((el, index) => {
            const rect = el.getBoundingClientRect();
            return {
              index,
              tag: el.tagName.toLowerCase(),
              text: el.innerText?.slice(0, 100) || '',
              href: el.href || null,
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
              width: rect.width,
              height: rect.height,
              visible: rect.width > 0 && rect.height > 0
            };
          });
        })()
      `);
      return { success: true, elements: result.result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Search Google
   */
  async searchGoogle(query) {
    this.logActivity('search', { query });
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    return this.navigateTo(searchUrl);
  }

  /**
   * Get all links on the page
   */
  async getLinks() {
    return this.findElements('a[href]');
  }

  /**
   * Get all buttons on the page
   */
  async getButtons() {
    return this.findElements('button, input[type="submit"], input[type="button"], [role="button"]');
  }

  /**
   * Get all input fields on the page
   */
  async getInputFields() {
    return this.findElements('input, textarea, [contenteditable="true"]');
  }

  /**
   * Get interactive elements with their CSS selectors
   * This helps the AI discover actual selectors instead of guessing
   */
  async getSelectors(filter = 'all') {
    if (!this.getIsActive()) return { success: false, error: 'Workspace not active' };

    try {
      const result = await this.executeScript(`
        (function() {
          function getSelector(el) {
            // Try ID first
            if (el.id) return '#' + el.id;

            // Try unique class
            if (el.className && typeof el.className === 'string') {
              const classes = el.className.trim().split(/\\s+/).filter(c => c);
              if (classes.length > 0) {
                const selector = '.' + classes.join('.');
                if (document.querySelectorAll(selector).length === 1) {
                  return selector;
                }
              }
            }

            // Try name attribute for inputs
            if (el.name) {
              const selector = el.tagName.toLowerCase() + '[name="' + el.name + '"]';
              if (document.querySelectorAll(selector).length === 1) {
                return selector;
              }
            }

            // Try placeholder for inputs
            if (el.placeholder) {
              const selector = el.tagName.toLowerCase() + '[placeholder="' + el.placeholder.replace(/"/g, '\\\\"') + '"]';
              if (document.querySelectorAll(selector).length === 1) {
                return selector;
              }
            }

            // Try aria-label
            if (el.getAttribute('aria-label')) {
              const selector = '[aria-label="' + el.getAttribute('aria-label').replace(/"/g, '\\\\"') + '"]';
              if (document.querySelectorAll(selector).length === 1) {
                return selector;
              }
            }

            // Try data-testid
            if (el.getAttribute('data-testid')) {
              return '[data-testid="' + el.getAttribute('data-testid') + '"]';
            }

            // Fallback: tag + nth-of-type
            const parent = el.parentElement;
            if (parent) {
              const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
              const index = siblings.indexOf(el) + 1;
              if (siblings.length > 1) {
                return el.tagName.toLowerCase() + ':nth-of-type(' + index + ')';
              }
            }

            return el.tagName.toLowerCase();
          }

          const elements = { buttons: [], inputs: [], links: [], other: [] };

          // Get buttons
          if ('${filter}' === 'all' || '${filter}' === 'buttons') {
            document.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]').forEach(el => {
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                elements.buttons.push({
                  selector: getSelector(el),
                  text: (el.innerText || el.value || el.getAttribute('aria-label') || '').slice(0, 50).trim(),
                  type: el.tagName.toLowerCase()
                });
              }
            });
          }

          // Get inputs
          if ('${filter}' === 'all' || '${filter}' === 'inputs') {
            document.querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="hidden"]), textarea, select').forEach(el => {
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                elements.inputs.push({
                  selector: getSelector(el),
                  placeholder: el.placeholder || '',
                  type: el.type || el.tagName.toLowerCase(),
                  name: el.name || ''
                });
              }
            });
          }

          // Get links
          if ('${filter}' === 'all' || '${filter}' === 'links') {
            document.querySelectorAll('a[href]').forEach(el => {
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                elements.links.push({
                  selector: getSelector(el),
                  text: (el.innerText || '').slice(0, 50).trim(),
                  href: el.href
                });
              }
            });
          }

          return elements;
        })()
      `);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      this.logActivity('get_selectors', { filter });
      return { success: true, elements: result.result };
    } catch (e) {
      this.logActivity('get_selectors', { filter }, 'error', e.message);
      return { success: false, error: e.message };
    }
  }

  /**
   * Inspect a specific element to get detailed selector info
   * Can find by text, selector, or coordinates
   */
  async inspectElement(options = {}) {
    if (!this.getIsActive()) return { success: false, error: 'Workspace not active' };

    const { text, selector, x, y } = options;

    try {
      const result = await this.executeScript(`
        (function() {
          let el = null;

          // Find by selector
          if ('${selector || ''}') {
            el = document.querySelector('${(selector || '').replace(/'/g, "\\'")}');
          }
          // Find by text content
          else if ('${text || ''}') {
            const searchText = '${(text || '').replace(/'/g, "\\'")}';
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) {
              if (walker.currentNode.textContent.includes(searchText)) {
                el = walker.currentNode.parentElement;
                break;
              }
            }
            // Also check buttons, links, inputs
            if (!el) {
              el = Array.from(document.querySelectorAll('button, a, input, [role="button"]')).find(e =>
                (e.innerText || e.value || e.getAttribute('aria-label') || '').includes(searchText)
              );
            }
          }
          // Find by coordinates
          else if (${x !== undefined ? x : 'null'} !== null && ${y !== undefined ? y : 'null'} !== null) {
            el = document.elementFromPoint(${x || 0}, ${y || 0});
          }

          if (!el) return { found: false };

          const rect = el.getBoundingClientRect();

          // Generate multiple selector options
          const selectors = [];
          if (el.id) selectors.push('#' + el.id);
          if (el.className && typeof el.className === 'string') {
            const classes = el.className.trim().split(/\\s+/).filter(c => c);
            if (classes.length) selectors.push('.' + classes.join('.'));
          }
          if (el.name) selectors.push(el.tagName.toLowerCase() + '[name="' + el.name + '"]');
          if (el.placeholder) selectors.push('[placeholder="' + el.placeholder.replace(/"/g, '\\\\"') + '"]');
          if (el.getAttribute('aria-label')) selectors.push('[aria-label="' + el.getAttribute('aria-label').replace(/"/g, '\\\\"') + '"]');
          if (el.getAttribute('data-testid')) selectors.push('[data-testid="' + el.getAttribute('data-testid') + '"]');

          return {
            found: true,
            tag: el.tagName.toLowerCase(),
            id: el.id || null,
            classes: el.className || null,
            text: (el.innerText || '').slice(0, 100),
            placeholder: el.placeholder || null,
            name: el.name || null,
            type: el.type || null,
            href: el.href || null,
            bestSelector: selectors[0] || el.tagName.toLowerCase(),
            alternativeSelectors: selectors.slice(1),
            position: { x: rect.left + rect.width/2, y: rect.top + rect.height/2 },
            size: { width: rect.width, height: rect.height }
          };
        })()
      `);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      if (!result.result.found) {
        return { success: false, error: 'Element not found' };
      }

      this.logActivity('inspect_element', { text, selector, x, y });
      return { success: true, element: result.result };
    } catch (e) {
      this.logActivity('inspect_element', { text, selector, x, y }, 'error', e.message);
      return { success: false, error: e.message };
    }
  }
}

// Singleton instance
const workspaceManager = new WorkspaceManager();

module.exports = {
  workspaceManager,
  WorkspaceManager
};
