/**
 * Spreadsheet Storage Service
 *
 * Handles local file operations for spreadsheets (xlsx, csv).
 * Uses the xlsx library for reading/writing Excel files.
 */

import * as XLSX from 'xlsx';

/**
 * Convert column index to letter (0 = A, 1 = B, etc.)
 */
function columnToLetter(col) {
  let letter = '';
  let temp = col;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Convert column letter to index (A = 0, B = 1, etc.)
 */
function letterToColumn(letter) {
  let col = 0;
  for (let i = 0; i < letter.length; i++) {
    col = col * 26 + (letter.charCodeAt(i) - 64);
  }
  return col - 1;
}

/**
 * Parse cell reference (e.g., "A1" -> {col: 0, row: 0})
 */
function parseCellRef(ref) {
  const match = ref.match(/^([A-Z]+)(\d+)$/i);
  if (!match) return null;
  return {
    col: letterToColumn(match[1].toUpperCase()),
    row: parseInt(match[2], 10) - 1,
  };
}

/**
 * Convert xlsx workbook to FortuneSheet data format
 */
function xlsxToFortuneSheet(workbook) {
  const sheets = [];

  workbook.SheetNames.forEach((sheetName, index) => {
    const worksheet = workbook.Sheets[sheetName];
    const celldata = [];

    // Get the range of the worksheet
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

    // Iterate through cells
    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = worksheet[cellAddress];

        if (cell) {
          const cellValue = {
            r: row,
            c: col,
            v: {
              v: cell.v, // raw value
              m: cell.w || String(cell.v || ''), // formatted text
              ct: { fa: 'General', t: cell.t === 'n' ? 'n' : 's' }, // cell type
            },
          };

          // Handle formulas
          if (cell.f) {
            cellValue.v.f = '=' + cell.f;
          }

          // Handle number formatting
          if (cell.z) {
            cellValue.v.ct.fa = cell.z;
          }

          celldata.push(cellValue);
        }
      }
    }

    sheets.push({
      name: sheetName,
      index: index,
      order: index,
      status: 1,
      celldata: celldata,
      row: Math.max(100, range.e.r + 20),
      column: Math.max(26, range.e.c + 5),
      config: {
        merge: worksheet['!merges'] || {},
        columnlen: {},
        rowlen: {},
      },
    });
  });

  return sheets;
}

/**
 * Convert FortuneSheet data to xlsx workbook
 */
function fortuneSheetToXlsx(sheets) {
  const workbook = XLSX.utils.book_new();

  sheets.forEach((sheet) => {
    // Create worksheet data array
    const data = [];
    let maxRow = 0;
    let maxCol = 0;

    // Find dimensions and collect cell data
    sheet.celldata.forEach((cell) => {
      if (cell.r > maxRow) maxRow = cell.r;
      if (cell.c > maxCol) maxCol = cell.c;
    });

    // Initialize empty array
    for (let r = 0; r <= maxRow; r++) {
      data[r] = [];
      for (let c = 0; c <= maxCol; c++) {
        data[r][c] = null;
      }
    }

    // Fill in cell values
    sheet.celldata.forEach((cell) => {
      if (cell.v) {
        if (typeof cell.v === 'object') {
          // Check if it's a formula
          if (cell.v.f) {
            data[cell.r][cell.c] = { f: cell.v.f.replace(/^=/, ''), t: 'n' };
          } else {
            data[cell.r][cell.c] = cell.v.v;
          }
        } else {
          data[cell.r][cell.c] = cell.v;
        }
      }
    });

    // Create worksheet from array
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Apply formulas manually
    sheet.celldata.forEach((cell) => {
      if (cell.v && typeof cell.v === 'object' && cell.v.f) {
        const addr = XLSX.utils.encode_cell({ r: cell.r, c: cell.c });
        worksheet[addr] = {
          t: 'n',
          f: cell.v.f.replace(/^=/, ''),
          v: cell.v.v || 0,
        };
      }
    });

    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  });

  return workbook;
}

/**
 * Read a spreadsheet file (xlsx, xls, csv)
 * @param {string} filePath - Path to the file
 * @returns {Promise<{success: boolean, data?: object[], error?: string}>}
 */
export async function readSpreadsheetFile(filePath) {
  try {
    // Read the file
    const workbook = XLSX.readFile(filePath, {
      cellFormula: true,
      cellStyles: true,
      cellDates: true,
    });

    // Convert to FortuneSheet format
    const data = xlsxToFortuneSheet(workbook);

    return {
      success: true,
      data,
      fileName: filePath.split('/').pop() || filePath.split('\\').pop(),
      sheetCount: data.length,
    };
  } catch (error) {
    console.error('[SpreadsheetStorage] Read error:', error);
    return {
      success: false,
      error: error.message || 'Failed to read file',
    };
  }
}

/**
 * Save spreadsheet data to a file
 * @param {object[]} data - FortuneSheet data
 * @param {string} filePath - Path to save to
 * @param {string} format - File format ('xlsx', 'csv', 'xls')
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function saveSpreadsheetFile(data, filePath, format = 'xlsx') {
  try {
    // Convert to xlsx workbook
    const workbook = fortuneSheetToXlsx(data);

    // Determine book type
    const bookType = format === 'csv' ? 'csv' : format === 'xls' ? 'biff8' : 'xlsx';

    // Write the file
    XLSX.writeFile(workbook, filePath, { bookType });

    return {
      success: true,
      filePath,
      format,
    };
  } catch (error) {
    console.error('[SpreadsheetStorage] Save error:', error);
    return {
      success: false,
      error: error.message || 'Failed to save file',
    };
  }
}

/**
 * Export spreadsheet to different formats
 * @param {object[]} data - FortuneSheet data
 * @param {string} format - Export format ('xlsx', 'csv', 'json', 'html')
 * @param {string} filePath - Path to export to
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function exportSpreadsheet(data, format, filePath) {
  try {
    const workbook = fortuneSheetToXlsx(data);

    switch (format.toLowerCase()) {
      case 'xlsx':
        XLSX.writeFile(workbook, filePath, { bookType: 'xlsx' });
        break;

      case 'csv':
        XLSX.writeFile(workbook, filePath, { bookType: 'csv' });
        break;

      case 'json':
        const jsonData = data.map((sheet) => ({
          name: sheet.name,
          cells: sheet.celldata.map((cell) => ({
            row: cell.r,
            col: cell.c,
            value: typeof cell.v === 'object' ? cell.v.v : cell.v,
            formula: typeof cell.v === 'object' ? cell.v.f : undefined,
          })),
        }));
        const fs = await import('fs');
        fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));
        break;

      case 'html':
        const html = XLSX.utils.sheet_to_html(workbook.Sheets[workbook.SheetNames[0]]);
        const fsHtml = await import('fs');
        fsHtml.writeFileSync(filePath, html);
        break;

      default:
        return { success: false, error: `Unsupported format: ${format}` };
    }

    return {
      success: true,
      filePath,
      format,
    };
  } catch (error) {
    console.error('[SpreadsheetStorage] Export error:', error);
    return {
      success: false,
      error: error.message || 'Failed to export file',
    };
  }
}

/**
 * Create a new empty spreadsheet data structure
 * @param {string} name - Name for the first sheet
 * @returns {object[]} FortuneSheet data structure
 */
export function createEmptySpreadsheet(name = 'Sheet1') {
  return [
    {
      name: name,
      index: 0,
      order: 0,
      status: 1,
      celldata: [],
      row: 100,
      column: 26,
      config: {
        merge: {},
        columnlen: {},
        rowlen: {},
      },
    },
  ];
}

/**
 * Parse CSV text to FortuneSheet format
 * @param {string} csvText - CSV content
 * @param {string} sheetName - Name for the sheet
 * @returns {object[]} FortuneSheet data structure
 */
export function parseCSV(csvText, sheetName = 'Sheet1') {
  const workbook = XLSX.read(csvText, { type: 'string' });
  return xlsxToFortuneSheet(workbook);
}

/**
 * Get file info without fully loading
 * @param {string} filePath - Path to the file
 * @returns {Promise<{success: boolean, info?: object, error?: string}>}
 */
export async function getFileInfo(filePath) {
  try {
    const workbook = XLSX.readFile(filePath, {
      sheetStubs: true,
      bookSheets: true,
    });

    return {
      success: true,
      info: {
        fileName: filePath.split('/').pop() || filePath.split('\\').pop(),
        sheetNames: workbook.SheetNames,
        sheetCount: workbook.SheetNames.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to read file info',
    };
  }
}

export default {
  readSpreadsheetFile,
  saveSpreadsheetFile,
  exportSpreadsheet,
  createEmptySpreadsheet,
  parseCSV,
  getFileInfo,
  columnToLetter,
  letterToColumn,
  parseCellRef,
};
