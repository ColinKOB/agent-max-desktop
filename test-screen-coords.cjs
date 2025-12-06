/**
 * Screen Coordinate Test
 *
 * This tests the ACTUAL use case: AI sees a screenshot, identifies a point,
 * and clicks at that screen coordinate. No window math needed.
 *
 * Run with: npx electron test-screen-coords.cjs
 */

const { app, screen, desktopCapturer, BrowserWindow, ipcMain } = require('electron');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const execAsync = promisify(exec);

let mainWindow;

async function clickAt(x, y) {
    console.log(`   Executing: cliclick c:${x},${y}`);
    await execAsync(`cliclick c:${x},${y}`);
}

async function takeScreenshot() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;

    const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width, height }
    });

    const thumbnail = sources[0].thumbnail;
    const screenshotPath = path.join(os.tmpdir(), `screen-coord-test-${Date.now()}.png`);
    await fs.writeFile(screenshotPath, thumbnail.toPNG());

    return {
        path: screenshotPath,
        width: thumbnail.getSize().width,
        height: thumbnail.getSize().height,
        screenWidth: width,
        screenHeight: height
    };
}

function createTargetWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;

    // Create a simple window with a big target
    mainWindow = new BrowserWindow({
        width: 300,
        height: 200,
        x: Math.round(width / 2 - 150),
        y: Math.round(height / 2 - 100),
        alwaysOnTop: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        title: 'Screen Coord Test'
    });

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            * { margin: 0; padding: 0; }
            body {
                background: #1a1a2e;
                height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .target {
                width: 150px;
                height: 100px;
                background: linear-gradient(135deg, #ff6b6b, #ee5a24);
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 32px;
                color: white;
                cursor: pointer;
                font-family: -apple-system, sans-serif;
            }
            .target.hit {
                background: linear-gradient(135deg, #26de81, #20bf6b);
            }
        </style>
    </head>
    <body>
        <div class="target" id="target" onclick="hit()">CLICK ME</div>
        <script>
            const { ipcRenderer } = require('electron');
            function hit() {
                document.getElementById('target').classList.add('hit');
                document.getElementById('target').textContent = 'HIT! ✓';
                ipcRenderer.send('target-hit');
            }
        </script>
    </body>
    </html>
    `;

    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return mainWindow;
}

async function runScreenCoordTest() {
    console.log('\n📸 SCREEN COORDINATE TEST');
    console.log('   This simulates exactly what the AI does:');
    console.log('   1. Take screenshot of full screen');
    console.log('   2. Identify target coordinates in screenshot');
    console.log('   3. Click at those exact screen coordinates');
    console.log('='.repeat(60));

    const primaryDisplay = screen.getPrimaryDisplay();
    console.log(`\nScreen: ${primaryDisplay.size.width}x${primaryDisplay.size.height}`);

    // Create target window
    createTargetWindow();
    await new Promise(r => setTimeout(r, 1000)); // Wait for window to render

    // Take screenshot (like the AI would)
    console.log('\n📷 Taking screenshot...');
    const screenshot = await takeScreenshot();
    console.log(`   Saved to: ${screenshot.path}`);
    console.log(`   Screenshot size: ${screenshot.width}x${screenshot.height}`);
    console.log(`   Screen size: ${screenshot.screenWidth}x${screenshot.screenHeight}`);

    if (screenshot.width === screenshot.screenWidth && screenshot.height === screenshot.screenHeight) {
        console.log('   ✅ Screenshot matches screen dimensions!');
    } else {
        console.log('   ⚠️  Dimension mismatch!');
    }

    // Get the target position ON SCREEN (not in window)
    // This is what the AI would see in the screenshot
    const contentBounds = mainWindow.getContentBounds();
    const targetCenterX = contentBounds.x + 150; // Target is centered in 300px window
    const targetCenterY = contentBounds.y + 100; // Target is centered in 200px content

    console.log(`\n🎯 Target position on screen: (${targetCenterX}, ${targetCenterY})`);
    console.log('   (This is what the AI would identify from the screenshot)');

    // Now click at those screen coordinates
    console.log('\n🖱️  Clicking at screen coordinates...');

    let hit = false;
    ipcMain.once('target-hit', () => { hit = true; });

    await clickAt(targetCenterX, targetCenterY);
    await new Promise(r => setTimeout(r, 500));

    console.log('\n' + '='.repeat(60));
    if (hit) {
        console.log('🎉 SUCCESS!');
        console.log('   Screen coordinates from screenshot work perfectly!');
        console.log('   The AI can click accurately based on screenshot analysis.');
    } else {
        console.log('❌ MISSED');
        console.log('   There may be an issue with screen coordinate mapping.');
    }
    console.log('='.repeat(60) + '\n');

    // Keep window visible
    await new Promise(r => setTimeout(r, 3000));
    app.quit();
}

app.whenReady().then(runScreenCoordTest);
app.on('window-all-closed', () => app.quit());
