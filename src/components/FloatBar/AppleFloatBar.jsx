/**
 * Apple-style FloatBar Component
 * Clean, expanding bar-only UI with glassmorphism
 * Replaces card mode entirely with a dynamic expanding bar
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Settings, RotateCcw, Wrench, Send, Loader2, Minimize2 } from 'lucide-react';
import useStore from '../../store/useStore';
import { chatAPI, permissionAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { CreditDisplay } from '../CreditDisplay';
import { supabase, checkResponseCache, storeResponseCache } from '../../services/supabase';
import { createLogger } from '../../services/logger';
import { FactTileList } from '../FactTileList.jsx';
import { usePermission } from '../../contexts/PermissionContext';
import ApprovalDialog from '../ApprovalDialog';
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
  const [factTiles, setFactTiles] = useState([]);
  // Approval dialog state
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalDetails, setApprovalDetails] = useState({ action: '', markers: [], reason: '', isHighRisk: false, onApprove: null });
  
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
  const tilesRef = useRef(null); // fact tiles container
  const enrichTileIdRef = useRef(null); // current tile receiving enrichment
  const streamBufferRef = useRef(''); // accumulates tokens when not enriching a tile
  
  // Store
  const { clearMessages, apiConnected, currentUser } = useStore();
  
  // Permission level
  const { level: permissionLevel, updateLevel } = usePermission();
  
  // Hard route guard: the FloatBar window should never navigate to /settings
  useEffect(() => {
    const keepRoot = () => {
      try {
        const h = window.location?.hash || '#/';
        if (h.startsWith('#/settings')) {
          // Replace without adding history entries or causing flashes
          if (history?.replaceState) history.replaceState(null, '', '#/');
          else window.location.hash = '#/';
        }
      } catch {}
    };
    keepRoot();
    window.addEventListener('hashchange', keepRoot);
    return () => window.removeEventListener('hashchange', keepRoot);
  }, []);
  
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
  
  // Helper to run the full send flow (credits, screenshots, streaming, memory)
  const continueSend = useCallback(async (text) => {
    // Get user ID for credit check
    const userId = localStorage.getItem('user_id');
    if (!userId) {
      toast.error('Please wait for user initialization');
      return;
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
        const openSettings = window.electron?.openSettings || window.electronAPI?.openSettings;
        if (openSettings) {
          await openSettings({ route: '#/settings?section=credits' });
        }
        return;
      }
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
    if (window.electron?.memory?.addMessage) {
      window.electron.memory.addMessage('user', text)
        .catch(err => console.warn('[Chat] Failed to save user message to memory:', err));
    }
    // Screenshot / ambiguity handling
    const screenKeywords = ['screen', 'see', 'what is on', 'what\'s on', 'show me', 'screenshot', 'display'];
    const ambiguousKeywords = ['this', 'that', 'it', 'these', 'those', 'here', 'there'];
    const hasScreenKeyword = screenKeywords.some(keyword => text.toLowerCase().includes(keyword));
    const hasAmbiguousWord = ambiguousKeywords.some(keyword => {
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
    // Build user context
    let userContext = {
      recent_messages: thoughts.map(t => ({ role: t.role, content: t.content })),
      profile: null,
      facts: null,
      preferences: null
    };
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
      } catch (error) {
        console.warn('[Chat] Failed to load memory context:', error);
      }
    }
    // Streaming call
    chatAPI.sendMessageStream(text, userContext, screenshotData, (event) => {
      console.log('[Chat] Received SSE event:', event);
      
      // Handle SSE events - backend sends {type: string, data: {...}}
      if (event.type === 'tool_result') {
        // Phase 2: Deterministic tool result
        const toolName = event.tool_name || event.data?.tool_name;
        const result = event.result || event.data?.result || event.data || {};
        const displayText = event.display_text || result.display_text || result.formatted || '';
        const latencyMs = event.latency_ms ?? result.latency_ms ?? 0;
        const confidence = event.confidence ?? result.confidence ?? 1.0;
        
        // Map tool name to friendly title
        const titleMap = {
          time: 'Current Time',
          date: 'Today',
          math: 'Calculation',
          unit_conversion: 'Conversion',
          next_meeting: 'Calendar',
          weather: 'Weather'
        };
        
        const tile = {
          id: crypto.randomUUID(),
          title: titleMap[toolName] || toolName,
          primary: displayText,
          meta: {
            latencyMs,
            confidence,
            timestamp: new Date().toISOString()
          },
          raw: result,
          enrichment: event.enrichment || ''
        };

        // Scope subsequent token events to this tile for enrichment
        enrichTileIdRef.current = tile.id;

        setFactTiles(prev => [tile, ...prev]);
        logger.info(`[FactTile] Rendered ${toolName} tile in ${Math.round(latencyMs)}ms`);
      } else if (event.type === 'token') {
        const content = event.content || event.data?.content || '';
        if (!content) return;
        if (enrichTileIdRef.current) {
          // Stream into the most recent fact tile enrichment
          setFactTiles(prev => {
            if (prev.length === 0) return prev;
            const idx = prev.findIndex(t => t.id === enrichTileIdRef.current);
            if (idx === -1) return prev;
            const updated = [...prev];
            const tile = updated[idx];
            updated[idx] = {
              ...tile,
              enrichment: (tile.enrichment || '') + content
            };
            return updated;
          });
        } else {
          // No tile enrichment active: accumulate into plain assistant buffer
          streamBufferRef.current = (streamBufferRef.current || '') + content;
        }
      } else if (event.type === 'thinking') {
        const message = event.data?.message || event.message || 'Processing...';
        setThinkingStatus(message);
      } else if (event.type === 'step') {
        // Step completed - could show intermediate steps
        setThinkingStatus('Working...');
      } else if (event.type === 'done') {
        // Final response received
        const d = event.data || {};
        const finalResponse = (
          d.final_response || d.response || d.text || d.content || d.message || d.result ||
          event.final_response || event.response || event.content || event.text || event.message || ''
        );
        const buffered = streamBufferRef.current || '';
        const responseText = (typeof finalResponse === 'string' ? finalResponse : String(finalResponse || '')) || buffered;
        if (responseText) {
          setThoughts(prev => [...prev, {
            role: 'assistant',
            content: responseText,
            timestamp: Date.now()
          }]);

          // Save conversation to memory system
          if (window.electron?.memory?.addMessage) {
            window.electron.memory.addMessage('assistant', responseText)
              .catch(err => console.warn('[Chat] Failed to save message to memory:', err));
          }
        }
        // Clear enrichment scope at end of stream
        enrichTileIdRef.current = null;
        // Clear any accumulated plain text tokens
        streamBufferRef.current = '';
        setIsThinking(false);
        setThinkingStatus('');
      } else if (event.type === 'error') {
        const errorMsg = event.data?.error || event.error || 'Failed to get response';
        toast.error(errorMsg);
        // Reset buffers on error
        enrichTileIdRef.current = null;
        streamBufferRef.current = '';
        setIsThinking(false);
        setThinkingStatus('');
      }
    }).catch(error => {
      toast.error('Failed to send message: ' + error.message);
      console.error('Chat error:', error);
      setIsThinking(false);
      setThinkingStatus('');
    });
  }, [thoughts]);

  // Handle message submit with safety check and potential approval
  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault();
    const text = message.trim();
    if (!text || isThinking || !apiConnected) return;
    // Cache check first (cheap)
    try {
      const cached = await checkResponseCache(text);
      if (cached) {
        const userId = localStorage.getItem('user_id');
        setThoughts(prev => [
          ...prev,
          { role: 'user', content: text, timestamp: Date.now() },
          { role: 'assistant', content: cached.response, timestamp: Date.now(), cached: true }
        ]);
        setMessage('');
        toast.success('Answer from cache (no credit used)', { icon: '💰' });
        logger.info('Used cached response, no credit deducted');
        if (userId) {
          await supabase.from('telemetry_events').insert({
            user_id: userId,
            event_type: 'cache_hit',
            metadata: { cached_response: true, no_credit_charge: true }
          });
        }
        return;
      }
    } catch (err) {
      logger.warn('Cache check failed', err);
    }
    // Safety check based on permission level
    try {
      const res = await permissionAPI.check(text, {});
      const data = res.data || res;
      if (!data.allowed) {
        toast.error(data.reason || 'Operation not allowed at current permission level');
        return;
      }
      if (data.requires_approval) {
        setApprovalDetails({
          action: text,
          markers: data.markers || [],
          reason: data.reason || 'Operation requires approval',
          isHighRisk: !!data.is_high_risk,
          onApprove: async () => {
            try {
              await permissionAPI.logActivity({
                action: text,
                required_approval: true,
                approved: true,
                markers: data.markers || [],
                is_high_risk: !!data.is_high_risk
              });
            } catch {}
            continueSend(text);
          }
        });
        setApprovalOpen(true);
        return;
      }
    } catch (err) {
      logger.warn('Safety check failed; proceeding cautiously', err);
    }
    // No approval needed → continue
    continueSend(text);
  }, [message, isThinking, apiConnected, continueSend]);
  
  // Handle clear conversation
  const handleClear = useCallback(() => {
    setThoughts([]);
    setFactTiles([]);
    enrichTileIdRef.current = null;
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
  
  // Tools overlay state for permission selection
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const toolBtnRef = useRef(null);
  const overlayRef = useRef(null);
  const [toolMenuRect, setToolMenuRect] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [toolMenuReady, setToolMenuReady] = useState(false);
  const handleTools = useCallback(() => {
    // Keep prior event dispatch for telemetry/integration
    window.dispatchEvent(new CustomEvent('amx:ui', { detail: { type: 'tools_open' } }));
    setToolMenuOpen((prev) => {
      const next = !prev;
      if (next && toolbarRef.current) {
        const el = toolbarRef.current;
        setToolMenuRect({
          top: el.offsetTop,
          left: el.offsetLeft,
          width: el.offsetWidth,
          height: el.offsetHeight,
        });
      }
      return next;
    });
  }, []);
  // Animate open/close
  useEffect(() => {
    if (toolMenuOpen) {
      const id = requestAnimationFrame(() => setToolMenuReady(true));
      return () => cancelAnimationFrame(id);
    } else {
      setToolMenuReady(false);
    }
  }, [toolMenuOpen]);
  // Click outside to close
  useEffect(() => {
    if (!toolMenuOpen) return;
    const onDown = (e) => {
      if (overlayRef.current?.contains(e.target) || toolBtnRef.current?.contains(e.target)) return;
      setToolMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [toolMenuOpen]);
  const handleSelectLevel = useCallback(async (level) => {
    try {
      await updateLevel(level);
      toast.success(`Permission level set to ${level.charAt(0).toUpperCase()}${level.slice(1)}`);
    } catch (e) {
      toast.error('Failed to update permission level');
    } finally {
      setToolMenuOpen(false);
    }
  }, [updateLevel]);
  
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
      const fh = tilesRef.current?.offsetHeight || 0; // fact tiles height
      const mh = messagesRef.current?.scrollHeight || 0;
      const naturalHeight = padTop + th + fh + mh + ih + padBottom + gaps;
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
  
  // Update height when content changes (messages, thinking, tiles)
  useEffect(() => {
    updateWindowHeight();
  }, [thoughts, isThinking, factTiles, updateWindowHeight]);

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
        <div className="apple-bar-glass" style={{ position: 'relative' }}>
          <div className="apple-bar-logo" />
          <div className="apple-drag-strip" />
          <div className="apple-toolbar" ref={toolbarRef} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ flexGrow: 1 }} />
            <CreditDisplay userId={currentUser?.id || localStorage.getItem('user_id')} variant="tool" />
            <button className="apple-tool-btn" ref={toolBtnRef} onClick={handleTools} title="Tools">
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

          {/* Spread overlay across toolbar */}
          {toolMenuOpen && (
            <div
              ref={overlayRef}
              style={{
                position: 'absolute',
                left: toolMenuRect.left,
                top: toolMenuRect.top,
                width: toolMenuRect.width,
                height: toolMenuRect.height,
                zIndex: 70,
                background: 'linear-gradient(135deg, rgba(18,20,24,0.82), rgba(24,26,30,0.76))',
                backdropFilter: 'saturate(120%) blur(var(--blur, 18px))',
                WebkitBackdropFilter: 'saturate(120%) blur(var(--blur, 18px))',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '12px',
                boxShadow: '0 12px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
                overflow: 'hidden',
                transform: toolMenuReady ? 'translateY(0px) scale(1)' : 'translateY(-6px) scale(0.98)',
                opacity: toolMenuReady ? 1 : 0,
                transition: 'opacity 160ms ease-out, transform 220ms cubic-bezier(.22,.61,.36,1)'
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', height: '100%' }}>
                {[{ value: 'chatty', title: 'Chatty' }, { value: 'helpful', title: 'Helpful' }, { value: 'powerful', title: 'Advanced' }].map((opt, idx) => (
                  <button
                    key={opt.value}
                    onClick={() => handleSelectLevel(opt.value)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: 'none',
                      background: permissionLevel === opt.value ? 'rgba(255,255,255,0.08)' : 'transparent',
                      color: 'rgba(255,255,255,0.55)',
                      cursor: 'pointer',
                      borderRight: idx < 2 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                      boxShadow: permissionLevel === opt.value ? 'inset 0 -2px 8px rgba(255,255,255,0.15)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (permissionLevel !== opt.value) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                        e.currentTarget.style.color = 'rgba(255,255,255,0.75)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = permissionLevel === opt.value ? 'rgba(255,255,255,0.08)' : 'transparent';
                      e.currentTarget.style.color = 'rgba(255,255,255,0.55)';
                    }}
                  >
                    <span style={{ fontSize: '0.86rem', fontWeight: 600, letterSpacing: 0.2 }}>{opt.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Fact Tiles (Phase 2: Deterministic Tools) */}
          {factTiles.length > 0 && (
            <div style={{ marginBottom: '8px' }} ref={tilesRef}>
              <FactTileList tiles={factTiles} />
            </div>
          )}
          
          {/* Messages */}
          <div className="apple-messages" ref={messagesRef}>
            {thoughts.map((thought, idx) => (
              <div key={idx} className={`apple-message apple-message-${thought.role}`}>
                <div className="apple-message-content">
                  {thought.role === 'assistant' ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ node, ...props }) => (
                          <a target="_blank" rel="noreferrer" {...props} />
                        ),
                      }}
                    >
                      {thought.content || ''}
                    </ReactMarkdown>
                  ) : (
                    thought.content
                  )}
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="apple-message apple-message-thinking">
                <div className="typing-indicator">
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                </div>
                <span className="typing-text">{thinkingStatus || 'Thinking...'}</span>
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
      {/* Approval Dialog */}
      <ApprovalDialog
        open={approvalOpen}
        onClose={() => setApprovalOpen(false)}
        action={approvalDetails.action}
        markers={approvalDetails.markers}
        reason={approvalDetails.reason}
        isHighRisk={approvalDetails.isHighRisk}
        onApprove={() => {
          const fn = approvalDetails.onApprove;
          setApprovalOpen(false);
          if (typeof fn === 'function') fn();
        }}
        approveButtonText="Approve"
      />
    </div>
  );
}
