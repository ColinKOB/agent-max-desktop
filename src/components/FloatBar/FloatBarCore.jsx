/**
 * FloatBar Core Component
 * Refactored main component - Part 1 of modularization
 * This handles the core window states and layout
 */
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Settings as SettingsIcon, RotateCcw, Wrench } from 'lucide-react';
import useStore from '../../store/useStore';
import FloatBarInput from './FloatBarInput';
import FloatBarMessages from './FloatBarMessages';
import FloatBarHeader from './FloatBarHeader';
import FloatBarActions from './FloatBarActions';
import { useFloatBarState } from './useFloatBarState';
import { useMessageHandler } from './useMessageHandler';
import './FloatBar.css';
import LogoPng from '../../assets/AgentMaxLogo.png';

export default function FloatBarCore({
  showWelcome,
  onWelcomeComplete,
  isLoading,
  windowMode = 'single',
  autoSend = true,
}) {
  const { greeting, apiConnected } = useStore();
  const {
    isOpen,
    isMini,
    isBar,
    setIsOpen,
    setIsMini,
    setIsBar,
    isTransitioning,
    handleExpand,
    handleCollapse,
    handleMinimize,
    handleMaximize
  } = useFloatBarState(windowMode);
  
  const {
    message,
    setMessage,
    thoughts,
    isThinking,
    thinkingStatus,
    handleSendMessage,
    handleClearConversation,
    handleStop,
    handleContinue
  } = useMessageHandler();
  
  // BAR_EXPANDING visual state for submit animation
  const [isExpanding, setIsExpanding] = useState(false);
  const expandTimerRef = useRef(null);
  const shrinkBtnRef = useRef(null);
  const [escPrimed, setEscPrimed] = useState(false);
  const barContentRef = useRef(null);
  const autoMinTimerRef = useRef(null);

  // Compute window classes
  const windowClasses = useMemo(() => {
    const classes = ['amx-root'];
    if (isMini) classes.push('amx-mini');
    if (isBar) classes.push('amx-bar');
    if (isOpen) classes.push('amx-card');
    if (isTransitioning) classes.push('amx-transitioning');
    if (isBar && isExpanding) classes.push('amx-bar-expanding');
    return classes.join(' ');
  }, [isMini, isBar, isOpen, isTransitioning, isExpanding]);

  // Handle input submission
  const handleSubmit = useCallback((e) => {
    e?.preventDefault();
    const text = message.trim();
    if (text && !isThinking) {
      // Trigger BAR_EXPANDING animation
      setIsExpanding(true);
      // TIMEOUT guard (1500ms)
      if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
      expandTimerRef.current = setTimeout(() => setIsExpanding(false), 1500);
      // Emit UI event
      try {
        const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
        window.dispatchEvent(new CustomEvent('amx:ui', { detail: { type: 'submit', text, id } }));
      } catch {}
      // Send message and clear draft
      handleSendMessage(text);
      setMessage('');
      // Stay in Bar and grow height; resize will happen in layout effect below
    }
  }, [message, isThinking, handleSendMessage, setMessage]);

  // Collapse expansion when thinking finishes (response complete) or on unmount
  useEffect(() => {
    if (!isThinking && isExpanding) {
      setIsExpanding(false);
      if (expandTimerRef.current) {
        clearTimeout(expandTimerRef.current);
        expandTimerRef.current = null;
      }
    }
    return () => {
      if (expandTimerRef.current) {
        clearTimeout(expandTimerRef.current);
        expandTimerRef.current = null;
      }
    };
  }, [isThinking, isExpanding]);

  // Bar keyboard: Esc minimizes to pill
  useEffect(() => {
    // Only when not in mini, since we don't support card anymore
    if (isMini) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleMinimize();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMini, handleMinimize]);

  // Events API: announce open/close bar
  const prevIsBarRef = useRef(isBar);
  useEffect(() => {
    if (prevIsBarRef.current !== isBar) {
      try {
        window.dispatchEvent(new CustomEvent('amx:ui', { detail: { type: isBar ? 'open_bar' : 'close_bar' } }));
      } catch {}
      prevIsBarRef.current = isBar;
    }
  }, [isBar]);

  // Listen for response_started event from shell/back-end to end BAR_EXPANDING state
  useEffect(() => {
    const onUiEvent = (e) => {
      const detail = e?.detail;
      if (!detail) return;
      if (detail.type === 'response_started') {
        setIsExpanding(false);
      }
    };
    window.addEventListener('amx:ui', onUiEvent);
    return () => window.removeEventListener('amx:ui', onUiEvent);
  }, []);

  // Dynamically resize window height based on content
  const resizeToContent = useCallback(async () => {
    try {
      const el = barContentRef.current;
      if (!el) return;
      // Measure content height
      const desired = Math.ceil(el.scrollHeight + 0); // padding already inside
      const minH = 120;
      const maxH = 720;
      const height = Math.max(minH, Math.min(maxH, desired));
      if (window.electron?.getBounds && window.electron?.resizeWindow) {
        const b = await window.electron.getBounds();
        await window.electron.resizeWindow(b.width, height);
      }
    } catch {}
  }, []);

  useEffect(() => {
    // Resize when messages change or thinking state updates
    const id = requestAnimationFrame(() => resizeToContent());
    return () => cancelAnimationFrame(id);
  }, [thoughts.length, isThinking, resizeToContent]);

  useEffect(() => {
    if (isMini && autoMinTimerRef.current) {
      clearTimeout(autoMinTimerRef.current);
      autoMinTimerRef.current = null;
    }
    return () => {
      if (autoMinTimerRef.current) {
        clearTimeout(autoMinTimerRef.current);
        autoMinTimerRef.current = null;
      }
    };
  }, [isMini]);

  useEffect(() => {
    // Resize on input changes to accommodate multi-line growth if any
    const id = requestAnimationFrame(() => resizeToContent());
    return () => cancelAnimationFrame(id);
  }, [message, resizeToContent]);

  const handleHistory = useCallback(() => {
    try { window.dispatchEvent(new CustomEvent('amx:ui', { detail: { type: 'history_open' } })); } catch {}
  }, []);

  const handleSettings = useCallback(async () => {
    try { window.dispatchEvent(new CustomEvent('amx:ui', { detail: { type: 'settings_open' } })); } catch {}
    try {
      if (window.electron?.openSettings) await window.electron.openSettings();
      else if (window.electronAPI?.openSettings) await window.electronAPI.openSettings();
    } catch {}
  }, []);

  // Render mini pill state
  if (isMini) {
    const handleMiniClick = () => {
      handleExpand();
      if (autoMinTimerRef.current) {
        clearTimeout(autoMinTimerRef.current);
        autoMinTimerRef.current = null;
      }
      autoMinTimerRef.current = setTimeout(() => {
        try { handleMinimize(); } catch {}
      }, 180000);
    };
    return (
      <div className={windowClasses}>
        <div className="amx-mini-content" onClick={handleMiniClick}>
          <img
            src={LogoPng}
            alt="Agent Max"
            className="amx-mini-logo"
            draggable={false}
            style={{ WebkitAppRegion: 'no-drag' }}
          />
        </div>
        <div className="amx-drag-handle-mini">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="amx-dot" />
          ))}
        </div>
      </div>
    );
  }

  // Render bar-only state (no card)
  if (!isMini) {
    return (
      <div className={windowClasses}>
        <div className="amx-bar-shell">
          <div className="amx-bar-content" ref={barContentRef}>
            <div className="amx-toolbar" role="toolbar" aria-label="Tools">
              <button className="amx-icon-btn" aria-label="Tools" onClick={() => {
                try { window.dispatchEvent(new CustomEvent('amx:ui', { detail: { type: 'tools_open' } })); } catch {}
              }}>
                <Wrench size={14} />
              </button>
              <button className="amx-icon-btn" aria-label="Settings" onClick={handleSettings}>
                <SettingsIcon size={14} />
              </button>
              <button className="amx-icon-btn" aria-label="Refresh conversation" onClick={handleClearConversation}>
                <RotateCcw size={14} />
              </button>
            </div>

            <div className="amx-bar-messages">
              <FloatBarMessages
                thoughts={thoughts}
                isThinking={isThinking}
                thinkingStatus={thinkingStatus}
              />
            </div>

            <div className="amx-bar-composer" aria-live="polite">
              <FloatBarActions
                message={message}
                onMessageChange={setMessage}
                onSubmit={handleSubmit}
                isThinking={isThinking}
                apiConnected={apiConnected}
                // hide optional buttons inside Actions
                onScreenshot={undefined}
                onQuickAction={undefined}
                onStop={handleStop}
                onContinue={handleContinue}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback (shouldn't reach): mini rendered above
  return null;
}
