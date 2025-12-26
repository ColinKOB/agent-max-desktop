/**
 * Spreadsheet Preload Script
 *
 * Exposes spreadsheet APIs to the renderer process (FortuneSheet window)
 * via contextBridge for secure IPC communication.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose spreadsheet API to the renderer
contextBridge.exposeInMainWorld('spreadsheetAPI', {
  // =========================================================================
  // Data Operations
  // =========================================================================

  /**
   * Get the current spreadsheet data
   */
  getData: () => ipcRenderer.invoke('spreadsheet:get-data'),

  /**
   * Set the spreadsheet data
   */
  setData: (data) => ipcRenderer.invoke('spreadsheet:set-data', data),

  // =========================================================================
  // Cell Operations
  // =========================================================================

  /**
   * Get a cell value
   */
  getCellValue: (sheet, row, col) =>
    ipcRenderer.invoke('spreadsheet:get-cell', { sheet, row, col }),

  /**
   * Set a cell value
   */
  setCellValue: (sheet, row, col, value) =>
    ipcRenderer.invoke('spreadsheet:set-cell', { sheet, row, col, value }),

  /**
   * Get range values
   */
  getRangeValues: (sheet, startRow, startCol, endRow, endCol) =>
    ipcRenderer.invoke('spreadsheet:get-range', { sheet, startRow, startCol, endRow, endCol }),

  /**
   * Set range values
   */
  setRangeValues: (sheet, startRow, startCol, data) =>
    ipcRenderer.invoke('spreadsheet:set-range', { sheet, startRow, startCol, data }),

  // =========================================================================
  // Formula Operations
  // =========================================================================

  /**
   * Set a formula in a cell
   */
  setCellFormula: (sheet, row, col, formula) =>
    ipcRenderer.invoke('spreadsheet:set-formula', { sheet, row, col, formula }),

  /**
   * Get formula from a cell
   */
  getCellFormula: (sheet, row, col) =>
    ipcRenderer.invoke('spreadsheet:get-formula', { sheet, row, col }),

  // =========================================================================
  // Formatting
  // =========================================================================

  /**
   * Format cells in a range
   */
  formatCells: (sheet, startRow, startCol, endRow, endCol, format) =>
    ipcRenderer.invoke('spreadsheet:format-cells', {
      sheet, startRow, startCol, endRow, endCol, format
    }),

  // =========================================================================
  // Sheet Management
  // =========================================================================

  /**
   * Get all sheet names
   */
  getSheetNames: () => ipcRenderer.invoke('spreadsheet:get-sheets'),

  /**
   * Add a new sheet
   */
  addSheet: (name) => ipcRenderer.invoke('spreadsheet:add-sheet', { name }),

  /**
   * Delete a sheet
   */
  deleteSheet: (name) => ipcRenderer.invoke('spreadsheet:delete-sheet', { name }),

  /**
   * Get data for a specific sheet
   */
  getSheetData: (sheet) => ipcRenderer.invoke('spreadsheet:get-sheet-data', { sheet }),

  // =========================================================================
  // File Operations
  // =========================================================================

  /**
   * Open a file (xlsx/csv)
   */
  openFile: (filePath) => ipcRenderer.invoke('spreadsheet:open-file', { filePath }),

  /**
   * Save to a file
   */
  saveFile: (filePath, data) =>
    ipcRenderer.invoke('spreadsheet:save-file', { filePath, data }),

  /**
   * Export to a format
   */
  exportAs: (format, filePath, data) =>
    ipcRenderer.invoke('spreadsheet:export', { format, filePath, data }),

  // =========================================================================
  // Event Listeners
  // =========================================================================

  /**
   * Listen for file loaded event
   */
  onFileLoaded: (callback) => {
    ipcRenderer.on('spreadsheet:file-loaded', (event, data) => callback(data));
  },

  /**
   * Listen for file saved event
   */
  onFileSaved: (callback) => {
    ipcRenderer.on('spreadsheet:file-saved', (event, data) => callback(data));
  },

  /**
   * Listen for sync status changes
   */
  onSyncStatus: (callback) => {
    ipcRenderer.on('spreadsheet:sync-status', (event, status) => callback(status));
  },

  /**
   * Listen for data update from main process
   */
  onDataUpdate: (callback) => {
    ipcRenderer.on('spreadsheet:data-update', (event, data) => callback(data));
  },

  /**
   * Remove event listeners
   */
  removeListener: (channel) => {
    ipcRenderer.removeAllListeners(`spreadsheet:${channel}`);
  }
});

// Expose node info for debugging
contextBridge.exposeInMainWorld('nodeInfo', {
  platform: process.platform,
  version: process.version
});

console.log('[SpreadsheetPreload] APIs exposed to renderer');
