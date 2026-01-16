/**
 * Testing API Server
 *
 * Provides a local HTTP API for automated testing.
 * Allows Claude or other tools to interact with the app programmatically.
 *
 * Port: 3850
 *
 * Endpoints:
 *   GET  /health         - Health check
 *   GET  /status         - Window status (visible, focused, ready)
 *   POST /send-message   - Send a message to the chat input { message: string }
 *   POST /focus          - Focus the app window
 *   POST /expand         - Expand from mini pill to full UI
 *   GET  /get-state      - Get current conversation state (messages, isThinking, etc.)
 *   GET  /wait-idle      - Wait for AI to finish processing (poll until not thinking)
 */

const http = require('http');
const { ipcMain } = require('electron');

let mainWindow = null;
let server = null;

// Cached state from renderer (updated via IPC)
let cachedState = {
  messages: [],
  isThinking: false,
  runStatus: 'idle',
  lastUpdated: null
};

function setMainWindow(win) {
  mainWindow = win;
}

// Set up IPC handler to receive state updates from renderer
function setupStateListener() {
  ipcMain.handle('testing:update-state', (event, state) => {
    cachedState = {
      ...state,
      lastUpdated: Date.now()
    };
    return { success: true };
  });
}

function start() {
  if (server) {
    console.log('[TestingAPI] Server already running');
    return;
  }

  // Set up IPC listener for state updates
  setupStateListener();

  server = http.createServer(async (req, res) => {
    // CORS headers for local testing
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    try {
      // Health check
      if (pathname === '/health' && req.method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok', service: 'testing-api' }));
        return;
      }

      // Send a message to the chat input
      if (pathname === '/send-message' && req.method === 'POST') {
        const body = await readBody(req);
        const { message } = JSON.parse(body);

        if (!message) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'message is required' }));
          return;
        }

        if (!mainWindow) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Main window not available' }));
          return;
        }

        // Send to renderer via IPC
        mainWindow.webContents.send('testing:send-message', { message });
        console.log(`[TestingAPI] Sent message: ${message.slice(0, 50)}...`);

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: 'Message sent to UI' }));
        return;
      }

      // Get current state/status
      if (pathname === '/status' && req.method === 'GET') {
        const isVisible = mainWindow ? mainWindow.isVisible() : false;
        const isFocused = mainWindow ? mainWindow.isFocused() : false;

        res.writeHead(200);
        res.end(JSON.stringify({
          windowVisible: isVisible,
          windowFocused: isFocused,
          ready: !!mainWindow
        }));
        return;
      }

      // Focus the window
      if (pathname === '/focus' && req.method === 'POST') {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          res.writeHead(200);
          res.end(JSON.stringify({ success: true }));
        } else {
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Window not available' }));
        }
        return;
      }

      // Expand the window (make it larger for testing)
      if (pathname === '/expand' && req.method === 'POST') {
        if (mainWindow) {
          mainWindow.webContents.send('testing:expand-window');
          res.writeHead(200);
          res.end(JSON.stringify({ success: true }));
        } else {
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Window not available' }));
        }
        return;
      }

      // Get current conversation state
      if (pathname === '/get-state' && req.method === 'GET') {
        // Request fresh state from renderer
        if (mainWindow) {
          try {
            const state = await mainWindow.webContents.executeJavaScript(`
              (function() {
                // Try to get state from React components or global state
                const stateStore = window.__AGENT_MAX_STATE__;
                if (stateStore) {
                  return {
                    messages: stateStore.messages || [],
                    isThinking: stateStore.isThinking || false,
                    runStatus: stateStore.runStatus || 'idle'
                  };
                }
                return { messages: [], isThinking: false, runStatus: 'unknown' };
              })()
            `);
            res.writeHead(200);
            res.end(JSON.stringify({
              ...state,
              lastUpdated: Date.now(),
              source: 'renderer'
            }));
          } catch (err) {
            // Fall back to cached state
            res.writeHead(200);
            res.end(JSON.stringify({
              ...cachedState,
              source: 'cached',
              error: err.message
            }));
          }
        } else {
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Window not available' }));
        }
        return;
      }

      // Wait for AI to finish (polling endpoint)
      // Returns when: not thinking, not running, and no streaming messages
      if (pathname === '/wait-idle' && req.method === 'GET') {
        const timeout = parseInt(url.searchParams.get('timeout') || '30000', 10);
        const pollInterval = 500;
        const startTime = Date.now();

        const checkIdle = async () => {
          if (!mainWindow) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Window not available' }));
            return;
          }

          try {
            const state = await mainWindow.webContents.executeJavaScript(`
              (function() {
                const stateStore = window.__AGENT_MAX_STATE__;
                if (stateStore) {
                  // Check if any message is still streaming
                  const messages = stateStore.messages || [];
                  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
                  const hasStreamingMessage = messages.some(m => m.streaming === true);

                  return {
                    isThinking: stateStore.isThinking || false,
                    runStatus: stateStore.runStatus || 'idle',
                    hasStreamingMessage: hasStreamingMessage,
                    lastMessage: lastMessage,
                    messageCount: messages.length
                  };
                }
                return { isThinking: false, runStatus: 'unknown', hasStreamingMessage: false, lastMessage: null, messageCount: 0 };
              })()
            `);

            // Idle when: not thinking, not running, and no streaming messages
            const isIdle = !state.isThinking &&
                           state.runStatus !== 'running' &&
                           !state.hasStreamingMessage;

            if (isIdle) {
              res.writeHead(200);
              res.end(JSON.stringify({
                idle: true,
                ...state,
                waitTime: Date.now() - startTime
              }));
              return;
            }

            if (Date.now() - startTime > timeout) {
              res.writeHead(408);
              res.end(JSON.stringify({
                idle: false,
                timeout: true,
                reason: state.isThinking ? 'still thinking' :
                        state.runStatus === 'running' ? 'still running' :
                        state.hasStreamingMessage ? 'still streaming' : 'unknown',
                ...state,
                waitTime: Date.now() - startTime
              }));
              return;
            }

            // Continue polling
            setTimeout(checkIdle, pollInterval);
          } catch (err) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: err.message }));
          }
        };

        checkIdle();
        return;
      }

      // Start a new conversation (clear messages)
      if (pathname === '/new-conversation' && req.method === 'POST') {
        if (mainWindow) {
          try {
            // Send IPC to clear conversation
            mainWindow.webContents.send('new-conversation');

            // Also clear via JavaScript
            await mainWindow.webContents.executeJavaScript(`
              (function() {
                const stateStore = window.__AGENT_MAX_STATE__;
                if (stateStore && typeof stateStore.clearMessages === 'function') {
                  stateStore.clearMessages();
                }
                // Also try zustand store if available
                if (window.useStore && window.useStore.getState) {
                  const state = window.useStore.getState();
                  if (typeof state.clearMessages === 'function') {
                    state.clearMessages();
                  }
                }
                return true;
              })()
            `);

            // Wait a moment for state to clear
            await new Promise(resolve => setTimeout(resolve, 500));

            res.writeHead(200);
            res.end(JSON.stringify({ success: true, message: 'Conversation cleared' }));
          } catch (err) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: err.message }));
          }
        } else {
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Window not available' }));
        }
        return;
      }

      // Respond to ask_user question (for automated testing)
      if (pathname === '/respond-ask-user' && req.method === 'POST') {
        const body = await readBody(req);
        const { response } = JSON.parse(body);

        if (!response) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'response is required' }));
          return;
        }

        if (!mainWindow) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Main window not available' }));
          return;
        }

        try {
          // Use IPC to trigger the respond handler directly
          const { ipcMain } = require('electron');

          // Emit the respond event through the renderer
          await mainWindow.webContents.executeJavaScript(`
            (function() {
              // Call the askUser.respond function if available
              if (window.askUser && window.askUser.respond) {
                window.askUser.respond({
                  cancelled: false,
                  answer: ${JSON.stringify(response)},
                  selectedOption: null,
                  selectedOptionId: null
                });
                return { success: true, method: 'askUser.respond' };
              }
              return { success: false, error: 'askUser.respond not available' };
            })()
          `);

          console.log(`[TestingAPI] Sent ask_user response: ${response.slice(0, 50)}...`);

          res.writeHead(200);
          res.end(JSON.stringify({ success: true, message: 'Response sent to ask_user' }));
        } catch (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // Get last N messages
      if (pathname === '/get-messages' && req.method === 'GET') {
        const count = parseInt(url.searchParams.get('count') || '10', 10);

        if (mainWindow) {
          try {
            const messages = await mainWindow.webContents.executeJavaScript(`
              (function() {
                const stateStore = window.__AGENT_MAX_STATE__;
                if (stateStore && stateStore.messages) {
                  return stateStore.messages.slice(-${count});
                }
                return [];
              })()
            `);
            res.writeHead(200);
            res.end(JSON.stringify({ messages, count: messages.length }));
          } catch (err) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: err.message }));
          }
        } else {
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Window not available' }));
        }
        return;
      }

      // Not found
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found', path: pathname }))

    } catch (error) {
      console.error('[TestingAPI] Error:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: error.message }));
    }
  });

  server.listen(3850, '127.0.0.1', () => {
    console.log('[TestingAPI] Server listening on http://127.0.0.1:3850');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log('[TestingAPI] Port 3850 in use, skipping');
    } else {
      console.error('[TestingAPI] Server error:', err);
    }
  });
}

function stop() {
  if (server) {
    server.close();
    server = null;
    console.log('[TestingAPI] Server stopped');
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

module.exports = {
  start,
  stop,
  setMainWindow
};
