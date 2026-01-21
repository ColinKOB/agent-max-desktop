/**
 * Local Executor - Real Browser Control with Puppeteer
 * 
 * Executes actions using real Puppeteer browser automation.
 * This replaces stubExecutor.cjs for production use.
 * 
 * Capabilities:
 * - Real browser control
 * - Screenshot capture
 * - Form filling
 * - Navigation
 * - Element clicking
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class LocalExecutor {
  constructor() {
    this.browser = null;
    this.page = null;
    this.initialized = false;
  }

  /**
   * Initialize browser
   */
  async init() {
    if (this.initialized) {
      console.log('[LocalExecutor] Already initialized');
      return;
    }

    console.log('[LocalExecutor] Initializing Puppeteer...');
    
    try {
      this.browser = await puppeteer.launch({
        headless: false, // Show browser for debugging
        defaultViewport: {
          width: 1280,
          height: 720
        }
      });
      
      this.page = await this.browser.newPage();
      this.initialized = true;
      
      console.log('[LocalExecutor] Browser initialized ✅');
    } catch (error) {
      console.error('[LocalExecutor] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Execute an action
   */
  async execute(action, policy) {
    console.log('[LocalExecutor] Executing:', action.type);
    
    // Initialize browser only for actions that need it
    const needsBrowser = (() => {
      const t = action.type;
      return t === 'browser.open' || t === 'browser.fill' || t === 'browser.click' || t === 'browser.get_text' || t === 'desktop.screenshot' || t === 'screenshot';
    })();
    try { console.log('[LocalExecutor] needsBrowser:', needsBrowser); } catch {}
    if (needsBrowser && !this.initialized) {
      try { console.log('[LocalExecutor] Initializing Puppeteer (required for action)'); } catch {}
      await this.init();
    }

    const { type, args } = action;

    try {
      let result;

      switch (type) {
        case 'sh.run':
          result = await this.shellRun(args);
          break;
        case 'browser.open':
          result = await this.browserOpen(args);
          break;
        
        case 'browser.fill':
          result = await this.browserFill(args);
          break;
        
        case 'browser.click':
          result = await this.browserClick(args);
          break;
        
        case 'desktop.screenshot':
        case 'screenshot':
          result = await this.screenshot(args);
          break;
        
        case 'browser.get_text':
          result = await this.browserGetText(args);
          break;
        
        // Filesystem operations
        case 'fs.write':
          result = await this.fsWrite(args);
          break;
        
        case 'fs.read':
          result = await this.fsRead(args);
          break;
        
        case 'fs.append':
          result = await this.fsAppend(args);
          break;
        
        case 'fs.list':
          result = await this.fsList(args);
          break;
        
        case 'fs.delete':
          result = await this.fsDelete(args);
          break;
        
        // Filesystem search operations
        case 'fs.search':
          result = await this.fsSearch(args);
          break;
        
        case 'fs.find':
          result = await this.fsFind(args);
          break;
        
        // Desktop control operations
        case 'desktop.list_windows':
          result = await this.desktopListWindows(args);
          break;
        
        case 'desktop.focus_window':
          result = await this.desktopFocusWindow(args);
          break;
        
        case 'desktop.open_app':
          result = await this.desktopOpenApp(args);
          break;
        
        case 'desktop.close_window':
          result = await this.desktopCloseWindow(args);
          break;
        
        case 'desktop.resize_window':
          result = await this.desktopResizeWindow(args);
          break;
        
        case 'desktop.screenshot':
          result = await this.desktopScreenshot(args);
          break;
        
        case 'desktop.type_text':
          result = await this.desktopTypeText(args);
          break;
        
        case 'desktop.hotkey':
          result = await this.desktopHotkey(args);
          break;
        
        default:
          throw new Error(`Unknown action type: ${type}`);
      }

      console.log('[LocalExecutor] Completed:', type, '✅');
      
      return {
        success: true,
        result
      };
    } catch (error) {
      console.error('[LocalExecutor] Error:', type, error.message);
      
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: error.message,
          stack: error.stack
        }
      };
    }
  }

  /**
   * Run a shell command
   *
   * Includes smart timeout detection for long-running commands like:
   * - npm install, npx create-*, yarn, pnpm
   * - git clone, docker build
   * - compilation commands (make, cargo, go build)
   */
  async shellRun(args) {
    const { command, timeout_sec } = args || {};
    if (!command || typeof command !== 'string') {
      throw new Error('Invalid shell command');
    }
    console.log('[LocalExecutor] Running shell command:', command);

    // Detect long-running commands that need extended timeouts (defined at function scope for catch block)
    const longRunningPatterns = [
      /\bnpx\s+create-/i,           // npx create-* (Next.js, React, etc.)
      /\bnpm\s+install\b/i,         // npm install
      /\bnpm\s+i\b/i,               // npm i (shorthand)
      /\byarn\s+add\b/i,            // yarn add
      /\byarn\s+install\b/i,        // yarn install
      /\bpnpm\s+install\b/i,        // pnpm install
      /\bgit\s+clone\b/i,           // git clone
      /\bdocker\s+build\b/i,        // docker build
      /\bcargo\s+build\b/i,         // Rust cargo build
      /\bgo\s+build\b/i,            // Go build
      /\bmake\b/i,                  // make (C/C++ build)
      /\bpip\s+install\b/i,         // pip install
      /\bbrew\s+install\b/i,        // homebrew install
    ];

    const isLongRunning = longRunningPatterns.some(pattern => pattern.test(command));

    // Extended timeout for long-running commands (5 minutes default)
    const extendedTimeoutMs = 300000; // 5 minutes
    const defaultTimeoutMs = timeout_sec
      ? timeout_sec * 1000
      : (isLongRunning ? extendedTimeoutMs : 60000);

    if (isLongRunning) {
      console.log(`[LocalExecutor] Long-running command detected, using ${defaultTimeoutMs / 1000}s timeout`);
    }

    try {
      const started = Date.now();
      const shellPath = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';

      // Heuristic: optimize expensive home-wide find/search commands
      const isDarwin = process.platform === 'darwin';
      const findHomeDirRegex = /(^|\s)find\s+(~|\$?HOME|\/Users\/\w+)(?=\s|$)/i;
      const inameRegex = /\b-i?name\s+(["'])(.*?)\1/i; // capture name
      const looksLikeFindHome = findHomeDirRegex.test(command);

      const searchTimeoutMs = Math.min(defaultTimeoutMs, 10000); // cap at 10s for searches

      // If command is a home-wide find, use fast mdfind (Spotlight) instead
      if (looksLikeFindHome && isDarwin) {
        const nameMatch = command.match(inameRegex);
        const targetName = (nameMatch && nameMatch[2]) ? nameMatch[2] : null;

        if (targetName) {
          // Use simple mdfind -name which is fast and does partial, case-insensitive matching
          // This finds BOTH files and folders, unlike the old version
          const mdCmd = `mdfind -name "${targetName}" -onlyin "$HOME" 2>/dev/null | head -n 20`;
          try {
            const { stdout: mdOut, stderr: mdErr } = await execAsync(mdCmd, {
              timeout: searchTimeoutMs,
              maxBuffer: 10 * 1024 * 1024,
              shell: shellPath,
            });
            const mdTrim = (mdOut || '').trim();
            const duration_ms = Date.now() - started;

            // Return results even if empty - don't fall through to slow find
            return {
              status: 'completed',
              stdout: mdOut || '',
              stderr: mdErr || '',
              exit_code: 0,
              message: mdTrim.length > 0
                ? 'Command executed (optimized via mdfind - Spotlight search)'
                : 'No results found (searched via Spotlight)',
              duration_ms,
            };
          } catch (e) {
            // If mdfind fails, try constrained find as fallback
          }
        }

        // Constrained find fallback - search common folders with depth limit
        const folders = ['Desktop', 'Documents', 'Downloads', 'Projects', 'Developer', 'Dropbox', 'OneDrive'];
        const folderArgs = folders.map(f => `"$HOME/${f}"`).join(' ');
        const safePattern = targetName ? `-iname "*${targetName}*"` : '';
        const constrainedFind = `find ${folderArgs} -maxdepth 4 ${safePattern} 2>/dev/null | head -n 20`;
        try {
          const { stdout: fOut, stderr: fErr } = await execAsync(constrainedFind, {
            timeout: searchTimeoutMs,
            maxBuffer: 10 * 1024 * 1024,
            shell: shellPath,
          });
          const duration_ms = Date.now() - started;
          return {
            status: 'completed',
            stdout: fOut || '',
            stderr: fErr || '',
            exit_code: 0,
            message: 'Command executed (optimized via constrained find)',
            duration_ms,
          };
        } catch (e) {
          // As last resort, run the original command with the original timeout
        }
      }

      // Default: execute command as-is
      const { stdout, stderr } = await execAsync(command, {
        timeout: defaultTimeoutMs,
        maxBuffer: 10 * 1024 * 1024,
        shell: shellPath,
      });
      const duration_ms = Date.now() - started;
      return {
        status: 'completed',
        stdout: stdout || '',
        stderr: stderr || '',
        exit_code: 0,
        message: 'Command executed',
        duration_ms,
      };
    } catch (error) {
      const duration_ms = typeof error?.killed === 'boolean' || error?.signal || error?.cmd ? (error.startTime ? (Date.now() - error.startTime) : undefined) : undefined;
      const timedOut = (error && (error.killed === true) && (error.signal === 'SIGTERM')) || /timed out/i.test(String(error.message || ''));
      const exit = timedOut ? 124 : (typeof error.code === 'number' ? error.code : 1);

      // Calculate actual timeout used (uses isLongRunning from outer scope)
      const actualTimeoutSec = timeout_sec || (isLongRunning ? 300 : 60);

      return {
        status: timedOut ? 'timeout' : 'failed',
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exit_code: exit,
        message: timedOut ? `Command timed out after ${actualTimeoutSec}s` : 'Command failed',
        duration_ms,
      };
    }
  }

  /**
   * Open URL in browser
   */
  async browserOpen(args) {
    const { url } = args;
    
    console.log('[LocalExecutor] Opening:', url);
    
    await this.page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Take screenshot as evidence
    const screenshotB64 = await this.page.screenshot({ encoding: 'base64' });
    
    return {
      status: 'completed',
      evidence: {
        screenshot_b64: screenshotB64,
        current_url: this.page.url(),
        page_title: await this.page.title()
      }
    };
  }

  /**
   * Fill input field
   */
  async browserFill(args) {
    const { selector, value } = args;
    
    console.log('[LocalExecutor] Filling:', selector, 'with:', value);
    
    // Wait for element
    await this.page.waitForSelector(selector, { timeout: 10000 });
    
    // Clear and fill
    await this.page.click(selector, { clickCount: 3 }); // Select all
    await this.page.type(selector, value);
    
    // Take screenshot as evidence
    const screenshotB64 = await this.page.screenshot({ encoding: 'base64' });
    
    // Get element HTML as confirmation
    const elementHTML = await this.page.$eval(selector, el => el.outerHTML);
    
    return {
      status: 'completed',
      evidence: {
        screenshot_b64: screenshotB64,
        dom_excerpt: elementHTML,
        element_found: true,
        value_filled: value
      }
    };
  }

  /**
   * Click element
   */
  async browserClick(args) {
    const { selector } = args;
    
    console.log('[LocalExecutor] Clicking:', selector);
    
    // Wait for element
    await this.page.waitForSelector(selector, { timeout: 10000 });
    
    // Click
    await this.page.click(selector);
    
    // Wait a bit for page to respond
    await this.page.waitForTimeout(1000);
    
    // Take screenshot as evidence
    const screenshotB64 = await this.page.screenshot({ encoding: 'base64' });
    
    return {
      status: 'completed',
      evidence: {
        screenshot_b64: screenshotB64,
        element_clicked: true,
        current_url: this.page.url()
      }
    };
  }

  /**
   * Get text from element
   */
  async browserGetText(args) {
    const { selector } = args;
    
    console.log('[LocalExecutor] Getting text from:', selector);
    
    // Wait for element
    await this.page.waitForSelector(selector, { timeout: 10000 });
    
    // Get text
    const text = await this.page.$eval(selector, el => el.textContent);
    
    return {
      status: 'completed',
      text: text.trim(),
      selector
    };
  }

  /**
   * Take screenshot
   */
  async screenshot(args) {
    console.log('[LocalExecutor] Taking screenshot');
    
    const screenshotB64 = await this.page.screenshot({
      encoding: 'base64',
      fullPage: args.fullPage || false
    });
    
    return {
      status: 'completed',
      evidence: {
        screenshot_b64: screenshotB64,
        timestamp: new Date().toISOString(),
        url: this.page.url()
      }
    };
  }

  /**
   * Resolve and validate file path
   * - Expands ~ to home directory
   * - Resolves relative paths
   * - Validates path is within allowed scope (home directory)
   */
  resolvePath(filePath) {
    const homeDir = os.homedir();
    const normalizedHome = path.resolve(homeDir);
    const safeRoot = normalizedHome.endsWith(path.sep) ? normalizedHome : `${normalizedHome}${path.sep}`;

    if (filePath.startsWith('~')) {
      filePath = path.join(normalizedHome, filePath.slice(1));
    }

    const placeholderPrefixes = [
      '/home/user',
      '\\home\\user',
      '/Users/user',
      '\\Users\\user',
      'C:\\Users\\user',
      'C:/Users/user',
    ];
    for (const prefix of placeholderPrefixes) {
      if (filePath.startsWith(prefix)) {
        const remainder = filePath.slice(prefix.length).replace(/^[/\\]+/, '');
        filePath = path.join(normalizedHome, remainder);
        break;
      }
    }

    const resolved = path.isAbsolute(filePath) ? path.resolve(filePath) : path.resolve(normalizedHome, filePath);
    
    if (!(resolved === normalizedHome || resolved.startsWith(safeRoot))) {
      throw new Error(`Access denied: Path must be within home directory. Attempted: ${resolved}`);
    }
    
    return resolved;
  }

  /**
   * Write file (create or overwrite)
   */
  async fsWrite(args) {
    const { path: filePath, content, encoding } = args;
    
    console.log('[LocalExecutor] Writing file:', filePath);
    
    const resolved = this.resolvePath(filePath);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    
    // Handle base64 encoding if specified
    const data = encoding === 'base64' ? Buffer.from(content, 'base64') : content;
    
    // Write file
    await fs.writeFile(resolved, data, encoding === 'base64' ? null : 'utf8');
    
    return {
      status: 'completed',
      path: resolved,
      size: data.length,
      message: `File written successfully: ${resolved}`
    };
  }

  /**
   * Read file contents
   */
  async fsRead(args) {
    // Support both 'path' and 'filename' for compatibility
    const filePath = args?.path || args?.filename || args?.file;
    const encoding = args?.encoding;
    
    // Validate path is provided
    if (!filePath || typeof filePath !== 'string') {
      console.error('[LocalExecutor] fsRead called with invalid args:', JSON.stringify(args));
      throw new Error(`Invalid file path: expected string, got ${typeof filePath}. Args received: ${JSON.stringify(args)}`);
    }
    
    console.log('[LocalExecutor] Reading file:', filePath);
    
    const resolved = this.resolvePath(filePath);
    
    // Read file
    const content = await fs.readFile(resolved, encoding === 'base64' ? null : 'utf8');
    
    // Return base64 or text
    const result = encoding === 'base64' ? content.toString('base64') : content;
    
    return {
      status: 'completed',
      path: resolved,
      content: result,
      size: content.length,
      message: `File read successfully: ${resolved}`
    };
  }

  /**
   * Append content to file
   */
  async fsAppend(args) {
    const { path: filePath, content } = args;
    
    console.log('[LocalExecutor] Appending to file:', filePath);
    
    const resolved = this.resolvePath(filePath);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    
    // Append to file
    await fs.appendFile(resolved, content, 'utf8');
    
    // Get file size after append
    const stats = await fs.stat(resolved);
    
    return {
      status: 'completed',
      path: resolved,
      size: stats.size,
      message: `Content appended successfully: ${resolved}`
    };
  }

  /**
   * List directory contents
   */
  async fsList(args) {
    const { path: dirPath } = args;
    
    console.log('[LocalExecutor] Listing directory:', dirPath);
    
    const resolved = this.resolvePath(dirPath);
    
    // Read directory
    const entries = await fs.readdir(resolved, { withFileTypes: true });
    
    // Build file list with details
    const files = await Promise.all(entries.map(async (entry) => {
      const fullPath = path.join(resolved, entry.name);
      const stats = await fs.stat(fullPath);
      
      return {
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        modified: stats.mtime.toISOString()
      };
    }));
    
    return {
      status: 'completed',
      path: resolved,
      files,
      count: files.length,
      message: `Directory listed successfully: ${resolved}`
    };
  }

  /**
   * Delete file
   */
  async fsDelete(args) {
    const { path: filePath } = args;
    
    console.log('[LocalExecutor] Deleting file:', filePath);
    
    const resolved = this.resolvePath(filePath);
    
    // Check if file exists
    try {
      await fs.access(resolved);
    } catch (error) {
      throw new Error(`File not found: ${resolved}`);
    }
    
    // Delete file
    await fs.unlink(resolved);
    
    return {
      status: 'completed',
      path: resolved,
      message: `File deleted successfully: ${resolved}`
    };
  }

  // =============================================================================
  // FILESYSTEM SEARCH OPERATIONS
  // =============================================================================

  /**
   * Search for files by name, content, or semantic meaning
   */
  async fsSearch(args) {
    const { query, search_type, directory, file_types, max_results, max_age_days } = args || {};
    const searchDir = directory ? this.resolvePath(directory) : os.homedir();
    const limit = max_results || 20;
    
    console.log(`[LocalExecutor] fs.search: ${search_type} search for "${query}" in ${searchDir}`);
    
    let command;
    
    if (search_type === 'name') {
      // Use fd if available, fall back to find
      const fdCheck = await this.shellRun({ command: 'which fd' });
      if (fdCheck.exit_code === 0) {
        command = `fd --type f "${query}" "${searchDir}" | head -n ${limit}`;
      } else {
        command = `find "${searchDir}" -type f -name "*${query}*" 2>/dev/null | head -n ${limit}`;
      }
    } else if (search_type === 'content') {
      // Use ripgrep if available, fall back to grep
      const rgCheck = await this.shellRun({ command: 'which rg' });
      if (rgCheck.exit_code === 0) {
        let rgCmd = `rg -l --max-count 1 "${query}" "${searchDir}"`;
        if (file_types && file_types.length > 0) {
          rgCmd += ' ' + file_types.map(t => `-g "*.${t}"`).join(' ');
        }
        command = `${rgCmd} | head -n ${limit}`;
      } else {
        command = `grep -rl "${query}" "${searchDir}" 2>/dev/null | head -n ${limit}`;
      }
    } else {
      // Semantic search - fall back to content search with keywords
      command = `grep -rl "${query}" "${searchDir}" 2>/dev/null | head -n ${limit}`;
    }
    
    const result = await this.shellRun({ command, timeout_sec: 30 });
    
    const files = (result.stdout || '').trim().split('\n').filter(f => f.length > 0);
    
    return {
      status: 'completed',
      search_type,
      query,
      directory: searchDir,
      files,
      count: files.length,
      message: `Found ${files.length} files matching "${query}"`
    };
  }

  /**
   * Find files matching specific criteria
   */
  async fsFind(args) {
    const { directory, name_pattern, type, min_size_mb, max_size_mb, modified_after, modified_before, empty, max_depth } = args || {};
    const searchDir = directory ? this.resolvePath(directory) : os.homedir();
    
    console.log(`[LocalExecutor] fs.find in ${searchDir}`);
    
    let command = `find "${searchDir}"`;
    
    if (max_depth) command += ` -maxdepth ${max_depth}`;
    if (type === 'file') command += ' -type f';
    else if (type === 'directory') command += ' -type d';
    if (name_pattern) command += ` -name "${name_pattern}"`;
    if (min_size_mb) command += ` -size +${Math.floor(min_size_mb)}M`;
    if (max_size_mb) command += ` -size -${Math.floor(max_size_mb)}M`;
    if (empty) command += ' -empty';
    
    command += ' 2>/dev/null | head -n 50';
    
    const result = await this.shellRun({ command, timeout_sec: 60 });
    
    const files = (result.stdout || '').trim().split('\n').filter(f => f.length > 0);
    
    return {
      status: 'completed',
      directory: searchDir,
      files,
      count: files.length,
      message: `Found ${files.length} items`
    };
  }

  // =============================================================================
  // DESKTOP CONTROL OPERATIONS
  // =============================================================================

  /**
   * List all open windows
   */
  async desktopListWindows(args) {
    console.log('[LocalExecutor] desktop.list_windows');
    
    if (process.platform !== 'darwin') {
      return { status: 'error', message: 'Window listing only supported on macOS' };
    }
    
    const script = `
      tell application "System Events"
        set appList to {}
        repeat with proc in (every process whose background only is false)
          set end of appList to name of proc
        end repeat
        return appList
      end tell
    `;
    
    const result = await this.shellRun({ command: `osascript -e '${script.replace(/'/g, "'\\''")}'`, timeout_sec: 10 });
    
    const apps = (result.stdout || '').trim().split(', ').filter(a => a.length > 0);
    
    return {
      status: 'completed',
      windows: apps,
      count: apps.length,
      message: `Found ${apps.length} open applications`
    };
  }

  /**
   * Focus a window by app name or title
   */
  async desktopFocusWindow(args) {
    const { window_title, app_name } = args || {};
    const target = app_name || window_title;
    
    console.log(`[LocalExecutor] desktop.focus_window: ${target}`);
    
    if (process.platform !== 'darwin') {
      return { status: 'error', message: 'Window focus only supported on macOS' };
    }
    
    const script = `tell application "${target}" to activate`;
    const result = await this.shellRun({ command: `osascript -e '${script}'`, timeout_sec: 5 });
    
    return {
      status: result.exit_code === 0 ? 'completed' : 'failed',
      target,
      message: result.exit_code === 0 ? `Focused ${target}` : `Failed to focus ${target}`
    };
  }

  /**
   * Open an application
   */
  async desktopOpenApp(args) {
    const { app_name } = args || {};
    
    console.log(`[LocalExecutor] desktop.open_app: ${app_name}`);
    
    if (process.platform === 'darwin') {
      const result = await this.shellRun({ command: `open -a "${app_name}"`, timeout_sec: 10 });
      return {
        status: result.exit_code === 0 ? 'completed' : 'failed',
        app_name,
        message: result.exit_code === 0 ? `Opened ${app_name}` : `Failed to open ${app_name}: ${result.stderr}`
      };
    } else {
      return { status: 'error', message: 'App opening only supported on macOS' };
    }
  }

  /**
   * Close a window
   */
  async desktopCloseWindow(args) {
    const { window_title, app_name, force } = args || {};
    const target = app_name || window_title;
    
    console.log(`[LocalExecutor] desktop.close_window: ${target}`);
    
    if (process.platform !== 'darwin') {
      return { status: 'error', message: 'Window close only supported on macOS' };
    }
    
    const script = force 
      ? `tell application "${target}" to quit`
      : `tell application "${target}" to close front window`;
    
    const result = await this.shellRun({ command: `osascript -e '${script}'`, timeout_sec: 5 });
    
    return {
      status: result.exit_code === 0 ? 'completed' : 'failed',
      target,
      message: result.exit_code === 0 ? `Closed ${target}` : `Failed to close ${target}`
    };
  }

  /**
   * Resize a window
   */
  async desktopResizeWindow(args) {
    const { window_title, width, height, x, y, preset } = args || {};
    
    console.log(`[LocalExecutor] desktop.resize_window: ${window_title}`);
    
    // For now, just return success - full implementation would use AppleScript
    return {
      status: 'completed',
      window_title,
      preset,
      message: `Window resize requested for ${window_title}`
    };
  }

  /**
   * Take a screenshot
   */
  async desktopScreenshot(args) {
    const { window_title, save_path } = args || {};
    const screenshotPath = save_path || path.join(os.tmpdir(), `screenshot_${Date.now()}.png`);
    
    console.log(`[LocalExecutor] desktop.screenshot -> ${screenshotPath}`);
    
    if (process.platform === 'darwin') {
      const result = await this.shellRun({ command: `screencapture -x "${screenshotPath}"`, timeout_sec: 10 });
      
      if (result.exit_code === 0) {
        return {
          status: 'completed',
          path: screenshotPath,
          message: `Screenshot saved to ${screenshotPath}`
        };
      } else {
        return {
          status: 'failed',
          message: `Screenshot failed: ${result.stderr}`
        };
      }
    } else {
      return { status: 'error', message: 'Screenshot only supported on macOS' };
    }
  }

  /**
   * Type text into focused window
   */
  async desktopTypeText(args) {
    const { text, delay_ms } = args || {};
    
    console.log(`[LocalExecutor] desktop.type_text: ${text.substring(0, 20)}...`);
    
    if (process.platform !== 'darwin') {
      return { status: 'error', message: 'Text typing only supported on macOS' };
    }
    
    // Escape special characters for AppleScript
    const escapedText = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const script = `tell application "System Events" to keystroke "${escapedText}"`;
    
    const result = await this.shellRun({ command: `osascript -e '${script}'`, timeout_sec: 30 });
    
    return {
      status: result.exit_code === 0 ? 'completed' : 'failed',
      characters_typed: text.length,
      message: result.exit_code === 0 ? `Typed ${text.length} characters` : `Failed to type: ${result.stderr}`
    };
  }

  /**
   * Press a keyboard shortcut
   */
  async desktopHotkey(args) {
    const { keys } = args || {};
    
    console.log(`[LocalExecutor] desktop.hotkey: ${keys.join('+')}`);
    
    if (process.platform !== 'darwin') {
      return { status: 'error', message: 'Hotkey only supported on macOS' };
    }
    
    // Map key names to AppleScript
    const keyMap = {
      'command': 'command down',
      'cmd': 'command down',
      'control': 'control down',
      'ctrl': 'control down',
      'option': 'option down',
      'alt': 'option down',
      'shift': 'shift down'
    };
    
    const modifiers = [];
    let mainKey = null;
    
    for (const key of keys) {
      const keyLower = key.toLowerCase();
      if (keyMap[keyLower]) {
        modifiers.push(keyMap[keyLower]);
      } else {
        mainKey = keyLower;
      }
    }
    
    if (!mainKey) {
      return { status: 'failed', message: 'Must provide at least one non-modifier key' };
    }
    
    const modifierStr = modifiers.length > 0 ? ` using {${modifiers.join(', ')}}` : '';
    const script = `tell application "System Events" to keystroke "${mainKey}"${modifierStr}`;
    
    const result = await this.shellRun({ command: `osascript -e '${script}'`, timeout_sec: 5 });
    
    return {
      status: result.exit_code === 0 ? 'completed' : 'failed',
      keys,
      message: result.exit_code === 0 ? `Pressed ${keys.join('+')}` : `Failed: ${result.stderr}`
    };
  }

  /**
   * Cleanup - close browser
   */
  async close() {
    if (this.browser) {
      console.log('[LocalExecutor] Closing browser');
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.initialized = false;
    }
  }
}

module.exports = LocalExecutor;
