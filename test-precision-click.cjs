/**
 * Precision Click Test
 *
 * Tests click accuracy with small, closely-spaced buttons
 * and visualizes EXACTLY where each click lands.
 *
 * Run with: npx electron test-precision-click.cjs
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
        width: 800,
        height: 600,
        x: Math.round((width - 800) / 2),
        y: Math.round((height - 600) / 2),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        title: 'Precision Click Test'
    });

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: -apple-system, sans-serif;
                background: #0f0f23;
                color: white;
                min-height: 100vh;
                padding: 20px;
            }
            h1 { text-align: center; margin-bottom: 10px; font-size: 20px; }
            .subtitle { text-align: center; opacity: 0.6; margin-bottom: 30px; font-size: 12px; }

            /* Dangerous button pair - Save and Delete right next to each other */
            .danger-zone {
                display: flex;
                justify-content: center;
                gap: 2px; /* Only 2px gap! */
                margin-bottom: 30px;
            }
            .btn {
                padding: 12px 24px;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                position: relative;
            }
            .btn-save { background: #22c55e; color: white; }
            .btn-delete { background: #ef4444; color: white; }
            .btn.clicked::after {
                content: '✓';
                position: absolute;
                top: -8px;
                right: -8px;
                background: gold;
                color: black;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
            }

            /* Small target grid */
            .target-grid {
                display: grid;
                grid-template-columns: repeat(5, 40px);
                gap: 4px;
                justify-content: center;
                margin-bottom: 30px;
            }
            .small-target {
                width: 40px;
                height: 40px;
                background: #1e3a5f;
                border: 2px solid #3b82f6;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                cursor: pointer;
            }
            .small-target.hit { background: #22c55e; border-color: #22c55e; }
            .small-target.miss { background: #ef4444; border-color: #ef4444; }

            /* Click marker overlay */
            .click-marker {
                position: fixed;
                width: 10px;
                height: 10px;
                background: rgba(255, 215, 0, 0.9);
                border: 2px solid #000;
                border-radius: 50%;
                pointer-events: none;
                transform: translate(-50%, -50%);
                z-index: 9999;
                animation: pulse 0.5s ease-out;
            }
            @keyframes pulse {
                0% { transform: translate(-50%, -50%) scale(2); opacity: 0.5; }
                100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            }

            /* Results log */
            .log {
                background: #1a1a2e;
                border-radius: 8px;
                padding: 15px;
                font-family: monospace;
                font-size: 11px;
                max-height: 200px;
                overflow-y: auto;
            }
            .log-entry { margin: 4px 0; }
            .log-entry.success { color: #22c55e; }
            .log-entry.error { color: #ef4444; }
            .log-entry.info { color: #3b82f6; }

            .stats {
                display: flex;
                justify-content: center;
                gap: 40px;
                margin: 20px 0;
                font-size: 24px;
            }
            .stat-label { font-size: 12px; opacity: 0.6; }
        </style>
    </head>
    <body>
        <h1>🎯 Precision Click Test</h1>
        <div class="subtitle">Testing with small buttons and 2px gaps</div>

        <div class="danger-zone">
            <button class="btn btn-save" id="save" data-name="Save">💾 Save</button>
            <button class="btn btn-delete" id="delete" data-name="Delete">🗑️ Delete</button>
        </div>

        <div class="target-grid" id="grid"></div>

        <div class="stats">
            <div><span id="hits">0</span><div class="stat-label">Hits</div></div>
            <div><span id="misses">0</span><div class="stat-label">Misses</div></div>
            <div><span id="accuracy">-</span><div class="stat-label">Accuracy</div></div>
        </div>

        <div class="log" id="log"></div>

        <script>
            const { ipcRenderer } = require('electron');

            let hits = 0;
            let misses = 0;
            let clickLog = [];

            // Create 5x3 grid of small targets
            const grid = document.getElementById('grid');
            for (let i = 1; i <= 15; i++) {
                const target = document.createElement('div');
                target.className = 'small-target';
                target.id = 'target-' + i;
                target.textContent = i;
                target.onclick = () => targetHit(i);
                grid.appendChild(target);
            }

            // Track all clicks on document
            document.addEventListener('click', (e) => {
                // Show click marker
                const marker = document.createElement('div');
                marker.className = 'click-marker';
                marker.style.left = e.clientX + 'px';
                marker.style.top = e.clientY + 'px';
                document.body.appendChild(marker);
                setTimeout(() => marker.remove(), 2000);

                // Log click position
                log(\`Click at (\${e.clientX}, \${e.clientY})\`, 'info');
            });

            function targetHit(id) {
                const el = document.getElementById('target-' + id);
                el.classList.add('hit');
                hits++;
                updateStats();
            }

            document.getElementById('save').onclick = () => {
                document.getElementById('save').classList.add('clicked');
                log('✅ SAVE button clicked!', 'success');
                hits++;
                updateStats();
                ipcRenderer.send('button-clicked', 'save');
            };

            document.getElementById('delete').onclick = () => {
                document.getElementById('delete').classList.add('clicked');
                log('⚠️ DELETE button clicked!', 'error');
                ipcRenderer.send('button-clicked', 'delete');
            };

            function updateStats() {
                document.getElementById('hits').textContent = hits;
                document.getElementById('misses').textContent = misses;
                const total = hits + misses;
                if (total > 0) {
                    document.getElementById('accuracy').textContent =
                        Math.round(hits / total * 100) + '%';
                }
            }

            function log(msg, type = 'info') {
                const logEl = document.getElementById('log');
                const entry = document.createElement('div');
                entry.className = 'log-entry ' + type;
                entry.textContent = new Date().toLocaleTimeString() + ' - ' + msg;
                logEl.insertBefore(entry, logEl.firstChild);
            }

            // Report button positions to main process
            setTimeout(() => {
                const save = document.getElementById('save').getBoundingClientRect();
                const del = document.getElementById('delete').getBoundingClientRect();

                // Get all target positions
                const targets = [];
                for (let i = 1; i <= 15; i++) {
                    const t = document.getElementById('target-' + i).getBoundingClientRect();
                    targets.push({
                        id: i,
                        x: Math.round(t.left + t.width / 2),
                        y: Math.round(t.top + t.height / 2),
                        width: t.width,
                        height: t.height
                    });
                }

                ipcRenderer.send('positions', {
                    save: {
                        x: Math.round(save.left + save.width / 2),
                        y: Math.round(save.top + save.height / 2),
                        width: save.width,
                        height: save.height,
                        left: save.left,
                        right: save.right
                    },
                    delete: {
                        x: Math.round(del.left + del.width / 2),
                        y: Math.round(del.top + del.height / 2),
                        width: del.width,
                        height: del.height,
                        left: del.left,
                        right: del.right
                    },
                    gap: del.left - save.right,
                    targets: targets
                });

                log('Buttons: Save(' + Math.round(save.left + save.width/2) + '), Delete(' + Math.round(del.left + del.width/2) + '), Gap: ' + Math.round(del.left - save.right) + 'px', 'info');
            }, 500);
        </script>
    </body>
    </html>
    `;

    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return mainWindow;
}

async function runPrecisionTests() {
    console.log('\n🎯 PRECISION CLICK TEST');
    console.log('='.repeat(60));

    const primaryDisplay = screen.getPrimaryDisplay();
    console.log(`Screen: ${primaryDisplay.size.width}x${primaryDisplay.size.height}`);

    createTestWindow();

    // Wait for positions from renderer
    ipcMain.once('positions', async (event, positions) => {
        const [winX, winY] = mainWindow.getPosition();

        console.log('\n📐 BUTTON POSITIONS:');
        console.log(`   Window: (${winX}, ${winY})`);
        console.log(`   Save button center (in window): (${positions.save.x}, ${positions.save.y})`);
        console.log(`   Delete button center (in window): (${positions.delete.x}, ${positions.delete.y})`);
        console.log(`   Gap between buttons: ${positions.gap}px`);
        console.log(`   Button width: ${positions.save.width}px`);

        // Convert to screen coordinates
        const saveScreen = { x: winX + positions.save.x, y: winY + positions.save.y };
        const deleteScreen = { x: winX + positions.delete.x, y: winY + positions.delete.y };

        console.log(`\n   Save on screen: (${saveScreen.x}, ${saveScreen.y})`);
        console.log(`   Delete on screen: (${deleteScreen.x}, ${deleteScreen.y})`);
        console.log(`   Distance between centers: ${deleteScreen.x - saveScreen.x}px`);

        // Track what was clicked
        let saveClicked = false;
        let deleteClicked = false;

        ipcMain.on('button-clicked', (e, which) => {
            if (which === 'save') saveClicked = true;
            if (which === 'delete') deleteClicked = true;
        });

        // TEST 1: Click exactly on Save button
        console.log('\n\n🧪 TEST 1: Click Save button center');
        console.log(`   Clicking at (${saveScreen.x}, ${saveScreen.y})...`);
        await new Promise(r => setTimeout(r, 500));
        await clickAt(saveScreen.x, saveScreen.y);
        await new Promise(r => setTimeout(r, 300));

        if (saveClicked) {
            console.log('   ✅ CORRECT: Save was clicked');
        } else if (deleteClicked) {
            console.log('   ❌ WRONG: Delete was clicked instead!');
        } else {
            console.log('   ⚠️  Neither button registered the click');
        }

        // Reset
        saveClicked = false;
        deleteClicked = false;

        // TEST 2: Click exactly on Delete button
        console.log('\n🧪 TEST 2: Click Delete button center');
        console.log(`   Clicking at (${deleteScreen.x}, ${deleteScreen.y})...`);
        await new Promise(r => setTimeout(r, 500));
        await clickAt(deleteScreen.x, deleteScreen.y);
        await new Promise(r => setTimeout(r, 300));

        if (deleteClicked) {
            console.log('   ✅ CORRECT: Delete was clicked');
        } else if (saveClicked) {
            console.log('   ❌ WRONG: Save was clicked instead!');
        } else {
            console.log('   ⚠️  Neither button registered the click');
        }

        // TEST 3: Click right edge of Save (closest to Delete)
        console.log('\n🧪 TEST 3: Click Save button edge (closest to Delete)');
        const saveEdge = {
            x: winX + Math.round(positions.save.left + positions.save.width - 5),
            y: saveScreen.y
        };
        console.log(`   Clicking at (${saveEdge.x}, ${saveEdge.y}) [5px from right edge]...`);

        saveClicked = false;
        deleteClicked = false;
        await new Promise(r => setTimeout(r, 500));
        await clickAt(saveEdge.x, saveEdge.y);
        await new Promise(r => setTimeout(r, 300));

        if (saveClicked) {
            console.log('   ✅ CORRECT: Save edge click registered on Save');
        } else if (deleteClicked) {
            console.log('   ❌ CRITICAL: Edge click hit Delete instead!');
        } else {
            console.log('   ⚠️  Click missed both buttons');
        }

        // TEST 4: Click some small targets
        console.log('\n🧪 TEST 4: Click small targets (40x40px)');
        const targetsToTest = [1, 8, 15]; // corners and center

        for (const id of targetsToTest) {
            const target = positions.targets.find(t => t.id === id);
            const screenPos = { x: winX + target.x, y: winY + target.y };
            console.log(`   Clicking target ${id} at (${screenPos.x}, ${screenPos.y})...`);
            await new Promise(r => setTimeout(r, 400));
            await clickAt(screenPos.x, screenPos.y);
        }

        console.log('\n' + '='.repeat(60));
        console.log('📋 TEST COMPLETE');
        console.log('   Check the window to see where clicks landed (gold markers)');
        console.log('   Green = hit, Red = miss');
        console.log('='.repeat(60) + '\n');

        // Keep window open to inspect results
        await new Promise(r => setTimeout(r, 5000));
        app.quit();
    });
}

app.whenReady().then(runPrecisionTests);
app.on('window-all-closed', () => app.quit());
