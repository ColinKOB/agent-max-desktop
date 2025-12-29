/**
 * Spreadsheet API Server
 *
 * HTTP server that exposes spreadsheet functionality to the Python backend.
 * Runs on port 3848 and provides endpoints for:
 * - Spreadsheet lifecycle (create, destroy, minimize, restore)
 * - Cell operations (read, write, formulas)
 * - Range operations
 * - File operations (open, save, export)
 * - Cloud sync
 * - Frame capture for PiP
 */

const http = require('http');
const url = require('url');

// Import spreadsheet manager
const { spreadsheetManager } = require('./spreadsheetManager.cjs');

// Store references
let mainWindow = null;
let server = null;

// Port for the API server
const API_PORT = 3848;

/**
 * Parse JSON body from request
 */
async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

/**
 * Send JSON response
 */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

/**
 * Handle spreadsheet API requests
 */
async function handleRequest(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  try {
    // =========================================================================
    // Health & Status
    // =========================================================================

    if (pathname === '/health' && req.method === 'GET') {
      return sendJson(res, 200, {
        status: 'ok',
        timestamp: new Date().toISOString(),
        spreadsheetActive: spreadsheetManager.getIsActive()
      });
    }

    if (pathname === '/spreadsheet/status' && req.method === 'GET') {
      return sendJson(res, 200, spreadsheetManager.getStatus());
    }

    // =========================================================================
    // Spreadsheet Lifecycle
    // =========================================================================

    if (pathname === '/spreadsheet/create' && req.method === 'POST') {
      const body = await parseBody(req);
      const width = body.width || 1280;
      const height = body.height || 800;

      const result = await spreadsheetManager.create(width, height, body);
      return sendJson(res, result.success ? 200 : 500, result);
    }

    if (pathname === '/spreadsheet/destroy' && req.method === 'POST') {
      const result = spreadsheetManager.destroy();
      return sendJson(res, 200, result);
    }

    if (pathname === '/spreadsheet/minimize' && req.method === 'POST') {
      const result = spreadsheetManager.minimize();
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/spreadsheet/restore' && req.method === 'POST') {
      const result = spreadsheetManager.restore();
      return sendJson(res, result.success ? 200 : 400, result);
    }

    // =========================================================================
    // Cell Operations
    // =========================================================================

    if (pathname === '/spreadsheet/read-cell' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.cell) {
        return sendJson(res, 400, { success: false, error: 'Cell reference required' });
      }
      const sheet = body.sheet || 'Sheet1';
      const result = await spreadsheetManager.readCell(sheet, body.cell);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/spreadsheet/write-cell' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.cell || body.value === undefined) {
        return sendJson(res, 400, { success: false, error: 'Cell and value required' });
      }
      const sheet = body.sheet || 'Sheet1';
      const result = await spreadsheetManager.writeCell(sheet, body.cell, body.value);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/spreadsheet/read-range' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.range) {
        return sendJson(res, 400, { success: false, error: 'Range required (e.g., A1:D10)' });
      }
      const sheet = body.sheet || 'Sheet1';
      const result = await spreadsheetManager.readRange(sheet, body.range);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/spreadsheet/write-range' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.startCell || !body.data) {
        return sendJson(res, 400, { success: false, error: 'startCell and data required' });
      }
      const sheet = body.sheet || 'Sheet1';
      const result = await spreadsheetManager.writeRange(sheet, body.startCell, body.data);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    // =========================================================================
    // Formula Operations
    // =========================================================================

    if (pathname === '/spreadsheet/set-formula' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.cell || !body.formula) {
        return sendJson(res, 400, { success: false, error: 'Cell and formula required' });
      }
      const sheet = body.sheet || 'Sheet1';
      const result = await spreadsheetManager.setFormula(sheet, body.cell, body.formula);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/spreadsheet/get-formula' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.cell) {
        return sendJson(res, 400, { success: false, error: 'Cell required' });
      }
      const sheet = body.sheet || 'Sheet1';
      const result = await spreadsheetManager.getFormula(sheet, body.cell);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    // =========================================================================
    // Formatting
    // =========================================================================

    if (pathname === '/spreadsheet/format-cells' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.range || !body.format) {
        return sendJson(res, 400, { success: false, error: 'Range and format required' });
      }
      const sheet = body.sheet || 'Sheet1';
      const result = await spreadsheetManager.formatCells(sheet, body.range, body.format);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    // =========================================================================
    // Sheet Management
    // =========================================================================

    if (pathname === '/spreadsheet/get-sheets' && req.method === 'GET') {
      const result = await spreadsheetManager.getSheetNames();
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/spreadsheet/add-sheet' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.name) {
        return sendJson(res, 400, { success: false, error: 'Sheet name required' });
      }
      const result = await spreadsheetManager.addSheet(body.name);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/spreadsheet/delete-sheet' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.name) {
        return sendJson(res, 400, { success: false, error: 'Sheet name required' });
      }
      const result = await spreadsheetManager.deleteSheet(body.name);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/spreadsheet/get-sheet-data' && req.method === 'POST') {
      const body = await parseBody(req);
      const sheet = body.sheet || 'Sheet1';
      const result = await spreadsheetManager.getSheetData(sheet);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    // =========================================================================
    // File Operations
    // =========================================================================

    if (pathname === '/spreadsheet/new' && req.method === 'POST') {
      const body = await parseBody(req);
      const result = await spreadsheetManager.newSpreadsheet(body.name);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/spreadsheet/open' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.path) {
        return sendJson(res, 400, { success: false, error: 'File path required' });
      }
      const result = await spreadsheetManager.openFile(body.path);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/spreadsheet/save' && req.method === 'POST') {
      const body = await parseBody(req);
      const result = await spreadsheetManager.saveFile(body.path);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/spreadsheet/export' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.format || !body.path) {
        return sendJson(res, 400, { success: false, error: 'Format and path required' });
      }
      const result = await spreadsheetManager.exportAs(body.format, body.path);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    // =========================================================================
    // Data Operations
    // =========================================================================

    if (pathname === '/spreadsheet/get-data' && req.method === 'GET') {
      const data = await spreadsheetManager.getData();
      return sendJson(res, 200, { success: true, data });
    }

    if (pathname === '/spreadsheet/set-data' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.data) {
        return sendJson(res, 400, { success: false, error: 'Data required' });
      }
      const result = await spreadsheetManager.setData(body.data);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    // =========================================================================
    // Frame Capture
    // =========================================================================

    if (pathname === '/spreadsheet/capture-frame' && req.method === 'POST') {
      const frame = await spreadsheetManager.captureFrame();
      if (frame) {
        return sendJson(res, 200, { success: true, frame });
      }
      return sendJson(res, 400, { success: false, error: 'Capture failed' });
    }

    if (pathname === '/spreadsheet/get-frame' && req.method === 'GET') {
      const frame = spreadsheetManager.getLastFrame();
      if (frame) {
        return sendJson(res, 200, { success: true, frame });
      }
      return sendJson(res, 400, { success: false, error: 'No frame available' });
    }

    // =========================================================================
    // Activity Log
    // =========================================================================

    if (pathname === '/spreadsheet/activity-log' && req.method === 'GET') {
      const query = parsedUrl.query;
      const log = spreadsheetManager.getActivityLog({
        limit: query.limit ? parseInt(query.limit, 10) : 100,
        sessionId: query.sessionId || null,
        actionType: query.actionType || null
      });
      return sendJson(res, 200, { success: true, log });
    }

    if (pathname === '/spreadsheet/sessions' && req.method === 'GET') {
      const sessions = spreadsheetManager.getSessions();
      return sendJson(res, 200, { success: true, sessions });
    }

    if (pathname === '/spreadsheet/activity-log/clear' && req.method === 'POST') {
      const result = spreadsheetManager.clearActivityLog();
      return sendJson(res, 200, result);
    }

    // Debug endpoint for formula errors
    if (pathname === '/spreadsheet/formula-debug' && req.method === 'GET') {
      const result = await spreadsheetManager.getFormulaDebug();
      return sendJson(res, 200, result);
    }

    // =========================================================================
    // Undo/Redo Operations
    // =========================================================================

    if (pathname === '/spreadsheet/undo' && req.method === 'POST') {
      const result = await spreadsheetManager.undo();
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/spreadsheet/redo' && req.method === 'POST') {
      const result = await spreadsheetManager.redo();
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/spreadsheet/undo-redo-status' && req.method === 'GET') {
      const result = await spreadsheetManager.getUndoRedoStatus();
      return sendJson(res, result.success ? 200 : 400, result);
    }

    // =========================================================================
    // Row/Column Operations
    // =========================================================================

    if (pathname === '/spreadsheet/delete-rows' && req.method === 'POST') {
      const body = await parseBody(req);
      if (body.startRow === undefined) {
        return sendJson(res, 400, { success: false, error: 'startRow required' });
      }
      const count = body.count || 1;
      const result = await spreadsheetManager.deleteRows(body.startRow, count);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/spreadsheet/insert-rows' && req.method === 'POST') {
      const body = await parseBody(req);
      if (body.atRow === undefined) {
        return sendJson(res, 400, { success: false, error: 'atRow required' });
      }
      const count = body.count || 1;
      const result = await spreadsheetManager.insertRows(body.atRow, count);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/spreadsheet/delete-columns' && req.method === 'POST') {
      const body = await parseBody(req);
      if (body.startCol === undefined) {
        return sendJson(res, 400, { success: false, error: 'startCol required' });
      }
      const count = body.count || 1;
      const result = await spreadsheetManager.deleteColumns(body.startCol, count);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/spreadsheet/insert-columns' && req.method === 'POST') {
      const body = await parseBody(req);
      if (body.atCol === undefined) {
        return sendJson(res, 400, { success: false, error: 'atCol required' });
      }
      const count = body.count || 1;
      const result = await spreadsheetManager.insertColumns(body.atCol, count);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/spreadsheet/clear-cells' && req.method === 'POST') {
      const body = await parseBody(req);
      if (body.startRow === undefined || body.startCol === undefined) {
        return sendJson(res, 400, { success: false, error: 'startRow and startCol required' });
      }
      const endRow = body.endRow !== undefined ? body.endRow : body.startRow;
      const endCol = body.endCol !== undefined ? body.endCol : body.startCol;
      const result = await spreadsheetManager.clearCells(body.startRow, body.startCol, endRow, endCol);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    // =========================================================================
    // Enhanced Status
    // =========================================================================

    if (pathname === '/spreadsheet/enhanced-status' && req.method === 'GET') {
      const result = await spreadsheetManager.getEnhancedStatus();
      return sendJson(res, result.success ? 200 : 400, result);
    }

    // =========================================================================
    // Cloud Sync (Supabase)
    // =========================================================================

    if (pathname === '/spreadsheet/sync-to-cloud' && req.method === 'POST') {
      const body = await parseBody(req);
      // This will be implemented with the spreadsheetSync service
      // For now, return not implemented
      return sendJson(res, 501, {
        success: false,
        error: 'Cloud sync not yet implemented. Use local file operations.'
      });
    }

    if (pathname === '/spreadsheet/load-from-cloud' && req.method === 'POST') {
      const body = await parseBody(req);
      return sendJson(res, 501, {
        success: false,
        error: 'Cloud sync not yet implemented. Use local file operations.'
      });
    }

    if (pathname === '/spreadsheet/list-cloud' && req.method === 'GET') {
      return sendJson(res, 501, {
        success: false,
        error: 'Cloud sync not yet implemented.'
      });
    }

    // =========================================================================
    // Chart Operations
    // =========================================================================

    if (pathname === '/spreadsheet/insert-chart' && req.method === 'POST') {
      const body = await parseBody(req);
      const result = await spreadsheetManager.insertChart(
        body.type || 'bar',
        body.dataRange || 'A1:D5',
        body.title || 'Chart',
        body.showLegend !== false
      );
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/spreadsheet/remove-chart' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.chartId) {
        return sendJson(res, 400, { success: false, error: 'chartId required' });
      }
      const result = await spreadsheetManager.removeChart(body.chartId);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/spreadsheet/get-charts' && req.method === 'GET') {
      const result = await spreadsheetManager.getCharts();
      return sendJson(res, result.success ? 200 : 400, result);
    }

    // =========================================================================
    // Sort/Filter Operations
    // =========================================================================

    if (pathname === '/spreadsheet/sort' && req.method === 'POST') {
      const body = await parseBody(req);
      // Support both column index (0, 1, 2) and column letter (A, B, C)
      let column = body.column || 0;
      if (typeof column === 'string' && /^[A-Z]+$/i.test(column)) {
        // Convert column letter to index (A=0, B=1, etc.)
        const colStr = column.toUpperCase();
        column = 0;
        for (let i = 0; i < colStr.length; i++) {
          column = column * 26 + (colStr.charCodeAt(i) - 64);
        }
        column -= 1; // 0-indexed
      }
      const result = await spreadsheetManager.sortColumn(
        column,
        body.direction || 'asc'
      );
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/spreadsheet/filter' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.value) {
        return sendJson(res, 400, { success: false, error: 'value required for filtering' });
      }
      // Support both column index (0, 1, 2) and column letter (A, B, C)
      let column = body.column || 0;
      if (typeof column === 'string' && /^[A-Z]+$/i.test(column)) {
        const colStr = column.toUpperCase();
        column = 0;
        for (let i = 0; i < colStr.length; i++) {
          column = column * 26 + (colStr.charCodeAt(i) - 64);
        }
        column -= 1; // 0-indexed
      }
      const result = await spreadsheetManager.filterColumn(
        column,
        body.value
      );
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/spreadsheet/clear-filter' && req.method === 'POST') {
      const result = await spreadsheetManager.clearFilter();
      return sendJson(res, result.success ? 200 : 400, result);
    }

    // =========================================================================
    // Find/Replace Operations
    // =========================================================================

    if (pathname === '/spreadsheet/find' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.searchTerm) {
        return sendJson(res, 400, { success: false, error: 'searchTerm required' });
      }
      const result = await spreadsheetManager.findText(
        body.searchTerm,
        body.caseSensitive || false,
        body.wholeCell || false
      );
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/spreadsheet/replace' && req.method === 'POST') {
      const body = await parseBody(req);
      const result = await spreadsheetManager.replaceText(body.replaceWith || '');
      return sendJson(res, result.success ? 200 : 400, result);
    }

    if (pathname === '/spreadsheet/replace-all' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.searchTerm) {
        return sendJson(res, 400, { success: false, error: 'searchTerm required' });
      }
      const result = await spreadsheetManager.replaceAll(
        body.searchTerm,
        body.replaceWith || '',
        body.caseSensitive || false,
        body.wholeCell || false
      );
      return sendJson(res, result.success ? 200 : 400, result);
    }

    // 404 for unknown routes
    return sendJson(res, 404, { error: 'Not found', path: pathname });

  } catch (e) {
    console.error('[SpreadsheetAPI] Request error:', e);
    return sendJson(res, 500, { error: e.message });
  }
}

/**
 * Start the spreadsheet API server
 */
function startServer(window) {
  mainWindow = window;

  if (server) {
    console.log('[SpreadsheetAPI] Server already running');
    return;
  }

  server = http.createServer(handleRequest);

  server.listen(API_PORT, '127.0.0.1', () => {
    console.log(`[SpreadsheetAPI] Server listening on http://127.0.0.1:${API_PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[SpreadsheetAPI] Port ${API_PORT} already in use, server not started`);
    } else {
      console.error('[SpreadsheetAPI] Server error:', err);
    }
  });
}

/**
 * Stop the spreadsheet API server
 */
function stopServer() {
  // Destroy spreadsheet if active
  if (spreadsheetManager.getIsActive()) {
    spreadsheetManager.destroy();
  }

  if (server) {
    server.close(() => {
      console.log('[SpreadsheetAPI] Server stopped');
    });
    server = null;
  }
}

/**
 * Update the main window reference
 */
function setMainWindow(window) {
  mainWindow = window;
}

/**
 * Get spreadsheet manager for direct access
 */
function getSpreadsheetManager() {
  return spreadsheetManager;
}

module.exports = {
  startServer,
  stopServer,
  setMainWindow,
  getSpreadsheetManager
};
