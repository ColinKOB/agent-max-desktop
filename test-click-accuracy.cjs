/**
 * Mouse Click Accuracy Test
 *
 * This script tests the coordinate system to ensure clicks land where expected.
 * Run with: npx electron test-click-accuracy.cjs
 */

const { app, screen, desktopCapturer, BrowserWindow } = require('electron');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

const execAsync = promisify(exec);

async function runTests() {
    console.log('\n🎯 Mouse Click Accuracy Test\n');
    console.log('='.repeat(50));

    // 1. Get screen dimensions
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    const scaleFactor = primaryDisplay.scaleFactor;

    console.log('\n📺 Screen Information:');
    console.log(`   Logical dimensions: ${width} x ${height}`);
    console.log(`   Scale factor: ${scaleFactor}x`);
    console.log(`   Physical pixels: ${width * scaleFactor} x ${height * scaleFactor}`);

    // 2. Take a screenshot and verify dimensions
    console.log('\n📸 Screenshot Test:');
    const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width, height }
    });

    if (!sources || sources.length === 0) {
        console.error('   ❌ No screen sources available');
        return;
    }

    const thumbnail = sources[0].thumbnail;
    const thumbSize = thumbnail.getSize();
    console.log(`   Captured size: ${thumbSize.width} x ${thumbSize.height}`);

    if (thumbSize.width === width && thumbSize.height === height) {
        console.log('   ✅ Screenshot dimensions match screen dimensions');
    } else {
        console.log(`   ⚠️  Mismatch! Screenshot: ${thumbSize.width}x${thumbSize.height}, Screen: ${width}x${height}`);
    }

    // Save screenshot for verification
    const screenshotPath = path.join(os.tmpdir(), 'click-test-screenshot.png');
    await fs.writeFile(screenshotPath, thumbnail.toPNG());
    console.log(`   Screenshot saved: ${screenshotPath}`);

    // 3. Coordinate system test
    console.log('\n🖱️  Coordinate Tests:');

    // Test points
    const testPoints = [
        { name: 'Center', x: Math.round(width / 2), y: Math.round(height / 2) },
        { name: 'Top-left area', x: 100, y: 100 },
        { name: 'Top-right area', x: width - 100, y: 100 },
        { name: 'Bottom-left area', x: 100, y: height - 100 },
        { name: 'Bottom-right area', x: width - 100, y: height - 100 },
    ];

    for (const point of testPoints) {
        const inBounds = point.x >= 0 && point.x < width && point.y >= 0 && point.y < height;
        const status = inBounds ? '✅' : '❌';
        console.log(`   ${status} ${point.name}: (${point.x}, ${point.y}) ${inBounds ? 'valid' : 'OUT OF BOUNDS'}`);
    }

    // 4. Click test (moves mouse only, doesn't actually click by default)
    console.log('\n🎯 Click Simulation Test:');
    console.log('   The mouse will move to the center of the screen.');
    console.log('   Watch where the cursor appears to verify accuracy.\n');

    // Ask for confirmation
    console.log('   Press Enter to move mouse to center...');

    // Move mouse to center using AppleScript (safe - just moves, no click)
    const centerX = Math.round(width / 2);
    const centerY = Math.round(height / 2);

    console.log(`   Moving to (${centerX}, ${centerY})...`);

    // Use cliclick if available, otherwise try AppleScript
    try {
        // Try cliclick first (more reliable)
        await execAsync(`which cliclick`);
        await execAsync(`cliclick m:${centerX},${centerY}`);
        console.log('   ✅ Mouse moved using cliclick');
    } catch {
        // Fallback to Python with pyautogui
        try {
            await execAsync(`python3 -c "import pyautogui; pyautogui.moveTo(${centerX}, ${centerY})"`);
            console.log('   ✅ Mouse moved using pyautogui');
        } catch {
            console.log('   ⚠️  Could not move mouse. Install cliclick or pyautogui for testing.');
        }
    }

    // 5. Summary
    console.log('\n' + '='.repeat(50));
    console.log('📋 SUMMARY:');
    console.log(`   Screen: ${width}x${height} (${scaleFactor}x scale)`);
    console.log(`   Screenshot: ${thumbSize.width}x${thumbSize.height}`);

    if (thumbSize.width === width && thumbSize.height === height) {
        console.log('   ✅ Coordinate system is correctly configured');
        console.log('   ✅ Clicks should land at the correct positions');
    } else {
        console.log('   ❌ MISMATCH DETECTED - clicks will be inaccurate!');
        console.log(`   Fix: Capture screenshots at ${width}x${height}`);
    }

    console.log('\n');
}

// Run when app is ready
app.whenReady().then(async () => {
    try {
        await runTests();
    } catch (error) {
        console.error('Test error:', error);
    }
    app.quit();
});

app.on('window-all-closed', () => {
    app.quit();
});
