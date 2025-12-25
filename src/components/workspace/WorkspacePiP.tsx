/**
 * WorkspacePiP - Picture-in-Picture viewer for AI Workspace
 *
 * Displays a floating window showing the AI's virtual display workspace.
 * The user can watch what the AI is doing without their mouse/keyboard
 * being hijacked.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import './WorkspacePiP.css';

interface WorkspacePiPProps {
  /** Whether the PiP window should be visible */
  isVisible?: boolean;
  /** Called when user closes the PiP window (ends session) */
  onClose?: () => void;
  /** Called when user minimizes the PiP window */
  onMinimize?: () => void;
  /** Target frame rate (default: 15 fps) */
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

export function WorkspacePiP({
  isVisible = true,
  onClose,
  onMinimize,
  fps = 15,
  initialWidth = 480,
  initialHeight = 270,
}: WorkspacePiPProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [pageTitle, setPageTitle] = useState<string>('');

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 20, y: 20 });
  const dragOffset = useRef<Position>({ x: 0, y: 0 });

  // Resizing state
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [isResizing, setIsResizing] = useState(false);

  // Check workspace status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        // @ts-ignore - workspace is exposed via preload
        const status = await window.workspace?.getStatus();
        setIsActive(status?.active ?? false);
        setCurrentUrl(status?.url ?? '');
        setPageTitle(status?.title ?? '');
      } catch (err) {
        console.error('[WorkspacePiP] Failed to get status:', err);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 1000); // Check more frequently to update URL
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
        // @ts-ignore - workspace is exposed via preload
        const frameData = await window.workspace?.captureFrame();

        if (frameData && canvasRef.current) {
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
            // Frame data is already a data URL (e.g., "data:image/png;base64,...")
            img.src = frameData.startsWith('data:') ? frameData : `data:image/png;base64,${frameData}`;
          }
        }
      } catch (err) {
        console.error('[WorkspacePiP] Frame capture error:', err);
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
    const aspectRatio = 16 / 9;

    const handleResize = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(240, Math.min(960, startWidth + deltaX));
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
  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  // Handle minimize (hides window but keeps session running)
  const handleMinimize = useCallback(() => {
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
      className={`workspace-pip ${isDragging ? 'dragging' : ''}`}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height + 36, // Add header height
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header - Max's Monitor Branding */}
      <div className="pip-header">
        <div className="pip-title">
          <span className="pip-max-icon">🤖</span>
          <span className="pip-brand-name">Max's Monitor</span>
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

      {/* URL Bar */}
      {isActive && currentUrl && (
        <div className="pip-url-bar">
          <span className="pip-url-icon">🔗</span>
          <span className="pip-url-text" title={currentUrl}>
            {currentUrl.length > 50 ? currentUrl.substring(0, 50) + '...' : currentUrl}
          </span>
        </div>
      )}

      {/* Canvas */}
      <div className="pip-canvas-container">
        {!isActive ? (
          <div className="pip-placeholder">
            <div className="pip-placeholder-icon">🖥️</div>
            <div className="pip-placeholder-text">Workspace not active</div>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            width={1920}
            height={1080}
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

export default WorkspacePiP;
