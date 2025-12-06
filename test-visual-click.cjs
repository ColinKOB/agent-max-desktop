/**
 * Visual Click Accuracy Test
 *
 * Creates a window with targets and tests clicking on them.
 * Run with: npx electron test-visual-click.cjs
 */

const { app, screen, BrowserWindow, ipcMain } = require('electron');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);

let mainWindow;
let testResults = [];

// Click using cliclick (more reliable than AppleScript)
async function clickAt(x, y) {
    // cliclick syntax: c: = click
    await execAsync(`cliclick c:${x},${y}`);
}

// Create test window with target zones
function createTestWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;

    // Create window at center of screen
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        x: Math.round((width - 800) / 2),
        y: Math.round((height - 600) / 2),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        title: 'Click Accuracy Test'
    });

    // Get window position for calculating click coordinates
    const [winX, winY] = mainWindow.getPosition();
    const [winW, winH] = mainWindow.getSize();

    console.log(`\n📍 Window position: (${winX}, ${winY}), size: ${winW}x${winH}`);

    // HTML with clickable targets
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {
                margin: 0;
                padding: 20px;
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                background: #1a1a2e;
                color: white;
            }
            h1 { text-align: center; margin-bottom: 30px; }
            .grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 20px;
                max-width: 700px;
                margin: 0 auto;
            }
            .target {
                background: #16213e;
                border: 3px solid #0f3460;
                border-radius: 10px;
                height: 150px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.2s;
            }
            .target:hover { border-color: #4ecca3; }
            .target.clicked { background: #4ecca3; border-color: #4ecca3; color: #1a1a2e; }
            .target .number { font-size: 48px; font-weight: bold; }
            .target .coords { font-size: 12px; opacity: 0.7; margin-top: 5px; }
            .status { text-align: center; margin-top: 20px; font-size: 18px; }
            .success { color: #4ecca3; }
            .waiting { color: #f9b208; }
        </style>
    </head>
    <body>
        <h1>🎯 Click Accuracy Test</h1>
        <div class="grid">
            <div class="target" data-id="1" onclick="targetClicked(1)">
                <span class="number">1</span>
                <span class="coords"></span>
            </div>
            <div class="target" data-id="2" onclick="targetClicked(2)">
                <span class="number">2</span>
                <span class="coords"></span>
            </div>
            <div class="target" data-id="3" onclick="targetClicked(3)">
                <span class="number">3</span>
                <span class="coords"></span>
            </div>
            <div class="target" data-id="4" onclick="targetClicked(4)">
                <span class="number">4</span>
                <span class="coords"></span>
            </div>
            <div class="target" data-id="5" onclick="targetClicked(5)">
                <span class="number">5</span>
                <span class="coords"></span>
            </div>
            <div class="target" data-id="6" onclick="targetClicked(6)">
                <span class="number">6</span>
                <span class="coords"></span>
            </div>
        </div>
        <div class="status waiting" id="status">Preparing test...</div>
        <script>
            const { ipcRenderer } = require('electron');
            let clickedTargets = new Set();

            function targetClicked(id) {
                clickedTargets.add(id);
                document.querySelector('[data-id="' + id + '"]').classList.add('clicked');
                ipcRenderer.send('target-clicked', id);
                updateStatus();
            }

            function updateStatus() {
                const status = document.getElementById('status');
                if (clickedTargets.size === 6) {
                    status.textContent = '✅ All targets hit! Test passed!';
                    status.className = 'status success';
                } else {
                    status.textContent = 'Targets hit: ' + clickedTargets.size + '/6';
                }
            }

            // Display target coordinates
            setTimeout(() => {
                document.querySelectorAll('.target').forEach(t => {
                    const rect = t.getBoundingClientRect();
                    const centerX = Math.round(rect.left + rect.width / 2);
                    const centerY = Math.round(rect.top + rect.height / 2);
                    t.querySelector('.coords').textContent = '(' + centerX + ', ' + centerY + ')';
                });
            }, 100);
        </script>
    </body>
    </html>
    `;

    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    return { winX, winY, winW, winH };
}

async function runClickTests(winX, winY, winW, winH) {
    // Wait for window to render
    await new Promise(r => setTimeout(r, 1000));

    console.log('\n🎯 Starting click tests...\n');

    // Calculate target centers (3x2 grid, 20px padding, 20px gap)
    // Each target is roughly 220x150 pixels
    const padding = 20;
    const gap = 20;
    const targetW = (winW - 2 * padding - 2 * gap) / 3;
    const targetH = 150;
    const headerOffset = 100; // Account for title and h1

    const targets = [];
    for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
            const centerX = winX + padding + col * (targetW + gap) + targetW / 2;
            const centerY = winY + headerOffset + row * (targetH + gap) + targetH / 2;
            targets.push({
                id: row * 3 + col + 1,
                x: Math.round(centerX),
                y: Math.round(centerY)
            });
        }
    }

    // Track hits
    let hits = 0;
    ipcMain.on('target-clicked', (event, id) => {
        hits++;
        console.log(`   ✅ Target ${id} hit! (${hits}/6)`);
    });

    // Click each target with a delay
    for (const target of targets) {
        console.log(`   Clicking target ${target.id} at (${target.x}, ${target.y})...`);
        await clickAt(target.x, target.y);
        await new Promise(r => setTimeout(r, 500));
    }

    // Wait for all clicks to register
    await new Promise(r => setTimeout(r, 500));

    console.log('\n' + '='.repeat(50));
    if (hits === 6) {
        console.log('🎉 SUCCESS: All 6 targets hit correctly!');
        console.log('   Click accuracy is verified.');
    } else {
        console.log(`⚠️  Only ${hits}/6 targets hit.`);
        console.log('   Check if window position matches expected coordinates.');
    }
    console.log('='.repeat(50) + '\n');

    // Keep window open for 3 seconds to see results
    await new Promise(r => setTimeout(r, 3000));

    app.quit();
}

app.whenReady().then(async () => {
    console.log('\n🎯 Visual Click Accuracy Test');
    console.log('='.repeat(50));

    const primaryDisplay = screen.getPrimaryDisplay();
    console.log(`Screen: ${primaryDisplay.size.width}x${primaryDisplay.size.height}`);

    const { winX, winY, winW, winH } = createTestWindow();

    // Start tests after window is shown
    mainWindow.on('ready-to-show', () => {
        runClickTests(winX, winY, winW, winH);
    });

    mainWindow.show();
});

app.on('window-all-closed', () => {
    app.quit();
});
