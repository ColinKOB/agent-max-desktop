#!/usr/bin/env node
/**
 * Screenshot Test
 * 
 * Captures cross-platform screenshots for documentation.
 */

const {chromium} = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

async function takeScreenshots() {
  const platform = os.platform();
  console.log(`📸 Taking screenshots on ${platform}...\n`);
  
  const browser = await chromium.launch({headless: true});
  const page = await browser.newPage();
  
  const testPath = path.join(process.cwd(), 'test-glass-ui.html');
  await page.goto(`file://${testPath}`);
  
  const screenshotsDir = path.join(process.cwd(), 'test-results/screenshots');
  fs.mkdirSync(screenshotsDir, {recursive: true});
  
  await page.screenshot({
    path: path.join(screenshotsDir, `glass-${platform}.png`),
    fullPage: true,
  });
  
  console.log(`✅ Screenshot saved: glass-${platform}.png\n`);
  
  await browser.close();
  process.exit(0);
}

// Fallback
if (!fs.existsSync(path.join(process.cwd(), 'node_modules/playwright'))) {
  console.log('⚠️  Playwright not installed. Skipping screenshot test\n');
  process.exit(0);
}

takeScreenshots().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
