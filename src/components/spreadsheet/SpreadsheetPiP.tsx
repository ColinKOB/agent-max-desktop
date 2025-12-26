/**
 * SpreadsheetPiP - Picture-in-Picture viewer for AI Spreadsheet
 *
 * Displays a floating window showing the AI's spreadsheet workspace.
 * The user can watch what the AI is doing with their data.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import './SpreadsheetPiP.css';

interface SpreadsheetPiPProps {
  /** Whether the PiP window should be visible */
  isVisible?: boolean;
  /** Called when user closes the PiP window (ends session) */
  onClose?: () => void;
  /** Called when user minimizes the PiP window */
  onMinimize?: () => void;
  /** Target frame rate (default: 5 fps) */
  fps?: number;
  /** Initial width of the PiP window */
  initialWidth?: number;
  /** Initial height of the PiP window */
  initialHeight?: number;
}

interface Position {
  x: number;
  y: number;
}

interface SpreadsheetStatus {
  active: boolean;
  windowId: number;
  isMinimized: boolean;
  file: {
    name: string;
    path?: string;
    type: string;
    modified: boolean;
  } | null;
  sheetCount: number;
  sessionId: string | null;
}

export function SpreadsheetPiP({
  isVisible = true,
  onClose,
  onMinimize,
  fps = 5,
  initialWidth = 560,
  initialHeight = 380,
}: SpreadsheetPiPProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('Untitled');
  const [isModified, setIsModified] = useState(false);
  const [sheetCount, setSheetCount] = useState(0);

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 20, y: 80 });
  const dragOffset = useRef<Position>({ x: 0, y: 0 });

  // Resizing state
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [isResizing, setIsResizing] = useState(false);

  // Check spreadsheet status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch('http://127.0.0.1:3848/spreadsheet/status');
        if (response.ok) {
          const status: SpreadsheetStatus = await response.json();
          setIsActive(status.active);
          setFileName(status.file?.name ?? 'Untitled');
          setIsModified(status.file?.modified ?? false);
          setSheetCount(status.sheetCount);
        }
      } catch (err) {
        // API not available
        setIsActive(false);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  // Frame capture loop
  useEffect(() => {
    if (!isActive || isPaused || !isVisible) return;

    let animationId: number;
    let lastFrameTime = 0;
    const frameInterval = 1000 / fps;

    const captureFrame = async (timestamp: number) => {
      if (timestamp - lastFrameTime < frameInterval) {
        animationId = requestAnimationFrame(captureFrame);
        return;
      }
      lastFrameTime = timestamp;

      try {
        const response = await fetch('http://127.0.0.1:3848/spreadsheet/capture-frame', {
          method: 'POST'
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.frame && canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
              const img = new Image();
              img.onload = () => {
                ctx.drawImage(img, 0, 0, canvasRef.current!.width, canvasRef.current!.height);
                setFrameCount((prev) => prev + 1);
                setError(null);
              };
              img.onerror = () => {
                setError('Failed to decode frame');
              };
              img.src = data.frame.startsWith('data:') ? data.frame : `data:image/png;base64,${data.frame}`;
            }
          }
        }
      } catch (err) {
        console.error('[SpreadsheetPiP] Frame capture error:', err);
        setError('Frame capture failed');
      }

      animationId = requestAnimationFrame(captureFrame);
    };

    animationId = requestAnimationFrame(captureFrame);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isActive, isPaused, isVisible, fps]);

  // Dragging handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('.pip-controls')) return;
      if (isResizing) return;

      setIsDragging(true);
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
    },
    [position, isResizing]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.current.x,
          y: e.clientY - dragOffset.current.y,
        });
      }
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  // Resize handler
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;
    const aspectRatio = 16 / 10;

    const handleResize = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(320, Math.min(960, startWidth + deltaX));
      const newHeight = newWidth / aspectRatio;
      setSize({ width: newWidth, height: newHeight });
    };

    const handleResizeEnd = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', handleResize);
      window.removeEventListener('mouseup', handleResizeEnd);
    };

    window.addEventListener('mousemove', handleResize);
    window.addEventListener('mouseup', handleResizeEnd);
  }, [size]);

  // Global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Handle close (ends session completely)
  const handleClose = useCallback(async () => {
    try {
      await fetch('http://127.0.0.1:3848/spreadsheet/destroy', { method: 'POST' });
    } catch (err) {
      console.error('[SpreadsheetPiP] Failed to destroy:', err);
    }
    onClose?.();
  }, [onClose]);

  // Handle minimize
  const handleMinimize = useCallback(async () => {
    try {
      await fetch('http://127.0.0.1:3848/spreadsheet/minimize', { method: 'POST' });
    } catch (err) {
      console.error('[SpreadsheetPiP] Failed to minimize:', err);
    }
    onMinimize?.();
  }, [onMinimize]);

  // Toggle pause
  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  if (!isVisible) return null;

  return (
    <div
      ref={containerRef}
      className={`spreadsheet-pip ${isDragging ? 'dragging' : ''}`}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height + 60, // Add header + file bar height
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header - Max's Spreadsheet Branding */}
      <div className="pip-header">
        <div className="pip-title">
          <span className="pip-icon">📊</span>
          <span className="pip-brand-name">Max's Spreadsheet</span>
          <span className={`pip-status ${isActive ? 'active' : 'inactive'}`} />
          {isActive && <span className="pip-working-text">Working...</span>}
        </div>
        <div className="pip-controls">
          <button
            className="pip-btn"
            onClick={togglePause}
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? '▶' : '⏸'}
          </button>
          <button
            className="pip-btn pip-minimize"
            onClick={handleMinimize}
            title="Minimize (Max keeps working)"
          >
            ─
          </button>
          <button
            className="pip-btn pip-close"
            onClick={handleClose}
            title="End Session"
          >
            ×
          </button>
        </div>
      </div>

      {/* File Bar */}
      {isActive && (
        <div className="pip-file-bar">
          <span className="pip-file-icon">📁</span>
          <span className="pip-file-name">
            {fileName}
            {isModified && <span className="pip-modified">*</span>}
          </span>
          <span className="pip-sheet-count">{sheetCount} sheet{sheetCount !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Canvas */}
      <div className="pip-canvas-container">
        {!isActive ? (
          <div className="pip-placeholder">
            <div className="pip-placeholder-icon">📊</div>
            <div className="pip-placeholder-text">Spreadsheet not active</div>
            <div className="pip-placeholder-hint">
              Ask Max to create or open a spreadsheet
            </div>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            width={1280}
            height={800}
            className="pip-canvas"
          />
        )}

        {error && <div className="pip-error">{error}</div>}

        {isPaused && isActive && (
          <div className="pip-paused-overlay">
            <span>PAUSED</span>
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div className="pip-resize-handle" onMouseDown={handleResizeStart} />

      {/* Frame counter (debug) */}
      {isActive && (
        <div className="pip-frame-counter">
          {frameCount} frames
        </div>
      )}
    </div>
  );
}

export default SpreadsheetPiP;
