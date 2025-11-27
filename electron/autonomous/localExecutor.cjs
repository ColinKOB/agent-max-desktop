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
      return t === 'browser.open' || t === 'browser.fill' || t === 'browser.click' || t === 'browser.get_text' || t === 'screenshot';
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
   */
  async shellRun(args) {
    const { command, timeout_sec } = args || {};
    if (!command || typeof command !== 'string') {
      throw new Error('Invalid shell command');
    }
    console.log('[LocalExecutor] Running shell command:', command);

    try {
      const started = Date.now();
      const shellPath = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';

      // Heuristic: optimize expensive home-wide find directory searches
      // Example pattern: find ~ -type d -iname 'AGx TEST' 2>/dev/null
      const isDarwin = process.platform === 'darwin';
      const findHomeDirRegex = /(^|\s)find\s+(~|\$?HOME)(?=\s|$)/i;
      const findTypeDRegex = /\b-type\s+d\b/i;
      const inameRegex = /\b-i?name\s+(["'])(.*?)\1/i; // capture name
      const looksLikeFindHome = findHomeDirRegex.test(command) && findTypeDRegex.test(command);

      // Prefer shorter timeouts for search commands; keep generous default otherwise
      const defaultTimeoutMs = (timeout_sec || 60) * 1000;
      const searchTimeoutMs = Math.min(defaultTimeoutMs, 20000); // cap at 20s for searches

      // If command is a home-wide directory find, attempt optimized path
      if (looksLikeFindHome) {
        const nameMatch = command.match(inameRegex);
        const targetName = (nameMatch && nameMatch[2]) ? nameMatch[2] : null;
        const folders = ['Desktop', 'Documents', 'Downloads', 'Library', 'Dropbox', 'OneDrive', 'Box', 'Google Drive'];
        const folderArgs = folders.map(f => `"$HOME/${f}"`).join(' ');

        // macOS Spotlight search is much faster
        if (isDarwin && targetName) {
          const mdCmd = `mdfind -onlyin "$HOME" 'kMDItemFSName == "${targetName}" && kMDItemContentType == "public.folder"' | head -n 10`;
          try {
            const { stdout: mdOut, stderr: mdErr } = await execAsync(mdCmd, {
              timeout: searchTimeoutMs,
              maxBuffer: 10 * 1024 * 1024,
              shell: shellPath,
            });
            const mdTrim = (mdOut || '').trim();
            if (mdTrim.length > 0) {
              const duration_ms = Date.now() - started;
              return {
                status: 'completed',
                stdout: mdOut || '',
                stderr: mdErr || '',
                exit_code: 0,
                message: 'Command executed (optimized via mdfind)',
                duration_ms,
              };
            }
          } catch (e) {
            // fall through to constrained find
          }
        }

        // Constrained find over common user folders with max depth
        const safePattern = targetName ? `-iname "${targetName}"` : '';
        const constrainedFind = `find ${folderArgs} -maxdepth 5 -type d ${safePattern} 2>/dev/null | head -n 10`;
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
      return {
        status: timedOut ? 'timeout' : 'failed',
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exit_code: exit,
        message: timedOut ? `Command timed out after ${(timeout_sec || 60)}s` : 'Command failed',
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
    const filePath = args.path || args.filename;
    const encoding = args.encoding;
    
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
