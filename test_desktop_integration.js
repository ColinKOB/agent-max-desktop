#!/usr/bin/env node
/**
 * Comprehensive Desktop App Integration Test
 * Tests Electron app, React components, API connectivity, and Google integration UI
 *
 * Usage:
 *   cd /Users/colinobrien/Desktop/Coding\ Projects/agent-max-desktop
 *   node test_desktop_integration.js
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
  errors: [],
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

function test(name, func) {
  results.total++;
  try {
    const [passed, details] = func();
    if (passed) {
      results.passed++;
    } else {
      results.failed++;
      results.errors.push(`${name}: ${details}`);
    }
    printTest(name, passed, details);
    return passed;
  } catch (error) {
    results.failed++;
    const errorMsg = `${error.name}: ${error.message}`;
    results.errors.push(`${name}: ${errorMsg}`);
    printTest(name, false, errorMsg);
    return false;
  }
}

// ============================================
// TEST SUITE
// ============================================

function testNodeVersion() {
  const { version } = process;
  const major = parseInt(version.slice(1).split('.')[0]);
  const passed = major >= 18;
  const details = `Node ${version}${!passed ? ' (Need Node 18+)' : ''}`;
  return [passed, details];
}

function testPackageJsonExists() {
  const packagePath = path.join(__dirname, 'package.json');
  const exists = fs.existsSync(packagePath);
  return [exists, exists ? 'package.json found' : 'package.json not found'];
}

function testNodeModulesExists() {
  const nodeModulesPath = path.join(__dirname, 'node_modules');
  const exists = fs.existsSync(nodeModulesPath);
  const details = exists ? 'node_modules installed' : 'Run: npm install';
  return [exists, details];
}

function testRequiredDependencies() {
  const packagePath = path.join(__dirname, 'package.json');
  if (!fs.existsSync(packagePath)) {
    return [false, 'package.json not found'];
  }

  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const required = [
    'react',
    'react-dom',
    'electron',
    'axios',
    'lucide-react',
    'zustand',
    'react-hot-toast',
  ];

  const missing = required.filter((dep) => !pkg.dependencies[dep] && !pkg.devDependencies[dep]);

  const passed = missing.length === 0;
  const details = passed
    ? `All ${required.length} dependencies listed`
    : `Missing: ${missing.join(', ')}`;
  return [passed, details];
}

function testElectronFiles() {
  const files = ['electron/main.cjs', 'electron/preload.cjs'];

  const missing = files.filter((file) => !fs.existsSync(path.join(__dirname, file)));

  const passed = missing.length === 0;
  const details = passed ? 'All Electron files present' : `Missing: ${missing.join(', ')}`;
  return [passed, details];
}

function testReactComponents() {
  const components = [
    'src/components/FloatBar.jsx',
    'src/components/GoogleConnect.jsx',
    'src/components/ProfileCard.jsx',
  ];

  const missing = components.filter((file) => !fs.existsSync(path.join(__dirname, file)));

  const passed = missing.length === 0;
  const details = passed
    ? `All ${components.length} components present`
    : `Missing: ${missing.join(', ')}`;
  return [passed, details];
}

function testPages() {
  const pages = ['src/pages/Settings.jsx', 'src/pages/GoogleSetup.jsx'];

  const missing = pages.filter((file) => !fs.existsSync(path.join(__dirname, file)));

  const passed = missing.length === 0;
  const details = passed ? 'All pages present' : `Missing: ${missing.join(', ')}`;
  return [passed, details];
}

function testGoogleConnectComponent() {
  const filePath = path.join(__dirname, 'src/components/GoogleConnect.jsx');

  if (!fs.existsSync(filePath)) {
    return [false, 'GoogleConnect.jsx not found'];
  }

  const content = fs.readFileSync(filePath, 'utf8');

  // Check for key features
  const features = [
    { name: 'useState', check: content.includes('useState') },
    { name: 'axios', check: content.includes('axios') },
    { name: 'openExternal', check: content.includes('openExternal') },
    { name: 'connectGoogle', check: content.includes('connectGoogle') },
    { name: 'service cards', check: content.includes('services.map') },
  ];

  const missing = features.filter((f) => !f.check).map((f) => f.name);
  const passed = missing.length === 0;
  const details = passed ? 'All features present' : `Missing: ${missing.join(', ')}`;
  return [passed, details];
}

function testSettingsIntegration() {
  const filePath = path.join(__dirname, 'src/pages/Settings.jsx');

  if (!fs.existsSync(filePath)) {
    return [false, 'Settings.jsx not found'];
  }

  const content = fs.readFileSync(filePath, 'utf8');

  // Check if GoogleConnect is imported and used
  const hasImport = content.includes('GoogleConnect');
  const hasUsage = content.includes('<GoogleConnect');

  const passed = hasImport && hasUsage;
  const details = passed
    ? 'GoogleConnect integrated in Settings'
    : `Import: ${hasImport}, Usage: ${hasUsage}`;
  return [passed, details];
}

function testPreloadAPI() {
  const filePath = path.join(__dirname, 'electron/preload.cjs');

  if (!fs.existsSync(filePath)) {
    return [false, 'preload.cjs not found'];
  }

  const content = fs.readFileSync(filePath, 'utf8');

  // Check for electronAPI exposure
  const hasElectronAPI = content.includes('electronAPI');
  const hasOpenExternal = content.includes('openExternal');

  const passed = hasElectronAPI && hasOpenExternal;
  const details = passed
    ? 'electronAPI.openExternal exposed'
    : `electronAPI: ${hasElectronAPI}, openExternal: ${hasOpenExternal}`;
  return [passed, details];
}

function testMainIPCHandlers() {
  const filePath = path.join(__dirname, 'electron/main.cjs');

  if (!fs.existsSync(filePath)) {
    return [false, 'main.cjs not found'];
  }

  const content = fs.readFileSync(filePath, 'utf8');

  // Check for open-external handler
  const hasHandler = content.includes("ipcMain.handle('open-external'");
  const hasShell = content.includes('shell.openExternal');

  const passed = hasHandler && hasShell;
  const details = passed ? 'IPC handler configured' : `Handler: ${hasHandler}, Shell: ${hasShell}`;
  return [passed, details];
}

function testBuildConfig() {
  const files = ['vite.config.js', 'tailwind.config.js', 'postcss.config.js'];

  const missing = files.filter((file) => !fs.existsSync(path.join(__dirname, file)));

  const passed = missing.length === 0;
  const details = passed ? 'All config files present' : `Missing: ${missing.join(', ')}`;
  return [passed, details];
}

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
        } catch {
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

function testGoogleEndpoints() {
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
          const hasGoogle = json.endpoints && json.endpoints.google;
          const passed = hasGoogle;
          const details = passed
            ? `Google endpoints at ${json.endpoints.google}`
            : 'Google endpoints not registered';
          resolve([passed, details]);
        } catch {
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

function testGoogleAuthEndpoint() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 8000,
      path: '/api/v2/google/auth/url',
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
          const hasAuthUrl = json.auth_url && json.state;
          const passed = res.statusCode === 200 && hasAuthUrl;
          let details;
          if (passed) {
            details = 'Auth endpoint working';
          } else if (res.statusCode === 503) {
            details = 'OAuth not configured';
          } else {
            details = `Status: ${res.statusCode}`;
          }
          resolve([passed, details]);
        } catch {
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

function testStylesExist() {
  const styles = ['src/styles/globals.css'];

  const missing = styles.filter((file) => !fs.existsSync(path.join(__dirname, file)));

  const passed = missing.length === 0;
  const details = passed ? 'Style files present' : `Missing: ${missing.join(', ')}`;
  return [passed, details];
}

function testIndexHtml() {
  const filePath = path.join(__dirname, 'index.html');

  if (!fs.existsSync(filePath)) {
    return [false, 'index.html not found'];
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const hasRoot = content.includes('id="root"');
  const hasScript = content.includes('src/main.jsx');

  const passed = hasRoot && hasScript;
  const details = passed
    ? 'index.html configured correctly'
    : `Root: ${hasRoot}, Script: ${hasScript}`;
  return [passed, details];
}

// ============================================
// MAIN TEST RUNNER
// ============================================

async function main() {
  printHeader('Desktop App Integration Test Suite');

  console.log(`${colors.bright}Testing Agent Max Desktop App${colors.reset}`);
  console.log(`Time: ${new Date().toLocaleString()}`);
  console.log(`Path: ${__dirname}\n`);

  // Environment Tests
  printSection('Environment');
  test('Node.js Version', testNodeVersion);
  test('package.json Exists', testPackageJsonExists);
  test('node_modules Installed', testNodeModulesExists);
  test('Required Dependencies', testRequiredDependencies);

  // File Structure Tests
  printSection('File Structure');
  test('Electron Files', testElectronFiles);
  test('React Components', testReactComponents);
  test('Pages', testPages);
  test('Build Configuration', testBuildConfig);
  test('Styles', testStylesExist);
  test('index.html', testIndexHtml);

  // Component Tests
  printSection('Google Integration Components');
  test('GoogleConnect Component', testGoogleConnectComponent);
  test('Settings Integration', testSettingsIntegration);
  test('Preload API Exposure', testPreloadAPI);
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
        results.failed++;
        results.errors.push(`API Server Running: ${details}`);
      }
      resolve(passed);
    });
  });

  if (apiRunning) {
    await new Promise((resolve) => {
      testGoogleEndpoints().then(([passed, details]) => {
        printTest('Google Endpoints Registered', passed, details);
        results.total++;
        if (passed) {
          results.passed++;
        } else {
          results.failed++;
          results.errors.push(`Google Endpoints Registered: ${details}`);
        }
        resolve();
      });
    });

    await new Promise((resolve) => {
      testGoogleAuthEndpoint().then(([passed, details]) => {
        printTest('Google Auth Endpoint', passed, details);
        results.total++;
        if (passed) {
          results.passed++;
        } else {
          results.failed++;
          results.errors.push(`Google Auth Endpoint: ${details}`);
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

  const { total, passed, failed } = results;
  const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : 0;

  console.log(`Total Tests:  ${total}`);
  console.log(`${colors.green}Passed:       ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed:       ${failed}${colors.reset}`);
  console.log(`Pass Rate:    ${passRate}%\n`);

  if (failed > 0) {
    console.log(`${colors.bright}${colors.red}Failed Tests:${colors.reset}`);
    results.errors.forEach((error) => {
      console.log(`  ${colors.red}✗${colors.reset} ${error}`);
    });
    console.log();
  }

  // Recommendations
  if (failed > 0) {
    console.log(`${colors.bright}${colors.yellow}Recommendations:${colors.reset}`);

    if (results.errors.some((e) => e.includes('node_modules'))) {
      console.log(`  1. Install dependencies:`);
      console.log(`     ${colors.blue}npm install${colors.reset}`);
    }

    if (results.errors.some((e) => e.includes('API not running'))) {
      console.log(`  2. Start the API server:`);
      console.log(
        `     ${colors.blue}cd ../Agent_Max && source venv/bin/activate && python agent_max.py --api${colors.reset}`
      );
    }

    if (results.errors.some((e) => e.includes('Missing'))) {
      console.log(`  3. Check file structure - some files may be missing`);
    }

    if (results.errors.some((e) => e.includes('OAuth not configured'))) {
      console.log(`  4. Configure Google OAuth in Agent_Max/.env:`);
      console.log(`     ${colors.blue}GOOGLE_OAUTH_CLIENT_ID=your-client-id${colors.reset}`);
    }

    console.log();
  }

  // Exit code
  const exitCode = failed === 0 ? 0 : 1;

  if (exitCode === 0) {
    console.log(
      `${colors.green}${colors.bright}✓ All tests passed! Desktop app is ready.${colors.reset}\n`
    );
    console.log(`${colors.bright}Next steps:${colors.reset}`);
    console.log(`  1. Start the app: ${colors.blue}npm run electron:dev${colors.reset}`);
    console.log(`  2. Go to Settings and connect Google account`);
    console.log(`  3. Test all Google services\n`);
  } else {
    console.log(
      `${colors.red}${colors.bright}✗ Some tests failed. Fix the issues above and try again.${colors.reset}\n`
    );
  }

  process.exit(exitCode);
}

// Run tests
main().catch((error) => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});
