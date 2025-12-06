/**
 * Click Offset Debug Test
 *
 * Diagnoses the exact offset between window content and screen coordinates.
 * Shows where clicks land vs where they were intended.
 *
 * Run with: npx electron test-offset-debug.cjs
 */

const { app, screen, BrowserWindow, ipcMain } = require('electron');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

let mainWindow;

async function clickAt(x, y) {
    await execAsync(`cliclick c:${x},${y}`);
}

function createTestWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;

    mainWindow = new BrowserWindow({
        width: 500,
        height: 400,
        x: 100,
        y: 100,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        title: 'Click Offset Debug',
        // Try with and without frame to see difference
        // frame: false
    });

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: -apple-system, sans-serif;
                background: #1a1a2e;
                color: white;
                height: 100vh;
            }
            .crosshair {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
            }
            .h-line, .v-line {
                position: absolute;
                background: rgba(255, 0, 0, 0.3);
            }
            .h-line { left: 0; right: 0; height: 1px; }
            .v-line { top: 0; bottom: 0; width: 1px; }

            .target {
                position: absolute;
                width: 100px;
                height: 100px;
                background: #3b82f6;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 24px;
            }
            .target.hit { background: #22c55e; }

            .click-marker {
                position: fixed;
                width: 20px;
                height: 20px;
                border: 3px solid red;
                border-radius: 50%;
                pointer-events: none;
                transform: translate(-50%, -50%);
                z-index: 9999;
            }
            .click-marker::before, .click-marker::after {
                content: '';
                position: absolute;
                background: red;
            }
            .click-marker::before {
                left: 50%;
                top: -10px;
                bottom: -10px;
                width: 1px;
                transform: translateX(-50%);
            }
            .click-marker::after {
                top: 50%;
                left: -10px;
                right: -10px;
                height: 1px;
                transform: translateY(-50%);
            }

            .info {
                position: fixed;
                bottom: 10px;
                left: 10px;
                right: 10px;
                background: rgba(0,0,0,0.8);
                padding: 10px;
                font-family: monospace;
                font-size: 11px;
                border-radius: 5px;
            }
            .info div { margin: 3px 0; }
        </style>
    </head>
    <body>
        <div class="crosshair">
            <div class="h-line" style="top: 50%"></div>
            <div class="v-line" style="left: 50%"></div>
            <div class="h-line" style="top: 200px"></div>
            <div class="v-line" style="left: 250px"></div>
        </div>

        <div class="target" id="target" style="left: 200px; top: 150px;">🎯</div>

        <div class="info" id="info">
            <div id="window-info">Window info loading...</div>
            <div id="target-info">Target info loading...</div>
            <div id="click-info">Click: waiting...</div>
            <div id="offset-info">Offset: calculating...</div>
        </div>

        <script>
            const { ipcRenderer } = require('electron');

            const target = document.getElementById('target');
            let expectedClick = null;
            let actualClick = null;

            target.onclick = (e) => {
                target.classList.add('hit');
                document.getElementById('click-info').textContent = 'CLICK: Target was HIT!';
                document.getElementById('click-info').style.color = '#22c55e';
                ipcRenderer.send('target-hit');
            };

            document.addEventListener('click', (e) => {
                actualClick = { x: e.clientX, y: e.clientY };

                // Show click marker
                const marker = document.createElement('div');
                marker.className = 'click-marker';
                marker.style.left = e.clientX + 'px';
                marker.style.top = e.clientY + 'px';
                document.body.appendChild(marker);

                document.getElementById('click-info').textContent =
                    'CLICK: Landed at (' + e.clientX + ', ' + e.clientY + ') in window';

                if (expectedClick) {
                    const offsetX = actualClick.x - expectedClick.x;
                    const offsetY = actualClick.y - expectedClick.y;
                    document.getElementById('offset-info').textContent =
                        'OFFSET: ' + offsetX + 'px horizontal, ' + offsetY + 'px vertical';

                    if (Math.abs(offsetX) > 5 || Math.abs(offsetY) > 5) {
                        document.getElementById('offset-info').style.color = '#ef4444';
                    } else {
                        document.getElementById('offset-info').style.color = '#22c55e';
                    }
                }

                ipcRenderer.send('click-landed', actualClick);
            });

            // Report positions
            setTimeout(() => {
                const rect = target.getBoundingClientRect();
                const centerX = Math.round(rect.left + rect.width / 2);
                const centerY = Math.round(rect.top + rect.height / 2);

                document.getElementById('target-info').textContent =
                    'TARGET: Center at (' + centerX + ', ' + centerY + ') in window, size ' + rect.width + 'x' + rect.height;

                ipcRenderer.send('target-position', { x: centerX, y: centerY });
            }, 300);

            ipcRenderer.on('expected-click', (e, pos) => {
                expectedClick = pos;
            });

            // Get window content offset (important for title bar)
            ipcRenderer.on('get-content-bounds', () => {
                // The body starts at 0,0 in content coordinates
                // But we need to know if there's any browser chrome offset
                ipcRenderer.send('content-bounds', {
                    bodyTop: document.body.getBoundingClientRect().top,
                    bodyLeft: document.body.getBoundingClientRect().left,
                    innerWidth: window.innerWidth,
                    innerHeight: window.innerHeight
                });
            });
        </script>
    </body>
    </html>
    `;

    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return mainWindow;
}

async function runDebugTest() {
    console.log('\n🔍 CLICK OFFSET DEBUG TEST');
    console.log('='.repeat(60));

    const primaryDisplay = screen.getPrimaryDisplay();
    console.log(`Screen: ${primaryDisplay.size.width}x${primaryDisplay.size.height}`);

    createTestWindow();

    await new Promise(r => setTimeout(r, 500));

    // Get window position and bounds
    const [winX, winY] = mainWindow.getPosition();
    const [winW, winH] = mainWindow.getSize();
    const contentBounds = mainWindow.getContentBounds();

    console.log('\n📐 WINDOW ANALYSIS:');
    console.log(`   Window position (outer): (${winX}, ${winY})`);
    console.log(`   Window size (outer): ${winW}x${winH}`);
    console.log(`   Content bounds: x=${contentBounds.x}, y=${contentBounds.y}, w=${contentBounds.width}, h=${contentBounds.height}`);

    // The KEY insight: content doesn't start at window position!
    // There's a title bar offset
    const titleBarHeight = contentBounds.y - winY;
    const borderLeft = contentBounds.x - winX;

    console.log(`\n   ⚠️  TITLE BAR HEIGHT: ${titleBarHeight}px`);
    console.log(`   ⚠️  BORDER LEFT: ${borderLeft}px`);

    // Wait for target position from renderer
    ipcMain.once('target-position', async (event, localPos) => {
        console.log(`\n   Target in window content: (${localPos.x}, ${localPos.y})`);

        // CORRECT calculation: use content bounds, not window bounds!
        const correctScreenX = contentBounds.x + localPos.x;
        const correctScreenY = contentBounds.y + localPos.y;

        // WRONG calculation (what we were doing before)
        const wrongScreenX = winX + localPos.x;
        const wrongScreenY = winY + localPos.y;

        console.log(`\n   ❌ WRONG screen coords (winX + localX): (${wrongScreenX}, ${wrongScreenY})`);
        console.log(`   ✅ CORRECT screen coords (contentX + localX): (${correctScreenX}, ${correctScreenY})`);
        console.log(`   Difference: (${correctScreenX - wrongScreenX}, ${correctScreenY - wrongScreenY})`);

        // Tell renderer what we expect
        mainWindow.webContents.send('expected-click', localPos);

        // Click at CORRECT position
        console.log('\n🧪 TEST: Clicking at CORRECT coordinates...');
        await new Promise(r => setTimeout(r, 500));

        let hit = false;
        ipcMain.once('target-hit', () => { hit = true; });

        await clickAt(correctScreenX, correctScreenY);
        await new Promise(r => setTimeout(r, 500));

        console.log('\n' + '='.repeat(60));
        if (hit) {
            console.log('🎉 SUCCESS! Clicking at content bounds + local position works!');
        } else {
            console.log('❌ Still missed. Check the window for click marker position.');
        }

        // Show where click landed
        ipcMain.once('click-landed', (e, pos) => {
            console.log(`   Click landed at (${pos.x}, ${pos.y}) in window content`);
            console.log(`   Target was at (${localPos.x}, ${localPos.y})`);
            console.log(`   Offset: (${pos.x - localPos.x}, ${pos.y - localPos.y})`);
        });

        console.log('\n   THE FIX: Use getContentBounds() instead of getPosition()');
        console.log('='.repeat(60) + '\n');

        await new Promise(r => setTimeout(r, 3000));
        app.quit();
    });
}

app.whenReady().then(runDebugTest);
app.on('window-all-closed', () => app.quit());
