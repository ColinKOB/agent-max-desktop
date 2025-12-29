/**
 * AI Spreadsheet Manager
 *
 * Creates and manages an isolated BrowserWindow where the AI can work with
 * Excel-like spreadsheets. Uses FortuneSheet for full formula support.
 *
 * Features:
 * - Isolated spreadsheet window with full Excel formula support
 * - Screenshot capture for PiP viewer
 * - Cell read/write, range operations
 * - Formula support (SUM, VLOOKUP, IF, COUNTIF, etc.)
 * - Local file storage (xlsx/csv)
 * - Supabase cloud sync
 */

const { BrowserWindow, screen, ipcMain, dialog } = require('electron');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// Generate UUID v4 using built-in crypto
function uuidv4() {
  return crypto.randomUUID();
}

class SpreadsheetManager {
  constructor() {
    this.spreadsheetWindow = null;
    this.isActive = false;
    this.isMinimized = false;
    this.captureInterval = null;
    this.lastFrame = null;
    this.frameListeners = new Set();

    // Default spreadsheet size
    this.width = 1280;
    this.height = 800;

    // Current file info
    this.currentFile = null; // { path, name, type: 'local'|'cloud', modified }
    this.spreadsheetData = null;
    this.supabaseId = null;

    // Activity logging
    this.activityLog = [];
    this.currentSessionId = null;
    this.maxLogEntries = 1000;
  }

  // ===========================================================================
  // Activity Logging
  // ===========================================================================

  logActivity(action, parameters = {}, result = 'success', error = null) {
    if (!this.currentSessionId) {
      this.currentSessionId = uuidv4();
    }

    const entry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      sessionId: this.currentSessionId,
      action,
      parameters,
      result: error ? 'error' : result,
      error: error || null,
      fileName: this.currentFile?.name || 'Untitled',
      sheetCount: this.spreadsheetData?.length || 0
    };

    this.activityLog.push(entry);

    if (this.activityLog.length > this.maxLogEntries) {
      this.activityLog = this.activityLog.slice(-this.maxLogEntries);
    }

    console.log(`[Spreadsheet Activity] ${action}:`, JSON.stringify(parameters).slice(0, 100));
    return entry;
  }

  getActivityLog(options = {}) {
    const { limit = 100, sessionId = null, actionType = null } = options;
    let log = [...this.activityLog];

    if (sessionId) {
      log = log.filter(entry => entry.sessionId === sessionId);
    }
    if (actionType) {
      log = log.filter(entry => entry.action === actionType);
    }

    return log.slice(-limit).reverse();
  }

  clearActivityLog() {
    this.activityLog = [];
    console.log('[Spreadsheet] Activity log cleared');
    return { success: true };
  }

  getSessions() {
    const sessions = new Map();

    for (const entry of this.activityLog) {
      if (!sessions.has(entry.sessionId)) {
        sessions.set(entry.sessionId, {
          sessionId: entry.sessionId,
          startTime: entry.timestamp,
          endTime: entry.timestamp,
          actionCount: 0
        });
      }
      const session = sessions.get(entry.sessionId);
      session.endTime = entry.timestamp;
      session.actionCount++;
    }

    return Array.from(sessions.values()).reverse();
  }

  // ===========================================================================
  // Window Lifecycle
  // ===========================================================================

  async create(width = 1280, height = 800, options = {}) {
    if (this.spreadsheetWindow && !this.spreadsheetWindow.isDestroyed()) {
      console.log('[Spreadsheet] Already exists, returning existing window');
      return { success: true, windowId: this.spreadsheetWindow.id };
    }

    this.width = width;
    this.height = height;

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    this.spreadsheetWindow = new BrowserWindow({
      width: this.width,
      height: this.height,
      x: Math.floor((screenWidth - this.width) / 2),
      y: Math.floor((screenHeight - this.height) / 2),
      show: false,
      frame: true,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 12, y: 12 },
      title: "Max's Spreadsheet",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false, // Need false for xlsx operations
        webSecurity: true,
        preload: path.join(__dirname, 'spreadsheetPreload.cjs')
      },
      skipTaskbar: false,
      backgroundColor: '#1a1a2e'
    });

    this.spreadsheetWindow.on('closed', () => {
      this.cleanup();
    });

    // Load the spreadsheet HTML page
    const htmlPath = path.join(__dirname, 'spreadsheet.html');
    await this.spreadsheetWindow.loadFile(htmlPath);

    this.spreadsheetWindow.show();
    this.isActive = true;
    this.isMinimized = false;

    // Initialize with empty spreadsheet
    this.spreadsheetData = [{
      name: 'Sheet1',
      celldata: [],
      row: 100,
      column: 26,
      config: {}
    }];
    this.currentFile = { name: 'Untitled', type: 'new', modified: false };

    this.currentSessionId = uuidv4();
    this.logActivity('session_start', { width, height });

    console.log('[Spreadsheet] Created spreadsheet window:', this.spreadsheetWindow.id);
    return { success: true, windowId: this.spreadsheetWindow.id };
  }

  destroy() {
    this.logActivity('session_end', {});
    this.cleanup();

    if (this.spreadsheetWindow && !this.spreadsheetWindow.isDestroyed()) {
      this.spreadsheetWindow.close();
      this.spreadsheetWindow = null;
    }

    this.isActive = false;
    this.isMinimized = false;
    this.currentSessionId = null;
    this.currentFile = null;
    this.spreadsheetData = null;
    console.log('[Spreadsheet] Destroyed');
    return { success: true };
  }

  minimize() {
    if (!this.getIsActive()) {
      return { success: false, error: 'Spreadsheet not active' };
    }
    this.isMinimized = true;
    this.logActivity('minimize', {});
    return { success: true, isMinimized: true };
  }

  restore() {
    if (!this.getIsActive()) {
      return { success: false, error: 'Spreadsheet not active' };
    }
    this.isMinimized = false;
    this.logActivity('restore', {});
    return { success: true, isMinimized: false };
  }

  getIsMinimized() {
    return this.isMinimized;
  }

  cleanup() {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
    this.frameListeners.clear();
    this.lastFrame = null;
    this.isActive = false;
    this.isMinimized = false;
  }

  getIsActive() {
    return this.isActive && this.spreadsheetWindow && !this.spreadsheetWindow.isDestroyed();
  }

  getWindowId() {
    if (!this.spreadsheetWindow || this.spreadsheetWindow.isDestroyed()) return 0;
    return this.spreadsheetWindow.id;
  }

  // ===========================================================================
  // Frame Capture for PiP
  // ===========================================================================

  startFrameCapture(fps = 5) {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
    }

    const captureFrame = async () => {
      if (!this.getIsActive()) return;

      try {
        const image = await this.spreadsheetWindow.webContents.capturePage();
        this.lastFrame = image.toDataURL();

        for (const listener of this.frameListeners) {
          try {
            listener(this.lastFrame);
          } catch (e) {
            console.error('[Spreadsheet] Frame listener error:', e);
          }
        }
      } catch (e) {
        // Window might be destroyed
      }
    };

    this.captureInterval = setInterval(captureFrame, 1000 / fps);
    captureFrame();
  }

  getLastFrame() {
    return this.lastFrame;
  }

  async captureFrame() {
    if (!this.getIsActive()) return null;

    try {
      const image = await this.spreadsheetWindow.webContents.capturePage();
      this.lastFrame = image.toDataURL();
      return this.lastFrame;
    } catch (e) {
      console.error('[Spreadsheet] Capture error:', e);
      return null;
    }
  }

  addFrameListener(callback) {
    this.frameListeners.add(callback);
  }

  removeFrameListener(callback) {
    this.frameListeners.delete(callback);
  }

  // ===========================================================================
  // Cell Operations
  // ===========================================================================

  /**
   * Parse cell reference like "A1" to row/col indices
   */
  parseCellRef(cellRef) {
    const match = cellRef.match(/^([A-Z]+)(\d+)$/i);
    if (!match) return null;

    const colStr = match[1].toUpperCase();
    const row = parseInt(match[2], 10) - 1; // 0-indexed

    // Convert column letters to index (A=0, B=1, ..., Z=25, AA=26, etc.)
    let col = 0;
    for (let i = 0; i < colStr.length; i++) {
      col = col * 26 + (colStr.charCodeAt(i) - 64);
    }
    col -= 1; // 0-indexed

    return { row, col };
  }

  /**
   * Convert row/col indices to cell reference
   */
  toCellRef(row, col) {
    let colStr = '';
    let c = col + 1;
    while (c > 0) {
      c--;
      colStr = String.fromCharCode(65 + (c % 26)) + colStr;
      c = Math.floor(c / 26);
    }
    return colStr + (row + 1);
  }

  /**
   * Get current spreadsheet data from the renderer
   */
  async getData() {
    if (!this.getIsActive()) return null;

    try {
      const data = await this.spreadsheetWindow.webContents.executeJavaScript(`
        window.getSpreadsheetData ? window.getSpreadsheetData() : null
      `);
      if (data) {
        this.spreadsheetData = data;
      }
      return this.spreadsheetData;
    } catch (e) {
      console.error('[Spreadsheet] getData error:', e);
      return this.spreadsheetData;
    }
  }

  /**
   * Set spreadsheet data in the renderer
   */
  async setData(data) {
    if (!this.getIsActive()) return { success: false, error: 'Spreadsheet not active' };

    try {
      this.spreadsheetData = data;
      await this.spreadsheetWindow.webContents.executeJavaScript(`
        window.setSpreadsheetData(${JSON.stringify(data)})
      `);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Read a single cell value
   */
  async readCell(sheetName, cellRef) {
    if (!this.getIsActive()) return { success: false, error: 'Spreadsheet not active' };

    const pos = this.parseCellRef(cellRef);
    if (!pos) return { success: false, error: `Invalid cell reference: ${cellRef}` };

    try {
      const result = await this.spreadsheetWindow.webContents.executeJavaScript(`
        window.getCellValue('${sheetName}', ${pos.row}, ${pos.col})
      `);

      this.logActivity('read_cell', { sheet: sheetName, cell: cellRef });
      return { success: true, value: result?.value, formula: result?.formula, cell: cellRef };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Write a value to a single cell
   */
  async writeCell(sheetName, cellRef, value) {
    if (!this.getIsActive()) return { success: false, error: 'Spreadsheet not active' };

    const pos = this.parseCellRef(cellRef);
    if (!pos) return { success: false, error: `Invalid cell reference: ${cellRef}` };

    try {
      await this.spreadsheetWindow.webContents.executeJavaScript(`
        window.setCellValue('${sheetName}', ${pos.row}, ${pos.col}, ${JSON.stringify(value)})
      `);

      if (this.currentFile) {
        this.currentFile.modified = true;
      }

      this.logActivity('write_cell', { sheet: sheetName, cell: cellRef, valuePreview: String(value).slice(0, 20) });
      return { success: true, cell: cellRef };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Read a range of cells
   */
  async readRange(sheetName, rangeRef) {
    if (!this.getIsActive()) return { success: false, error: 'Spreadsheet not active' };

    // Parse range like "A1:D10"
    const parts = rangeRef.split(':');
    if (parts.length !== 2) return { success: false, error: `Invalid range: ${rangeRef}` };

    const start = this.parseCellRef(parts[0]);
    const end = this.parseCellRef(parts[1]);
    if (!start || !end) return { success: false, error: `Invalid range: ${rangeRef}` };

    try {
      const result = await this.spreadsheetWindow.webContents.executeJavaScript(`
        window.getRangeValues('${sheetName}', ${start.row}, ${start.col}, ${end.row}, ${end.col})
      `);

      this.logActivity('read_range', { sheet: sheetName, range: rangeRef });
      return { success: true, data: result, range: rangeRef };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Write a 2D array to a range starting at a cell
   */
  async writeRange(sheetName, startCellRef, data) {
    if (!this.getIsActive()) return { success: false, error: 'Spreadsheet not active' };

    const start = this.parseCellRef(startCellRef);
    if (!start) return { success: false, error: `Invalid cell reference: ${startCellRef}` };

    if (!Array.isArray(data) || !Array.isArray(data[0])) {
      return { success: false, error: 'Data must be a 2D array' };
    }

    try {
      await this.spreadsheetWindow.webContents.executeJavaScript(`
        window.setRangeValues('${sheetName}', ${start.row}, ${start.col}, ${JSON.stringify(data)})
      `);

      if (this.currentFile) {
        this.currentFile.modified = true;
      }

      const endRow = start.row + data.length - 1;
      const endCol = start.col + data[0].length - 1;
      const endCellRef = this.toCellRef(endRow, endCol);

      this.logActivity('write_range', {
        sheet: sheetName,
        range: `${startCellRef}:${endCellRef}`,
        rows: data.length,
        cols: data[0].length
      });
      return { success: true, range: `${startCellRef}:${endCellRef}` };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ===========================================================================
  // Formula Operations
  // ===========================================================================

  /**
   * Set a formula in a cell
   */
  async setFormula(sheetName, cellRef, formula) {
    if (!this.getIsActive()) return { success: false, error: 'Spreadsheet not active' };

    const pos = this.parseCellRef(cellRef);
    if (!pos) return { success: false, error: `Invalid cell reference: ${cellRef}` };

    // Ensure formula starts with =
    if (!formula.startsWith('=')) {
      formula = '=' + formula;
    }

    try {
      await this.spreadsheetWindow.webContents.executeJavaScript(`
        window.setCellFormula('${sheetName}', ${pos.row}, ${pos.col}, ${JSON.stringify(formula)})
      `);

      if (this.currentFile) {
        this.currentFile.modified = true;
      }

      this.logActivity('set_formula', { sheet: sheetName, cell: cellRef, formula });
      return { success: true, cell: cellRef, formula };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Get formula from a cell
   */
  async getFormula(sheetName, cellRef) {
    if (!this.getIsActive()) return { success: false, error: 'Spreadsheet not active' };

    const pos = this.parseCellRef(cellRef);
    if (!pos) return { success: false, error: `Invalid cell reference: ${cellRef}` };

    try {
      const result = await this.spreadsheetWindow.webContents.executeJavaScript(`
        window.getCellFormula('${sheetName}', ${pos.row}, ${pos.col})
      `);

      return { success: true, formula: result, cell: cellRef };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ===========================================================================
  // Formatting
  // ===========================================================================

  /**
   * Format cells in a range
   */
  async formatCells(sheetName, rangeRef, format) {
    if (!this.getIsActive()) return { success: false, error: 'Spreadsheet not active' };

    const parts = rangeRef.split(':');
    const start = this.parseCellRef(parts[0]);
    const end = parts.length > 1 ? this.parseCellRef(parts[1]) : start;

    if (!start || !end) return { success: false, error: `Invalid range: ${rangeRef}` };

    try {
      await this.spreadsheetWindow.webContents.executeJavaScript(`
        window.formatCells('${sheetName}', ${start.row}, ${start.col}, ${end.row}, ${end.col}, ${JSON.stringify(format)})
      `);

      if (this.currentFile) {
        this.currentFile.modified = true;
      }

      this.logActivity('format_cells', { sheet: sheetName, range: rangeRef, format });
      return { success: true, range: rangeRef };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ===========================================================================
  // Sheet Management
  // ===========================================================================

  async getSheetNames() {
    if (!this.getIsActive()) return { success: false, error: 'Spreadsheet not active' };

    try {
      const result = await this.spreadsheetWindow.webContents.executeJavaScript(`
        window.getSheetNames()
      `);
      return { success: true, sheets: result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async addSheet(name) {
    if (!this.getIsActive()) return { success: false, error: 'Spreadsheet not active' };

    try {
      await this.spreadsheetWindow.webContents.executeJavaScript(`
        window.addSheet('${name}')
      `);

      if (this.currentFile) {
        this.currentFile.modified = true;
      }

      this.logActivity('add_sheet', { name });
      return { success: true, name };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async deleteSheet(name) {
    if (!this.getIsActive()) return { success: false, error: 'Spreadsheet not active' };

    try {
      await this.spreadsheetWindow.webContents.executeJavaScript(`
        window.deleteSheet('${name}')
      `);

      if (this.currentFile) {
        this.currentFile.modified = true;
      }

      this.logActivity('delete_sheet', { name });
      return { success: true, name };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async getSheetData(sheetName) {
    if (!this.getIsActive()) return { success: false, error: 'Spreadsheet not active' };

    try {
      const result = await this.spreadsheetWindow.webContents.executeJavaScript(`
        window.getSheetData('${sheetName}')
      `);
      return { success: true, data: result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ===========================================================================
  // File Operations
  // ===========================================================================

  async newSpreadsheet(name = 'Untitled') {
    if (!this.getIsActive()) {
      await this.create();
    }

    this.spreadsheetData = [{
      name: 'Sheet1',
      celldata: [],
      row: 100,
      column: 26,
      config: {}
    }];

    await this.setData(this.spreadsheetData);

    this.currentFile = { name, type: 'new', modified: false };
    this.logActivity('new_spreadsheet', { name });
    return { success: true, name };
  }

  async openFile(filePath) {
    if (!this.getIsActive()) {
      await this.create();
    }

    try {
      // Read file and convert to FortuneSheet format
      // This will be done via IPC to the main process which has xlsx access
      const result = await this.spreadsheetWindow.webContents.executeJavaScript(`
        window.openFile(${JSON.stringify(filePath)})
      `);

      if (result.success) {
        this.spreadsheetData = result.data;
        this.currentFile = {
          path: filePath,
          name: path.basename(filePath),
          type: 'local',
          modified: false
        };
        this.logActivity('open_file', { path: filePath });
      }

      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async saveFile(filePath = null) {
    if (!this.getIsActive()) return { success: false, error: 'Spreadsheet not active' };

    const savePath = filePath || this.currentFile?.path;
    if (!savePath) {
      return { success: false, error: 'No file path specified' };
    }

    try {
      await this.getData(); // Refresh data from renderer

      // Convert spreadsheet data to xlsx format and save in main process
      const XLSX = require('xlsx');

      // Create a new workbook
      const wb = XLSX.utils.book_new();

      // Process each sheet
      for (const sheetName of Object.keys(this.spreadsheetData)) {
        const sheetData = this.spreadsheetData[sheetName];

        // Convert our cell data to a 2D array for xlsx
        const rows = [];
        const maxRow = Math.max(...Object.keys(sheetData).map(k => parseInt(k.match(/\d+/)?.[0] || 0)));
        const maxCol = Math.max(...Object.keys(sheetData).map(k => {
          const col = k.match(/^[A-Z]+/)?.[0] || 'A';
          return col.split('').reduce((acc, c, i) => acc + (c.charCodeAt(0) - 64) * Math.pow(26, col.length - 1 - i), 0);
        }));

        for (let r = 1; r <= maxRow; r++) {
          const row = [];
          for (let c = 1; c <= maxCol; c++) {
            const colLetter = String.fromCharCode(64 + c);
            const cellRef = `${colLetter}${r}`;
            const cellData = sheetData[cellRef];

            if (cellData) {
              // If it has a formula, use formula; otherwise use value
              if (cellData.f) {
                row.push({ f: cellData.f, v: cellData.v });
              } else {
                row.push(cellData.v !== undefined ? cellData.v : '');
              }
            } else {
              row.push('');
            }
          }
          rows.push(row);
        }

        // Create worksheet from array
        const ws = XLSX.utils.aoa_to_sheet(rows);

        // Add formulas back to worksheet
        for (const [cellRef, cellData] of Object.entries(sheetData)) {
          if (cellData && cellData.f) {
            if (!ws[cellRef]) ws[cellRef] = {};
            ws[cellRef].f = cellData.f;
          }
        }

        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }

      // Determine format from file extension
      const ext = path.extname(savePath).toLowerCase();
      const bookType = ext === '.csv' ? 'csv' : 'xlsx';

      // Write the file
      XLSX.writeFile(wb, savePath, { bookType });

      this.currentFile = {
        path: savePath,
        name: path.basename(savePath),
        type: 'local',
        modified: false
      };
      this.logActivity('save_file', { path: savePath });

      return { success: true, message: `Saved to ${savePath}` };
    } catch (e) {
      console.error('[Spreadsheet] Save error:', e);
      return { success: false, error: e.message };
    }
  }

  async exportAs(format, filePath) {
    if (!this.getIsActive()) return { success: false, error: 'Spreadsheet not active' };

    try {
      await this.getData();

      const result = await this.spreadsheetWindow.webContents.executeJavaScript(`
        window.exportAs(${JSON.stringify(format)}, ${JSON.stringify(filePath)}, ${JSON.stringify(this.spreadsheetData)})
      `);

      if (result.success) {
        this.logActivity('export', { format, path: filePath });
      }

      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ===========================================================================
  // Status
  // ===========================================================================

  getStatus() {
    return {
      active: this.getIsActive(),
      windowId: this.getWindowId(),
      isMinimized: this.isMinimized,
      file: this.currentFile,
      sheetCount: this.spreadsheetData?.length || 0,
      sessionId: this.currentSessionId
    };
  }

  /**
   * Get detailed status with data summary for AI context
   * This gives the AI enough info to understand what's in the spreadsheet
   */
  async getDetailedStatus() {
    if (!this.getIsActive()) {
      return { active: false };
    }

    try {
      // Get sheet data summary from the renderer
      const summary = await this.spreadsheetWindow.webContents.executeJavaScript(`
        (function() {
          const data = window.getSpreadsheetData ? window.getSpreadsheetData() : [];
          const sheets = [];

          for (const sheet of data) {
            const sheetInfo = {
              name: sheet.name,
              rowCount: 0,
              colCount: 0,
              headers: [],
              sampleData: [],
              hasFormulas: false
            };

            if (sheet.celldata && sheet.celldata.length > 0) {
              // Find bounds
              let maxRow = 0, maxCol = 0;
              const headerRow = [];
              const formulas = [];

              for (const cell of sheet.celldata) {
                if (cell.r > maxRow) maxRow = cell.r;
                if (cell.c > maxCol) maxCol = cell.c;

                // Get header row (row 0)
                if (cell.r === 0) {
                  const val = cell.v?.v ?? cell.v ?? '';
                  headerRow[cell.c] = String(val);
                }

                // Check for formulas
                if (cell.v?.f) {
                  sheetInfo.hasFormulas = true;
                }
              }

              sheetInfo.rowCount = maxRow + 1;
              sheetInfo.colCount = maxCol + 1;
              sheetInfo.headers = headerRow.filter(h => h); // Remove empty

              // Get sample data from first few rows (excluding header)
              for (let r = 1; r <= Math.min(3, maxRow); r++) {
                const rowData = [];
                for (let c = 0; c <= Math.min(5, maxCol); c++) {
                  const cell = sheet.celldata.find(cd => cd.r === r && cd.c === c);
                  const val = cell?.v?.v ?? cell?.v ?? '';
                  rowData.push(String(val).substring(0, 30)); // Truncate long values
                }
                sheetInfo.sampleData.push(rowData);
              }
            }

            sheets.push(sheetInfo);
          }

          return sheets;
        })()
      `);

      return {
        active: true,
        windowId: this.getWindowId(),
        isMinimized: this.isMinimized,
        file: this.currentFile,
        sessionId: this.currentSessionId,
        sheets: summary
      };
    } catch (e) {
      console.error('[Spreadsheet] Error getting detailed status:', e);
      return {
        active: true,
        windowId: this.getWindowId(),
        isMinimized: this.isMinimized,
        file: this.currentFile,
        sessionId: this.currentSessionId,
        error: e.message
      };
    }
  }

  getCurrentFile() {
    return this.currentFile;
  }

  // ===========================================================================
  // Undo/Redo Operations
  // ===========================================================================

  /**
   * Undo the last operation
   */
  async undo() {
    if (!this.getIsActive()) return { success: false, error: 'Spreadsheet not active' };

    try {
      const result = await this.spreadsheetWindow.webContents.executeJavaScript(`
        window.undo ? window.undo() : { success: false, error: 'Undo not available' }
      `);

      if (result.success) {
        this.logActivity('undo', { actionType: result.actionType });
      }
      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Redo the last undone operation
   */
  async redo() {
    if (!this.getIsActive()) return { success: false, error: 'Spreadsheet not active' };

    try {
      const result = await this.spreadsheetWindow.webContents.executeJavaScript(`
        window.redo ? window.redo() : { success: false, error: 'Redo not available' }
      `);

      if (result.success) {
        this.logActivity('redo', { actionType: result.actionType });
      }
      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Get undo/redo stack status
   */
  async getUndoRedoStatus() {
    if (!this.getIsActive()) return { success: false, error: 'Spreadsheet not active' };

    try {
      const result = await this.spreadsheetWindow.webContents.executeJavaScript(`
        window.getUndoRedoStatus ? window.getUndoRedoStatus() : { canUndo: false, canRedo: false, undoCount: 0, redoCount: 0 }
      `);
      return { success: true, ...result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ===========================================================================
  // Row/Column Operations
  // ===========================================================================

  /**
   * Delete rows from the spreadsheet
   */
  async deleteRows(startRow, count = 1) {
    if (!this.getIsActive()) return { success: false, error: 'Spreadsheet not active' };

    try {
      const result = await this.spreadsheetWindow.webContents.executeJavaScript(`
        window.deleteRows ? window.deleteRows(${startRow}, ${count}) : { success: false, error: 'Delete rows not available' }
      `);

      if (result.success) {
        if (this.currentFile) this.currentFile.modified = true;
        this.logActivity('delete_rows', { startRow, count });
      }
      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Insert rows into the spreadsheet
   */
  async insertRows(atRow, count = 1) {
    if (!this.getIsActive()) return { success: false, error: 'Spreadsheet not active' };

    try {
      const result = await this.spreadsheetWindow.webContents.executeJavaScript(`
        window.insertRows ? window.insertRows(${atRow}, ${count}) : { success: false, error: 'Insert rows not available' }
      `);

      if (result.success) {
        if (this.currentFile) this.currentFile.modified = true;
        this.logActivity('insert_rows', { atRow, count });
      }
      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Delete columns from the spreadsheet
   */
  async deleteColumns(startCol, count = 1) {
    if (!this.getIsActive()) return { success: false, error: 'Spreadsheet not active' };

    try {
      const result = await this.spreadsheetWindow.webContents.executeJavaScript(`
        window.deleteColumns ? window.deleteColumns(${startCol}, ${count}) : { success: false, error: 'Delete columns not available' }
      `);

      if (result.success) {
        if (this.currentFile) this.currentFile.modified = true;
        this.logActivity('delete_columns', { startCol, count });
      }
      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Insert columns into the spreadsheet
   */
  async insertColumns(atCol, count = 1) {
    if (!this.getIsActive()) return { success: false, error: 'Spreadsheet not active' };

    try {
      const result = await this.spreadsheetWindow.webContents.executeJavaScript(`
        window.insertColumns ? window.insertColumns(${atCol}, ${count}) : { success: false, error: 'Insert columns not available' }
      `);

      if (result.success) {
        if (this.currentFile) this.currentFile.modified = true;
        this.logActivity('insert_columns', { atCol, count });
      }
      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Clear cells in a range (without deleting rows/columns)
   */
  async clearCells(startRow, startCol, endRow, endCol) {
    if (!this.getIsActive()) return { success: false, error: 'Spreadsheet not active' };

    try {
      const result = await this.spreadsheetWindow.webContents.executeJavaScript(`
        window.clearCells ? window.clearCells(${startRow}, ${startCol}, ${endRow}, ${endCol}) : { success: false, error: 'Clear cells not available' }
      `);

      if (result.success) {
        if (this.currentFile) this.currentFile.modified = true;
        this.logActivity('clear_cells', { startRow, startCol, endRow, endCol });
      }
      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ===========================================================================
  // Enhanced Status for AI
  // ===========================================================================

  /**
   * Get enhanced status with detailed information for AI context
   */
  async getEnhancedStatus() {
    if (!this.getIsActive()) {
      return { success: false, error: 'Spreadsheet not active', active: false };
    }

    try {
      const result = await this.spreadsheetWindow.webContents.executeJavaScript(`
        window.getEnhancedStatus ? window.getEnhancedStatus() : null
      `);

      if (result) {
        return {
          success: true,
          active: true,
          file: this.currentFile,
          sessionId: this.currentSessionId,
          ...result
        };
      }

      // Fallback to basic status
      return {
        success: true,
        active: true,
        file: this.currentFile,
        sessionId: this.currentSessionId
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async getFormulaDebug() {
    if (!this.getIsActive()) return { success: false, error: 'Spreadsheet not active' };

    try {
      const result = await this.spreadsheetWindow.webContents.executeJavaScript(`
        window._formulaDebug || window._lastFormulaError || null
      `);
      return { success: true, debug: result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ===========================================================================
  // Chart Operations
  // ===========================================================================

  /**
   * Insert a chart into the spreadsheet
   */
  async insertChart(type, dataRange, title, showLegend = true) {
    if (!this.getIsActive()) {
      return { success: false, error: 'Spreadsheet not active' };
    }

    try {
      const result = await this.spreadsheetWindow.webContents.executeJavaScript(`
        (function() {
          // Set up chart config
          currentChartType = '${type}';
          document.getElementById('chart-data-range').value = '${dataRange}';
          document.getElementById('chart-title').value = '${title}';
          document.getElementById('chart-legend').checked = ${showLegend};

          // Call insertChart
          insertChart();

          return { success: true, chartId: embeddedCharts[embeddedCharts.length - 1]?.id };
        })()
      `);
      this.logActivity('insert_chart', { type, dataRange, title, showLegend, ...result });
      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Remove a chart from the spreadsheet
   */
  async removeChart(chartId) {
    if (!this.getIsActive()) {
      return { success: false, error: 'Spreadsheet not active' };
    }

    try {
      await this.spreadsheetWindow.webContents.executeJavaScript(`
        window.removeChart('${chartId}')
      `);
      this.logActivity('remove_chart', { chartId });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Get list of charts in the spreadsheet
   */
  async getCharts() {
    if (!this.getIsActive()) {
      return { success: false, error: 'Spreadsheet not active' };
    }

    try {
      const charts = await this.spreadsheetWindow.webContents.executeJavaScript(`
        embeddedCharts || []
      `);
      return { success: true, charts };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ===========================================================================
  // Sort/Filter Operations
  // ===========================================================================

  /**
   * Sort a column in the spreadsheet
   */
  async sortColumn(column, direction = 'asc') {
    if (!this.getIsActive()) {
      return { success: false, error: 'Spreadsheet not active' };
    }

    try {
      const result = await this.spreadsheetWindow.webContents.executeJavaScript(`
        window.sortColumn(${column}, '${direction}')
      `);
      this.logActivity('sort', { column, direction });
      return result || { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Filter a column by value
   */
  async filterColumn(column, value) {
    if (!this.getIsActive()) {
      return { success: false, error: 'Spreadsheet not active' };
    }

    try {
      const result = await this.spreadsheetWindow.webContents.executeJavaScript(`
        (function() {
          window.applyFilter(${column}, '${value.replace(/'/g, "\\'")}');
          // Count visible rows
          const rows = document.querySelectorAll('#simple-grid tbody tr');
          let count = 0;
          rows.forEach(row => {
            if (row.style.display !== 'none') count++;
          });
          return { matchCount: count };
        })()
      `);
      this.logActivity('filter', { column, value, ...result });
      return { success: true, ...result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Clear all filters
   */
  async clearFilter() {
    if (!this.getIsActive()) {
      return { success: false, error: 'Spreadsheet not active' };
    }

    try {
      await this.spreadsheetWindow.webContents.executeJavaScript(`
        window.clearAllFilters()
      `);
      this.logActivity('clear_filter', {});
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ===========================================================================
  // Find/Replace Operations
  // ===========================================================================

  /**
   * Find text in the spreadsheet
   */
  async findText(searchTerm, caseSensitive = false, wholeCell = false) {
    if (!this.getIsActive()) {
      return { success: false, error: 'Spreadsheet not active' };
    }

    try {
      const result = await this.spreadsheetWindow.webContents.executeJavaScript(`
        (function() {
          window.performFind('${searchTerm.replace(/'/g, "\\'")}', ${caseSensitive}, ${wholeCell});
          return {
            count: window.findResults.length,
            matches: window.findResults.map(r => String.fromCharCode(65 + r.col) + (r.row + 1))
          };
        })()
      `);
      this.logActivity('find', { searchTerm, ...result });
      return { success: true, ...result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Replace current found text
   */
  async replaceText(replaceWith) {
    if (!this.getIsActive()) {
      return { success: false, error: 'Spreadsheet not active' };
    }

    try {
      await this.spreadsheetWindow.webContents.executeJavaScript(`
        (function() {
          const replaceInput = document.getElementById('replace-input');
          if (replaceInput) replaceInput.value = '${replaceWith.replace(/'/g, "\\'")}';
          window.replaceOne();
        })()
      `);
      this.logActivity('replace', { replaceWith });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Replace all occurrences
   */
  async replaceAll(searchTerm, replaceWith, caseSensitive = false, wholeCell = false) {
    if (!this.getIsActive()) {
      return { success: false, error: 'Spreadsheet not active' };
    }

    try {
      const result = await this.spreadsheetWindow.webContents.executeJavaScript(`
        (function() {
          // Call replaceAll directly with parameters
          const result = window.replaceAll(
            '${searchTerm.replace(/'/g, "\\'")}',
            '${replaceWith.replace(/'/g, "\\'")}',
            ${caseSensitive},
            ${wholeCell}
          );
          return { replacedCount: result ? result.count : 0 };
        })()
      `);
      this.logActivity('replace_all', { searchTerm, replaceWith, ...result });
      return { success: true, ...result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}

// Singleton instance
const spreadsheetManager = new SpreadsheetManager();

module.exports = {
  spreadsheetManager,
  SpreadsheetManager
};
