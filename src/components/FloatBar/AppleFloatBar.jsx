/**
 * Apple-style FloatBar Component
 * Clean, expanding bar-only UI with glassmorphism
 * Replaces card mode entirely with a dynamic expanding bar
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Settings, RotateCcw, Wrench, ArrowUp, Loader2, Minimize2, Check } from 'lucide-react';
import useStore from '../../store/useStore';
import { chatAPI, permissionAPI, googleAPI, ambiguityAPI, semanticAPI, factsAPI, addConnectionListener, healthAPI } from '../../services/api';
import toast from 'react-hot-toast';
import axios from 'axios';
import { CreditDisplay } from '../CreditDisplay';
import { supabase, checkResponseCache, storeResponseCache } from '../../services/supabase';
import { createLogger } from '../../services/logger';
import memoryService from '../../services/memory';
import contextSelector from '../../services/contextSelector';
import { FactTileList } from '../FactTileList.jsx';
import { usePermission } from '../../contexts/PermissionContext';
import ApprovalDialog from '../ApprovalDialog';
import './AppleFloatBar.css';

// Better Memory integration
import memoryAPI from '../../services/memoryAPI';
import ContextPreview from './ContextPreview';
import MemoryToast from '../MemoryToast';

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
  // Better Memory UI state
  const [contextPack, setContextPack] = useState(null);
  const [showContextPreview, setShowContextPreview] = useState(false);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [contextPreviewExpanded, setContextPreviewExpanded] = useState(false);
  const [memoryProposals, setMemoryProposals] = useState([]);
  const [showMemoryToast, setShowMemoryToast] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [factTiles, setFactTiles] = useState([]);
  const lastUserPromptRef = useRef('');
  const lastAssistantTsRef = useRef(null);
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
  const offlineRef = useRef(false); // suppress toast spam while offline
  const [showReconnected, setShowReconnected] = useState(false);
  
  // Store
  const { clearMessages, apiConnected, currentUser, setApiConnected } = useStore();
  
  // Connection status wiring (graceful offline UX)
  useEffect(() => {
    // Subscribe to API connection changes
    const unsub = addConnectionListener((isConnected) => {
      setApiConnected(!!isConnected);
      offlineRef.current = !isConnected;
    });
    // Initial quick ping to set state on mount
    healthAPI.check()
      .then(() => { setApiConnected(true); offlineRef.current = false; })
      .catch(() => { setApiConnected(false); offlineRef.current = true; });
    return () => {
      try { unsub && unsub(); } catch {}
    };
  }, [setApiConnected]);

  // While offline, ping every 2s to auto-reconnect without spamming UI
  useEffect(() => {
    if (apiConnected) return;
    let timer = setInterval(() => {
      healthAPI.check().then(() => setApiConnected(true)).catch(() => {});
    }, 2000);
    return () => clearInterval(timer);
  }, [apiConnected, setApiConnected]);

  // Flash a subtle success pill when we transition offline -> online
  const prevOnlineRef = useRef(true);
  useEffect(() => {
    if (prevOnlineRef.current === false && apiConnected === true) {
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 1400);
    }
    prevOnlineRef.current = apiConnected;
  }, [apiConnected]);
  
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

  // Start new session on mount
  useEffect(() => {
    if (window.electron?.memory?.startSession) {
      window.electron.memory.startSession()
        .then(() => console.log('[Session] New session started on mount'))
        .catch(err => console.warn('[Session] Failed to start session:', err));
    }
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
    // Immediately extract and persist facts from the user's message (no confirmation prompt)
    try {
      await memoryService.extractFactsFromMessage(text, null);
      console.log('[Memory] Auto-saved facts from user message');
    } catch (e) {
      console.warn('[Memory] Auto-save failed:', e);
    }
    // Screenshot / ambiguity handling - use GPT-4o-mini for intelligent detection
    let screenshotData = null;
    
    try {
      // Call ambiguity API to check if screenshot is needed
      const ambiguityResult = await ambiguityAPI.checkAmbiguity(text, 5);
      
      // Validate response structure
      if (!ambiguityResult || typeof ambiguityResult.needs_screenshot === 'undefined') {
        throw new Error('Invalid ambiguity API response');
      }
      
      logger.info('[Ambiguity] Classification result:', {
        needs_screenshot: ambiguityResult.needs_screenshot,
        reason: ambiguityResult.reason || 'unknown',
        latency: ambiguityResult.latency_ms ? `${ambiguityResult.latency_ms.toFixed(1)}ms` : 'N/A',
        word_count: ambiguityResult.word_count || 0,
        confidence: ambiguityResult.confidence || 0
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
      preferences: null,
      google_user_email: localStorage.getItem('google_user_email') || null  // Add Google connection status
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
        // Inject Known Facts directly into semantic_context so the model can use them without extra retrieval
        try {
          const f = facts || {};
          const school = f?.education?.school?.value ?? f?.education?.school ?? null;
          const city = f?.location?.city?.value ?? f?.location?.city ?? null;
          const name = f?.personal?.name?.value ?? f?.personal?.name ?? null;
          const favoriteFood = f?.preferences?.favorite_food?.value ?? f?.preferences?.favorite_food ?? null;
          const likes = f?.preferences?.likes?.value ?? f?.preferences?.likes ?? null;
          let known = '';
          if (school) known += `- School: ${school}\n`;
          if (city) known += `- Location: ${city}\n`;
          if (name) known += `- Name: ${name}\n`;
          if (favoriteFood) known += `- Favorite food: ${favoriteFood}\n`;
          if (likes) known += `- Likes: ${likes}\n`;
          if (known) {
            userContext.semantic_context = (userContext.semantic_context || '') + `\n\n**Known Facts:**\n${known}`;
          }
        } catch (e) {
          console.warn('[Semantic] Failed to inject Known Facts into context:', e);
        }
      } catch (error) {
        console.warn('[Chat] Failed to load memory context:', error);
      }
    }
    // Streaming call
    chatAPI.sendMessageStream(text, userContext, screenshotData, async (event) => {
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
              const ts = Date.now();
              lastAssistantTsRef.current = ts;
              return [...prev, {
                role: 'assistant',
                content: streamBufferRef.current,
                timestamp: ts,
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
            const ts = Date.now();
            lastAssistantTsRef.current = ts;
            return [...prev, {
              role: 'assistant',
              content: responseText,
              timestamp: ts
            }];
          }
          return prev;
        });

        // Save conversation to memory system
        if (responseText && window.electron?.memory?.addMessage) {
          window.electron.memory.addMessage('assistant', responseText)
            .catch(err => console.warn('[Chat] Failed to save message to memory:', err));
        }
        // Persist to Better Memory backend as well
        try {
          if (lastUserPromptRef.current) {
            memoryAPI.saveMessage({ role: 'user', content: lastUserPromptRef.current });
          }
          if (responseText) {
            memoryAPI.saveMessage({ role: 'assistant', content: responseText });
          }
        } catch (e) {
          console.warn('[Memory] Failed to persist messages to backend', e);
        }

        // Phase 2: Extract facts from assistant response and show toast
        try {
          if (responseText) {
            const proposals = await memoryAPI.extract({ message: responseText });
            if (Array.isArray(proposals) && proposals.length > 0) {
              setMemoryProposals(proposals);
              setShowMemoryToast(true);
            }
          }
        } catch (e) {
          console.warn('[Memory] Extraction failed', e);
        }

        // After assistant responds: LLM-based extraction + local persist, then show a delayed badge
        try {
          const userPrompt = lastUserPromptRef.current || '';
          const currentTs = lastAssistantTsRef.current;

          // 1) Ask backend to extract facts (uses small model server-side)
          // Build a robust extraction message: user + assistant for context
          const extractMessage = [
            (userPrompt || '').trim() && `User: ${userPrompt.trim()}`,
            (responseText || '').trim() && `Assistant: ${responseText.trim()}`,
          ].filter(Boolean).join('\n');

          if (!extractMessage || extractMessage.trim().length === 0) {
            console.warn('[Memory] Skipping LLM extraction: empty message would cause 422');
            throw new Error('EMPTY_MESSAGE_FOR_EXTRACTION');
          }

          factsAPI.extractFacts(extractMessage, null)
            .then(async (res) => {
              const extracted = res?.data?.extracted_facts || res?.data || [];
              if (!Array.isArray(extracted) || extracted.length === 0) return;

              // 2) Persist each fact to local Electron memory
              const labels = [];
              for (const fact of extracted) {
                const category = fact.category || 'personal';
                const key = fact.key || 'note';
                const value = fact.value || '';
                if (!value) continue;
                try {
                  await window.electron?.memory?.setFact?.(category, key, value);
                } catch (e) {
                  console.warn('[Memory] Failed to persist fact locally:', category, key, e);
                }
                // Build label text for the card
                if (category === 'education' && key === 'school') labels.push(`School — ${value}`);
                else if (category === 'location' && key === 'city') labels.push(`Location — ${value}`);
                else if (category === 'personal' && key === 'name') labels.push(`Name — ${value}`);
                else if (category === 'preferences' && key === 'likes') labels.push(`Likes — ${value}`);
                else if (category === 'personal' && key === 'description') labels.push(`About — ${value}`);
                else labels.push(`${category}.${key} — ${value}`);
              }

              // 3) Show UI badge a moment later (so it appears after the reply)
              if (labels.length && currentTs) {
                const label = `Memory created! ${labels.join(' • ')}`;
                console.log('[Memory] Created badge (LLM):', label, 'for timestamp:', currentTs);
                setTimeout(() => {
                  setThoughts(prev => prev.map(t => 
                    t.timestamp === currentTs ? { ...t, memoryLabel: label } : t
                  ));
                }, 600);
              }
            })
            .catch((e) => {
              console.warn('[Memory] LLM extraction failed:', e?.message || e);
            })
            .finally(async () => {
              // 4) Fallback: pattern extractor (ensures we still save something offline)
              try {
                const fallbackFacts = await memoryService.extractFactsFromMessage(userPrompt, responseText);
                const currentTs2 = lastAssistantTsRef.current;
                if (fallbackFacts && Object.keys(fallbackFacts).length > 0 && currentTs2) {
                  const lbls = [];
                  if (fallbackFacts.name) lbls.push(`Name — ${fallbackFacts.name}`);
                  if (fallbackFacts.location) lbls.push(`Location — ${fallbackFacts.location}`);
                  if (fallbackFacts.school) lbls.push(`School — ${fallbackFacts.school}`);
                  if (fallbackFacts.likes) lbls.push(`Likes — ${fallbackFacts.likes}`);
                  if (fallbackFacts.description) lbls.push(`About — ${fallbackFacts.description}`);
                  if (lbls.length) {
                    const label2 = `Memory created! ${lbls.join(' • ')}`;
                    setTimeout(() => {
                      setThoughts(prev => prev.map(t => 
                        t.timestamp === currentTs2 ? { ...t, memoryLabel: label2 } : t
                      ));
                    }, 600);
                  }
                }
              } catch (e2) {
                console.warn('[Memory] Fallback extraction failed:', e2);
              }
            });
        } catch (e) {
          console.warn('[Memory] Extraction pipeline error:', e);
        }
        
        // Parse and execute commands (email, browser, etc.)
        if (responseText) {
          try {
            // Email command
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
                  // First, check Gmail API health
                  logger.info('[Email] Checking Gmail API health...');
                  toast.loading('Verifying Gmail connection...', { id: 'gmail-health' });
                  
                  axios.get(`http://localhost:8000/api/v2/google/gmail/health`, {
                    params: { email: userEmail }
                  }).then(healthResponse => {
                    toast.dismiss('gmail-health');
                    
                    if (!healthResponse.data.healthy) {
                      logger.error('[Email] Gmail health check failed:', healthResponse.data);
                      toast.error(`Gmail error: ${healthResponse.data.message}`);
                      return;
                    }
                    
                    logger.info('[Email] Gmail healthy, sending email...', healthResponse.data);
                    
                    // Gmail is healthy, proceed to send email
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
                  }).catch(healthError => {
                    toast.dismiss('gmail-health');
                    logger.error('[Email] Health check failed:', healthError);
                    toast.error('Failed to verify Gmail connection. Please check your connection in settings.');
                  });
                }
              }
            }
            
            // Browser command - Open URLs in user's native browser
            const browserCommandMatch = responseText.match(/```browser_command\s*\n([\s\S]*?)\n```/);
            if (browserCommandMatch) {
              const commandJson = browserCommandMatch[1].trim();
              const command = JSON.parse(commandJson);
              
              if (command.action === 'open_url') {
                logger.info('[Browser] Executing browser command', command);
                
                // Open URL in user's default browser (native UX)
                if (window.electron?.openExternal) {
                  window.electron.openExternal(command.url)
                    .then(() => {
                      logger.info('[Browser] Opened URL successfully', command.url);
                      toast.success('Opened in your browser!');
                    })
                    .catch(error => {
                      logger.error('[Browser] Failed to open URL', error);
                      toast.error(`Failed to open browser: ${error.message}`);
                    });
                } else {
                  // Fallback for non-Electron environment
                  window.open(command.url, '_blank');
                  toast.success('Opened in new tab!');
                }
              }
            }
          } catch (err) {
            logger.error('[Command] Failed to parse command', err);
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

  // Helper: retrieve context then proceed to send (optionally auto-send)
  const continueAfterPreview = useCallback(async (text) => {
    await retrieveContext(text);
    if (autoSend) {
      setTimeout(() => {
        try { continueSend(text); } catch (e) { console.warn('continueSend not available', e); }
      }, 800);
    } else {
      // Show preview and wait for user to click send again
      toast.success('Context prepared. Press send to continue.');
    }
  }, [retrieveContext, autoSend]);

  // Retrieve Better Memory context pack for a message
  const retrieveContext = useCallback(async (text) => {
    try {
      setIsLoadingContext(true);
      const pack = await memoryAPI.query({
        text,
        k_facts: 8,
        k_sem: 6,
        token_budget: 900,
        allow_vectors: false,
      });
      setContextPack(pack);
      setShowContextPreview(true);
      setContextPreviewExpanded(true);
      logger.info('[Memory] Retrieved context pack', {
        facts: pack?.facts?.length || 0,
        semantic_hits: pack?.semantic_hits?.length || 0,
        messages: pack?.recent_messages?.length || 0,
        tokens: `${pack?.budget?.used_tokens || 0}/${pack?.budget?.cap || 0}`,
      });
      return pack;
    } catch (e) {
      logger.warn('[Memory] Context retrieval failed', e);
      return null;
    } finally {
      setIsLoadingContext(false);
    }
  }, []);
  
  // Continue sending message after screenshot decision
  const continueSendMessage = useCallback(async (text, screenshotData) => {
    setThinkingStatus('Thinking...');
    // Remember the last user prompt for memory extraction
    lastUserPromptRef.current = text;
    
    // Build user context
    let userContext = {
      recent_messages: thoughts.map(t => ({ role: t.role, content: t.content })),
      profile: null,
      facts: null,
      preferences: null,
      google_user_email: localStorage.getItem('google_user_email') || null  // Add Google connection status
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

        // Semantic retrieval: build a minimal, relevant context for the current goal
        try {
          let recentMsgs = [];
          if (window.electron.memory.getRecentMessages) {
            recentMsgs = await window.electron.memory.getRecentMessages(20).catch(() => []);
          }

          const normalizeFacts = (arr) => {
            if (!Array.isArray(arr)) return [];
            return arr.map((f, i) => ({
              id: f.id || String(i),
              category: f.category || f.type || 'personal',
              predicate: f.predicate || f.key || 'value',
              object: f.object || f.value || '',
              confidence: f.confidence ?? 0.9,
              pii_level: f.pii_level ?? 1,
              consent_scope: f.consent_scope ?? 'default',
              updated_at: f.updated_at || null,
              created_at: f.created_at || null,
            }));
          };

          const normalizedFacts = normalizeFacts(facts);
          const normalizedRecent = Array.isArray(recentMsgs)
            ? recentMsgs.map((m, i) => ({
                id: m.id || String(i),
                role: m.role || 'user',
                content: m.content || m.text || '',
                created_at: m.created_at || new Date().toISOString(),
              }))
            : [];

          const vaultAdapter = {
            getAllFacts: () => normalizedFacts,
            getRecentMessages: (n = 10) => normalizedRecent.slice(-n),
            getFactRelevance: () => 1.0,
          };

          // Check if deep memory search is enabled
          const deepMemory = localStorage.getItem('pref_deep_memory_search') === '1';
          const selection = await contextSelector.selectContext(text, vaultAdapter, {
            tokenBudget: deepMemory ? 1200 : 600,
            alpha: deepMemory ? 0.85 : 0.7,
          });
          const semanticContext = contextSelector.buildContextString(selection.slices);
          if (semanticContext) {
            userContext.semantic_context = semanticContext;
          }

          // Query local Electron memory for cross-session recall
          try {
            const deepMemory = localStorage.getItem('pref_deep_memory_search') === '1';
            // For local keyword search, use more permissive thresholds
            const threshold = deepMemory ? 0.3 : 0.4;
            const limit = deepMemory ? 10 : 6;
            console.log(`[Semantic] Searching local memory with threshold=${threshold}, limit=${limit}, deepMemory=${deepMemory}`);

            // Utilities: normalize text and expand synonyms
            const normalize = (s) => (s || '')
              .toLowerCase()
              .replace(/[^a-z0-9\s]/g, ' ') // strip punctuation
              .replace(/\s+/g, ' ') // collapse spaces
              .trim();
            const STOP = new Set(['the','a','an','to','of','is','are','am','and','or','for','in','on','at','with','my','your','our','their','what','where','when','how','who','do','does','did','go','went','you','i']);
            const expandSynonyms = (word) => {
              if (['school','college','university'].includes(word)) return ['school','college','university'];
              if (['city','town','location'].includes(word)) return ['city','town','location'];
              if (['name','called'].includes(word)) return ['name','called'];
              if (['favorite','favourite','fav'].includes(word)) return ['favorite','favourite','fav','like','love','prefer'];
              if (['food','cuisine','dish','meal','snack'].includes(word)) return ['food','cuisine','dish','meal','snack'];
              return [word];
            };
            const tokens = normalize(text).split(' ').filter(w => w && !STOP.has(w));
            const queryTerms = Array.from(new Set(tokens.flatMap(expandSynonyms)));

            let items = [];
            if (window.electron?.memory?.getAllSessions) {
              try {
                // 1) Direct facts recall with high confidence
                let factsBlock = '';
                const facts = await window.electron.memory.getFacts().catch(() => null);
                if (facts) {
                  const school = facts?.education?.school?.value ?? facts?.education?.school ?? null;
                  if (school && queryTerms.some(t => ['school','college','university'].includes(t))) {
                    items.push({ text: `You go to ${school}`, score: 1.0, fact: true });
                    factsBlock += `- School: ${school}\n`;
                  }
                  const city = facts?.location?.city?.value ?? facts?.location?.city ?? null;
                  if (city && queryTerms.some(t => ['city','town','location'].includes(t))) {
                    items.push({ text: `You are in ${city}`, score: 0.9, fact: true });
                    factsBlock += `- Location: ${city}\n`;
                  }
                  const name = facts?.personal?.name?.value ?? facts?.personal?.name ?? null;
                  if (name && queryTerms.includes('name')) {
                    items.push({ text: `Your name is ${name}`, score: 0.9, fact: true });
                    factsBlock += `- Name: ${name}\n`;
                  }
                  const favoriteFood = facts?.preferences?.favorite_food?.value ?? facts?.preferences?.favorite_food ?? null;
                  if (favoriteFood && (queryTerms.some(t => ['favorite','favourite','fav'].includes(t)) || queryTerms.some(t => ['food','cuisine','dish','meal'].includes(t)))) {
                    items.push({ text: `Your favorite food is ${favoriteFood}`, score: 1.0, fact: true });
                    factsBlock += `- Favorite food: ${favoriteFood}\n`;
                  }
                  const likes = facts?.preferences?.likes?.value ?? facts?.preferences?.likes ?? null;
                  if (likes && queryTerms.some(t => ['favorite','favourite','fav','like','love','prefer'].includes(t))) {
                    items.push({ text: `You like ${likes}`, score: 0.85, fact: true });
                    factsBlock += `- Likes: ${likes}\n`;
                  }
                  if (factsBlock) {
                    userContext.semantic_context = (userContext.semantic_context || '') + `\n\n**Known Facts:**\n${factsBlock}`;
                  }
                }

                // 2) Scan conversation history for keyword matches
                const sessions = await window.electron.memory.getAllSessions();
                console.log(`[Semantic] Searching ${sessions.length} local sessions`);
                const matches = [];
                sessions.forEach(session => {
                  (session.messages || []).forEach(msg => {
                    if (!msg?.content) return;
                    const contentNorm = normalize(msg.content);
                    const hits = queryTerms.filter(k => contentNorm.includes(k));
                    if (hits.length > 0) {
                      const score = hits.length / Math.max(queryTerms.length, 1);
                      if (score >= threshold) {
                        matches.push({
                          text: msg.content.slice(0, 200),
                          score,
                          timestamp: msg.timestamp || session.started_at,
                          session: session.sessionId
                        });
                      }
                    }
                  });
                });

                // Merge fact items and matched items, de-dup, sort
                items = [...items, ...matches]
                  .filter(Boolean)
                  .sort((a, b) => (b.score || 0) - (a.score || 0))
                  .slice(0, limit);

                console.log('[Semantic] Found', items.length, 'similar items from local memory');
              } catch (err) {
                console.warn('[Semantic] Local search failed:', err);
              }
            } else {
              console.warn('[Semantic] Electron memory API not available');
            }
            
            if (Array.isArray(items) && items.length) {
              // Dedup by content similarity
              const seen = new Set();
              items = items.filter((it) => {
                const txt = (it.text || it.content || it.snippet || '').toLowerCase().slice(0, 50);
                if (seen.has(txt)) return false;
                seen.add(txt);
                return true;
              });

              // If >3 items, summarize to 2-3 bullets
              let lines;
              if (items.length > 3) {
                const topItems = items.slice(0, 3);
                lines = topItems
                  .map((it) => `- ${it.text || it.content || it.snippet || ''}`)
                  .filter(Boolean)
                  .join('\n');
              } else {
                lines = items
                  .map((it, i) => {
                    const text = it.text || it.content || it.snippet || '';
                    const score = typeof it.score === 'number' ? ` (${it.score.toFixed(2)})` : '';
                    return `- ${text}${score}`;
                  })
                  .filter(Boolean)
                  .join('\n');
              }
              const block = lines ? `\n\n**Similar Memories:**\n${lines}` : '';
              userContext.semantic_context = (userContext.semantic_context || '') + block;
              userContext.semantic_sources = items.map((it) => ({ id: it.id || it.uuid || null, score: it.score || null }));
            }
          } catch (e) {
            console.warn('[Chat] Embedding semantic search failed:', e);
          }
        } catch (e) {
          console.warn('[Chat] Semantic retrieval failed:', e);
        }
      } catch (error) {
        console.warn('[Chat] Failed to load memory context:', error);
      }
    }
    
    // If a Better Memory context pack is available, attach it to userContext and clear preview
    try {
      if (contextPack) {
        userContext.memory_pack = {
          facts: (contextPack.facts || []).map(f => ({
            category: f.category,
            key: f.key,
            value: f.value,
            confidence: f.confidence,
            pinned: !!f.pinned,
          })),
          semantic_hits: (contextPack.semantic_hits || []).map(h => ({
            snippet: h.snippet,
            score: h.score,
          })),
          recent_messages: (contextPack.recent_messages || []).map(m => ({ role: m.role, content: m.content })),
          budget: contextPack.budget,
          rationale: contextPack.rationale,
        };
      }
    } catch (e) {
      console.warn('[Memory] Failed to attach memory_pack', e);
    } finally {
      if (contextPack) {
        setShowContextPreview(false);
        setContextPack(null);
      }
    }

    // Execute the streaming call (reuse the existing sendChat logic)
    sendChat(text, userContext, screenshotData);
  }, [thoughts, contextPack]);

  // Memory Toast handlers
  const handleMemoryApply = useCallback(async (confirmedIds) => {
    try {
      await memoryAPI.apply({ proposals: memoryProposals, confirmed: confirmedIds.map(String) });
      setShowMemoryToast(false);
      setMemoryProposals([]);
      window.dispatchEvent(new Event('memory-changed'));
      toast.success('Memory saved');
    } catch (e) {
      toast.error('Failed to save memory');
      console.warn('[Memory] Apply failed', e);
    }
  }, [memoryProposals]);

  const handleMemoryDismiss = useCallback(() => {
    setShowMemoryToast(false);
  }, []);
  
  // Main streaming chat logic (extracted for reuse)
  const sendChat = useCallback((text, userContext, screenshotData) => {
    chatAPI.sendMessageStream(text, userContext, screenshotData, async (event) => {
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
        
        // Parse and execute commands (email, browser, etc.)
        if (responseText) {
          try {
            // Email command
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
                  // First, check Gmail API health
                  logger.info('[Email] Checking Gmail API health...');
                  toast.loading('Verifying Gmail connection...', { id: 'gmail-health' });
                  
                  axios.get(`http://localhost:8000/api/v2/google/gmail/health`, {
                    params: { email: userEmail }
                  }).then(healthResponse => {
                    toast.dismiss('gmail-health');
                    
                    if (!healthResponse.data.healthy) {
                      logger.error('[Email] Gmail health check failed:', healthResponse.data);
                      toast.error(`Gmail error: ${healthResponse.data.message}`);
                      return;
                    }
                    
                    logger.info('[Email] Gmail healthy, sending email...', healthResponse.data);
                    
                    // Gmail is healthy, proceed to send email
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
                  }).catch(healthError => {
                    toast.dismiss('gmail-health');
                    logger.error('[Email] Health check failed:', healthError);
                    toast.error('Failed to verify Gmail connection. Please check your connection in settings.');
                  });
                }
              }
            }
            
            // Browser command - Open URLs in user's native browser
            const browserCommandMatch = responseText.match(/```browser_command\s*\n([\s\S]*?)\n```/);
            if (browserCommandMatch) {
              const commandJson = browserCommandMatch[1].trim();
              const command = JSON.parse(commandJson);
              
              if (command.action === 'open_url') {
                logger.info('[Browser] Executing browser command', command);
                
                // Open URL in user's default browser (native UX)
                if (window.electron?.openExternal) {
                  window.electron.openExternal(command.url)
                    .then(() => {
                      logger.info('[Browser] Opened URL successfully', command.url);
                      toast.success('Opened in your browser!');
                    })
                    .catch(error => {
                      logger.error('[Browser] Failed to open URL', error);
                      toast.error(`Failed to open browser: ${error.message}`);
                    });
                } else {
                  // Fallback for non-Electron environment
                  window.open(command.url, '_blank');
                  toast.success('Opened in new tab!');
                }
              }
            }
          } catch (err) {
            logger.error('[Command] Failed to parse command', err);
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
        // If backend is down, mark offline and avoid toast spam
        setApiConnected(false);
        offlineRef.current = true;
        if (apiConnected) {
          // Only toast once when transitioning from online->offline
          toast.error(errorMsg);
        }
        // Reset buffers on error
        enrichTileIdRef.current = null;
        streamBufferRef.current = '';
        setIsThinking(false);
        setThinkingStatus('');
      }
    }).catch(error => {
      console.error('Chat error:', error);
      // Network/connection errors should flip to offline state without spamming toasts
      setApiConnected(false);
      offlineRef.current = true;
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
        // Check if user said "don't ask again" for email approvals
        const skipEmailApproval = localStorage.getItem('approval_skip_email_send') === 'true';
        
        if (skipEmailApproval) {
          // Skip approval - user previously opted out
          try {
            await permissionAPI.logActivity({
              action: text,
              category: 'communication',
              required_approval: false, // Auto-approved
              approved: true,
              markers: ['email', 'auto_approved'],
              is_high_risk: false
            });
          } catch {}
          await continueAfterPreview(text);
          return;
        }
        
        // Show approval dialog with "Don't ask again" option
        setApprovalDetails({
          action: text,
          markers: ['communication', 'email'],
          reason: 'Composing and sending email requires your approval.',
          isHighRisk: false,
          showDontAskAgain: true,
          dontAskAgainKey: 'email_send',
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
            await continueAfterPreview(text);
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
        // Check if this is an email operation and user opted out
        const isEmail = data.markers?.includes('email') || data.markers?.includes('communication');
        const skipEmailApproval = isEmail && localStorage.getItem('approval_skip_email_send') === 'true';
        
        if (skipEmailApproval) {
          // Skip approval - user previously opted out
          try {
            await permissionAPI.logActivity({
              action: text,
              required_approval: false, // Auto-approved
              approved: true,
              markers: [...(data.markers || []), 'auto_approved'],
              is_high_risk: !!data.is_high_risk
            });
          } catch {}
          await continueAfterPreview(text);
          return;
        }
        
        setApprovalDetails({
          action: text,
          markers: data.markers || [],
          reason: data.reason || 'Operation requires approval',
          isHighRisk: !!data.is_high_risk,
          showDontAskAgain: isEmail, // Only show for email operations
          dontAskAgainKey: isEmail ? 'email_send' : null,
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
            await continueAfterPreview(text);
          }
        });
        setApprovalOpen(true);
        return;
      }
    } catch (err) {
      logger.warn('Safety check failed; proceeding cautiously', err);
    }
    // No approval needed → continue
    await continueAfterPreview(text);
  }, [message, isThinking, apiConnected, continueSend]);
  
  // Handle clear conversation
  const handleClear = useCallback(() => {
    setThoughts([]);
    setFactTiles([]);
    enrichTileIdRef.current = null;
    clearMessages();
    
    // Start new session in memory manager
    if (window.electron?.memory?.startSession) {
      window.electron.memory.startSession()
        .then(() => {
          console.log('[Session] New session started after clear');
          toast.success('New conversation started');
        })
        .catch(err => {
          console.warn('[Session] Failed to start new session:', err);
          toast.success('Conversation cleared');
        });
    } else {
      toast.success('Conversation cleared');
    }
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
          
          {/* Better Memory: Context Preview */}
          {showContextPreview && contextPack && (
            <div style={{ marginBottom: 8 }}>
              <ContextPreview
                pack={contextPack}
                onToggle={(controls) => logger.info('[Memory] Context controls', controls)}
                isExpanded={contextPreviewExpanded}
                onToggleExpand={() => setContextPreviewExpanded(!contextPreviewExpanded)}
              />
            </div>
          )}
          {isLoadingContext && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 8, borderRadius: 8, background: 'rgba(33,150,243,0.08)', color: '#2196F3' }}>
              <Loader2 size={14} className="spin" />
              <span style={{ fontSize: '0.85rem' }}>Loading context…</span>
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
                  {thought.role === 'assistant' && thought.memoryLabel && (
                    <div style={{ marginTop: 6, fontSize: '0.75rem', color: '#065f46', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: '6px 8px' }}>
                      {thought.memoryLabel}
                    </div>
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
        showDontAskAgain={approvalDetails.showDontAskAgain || false}
        dontAskAgainKey={approvalDetails.dontAskAgainKey || null}
        onApprove={(dontAskAgain) => {
          const fn = approvalDetails.onApprove;
          setApprovalOpen(false);
          if (typeof fn === 'function') {
            try {
              const ret = fn();
              if (ret && typeof ret.then === 'function') {
                ret.catch(() => {});
              }
            } catch {}
          }
        }}
        approveButtonText="Approve"
      />
      
      {/* Offline/Reconnecting pill */}
      {!apiConnected && (
        <div
          style={{
            position: 'fixed',
            bottom: '86px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10002,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'linear-gradient(180deg, rgba(22,22,24,0.92), rgba(16,16,18,0.92))',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.9)',
            borderRadius: 12,
            padding: '7px 10px',
            boxShadow: '0 8px 26px rgba(0,0,0,0.28)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)'
          }}
        >
          <Loader2 size={14} className="spin" />
          <span style={{ fontSize: '0.82rem' }}>Disconnected — retrying…</span>
          <button
            onClick={() => healthAPI.check().then(() => setApiConnected(true)).catch(() => {})}
            style={{
              marginLeft: 8,
              padding: '4px 8px',
              fontSize: '0.78rem',
              color: '#fff',
              background: 'linear-gradient(180deg, #2a2a2e 0%, #1a1a1d 100%)',
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: 8,
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Better Memory: Extraction Toast */}
      {showMemoryToast && (
        <MemoryToast
          proposals={memoryProposals}
          onApply={handleMemoryApply}
          onDismiss={handleMemoryDismiss}
        />
      )}

      {/* Reconnected flash */}
      {showReconnected && (
        <div
          style={{
            position: 'fixed',
            bottom: '86px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10002,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'linear-gradient(180deg, rgba(0,122,85,0.95), rgba(0,122,85,0.9))',
            border: '1px solid rgba(0,255,170,0.35)',
            color: '#eafff5',
            borderRadius: 12,
            padding: '7px 10px',
            boxShadow: '0 8px 26px rgba(0,0,0,0.28)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)'
          }}
        >
          <Check size={14} />
          <span style={{ fontSize: '0.82rem' }}>Reconnected</span>
        </div>
      )}

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
