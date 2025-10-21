/**
 * Apple-style FloatBar Component
 * Clean, expanding bar-only UI with glassmorphism
 * Replaces card mode entirely with a dynamic expanding bar
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Settings, RotateCcw, Wrench, Send, Loader2, Minimize2 } from 'lucide-react';
import useStore from '../../store/useStore';
import { chatAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { CreditDisplay } from '../CreditDisplay';
import { PurchaseCreditsModal } from '../PurchaseCreditsModal';
import { supabase, checkResponseCache, storeResponseCache } from '../../services/supabase';
import { createLogger } from '../../services/logger';
import './AppleFloatBar.css';

const logger = createLogger('FloatBar');

const MIN_EXPANDED_HEIGHT = 140;

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
  const messagesRef = useRef(null);
  const toolbarRef = useRef(null);
  const composerRef = useRef(null);
  const naturalHeightRef = useRef(0); // last measured natural content height
  const isMiniRef = useRef(true);
  
  // Store
  const { clearMessages, apiConnected, currentUser } = useStore();
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  
  // Handle expand/collapse
  const handleExpand = useCallback(() => {
    setIsTransitioning(true);
    setIsMini(false);
    isMiniRef.current = false;

    // Restore last height immediately to avoid visible shrink
    (async () => {
      try {
        const hasMessages = thoughts.length > 0;
        const base = MIN_EXPANDED_HEIGHT;
        let limit = Infinity;
        try {
          const size = await window.electron?.getScreenSize?.();
          if (size?.height) limit = Math.max(MIN_EXPANDED_HEIGHT, size.height - 120);
        } catch {}
        const hardMax = 520;

        // Only restore saved height if there are messages; otherwise start compact
        if (hasMessages) {
          const key = 'amx:floatbar:lastHeight';
          let saved = Number(localStorage.getItem(key));
          if (!Number.isFinite(saved) || saved < base) saved = base;
          const target = Math.min(limit, hardMax, Math.max(base, saved));
          if (window.electron?.resizeWindow) {
            await window.electron.resizeWindow(360, target);
            lastHeightRef.current = target;
          }
        } else {
          if (window.electron?.resizeWindow) {
            await window.electron.resizeWindow(360, base);
            lastHeightRef.current = base;
          }
        }
      } catch {}
    })();

    // Focus input after animation
    setTimeout(() => {
      inputRef.current?.focus();
      setIsTransitioning(false);
    }, 300);
  }, [thoughts.length]);
  
  const handleCollapse = useCallback(async () => {
    setIsTransitioning(true);
    if (resizeDebounceRef.current) {
      clearTimeout(resizeDebounceRef.current);
      resizeDebounceRef.current = null;
    }
    try {
      try {
        const b = await window.electron?.getBounds?.();
        if (b?.height) localStorage.setItem('amx:floatbar:lastHeight', String(b.height));
      } catch {}
      await window.electron?.resizeWindow?.(80, 80);
    } catch {}
    setIsMini(true);
    isMiniRef.current = true;
    naturalHeightRef.current = 0;
    setTimeout(() => {
      setIsTransitioning(false);
    }, 300);
  }, []);
  
  // Handle message submit
  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault();
    const text = message.trim();
    
    if (!text || isThinking || !apiConnected) return;
    
    // Get user ID for credit check
    const userId = localStorage.getItem('user_id');
    if (!userId) {
      toast.error('Please wait for user initialization');
      return;
    }
    
    // Check if response is cached (no credit charge)
    try {
      const cached = await checkResponseCache(text);
      if (cached) {
        // Use cached response, NO credit deduction
        setThoughts(prev => [
          ...prev, 
          { role: 'user', content: text, timestamp: Date.now() },
          { role: 'assistant', content: cached.response, timestamp: Date.now(), cached: true }
        ]);
        setMessage('');
        
        toast.success('Answer from cache (no credit used)', { icon: '💰' });
        logger.info('Used cached response, no credit deducted');
        
        // Track cache hit event
        await supabase.from('telemetry_events').insert({
          user_id: userId,
          event_type: 'cache_hit',
          metadata: { cached_response: true, no_credit_charge: true }
        });
        
        return;
      }
    } catch (error) {
      logger.warn('Cache check failed', error);
    }
    
    // NOT cached - check and deduct credit
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('metadata')
        .eq('id', userId)
        .single();
      
      const currentCredits = userData?.metadata?.credits || 0;
      
      if (currentCredits <= 0) {
        toast.error('No credits remaining! Please purchase more.');
        setShowPurchaseModal(true);
        return;
      }
      
      // Deduct credit optimistically
      await supabase
        .from('users')
        .update({
          metadata: {
            ...userData.metadata,
            credits: currentCredits - 1
          }
        })
        .eq('id', userId);
      
      logger.info(`Credit deducted: ${currentCredits} → ${currentCredits - 1}`);
      
      // Track credit usage
      await supabase.from('telemetry_events').insert({
        user_id: userId,
        event_type: 'credit_usage',
        action: 'message_sent',
        metadata: {
          credits_remaining: currentCredits - 1,
          message_cached: false
        }
      });
      
    } catch (error) {
      logger.error('Credit check/deduction failed', error);
      toast.error('Failed to process credits. Please try again.');
      return;
    }
    
    // Add user message
    setThoughts(prev => [...prev, { role: 'user', content: text, timestamp: Date.now() }]);
    setMessage('');
    setIsThinking(true);
    setThinkingStatus('Thinking...');
    
    // Save user message to memory
    if (window.electron?.memory?.addMessage) {
      window.electron.memory.addMessage('user', text)
        .catch(err => console.warn('[Chat] Failed to save user message to memory:', err));
    }
    
    // Check if user is asking about screen content OR asking ambiguous questions
    const screenKeywords = ['screen', 'see', 'what is on', 'what\'s on', 'show me', 'screenshot', 'display'];
    const ambiguousKeywords = ['this', 'that', 'it', 'these', 'those', 'here', 'there'];
    
    const hasScreenKeyword = screenKeywords.some(keyword => text.toLowerCase().includes(keyword));
    const hasAmbiguousWord = ambiguousKeywords.some(keyword => {
      // Check for word boundaries to avoid false positives
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      return regex.test(text);
    });
    
    const needsScreenshot = hasScreenKeyword || hasAmbiguousWord;
    
    if (hasAmbiguousWord) {
      console.log('[Chat] Ambiguous question detected, capturing screenshot for context');
    }
    
    let screenshotData = null;
    if (needsScreenshot && window.electron?.takeScreenshot) {
      try {
        setThinkingStatus('Capturing screenshot...');
        const result = await window.electron.takeScreenshot();
        screenshotData = result.base64;
        console.log('[Chat] Screenshot captured:', Math.round(result.size / 1024), 'KB');
      } catch (error) {
        console.error('[Chat] Failed to capture screenshot:', error);
        toast.error('Failed to capture screenshot');
      }
    }
    
    // Build user context with conversation history and memory
    let userContext = {
      recent_messages: thoughts.map(t => ({
        role: t.role,
        content: t.content
      })),
      profile: null,
      facts: null,
      preferences: null
    };
    
    // Get memory data if available
    if (window.electron?.memory) {
      try {
        const [profile, facts, preferences] = await Promise.all([
          window.electron.memory.getProfile().catch(() => null),
          window.electron.memory.getFacts().catch(() => null),
          window.electron.memory.getPreferences().catch(() => null)
        ]);
        userContext.profile = profile;
        userContext.facts = facts;
        userContext.preferences = preferences;
        console.log('[Chat] Loaded memory context:', {
          hasProfile: !!profile,
          hasFacts: !!facts,
          hasPreferences: !!preferences
        });
      } catch (error) {
        console.warn('[Chat] Failed to load memory context:', error);
      }
    }
    
    // Call real backend API with streaming
    chatAPI.sendMessageStream(text, userContext, screenshotData, (event) => {
      console.log('[Chat] Received SSE event:', event);
      
      // Handle SSE events - backend sends {type: string, data: {...}}
      if (event.type === 'thinking') {
        const message = event.data?.message || event.message || 'Processing...';
        setThinkingStatus(message);
      } else if (event.type === 'step') {
        // Step completed - could show intermediate steps
        setThinkingStatus('Working...');
      } else if (event.type === 'done') {
        // Final response received
        const finalResponse = event.data?.final_response || event.final_response || '';
        if (finalResponse) {
          setThoughts(prev => [...prev, { 
            role: 'assistant', 
            content: finalResponse, 
            timestamp: Date.now() 
          }]);
          
          // Save conversation to memory system
          if (window.electron?.memory?.addMessage) {
            window.electron.memory.addMessage('assistant', finalResponse)
              .catch(err => console.warn('[Chat] Failed to save message to memory:', err));
          }
        }
        setIsThinking(false);
        setThinkingStatus('');
      } else if (event.type === 'error') {
        const errorMsg = event.data?.error || event.error || 'Failed to get response';
        toast.error(errorMsg);
        setIsThinking(false);
        setThinkingStatus('');
      }
    }).catch(error => {
      toast.error('Failed to send message: ' + error.message);
      console.error('Chat error:', error);
      setIsThinking(false);
      setThinkingStatus('');
    });
  }, [message, isThinking, apiConnected]);
  
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
    if (!barRef.current || isMiniRef.current) return;

    if (resizeDebounceRef.current) {
      clearTimeout(resizeDebounceRef.current);
    }

    resizeDebounceRef.current = setTimeout(async () => {
      if (isMiniRef.current) return;
      // Compute natural content height: paddings + toolbar + messages content + input + gaps
      const containerEl = barRef.current;
      const glassEl = containerEl?.querySelector?.('.apple-bar-glass');
      const style = glassEl ? getComputedStyle(glassEl) : null;
      const padTop = style ? parseInt(style.paddingTop || '0', 10) : 0;
      const padBottom = style ? parseInt(style.paddingBottom || '0', 10) : 0;
      const gaps = 16; // two gaps between three blocks
      const th = toolbarRef.current?.offsetHeight || 0;
      const ih = composerRef.current?.offsetHeight || 0;
      const mh = messagesRef.current?.scrollHeight || 0;
      const naturalHeight = padTop + th + mh + ih + padBottom + gaps;
      const minHeight = MIN_EXPANDED_HEIGHT;

      // Limit by available screen height (minus margin), not a hardcoded app cap
      let screenLimit = Infinity;
      try {
        const screenSize = await window.electron?.getScreenSize?.();
        if (screenSize?.height) {
          screenLimit = Math.max(MIN_EXPANDED_HEIGHT, screenSize.height - 120); // 120px safe margin
        }
      } catch {}

      const preferredMax = Math.min(screenLimit, 520); // cap for internal scroll behavior

      // Compute delta vs previous natural height to grow/shrink incrementally
      let prevNatural = naturalHeightRef.current || 0;
      if (prevNatural === 0) {
        // First measurement, set baseline without resizing to full natural height
        naturalHeightRef.current = naturalHeight;
        return;
      }
      const delta = naturalHeight - prevNatural;

      // If change is negligible, skip
      if (Math.abs(delta) < 6) {
        naturalHeightRef.current = naturalHeight;
        return;
      }

      // Current window height
      let currentHeight = lastHeightRef.current;
      try {
        const b = await window.electron?.getBounds?.();
        if (b?.height) currentHeight = b.height;
      } catch {}

      let targetHeight = Math.max(minHeight, Math.min(preferredMax, currentHeight + delta));

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
      // Update baseline after any attempted resize
      naturalHeightRef.current = naturalHeight;
    }, 100);
  }, [isMini]);

  useEffect(() => {
    isMiniRef.current = isMini;
  }, [isMini]);
  
  // Update height when content changes
  useEffect(() => {
    updateWindowHeight();
  }, [thoughts, isThinking, updateWindowHeight]);

  // Auto-scroll to bottom when new messages arrive or thinking indicator toggles
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [thoughts.length, isThinking]);

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
          <div className="apple-toolbar" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Credit Display */}
            <CreditDisplay 
              userId={currentUser?.id || localStorage.getItem('user_id')} 
              onPurchaseClick={() => setShowPurchaseModal(true)}
            />
            <div style={{ flexGrow: 1 }} />
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
          <div className="apple-messages" ref={messagesRef}>
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
      
      {/* Purchase Modal */}
      <PurchaseCreditsModal 
        isOpen={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
      />
    </div>
  );
}
