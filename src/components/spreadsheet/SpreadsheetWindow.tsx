/**
 * SpreadsheetWindow - FortuneSheet React wrapper component
 *
 * This component wraps FortuneSheet for use in the main renderer process.
 * It handles IPC communication with the main process for data sync.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';

// FortuneSheet types
interface CellData {
  r: number;
  c: number;
  v: {
    v?: string | number | boolean | null;
    m?: string;
    ct?: { fa?: string; t?: string };
    f?: string;
    bg?: string;
    fc?: string;
    bl?: number;
    it?: number;
    fs?: number;
    ff?: string;
  } | string | number | null;
}

interface SheetData {
  name: string;
  index: number;
  order: number;
  status?: number;
  celldata: CellData[];
  row?: number;
  column?: number;
  config?: Record<string, unknown>;
}

interface SpreadsheetWindowProps {
  /** Initial data to load */
  initialData?: SheetData[];
  /** Called when data changes */
  onDataChange?: (data: SheetData[]) => void;
  /** Called when a cell is edited */
  onCellEdit?: (sheet: string, row: number, col: number, value: unknown) => void;
  /** Read-only mode */
  readOnly?: boolean;
}

// Declare the window API types
declare global {
  interface Window {
    spreadsheetAPI?: {
      getData: () => Promise<SheetData[]>;
      setData: (data: SheetData[]) => Promise<{ success: boolean }>;
      getCellValue: (sheet: string, row: number, col: number) => Promise<unknown>;
      setCellValue: (sheet: string, row: number, col: number, value: unknown) => Promise<{ success: boolean }>;
      onDataUpdate: (callback: (data: SheetData[]) => void) => void;
      removeListener: (channel: string) => void;
    };
  }
}

export function SpreadsheetWindow({
  initialData,
  onDataChange,
  onCellEdit,
  readOnly = false,
}: SpreadsheetWindowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<SheetData[]>(initialData || []);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial data from main process
  useEffect(() => {
    const loadData = async () => {
      try {
        if (window.spreadsheetAPI) {
          const sheetData = await window.spreadsheetAPI.getData();
          if (sheetData) {
            setData(sheetData);
          }
        } else if (initialData) {
          setData(initialData);
        }
        setIsLoading(false);
      } catch (err) {
        console.error('[SpreadsheetWindow] Failed to load data:', err);
        setError('Failed to load spreadsheet data');
        setIsLoading(false);
      }
    };

    loadData();
  }, [initialData]);

  // Listen for data updates from main process
  useEffect(() => {
    if (window.spreadsheetAPI) {
      window.spreadsheetAPI.onDataUpdate((newData) => {
        setData(newData);
        onDataChange?.(newData);
      });

      return () => {
        window.spreadsheetAPI?.removeListener('data-update');
      };
    }
  }, [onDataChange]);

  // Handle cell value change
  const handleCellChange = useCallback(
    async (sheet: string, row: number, col: number, value: unknown) => {
      try {
        if (window.spreadsheetAPI) {
          await window.spreadsheetAPI.setCellValue(sheet, row, col, value);
        }
        onCellEdit?.(sheet, row, col, value);
      } catch (err) {
        console.error('[SpreadsheetWindow] Cell change error:', err);
      }
    },
    [onCellEdit]
  );

  // Get sheet names
  const getSheetNames = useCallback(() => {
    return data.map((sheet) => sheet.name);
  }, [data]);

  if (isLoading) {
    return (
      <div className="spreadsheet-window loading">
        <div className="loading-spinner" />
        <span>Loading spreadsheet...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="spreadsheet-window error">
        <span className="error-icon">⚠️</span>
        <span>{error}</span>
      </div>
    );
  }

  // For now, render a placeholder since FortuneSheet requires bundling
  // In production, this would import and render the FortuneSheet component
  return (
    <div ref={containerRef} className="spreadsheet-window">
      <div className="spreadsheet-placeholder">
        <div className="placeholder-header">
          <span className="placeholder-icon">📊</span>
          <span className="placeholder-title">Max's Spreadsheet</span>
        </div>
        <div className="placeholder-info">
          <p>Sheets: {getSheetNames().join(', ') || 'None'}</p>
          <p>Mode: {readOnly ? 'Read-only' : 'Editable'}</p>
        </div>
        <div className="placeholder-note">
          The spreadsheet is rendered in a separate Electron window.
          <br />
          Use the PiP viewer to see the AI working.
        </div>
      </div>

      <style>{`
        .spreadsheet-window {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #1a1a2e;
          color: #e0e0e0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .spreadsheet-window.loading {
          flex-direction: column;
          gap: 16px;
        }

        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #3a3a5c;
          border-top-color: #4ade80;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .spreadsheet-window.error {
          flex-direction: column;
          gap: 8px;
          color: #ef4444;
        }

        .error-icon {
          font-size: 32px;
        }

        .spreadsheet-placeholder {
          text-align: center;
          padding: 32px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          max-width: 400px;
        }

        .placeholder-header {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 24px;
        }

        .placeholder-icon {
          font-size: 32px;
        }

        .placeholder-title {
          font-size: 24px;
          font-weight: 600;
          color: #4ade80;
        }

        .placeholder-info {
          margin-bottom: 24px;
          color: #aaa;
        }

        .placeholder-info p {
          margin: 8px 0;
        }

        .placeholder-note {
          font-size: 13px;
          color: #888;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}

export default SpreadsheetWindow;
