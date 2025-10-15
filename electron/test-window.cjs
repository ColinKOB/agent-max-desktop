const { app, BrowserWindow } = require('electron');

// Test window to verify Electron + backdrop-filter works
function createTestWindow() {
  const testWin = new BrowserWindow({
    width: 400,
    height: 400,
    x: 100,
    y: 100,
    frame: false,
    transparent: true,
    vibrancy: 'popover',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load inline HTML with glass effect
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      background: transparent;
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, system-ui;
    }
    
    .glass {
      width: 300px;
      height: 300px;
      background: rgba(255, 255, 255, 0.01);
      backdrop-filter: saturate(200%) blur(50px);
      -webkit-backdrop-filter: saturate(200%) blur(50px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 30px;
      color: white;
      text-shadow: 0 2px 4px rgba(0,0,0,0.5);
    }
    
    h1 {
      font-size: 24px;
      margin-bottom: 20px;
      font-weight: 700;
    }
    
    p {
      font-size: 14px;
      line-height: 1.6;
      text-align: center;
      margin: 10px 0;
    }
    
    .status {
      margin-top: 20px;
      padding: 15px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 8px;
      font-size: 11px;
      font-family: monospace;
      max-width: 250px;
    }
    
    .close {
      position: absolute;
      top: 10px;
      right: 10px;
      width: 30px;
      height: 30px;
      background: rgba(255, 0, 0, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 15px;
      color: white;
      font-size: 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      user-select: none;
    }
    
    .close:hover {
      background: rgba(255, 0, 0, 0.8);
    }
  </style>
</head>
<body>
  <div class="glass">
    <div class="close" onclick="window.close()">×</div>
    <h1>Electron Glass Test</h1>
    <p><strong>Look at your desktop behind this window.</strong></p>
    <p>If it's BLURRED = Working ✅</p>
    <p>If it's SHARP/CLEAR = Not working ❌</p>
    <div class="status" id="status">Loading...</div>
  </div>
  
  <script>
    const el = document.querySelector('.glass');
    const styles = window.getComputedStyle(el);
    
    document.getElementById('status').innerHTML = 
      'backdrop: ' + (styles.backdropFilter || 'NONE') + '<br>' +
      '-webkit: ' + (styles.webkitBackdropFilter || 'NONE') + '<br>' +
      'bg: ' + styles.background;
    
    console.log('Test window styles:', {
      backdropFilter: styles.backdropFilter,
      webkitBackdropFilter: styles.webkitBackdropFilter,
      background: styles.background,
    });
  </script>
</body>
</html>
  `;

  testWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  testWin.webContents.openDevTools({ mode: 'detach' });

  return testWin;
}

// Run the test
app.whenReady().then(() => {
  console.log('🧪 Creating Electron Glass Test Window...');
  console.log('Look at your DESKTOP behind the window - it should be BLURRED');
  createTestWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
