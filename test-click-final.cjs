/**
 * Final Click Accuracy Test
 *
 * Uses actual DOM element positions for precise testing.
 * Run with: npx electron test-click-final.cjs
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
        width: 600,
        height: 400,
        x: Math.round((width - 600) / 2),
        y: Math.round((height - 400) / 2),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        title: 'Click Test'
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
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }
            h1 { margin-bottom: 20px; font-size: 24px; }
            .target {
                width: 200px;
                height: 200px;
                background: #16213e;
                border: 4px solid #e94560;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 48px;
                cursor: pointer;
                transition: all 0.3s;
            }
            .target.clicked {
                background: #4ecca3;
                border-color: #4ecca3;
            }
            .info {
                margin-top: 20px;
                font-size: 14px;
                opacity: 0.7;
            }
        </style>
    </head>
    <body>
        <h1>🎯 Click the Target</h1>
        <div class="target" id="target" onclick="targetClicked()">●</div>
        <div class="info" id="info">Waiting for test...</div>
        <script>
            const { ipcRenderer } = require('electron');

            function targetClicked() {
                document.getElementById('target').classList.add('clicked');
                document.getElementById('info').textContent = '✅ TARGET HIT!';
                ipcRenderer.send('target-hit');
            }

            // Send target position to main process
            setTimeout(() => {
                const target = document.getElementById('target');
                const rect = target.getBoundingClientRect();
                const centerX = Math.round(rect.left + rect.width / 2);
                const centerY = Math.round(rect.top + rect.height / 2);
                ipcRenderer.send('target-position', { x: centerX, y: centerY });
            }, 500);
        </script>
    </body>
    </html>
    `;

    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return mainWindow;
}

app.whenReady().then(async () => {
    console.log('\n🎯 Click Accuracy Test (Final)\n');
    console.log('='.repeat(50));

    const primaryDisplay = screen.getPrimaryDisplay();
    console.log(`Screen: ${primaryDisplay.size.width}x${primaryDisplay.size.height}`);

    createTestWindow();

    // Wait for DOM to send target position
    ipcMain.once('target-position', async (event, localPos) => {
        const [winX, winY] = mainWindow.getPosition();

        // Convert local window coordinates to screen coordinates
        const screenX = winX + localPos.x;
        const screenY = winY + localPos.y;

        console.log(`\nWindow position: (${winX}, ${winY})`);
        console.log(`Target in window: (${localPos.x}, ${localPos.y})`);
        console.log(`Target on screen: (${screenX}, ${screenY})`);

        // Wait a moment then click
        await new Promise(r => setTimeout(r, 500));
        console.log(`\nClicking at (${screenX}, ${screenY})...`);

        let hit = false;
        ipcMain.once('target-hit', () => {
            hit = true;
        });

        await clickAt(screenX, screenY);
        await new Promise(r => setTimeout(r, 500));

        console.log('\n' + '='.repeat(50));
        if (hit) {
            console.log('🎉 SUCCESS: Target hit correctly!');
            console.log('   Click coordinates are accurate.');
        } else {
            console.log('❌ MISS: Target was not hit.');
            console.log('   There may be a coordinate offset issue.');
        }
        console.log('='.repeat(50) + '\n');

        // Keep window visible for 2 seconds
        await new Promise(r => setTimeout(r, 2000));
        app.quit();
    });
});

app.on('window-all-closed', () => app.quit());
