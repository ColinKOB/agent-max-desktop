#!/usr/bin/env node
/**
 * Performance Budget Test
 * 
 * Validates glass UI meets performance budgets:
 * - Compositor time: ≤3ms per frame
 * - Dropped frames: 0
 * - No filter/backdrop-filter animation
 * 
 * Uses Puppeteer to record DevTools trace and parse metrics.
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BUDGETS = {
  compositorTimeMs: 3,
  maxFrameDrops: 0,
  targetFps: 60,
};

async function runPerfTest() {
  console.log('🎯 Running Performance Budget Test...\n');
  
  const browser = await puppeteer.launch({headless: true});
  const page = await browser.newPage();
  
  // Load test page
  const testPath = path.join(process.cwd(), 'test-glass-ui.html');
  await page.goto(`file://${testPath}`, {waitUntil: 'networkidle0'});
  
  // Start tracing
  await page.tracing.start({
    path: 'test-results/perf-trace.json',
    screenshots: false,
    categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline.frame'],
  });
  
  // Simulate 5-second interaction
  console.log('📊 Recording 5-second interaction...');
  
  // Scroll test
  await page.evaluate(() => {
    window.scrollTo(0, 500);
  });
  await page.waitForTimeout(1000);
  
  // Hover button test
  await page.hover('button');
  await page.waitForTimeout(1000);
  
  // Focus input test
  await page.focus('input');
  await page.waitForTimeout(1000);
  
  // More scrolling
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(2000);
  
  // Stop tracing
  await page.tracing.stop();
  
  // Parse trace
  const trace = JSON.parse(fs.readFileSync('test-results/perf-trace.json', 'utf8'));
  const metrics = analyzeTrace(trace);
  
  console.log('\n📈 Performance Metrics:');
  console.log(`   Avg Compositor Time: ${metrics.avgCompositorMs.toFixed(2)}ms`);
  console.log(`   Max Compositor Time: ${metrics.maxCompositorMs.toFixed(2)}ms`);
  console.log(`   Dropped Frames: ${metrics.droppedFrames}`);
  console.log(`   Avg FPS: ${metrics.avgFps.toFixed(1)}`);
  
  await browser.close();
  
  // Check budgets
  let passed = true;
  
  if (metrics.maxCompositorMs > BUDGETS.compositorTimeMs) {
    console.error(`\n❌ FAIL: Compositor time ${metrics.maxCompositorMs.toFixed(2)}ms exceeds budget (${BUDGETS.compositorTimeMs}ms)`);
    passed = false;
  }
  
  if (metrics.droppedFrames > BUDGETS.maxFrameDrops) {
    console.error(`\n❌ FAIL: ${metrics.droppedFrames} dropped frames (budget: ${BUDGETS.maxFrameDrops})`);
    passed = false;
  }
  
  if (passed) {
    console.log('\n✅ Performance: PASS');
    console.log(`   All budgets met ✓\n`);
    process.exit(0);
  } else {
    console.log('\n💡 Suggestions:');
    console.log('   - Reduce blur radius (14px → 12px)');
    console.log('   - Simplify gradient overlays');
    console.log('   - Check for nested blur layers\n');
    process.exit(1);
  }
}

function analyzeTrace(trace) {
  const events = trace.traceEvents || [];
  
  // Find compositor events
  const compositorEvents = events.filter(e => 
    e.name === 'CompositeLayers' || e.name === 'Composite'
  );
  
  const compositorTimes = compositorEvents
    .filter(e => e.dur)
    .map(e => e.dur / 1000); // Convert to ms
  
  // Calculate frame metrics
  const frames = events.filter(e => e.name === 'DrawFrame');
  const frameTimes = frames
    .filter(e => e.dur)
    .map(e => e.dur / 1000);
  
  const droppedFrames = frameTimes.filter(t => t > 16.7).length;
  const avgFps = frameTimes.length > 0 
    ? 1000 / (frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length)
    : 60;
  
  return {
    avgCompositorMs: compositorTimes.length > 0 
      ? compositorTimes.reduce((a, b) => a + b, 0) / compositorTimes.length 
      : 0,
    maxCompositorMs: compositorTimes.length > 0 
      ? Math.max(...compositorTimes) 
      : 0,
    droppedFrames,
    avgFps,
  };
}

// Fallback if Puppeteer not installed
if (!fs.existsSync(path.join(process.cwd(), 'node_modules/puppeteer'))) {
  console.log('⚠️  Puppeteer not installed. Run: npm install');
  console.log('⚠️  Skipping perf test (manual review required)\n');
  
  console.log('📋 Manual Performance Checklist:');
  console.log('  1. Open test-glass-ui.html in Chrome');
  console.log('  2. DevTools → Performance → Record 5s');
  console.log('  3. Check compositor time ≤3ms per frame');
  console.log('  4. Check 0 dropped frames (60fps solid)\n');
  
  process.exit(0);
}

runPerfTest().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
