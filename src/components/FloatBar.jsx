import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Camera,
  Send,
  Minimize2,
  ChevronRight,
  Trash2,
  Play,
  Zap,
  WifiOff,
  Wrench,
  Settings as SettingsIcon,
  GripVertical,
  RotateCcw,
  ArrowRight,
  Loader2,
  Copy,
} from 'lucide-react';
import useStore from '../store/useStore';
import toast from 'react-hot-toast';
import telemetry from '../services/telemetry';
import responseCache from '../services/responseCache';
import ToolsPanel from '../pages/ToolsPanel';
import { generateConversationSummary } from '../services/conversationSummary';

export default function FloatBar({
  showWelcome,
  onWelcomeComplete,
  isLoading,
  windowMode = 'single',
  autoSend = true,
}) {
  const isCardWindow = windowMode === 'card';
  const isPillWindow = windowMode === 'pill';
  const isSingleWindow = windowMode === 'single';
  const suggestionsEnabled = isSingleWindow;
  const [isOpen, setIsOpen] = useState(() => (isCardWindow ? true : false));
  const [isMini, setIsMini] = useState(() => (isCardWindow ? false : true));
  const [isBar, setIsBar] = useState(false);
  const [thoughts, setThoughts] = useState([]);
  const [progress, setProgress] = useState(0);
  const [currentCommand, setCurrentCommand] = useState('');
  const [message, setMessage] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState(''); // 'connecting', 'thinking', 'answering'
  const [clearedConversation, setClearedConversation] = useState(null); // For undo
  const [undoTimer, setUndoTimer] = useState(null);
  
  // UX Phase 2: Stop/Continue flow
  const [isStopped, setIsStopped] = useState(false);
  const [partialResponse, setPartialResponse] = useState('');
  const [stopStartTime, setStopStartTime] = useState(null);
  const abortControllerRef = useRef(null);
  
  // UX Phase 2: Message actions
  const [hoveredMessageIndex, setHoveredMessageIndex] = useState(null);
  const [focusedMessageIndex, setFocusedMessageIndex] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [deletedMessage, setDeletedMessage] = useState(null);
  
  // UX Phase 2: Collapsible thoughts
  const [collapsedMessages, setCollapsedMessages] = useState(new Set());
  const [messageTimings, setMessageTimings] = useState({});
  const [generationStartTime, setGenerationStartTime] = useState(null);
  const [firstTokenTime, setFirstTokenTime] = useState(null);
  const [isHoveringSteps, setIsHoveringSteps] = useState(null);
  
  // IME protection
  const [isComposing, setIsComposing] = useState(false);
  
  // UX Phase 3: In-conversation search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  
  // UX Phase 3: Quick switcher
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [switcherQuery, setSwitcherQuery] = useState('');
  const [conversations, setConversations] = useState([]);
  const [selectedConvIndex, setSelectedConvIndex] = useState(0);
  const [screenshotData, setScreenshotData] = useState(null); // Store base64 screenshot
  const [welcomeStep, setWelcomeStep] = useState(1);
  const [welcomeData, setWelcomeData] = useState({
    name: '',
    role: '',
    primaryUse: '',
    workStyle: '',
  });
  const inputRef = useRef(null);
  const textareaRef = useRef(null);
  const thoughtsEndRef = useRef(null);
  const windowIdRef = useRef(`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
  const channelRef = useRef(null);
  const skipBroadcastRef = useRef(false);
  const latestStateRef = useRef({ signature: null, payload: null });
  const isEditingMessageRef = useRef(false);
  const { profile, addToHistory } = useStore();
  const [isMessageFocused, setIsMessageFocused] = useState(false);

  // UX: Draft autosave
  const [draftSessionId, setDraftSessionId] = useState(null);
  const [showInputHint, setShowInputHint] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);

  // Load hint dismiss state
  useEffect(() => {
    const dismissed = localStorage.getItem('composer.hint_dismissed');
    setHintDismissed(dismissed === 'true');
  }, []);

  // Load draft on mount
  useEffect(() => {
    const sessionId = 'current'; // TODO: Get actual session ID
    setDraftSessionId(sessionId);
    const draft = localStorage.getItem(`amx:draft:${sessionId}`);
    if (draft) {
      setMessage(draft);
      console.log('[UX] Draft restored');
      telemetry.logInteraction({
        event: 'composer.draft_restored',
        data: { length: draft.length },
        metadata: { ux_schema: 'v1' },
      });
    }

    // UX Phase 2: Restore last mode per position (if pill window)
    if (isPillWindow && window.electron?.getBounds) {
      window.electron.getBounds().then((bounds) => {
        const posKey = `amx:mode.last:${Math.round(bounds.x / 100)},${Math.round(bounds.y / 100)}`;
        const lastMode = localStorage.getItem(posKey);
        if (lastMode) {
          console.log(`[UX] Restoring last mode: ${lastMode}`);
          telemetry.logInteraction({
            event: 'mode.resumed_last',
            data: { mode: lastMode, resumed: true },
            metadata: { ux_schema: 'v1' },
          });
          // Apply mode based on stored value
          if (lastMode === 'bar') {
            setIsMini(false);
            setIsBar(true);
          } else if (lastMode === 'card') {
            showCardWindow();
          }
        } else {
          telemetry.logInteraction({
            event: 'mode.resumed_last',
            data: { resumed: false },
            metadata: { ux_schema: 'v1' },
          });
        }
      }).catch((e) => console.error('[UX] Failed to get bounds:', e));
    }
  }, [isPillWindow]);

  // Autosave draft (debounced)
  useEffect(() => {
    if (!draftSessionId || !message) return;
    
    const timer = setTimeout(() => {
      localStorage.setItem(`amx:draft:${draftSessionId}`, message);
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [message, draftSessionId]);
  
  // UX Phase 2: Auto-expand on multiline (debounced to avoid flicker)
  // IME protection: Don't auto-expand while composing
  useEffect(() => {
    if (!isBar || !textareaRef.current || isComposing) return;
    
    const timer = setTimeout(() => {
      const el = textareaRef.current;
      if (el && el.scrollHeight > el.clientHeight + 4 && !isComposing) {
        // Multi-line detected
        console.log('[UX] Auto-expanding to Card (multiline)');
        if (!isCardWindow) {
          showCardWindow();
          telemetry.logInteraction({
            event: 'mode.auto_expand_reason',
            data: { reason: 'multiline' },
            metadata: { ux_schema: 'v1', conversation_id: draftSessionId, mode: 'bar' },
          });
        }
      }
    }, 80); // 80ms debounce to wait for font load
    
    return () => clearTimeout(timer);
  }, [message, isBar, isCardWindow, isComposing]);
  
  // UX Phase 2: Save mode preference per position on mode change
  useEffect(() => {
    if (!isPillWindow || isCardWindow) return;
    
    const saveMode = async () => {
      if (window.electron?.getBounds) {
        try {
          const bounds = await window.electron.getBounds();
          const posKey = `amx:mode.last:${Math.round(bounds.x / 100)},${Math.round(bounds.y / 100)}`;
          const currentMode = isOpen ? 'card' : isBar ? 'bar' : 'pill';
          localStorage.setItem(posKey, currentMode);
          console.log(`[UX] Saved mode: ${currentMode} for position`);
        } catch (e) {
          console.error('[UX] Failed to save mode:', e);
        }
      }
    };
    
    saveMode();
  }, [isOpen, isBar, isMini, isPillWindow, isCardWindow]);

  // Show hint on focus
  useEffect(() => {
    if (isMessageFocused && !hintDismissed && message.length === 0) {
      setShowInputHint(true);
    } else {
      setShowInputHint(false);
    }
  }, [isMessageFocused, hintDismissed, message]);

  // Simple connection status check (can be enhanced later)
  const [isConnected, setIsConnected] = useState(true);

  // Semantic suggestions
  const [similarGoals, setSimilarGoals] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Streaming state for fake streaming effect
  const [isStreaming, setIsStreaming] = useState(false);

  const [isTransitioning, setIsTransitioning] = useState(false);

  // Tools panel
  const [showToolsPanel, setShowToolsPanel] = useState(false);

  // Open Settings window
  const handleOpenSettings = async () => {
    try {
      if (window.electron?.openSettings) {
        await window.electron.openSettings();
      } else if (window.electronAPI?.openSettings) {
        await window.electronAPI.openSettings();
      } else {
        toast.error('Settings window unavailable. Please restart the app.');
        console.error('[FloatBar] electron.openSettings not available:', {
          electron: !!window.electron,
          electronAPI: !!window.electronAPI,
        });
      }
    } catch (error) {
      console.error('[FloatBar] Failed to open settings:', error);
      toast.error('Failed to open settings window');
    }
  };

  // Helper: Stream text word-by-word for better perceived speed
  const streamText = async (text, callback) => {
    const words = text.split(' ');
    let displayed = '';

    for (let i = 0; i < words.length; i++) {
      displayed += words[i] + (i < words.length - 1 ? ' ' : '');
      callback(displayed);
      await new Promise((resolve) => setTimeout(resolve, 40)); // 40ms per word
    }
  };

  const getFriendlyThinking = (step) => {
    const friendlyMap = {
      analyze_image: 'Looking at your screen',
      execute_command: 'Running command',
      respond: 'Thinking',
      done: 'Complete',
    };

    // Try pre-defined map first
    if (friendlyMap[step.action]) {
      return friendlyMap[step.action];
    }

    // Shorten technical phrases
    const reasoning = step.reasoning || '';
    const lowerReasoning = reasoning.toLowerCase();

    if (lowerReasoning.includes('check if') || lowerReasoning.includes('checking')) {
      return 'Checking tools';
    }
    if (lowerReasoning.includes('weather') || lowerReasoning.includes('temperature')) {
      return 'Getting weather';
    }
    if (
      lowerReasoning.includes('restaurant') ||
      lowerReasoning.includes('food') ||
      lowerReasoning.includes('place')
    ) {
      return 'Finding places';
    }
    if (lowerReasoning.includes('screenshot') || lowerReasoning.includes('screen')) {
      return 'Looking';
    }
    if (lowerReasoning.includes('install') || lowerReasoning.includes('download')) {
      return 'Installing';
    }
    if (lowerReasoning.includes('search') || lowerReasoning.includes('find')) {
      return 'Searching';
    }

    // Default: Show first 5 words
    const words = reasoning.split(' ').slice(0, 5);
    return words.join(' ') + (reasoning.split(' ').length > 5 ? '...' : '');
  };

  const showCardWindow = useCallback(async () => {
    setIsBar(false);
    setIsMini(false);
    setIsOpen(true);

    if (isPillWindow && window.electron?.showCardWindow) {
      try {
        await window.electron.showCardWindow();
      } catch (error) {
        console.error('[FloatBar] Failed to open card window:', error);
      }
    }

    if (channelRef.current) {
      channelRef.current.postMessage({
        type: 'window:mode',
        source: windowIdRef.current,
        mode: 'card',
      });
    }
  }, [isPillWindow]);

  const showPillWindow = useCallback(async () => {
    if (isCardWindow && window.electron?.showPillWindow) {
      try {
        await window.electron.showPillWindow();
      } catch (error) {
        console.error('[FloatBar] Failed to return to pill window:', error);
      }

      if (channelRef.current) {
        channelRef.current.postMessage({
          type: 'window:mode',
          source: windowIdRef.current,
          mode: 'pill',
        });
      }
      return;
    }

    setIsOpen(false);
    setIsBar(false);
    setIsMini(true);

    if (channelRef.current) {
      channelRef.current.postMessage({
        type: 'window:mode',
        source: windowIdRef.current,
        mode: 'pill',
      });
    }
  }, [isCardWindow]);

  const buildSharedState = useCallback(() => {
    return {
      profile,
      thoughts,
      progress,
      currentCommand,
      isThinking,
      similarGoals,
      showSuggestions,
      message,
      isStreaming,
      isConnected,
      screenshotData,
      welcomeData,
      welcomeStep,
      isLoading,
    };
  }, [
    profile,
    thoughts,
    progress,
    currentCommand,
    isThinking,
    similarGoals,
    showSuggestions,
    message,
    isStreaming,
    isConnected,
    screenshotData,
    welcomeData,
    welcomeStep,
    isLoading,
  ]);

  const broadcastState = useCallback(
    (source = windowIdRef.current) => {
      if (!channelRef.current || skipBroadcastRef.current) {
        return;
      }

      const payload = buildSharedState();
      const signature = JSON.stringify(payload);

      if (latestStateRef.current.signature === signature) {
        return;
      }

      latestStateRef.current = { signature, payload };

      channelRef.current.postMessage({
        type: 'state:update',
        source,
        state: payload,
      });
    },
    [buildSharedState]
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
      return;
    }

    const channel = new BroadcastChannel('agent-max-floatbar');
    channelRef.current = channel;

    channel.onmessage = (event) => {
      const { type, state, source } = event.data || {};

      if (source === windowIdRef.current) {
        return;
      }

      if (type === 'state:request') {
        broadcastState();
        return;
      }

      if (type !== 'state:update') {
        return;
      }

      skipBroadcastRef.current = true;
      try {
        if (state.profile) {
          useStore.setState({ profile: state.profile });
        }
        if (Array.isArray(state.thoughts)) {
          setThoughts(state.thoughts);
        }
        if (typeof state.progress === 'number') {
          setProgress(state.progress);
        }
        if (typeof state.currentCommand === 'string') {
          setCurrentCommand(state.currentCommand);
        }
        setIsThinking(Boolean(state.isThinking));
        if (Array.isArray(state.similarGoals)) {
          setSimilarGoals(state.similarGoals);
        }
        setShowSuggestions(Boolean(state.showSuggestions));
        if (typeof state.message === 'string' && !isEditingMessageRef.current) {
          setMessage(state.message);
        }
        setIsStreaming(Boolean(state.isStreaming));
        setIsConnected(Boolean(state.isConnected));
        setScreenshotData(state.screenshotData || null);
        if (state.welcomeData) {
          setWelcomeData({
            name: state.welcomeData.name || '',
            role: state.welcomeData.role || '',
            primaryUse: state.welcomeData.primaryUse || '',
            workStyle: state.welcomeData.workStyle || '',
          });
        }
        if (typeof state.welcomeStep === 'number') {
          setWelcomeStep(state.welcomeStep);
        }

        const signature = JSON.stringify(state);
        latestStateRef.current = { signature, payload: state };
      } finally {
        skipBroadcastRef.current = false;
      }
    };

    channel.postMessage({ type: 'state:announce', source: windowIdRef.current });

    if (isCardWindow) {
      channel.postMessage({ type: 'state:request', source: windowIdRef.current });
    }

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [broadcastState, isCardWindow]);

  useEffect(() => {
    if (!channelRef.current || skipBroadcastRef.current) {
      return;
    }

    broadcastState();
  }, [broadcastState]);

  useEffect(() => {
    if (isCardWindow) {
      setIsOpen(true);
      setIsMini(false);
      setIsBar(false);
    } else if (isPillWindow) {
      setIsOpen(false);
      setIsBar(false);
      setIsMini(true);
    }
  }, [isCardWindow, isPillWindow]);

  // Window resize handler
  useEffect(() => {
    if (isCardWindow) {
      return;
    }
    let cancelled = false;
    let rafId;

    const finishTransition = () => {
      rafId = window.requestAnimationFrame(() => {
        if (!cancelled) {
          setIsTransitioning(false);
        }
      });
    };

    const resizeWindow = async () => {
      setIsTransitioning(true);

      try {
        if (window.electron?.resizeWindow) {
          if (isOpen) {
            // Full card mode with conversation
            console.log('[FloatBar] Resizing to CARD mode: 360x520');
            await window.electron.resizeWindow(360, 520);
          } else if (isBar) {
            // Horizontal bar mode (same height as mini square)
            console.log('[FloatBar] Resizing to BAR mode: 320x68');
            await window.electron.resizeWindow(320, 68);
          } else if (isMini) {
            // Mini square mode
            console.log('[FloatBar] Resizing to MINI mode: 68x68');
            await window.electron.resizeWindow(68, 68);
          }

          // Debug: Check actual window size after resize
          if (window.electron?.getBounds) {
            const bounds = await window.electron.getBounds();
            console.log('[FloatBar] Actual window bounds after resize:', bounds);
          }
        }
      } finally {
        finishTransition();
      }
    };

    resizeWindow();

    return () => {
      cancelled = true;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [isOpen, isBar, isMini, isCardWindow]);

  // Keep window on screen (boundary checking)
  // Only adjusts position, not size - runs periodically to catch manual drags
  useEffect(() => {
    if (isCardWindow) {
      return;
    }
    const checkBoundaries = async () => {
      if (
        window.electron?.getBounds &&
        window.electron?.setBounds &&
        window.electron?.getScreenSize
      ) {
        try {
          const bounds = await window.electron.getBounds();
          const screenSize = await window.electron.getScreenSize();

          let { x, y, width, height } = bounds;
          let changed = false;

          // Ensure window doesn't go off-screen (with 10px margin)
          const margin = 10;

          // Right edge
          if (x + width > screenSize.width - margin) {
            x = screenSize.width - width - margin;
            changed = true;
          }
          // Bottom edge
          if (y + height > screenSize.height - margin) {
            y = screenSize.height - height - margin;
            changed = true;
          }
          // Left edge
          if (x < margin) {
            x = margin;
            changed = true;
          }
          // Top edge
          if (y < margin) {
            y = margin;
            changed = true;
          }

          // Only update position if needed (preserve width/height)
          if (changed) {
            console.log('[FloatBar] Adjusting position to stay on screen:', { x, y });
            await window.electron.setBounds({ x, y, width, height });
          }
        } catch (error) {
          console.error('[FloatBar] Boundary check error:', error);
        }
      }
    };

    // Check boundaries periodically (every 2 seconds to catch drags)
    const interval = setInterval(checkBoundaries, 2000);

    // Also check immediately on state changes
    checkBoundaries();

    return () => clearInterval(interval);
  }, [isOpen, isBar, isMini]);

  // Keyboard shortcuts
  useEffect(() => {
    function onHotkey(e) {
      // Mode toggle: Cmd+Alt+C (Mac) / Ctrl+Alt+C (Win/Linux)
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        // Toggle through states: mini -> bar -> card
        if (isMini) {
          setIsMini(false);
          setIsBar(true);
          setTimeout(() => inputRef.current?.focus(), 100);
        } else if (isBar) {
          setIsBar(false);
          setIsMini(false);
          setIsOpen(true);
        } else {
          setIsOpen(false);
          setIsBar(false);
          setIsMini(true);
        }
      }
      
      // Escape to collapse
      if (e.key === 'Escape') {
        // Close search if open
        if (showSearch) {
          setShowSearch(false);
          setSearchQuery('');
          setSearchResults([]);
          return;
        }
        // Close switcher if open
        if (showSwitcher) {
          setShowSwitcher(false);
          setSwitcherQuery('');
          setSelectedConvIndex(0);
          return;
        }
        // Close delete confirm if open
        if (showDeleteConfirm !== null) {
          setShowDeleteConfirm(null);
          return;
        }
        // Don't delete draft on Esc if composer has content
        if (message.trim().length > 0) {
          // Just blur the input, don't back out
          document.activeElement?.blur();
          return;
        }
        showPillWindow();
      }
      
      // Cmd/Ctrl+F: Open search
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f' && !e.shiftKey) {
        e.preventDefault();
        setShowSearch(true);
        telemetry.logInteraction({
          event: 'conv.search_opened',
          data: {},
          metadata: { ux_schema: 'v1', conversation_id: draftSessionId },
        });
      }
      
      // Cmd/Ctrl+K: Open quick switcher
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && !showSearch) {
        e.preventDefault();
        setShowSwitcher(true);
        loadConversations();
        telemetry.logInteraction({
          event: 'conv.switcher_opened',
          data: {},
          metadata: { ux_schema: 'v1' },
        });
      }
      
      // Message actions (only if a message is focused)
      if (focusedMessageIndex !== null) {
        const message = thoughts[focusedMessageIndex];
        
        // C: Copy
        if (e.key.toLowerCase() === 'c' && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          handleCopyMessage(message, focusedMessageIndex);
        }
        
        // R: Regenerate (assistant messages only)
        if (e.key.toLowerCase() === 'r' && message.type === 'agent') {
          e.preventDefault();
          handleRegenerateMessage(focusedMessageIndex);
        }
        
        // E: Edit (user messages only)
        if (e.key.toLowerCase() === 'e' && message.type === 'user') {
          e.preventDefault();
          // Show fork dialog in real implementation
          handleEditMessage(message, focusedMessageIndex, false);
        }
        
        // Backspace: Delete (with confirm)
        if (e.key === 'Backspace' && !e.target.matches('input, textarea')) {
          e.preventDefault();
          handleDeleteMessage(focusedMessageIndex);
        }
      }
    }
    window.addEventListener('keydown', onHotkey);
    return () => window.removeEventListener('keydown', onHotkey);
  }, [isMini, isBar, showCardWindow, showPillWindow, focusedMessageIndex, thoughts, showDeleteConfirm]);

  // SSE streaming (placeholder - connect to your backend)
  useEffect(() => {
    if (!isOpen) return;

    // Example SSE connection - adjust URL to your backend
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    // Uncomment when backend streaming endpoint is ready
    /*
    const es = new EventSource(`${apiUrl}/v1/chat/stream`, { withCredentials: true });
    
    es.addEventListener('thought', (e) => {
      setThoughts((prev) => [...prev, e.data]);
    });
    
    es.addEventListener('progress', (e) => {
      setProgress(Number(e.data));
    });
    
    es.addEventListener('final', (e) => {
      const data = JSON.parse(e.data);
      if (data.command) {
        setCurrentCommand(data.command);
      }
    });
    
    es.onerror = () => {
      es.close();
    };
    
    return () => {
      es.close();
    };
    */
  }, [isOpen]);

  const handleScreenshot = async () => {
    try {
      if (window.electron?.takeScreenshot) {
        const screenshot = await window.electron.takeScreenshot();

        if (screenshot && screenshot.base64) {
          // Store base64 image data
          setScreenshotData(screenshot.base64);
          const sizeKB = Math.round(screenshot.size / 1024);
          console.log(`[FloatBar] Screenshot attached (${sizeKB}KB)`);
          toast.success(`Screenshot attached (${sizeKB}KB)`);
          
          // UX Phase 2: Auto-expand to Card on attachment
          if (!isOpen && !isCardWindow) {
            console.log('[UX] Auto-expanding to Card (attachment)');
            showCardWindow();
            telemetry.logInteraction({
              event: 'mode.auto_expand_reason',
              data: { reason: 'attachment' },
              metadata: { ux_schema: 'v1' },
            });
          }
        }
      } else {
        toast.error('Screenshot feature not available');
      }
    } catch (error) {
      console.error('[FloatBar] Screenshot error:', error);
      toast.error('Failed to take screenshot');
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      const elapsed = stopStartTime ? Date.now() - stopStartTime : 0;
      console.log('[UX] Stop clicked, elapsed:', elapsed);
      
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      
      setIsThinking(false);
      setThinkingStatus('');
      setProgress(0);
      setStopStartTime(null);
      
      // UX: Auto-collapse thoughts after short delay
      const generationDuration = Date.now() - (generationStartTime || Date.now());
      const currentMessageIndex = thoughts.length - 1;
      
      // Short replies (<5s) collapse immediately
      if (generationDuration < 5000) {
        setCollapsedMessages(prev => new Set([...prev, currentMessageIndex]));
      } else {
        // Long replies: auto-collapse after 500ms unless hovering
        setTimeout(() => {
          if (isHoveringSteps !== currentMessageIndex) {
            setCollapsedMessages(prev => new Set([...prev, currentMessageIndex]));
            telemetry.logInteraction({
              event: 'thoughts.auto_collapsed',
              data: { step_count: allSteps?.length || 0, total_ms: generationDuration },
              metadata: { ux_schema: 'v1', conversation_id: draftSessionId },
            });
          }
        }, 500);
      }
      
      // Store timing for this message
      setMessageTimings(prev => ({
        ...prev,
        [currentMessageIndex]: {
          started_at: generationStartTime,
          first_token_at: firstTokenTime,
          completed_at: Date.now(),
          duration_ms: generationDuration,
          steps: allSteps || [],
        },
      }));
      
      telemetry.logInteraction({
        event: 'gen.stop_clicked',
        data: { elapsed_ms: elapsed },
        metadata: { ux_schema: 'v1' },
      });
      
      toast.success('Generation stopped');
    }
  };
  
  // UX Phase 2: Message actions
  const handleCopyMessage = (message, index) => {
    const text = message.content || message.text || '';
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
    telemetry.logInteraction({
      event: 'msg.action',
      data: { type: 'copy', message_index: index },
      metadata: { ux_schema: 'v1' },
    });
  };
  
  const handleRegenerateMessage = async (index) => {
    // Find the last user message before this assistant message
    let userPromptIndex = -1;
    for (let i = index - 1; i >= 0; i--) {
      if (thoughts[i].type === 'user') {
        userPromptIndex = i;
        break;
      }
    }
    
    if (userPromptIndex === -1) {
      toast.error('Cannot find original prompt');
      return;
    }
    
    const userPrompt = thoughts[userPromptIndex].content;
    console.log('[UX] Regenerating from prompt:', userPrompt);
    
    // Remove the assistant message
    setThoughts(prev => prev.filter((_, i) => i !== index));
    
    // Set the prompt and trigger send
    setMessage(userPrompt);
    
    telemetry.logInteraction({
      event: 'msg.action',
      data: { type: 'regenerate', message_index: index },
      metadata: { ux_schema: 'v1' },
    });
    
    // Auto-send
    setTimeout(() => handleSendMessage(), 100);
  };
  
  const handleEditMessage = (message, index, fork = false) => {
    if (message.type !== 'user') return;
    
    if (fork) {
      // Fork: Create new branch from this point
      console.log('[UX] Forking from message', index);
      setThoughts(prev => prev.slice(0, index + 1));
      telemetry.logInteraction({
        event: 'thread.forked',
        data: { from_index: index, fork: true },
        metadata: { ux_schema: 'v1' },
      });
      toast.success('Forked conversation');
    } else {
      // Edit in place
      console.log('[UX] Editing message in place', index);
      telemetry.logInteraction({
        event: 'msg.action',
        data: { type: 'edit', message_index: index, fork: false },
        metadata: { ux_schema: 'v1' },
      });
    }
    
    // Load into composer
    setMessage(message.content);
    
    // Focus input
    setTimeout(() => inputRef.current?.focus(), 100);
  };
  
  const handleDeleteMessage = (index) => {
    // Show confirmation
    setShowDeleteConfirm(index);
  };
  
  const confirmDeleteMessage = (index) => {
    const deleted = thoughts[index];
    
    // Save for undo
    setDeletedMessage({ message: deleted, index });
    
    // Remove message
    setThoughts(prev => prev.filter((_, i) => i !== index));
    
    // Show undo toast
    toast.success(
      (t) => (
        <div className="flex items-center gap-2">
          <span>Message deleted</span>
          <button
            onClick={() => {
              // Restore message
              setThoughts(prev => {
                const newThoughts = [...prev];
                newThoughts.splice(index, 0, deleted);
                return newThoughts;
              });
              setDeletedMessage(null);
              toast.dismiss(t.id);
              toast.success('Message restored');
              telemetry.logInteraction({
                event: 'msg.undo_delete',
                data: { message_index: index },
                metadata: { ux_schema: 'v1' },
              });
            }}
            className="px-2 py-1 bg-white/20 rounded text-sm hover:bg-white/30"
          >
            Undo
          </button>
        </div>
      ),
      { duration: 5000 }
    );
    
    setShowDeleteConfirm(null);
    
    telemetry.logInteraction({
      event: 'msg.action',
      data: { type: 'delete', message_index: index },
      metadata: { ux_schema: 'v1' },
    });
  };

  // UX Phase 3: Search logic
  const performSearch = (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setCurrentSearchIndex(0);
      return;
    }
    
    const lowerQuery = query.toLowerCase();
    const results = thoughts
      .map((thought, idx) => ({
        index: idx,
        content: thought.content,
        type: thought.type,
      }))
      .filter(r => 
        (r.type === 'user' || r.type === 'agent') && 
        r.content.toLowerCase().includes(lowerQuery)
      );
    
    setSearchResults(results);
    setCurrentSearchIndex(results.length > 0 ? 0 : -1);
    
    telemetry.logInteraction({
      event: 'conv.search_query',
      data: { query_length: query.length, hit_count: results.length },
      metadata: { ux_schema: 'v1', conversation_id: draftSessionId },
    });
    
    // Scroll to first result
    if (results.length > 0) {
      scrollToSearchResult(0);
    }
  };

  const scrollToSearchResult = (resultIdx) => {
    if (resultIdx < 0 || resultIdx >= searchResults.length) return;

    const messageIdx = searchResults[resultIdx].index;
    const messageEl = document.querySelector(`[data-message-idx="${messageIdx}"]`);
    if (messageEl) {
      messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const nextSearchResult = () => {
    if (searchResults.length === 0) return;
    const nextIdx = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(nextIdx);
    scrollToSearchResult(nextIdx);
    telemetry.logInteraction({
      event: 'conv.search_nav',
      data: { direction: 'next' },
      metadata: { ux_schema: 'v1' },
    });
  };

  const prevSearchResult = () => {
    if (searchResults.length === 0) return;
    const prevIdx = currentSearchIndex === 0 ? searchResults.length - 1 : currentSearchIndex - 1;
    setCurrentSearchIndex(prevIdx);
    scrollToSearchResult(prevIdx);
    telemetry.logInteraction({
      event: 'conv.search_nav',
      data: { direction: 'prev' },
      metadata: { ux_schema: 'v1' },
    });
  };

  // UX Phase 3: Quick switcher logic
  const loadConversations = async () => {
    try {
      const memoryService = (await import('../services/memory')).default;
      if (!memoryService.initialized) {
        await memoryService.initialize();
      }

      // Get last 20 sessions (placeholder - implement getAllSessions in memory service)
      // For now, create mock data
      setConversations([
        {
          id: 'current',
          title: 'Current conversation',
          messageCount: thoughts.length,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      console.error('[Switcher] Failed to load conversations:', error);
      setConversations([]);
    }
  };

  const selectConversation = (conv) => {
    console.log('[Switcher] Selected:', conv.id);
    setShowSwitcher(false);
    setSwitcherQuery('');

    telemetry.logInteraction({
      event: 'conv.switcher_used',
      data: { conversation_id: conv.id },
      metadata: { ux_schema: 'v1' },
    });

    // TODO: Load conversation messages
    toast.info('Loading conversation...');
  };

  const handleContinue = async () => {
    if (!partialResponse) {
      toast.error('No partial response to continue from');
      return;
    }
    
    console.log('[UX] Continue clicked, partial length:', partialResponse.length);
    
    telemetry.logInteraction({
      event: 'gen.continue_clicked',
      data: { continuation_length: partialResponse.length },
      metadata: { ux_schema: 'v1' },
    });
    
    // Reset stopped state
    setIsStopped(false);
    setPartialResponse('');
    
    // TODO: Implement actual continuation logic
    // This would involve sending the partial response as context
    toast.info('Continue not yet implemented');
  };

  const handleSendMessage = async () => {
    const trimmedMessage = message.trim();

    // Validation
    if (!trimmedMessage) return;

    if (trimmedMessage.length > 2000) {
      toast.error('Message too long (max 2000 characters)');
      return;
    }

    if (trimmedMessage.length < 2) {
      toast.error('Message too short (min 2 characters)');
      return;
    }

    const userMessage = trimmedMessage;

    // Add user message to UI
    setThoughts((prev) => [...prev, { type: 'user', content: userMessage }]);
    setMessage('');
    isEditingMessageRef.current = false;
    setProgress(0);

    try {
      // ⚡ CHECK CACHE FIRST (instant response for repeated questions!)
      console.log('[Cache] Checking cache for:', userMessage);
      const cachedResult = responseCache.getCachedResponse(userMessage);
      console.log('[Cache] Cache result:', cachedResult);

      if (cachedResult && cachedResult.cached && !screenshotData) {
        // INSTANT CACHED RESPONSE
        console.log('[Cache] Using cached response - instant!');

        // Show cached indicator
        setThoughts((prev) => [
          ...prev,
          {
            type: 'thought',
            content:
              cachedResult.cacheType === 'exact'
                ? '⚡ Instant (exact match)'
                : `⚡ Instant (${(cachedResult.similarity * 100).toFixed(0)}% similar)`,
          },
        ]);

        // Add cached AI response with streaming effect
        setIsStreaming(true);
        const responseIndex = thoughts.length;
        setThoughts((prev) => [...prev, { type: 'agent', content: '' }]);

        await streamText(cachedResult.response, (partial) => {
          setThoughts((prev) => {
            const newThoughts = [...prev];
            if (newThoughts.length > 0) {
              newThoughts[newThoughts.length - 1] = {
                type: 'agent',
                content: partial,
              };
            }
            return newThoughts;
          });
        });

        setIsStreaming(false);
        setIsThinking(false);
        setProgress(0);

        toast.success('⚡ Instant response from cache!', { duration: 2000 });
        return; // Exit early - no API call needed!
      }

      if (!autoSend) {
        setProgress(0);
        toast.success('Message captured (auto-send disabled)');
        return;
      }

      // Import services
      const memoryService = (await import('../services/memory')).default;
      const { chatAPI } = await import('../services/api');

      if (!memoryService.initialized) {
        await memoryService.initialize();
      }

      await memoryService.addMessage('user', userMessage);

      // UX: Progressive status states
      setIsThinking(true);
      setThinkingStatus('connecting');
      setProgress(10);
      setIsStopped(false);
      setPartialResponse('');
      setStopStartTime(Date.now());
      
      // UX: Track generation timing for collapsible thoughts
      const genStartTime = Date.now();
      setGenerationStartTime(genStartTime);
      setFirstTokenTime(null);
      
      // Create abort controller for this generation
      abortControllerRef.current = new AbortController();
      
      setThoughts((prev) => [...prev, { type: 'thought', content: 'Connecting...' }]);

      // After 150ms → Thinking
      setTimeout(() => {
        setThinkingStatus('thinking');
        setProgress(20);
        const thinkingMsg = screenshotData ? 'Looking at your screenshot...' : 'Thinking...';
        setThoughts((prev) => {
          const newThoughts = [...prev];
          if (newThoughts.length > 0 && newThoughts[newThoughts.length - 1].type === 'thought') {
            newThoughts[newThoughts.length - 1].content = thinkingMsg;
          }
          return newThoughts;
        });
      }, 150);

      setProgress(40);
      const userContext = await memoryService.buildContextForAPI();

      if (similarGoals.length > 0 && similarGoals[0].similarity >= 0.7) {
        const topMatch = similarGoals[0];
        console.log(
          `[Semantic] High similarity (${(topMatch.similarity * 100).toFixed(0)}%) - Adding context`
        );

        userContext.semantic_context = {
          similar_question: topMatch.goal,
          similarity_score: topMatch.similarity,
          was_successful: topMatch.success,
          note: 'User asked something very similar before. Use this for context.',
        };
      }

      setProgress(60);
      let allSteps = [];
      let finalResponse = '';
      let factsExtracted = null;
      let executionTime = 0;
      let currentStepThought = null;

      // Track partial response for stop/continue
      let currentPartial = '';
      
      await chatAPI.sendMessageStream(userMessage, userContext, screenshotData, (event) => {
        // UX: Switch to "Answering" on first token
        if (event.message && thinkingStatus !== 'answering') {
          // Track first token time for TTFT
          if (!firstTokenTime) {
            const ttft = Date.now() - genStartTime;
            setFirstTokenTime(Date.now());
            telemetry.logInteraction({
              event: 'ux.ttft_ms',
              data: { ttft_ms_client: ttft },
              metadata: { 
                ux_schema: 'v1',
                conversation_id: draftSessionId,
                mode: isOpen ? 'card' : isBar ? 'bar' : 'pill'
              },
            });
          }
          
          setThinkingStatus('answering');
          setThoughts((prev) => {
            const newThoughts = [...prev];
            if (newThoughts.length > 0 && newThoughts[newThoughts.length - 1].type === 'thought') {
              newThoughts[newThoughts.length - 1].content = 'Answering...';
            }
            return newThoughts;
          });
        }
        
        if (event.message) {
          if (!currentStepThought) {
            currentStepThought = { type: 'thought', content: event.message };
            setThoughts((prev) => [...prev, currentStepThought]);
          } else {
            currentStepThought.content = event.message;
            setThoughts((prev) => {
              const newThoughts = [...prev];
              newThoughts[newThoughts.length - 1] = { ...currentStepThought };
              return newThoughts;
            });
          }
        } else if (event.step_number !== undefined) {
          const stepText = `Step ${event.step_number}: ${event.reasoning}`;
          setThoughts((prev) => [
            ...prev,
            {
              type: 'thought',
              content: stepText,
              step: event,
            },
          ]);
          allSteps.push(event);
          currentStepThought = null;
          setProgress(60 + event.step_number * 5);
        } else if (event.final_response) {
          finalResponse = event.final_response;
          currentPartial = event.final_response;
          allSteps = event.steps || allSteps;
          factsExtracted = event.facts_extracted;
          executionTime = event.execution_time;
          setProgress(100);
        } else if (event.error) {
          throw new Error(event.error);
        }
      });

      setIsConnected(true);

      const aiResponse = finalResponse || 'No response';

      await memoryService.addMessage('assistant', aiResponse);

      if (factsExtracted && Object.keys(factsExtracted).length > 0) {
        const facts = factsExtracted;
        console.log('[Memory] Facts extracted by backend:', facts);

        let factCount = 0;
        for (const [category, data] of Object.entries(facts)) {
          if (data && typeof data === 'object') {
            for (const [key, value] of Object.entries(data)) {
              try {
                await memoryService.setFact(category, key, value);
                console.log(`[Memory] ✓ Saved fact: ${category}.${key} = ${JSON.stringify(value)}`);
                factCount++;
              } catch (error) {
                console.error(`[Memory] ✗ Failed to save fact ${category}.${key}:`, error);
              }
            }
          }
        }

        if (factCount > 0) {
          toast.success(`Learned ${factCount} new thing${factCount > 1 ? 's' : ''} about you!`, {
            duration: 3000,
          });
        }
      }

      setIsStreaming(true);

      const responseIndex = thoughts.length;
      setThoughts((prev) => [
        ...prev,
        {
          type: 'agent',
          content: '',
        },
      ]);

      await streamText(aiResponse, (partial) => {
        setThoughts((prev) => {
          const newThoughts = [...prev];
          if (newThoughts.length > 0) {
            newThoughts[newThoughts.length - 1] = {
              type: 'agent',
              content: partial,
            };
          }
          return newThoughts;
        });
      });

      setIsStreaming(false);

      setIsThinking(false);

      try {
        const executionTimeMs = executionTime ? Math.round(executionTime * 1000) : null;

        telemetry.logInteraction({
          userPrompt: userMessage,
          aiResponse,
          aiThoughts: allSteps?.find((s) => s.reasoning)?.reasoning || null,
          toolsUsed:
            allSteps?.filter((s) => s.action && s.action !== 'respond').map((s) => s.action) || [],
          success: true,
          executionTime: executionTimeMs,
          model: 'autonomous-agent',
          metadata: {
            hasScreenshot: !!screenshotData,
            stepsCount: allSteps?.length || 0,
            factsExtracted: factsExtracted ? Object.keys(factsExtracted).length : 0,
            semanticContextUsed: !!userContext.semantic_context,
            streamingEnabled: true,
          },
        });
        console.log('[Telemetry] Interaction logged successfully');
      } catch (telemetryError) {
        console.warn('[Telemetry] Failed to log (non-critical):', telemetryError);
      }

      try {
        responseCache.cacheResponse(userMessage, aiResponse, {
          success: true,
          executionTime,
          model: 'autonomous-agent',
          stepsCount: allSteps?.length || 0,
        });
        console.log('[Cache] Response saved to cache');
      } catch (cacheError) {
        console.warn('[Cache] Failed to save (non-critical):', cacheError);
      }

      const summaryInfo = [];
      if (executionTime) {
        summaryInfo.push(`Completed in ${executionTime.toFixed(1)}s`);
      }
      if (allSteps && allSteps.length > 0) {
        summaryInfo.push(`Total steps: ${allSteps.length}`);
      }
      if (screenshotData) {
        summaryInfo.push('Screenshot was analyzed');
      }

      if (summaryInfo.length > 0) {
        setThoughts((prev) => [
          ...prev,
          {
            type: 'debug',
            content: summaryInfo.join('\n'),
          },
        ]);
      }

      if (screenshotData) {
        setScreenshotData(null);
        console.log('[FloatBar] Screenshot sent and cleared');
      }

      setIsThinking(false);
      setProgress(0);
    } catch (error) {
      console.error('[FloatBar] Message send error:', error);
      
      // Check if this was an abort (user clicked Stop)
      if (error.name === 'AbortError' || error.message?.includes('abort')) {
        console.log('[UX] Generation aborted by user');
        // Don't show error toast for intentional stops
        return;
      }
      
      setIsThinking(false);
      setProgress(0);
      setStopStartTime(null);
      abortControllerRef.current = null;

      // 📊 LOG ERROR TO TELEMETRY
      try {
        telemetry.logError(error, {
          severity: error.response?.status >= 500 ? 'critical' : 'error',
          context: {
            userPrompt: trimmedMessage,
            hasScreenshot: !!screenshotData,
            errorCode: error.code,
            statusCode: error.response?.status,
          },
        });
        console.log('[Telemetry] Error logged');
      } catch (telemetryError) {
        console.warn('[Telemetry] Failed to log error (non-critical):', telemetryError);
      }

      // Generate helpful error message based on error type
      let errorMsg = 'Failed to send message';
      let errorDetail = '';

      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        errorMsg = 'Cannot connect to backend';
        errorDetail =
          'The API server is not running. Please start it with:\ncd Agent_Max && ./start_api.sh';
        setIsConnected(false); // Update connection status
      } else if (error.response?.status === 404) {
        errorMsg = 'API endpoint not found';
        errorDetail = 'The backend may be outdated. Check that you have the latest version.';
      } else if (error.response?.status === 500) {
        errorMsg = 'Backend error';
        const detail = error.response?.data?.detail || error.response?.data?.final_response;
        errorDetail = detail || 'Internal server error';
        // Add full error details for debugging
        if (error.response?.data) {
          errorDetail += `\n\nFull error: ${JSON.stringify(error.response.data, null, 2)}`;
        }
      } else if (error.message?.includes('timeout') || error.code === 'ECONNABORTED') {
        errorMsg = 'Request timed out';
        errorDetail = 'The server is taking too long to respond. Try a simpler request.';
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        errorMsg = 'Authentication failed';
        errorDetail = 'Check your API key in settings.';
      } else if (error.response?.status === 429) {
        errorMsg = 'Rate limit exceeded';
        errorDetail = 'Too many requests. Please wait a moment and try again.';
      } else {
        errorDetail = error.message || 'Unknown error occurred';
        // Add full error for debugging
        if (error.response) {
          errorDetail += `\n\nStatus: ${error.response.status}`;
          errorDetail += `\nData: ${JSON.stringify(error.response.data, null, 2)}`;
        }
      }

      // Add error to thoughts
      setThoughts((prev) => [
        ...prev,
        {
          type: 'error',
          content: `${errorMsg}${errorDetail ? `\n${errorDetail}` : ''}`,
        },
      ]);

      // Clear screenshot on error
      setScreenshotData(null);

      // Show toast notification
      toast.error(errorMsg, {
        duration: 5000,
        style: {
          background: '#ef4444',
          color: '#fff',
        },
      });
    }
  };
  const handleResetConversation = async () => {
    // UX: Save state for undo
    const savedState = {
      thoughts: [...thoughts],
      progress,
      currentCommand,
      message,
    };
    
    // Generate summary before clearing if there are thoughts
    if (thoughts.length > 0) {
      try {
        console.log('[FloatBar] Generating conversation summary...');
        const summary = await generateConversationSummary(thoughts);
        console.log('[FloatBar] Summary generated:', summary);

        // Add to history
        addToHistory(summary, thoughts);
        
        // UX: Show undo option
        setClearedConversation(savedState);
        toast.success(
          (t) => (
            <div className="flex items-center gap-2">
              <span>Conversation cleared</span>
              <button
                onClick={() => {
                  // Restore state
                  setThoughts(savedState.thoughts);
                  setProgress(savedState.progress);
                  setCurrentCommand(savedState.currentCommand);
                  setMessage(savedState.message);
                  setClearedConversation(null);
                  toast.dismiss(t.id);
                  toast.success('Conversation restored');
                  telemetry.logInteraction({ event: 'conv.undo_clear', data: {} });
                }}
                className="px-2 py-1 bg-white/20 rounded text-sm hover:bg-white/30"
              >
                Undo
              </button>
            </div>
          ),
          { duration: 5000 }
        );
        
        telemetry.logInteraction({ event: 'conv.cleared', data: { message_count: thoughts.length } });
      } catch (error) {
        console.error('[FloatBar] Failed to generate summary:', error);
        // Still clear the conversation even if summary fails
      }
    }

    // Clear conversation
    setThoughts([]);
    setProgress(0);
    setCurrentCommand('');
    setMessage('');
    setIsThinking(false);
    setThinkingStatus('');
  };

  const handleRunCommand = () => {
    if (!currentCommand) return;
    setShowConfirmModal(true);
  };

  const confirmRunCommand = async () => {
    if (window.electron?.executeCommand) {
      const result = await window.electron.executeCommand(currentCommand);
      if (result.success) {
        toast.success('Command executed in terminal');
        setThoughts((prev) => [...prev, `✓ Executed: ${currentCommand}`]);
      } else {
        toast.error(`Failed: ${result.message}`);
      }
    } else {
      toast.error('Command execution not available');
    }
    setShowConfirmModal(false);
  };

  const handleCopyCommand = async () => {
    if (window.electron?.copyToClipboard) {
      await window.electron.copyToClipboard(currentCommand);
      toast.success('Copied to clipboard');
    } else {
      navigator.clipboard.writeText(currentCommand);
      toast.success('Copied to clipboard');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showWelcome && welcomeStep === 1) {
        handleWelcomeNext();
      } else {
        handleSendMessage();
      }
    }
  };

  // Convert URLs in text to clickable links
  const renderMessageWithLinks = (text) => {
    if (!text) return null;

    // URL regex pattern
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#7aa2ff',
              textDecoration: 'underline',
              cursor: 'pointer',
              wordBreak: 'break-all',
            }}
            onClick={(e) => {
              e.preventDefault();
              if (window.electron?.openExternal) {
                window.electron.openExternal(part);
              } else {
                window.open(part, '_blank');
              }
            }}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const handleWelcomeNext = () => {
    if (welcomeStep < 4) {
      setWelcomeStep(welcomeStep + 1);
    }
  };

  const handleWelcomeBack = () => {
    if (welcomeStep > 1) {
      setWelcomeStep(welcomeStep - 1);
    }
  };

  const handleWelcomeComplete = async () => {
    try {
      // Validate and trim data before saving
      const trimmedName = welcomeData.name?.trim();
      if (!trimmedName || trimmedName.length === 0) {
        toast.error('Please enter your name');
        return;
      }

      if (window.electron?.memory) {
        console.log('Saving onboarding data:', { ...welcomeData, name: trimmedName });
        await window.electron.memory.setName(trimmedName);
        await window.electron.memory.setPreference('role', welcomeData.role, 'work');
        await window.electron.memory.setPreference('primary_use', welcomeData.primaryUse, 'work');
        await window.electron.memory.setPreference('work_style', welcomeData.workStyle, 'work');
        await window.electron.memory.setPreference('onboarding_completed', 'true', 'system');
        console.log('Onboarding data saved successfully');
      } else {
        console.error('window.electron.memory is not available');
        toast.error('Memory system not available');
        return;
      }

      toast.success(`Welcome, ${trimmedName}!`);
      onWelcomeComplete({ ...welcomeData, name: trimmedName });
    } catch (error) {
      console.error('Failed to save onboarding:', error);
      toast.error(`Failed to save preferences: ${error.message}`);
    }
  };

  const canProceedWelcome = () => {
    switch (welcomeStep) {
      case 1:
        return welcomeData.name.trim().length > 0;
      case 2:
        return welcomeData.role.length > 0;
      case 3:
        return welcomeData.primaryUse.length > 0;
      case 4:
        return welcomeData.workStyle.length > 0;
      default:
        return false;
    }
  };

  // Auto-scroll to bottom when new thoughts arrive
  useEffect(() => {
    thoughtsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thoughts]);

  // Fetch similar goals as user types (debounced)
  useEffect(() => {
    if (!suggestionsEnabled || !isMessageFocused) {
      setSimilarGoals([]);
      setShowSuggestions(false);
      return;
    }

    if (!message || message.trim().length < 3) {
      setSimilarGoals([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const { semanticAPI } = await import('../services/api');
        const response = await semanticAPI.findSimilar(message.trim(), 0.7, 3);

        if (response.data.similar_goals && response.data.similar_goals.length > 0) {
          setSimilarGoals(response.data.similar_goals);
          setShowSuggestions(true);
        } else {
          setSimilarGoals([]);
          setShowSuggestions(false);
        }
      } catch (error) {
        console.log('[Semantic] Could not fetch similar goals:', error.message);
        setSimilarGoals([]);
        setShowSuggestions(false);
      }
    }, 800); // Wait 800ms after user stops typing

    return () => clearTimeout(timer);
  }, [message, isMessageFocused, suggestionsEnabled]);

  // Debug: Log computed styles for glassmorphism
  useEffect(() => {
    if (isMini) {
      const miniEl = document.querySelector('.amx-mini');
      if (miniEl) {
        const styles = window.getComputedStyle(miniEl);
        console.log('[FloatBar Debug] Mini pill styles:', {
          background: styles.background,
          backdropFilter: styles.backdropFilter,
          webkitBackdropFilter: styles.webkitBackdropFilter,
        });
      }
    }
  }, [isMini]);

  // Mini square mode - fully collapsed
  if (isMini) {
    return (
      <div
        className={`amx-root amx-mini amx-mini-draggable ${isTransitioning ? 'amx-transitioning' : ''}`}
        onClick={(e) => {
          // Click logo to expand
          console.log('[FloatBar] Mini clicked: Opening to bar mode');
          setIsMini(false);
          setIsBar(true);
          setIsOpen(false);
          requestAnimationFrame(() => {
            inputRef.current?.focus();
          });
        }}
      >
        <img src="/AgentMaxLogo.png" alt="Agent Max" className="amx-mini-logo" />
        {/* Drag handle visual indicator - 6-dot grid (2×3) */}
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

  // Horizontal bar mode - input bar (same height as mini)
  if (isBar) {
    return (
      <div className={`amx-root amx-bar ${isTransitioning ? 'amx-transitioning' : ''}`}>
        <input
          ref={inputRef}
          className="amx-bar-input"
          placeholder="Ask MAX..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onFocus={() => {
            isEditingMessageRef.current = true;
            setIsMessageFocused(true);
            // Expand to full chat if there's conversation
            if (thoughts.length > 0) {
              setIsBar(false);
              setIsMini(false);
              setIsOpen(true);
            }
          }}
          onBlur={() => {
            isEditingMessageRef.current = false;
            setIsMessageFocused(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && message.trim()) {
              // Hide suggestions and send message
              setShowSuggestions(false);
              // Send and expand to full chat
              setIsBar(false);
              setIsMini(false);
              setIsOpen(true);
              handleSendMessage();
            }
          }}
        />
        <button
          className="amx-bar-minimize-btn"
          onClick={() => {
            console.log('[FloatBar] Bar minimize clicked: Going to mini');
            setIsBar(false);
            setIsMini(true);
          }}
          title="Minimize"
        >
          <Minimize2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Active: Card mode
  return (
    <div className={`amx-root amx-card ${isTransitioning ? 'amx-transitioning' : ''}`}>
      <div className="amx-panel">{/* Main card panel */}
        {/* Header with drag handle */}
        <div className="amx-header amx-drag-handle">
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-white/40" />
            <span>Hi, {profile?.name || 'there'}</span>
            {/* Connection status indicator */}
            {!isConnected && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/20 border border-red-500/30">
                <WifiOff className="w-3 h-3 text-red-400" />
                <span className="text-xs text-red-400">Offline</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="amx-icon-btn"
              onClick={() => setShowToolsPanel(true)}
              title="Tools: Screen Control & Agents"
            >
              <Wrench className="w-4 h-4" />
            </button>
            <button
              className="amx-icon-btn"
              onClick={handleOpenSettings}
              title="Settings & History"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
            <button
              className="amx-icon-btn"
              onClick={handleResetConversation}
              title="Reset conversation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              className="amx-icon-btn"
              onClick={() => {
                console.log('[FloatBar] Card minimize clicked: returning to pill window');
                showPillWindow();
              }}
              title="Minimize (Esc)"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Thoughts stream / Welcome screen */}
        <div className="amx-thoughts" role="status" aria-live="polite">
          {/* UX Phase 3: Search bar */}
          {showSearch && (
            <div className="amx-search-bar">
              <Search className="w-4 h-4 text-gray-500" />
              <input
                type="text"
                className="amx-search-input"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  performSearch(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    nextSearchResult();
                  } else if (e.key === 'Enter' && e.shiftKey) {
                    e.preventDefault();
                    prevSearchResult();
                  }
                }}
                autoFocus
              />
              {searchResults.length > 0 && (
                <span className="amx-search-count">
                  {currentSearchIndex + 1} of {searchResults.length}
                </span>
              )}
              {searchResults.length === 0 && searchQuery && (
                <span className="amx-search-count text-gray-400">No matches</span>
              )}
              <button
                className="amx-search-nav-btn"
                onClick={prevSearchResult}
                disabled={searchResults.length === 0}
                title="Previous (Shift+Enter)"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                className="amx-search-nav-btn"
                onClick={nextSearchResult}
                disabled={searchResults.length === 0}
                title="Next (Enter)"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <button
                className="amx-search-close-btn"
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {showWelcome ? (
            <div className="amx-welcome">
              <div className="amx-welcome-header">
                <span className="amx-welcome-title">Welcome to Agent Max</span>
              </div>
              <div className="amx-welcome-subtitle">Let's set up your workspace</div>

              <div className="amx-welcome-steps">
                {/* Step 1: Name */}
                {welcomeStep === 1 && (
                  <div className="amx-welcome-step">
                    <label className="amx-welcome-label">What's your name?</label>
                    <input
                      type="text"
                      className="amx-welcome-input"
                      placeholder="Enter your name..."
                      value={welcomeData.name}
                      onChange={(e) => setWelcomeData({ ...welcomeData, name: e.target.value })}
                      onKeyDown={handleKeyDown}
                      autoFocus
                    />
                  </div>
                )}

                {/* Step 2: Role */}
                {welcomeStep === 2 && (
                  <div className="amx-welcome-step">
                    <label className="amx-welcome-label">What's your role?</label>
                    <div className="amx-welcome-options">
                      {[
                        'Developer',
                        'Designer',
                        'Product Manager',
                        'Researcher',
                        'Writer',
                        'Other',
                      ].map((opt) => {
                        const value = opt.toLowerCase().replace(' ', '_');
                        return (
                          <button
                            key={value}
                            className={`amx-welcome-option ${welcomeData.role === value ? 'active' : ''}`}
                            onClick={() => setWelcomeData({ ...welcomeData, role: value })}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Step 3: Primary Use */}
                {welcomeStep === 3 && (
                  <div className="amx-welcome-step">
                    <label className="amx-welcome-label">What will you use Agent Max for?</label>
                    <div className="amx-welcome-options">
                      {[
                        'Code Development',
                        'Task Automation',
                        'Research & Analysis',
                        'Content Creation',
                      ].map((opt) => {
                        const value = opt
                          .toLowerCase()
                          .replace(/\s+&\s+/, '_')
                          .replace(/\s+/g, '_');
                        return (
                          <button
                            key={value}
                            className={`amx-welcome-option ${welcomeData.primaryUse === value ? 'active' : ''}`}
                            onClick={() => setWelcomeData({ ...welcomeData, primaryUse: value })}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Step 4: Work Style */}
                {welcomeStep === 4 && (
                  <div className="amx-welcome-step">
                    <label className="amx-welcome-label">Preferred response style</label>
                    <div className="amx-welcome-options amx-welcome-options-stacked">
                      {[
                        { value: 'detailed', label: 'Detailed explanations with context' },
                        { value: 'concise', label: 'Brief and to the point' },
                        { value: 'interactive', label: 'Step-by-step guidance' },
                        { value: 'autonomous', label: 'Execute tasks automatically' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          className={`amx-welcome-option amx-welcome-option-stacked ${
                            welcomeData.workStyle === opt.value ? 'active' : ''
                          }`}
                          onClick={() => setWelcomeData({ ...welcomeData, workStyle: opt.value })}
                        >
                          <span className="amx-welcome-option-label">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Welcome navigation */}
              <div className="amx-welcome-nav">
                {welcomeStep > 1 && (
                  <button className="amx-welcome-btn secondary" onClick={handleWelcomeBack}>
                    Back
                  </button>
                )}
                {welcomeStep < 4 ? (
                  <button
                    className={`amx-welcome-btn primary ${!canProceedWelcome() ? 'disabled' : ''}`}
                    onClick={handleWelcomeNext}
                    disabled={!canProceedWelcome()}
                  >
                    Next <ArrowRight className="w-3 h-3 ml-1" />
                  </button>
                ) : (
                  <button
                    className={`amx-welcome-btn primary ${!canProceedWelcome() ? 'disabled' : ''}`}
                    onClick={handleWelcomeComplete}
                    disabled={!canProceedWelcome()}
                  >
                    Complete Setup <ArrowRight className="w-3 h-3 ml-1" />
                  </button>
                )}
              </div>

              {/* Progress dots */}
              <div className="amx-welcome-progress">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`amx-welcome-dot ${step <= welcomeStep ? 'active' : ''}`}
                  />
                ))}
              </div>
            </div>
          ) : thoughts.length === 0 ? (
            <div className="amx-empty-state">
              <div className="amx-empty-icon"></div>
              <div className="amx-empty-text">Start a conversation...</div>
            </div>
          ) : (
            <>
              {thoughts.map((thought, idx) => {
                const isHovered = hoveredMessageIndex === idx;
                const isFocused = focusedMessageIndex === idx;
                // Check if this message is a search result
                const isSearchResult = searchResults.some(r => r.index === idx);
                const isCurrentSearchResult = searchResults.length > 0 && 
                  searchResults[currentSearchIndex]?.index === idx;
                
                return (
                  <div
                    key={idx}
                    data-message-idx={idx}
                    className={`amx-message amx-message-${thought.type} ${isFocused ? 'amx-message-focused' : ''} ${isCurrentSearchResult ? 'amx-search-current' : isSearchResult ? 'amx-search-match' : ''}`}
                    onMouseEnter={() => setHoveredMessageIndex(idx)}
                    onMouseLeave={() => setHoveredMessageIndex(null)}
                    onFocus={() => setFocusedMessageIndex(idx)}
                    onBlur={() => setFocusedMessageIndex(null)}
                    tabIndex={0}
                  >
                    {thought.type === 'user' && <div className="amx-message-label">YOU</div>}
                    {thought.type === 'agent' && <div className="amx-message-label">AGENT MAX</div>}
                    {thought.type === 'thought' && !collapsedMessages.has(idx) && <div className="amx-thought-label">THINKING</div>}
                    
                    {/* UX Phase 2: Collapsible thoughts */}
                    {thought.type === 'thought' && collapsedMessages.has(idx) && messageTimings[idx] && (
                      <button
                        className="amx-thought-collapsed"
                        onClick={() => {
                          setCollapsedMessages(prev => {
                            const next = new Set(prev);
                            next.delete(idx);
                            return next;
                          });
                          telemetry.logInteraction({
                            event: 'thoughts.toggled',
                            data: { 
                              action: 'expand', 
                              step_count: messageTimings[idx].steps?.length || 0,
                              total_ms: messageTimings[idx].duration_ms 
                            },
                            metadata: { ux_schema: 'v1', conversation_id: draftSessionId },
                          });
                        }}
                        onMouseEnter={() => setIsHoveringSteps(idx)}
                        onMouseLeave={() => setIsHoveringSteps(null)}
                      >
                        Show steps ({messageTimings[idx].steps?.length || 0}) · {(messageTimings[idx].duration_ms / 1000).toFixed(1)}s
                      </button>
                    )}
                    
                    {thought.type === 'debug' && <div className="amx-debug-label">DEBUG</div>}
                    {thought.type === 'error' && <div className="amx-error-label">ERROR</div>}
                    
                    {/* UX Phase 2: Message actions */}
                    {(isHovered || isFocused) && (thought.type === 'user' || thought.type === 'agent') && (
                      <div className="amx-message-actions">
                        <button
                          className="amx-message-action"
                          onClick={() => handleCopyMessage(thought, idx)}
                          title="Copy (C)"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        {thought.type === 'agent' && (
                          <button
                            className="amx-message-action"
                            onClick={() => handleRegenerateMessage(idx)}
                            title="Regenerate (R)"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        )}
                        {thought.type === 'user' && (
                          <button
                            className="amx-message-action"
                            onClick={() => handleEditMessage(thought, idx, false)}
                            title="Edit (E)"
                          >
                            <span className="text-xs font-semibold">Edit</span>
                          </button>
                        )}
                        <button
                          className="amx-message-action amx-message-action-danger"
                          onClick={() => handleDeleteMessage(idx)}
                          title="Delete (Backspace)"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    
                    {/* Delete confirmation */}
                    {showDeleteConfirm === idx && (
                      <div className="amx-delete-confirm">
                        <span>Delete this message?</span>
                        <div className="flex gap-2">
                          <button
                            className="amx-delete-confirm-btn amx-delete-confirm-yes"
                            onClick={() => confirmDeleteMessage(idx)}
                          >
                            Delete
                          </button>
                          <button
                            className="amx-delete-confirm-btn amx-delete-confirm-no"
                            onClick={() => setShowDeleteConfirm(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    
                    <div className="amx-message-content">
                      {renderMessageWithLinks(thought.content)}
                    </div>
                  </div>
                );
              })}
              {isThinking && (
                <div className="amx-thinking-indicator">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Agent Max is thinking...</span>
                </div>
              )}
              <div ref={thoughtsEndRef} />
            </>
          )}
        </div>

        {/* Progress bar */}
        {progress > 0 && (
          <div className="amx-progress">
            <div style={{ width: `${progress}%` }} />
          </div>
        )}

        {/* Command preview */}
        {currentCommand && (
          <div className="amx-cmd">
            <code className="amx-code">{currentCommand}</code>
            <div className="amx-actions">
              <button onClick={handleRunCommand} className="amx-btn" title="Run command">
                <Play className="w-3 h-3" />
                Run
              </button>
              <button onClick={handleCopyCommand} className="amx-btn" title="Copy to clipboard">
                <Copy className="w-3 h-3" />
                Copy
              </button>
            </div>
          </div>
        )}

        {/* Message compose */}
        <div className="amx-compose">
          {/* Attachment chip */}
          {screenshotData && (
            <div className="amx-attachment-chip">
              <Camera className="w-3 h-3" />
              <span className="amx-attachment-text">
                Screenshot ({Math.round(screenshotData.length / 1024)}KB)
              </span>
              <button
                className="amx-attachment-remove"
                onClick={() => {
                  setScreenshotData(null);
                  console.log('[UX] Attachment removed');
                  telemetry.logInteraction({
                    event: 'composer.attachment_removed',
                    data: { type: 'screenshot' },
                  });
                }}
                title="Remove"
              >
                ×
              </button>
            </div>
          )}

          {/* Input hint */}
          {showInputHint && (
            <div className="amx-input-hint">
              Press Enter to send · Shift+Enter for newline
            </div>
          )}

          <div className="amx-input-row">
            <input
              className="amx-input"
              placeholder="Ask anything..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              maxLength={2000}
              disabled={isThinking}
              onFocus={() => {
                isEditingMessageRef.current = true;
                setIsMessageFocused(true);
              }}
              onBlur={() => {
                isEditingMessageRef.current = false;
                setIsMessageFocused(false);
              }}
            />
            <button
              className="amx-icon-btn"
              onClick={handleScreenshot}
              title="Take Screenshot"
              disabled={isThinking}
            >
              <Camera className="w-4 h-4" />
            </button>
            {/* UX Phase 2: Stop/Continue buttons */}
            {isThinking ? (
              <button
                className="amx-stop-btn"
                onClick={handleStop}
                title="Stop generation"
              >
                <div className="w-3 h-3 bg-current rounded-sm" />
              </button>
            ) : isStopped ? (
              <button
                className="amx-continue-btn"
                onClick={handleContinue}
                title="Continue from here"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                className="amx-send-btn"
                onClick={() => {
                  if (message.trim()) {
                    // Dismiss hint after first send
                    if (!hintDismissed) {
                      localStorage.setItem('composer.hint_dismissed', 'true');
                      setHintDismissed(true);
                      telemetry.logInteraction({
                        event: 'onboarding.hint_dismissed',
                        data: {},
                      });
                    }
                    // Clear draft
                    if (draftSessionId) {
                      localStorage.removeItem(`amx:draft:${draftSessionId}`);
                    }
                    handleSendMessage();
                  }
                }}
                title="Send message"
                disabled={!message.trim()}
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Semantic suggestions */}
        {showSuggestions && similarGoals.length > 0 && (
          <div className="amx-suggestions">
            <div className="amx-suggestions-label">Similar past conversations:</div>
            {similarGoals.map((goal, idx) => (
              <div
                key={idx}
                className="amx-suggestion-item"
                onClick={() => {
                  setMessage(goal.goal);
                  setShowSuggestions(false);
                  inputRef.current?.focus();
                }}
              >
                <div className="amx-suggestion-text">{goal.goal}</div>
                <div className="amx-suggestion-meta">
                  {Math.round(goal.similarity * 100)}% similar
                  {goal.success && ' ✓'}
                </div>
              </div>
            ))}
          </div>
        )}

        {screenshotData && (
          <div
            style={{
              fontSize: '11px',
              color: 'rgba(122, 162, 255, 0.8)',
              textAlign: 'left',
              padding: '4px 16px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            Screenshot attached
          </div>
        )}
        {message.length > 1800 && (
          <div
            style={{
              fontSize: '11px',
              color: message.length > 2000 ? '#ff6b6b' : 'rgba(255,255,255,0.5)',
              textAlign: 'right',
              padding: '4px 16px 0',
            }}
          >
            {message.length}/2000 characters
          </div>
        )}
      </div>

      {/* Confirmation modal */}
      {showConfirmModal && (
        <div className="amx-modal">
          <div className="amx-modal-content">
            <h3 className="amx-modal-title">Execute Command?</h3>
            <p className="amx-modal-text">This will run the following command in your terminal:</p>
            <code className="amx-modal-code">{currentCommand}</code>
            <div className="amx-modal-actions">
              <button onClick={() => setShowConfirmModal(false)} className="amx-btn-secondary">
                Cancel
              </button>
              <button onClick={confirmRunCommand} className="amx-btn-primary">
                Run Command
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UX Phase 3: Quick Switcher Modal */}
      {showSwitcher && (
        <div className="amx-modal-overlay" onClick={() => setShowSwitcher(false)}>
          <div className="amx-quick-switcher" onClick={(e) => e.stopPropagation()}>
            <div className="amx-quick-switcher-header">
              <h3>Quick Switcher</h3>
              <button
                className="amx-icon-btn"
                onClick={() => setShowSwitcher(false)}
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="amx-quick-switcher-search">
              <Search className="w-4 h-4 text-gray-500" />
              <input
                type="text"
                className="amx-quick-switcher-input"
                placeholder="Search conversations..."
                value={switcherQuery}
                onChange={(e) => setSwitcherQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedConvIndex(prev => 
                      Math.min(prev + 1, conversations.filter(c => 
                        c.title.toLowerCase().includes(switcherQuery.toLowerCase())
                      ).length - 1)
                    );
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedConvIndex(prev => Math.max(prev - 1, 0));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const filtered = conversations.filter(c => 
                      c.title.toLowerCase().includes(switcherQuery.toLowerCase())
                    );
                    if (filtered[selectedConvIndex]) {
                      selectConversation(filtered[selectedConvIndex]);
                    }
                  }
                }}
                autoFocus
              />
            </div>
            <div className="amx-quick-switcher-list">
              {conversations
                .filter(c => c.title.toLowerCase().includes(switcherQuery.toLowerCase()))
                .map((conv, idx) => (
                  <div
                    key={conv.id}
                    className={`amx-quick-switcher-item ${idx === selectedConvIndex ? 'selected' : ''}`}
                    onClick={() => selectConversation(conv)}
                  >
                    <div className="amx-quick-switcher-item-title">{conv.title}</div>
                    <div className="amx-quick-switcher-item-meta">
                      {conv.messageCount} messages · {new Date(conv.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              {conversations.filter(c => c.title.toLowerCase().includes(switcherQuery.toLowerCase())).length === 0 && (
                <div className="amx-quick-switcher-empty">No conversations found</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tools Panel */}
      {showToolsPanel && (
        <ToolsPanel
          onClose={() => setShowToolsPanel(false)}
          onLoadConversation={(conversation) => {
            // Load conversation messages into thoughts
            if (conversation.messages) {
              const loadedThoughts = conversation.messages.map((msg, idx) => ({
                id: idx,
                type: msg.role === 'user' ? 'user' : 'ai',
                content: msg.content,
                timestamp: msg.timestamp || new Date().toISOString(),
              }));
              setThoughts(loadedThoughts);
              setShowToolsPanel(false);
              toast.success('Conversation loaded!');
            }
          }}
        />
      )}
    </div>
  );
}
