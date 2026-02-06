/**
 * App Discovery Service for Agent Max
 *
 * Scans the user's Mac to discover installed applications and desktop file context
 * for personalized onboarding experiences.
 *
 * This service is READ-ONLY and never modifies user files.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Cache for discovered apps (scan once per session)
let appCache = null;
let desktopCache = null;
let cacheTimestamp = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL

// File type categories for desktop scanning
const FILE_CATEGORIES = {
  documents: ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt', '.pages', '.md'],
  spreadsheets: ['.xls', '.xlsx', '.csv', '.numbers', '.ods'],
  presentations: ['.ppt', '.pptx', '.key', '.odp'],
  images: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.heic', '.raw'],
  videos: ['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.m4v'],
  audio: ['.mp3', '.wav', '.aac', '.flac', '.m4a', '.ogg', '.wma'],
  archives: ['.zip', '.rar', '.7z', '.tar', '.gz', '.dmg'],
  code: ['.js', '.ts', '.py', '.java', '.cpp', '.c', '.h', '.swift', '.rb', '.go', '.rs', '.php', '.html', '.css', '.json', '.xml', '.yaml', '.yml'],
  design: ['.psd', '.ai', '.sketch', '.fig', '.xd', '.indd'],
};

/**
 * Check if the cache is still valid
 */
function isCacheValid() {
  if (!cacheTimestamp) return false;
  return (Date.now() - cacheTimestamp) < CACHE_TTL_MS;
}

/**
 * Clear the cache (useful for manual refresh)
 */
function clearCache() {
  appCache = null;
  desktopCache = null;
  cacheTimestamp = null;
}

/**
 * Scan multiple application folders for installed .app bundles
 * Returns array of { name: string, bundleId?: string, path: string }
 */
async function scanInstalledApps() {
  // Return cached result if valid
  if (appCache && isCacheValid()) {
    console.log('[AppDiscovery] Returning cached app list');
    return appCache;
  }

  console.log('[AppDiscovery] Scanning application folders...');
  const apps = [];
  const seenNames = new Set(); // Avoid duplicates by name

  // Scan multiple locations where apps can be installed
  const applicationPaths = [
    '/Applications',                          // Main Applications folder
    '/System/Applications',                   // System apps (Calculator, Preview, etc.)
    path.join(os.homedir(), 'Applications'),  // User-specific apps
  ];

  for (const applicationsPath of applicationPaths) {
    try {
      // Check if folder exists
      if (!fs.existsSync(applicationsPath)) {
        continue;
      }

      // Read the Applications directory
      const entries = await fs.promises.readdir(applicationsPath, { withFileTypes: true });

      for (const entry of entries) {
        // Only process .app bundles (directories or symlinks with .app extension)
        // Note: Some system apps like Safari are symlinks to cryptex locations
        const isAppBundle = entry.name.endsWith('.app') &&
                            (entry.isDirectory() || entry.isSymbolicLink());

        if (isAppBundle) {
          const appPath = path.join(applicationsPath, entry.name);
          const appName = entry.name.replace(/\.app$/, '');

          // Skip duplicates (same app name in different locations)
          if (seenNames.has(appName.toLowerCase())) {
            continue;
          }
          seenNames.add(appName.toLowerCase());

          const appInfo = {
            name: appName,
            path: appPath,
            bundleId: null,
          };

          // Try to read bundle identifier from Info.plist (optional, non-blocking)
          try {
            const infoPlistPath = path.join(appPath, 'Contents', 'Info.plist');
            if (fs.existsSync(infoPlistPath)) {
              // Use PlistBuddy to extract bundle identifier (macOS native tool)
              const { stdout } = await execAsync(
                `/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "${infoPlistPath}"`,
                { timeout: 1000 } // 1 second timeout per app
              );
              appInfo.bundleId = stdout.trim();
            }
          } catch (err) {
            // Silently ignore plist read errors - bundle ID is optional
          }

          apps.push(appInfo);
        }
      }
    } catch (error) {
      console.warn(`[AppDiscovery] Error scanning ${applicationsPath}:`, error.message);
      // Continue to next folder
    }
  }

  // Sort alphabetically by name
  apps.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

  console.log(`[AppDiscovery] Found ${apps.length} applications total`);
  appCache = apps;
  cacheTimestamp = Date.now();

  return apps;
}

/**
 * Scan ~/Desktop for files and categorize by type
 * Returns { documents: number, images: number, spreadsheets: number, etc., totalFiles: number, sampleFiles: string[] }
 */
async function scanDesktopFiles() {
  // Return cached result if valid
  if (desktopCache && isCacheValid()) {
    console.log('[AppDiscovery] Returning cached desktop scan');
    return desktopCache;
  }

  console.log('[AppDiscovery] Scanning ~/Desktop folder...');
  const desktopPath = path.join(os.homedir(), 'Desktop');

  const result = {
    documents: 0,
    spreadsheets: 0,
    presentations: 0,
    images: 0,
    videos: 0,
    audio: 0,
    archives: 0,
    code: 0,
    design: 0,
    other: 0,
    totalFiles: 0,
    totalFolders: 0,
    sampleFiles: [], // First 10 file names (without full path for privacy)
  };

  try {
    // Check if Desktop exists
    if (!fs.existsSync(desktopPath)) {
      console.warn('[AppDiscovery] Desktop folder not found');
      return result;
    }

    // Read the Desktop directory
    const entries = await fs.promises.readdir(desktopPath, { withFileTypes: true });

    for (const entry of entries) {
      // Skip hidden files
      if (entry.name.startsWith('.')) continue;

      if (entry.isFile()) {
        result.totalFiles++;

        // Add to sample files (limit to 10)
        if (result.sampleFiles.length < 10) {
          result.sampleFiles.push(entry.name);
        }

        // Categorize by extension
        const ext = path.extname(entry.name).toLowerCase();
        let categorized = false;

        for (const [category, extensions] of Object.entries(FILE_CATEGORIES)) {
          if (extensions.includes(ext)) {
            result[category]++;
            categorized = true;
            break;
          }
        }

        if (!categorized) {
          result.other++;
        }
      } else if (entry.isDirectory()) {
        result.totalFolders++;
      }
    }

    console.log(`[AppDiscovery] Desktop scan: ${result.totalFiles} files, ${result.totalFolders} folders`);
    desktopCache = result;

    return result;
  } catch (error) {
    console.error('[AppDiscovery] Error scanning desktop:', error.message);
    return result;
  }
}

/**
 * Get commonly used apps by checking recent items (bonus feature)
 * This uses the macOS "Recent Items" feature when available
 */
async function getRecentlyUsedApps() {
  try {
    // Use mdfind to get recently opened apps from Spotlight metadata
    const { stdout } = await execAsync(
      'mdfind "kMDItemLastUsedDate >= $time.today(-7)" -onlyin /Applications | head -20',
      { timeout: 5000 }
    );

    const recentApps = stdout
      .split('\n')
      .filter(line => line.endsWith('.app'))
      .map(appPath => ({
        name: path.basename(appPath, '.app'),
        path: appPath,
        recentlyUsed: true,
      }));

    return recentApps;
  } catch (error) {
    // Silently fail - this is an optional enhancement
    return [];
  }
}

/**
 * Combines app and desktop scans into a single user context object
 * This is the main function to call from IPC handlers
 */
async function getUserContext() {
  console.log('[AppDiscovery] Building user context...');

  try {
    // Run both scans in parallel for better performance
    const [installedApps, desktopContext, recentlyUsed] = await Promise.all([
      scanInstalledApps(),
      scanDesktopFiles(),
      getRecentlyUsedApps().catch(() => []), // Don't fail if this optional feature fails
    ]);

    // Mark recently used apps in the installed apps list
    const installedAppsWithRecent = installedApps.map(app => {
      const isRecent = recentlyUsed.some(
        recent => recent.name.toLowerCase() === app.name.toLowerCase()
      );
      return { ...app, recentlyUsed: isRecent };
    });

    const context = {
      installedApps: installedAppsWithRecent,
      desktopContext,
      platform: process.platform,
      osVersion: os.release(),
      scanTimestamp: new Date().toISOString(),
    };

    console.log('[AppDiscovery] User context built successfully');
    console.log(`[AppDiscovery]   - ${context.installedApps.length} apps`);
    console.log(`[AppDiscovery]   - ${context.desktopContext.totalFiles} desktop files`);

    return context;
  } catch (error) {
    console.error('[AppDiscovery] Error building user context:', error.message);

    // Return a minimal context on error
    return {
      installedApps: [],
      desktopContext: {
        documents: 0,
        spreadsheets: 0,
        presentations: 0,
        images: 0,
        videos: 0,
        audio: 0,
        archives: 0,
        code: 0,
        design: 0,
        other: 0,
        totalFiles: 0,
        totalFolders: 0,
        sampleFiles: [],
      },
      platform: process.platform,
      osVersion: os.release(),
      scanTimestamp: new Date().toISOString(),
      error: error.message,
    };
  }
}

/**
 * Get just the app names (lightweight version for quick lookups)
 */
async function getInstalledAppNames() {
  const apps = await scanInstalledApps();
  return apps.map(app => app.name);
}

/**
 * Check if a specific app is installed
 */
async function isAppInstalled(appName) {
  const apps = await scanInstalledApps();
  return apps.some(
    app => app.name.toLowerCase() === appName.toLowerCase() ||
           app.bundleId?.toLowerCase() === appName.toLowerCase()
  );
}

module.exports = {
  scanInstalledApps,
  scanDesktopFiles,
  getUserContext,
  getInstalledAppNames,
  isAppInstalled,
  clearCache,
};
