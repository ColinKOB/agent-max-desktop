#!/usr/bin/env node
/**
 * Complete Desktop App System Test
 * Tests all components: Electron, React, API connectivity, Memory system, UI components
 *
 * Usage:
 *   cd /Users/colinobrien/Desktop/Coding\ Projects/agent-max-desktop
 *   node test_complete_app.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

// Test results
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  warnings: 0,
  errors: [],
  warnings_list: [],
};

// Helper functions
function printHeader(text) {
  console.log(`\n${colors.bright}${colors.blue}${'='.repeat(70)}${colors.reset}`);
  console.log(
    `${colors.bright}${colors.blue}${text.padStart((70 + text.length) / 2).padEnd(70)}${colors.reset}`
  );
  console.log(`${colors.bright}${colors.blue}${'='.repeat(70)}${colors.reset}\n`);
}

function printSection(name) {
  console.log(`\n${colors.bright}--- ${name} ---${colors.reset}`);
}

function printTest(name, passed, details = '') {
  const status = passed
    ? `${colors.green}✓ PASS${colors.reset}`
    : `${colors.red}✗ FAIL${colors.reset}`;
  console.log(`${status} ${name}`);
  if (details) {
    console.log(`     ${colors.yellow}→ ${details}${colors.reset}`);
  }
}

function test(name, func, critical = true) {
  results.total++;
  try {
    const [passed, details] = func();
    if (passed) {
      results.passed++;
    } else {
      if (critical) {
        results.failed++;
        results.errors.push(`${name}: ${details}`);
      } else {
        results.warnings++;
        results.warnings_list.push(`${name}: ${details}`);
      }
    }
    printTest(name, passed, details);
    return passed;
  } catch (error) {
    if (critical) {
      results.failed++;
      const errorMsg = `${error.name}: ${error.message}`;
      results.errors.push(`${name}: ${errorMsg}`);
    } else {
      results.warnings++;
      const errorMsg = `${error.name}: ${error.message}`;
      results.warnings_list.push(`${name}: ${errorMsg}`);
    }
    printTest(name, false, error.message);
    return false;
  }
}

// ============================================
// ENVIRONMENT TESTS
// ============================================

function testNodeVersion() {
  const { version } = process;
  const major = parseInt(version.slice(1).split('.')[0]);
  const passed = major >= 18;
  const details = `Node ${version}${!passed ? ' (Need Node 18+)' : ''}`;
  return [passed, details];
}

function testPackageJson() {
  const packagePath = path.join(__dirname, 'package.json');
  if (!fs.existsSync(packagePath)) {
    return [false, 'package.json not found'];
  }

  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const details = `v${pkg.version} - ${pkg.name}`;
  return [true, details];
}

function testNodeModules() {
  const nodeModulesPath = path.join(__dirname, 'node_modules');
  const exists = fs.existsSync(nodeModulesPath);

  if (!exists) {
    return [false, 'Run: npm install'];
  }

  // Count installed packages
  const packages = fs
    .readdirSync(nodeModulesPath)
    .filter((f) => !f.startsWith('.') && f !== '.bin');

  return [true, `${packages.length} packages installed`];
}

function testAllDependencies() {
  const packagePath = path.join(__dirname, 'package.json');
  if (!fs.existsSync(packagePath)) {
    return [false, 'package.json not found'];
  }

  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  const required = [
    'react',
    'react-dom',
    'electron',
    'axios',
    'zustand',
    'lucide-react',
    'react-hot-toast',
    'tailwindcss',
    'vite',
  ];

  const missing = required.filter((dep) => !allDeps[dep]);

  const passed = missing.length === 0;
  const details = passed
    ? `All ${required.length} required dependencies listed`
    : `Missing: ${missing.join(', ')}`;
  return [passed, details];
}

// ============================================
// FILE STRUCTURE TESTS
// ============================================

function testElectronStructure() {
  const files = {
    'electron/main.cjs': 'Main process',
    'electron/preload.cjs': 'Preload script',
    'electron/memory-manager.cjs': 'Memory manager',
  };

  const missing = [];
  for (const [file, desc] of Object.entries(files)) {
    if (!fs.existsSync(path.join(__dirname, file))) {
      missing.push(`${file} (${desc})`);
    }
  }

  const passed = missing.length === 0;
  const details = passed
    ? `All ${Object.keys(files).length} Electron files present`
    : `Missing: ${missing.join(', ')}`;
  return [passed, details];
}

function testReactStructure() {
  const dirs = ['src/components', 'src/pages', 'src/services', 'src/store', 'src/styles'];

  const missing = dirs.filter((dir) => !fs.existsSync(path.join(__dirname, dir)));

  const passed = missing.length === 0;
  const details = passed ? 'React structure complete' : `Missing: ${missing.join(', ')}`;
  return [passed, details];
}

function testComponents() {
  const componentsDir = path.join(__dirname, 'src/components');

  if (!fs.existsSync(componentsDir)) {
    return [false, 'src/components/ not found'];
  }

  const components = fs
    .readdirSync(componentsDir)
    .filter((f) => f.endsWith('.jsx') || f.endsWith('.js'));

  const required = ['FloatBar.jsx', 'ProfileCard.jsx', 'ErrorBoundary.jsx'];
  const missing = required.filter((comp) => !components.includes(comp));

  const passed = missing.length === 0;
  const details = passed
    ? `${components.length} components found`
    : `Missing: ${missing.join(', ')}`;
  return [passed, details];
}

function testPages() {
  const pagesDir = path.join(__dirname, 'src/pages');

  if (!fs.existsSync(pagesDir)) {
    return [false, 'src/pages/ not found'];
  }

  const pages = fs.readdirSync(pagesDir).filter((f) => f.endsWith('.jsx') || f.endsWith('.js'));

  const details = `${pages.length} pages found`;
  return [true, details];
}

function testServices() {
  const servicesDir = path.join(__dirname, 'src/services');

  if (!fs.existsSync(servicesDir)) {
    return [false, 'src/services/ not found'];
  }

  const required = ['api.js', 'memory.js'];
  const missing = required.filter((file) => !fs.existsSync(path.join(servicesDir, file)));

  const passed = missing.length === 0;
  const details = passed ? 'API and Memory services present' : `Missing: ${missing.join(', ')}`;
  return [passed, details];
}

function testStore() {
  const storePath = path.join(__dirname, 'src/store/useStore.js');

  if (!fs.existsSync(storePath)) {
    return [false, 'useStore.js not found'];
  }

  const content = fs.readFileSync(storePath, 'utf8');

  // Check for key store features
  const hasZustand = content.includes('zustand');
  const hasState = content.includes('create(');

  const passed = hasZustand && hasState;
  const details = passed
    ? 'Zustand store configured'
    : `Zustand: ${hasZustand}, State: ${hasState}`;
  return [passed, details];
}

function testStyles() {
  const stylesDir = path.join(__dirname, 'src/styles');

  if (!fs.existsSync(stylesDir)) {
    return [false, 'src/styles/ not found'];
  }

  const styles = fs.readdirSync(stylesDir).filter((f) => f.endsWith('.css'));
  const hasGlobals = styles.includes('globals.css');

  const passed = hasGlobals;
  const details = passed ? `${styles.length} style files found` : 'globals.css missing';
  return [passed, details];
}

function testConfigFiles() {
  const configs = {
    'vite.config.js': 'Vite bundler',
    'tailwind.config.js': 'TailwindCSS',
    'postcss.config.js': 'PostCSS',
    'electron-builder.json': 'Electron builder',
  };

  const missing = [];
  for (const [file, desc] of Object.entries(configs)) {
    if (!fs.existsSync(path.join(__dirname, file))) {
      missing.push(`${file} (${desc})`);
    }
  }

  const passed = missing.length === 0;
  const details = passed ? 'All config files present' : `Missing: ${missing.join(', ')}`;
  return [passed, details];
}

// ============================================
// COMPONENT VALIDATION TESTS
// ============================================

function testFloatBarComponent() {
  const filePath = path.join(__dirname, 'src/components/FloatBar.jsx');

  if (!fs.existsSync(filePath)) {
    return [false, 'FloatBar.jsx not found'];
  }

  const content = fs.readFileSync(filePath, 'utf8');

  const features = {
    useState: content.includes('useState'),
    useEffect: content.includes('useEffect'),
    axios: content.includes('axios') || content.includes('api'),
    modes: content.includes('mini') || content.includes('bar') || content.includes('card'),
  };

  const missing = Object.entries(features)
    .filter(([_, present]) => !present)
    .map(([name, _]) => name);

  const passed = missing.length === 0;
  const details = passed ? 'All features present' : `Missing: ${missing.join(', ')}`;
  return [passed, details];
}

function testAPIService() {
  const filePath = path.join(__dirname, 'src/services/api.js');

  if (!fs.existsSync(filePath)) {
    return [false, 'api.js not found'];
  }

  const content = fs.readFileSync(filePath, 'utf8');

  const features = {
    axios: content.includes('axios'),
    baseURL: content.includes('baseURL') || content.includes('BASE_URL'),
    endpoints: content.includes('export') && content.includes('API'),
  };

  const missing = Object.entries(features)
    .filter(([_, present]) => !present)
    .map(([name, _]) => name);

  const passed = missing.length === 0;
  const details = passed ? 'API service configured' : `Missing: ${missing.join(', ')}`;
  return [passed, details];
}

function testMemoryService() {
  const filePath = path.join(__dirname, 'src/services/memory.js');

  if (!fs.existsSync(filePath)) {
    return [false, 'memory.js not found'];
  }

  const content = fs.readFileSync(filePath, 'utf8');

  const hasElectron = content.includes('electron') || content.includes('window.electron');
  const hasMemory = content.includes('memory');

  const passed = hasElectron && hasMemory;
  const details = passed
    ? 'Memory service configured'
    : `Electron: ${hasElectron}, Memory: ${hasMemory}`;
  return [passed, details];
}

function testPreloadExposure() {
  const filePath = path.join(__dirname, 'electron/preload.cjs');

  if (!fs.existsSync(filePath)) {
    return [false, 'preload.cjs not found'];
  }

  const content = fs.readFileSync(filePath, 'utf8');

  const features = {
    contextBridge: content.includes('contextBridge'),
    electron: content.includes("exposeInMainWorld('electron'"),
    memory: content.includes('memory:'),
    openExternal: content.includes('openExternal'),
  };

  const missing = Object.entries(features)
    .filter(([_, present]) => !present)
    .map(([name, _]) => name);

  const passed = missing.length === 0;
  const details = passed ? 'All APIs exposed' : `Missing: ${missing.join(', ')}`;
  return [passed, details];
}

function testMainIPCHandlers() {
  const filePath = path.join(__dirname, 'electron/main.cjs');

  if (!fs.existsSync(filePath)) {
    return [false, 'main.cjs not found'];
  }

  const content = fs.readFileSync(filePath, 'utf8');

  const handlers = [
    'resize-window',
    'open-external',
    'take-screenshot',
    'memory:get-profile',
    'memory:get-facts',
  ];

  const registered = handlers.filter((handler) => content.includes(`ipcMain.handle('${handler}'`));

  const passed = registered.length >= 3; // At least 3 handlers
  const details = `${registered.length}/${handlers.length} key handlers registered`;
  return [passed, details];
}

// ============================================
// API CONNECTIVITY TESTS
// ============================================

function testAPIConnectivity() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 8000,
      path: '/health',
      method: 'GET',
      timeout: 2000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const passed = res.statusCode === 200 && json.status === 'healthy';
          const details = passed ? `API running: ${json.service}` : `Status: ${res.statusCode}`;
          resolve([passed, details]);
        } catch (error) {
          resolve([false, 'Invalid JSON response']);
        }
      });
    });

    req.on('error', () => {
      resolve([false, 'Cannot connect to localhost:8000 (API not running)']);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve([false, 'Connection timeout']);
    });

    req.end();
  });
}

function testAPIEndpoints() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 8000,
      path: '/',
      method: 'GET',
      timeout: 2000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const endpoints = json.endpoints || {};
          const count = Object.keys(endpoints).length;
          const passed = count >= 5;
          const details = passed
            ? `${count} endpoint groups registered`
            : `Only ${count} endpoints found`;
          resolve([passed, details]);
        } catch (error) {
          resolve([false, 'Invalid JSON response']);
        }
      });
    });

    req.on('error', () => {
      resolve([false, 'API not running']);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve([false, 'Connection timeout']);
    });

    req.end();
  });
}

function testProfileAPI() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 8000,
      path: '/api/v2/profile',
      method: 'GET',
      timeout: 2000,
    };

    const req = http.request(options, (res) => {
      const passed = res.statusCode === 200 || res.statusCode === 404;
      const details = `Status: ${res.statusCode}`;
      resolve([passed, details]);
    });

    req.on('error', () => {
      resolve([false, 'API not running']);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve([false, 'Timeout']);
    });

    req.end();
  });
}

function testChatAPI() {
  return new Promise((resolve) => {
    const postData = JSON.stringify({ message: 'test' });

    const options = {
      hostname: 'localhost',
      port: 8000,
      path: '/api/v2/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 10000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        const passed = res.statusCode === 200;
        const details = passed ? 'Chat endpoint responding' : `Status: ${res.statusCode}`;
        resolve([passed, details]);
      });
    });

    req.on('error', () => {
      resolve([false, 'API not running']);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve([false, 'Timeout (may need OpenAI key)']);
    });

    req.write(postData);
    req.end();
  });
}

// ============================================
// MAIN TEST RUNNER
// ============================================

async function main() {
  printHeader('Agent Max Desktop - Complete System Test');

  console.log(`${colors.bright}Testing All Components${colors.reset}`);
  console.log(`Time: ${new Date().toLocaleString()}`);
  console.log(`Path: ${__dirname}\n`);

  // Environment Tests
  printSection('Environment & Dependencies');
  test('Node.js Version', testNodeVersion);
  test('package.json', testPackageJson);
  test('node_modules Installed', testNodeModules);
  test('All Dependencies', testAllDependencies);

  // File Structure Tests
  printSection('File Structure');
  test('Electron Structure', testElectronStructure);
  test('React Structure', testReactStructure);
  test('Components Directory', testComponents);
  test('Pages Directory', testPages);
  test('Services Directory', testServices);
  test('Store Configuration', testStore);
  test('Styles Directory', testStyles);
  test('Config Files', testConfigFiles);

  // Component Validation Tests
  printSection('Component Validation');
  test('FloatBar Component', testFloatBarComponent);
  test('API Service', testAPIService);
  test('Memory Service', testMemoryService);
  test('Preload API Exposure', testPreloadExposure);
  test('Main IPC Handlers', testMainIPCHandlers);

  // API Connectivity Tests
  printSection('API Connectivity');
  const apiRunning = await new Promise((resolve) => {
    testAPIConnectivity().then(([passed, details]) => {
      printTest('API Server Running', passed, details);
      results.total++;
      if (passed) {
        results.passed++;
      } else {
        results.warnings++;
        results.warnings_list.push(`API Server Running: ${details}`);
      }
      resolve(passed);
    });
  });

  if (apiRunning) {
    await new Promise((resolve) => {
      testAPIEndpoints().then(([passed, details]) => {
        printTest('API Endpoints', passed, details);
        results.total++;
        if (passed) {
          results.passed++;
        } else {
          results.failed++;
          results.errors.push(`API Endpoints: ${details}`);
        }
        resolve();
      });
    });

    await new Promise((resolve) => {
      testProfileAPI().then(([passed, details]) => {
        printTest('Profile API', passed, details);
        results.total++;
        if (passed) {
          results.passed++;
        } else {
          results.warnings++;
          results.warnings_list.push(`Profile API: ${details}`);
        }
        resolve();
      });
    });

    await new Promise((resolve) => {
      testChatAPI().then(([passed, details]) => {
        printTest('Chat API', passed, details);
        results.total++;
        if (passed) {
          results.passed++;
        } else {
          results.warnings++;
          results.warnings_list.push(`Chat API: ${details}`);
        }
        resolve();
      });
    });
  } else {
    console.log(
      `\n${colors.yellow}⚠️  Skipping API endpoint tests (server not running)${colors.reset}`
    );
    console.log(
      `${colors.yellow}   Start API with: cd ../Agent_Max && python agent_max.py --api${colors.reset}`
    );
  }

  // Summary
  printHeader('Test Summary');

  const { total, passed, failed, warnings } = results;
  const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : 0;

  console.log(`Total Tests:  ${total}`);
  console.log(`${colors.green}Passed:       ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed:       ${failed}${colors.reset}`);
  console.log(`${colors.yellow}Warnings:     ${warnings}${colors.reset}`);
  console.log(`Pass Rate:    ${passRate}%\n`);

  if (failed > 0) {
    console.log(`${colors.bright}${colors.red}Critical Failures:${colors.reset}`);
    results.errors.forEach((error) => {
      console.log(`  ${colors.red}✗${colors.reset} ${error}`);
    });
    console.log();
  }

  if (warnings > 0) {
    console.log(`${colors.bright}${colors.yellow}Warnings (Non-Critical):${colors.reset}`);
    results.warnings_list.forEach((warning) => {
      console.log(`  ${colors.yellow}⚠${colors.reset} ${warning}`);
    });
    console.log();
  }

  // Recommendations
  if (failed > 0 || warnings > 0) {
    console.log(`${colors.bright}${colors.yellow}Recommendations:${colors.reset}`);

    if (results.errors.some((e) => e.includes('node_modules'))) {
      console.log(`  1. Install dependencies:`);
      console.log(`     ${colors.blue}npm install${colors.reset}`);
    }

    if (!apiRunning) {
      console.log(`  2. Start the API server:`);
      console.log(
        `     ${colors.blue}cd ../Agent_Max && source venv/bin/activate && python agent_max.py --api${colors.reset}`
      );
    }

    if (results.errors.some((e) => e.includes('Missing'))) {
      console.log(`  3. Check file structure - some files may be missing`);
    }

    console.log();
  }

  // Exit code
  const exitCode = failed === 0 ? 0 : 1;

  if (exitCode === 0) {
    console.log(`${colors.green}${colors.bright}✓ All critical tests passed!${colors.reset}`);
    if (warnings > 0) {
      console.log(`${colors.yellow}  ${warnings} optional features not configured${colors.reset}`);
    }
    console.log(`\n${colors.bright}Next steps:${colors.reset}`);
    console.log(`  1. Start the app: ${colors.blue}npm run electron:dev${colors.reset}`);
    console.log(`  2. Test the UI and features`);
    console.log(`  3. Connect Google services in Settings\n`);
  } else {
    console.log(
      `${colors.red}${colors.bright}✗ ${failed} critical test(s) failed. Fix issues above.${colors.reset}\n`
    );
  }

  process.exit(exitCode);
}

// Run tests
main().catch((error) => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});
