/**
 * Apple-style FloatBar Component
 * Clean, expanding bar-only UI with glassmorphism
 * Replaces card mode entirely with a dynamic expanding bar
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Settings, RotateCcw, Wrench, Send, Loader2, Minimize2 } from 'lucide-react';
import useStore from '../../store/useStore';
import toast from 'react-hot-toast';
import './AppleFloatBar.css';

export default function AppleFloatBar({ 
  showWelcome, 
  onWelcomeComplete, 
  isLoading,
  windowMode = 'single',
  autoSend = true 
}) {
  // Core state
  const [isMini, setIsMini] = useState(true); // Start as mini pill
  const [message, setMessage] = useState('');
  const [thoughts, setThoughts] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Refs
  const barRef = useRef(null);
  const inputRef = useRef(null);
  const lastHeightRef = useRef(70);
  const resizeDebounceRef = useRef(null);
  
  // Store
  const { send, clearMessages, apiConnected } = useStore();

  // Fallback send handler when store.send is not yet wired
  const sendMessage = useCallback(async (text) => {
    if (typeof send === 'function') {
      return send(text);
    }

    // Demo fallback: echo response so UI remains stable
    await new Promise((resolve) => setTimeout(resolve, 800));
    return `I received your message: "${text}". This is a preview response.`;
  }, [send]);
  
  // Handle expand/collapse
  const handleExpand = useCallback(() => {
    setIsTransitioning(true);
    setIsMini(false);

    // Restore last height immediately to avoid visible shrink
    (async () => {
      try {
        const key = 'amx:floatbar:lastHeight';
        let saved = Number(localStorage.getItem(key));
        if (!Number.isFinite(saved) || saved < 120) saved = 140;
        let limit = Infinity;
        try {
          const size = await window.electron?.getScreenSize?.();
          if (size?.height) limit = Math.max(120, size.height - 120);
        } catch {}
        const target = Math.min(limit, Math.max(120, saved));
        if (window.electron?.resizeWindow) {
          await window.electron.resizeWindow(360, target);
          lastHeightRef.current = target;
        }
      } catch {}
    })();

    // Focus input after animation
    setTimeout(() => {
      inputRef.current?.focus();
      setIsTransitioning(false);
    }, 300);
  }, []);
  
  const handleCollapse = useCallback(async () => {
    setIsTransitioning(true);
    try {
      try {
        const b = await window.electron?.getBounds?.();
        if (b?.height) localStorage.setItem('amx:floatbar:lastHeight', String(b.height));
      } catch {}
      await window.electron?.resizeWindow?.(80, 80);
    } catch {}
    setIsMini(true);
    setTimeout(() => {
      setIsTransitioning(false);
    }, 300);
  }, []);
  
  // Handle message submit
  const handleSubmit = useCallback((e) => {
    e?.preventDefault();
    const text = message.trim();
    
    if (!text || isThinking || !apiConnected) return;
    
    // Add user message
    setThoughts(prev => [...prev, { role: 'user', content: text, timestamp: Date.now() }]);
    setMessage('');
    setIsThinking(true);
    setThinkingStatus('Thinking...');
    
    // Simulate API call (replace with actual implementation)
    sendMessage(text).then(response => {
      setThoughts(prev => [...prev, { role: 'assistant', content: response, timestamp: Date.now() }]);
    }).catch(error => {
      toast.error('Failed to send message');
      console.error(error);
    }).finally(() => {
      setIsThinking(false);
      setThinkingStatus('');
    });
  }, [message, isThinking, apiConnected, sendMessage]);
  
  // Handle clear conversation
  const handleClear = useCallback(() => {
    setThoughts([]);
    clearMessages();
    toast.success('Conversation cleared');
  }, [clearMessages]);
  
  // Handle settings
  const handleSettings = useCallback(() => {
    if (window.electron?.openSettings) {
      window.electron.openSettings();
    } else if (window.electronAPI?.openSettings) {
      window.electronAPI.openSettings();
    }
  }, []);
  
  // Handle tools
  const handleTools = useCallback(() => {
    window.dispatchEvent(new CustomEvent('amx:ui', { detail: { type: 'tools_open' } }));
  }, []);
  
  // Dynamically resize window based on content (no arbitrary caps)
  const updateWindowHeight = useCallback(() => {
    if (!barRef.current || isMini) return;

    if (resizeDebounceRef.current) {
      clearTimeout(resizeDebounceRef.current);
    }

    resizeDebounceRef.current = setTimeout(async () => {
      const contentHeight = barRef.current.scrollHeight;
      const minHeight = 70;

      // Limit by available screen height (minus margin), not a hardcoded app cap
      let screenLimit = Infinity;
      try {
        const screenSize = await window.electron?.getScreenSize?.();
        if (screenSize?.height) {
          screenLimit = Math.max(minHeight, screenSize.height - 120); // 120px safe margin
        }
      } catch {}

      let targetHeight = Math.max(minHeight, Math.min(screenLimit, contentHeight));

      // Only resize if height changed meaningfully
      if (Math.abs(targetHeight - lastHeightRef.current) > 8) {
        lastHeightRef.current = targetHeight;
        if (window.electron?.resizeWindow) {
          try {
            const bounds = await window.electron.getBounds?.();
            if (bounds) {
              await window.electron.resizeWindow(bounds.width, targetHeight);
              try { localStorage.setItem('amx:floatbar:lastHeight', String(targetHeight)); } catch {}
            }
          } catch {}
        }
      }
    }, 100);
  }, [isMini]);
  
  // Update height when content changes
  useEffect(() => {
    updateWindowHeight();
  }, [thoughts, isThinking, updateWindowHeight]);

  // Re-measure height when window regains focus or visibility (e.g., after minimize)
  useEffect(() => {
    const handleFocus = () => {
      if (!isMini) {
        setTimeout(() => updateWindowHeight(), 50);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleFocus();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isMini, updateWindowHeight]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Escape to collapse
      if (e.key === 'Escape' && !isMini) {
        e.preventDefault();
        handleCollapse();
      }
      
      // Cmd/Ctrl + K to expand
      if ((e.metaKey || e.ctrlKey) && e.key === 'k' && isMini) {
        e.preventDefault();
        handleExpand();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMini, handleExpand, handleCollapse]);
  
  // Window classes
  const windowClasses = useMemo(() => {
    const classes = ['apple-floatbar-root'];
    if (isMini) classes.push('mini');
    if (isTransitioning) classes.push('transitioning');
    return classes.join(' ');
  }, [isMini, isTransitioning]);
  
  // Render mini pill (use original unchanged pill markup and classes)
  if (isMini) {
    return (
      <div
        className={`amx-root amx-mini amx-mini-draggable ${isTransitioning ? 'amx-transitioning' : ''}`}
        onClick={() => {
          handleExpand();
        }}
      >
        <img src="/AgentMaxLogo.png" alt="Agent Max" className="amx-mini-logo" />
        <div className="amx-drag-handle-mini">
          <span className="amx-dot"></span>
          <span className="amx-dot"></span>
          <span className="amx-dot"></span>
          <span className="amx-dot"></span>
          <span className="amx-dot"></span>
          <span className="amx-dot"></span>
        </div>
      </div>
    );
  }
  
  // Render expanded bar
  return (
    <div className={windowClasses}>
      <div className="apple-bar-container" ref={barRef}>
        <div className="apple-bar-glass">
          <div className="apple-bar-logo" />
          <div className="apple-drag-strip" />
          {/* Toolbar */}
          <div className="apple-toolbar">
            <button className="apple-tool-btn" onClick={handleTools} title="Tools">
              <Wrench size={16} />
            </button>
            <button className="apple-tool-btn" onClick={handleSettings} title="Settings">
              <Settings size={16} />
            </button>
            <button className="apple-tool-btn" onClick={handleClear} title="Clear">
              <RotateCcw size={16} />
            </button>
            <button className="apple-tool-btn" onClick={handleCollapse} title="Shrink">
              <Minimize2 size={16} />
            </button>
          </div>
          
          {/* Messages */}
          {thoughts.length > 0 && (
            <div className="apple-messages">
              {thoughts.map((thought, idx) => (
                <div key={idx} className={`apple-message apple-message-${thought.role}`}>
                  <div className="apple-message-content">
                    {thought.content}
                  </div>
                </div>
              ))}
              {isThinking && (
                <div className="apple-message apple-message-thinking">
                  <Loader2 className="animate-spin" size={14} />
                  <span>{thinkingStatus}</span>
                </div>
              )}
            </div>
          )}
          
          {/* Input Area */}
          <div className="apple-input-area">
            <input
              ref={inputRef}
              type="text"
              className="apple-input"
              placeholder={apiConnected ? "Ask anything..." : "Connecting..."}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
              disabled={!apiConnected || isThinking}
            />
            <button 
              className="apple-send-btn"
              onClick={handleSubmit}
              disabled={!message.trim() || !apiConnected || isThinking}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
