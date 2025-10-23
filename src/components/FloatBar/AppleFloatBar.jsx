/**
 * Apple-style FloatBar Component
 * Clean, expanding bar-only UI with glassmorphism
 * Replaces card mode entirely with a dynamic expanding bar
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Settings, RotateCcw, Wrench, ArrowUp, Loader2, Minimize2 } from 'lucide-react';
import useStore from '../../store/useStore';
import { chatAPI, permissionAPI, googleAPI, ambiguityAPI } from '../../services/api';
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
  
  // Screenshot permission state
  const [screenshotPermissionOpen, setScreenshotPermissionOpen] = useState(false);
  const [pendingMessageForScreenshot, setPendingMessageForScreenshot] = useState(null);
  
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
    // Screenshot / ambiguity handling - use GPT-4o-mini for intelligent detection
    let screenshotData = null;
    
    try {
      // Call ambiguity API to check if screenshot is needed
      const ambiguityResult = await ambiguityAPI.checkAmbiguity(text, 5);
      
      logger.info('[Ambiguity] Classification result:', {
        needs_screenshot: ambiguityResult.needs_screenshot,
        reason: ambiguityResult.reason,
        latency: `${ambiguityResult.latency_ms.toFixed(1)}ms`,
        word_count: ambiguityResult.word_count,
        confidence: ambiguityResult.confidence
      });
      
      // If explicit screen request, take screenshot immediately without asking
      if (ambiguityResult.reason === 'explicit_request') {
        if (window.electron?.takeScreenshot) {
          try {
            setThinkingStatus('Capturing screenshot...');
            const result = await window.electron.takeScreenshot();
            screenshotData = result.base64;
            logger.info('[Screenshot] Captured for explicit request:', Math.round(result.size / 1024), 'KB');
          } catch (error) {
            logger.error('[Screenshot] Failed to capture:', error);
            toast.error('Failed to capture screenshot');
          }
        }
      } 
      // If ambiguous, ask permission first
      else if (ambiguityResult.needs_screenshot && window.electron?.takeScreenshot) {
        setScreenshotPermissionOpen(true);
        setPendingMessageForScreenshot({ text, userContext: null });
        setIsThinking(false);
        setThinkingStatus('');
        return; // Wait for user approval
      }
    } catch (error) {
      // On API error, fall back to no screenshot (safer than blocking user)
      logger.error('[Ambiguity] API call failed:', error);
      screenshotData = null;
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
      if (event.type === 'ack') {
        // Stream started - clear buffer and prepare for real-time tokens
        streamBufferRef.current = '';
        enrichTileIdRef.current = null;
      } else if (event.type === 'tool_result') {
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
          // No tile enrichment active: show tokens in real-time
          streamBufferRef.current = (streamBufferRef.current || '') + content;
          
          // Update or create assistant message in real-time
          setThoughts(prev => {
            // Check if last message is an in-progress assistant message
            if (prev.length > 0 && prev[prev.length - 1].role === 'assistant' && prev[prev.length - 1].streaming) {
              // Update existing streaming message
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: streamBufferRef.current
              };
              return updated;
            } else {
              // Create new streaming assistant message
              return [...prev, {
                role: 'assistant',
                content: streamBufferRef.current,
                timestamp: Date.now(),
                streaming: true
              }];
            }
          });
        }
      } else if (event.type === 'thinking') {
        const message = event.data?.message || event.message || 'Processing...';
        setThinkingStatus(message);
      } else if (event.type === 'step') {
        // Step completed - could show intermediate steps
        setThinkingStatus('Working...');
      } else if (event.type === 'done') {
        // Final response received - mark streaming message as complete
        const d = event.data || {};
        const finalResponse = (
          d.final_response || d.response || d.text || d.content || d.message || d.result ||
          event.final_response || event.response || event.content || event.text || event.message || ''
        );
        const buffered = streamBufferRef.current || '';
        const responseText = (typeof finalResponse === 'string' ? finalResponse : String(finalResponse || '')) || buffered;
        
        setThoughts(prev => {
          // Check if last message is a streaming assistant message
          if (prev.length > 0 && prev[prev.length - 1].role === 'assistant' && prev[prev.length - 1].streaming) {
            // Mark the streaming message as complete
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: responseText || updated[updated.length - 1].content,
              streaming: false // Mark as complete
            };
            return updated;
          } else if (responseText) {
            // No streaming message exists, create a final one
            return [...prev, {
              role: 'assistant',
              content: responseText,
              timestamp: Date.now()
            }];
          }
          return prev;
        });

        // Save conversation to memory system
        if (responseText && window.electron?.memory?.addMessage) {
          window.electron.memory.addMessage('assistant', responseText)
            .catch(err => console.warn('[Chat] Failed to save message to memory:', err));
        }
        
        // Parse and execute email commands
        if (responseText) {
          try {
            const emailCommandMatch = responseText.match(/```email_command\s*\n([\s\S]*?)\n```/);
            if (emailCommandMatch) {
              const commandJson = emailCommandMatch[1].trim();
              const command = JSON.parse(commandJson);
              
              if (command.action === 'send_email') {
                logger.info('[Email] Executing email command', command);
                
                // Get user's Gmail address from localStorage
                const userEmail = localStorage.getItem('google_user_email');
                
                if (!userEmail) {
                  toast.error('Gmail not connected. Please connect your Gmail account in settings.');
                } else {
                  // Call Gmail API to send email
                  googleAPI.sendEmail(
                    command.to,
                    command.subject,
                    command.body
                  ).then(response => {
                    logger.info('[Email] Sent successfully', response);
                    toast.success(`Email sent to ${command.to}!`);
                  }).catch(error => {
                    logger.error('[Email] Failed to send', error);
                    toast.error(`Failed to send email: ${error.message}`);
                  });
                }
              }
            }
          } catch (err) {
            logger.error('[Email] Failed to parse email command', err);
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
  // Handle screenshot permission response
  const handleScreenshotPermission = useCallback(async (approved) => {
    setScreenshotPermissionOpen(false);
    
    if (!pendingMessageForScreenshot) return;
    
    const { text } = pendingMessageForScreenshot;
    setIsThinking(true);
    setThinkingStatus(approved ? 'Capturing screenshot...' : 'Thinking...');
    
    let screenshotData = null;
    if (approved && window.electron?.takeScreenshot) {
      try {
        const result = await window.electron.takeScreenshot();
        screenshotData = result.base64;
        console.log('[Chat] Screenshot captured:', Math.round(result.size / 1024), 'KB');
      } catch (error) {
        console.error('[Chat] Failed to capture screenshot:', error);
        toast.error('Failed to capture screenshot');
      }
    }
    
    // Continue with message sending
    continueSendMessage(text, screenshotData);
    setPendingMessageForScreenshot(null);
  }, [pendingMessageForScreenshot]);
  
  // Continue sending message after screenshot decision
  const continueSendMessage = useCallback(async (text, screenshotData) => {
    setThinkingStatus('Thinking...');
    
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
    
    // Execute the streaming call (reuse the existing sendChat logic)
    sendChat(text, userContext, screenshotData);
  }, [thoughts]);
  
  // Main streaming chat logic (extracted for reuse)
  const sendChat = useCallback((text, userContext, screenshotData) => {
    chatAPI.sendMessageStream(text, userContext, screenshotData, (event) => {
      console.log('[Chat] Received SSE event:', event);
      
      // Handle SSE events - backend sends {type: string, data: {...}}
      if (event.type === 'ack') {
        // Stream started - clear buffer and prepare for real-time tokens
        streamBufferRef.current = '';
        enrichTileIdRef.current = null;
      } else if (event.type === 'tool_result') {
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
          // No tile enrichment active: show tokens in real-time
          streamBufferRef.current = (streamBufferRef.current || '') + content;
          
          // Update or create assistant message in real-time
          setThoughts(prev => {
            // Check if last message is an in-progress assistant message
            if (prev.length > 0 && prev[prev.length - 1].role === 'assistant' && prev[prev.length - 1].streaming) {
              // Update existing streaming message
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: streamBufferRef.current
              };
              return updated;
            } else {
              // Create new streaming assistant message
              return [...prev, {
                role: 'assistant',
                content: streamBufferRef.current,
                timestamp: Date.now(),
                streaming: true
              }];
            }
          });
        }
      } else if (event.type === 'thinking') {
        const message = event.data?.message || event.message || 'Processing...';
        setThinkingStatus(message);
      } else if (event.type === 'step') {
        // Step completed - could show intermediate steps
        setThinkingStatus('Working...');
      } else if (event.type === 'done') {
        // Final response received - mark streaming message as complete
        const d = event.data || {};
        const finalResponse = (
          d.final_response || d.response || d.text || d.content || d.message || d.result ||
          event.final_response || event.response || event.content || event.text || event.message || ''
        );
        const buffered = streamBufferRef.current || '';
        const responseText = (typeof finalResponse === 'string' ? finalResponse : String(finalResponse || '')) || buffered;
        
        setThoughts(prev => {
          // Check if last message is a streaming assistant message
          if (prev.length > 0 && prev[prev.length - 1].role === 'assistant' && prev[prev.length - 1].streaming) {
            // Mark the streaming message as complete
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: responseText || updated[updated.length - 1].content,
              streaming: false // Mark as complete
            };
            return updated;
          } else if (responseText) {
            // No streaming message exists, create a final one
            return [...prev, {
              role: 'assistant',
              content: responseText,
              timestamp: Date.now()
            }];
          }
          return prev;
        });

        // Save conversation to memory system
        if (responseText && window.electron?.memory?.addMessage) {
          window.electron.memory.addMessage('assistant', responseText)
            .catch(err => console.warn('[Chat] Failed to save message to memory:', err));
        }
        
        // Parse and execute email commands
        if (responseText) {
          try {
            const emailCommandMatch = responseText.match(/```email_command\s*\n([\s\S]*?)\n```/);
            if (emailCommandMatch) {
              const commandJson = emailCommandMatch[1].trim();
              const command = JSON.parse(commandJson);
              
              if (command.action === 'send_email') {
                logger.info('[Email] Executing email command', command);
                
                // Get user's Gmail address from localStorage
                const userEmail = localStorage.getItem('google_user_email');
                
                if (!userEmail) {
                  toast.error('Gmail not connected. Please connect your Gmail account in settings.');
                } else {
                  // Call Gmail API to send email
                  googleAPI.sendEmail(
                    command.to,
                    command.subject,
                    command.body
                  ).then(response => {
                    logger.info('[Email] Sent successfully', response);
                    toast.success(`Email sent to ${command.to}!`);
                  }).catch(error => {
                    logger.error('[Email] Failed to send', error);
                    toast.error(`Failed to send email: ${error.message}`);
                  });
                }
              }
            }
          } catch (err) {
            logger.error('[Email] Failed to parse email command', err);
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
  }, []);
  
  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault();
    const text = message.trim();
    if (!text || isThinking || !apiConnected) return;

    // If this is the first prompt and it looks like an email intent, open approval immediately
    try {
      const isFirstTurn = thoughts.length === 0;
      // Simple email intent patterns: "email X", "send email", "send an email", "compose email"
      const emailRegex = /^(\s*(email|send( an)? email|compose( an)? email)\b|\bemail\b.*\b(to|about)\b)/i;
      if (isFirstTurn && emailRegex.test(text)) {
        setApprovalDetails({
          action: text,
          markers: ['communication', 'email'],
          reason: 'Composing and sending email requires your approval.',
          isHighRisk: false,
          onApprove: async () => {
            try {
              await permissionAPI.logActivity({
                action: text,
                category: 'communication',
                required_approval: true,
                approved: true,
                markers: ['email'],
                is_high_risk: false
              });
            } catch {}
            continueSend(text);
          }
        });
        setApprovalOpen(true);
        return;
      }
    } catch {}
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
    if (approvalOpen) return;

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
  }, [isMini, approvalOpen]);

  useEffect(() => {
    isMiniRef.current = isMini;
  }, [isMini]);
  
  useEffect(() => {
    (async () => {
      if (!approvalOpen) return;
      try {
        if (isMini) {
          handleExpand();
        }
        if (window.electron?.resizeWindow) {
          await window.electron.resizeWindow(360, 520);
          lastHeightRef.current = 520;
        }
      } catch {}
    })();
  }, [approvalOpen, isMini, handleExpand]);

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
                {[{ value: 'chatty', title: 'Chatty' }, { value: 'helpful', title: 'Helpful' }, { value: 'powerful', title: 'Autonomous' }].map((opt, idx) => (
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
                      {(thought.content || '').trim()}
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
              <ArrowUp size={16} />
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
      
      {/* Screenshot Permission Dialog */}
      {screenshotPermissionOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '100px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10001,
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            background: 'rgba(16, 16, 18, 0.96)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '16px',
            padding: '12px 16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            animation: 'slideUp 0.2s ease-out'
          }}
        >
          <span style={{ color: '#ffffff', fontSize: '0.95rem', fontWeight: 500, marginRight: '4px' }}>
            Can I take a screenshot for more context?
          </span>
          <button
            onClick={() => handleScreenshotPermission(false)}
            style={{
              padding: '8px 16px',
              background: 'rgba(0,0,0,0.8)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '10px',
              color: '#ffffff',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0,0,0,0.9)';
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0,0,0,0.8)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            No
          </button>
          <button
            onClick={() => handleScreenshotPermission(true)}
            style={{
              padding: '8px 16px',
              background: '#007AFF',
              border: '1px solid #0066DD',
              borderRadius: '10px',
              color: '#ffffff',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 2px 8px rgba(0,122,255,0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#0066DD';
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#007AFF';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            Yes
          </button>
        </div>
      )}
    </div>
  );
}
