/**
 * Apple-style FloatBar Component
 * Clean, expanding bar-only UI with glassmorphism
 * Replaces card mode entirely with a dynamic expanding bar
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Settings, RotateCcw, Wrench, ArrowUp, Loader2, Minimize2, Check, ChevronDown, ChevronRight, Lightbulb } from 'lucide-react';
import useStore from '../../store/useStore';
import { chatAPI, permissionAPI, googleAPI, ambiguityAPI, semanticAPI, factsAPI, addConnectionListener, healthAPI, runAPI } from '../../services/api';
import toast from 'react-hot-toast';
import axios from 'axios';
import { CreditDisplay } from '../CreditDisplay';
import { supabase, checkResponseCache, storeResponseCache } from '../../services/supabase';
import { createLogger } from '../../services/logger';
import apiConfigManager from '../../config/apiConfig';
import LogoPng from '../../assets/AgentMaxLogo.png';
import { getProfile, getFacts, getPreferences, setPreference, startSession, addMessage, getRecentMessages, getAllSessions } from '../../services/supabaseMemory';
import { searchContext as hybridSearchContext } from '../../services/hybridSearch';
import memoryService from '../../services/memory';
import contextSelector from '../../services/contextSelector';
import { FactTileList } from '../FactTileList.jsx';
import PlanCard from '../PlanCard';
import { usePermission } from '../../contexts/PermissionContext';
import ApprovalDialog from '../ApprovalDialog';
import './AppleFloatBar.css';
import './FloatBar.css';

// Better Memory integration
import memoryAPI from '../../services/memoryAPI';
import ContextPreview from './ContextPreview';
import MemoryToast from '../MemoryToast';
import { OnboardingFlow } from '../onboarding/OnboardingFlow';

const logger = createLogger('FloatBar');

const MIN_EXPANDED_HEIGHT = 140;

const truncateText = (value, limit = 160) => {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit)}…`;
};

const formatArtifactSummary = (artifact) => {
  if (!artifact || typeof artifact !== 'object') {
    return '- artifact (unknown)';
  }
  const source = artifact.source ? `[${artifact.source}] ` : '';
  const label = artifact.path || artifact?.metadata?.command || artifact.action || 'artifact';
  const parts = [];
  if (artifact.summary) parts.push(artifact.summary);
  if (artifact.stdout) parts.push(`stdout: ${truncateText(artifact.stdout, 120)}`);
  if (artifact.stderr) parts.push(`stderr: ${truncateText(artifact.stderr, 120)}`);
  const suffix = parts.length ? ` — ${parts.join(' | ')}` : '';
  return `- ${source}${label} (${artifact.kind || 'unknown'})${suffix}`;
};

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
  // Autonomous mode state
  const [executionPlan, setExecutionPlan] = useState(null);
  const [actionPlanMetadata, setActionPlanMetadata] = useState(null);
  const [clarifyStats, setClarifyStats] = useState(null);
  const [confirmStats, setConfirmStats] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [executionMode, setExecutionMode] = useState(null);
  const [desktopActionsRequired, setDesktopActionsRequired] = useState(false);
  const [desktopBridgeStatus, setDesktopBridgeStatus] = useState(null);
  const lastUserPromptRef = useRef('');
  const lastAssistantTsRef = useRef(null);
  const accumulatedResponseRef = useRef('');  // For fs_command extraction
  const executedCommandsRef = useRef(new Set());  // Track executed commands to avoid duplicates
  const planIdRef = useRef(null);
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
  const offlineDesktopToastRef = useRef(false);
  const continueSendMessageRef = useRef(null); // dispatcher to avoid TDZ
  const [showReconnected, setShowReconnected] = useState(false);
  const thoughtIdRef = useRef(null); // current inline thought entry id
  const [execPanelOpen, setExecPanelOpen] = useState(true);
  const [executionDetails, setExecutionDetails] = useState(null);
  const [planCardDismissed, setPlanCardDismissed] = useState(false);
  const executionModeRef = useRef(null);
  const desktopActionsRef = useRef(false);
  const chatModeAnnouncementRef = useRef(false);
  const [heartbeatStatus, setHeartbeatStatus] = useState({ stale: false, last: null });
  const [runExecLogs, setRunExecLogs] = useState([]);
  const [artifactSummary, setArtifactSummary] = useState(null);
  const handleCancelRun = useCallback(async () => {
    const planId = planIdRef.current || executionPlan?.plan_id || executionPlan?.planId;
    if (!planId) {
      toast.error('No active run to cancel');
      return;
    }
    try {
      await runAPI.cancel(planId);
      toast('Run cancelled', { icon: '🛑', duration: 2500 });
    } catch (err) {
      toast.error(`Cancel failed: ${err?.message || err}`);
    }
  }, [executionPlan]);

  const handlePauseRun = useCallback(async () => {
    const planId = planIdRef.current || executionPlan?.plan_id || executionPlan?.planId;
    if (!planId) {
      toast.error('No active run to pause');
      return;
    }
    try {
      await runAPI.pause(planId);
      toast('Run paused', { icon: '⏸️', duration: 2500 });
    } catch (err) {
      toast.error(`Pause failed: ${err?.message || err}`);
    }
  }, [executionPlan]);

  const handleResumeRun = useCallback(async () => {
    const planId = planIdRef.current || executionPlan?.plan_id || executionPlan?.planId;
    if (!planId) {
      toast.error('No paused run to resume');
      return;
    }
    try {
      await runAPI.resume(planId);
      toast('Run resumed', { icon: '▶️', duration: 2500 });
    } catch (err) {
      toast.error(`Resume failed: ${err?.message || err}`);
    }
  }, [executionPlan]);
  const copyToClipboard = useCallback(async (text, note = 'Copied') => {
    try {
      await navigator.clipboard.writeText(String(text || ''));
      toast.success(note);
    } catch (_) {
      toast.error('Copy failed');
    }
  }, []);
  const handleDesktopReconnect = useCallback(async () => {
    try {
      if (typeof window === 'undefined') return;
      if (window?.electron?.handsOnDesktop?.toggle) {
        await window.electron.handsOnDesktop.toggle(true);
      }
    } catch (err) {
      logger.warn('[FloatBar] Desktop reconnect failed', { error: err?.message });
    }
  }, []);
  
  const { level: permissionLevel, updateLevel } = usePermission();
  const permissionModeRef = useRef((permissionLevel || '').toLowerCase());
  useEffect(() => {
    permissionModeRef.current = (permissionLevel || '').toLowerCase();
  }, [permissionLevel]);
  const permissionKey = (permissionLevel || '').toLowerCase();
  const isHelpfulMode = permissionKey === 'helpful';
  const planCardAllowed = isHelpfulMode && executionMode !== 'chat';
  const shouldDisplayPlanCard = useCallback(() => {
    const key = permissionModeRef.current;
    const execMode = executionModeRef.current;
    return key === 'helpful' && execMode !== 'chat';
  }, []);

  const planCardData = useMemo(() => {
    if (!executionPlan || !executionPlan.steps) return null;
    const steps = Array.isArray(executionPlan.steps) ? executionPlan.steps : [];
    const metadataList = executionPlan.actionPlanMetadata || [];
    
    const tasks = steps.map((step, idx) => {
      const meta = metadataList[idx] || {};
      const rawArgs = (step.args && Object.keys(step.args).length > 0) ? step.args : (meta.args_preview || {});
      const dependencies = Array.isArray(step.dependencies) ? step.dependencies : (meta.dependencies || []);
      const rawBranches = Array.isArray(step.branches) ? step.branches : (meta.branches ? [].concat(meta.branches) : []);
      const loopInfo = step.loop || meta.loop || null;
      const capability = step.action || step.tool || meta.action || step.capability || '';
      
      return {
        id: step.step_id || `step-${idx + 1}`,
        step_id: step.step_id || `step-${idx + 1}`,
        description: step.description || step.goal || `Step ${idx + 1}`,
        goal_slice: step.goal,
        capability,
        tool_id: capability ? capability.toUpperCase() : undefined,
        estimated_duration_ms: step.estimated_tokens ? step.estimated_tokens * 20 : undefined,
        requires_approval: Boolean(step.requires_confirmation || meta.needs_confirm),
        risk_level: meta.risk_level || (step.requires_confirmation ? 'medium' : 'low'),
        args: rawArgs,
        dependencies,
        parallel_safe: typeof step.parallel_safe === 'boolean' ? step.parallel_safe : Boolean(meta.parallel_safe),
        verification: step.verification || meta.verification,
        branches: rawBranches,
        loop: loopInfo
      };
    });
    
    const derivedMetadata = {
      ...(executionPlan.metadata || {}),
      reasoning: executionPlan.reasoning || executionPlan.metadata?.reasoning
    };
    if (!derivedMetadata.risk_level) {
      if (tasks.some(t => t.risk_level === 'high')) {
        derivedMetadata.risk_level = 'high';
      } else if (tasks.some(t => t.risk_level === 'medium')) {
        derivedMetadata.risk_level = 'medium';
      } else {
        derivedMetadata.risk_level = 'low';
      }
    }
    
    return {
      plan_id: executionPlan.plan_id,
      goal: executionPlan.goal || lastUserPromptRef.current || 'Current request',
      tasks,
      metadata: derivedMetadata,
      requires_approval: tasks.some(t => t.requires_approval),
      total_estimated_duration_ms: executionPlan.total_estimated_duration_ms || (tasks.length * 45000),
      reasoning: executionPlan.reasoning
    };
  }, [executionPlan]);
  
  const handlePlanApprove = useCallback(() => {
    toast.success('Plan acknowledged');
    setPlanCardDismissed(true);
  }, []);
  
  const handlePlanReject = useCallback(() => {
    toast('Plan hidden. Ask again to replan.');
    setPlanCardDismissed(true);
  }, []);
  
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

  // If onboarding should be shown, auto-expand the bar so the overlay is visible
  useEffect(() => {
    if (showWelcome === true && isMiniRef.current) {
      try {
        // Inline minimal expansion to avoid referencing handleExpand before init
        setIsTransitioning(true);
        setIsMini(false);
        isMiniRef.current = false;
        (async () => {
          try {
            const base = MIN_EXPANDED_HEIGHT;
            if (window.electron?.resizeWindow) {
              await window.electron.resizeWindow(360, base);
              lastHeightRef.current = base;
            }
          } catch {}
          setTimeout(() => {
            inputRef.current?.focus();
            setIsTransitioning(false);
          }, 300);
        })();
      } catch {}
    }
  }, [showWelcome]);

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
  
  // Helper to map UI level to backend mode
  const resolveMode = useCallback(() => {
    const lvl = (permissionLevel || '').toLowerCase();
    if (lvl === 'powerful' || lvl === 'autonomous') return 'autonomous';
    if (lvl === 'chatty') return 'chatty';
    return 'helpful';
  }, [permissionLevel]);
  
  // Hard route guard: the FloatBar window should never navigate to /settings
  useEffect(() => {
    const keepRoot = () => {
      try {
        const h = window.location?.hash || '#/'

        if (h.startsWith('#/settings')) {
          // Replace without adding history entries or causing flashes
          if (window.history?.replaceState) window.history.replaceState(null, '', '#/');
          else window.location.hash = '#/';
        }
      } catch {}
    };
    keepRoot();
    window.addEventListener('hashchange', keepRoot);
    return () => window.removeEventListener('hashchange', keepRoot);
  }, []);
  
  const sendActionResult = useCallback(async (planId, stepId, actionType, result) => {
    try {
      const cfg = apiConfigManager.getConfig ? apiConfigManager.getConfig() : { baseURL: apiConfigManager.getBaseURL?.() };
      const base = (cfg?.baseURL || '').replace(/\/$/, '');
      if (!base) return;
      const headers = {
        'Content-Type': 'application/json',
      };
      const key = (cfg && cfg.apiKey) || (apiConfigManager.getApiKey && apiConfigManager.getApiKey());
      if (key) headers['X-API-Key'] = key;
      try {
        const uid = localStorage.getItem('user_id');
        if (uid) headers['X-User-Id'] = uid;
      } catch {}
      const payload = { plan_id: planId, step_id: stepId, action_type: actionType, result };
      await fetch(`${base}/api/v2/agent/action-result`, { method: 'POST', headers, body: JSON.stringify(payload) }).catch(() => {});
    } catch {}
  }, []);

  // Start new session on mount
  useEffect(() => {
    if (localStorage.getItem('user_id')) {
      startSession()
        .then(() => console.log('[Session] New session started on mount'))
        .catch(err => console.warn('[Session] Failed to start session:', err));
    }
  }, []);

  // Preference: show memory preview UI (default off)
  const memoryPreviewEnabled = useMemo(() => {
    try { return localStorage.getItem('pref_memory_preview') === '1'; } catch { return false; }
  }, []);
  const memoryAutoApply = useMemo(() => {
    try { return localStorage.getItem('pref_memory_auto_apply') !== '0'; } catch { return true; }
  }, []);
  const memoryReviewEnabled = useMemo(() => {
    try { return localStorage.getItem('pref_memory_review') === '1'; } catch { return false; }
  }, []);
  const memoryDebugEnabled = useMemo(() => {
    try { return localStorage.getItem('pref_memory_debug') === '1'; } catch { return false; }
  }, []);
  // Safety preference: disable PII warnings for local-only reads (default ON)
  const safetyDisablePII = useMemo(() => {
    try { const v = localStorage.getItem('pref_safety_disable_pii'); return v !== '0'; } catch { return true; }
  }, []);

  // Retrieve Better Memory context pack for a message
  const doRetrieveContext = useCallback(async (text) => {
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
      if (memoryPreviewEnabled) {
        setShowContextPreview(true);
        setContextPreviewExpanded(true);
      }
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
  }, [memoryPreviewEnabled]);

  const mkActionFP = useCallback((type, args) => {
    try { return `fp:${JSON.stringify({ t: type || '', a: args || {} })}`; } catch { return `fp:${type||''}`; }
  }, []);

  const logTelemetry = useCallback((eventType, data) => {
    try {
      if (window.telemetry && typeof window.telemetry.record === 'function') {
        window.telemetry.record(eventType, { source: 'renderer', ...(data || {}) });
      }
    } catch {}
  }, []);

  // Helper: retrieve context then proceed to send (optionally auto-send)
  const continueAfterPreview = useCallback(async (text) => {
    const pack = await doRetrieveContext(text);
    if (autoSend) {
      // Call immediately for instant UI feedback (memory is automatic now)
      // Pass pack directly to avoid stale state
      try { 
        if (continueSendMessageRef.current) {
          continueSendMessageRef.current(text, null, pack);
        }
      } catch (e) { 
        console.warn('continueSendMessage not available', e); 
      }
    } else {
      // Only show preview UI if enabled; otherwise proceed silently
      if (memoryPreviewEnabled) {
        toast.success('Context prepared. Press send to continue.');
      }
    }
  }, [autoSend, doRetrieveContext, memoryPreviewEnabled]);

  // Handle expand/collapse
  const handleExpand = useCallback(() => {
    setIsTransitioning(true);
    setIsMini(false);
    isMiniRef.current = false;

    // Restore last height immediately to avoid visible shrink
    (async () => {
      try {
        const hasMessages = thoughts.length > 0;
        const onboarding = showWelcome === true;
        const base = onboarding ? 520 : MIN_EXPANDED_HEIGHT;
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

  // Inline Thought helpers
  const appendThought = useCallback((text) => {
    if (!text || typeof text !== 'string') return;
    
    setThoughts(prev => {
      // Lazy creation: if no current thought bubble exists, create it
      if (!thoughtIdRef.current) {
        const id = crypto.randomUUID();
        thoughtIdRef.current = id;
        return [
          ...prev,
          {
            id,
            type: 'thought',
            label: 'Thought',
            message: text,
            expanded: true,
            timestamp: Date.now(),
          },
        ];
      }
      
      // Otherwise append to existing bubble
      const idx = prev.findIndex(m => m?.id === thoughtIdRef.current && m?.type === 'thought');
      if (idx === -1) return prev;
      const updated = [...prev];
      const existing = updated[idx];
      updated[idx] = {
        ...existing,
        message: (existing.message || '') + (existing.message ? '\n' : '') + text,
      };
      return updated;
    });
  }, []);

  const collapseCurrentThought = useCallback(() => {
    const id = thoughtIdRef.current;
    if (!id) return;
    setThoughts(prev => {
      const idx = prev.findIndex(m => m?.id === id && m?.type === 'thought');
      if (idx === -1) return prev;
      const updated = [...prev];
      const existing = updated[idx];
      const wc = (existing.message || '').trim().split(/\s+/).filter(Boolean).length;
      
      // If empty, remove the bubble entirely; otherwise collapse it
      if (wc === 0) {
        updated.splice(idx, 1);
        return updated;
      }
      
      updated[idx] = { ...existing, expanded: false, wordCount: wc };
      return updated;
    });
    thoughtIdRef.current = null;
  }, []);

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
  
  // Extract and execute fs_command blocks from AI response
  const extractAndExecuteCommands = useCallback(async (responseText) => {
    if (desktopActionsRef.current) {
      console.log('[FSCommand] Skipping inline fs_command execution; Hands-on Desktop will handle actions');
      return;
    }
    // Extract all fs_command blocks using regex
    const regex = /```fs_command\s+([\s\S]*?)```/g;
    const matches = [...responseText.matchAll(regex)];
    
    if (matches.length === 0) return;
    
    console.log(`[FSCommand] Found ${matches.length} command block(s)`);
    
    for (const match of matches) {
      try {
        const commandJson = match[1].trim();
        const command = JSON.parse(commandJson);
        
        // Create unique ID for this command to avoid duplicate execution
        const commandId = JSON.stringify(command);
        
        // Skip if already executed
        if (executedCommandsRef.current.has(commandId)) {
          console.log('[FSCommand] Skipping duplicate command');
          continue;
        }
        
        // Mark as executed
        executedCommandsRef.current.add(commandId);
        
        console.log('[FSCommand] Executing:', command);
        
        // Show "Executing..." toast
        toast(`🔧 Executing ${command.action}...`, {
          duration: 2000,
          icon: '⚡',
          style: {
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            backdropFilter: 'blur(10px)'
          }
        });
        
        // Execute via IPC
        if (window.electron && window.electron.memory && window.electron.memory.autonomous) {
          const normalized = (command && !command.type && command.action)
            ? { type: command.action, args: command.args || {} }
            : command;
          // Show running state immediately
          try {
            const now = Date.now();
            const actType = normalized?.type || '';
            setExecutionDetails({
              when: now,
              actionType: actType,
              args: normalized?.args || {},
              command: (actType === 'sh.run') ? (normalized?.args?.command || '') : '',
              status: 'running'
            });
            setExecPanelOpen(true);
          } catch {}

          const result = await window.electron.memory.autonomous.execute('fs_command', normalized, { allowAll: true }).catch(err => ({ success: false, error: { message: err?.message } }));
          const actType = command.action || normalized?.type || '';

          if (result && result.success) {
            // Success toast
            const labelMap = { 'fs.write': 'File created', 'fs.read': 'File read', 'fs.append': 'File updated', 'fs.list': 'Directory listed', 'fs.delete': 'File deleted', 'sh.run': 'Command executed' };
            const label = labelMap[actType] || 'Action completed';
            toast.success(`✅ ${label}`, {
              duration: 3000,
              style: { background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', backdropFilter: 'blur(10px)' }
            });
            // Previews
            if (actType === 'fs.read' && result.result?.content) {
              const content = result.result.content;
              const preview = content.length > 500 ? content.substring(0, 500) + '...' : content;
              toast(`📄 File contents (preview)\n${preview}`, { duration: 4000, style: { background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', whiteSpace: 'pre-wrap' } });
            }
            if (actType === 'fs.list' && result.result?.files) {
              const files = result.result.files;
              const fileList = files.map(f => `- ${f.type === 'directory' ? '📁' : '📄'} ${f.name} (${f.size} bytes)`).join('\n');
              toast(`📂 Directory contents:\n${fileList}`, { duration: 4000, style: { background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', whiteSpace: 'pre-wrap' } });
            }
            try {
              setExecutionDetails({
                when: Date.now(),
                actionType: normalized?.type || '',
                args: normalized?.args || {},
                command: (normalized?.type === 'sh.run') ? (normalized?.args?.command || '') : '',
                status: result?.result?.status || 'completed',
                duration_ms: result?.result?.duration_ms,
                exit_code: result?.result?.exit_code ?? 0,
                stdout: result?.result?.stdout || '',
                stderr: result?.result?.stderr || ''
              });
              setExecPanelOpen(true);
            } catch {}
          } else {
            // Failure toast
            const stderr = result?.error?.stderr || result?.result?.stderr || '';
            const stdout = result?.error?.stdout || result?.result?.stdout || '';
            const detail = (stderr || stdout || result?.error?.message || 'Unknown error').toString();
            const preview = detail.length > 240 ? detail.slice(0, 240) + '…' : detail;
            const label = actType === 'sh.run' ? 'Command failed' : 'Action failed';
            logTelemetry('desktop.fs_execute.fail', { action_type: normalized?.type, origin: 'fs_command', error: result?.error });
            toast.error(`❌ ${label}: ${preview}`, { duration: 5000, style: { background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', backdropFilter: 'blur(10px)', whiteSpace: 'pre-wrap' } });
            try {
              setExecutionDetails({
                when: Date.now(),
                actionType: normalized?.type || '',
                args: normalized?.args || {},
                command: (normalized?.type === 'sh.run') ? (normalized?.args?.command || '') : '',
                status: result?.result?.status || 'failed',
                duration_ms: result?.result?.duration_ms,
                exit_code: (typeof result?.error?.code === 'number') ? result.error.code : (result?.result?.exit_code ?? 1),
                stdout,
                stderr
              });
              setExecPanelOpen(true);
            } catch {}
          }
        } else {
          console.warn('[FSCommand] window.electron not available - running in browser mode');
          toast('⚠️ Desktop features not available in browser mode', { duration: 3000 });
        }
        
      } catch (error) {
        console.error('[FSCommand] Parse/execute error:', error);
        toast.error(`❌ Command error: ${error.message}`, {
          duration: 4000
        });
      }
    }
  }, []);
  
  // Main streaming chat logic (extracted for reuse)
  const sendChat = useCallback((text, userContext, screenshotData) => {
    // Track token usage for credit calculation
    let totalOutputTokens = 0;
    
    chatAPI.sendMessageStream(text, userContext, screenshotData, async (event) => {
      console.log('[Chat] Received SSE event:', event);
      
      // Handle SSE events - backend sends {type: string, data: {...}}
      if (event.type === 'ack') {
        // Stream started - clear buffer and prepare for real-time tokens
        streamBufferRef.current = '';
        accumulatedResponseRef.current = '';  // Clear fs_command accumulator
        executedCommandsRef.current.clear();  // Clear executed commands tracking
        enrichTileIdRef.current = null;
        // Reset thought ref (bubble will be created lazily on first thinking event)
        thoughtIdRef.current = null;
        setActionPlanMetadata(null);
        setClarifyStats(null);
        setConfirmStats(null);
        setExecutionPlan(null);
        setPlanCardDismissed(!shouldDisplayPlanCard());
        setCurrentStep(0);
        setTotalSteps(0);
        setExecutionMode(null);
        executionModeRef.current = null;
        setDesktopActionsRequired(true);
        desktopActionsRef.current = true;
        chatModeAnnouncementRef.current = false;
        setThinkingStatus('Thinking...');
      } else if (event.type === 'metadata') {
        const meta = event.data || event;
        const key = meta.key || meta.metadata_key || meta.name;
        const value = meta.value ?? meta.data ?? null;
        if (!key) {
          console.warn('[Chat] metadata event missing key', meta);
        } else if (key === 'action_plan') {
          setActionPlanMetadata(value);
         setExecutionPlan(prev => prev ? { ...prev, actionPlanMetadata: value } : prev);
       } else if (key === 'run_status' || meta.run_status) {
         const runState = meta.run_status || value || meta;
         if (runState?.last_heartbeat_at) {
           const hbMs = new Date(runState.last_heartbeat_at).getTime();
           const ageMs = Date.now() - hbMs;
           const stale = ageMs > 30000;
           setHeartbeatStatus({ stale, last: hbMs });
         }
         if (runState?.status === 'cancelled') {
           toast('Run cancelled', { icon: '🛑', duration: 2500 });
           setThinkingStatus('Cancelled');
         } else if (runState?.status === 'paused') {
           toast('Run paused', { icon: '⏸️', duration: 2500 });
           setThinkingStatus('Paused');
         } else if (runState?.status === 'failed') {
           toast.error('Run failed', { duration: 3000 });
           setThinkingStatus('Failed');
         }
       } else if (key === 'clarify_stats') {
          setClarifyStats(value);
        } else if (key === 'confirm_stats') {
          setConfirmStats(value);
        } else if (key === 'execution_mode') {
          executionModeRef.current = value;
          setExecutionMode(value);
          if (value === 'chat') {
            setThinkingStatus('Answering directly…');
            if (!chatModeAnnouncementRef.current) {
              chatModeAnnouncementRef.current = true;
              setThoughts(prev => [...prev, {
                role: 'system',
                content: '💬 Answering directly — no desktop actions required.',
                timestamp: Date.now(),
                type: 'status'
              }]);
            }
          } else {
            chatModeAnnouncementRef.current = false;
            setThinkingStatus('Planning actions…');
          }
        } else if (key === 'desktop_actions_required') {
          const normalized = Boolean(value);
          desktopActionsRef.current = normalized;
          setDesktopActionsRequired(normalized);
        }
      } else if (event.type === 'exec_log' && event.data?.source === 'run_stream') {
        // Mirror run stream exec logs into the Thoughts area and progress UI
        const log = event.data;
        const msg = log.message || log.stdout || log.error || '';
        const status = log.status || 'info';
        if (msg) {
          appendThought(msg);
          setThinkingStatus(msg);
        }
        if (status === 'replanning') {
          toast(`🔄 ${msg || 'Replanning...'}`, { duration: 3000 });
        }
        setRunExecLogs(prev => {
          const next = [{ ...log, ts: Date.now() }, ...prev];
          return next.slice(0, 10);
        });
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
        
        // Track tokens for credit calculation (approximate: ~4 chars per token)
        totalOutputTokens += Math.ceil(content.length / 4);
        
        // Accumulate response for fs_command extraction
        accumulatedResponseRef.current += content;
        
        // Check for complete fs_command blocks (periodically)
        if (accumulatedResponseRef.current.includes('```fs_command') && accumulatedResponseRef.current.includes('```')) {
          extractAndExecuteCommands(accumulatedResponseRef.current);
        }
        
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
      } else if (event.type === 'plan') {
        if (executionModeRef.current === 'chat') {
          return;
        }
        // Autonomous mode: AI generated execution plan
        const rawPlan = event.data || event;
        const mergedMetadata = rawPlan.actionPlanMetadata || actionPlanMetadata || null;
        const planData = { ...rawPlan, actionPlanMetadata: mergedMetadata };
        planIdRef.current = planData.plan_id || planData.planId || planData.id || null;
        console.log('[Chat] Execution plan received:', planData);
        setExecutionPlan(planData);
        setPlanCardDismissed(!shouldDisplayPlanCard());
        setTotalSteps(planData.total_steps || planData.steps?.length || 0);
        setCurrentStep(0);
        setThinkingStatus(`📋 Plan ready: ${planData.total_steps || 0} steps`);
        
        // Show plan as a special message (annotated with metadata when available)
        const planSteps = (planData.steps || []).map((step, idx) => {
          const detail = mergedMetadata && mergedMetadata[idx];
          const suffix = detail ? ` _(risk: ${detail.risk_level || 'unknown'}${detail.parallel_safe ? ', parallel' : ''})_` : '';
          return `${idx + 1}. ${step.description || step.command || 'Processing...'}${suffix}`;
        }).join('\n');
        let metadataBlock = '';
        if (mergedMetadata && mergedMetadata.length) {
          metadataBlock = '\n\n_Action Details:_\n' + mergedMetadata.map((item, idx) => {
            const label = item.action || `Step ${idx + 1}`;
            const safe = item.parallel_safe ? 'parallel-safe' : 'serial-only';
            return `- ${label}: risk=${item.risk_level || 'unknown'}, ${safe}`;
          }).join('\n');
        }
        const desktopNote = desktopActionsRef.current ? '\n\n🖥️ Hands-on Desktop will run these actions.' : '\n\n☁️ Running entirely in the cloud.';
        
        setThoughts(prev => [...prev, {
          role: 'assistant',
          content: `**Execution Plan:**\n${planSteps}${planData.reasoning ? `\n\n*${planData.reasoning}*` : ''}${metadataBlock}${desktopNote}`,
          timestamp: Date.now(),
          type: 'plan'
        }]);
        // Append a brief summary into the Thought bubble as well
        const summary = `Plan ready: ${(planData.total_steps || planData.steps?.length || 0)} steps`;
        appendThought(summary);
      } else if (event.type === 'exec_log') {
        const log = event.data || event;
        const status = log.status || 'info';
        const msg = log.message || 'Processing...';
        
        // Extract action name for user-friendly notifications
        const extractActionName = (message) => {
          const match = message.match(/Executed (\S+):/);
          if (match) {
            const action = match[1];
            // Make action names user-friendly
            const friendlyNames = {
              'fs.write': 'File created',
              'fs.read': 'File read',
              'fs.append': 'File updated',
              'fs.list': 'Directory listed',
              'fs.delete': 'File deleted',
              'sh.run': 'Command executed'
            };
            return friendlyNames[action] || action;
          }
          return 'Action';
        };
        
        // Handle different exec_log statuses
        switch (status) {
          case 'info':
            // Parse debug info - show action count if present
            if (msg.includes('action(s) found')) {
              const count = parseInt(msg.match(/(\d+) action/)?.[1] || '0');
              if (count > 0) {
                toast(`🔧 Executing ${count} action(s)...`, {
                  duration: 2000,
                  icon: '⚡',
                  style: {
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    backdropFilter: 'blur(10px)'
                  }
                });
                setThinkingStatus(`Executing ${count} action(s)...`);
              }
            }
            break;
            
          case 'completed':
            // Action succeeded - show success notification
            const actionName = extractActionName(msg);
            toast.success(`✅ ${actionName}`, {
              duration: 3000,
              style: {
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
                backdropFilter: 'blur(10px)'
              }
            });
            setThinkingStatus(actionName);
            break;
            
          case 'failed':
            // Action failed - show error notification
            // Extract minimal reason
            const reason = (typeof msg === 'string' ? msg : (log.error || 'Action failed')).toString();
            toast.error(`❌ ${reason}`, {
              duration: 5000,
              style: {
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                backdropFilter: 'blur(10px)'
              }
            });
            setThinkingStatus('Action failed');
            break;
            
          case 'replanning':
            // v2.1: Pivot guidance - AI is replanning after failure
            toast(`🔄 ${msg}`, {
              duration: 5000,
              icon: '🔄',
              style: {
                background: 'rgba(251, 191, 36, 0.1)',
                border: '1px solid rgba(251, 191, 36, 0.2)',
                backdropFilter: 'blur(10px)'
              }
            });
            setThinkingStatus('Replanning...');
            appendThought(`Pivot: ${msg}`);
            break;
            
          case 'blocked':
            // v2.1: Pivot guidance - AI blocked after repeated failures
            toast.error(`🚫 ${msg}`, {
              duration: 6000,
              icon: '🚫',
              style: {
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                backdropFilter: 'blur(10px)'
              }
            });
            setThinkingStatus('Action blocked');
            appendThought(`Blocked: ${msg}`);
            break;
            
          case 'queued':
            // Action needs approval - show warning
            toast(`⚠️ ${msg}`, {
              duration: 4000,
              icon: '🔒',
              style: {
                background: 'rgba(251, 191, 36, 0.1)',
                border: '1px solid rgba(251, 191, 36, 0.2)',
                backdropFilter: 'blur(10px)'
              }
            });
            setThinkingStatus('Waiting for desktop helper…');
            try {
              if (desktopActionsRef.current) {
                console.log('[Exec] Hands-on Desktop handling queued action; skipping legacy LocalExecutor path');
                break;
              }
              if (window.electron && window.electron.memory && window.electron.memory.autonomous) {
                const at = log.action_type || (typeof msg === 'string' ? (msg.match(/Action requested:\s*([A-Za-z0-9_.-]+)/)?.[1] || null) : null);
                const aa = log.action_args || log.args || {};
                if (at) {
                  const planId = log.plan_id || log.planId || null;
                  const stepId = log.step_id || log.stepId || null;
                  const execKey = JSON.stringify({ pid: planId, sid: stepId, at, aa });
                  const actionFP = mkActionFP(at, aa);
                  // Strengthened dedup: check both per-step key and action fingerprint
                  if (!executedCommandsRef.current.has(execKey) && !executedCommandsRef.current.has(actionFP)) {
                    executedCommandsRef.current.add(execKey);
                    executedCommandsRef.current.add(actionFP);
                    toast(`🔧 Executing ${at}...`, {
                      duration: 2000,
                      icon: '⚡',
                      style: { background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', backdropFilter: 'blur(10px)' }
                    });
                    const normalized = { type: at, args: aa || {} };
                    const execResult = await window.electron.memory.autonomous.execute(stepId, normalized, { allowAll: true });
                    if (execResult?.success) {
                      const an = (at || '').split('.')[1] || at;
                      const fn = { write: 'File created', read: 'File read', append: 'File updated', list: 'Directory listed', delete: 'File deleted' };
                      const label = fn[an] || 'Action completed';
                      toast.success(`✅ ${label}`, { duration: 3000, style: { background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', backdropFilter: 'blur(10px)' } });
                      await sendActionResult(planId, stepId, at, execResult.result).catch(() => {});
                      try {
                        setExecutionDetails({
                          when: Date.now(),
                          planId,
                          stepId,
                          actionType: at,
                          args: aa || {},
                          command: (at === 'sh.run') ? (aa?.command || '') : '',
                          exit_code: execResult?.result?.exit_code ?? 0,
                          stdout: execResult?.result?.stdout || '',
                          stderr: execResult?.result?.stderr || ''
                        });
                        setExecPanelOpen(true);
                      } catch {}
                    } else if (execResult && execResult.error) {
                      const stderr = execResult.error?.stderr || execResult.result?.stderr || '';
                      const stdout = execResult.error?.stdout || execResult.result?.stdout || '';
                      const detail = (stderr || stdout || execResult.error?.message || 'Action failed').toString();
                      const preview = detail.length > 240 ? detail.slice(0, 240) + '…' : detail;
                      toast.error(`❌ ${preview}`, { duration: 5000, style: { background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', backdropFilter: 'blur(10px)', whiteSpace: 'pre-wrap' } });
                      try {
                        setExecutionDetails({
                          when: Date.now(),
                          planId,
                          stepId,
                          actionType: at,
                          args: aa || {},
                          command: (at === 'sh.run') ? (aa?.command || '') : '',
                          exit_code: (typeof execResult?.error?.code === 'number') ? execResult.error.code : (execResult?.result?.exit_code ?? 1),
                          stdout,
                          stderr
                        });
                        setExecPanelOpen(true);
                      } catch {}
                    }
                  }
                }
              }
            } catch (err) {
              console.warn('[Exec] Auto-execution error', err);
            }
            break;
            
          default:
            // Generic handling
            setThinkingStatus(msg);
            appendThought(msg);
        }
        
        if (typeof log.step === 'number') { setCurrentStep(log.step); }
      } else if (event.type === 'final') {
        const finalData = event.data || event;
        const text = finalData.rationale || finalData.summary || '';
        if (text && typeof text === 'string') {
          setThoughts(prev => [...prev, { role: 'assistant', content: text, timestamp: Date.now(), type: 'final' }]);
        }
        const artifacts = finalData?.outputs?.artifacts;
        if (Array.isArray(artifacts) && artifacts.length) {
          const artifactLines = artifacts.map((art) => formatArtifactSummary(art)).join('\n');
          setThoughts(prev => [...prev, {
            role: 'assistant',
            content: `📁 **Artifacts Created**\n${artifactLines}`,
            timestamp: Date.now(),
            type: 'artifacts'
          }]);
          setArtifactSummary(artifactLines);
        }
        if ((clarifyStats && clarifyStats.requested) || (confirmStats && confirmStats.requested)) {
          const parts = [];
          if (clarifyStats && clarifyStats.requested) {
            parts.push(`Clarified ${clarifyStats.answered || 0}/${clarifyStats.requested} prompts`);
          }
          if (confirmStats && confirmStats.requested) {
            const approved = confirmStats.approved || 0;
            const total = confirmStats.requested;
            parts.push(`Confirmed ${approved}/${total} high-risk actions`);
          }
          if (parts.length) {
            setThoughts(prev => [...prev, { role: 'assistant', content: `📊 ${parts.join(' • ')}`, timestamp: Date.now(), type: 'metrics' }]);
          }
        }
      } else if (event.type === 'thinking') {
        const message = event.data?.message || event.message || 'Processing...';
        const step = event.data?.step || 0;
        const totalSteps = event.data?.total_steps || 0;
        
        // Update current step for progress tracking
        if (step > 0) {
          setCurrentStep(step);
          setTotalSteps(totalSteps);
        }
        
        setThinkingStatus(message);
        appendThought(message);
      } else if (event.type === 'step') {
        // Step completed - could show intermediate steps
        const stepData = event.data || event;
        console.log('[Chat] Step completed:', stepData);
        setThinkingStatus('Working...');
        // Render a succinct line for the step in the Thought bubble
        try {
          const n = stepData.step_number || stepData.step || currentStep + 1;
          const desc = stepData.description || stepData.action || stepData.reasoning || '';
          const line = `Step ${n}${desc ? `: ${desc}` : ''}`;
          appendThought(line);
        } catch {}
      } else if (event.type === 'done') {
        // Final response received - mark streaming message as complete
        planIdRef.current = null;
        const d = event.data || event || {};
        // Try common keys first
        const primaryKeys = ['final_response','final','response','text','content','message','result','answer','output'];
        let finalResponse = null;
        for (const k of primaryKeys) {
          const v = d?.[k];
          if (typeof v === 'string' && v.trim()) { finalResponse = v; break; }
        }
        // Model-runner style structures
        if (!finalResponse) {
          const nested = d?.choices?.[0]?.message?.content || d?.choices?.[0]?.delta?.content || d?.data?.text || d?.data?.content;
          if (typeof nested === 'string' && nested.trim()) finalResponse = nested;
        }
        // Generic fallback: scan object for first non-empty string
        if (!finalResponse && d && typeof d === 'object') {
          const stack = [d];
          const seen = new Set();
          while (stack.length && !finalResponse) {
            const cur = stack.pop();
            if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
            seen.add(cur);
            for (const [key, val] of Object.entries(cur)) {
              if (typeof val === 'string' && val.trim()) { finalResponse = val; break; }
              if (val && typeof val === 'object') stack.push(val);
            }
          }
        }
        const buffered = streamBufferRef.current || '';
        const responseText = (typeof finalResponse === 'string' && finalResponse.trim()) ? finalResponse : buffered;
        if (!responseText) {
          try { console.warn('[Chat] Done event had no response text. data keys:', Object.keys(d || {})); } catch {}
        }
        // Final catch-up: extract any trailing fs_command blocks in final buffer
        try {
          if (responseText && responseText.includes('```fs_command')) {
            await extractAndExecuteCommands(responseText);
          }
        } catch {}
        
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
        if (responseText && localStorage.getItem('user_id')) {
          addMessage('assistant', responseText)
            .catch(err => console.warn('[Chat] Failed to save message to memory:', err));
        }
        
        // Option A: Automatic memory extraction and apply (no user prompts)
        try {
          const userPrompt = (lastUserPromptRef.current || '').trim();
          const assistantText = (responseText || '').trim();
          const extractMessage = [
            userPrompt && `User: ${userPrompt}`,
            assistantText && `Assistant: ${assistantText}`,
          ].filter(Boolean).join('\n');
          if (extractMessage && extractMessage.trim().length > 0) {
            const proposals = await memoryAPI.extract({ message: extractMessage });
            if (Array.isArray(proposals) && proposals.length > 0) {
              if (memoryAutoApply && !memoryReviewEnabled) {
                const confirmed = proposals.map((p, i) => String(p.id || p.uuid || i));
                try {
                  await memoryAPI.apply({ proposals, confirmed });
                  window.dispatchEvent(new Event('memory-changed'));
                } catch (e) {
                  console.warn('[Memory] Auto-apply failed', e);
                }
              } else {
                try {
                  setMemoryProposals(proposals);
                  setShowMemoryToast(true);
                } catch {}
              }
            }
          }
        } catch (e) {
          console.warn('[Memory] Extraction failed', e);
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
                  
                  (async () => {
                    try {
                      const cfg = apiConfigManager.getConfig ? apiConfigManager.getConfig() : { baseURL: apiConfigManager.getBaseURL?.() };
                      const base = (cfg?.baseURL || '').replace(/\/$/, '');
                      const headers = {};
                      const key = (cfg && cfg.apiKey) || (apiConfigManager.getApiKey && apiConfigManager.getApiKey());
                      if (key) headers['X-API-Key'] = key;
                      try {
                        const uid = localStorage.getItem('user_id');
                        if (uid) headers['X-User-Id'] = uid;
                      } catch {}
                      const url = `${base}/api/v2/google/gmail/health`;
                      const healthResponse = await axios.get(url, { params: { email: userEmail }, headers });
                      toast.dismiss('gmail-health');
                      if (!healthResponse?.data?.healthy) {
                        logger.error('[Email] Gmail health check failed:', healthResponse?.data);
                        toast.error(`Gmail error: ${healthResponse?.data?.message}`);
                        return;
                      }
                      logger.info('[Email] Gmail healthy, sending email...', healthResponse.data);
                      googleAPI.sendEmail(
                        command.to,
                        command.subject,
                        command.body,
                        command.cc,
                        command.bcc,
                        command.attachments
                      ).then(() => {
                        toast.success('Email sent successfully!');
                      }).catch(error => {
                        logger.error('[Email] Failed to send', error);
                        toast.error(`Failed to send email: ${error.message}`);
                      });
                    } catch (healthError) {
                      toast.dismiss('gmail-health');
                      logger.error('[Email] Health check failed:', healthError);
                      toast.error('Failed to verify Gmail connection. Please check your connection in settings.');
                    }
                  })();
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
        
        // Deduct credits based on token usage (1 credit per 500 output tokens)
        const userId = localStorage.getItem('user_id');
        if (userId && totalOutputTokens > 0) {
          try {
            const creditsToDeduct = Math.ceil(totalOutputTokens / 500);
            logger.info(`[Credits] Output tokens: ${totalOutputTokens}, deducting ${creditsToDeduct} credit(s)`);
            
            const { data: userData, error: fetchErr } = await supabase
              .from('users')
              .select('metadata')
              .eq('id', userId)
              .maybeSingle();

            if (fetchErr) {
              logger.warn('[Credits] Could not fetch user metadata (skipping deduction)', fetchErr);
              throw fetchErr; // handled by catch below without blocking UX
            }

            const currentCredits = (userData?.metadata?.credits ?? 0);
            const newCredits = Math.max(0, currentCredits - creditsToDeduct);

            const baseMeta = (userData && userData.metadata && typeof userData.metadata === 'object')
              ? userData.metadata
              : {};

            await supabase
              .from('users')
              .update({
                metadata: {
                  ...baseMeta,
                  credits: newCredits
                }
              })
              .eq('id', userId);
            
            logger.info(`[Credits] Deducted ${creditsToDeduct}: ${currentCredits} → ${newCredits}`);
            
            // Log telemetry
            await supabase.from('telemetry_events').insert({
              user_id: userId,
              event_type: 'credit_usage',
              action: 'tokens_consumed',
              metadata: {
                output_tokens: totalOutputTokens,
                credits_deducted: creditsToDeduct,
                credits_remaining: newCredits
              }
            });
            
            // Show toast notification
            if (creditsToDeduct > 0) {
              toast.success(`${creditsToDeduct} credit${creditsToDeduct > 1 ? 's' : ''} used (${totalOutputTokens} tokens)`, {
                icon: '💰',
                duration: 2000
              });
            }
          } catch (error) {
            logger.error('[Credits] Failed to deduct credits:', error);
            // Don't block user experience on credit deduction errors
            // Log the specific error for debugging
            if (error.code === 'PGRST116') {
              logger.error('[Credits] User record not found in database');
              toast.error('User account not found. Please sign in again.');
            } else if (error.message?.includes('metadata')) {
              logger.error('[Credits] Invalid metadata structure');
              toast.error('Credit data corrupted. Please contact support.');
            } else if (error.code === '500' || error.status === 500) {
              logger.error('[Credits] Database server error:', error.message);
              toast.error('Server error updating credits. Your usage was tracked.');
            } else {
              toast.error('Failed to update credits. Please check your account.');
            }
          }
        }
        
        // Final check for any fs_command blocks that might have been missed
        if (accumulatedResponseRef.current.includes('```fs_command')) {
          extractAndExecuteCommands(accumulatedResponseRef.current);
        }
        
        // Clear enrichment scope at end of stream
        enrichTileIdRef.current = null;
        // Clear any accumulated plain text tokens
        streamBufferRef.current = '';
        setIsThinking(false);
        setThinkingStatus('');
        // Collapse the Thought bubble after completion
        collapseCurrentThought();
      } else if (event.type === 'error') {
        const errorMsg = event.data?.error || event.error || 'Failed to get response';
        const isTerminal = event.data?.terminal || false;
        const errorCode = event.data?.code || 'UNKNOWN';
        
        // v2.1: terminal errors stop execution permanently
        if (isTerminal) {
          console.log('[Chat] Terminal error received, stopping execution:', errorCode);
          toast.error(`❌ ${errorMsg}`, {
            duration: 7000,
            style: {
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              backdropFilter: 'blur(10px)'
            }
          });
          // Add terminal error to thoughts
          setThoughts(prev => [...prev, {
            role: 'system',
            content: `⛔ Terminal Error (${errorCode}): ${errorMsg}`,
            timestamp: Date.now(),
            type: 'error',
            terminal: true
          }]);
        } else {
          // Non-terminal errors: mark offline and show toast
          setApiConnected(false);
          offlineRef.current = true;
          if (apiConnected) {
            toast.error(errorMsg);
          }
        }
        
        // Reset buffers on any error
        enrichTileIdRef.current = null;
        streamBufferRef.current = '';
        setIsThinking(false);
        setThinkingStatus('');
        // Collapse the Thought bubble if it exists
        collapseCurrentThought();
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

  // Helper to run the full send flow (screenshots, streaming, memory)
  const continueSend = useCallback(async (text) => {
    // Get user ID for credit check (check balance only, don't deduct yet)
    const userId = localStorage.getItem('user_id');
    if (!userId) {
      toast.error('Please wait for user initialization');
      return;
    }
    // Check if user has any credits (warning only)
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
      // Log that message was sent (credit deduction happens after response)
      await supabase.from('telemetry_events').insert({
        user_id: userId,
        event_type: 'message_sent',
        action: 'message_initiated',
        metadata: {
          credits_before: currentCredits,
          message_cached: false
        }
      });
    } catch (error) {
      logger.error('Credit check failed', error);
      toast.error('Failed to check credits. Please try again.');
      return;
    }
    // Add user message
    setThoughts(prev => [...prev, { role: 'user', content: text, timestamp: Date.now() }]);
    setMessage('');
    setIsThinking(true);
    setThinkingStatus('Thinking...');
    // Remember last user prompt for extraction
    try { lastUserPromptRef.current = text; } catch {}
    if (localStorage.getItem('user_id')) {
      addMessage('user', text)
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
      google_user_email: localStorage.getItem('google_user_email') || null,
      __mode: (typeof resolveMode === 'function' ? resolveMode() : (localStorage.getItem('permission_level') || 'helpful'))
    };
    // NEW: include current mode so backend can enable tools appropriately
    try { userContext.__mode = resolveMode(); } catch {}
    if (localStorage.getItem('user_id')) {
      try {
        const [profile, facts, preferences] = await Promise.all([
          getProfile().catch(() => null),
          getFacts().catch(() => null),
          getPreferences().catch(() => null)
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
          console.warn('[Chat] Embedding semantic search failed:', e);
        }
      } catch (e) {
        console.warn('[Chat] Semantic retrieval failed:', e);
      }
    }
    // Streaming call
    sendChat(text, userContext, screenshotData);
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
    // Continue with message sending (use ref to avoid TDZ)
    if (continueSendMessageRef.current) {
      continueSendMessageRef.current(text, screenshotData);
    } else {
      console.warn('continueSendMessage not ready');
    }
    setPendingMessageForScreenshot(null);
  }, [pendingMessageForScreenshot]);

  // Continue sending message after screenshot decision
  const continueSendMessage = useCallback(async (text, screenshotData, memoryPack = null) => {
    // Add user message to chat immediately
    setThoughts(prev => [...prev, { role: 'user', content: text, timestamp: Date.now() }]);
    setMessage('');
    setIsThinking(true);
    setThinkingStatus('Thinking...');
    // Reset autonomous progress state
    try { setExecutionPlan(null); setPlanCardDismissed(!shouldDisplayPlanCard()); setCurrentStep(0); setTotalSteps(0); } catch {}
    // Remember the last user prompt for memory extraction
    lastUserPromptRef.current = text;
    
    // Save user message to memory
    if (localStorage.getItem('user_id')) {
      addMessage('user', text)
        .catch(err => console.warn('[Chat] Failed to save user message to memory:', err));
    }
    
    // Build user context
    let userContext = {
      recent_messages: thoughts.map(t => ({ role: t.role, content: t.content })),
      profile: null,
      facts: null,
      preferences: null,
      google_user_email: localStorage.getItem('google_user_email') || null  // Add Google connection status
    };
    if (localStorage.getItem('user_id')) {
      try {
        const [profile, facts, preferences] = await Promise.all([
          getProfile().catch(() => null),
          getFacts().catch(() => null),
          getPreferences().catch(() => null)
        ]);
        userContext.profile = profile;
        userContext.facts = facts;
        userContext.preferences = preferences;

        // Semantic retrieval: build a minimal, relevant context for the current goal
        try {
          let recentMsgs = [];
          const sessionId = localStorage.getItem('session_id');
          if (sessionId) {
            recentMsgs = await getRecentMessages(20, sessionId).catch(() => []);
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
          if (memoryDebugEnabled) {
            try {
              logger.info('[Semantic][Selector] meta', selection.meta || {});
              logger.info('[Semantic][Selector] slices', (selection.slices || []).map(s => ({ id: s.id, kind: s.kind, score: s.score, tokens: s.tokens, text: (s.text||'').slice(0,80) })));
            } catch {}
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
            if (memoryDebugEnabled) {
              logger.info('[Semantic][Local] queryTerms', queryTerms);
            }

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
                    if (memoryDebugEnabled) {
                      logger.info('[Semantic][Facts] appended', factsBlock);
                    }
                  }
                }

                // 2) Search conversation history using hybrid search (semantic + keyword)
                // Check if hybrid search is enabled (default: true for better results)
                const useHybridSearch = localStorage.getItem('use_hybrid_search') !== '0';
                
                if (useHybridSearch) {
                  try {
                    const userId = localStorage.getItem('user_id');
                    if (userId) {
                      console.log('[Semantic] Using hybrid search (embeddings + keywords)...');
                      const startTime = Date.now();
                      
                      // Use hybrid search for semantic + keyword matching
                      const searchResults = await hybridSearchContext(text, userId, {
                        includeMessages: true,
                        includeFacts: true,
                        messageLimit: limit,
                        factLimit: Math.floor(limit / 2)
                      });
                      
                      const searchDuration = Date.now() - startTime;
                      console.log(`[Semantic] Hybrid search completed in ${searchDuration}ms:`, {
                        messages: searchResults.messages.length,
                        facts: searchResults.facts.length,
                        source: searchResults.stats?.source || 'unknown'
                      });
                      
                      // Convert hybrid search results to items format
                      const messageItems = searchResults.messages.map(m => ({
                        text: m.content?.slice(0, 200) || '',
                        score: m.score || 0,
                        timestamp: m.created_at,
                        session: m.session_id,
                        source: m.source || 'hybrid'
                      }));
                      
                      const factItems = searchResults.facts.map(f => ({
                        text: `${f.key}: ${f.value}`,
                        score: f.score || 0,
                        category: f.category,
                        source: 'fact-hybrid'
                      }));
                      
                      // Merge and sort all items
                      items = [...items, ...messageItems, ...factItems]
                        .filter(Boolean)
                        .sort((a, b) => (b.score || 0) - (a.score || 0))
                        .slice(0, limit);
                      
                      if (memoryDebugEnabled) {
                        logger.info('[Semantic][Hybrid] results', {
                          total: items.length,
                          duration: searchDuration,
                          sources: items.reduce((acc, it) => {
                            acc[it.source] = (acc[it.source] || 0) + 1;
                            return acc;
                          }, {})
                        });
                      }
                    } else {
                      console.warn('[Semantic] User ID not found, falling back to keyword search');
                    }
                  } catch (hybridErr) {
                    console.warn('[Semantic] Hybrid search failed, falling back to keyword:', hybridErr);
                  }
                }
                
                // Fallback to keyword-based search if hybrid disabled or failed
                if (!useHybridSearch || items.length === 0) {
                  const sessions = await getAllSessions();
                  console.log(`[Semantic] Using keyword search on ${sessions.length} local sessions`);
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
                            session: session.sessionId,
                            source: 'keyword-fallback'
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
                }

                console.log('[Semantic] Found', items.length, 'similar items from memory');
                if (memoryDebugEnabled && items.length) {
                  logger.info('[Semantic][Local] top', items.slice(0,5));
                }
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
              const hasHybridResults = items.some(it => it.source && it.source.includes('hybrid'));
              
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
                    // Add source badge for debugging if enabled
                    const sourceBadge = (memoryDebugEnabled && it.source) ? ` [${it.source}]` : '';
                    return `- ${text}${score}${sourceBadge}`;
                  })
                  .filter(Boolean)
                  .join('\n');
              }
              
              // Add header with search method attribution
              const searchMethod = hasHybridResults ? 'Semantic + Keyword' : 'Keyword';
              const header = `**Similar Memories** _(${searchMethod} search)_`;
              const block = lines ? `\n\n${header}\n${lines}` : '';
              
              userContext.semantic_context = (userContext.semantic_context || '') + block;
              userContext.semantic_sources = items.map((it) => ({ 
                id: it.id || it.uuid || null, 
                score: it.score || null,
                source: it.source || 'unknown'
              }));
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
    
    // If a Better Memory context pack is available (passed directly or from state), attach it to userContext
    const packToUse = memoryPack || contextPack;
    try {
      if (packToUse) {
        userContext.memory_pack = {
          facts: (packToUse.facts || []).map(f => ({
            category: f.category,
            key: f.key,
            value: f.value,
            confidence: f.confidence,
            pinned: !!f.pinned,
          })),
          semantic_hits: (packToUse.semantic_hits || []).map(h => ({
            snippet: h.snippet,
            score: h.score,
          })),
          recent_messages: (packToUse.recent_messages || []).map(m => ({ role: m.role, content: m.content })),
          budget: packToUse.budget,
          rationale: packToUse.rationale,
        };
        console.log('[Memory] Attached context pack:', {
          facts: userContext.memory_pack.facts.length,
          semantic_hits: userContext.memory_pack.semantic_hits.length,
          recent_messages: userContext.memory_pack.recent_messages.length,
        });

        // Merge memory_pack into top-level context so backend can use it
        try {
          // 1) Merge facts into dict-of-dicts expected by normalize_context()
          userContext.facts = userContext.facts || {};
          for (const f of userContext.memory_pack.facts) {
            const cat = f.category || 'general';
            if (!userContext.facts[cat]) userContext.facts[cat] = {};
            // Store as object with value so backend flattener can unwrap
            userContext.facts[cat][f.key] = { value: f.value, confidence: f.confidence, pinned: !!f.pinned };
          }

          // 2) Merge recent messages (cap at 10, dedup by role+content)
          const packMsgs = userContext.memory_pack.recent_messages || [];
          if (Array.isArray(packMsgs) && packMsgs.length) {
            const existing = Array.isArray(userContext.recent_messages) ? userContext.recent_messages : [];
            const merged = [...existing, ...packMsgs].filter(Boolean);
            const seen = new Set();
            userContext.recent_messages = merged.filter((m) => {
              const key = `${m.role}:${(m.content || '').slice(0, 120)}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            }).slice(-10);
          }

          // 3) Promote top semantic hit snippets as memory facts (helps progressive lane)
          const topHits = (userContext.memory_pack.semantic_hits || []).slice(0, 2);
          if (topHits.length) {
            if (!userContext.facts.memory) userContext.facts.memory = {};
            topHits.forEach((hit, idx) => {
              const k = `semantic_hit_${idx + 1}`;
              if (!userContext.facts.memory[k]) {
                userContext.facts.memory[k] = { value: hit.snippet, score: hit.score };
              }
            });

            // Heuristic: if education.school is missing, try to infer from hit snippet
            const hasSchool = !!(userContext.facts?.education?.school);
            if (!hasSchool) {
              try {
                const text = (topHits[0]?.snippet || '') + ' ' + (topHits[1]?.snippet || '');
                const patterns = [
                  /\bI\s+(?:went to|go to|attend|study at|studied at|am at)\s+([A-Za-z0-9 .,&'\-]+?)(?:\s+for\s+college|\s+college|\s+university|[\.,!]|$)/i,
                  /\bmy\s+school\s+is\s+([A-Za-z0-9 .,&'\-]+?)(?:[\.,!]|$)/i,
                ];
                let school = null;
                for (const p of patterns) {
                  const m = text.match(p);
                  if (m && m[1]) { school = m[1].trim(); break; }
                }
                if (school) {
                  if (!userContext.facts.education) userContext.facts.education = {};
                  if (!userContext.facts.education.school) {
                    userContext.facts.education.school = { value: school, inferred: true };
                    if (memoryDebugEnabled) {
                      logger.info('[Semantic][Heuristic] inferred education.school', school);
                    }
                  }
                }
              } catch (_) {}
            }
          }
        } catch (mergeErr) {
          console.warn('[Memory] Failed to merge memory_pack into userContext', mergeErr);
        }
        setActionPlanMetadata(null);
        setClarifyStats(null);
        setConfirmStats(null);
      }
    } catch (e) {
      console.warn('[Memory] Failed to attach memory_pack', e);
    } finally {
      if (packToUse) {
        setShowContextPreview(false);
        setContextPack(null);
      }
    }

    // Execute the streaming call (reuse the existing sendChat logic)
    sendChat(text, userContext, screenshotData);
  }, [thoughts, contextPack]);

  // Keep dispatcher ref in sync
  useEffect(() => {
    continueSendMessageRef.current = continueSendMessage;
  }, [continueSendMessage]);

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
  
  // (moved above)
  
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
        // Auto-approve PII-only self queries if enabled
        try {
          const markersSet = new Set(data.markers || []);
          const piiMarkers = new Set(['pii','high_risk_context','location','address','geo','coordinates','name','email','phone','dob','ssn','profile','contact']);
          const actionMarkers = new Set(['email','communication','network','http','web','browser','filesystem','file','process','shell','exec','payment','purchase','sms','call','external','upload','download']);
          const hasAction = [...markersSet].some(m => actionMarkers.has(m));
          const isPIIOnly = [...markersSet].length > 0 && [...markersSet].every(m => piiMarkers.has(m));
          if (safetyDisablePII && isPIIOnly && !hasAction) {
            try {
              await permissionAPI.logActivity({
                action: text,
                required_approval: false,
                approved: true,
                markers: [...markersSet, 'auto_approved_pii_only'],
                is_high_risk: false
              });
            } catch {}
            await continueAfterPreview(text);
            return;
          }
        } catch {}
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
  }, [message, isThinking, apiConnected, continueSend, safetyDisablePII]);
  
  // Handle clear conversation
  const handleClear = useCallback(() => {
    setThoughts([]);
    setFactTiles([]);
    enrichTileIdRef.current = null;
    clearMessages();
    
    // Start new session in memory manager
    if (localStorage.getItem('user_id')) {
      startSession()
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
      try {
        // Persist selection so API client can fall back if userContext not present
        localStorage.setItem('permission_level', level);
      } catch {}
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

  // Recalculate height when execution panel toggles or updates
  useEffect(() => {
    updateWindowHeight();
  }, [execPanelOpen, executionDetails, updateWindowHeight]);

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
  
  // Poll desktop helper status so we can display availability and warn when required
  useEffect(() => {
    let cancelled = false;
    let timer;
    const pollStatus = async () => {
      try {
        if (typeof window === 'undefined' || !window?.electron?.handsOnDesktop?.status) {
          if (!cancelled) {
            setDesktopBridgeStatus((prev) => prev || { connected: false, enabled: false });
          }
        } else {
          const status = await window.electron.handsOnDesktop.status();
          if (!cancelled) {
            setDesktopBridgeStatus(status || { connected: false, enabled: false });
          }
        }
      } catch (err) {
        if (!cancelled) {
          setDesktopBridgeStatus({ connected: false, enabled: false, error: err?.message });
        }
      } finally {
        if (!cancelled) {
          timer = setTimeout(pollStatus, 6000);
        }
      }
    };
    pollStatus();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);
  
  const desktopBridgeConnected = Boolean(desktopBridgeStatus?.connected);
  useEffect(() => {
    if (!desktopActionsRequired) {
      offlineDesktopToastRef.current = false;
      return;
    }
    if (!desktopBridgeConnected && !offlineDesktopToastRef.current) {
      offlineDesktopToastRef.current = true;
      const message = 'Desktop helper is offline. Reopen the Agent Max desktop app so local steps can finish.';
      setThoughts((prev) => [
        ...prev,
        {
          role: 'system',
          content: `⚠️ ${message}`,
          timestamp: Date.now(),
          type: 'status',
        }
      ]);
      toast.error(message);
    } else if (desktopBridgeConnected) {
      offlineDesktopToastRef.current = false;
    }
  }, [desktopActionsRequired, desktopBridgeConnected, setThoughts]);
  
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
        <img
          src={LogoPng}
          alt="Agent Max"
          className="amx-mini-logo"
          draggable={false}
          style={{ WebkitAppRegion: 'no-drag' }}
        />
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
          <div
            className="apple-bar-logo"
            style={{ backgroundImage: `url(${LogoPng})` }}
          />
          <div className="apple-drag-strip" />
          <div className="apple-toolbar" ref={toolbarRef} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ flexGrow: 1 }} />
            {/* Mode Badge */}
            <div
              title={`Mode: ${resolveMode()}`}
              style={{
                fontSize: '0.78rem',
                color: 'rgba(255,255,255,0.8)',
                background: resolveMode()==='autonomous' ? 'rgba(255,165,0,0.18)' : resolveMode()==='chatty' ? 'rgba(147,197,253,0.18)' : 'rgba(34,197,94,0.18)',
                border: '1px solid rgba(255,255,255,0.14)',
                padding: '4px 8px',
                borderRadius: 8,
                textTransform: 'capitalize'
              }}
            >
              {resolveMode()==='autonomous' ? 'auto' : resolveMode()==='chatty' ? 'chatty' : 'helpful'}
            </div>
            <div
              onClick={!desktopBridgeConnected ? handleDesktopReconnect : undefined}
              title={desktopBridgeConnected ? 'Desktop helper connected' : 'Desktop helper offline. Click to retry connection.'}
              style={{
                fontSize: '0.74rem',
                color: desktopBridgeConnected ? 'rgba(34,197,94,0.95)' : 'rgba(248,113,113,0.95)',
                background: desktopBridgeConnected ? 'rgba(34,197,94,0.12)' : 'rgba(248,113,113,0.12)',
                border: `1px solid ${desktopBridgeConnected ? 'rgba(34,197,94,0.25)' : 'rgba(248,113,113,0.25)'}`,
                padding: '4px 8px',
                borderRadius: 8,
                textTransform: 'capitalize',
                cursor: desktopBridgeConnected ? 'default' : 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Desktop {desktopBridgeConnected ? 'online' : 'offline'}
            </div>
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

          {/* Onboarding overlay: only after expansion and when requested */}
          {showWelcome === true && !isTransitioning && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 80 }}>
              <OnboardingFlow onComplete={onWelcomeComplete} />
            </div>
          )}

          {/* Execution Details Panel */}
          {executionDetails && (
            <div style={{ marginTop: 8, marginBottom: 8, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'linear-gradient(180deg, rgba(20,22,26,0.9), rgba(16,18,22,0.9))', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>Execution Details</span>
                <span style={{ marginLeft: 8, fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>{new Date(executionDetails.when || Date.now()).toLocaleTimeString()}</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => setExecPanelOpen(v => !v)}
                    style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.85)', padding: '4px 8px', borderRadius: 8, cursor: 'pointer', fontSize: '0.78rem' }}
                  >
                    {execPanelOpen ? 'Hide' : 'Show'}
                  </button>
                  <button
                    onClick={() => setExecutionDetails(null)}
                    style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.85)', padding: '4px 8px', borderRadius: 8, cursor: 'pointer', fontSize: '0.78rem' }}
                  >
                    Clear
                  </button>
                </div>
              </div>
              {execPanelOpen && (
                <div style={{ padding: '8px 10px', display: 'grid', rowGap: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', columnGap: 8, alignItems: 'center' }}>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>Action</div>
                    <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.86rem' }}>{executionDetails.actionType || ''}</div>
                  </div>
                  {executionDetails.command && (
                    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr auto', columnGap: 8, alignItems: 'center' }}>
                      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>Command</div>
                      <code style={{ color: 'rgba(255,255,255,0.95)', fontSize: '0.82rem', whiteSpace: 'pre-wrap' }}>{executionDetails.command}</code>
                      <button onClick={() => copyToClipboard(executionDetails.command, 'Command copied')} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.85)', padding: '4px 8px', borderRadius: 8, cursor: 'pointer', fontSize: '0.78rem' }}>Copy</button>
                    </div>
                  )}
                  {typeof executionDetails.exit_code === 'number' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', columnGap: 8, alignItems: 'center' }}>
                      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>Exit code</div>
                      <div style={{ color: executionDetails.exit_code === 0 ? '#34d399' : '#f87171', fontWeight: 600 }}>{executionDetails.exit_code}</div>
                    </div>
                  )}
                  {executionDetails.stdout && (
                    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr auto', columnGap: 8 }}>
                      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>Stdout</div>
                      <pre style={{ margin: 0, maxHeight: 120, overflow: 'auto', padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.92)', whiteSpace: 'pre-wrap' }}>{executionDetails.stdout}</pre>
                      <button onClick={() => copyToClipboard(executionDetails.stdout, 'Stdout copied')} style={{ alignSelf: 'start', background: 'transparent', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.85)', padding: '4px 8px', borderRadius: 8, cursor: 'pointer', fontSize: '0.78rem' }}>Copy</button>
                    </div>
                  )}
                  {executionDetails.stderr && (
                    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr auto', columnGap: 8 }}>
                      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>Stderr</div>
                      <pre style={{ margin: 0, maxHeight: 120, overflow: 'auto', padding: 8, borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(255,235,235,0.92)', whiteSpace: 'pre-wrap' }}>{executionDetails.stderr}</pre>
                      <button onClick={() => copyToClipboard(executionDetails.stderr, 'Stderr copied')} style={{ alignSelf: 'start', background: 'transparent', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.85)', padding: '4px 8px', borderRadius: 8, cursor: 'pointer', fontSize: '0.78rem' }}>Copy</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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
                      background: ((permissionLevel === opt.value) || (opt.value === 'powerful' && permissionLevel === 'autonomous')) ? 'rgba(255,255,255,0.08)' : 'transparent',
                      color: 'rgba(255,255,255,0.55)',
                      cursor: 'pointer',
                      borderRight: idx < 2 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                      boxShadow: ((permissionLevel === opt.value) || (opt.value === 'powerful' && permissionLevel === 'autonomous')) ? 'inset 0 -2px 8px rgba(255,255,255,0.15)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!((permissionLevel === opt.value) || (opt.value === 'powerful' && permissionLevel === 'autonomous'))) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                        e.currentTarget.style.color = 'rgba(255,255,255,0.75)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = ((permissionLevel === opt.value) || (opt.value === 'powerful' && permissionLevel === 'autonomous')) ? 'rgba(255,255,255,0.08)' : 'transparent';
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
          {memoryPreviewEnabled && showContextPreview && contextPack && (
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
          
          {/* Autonomous Execution Progress */}
          {(executionPlan || currentStep > 0) && (
            <div className="amx-progress-card">
              <div className="amx-progress-head">
                <span className="label">{currentStep > 0 ? `Step ${currentStep}/${totalSteps}` : 'Planning...'}</span>
                <span className="percent">{totalSteps > 0 ? `${Math.round((currentStep / totalSteps) * 100)}%` : '0%'}</span>
              </div>
              <div className="amx-progress-bar">
                <div className="amx-progress-fill" style={{ width: totalSteps > 0 ? `${(currentStep / totalSteps) * 100}%` : '0%' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center', fontSize: 12 }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  color: heartbeatStatus.stale ? '#f87171' : '#10b981'
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: 9999,
                    background: heartbeatStatus.stale ? '#f87171' : '#10b981',
                    display: 'inline-block'
                  }} />
                  {heartbeatStatus.stale ? 'Desktop heartbeat stale' : 'Desktop live'}
                </span>
                {heartbeatStatus.last && (
                  <span style={{ color: '#94a3b8' }}>
                    {`Last beat: ${new Date(heartbeatStatus.last).toLocaleTimeString()}`}
                  </span>
                )}
              </div>
              {runExecLogs.length > 0 && (
                <div style={{ marginTop: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 12, color: '#cbd5e1', marginBottom: 4 }}>Recent activity</div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 120, overflow: 'auto', fontSize: 12, color: '#e2e8f0' }}>
                    {runExecLogs.map((log, idx) => (
                      <li key={log.ts + idx} style={{ marginBottom: 4 }}>
                        <span style={{ color: '#94a3b8' }}>{log.step ? `Step ${log.step}: ` : ''}</span>
                        {log.message || log.stdout || log.error || ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {artifactSummary && (
                <div style={{ marginTop: 8, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '8px 10px', color: '#dbeafe', fontSize: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Artifacts</div>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{artifactSummary}</pre>
                </div>
              )}
            </div>
          )}
          
          {(executionPlan || planIdRef.current) && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button className="amx-button ghost" onClick={handlePauseRun} style={{ padding: '6px 10px' }}>Pause</button>
              <button className="amx-button ghost" onClick={handleResumeRun} style={{ padding: '6px 10px' }}>Resume</button>
              <button className="amx-button danger" onClick={handleCancelRun} style={{ padding: '6px 10px' }}>Cancel</button>
            </div>
          )}
          
          {planCardAllowed && planCardData && !planCardDismissed && (
            <div style={{ marginBottom: 12 }}>
              <PlanCard 
                plan={planCardData}
                onApprove={handlePlanApprove}
                onReject={handlePlanReject}
              />
            </div>
          )}
          
          {desktopActionsRequired && !desktopBridgeConnected && (
            <div
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(248,113,113,0.3)',
                background: 'rgba(248,113,113,0.08)',
                color: '#fecaca',
                marginBottom: 12,
              }}
            >
              <Lightbulb size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: '0.85rem', lineHeight: 1.4 }}>
                <strong style={{ display: 'block', marginBottom: 2 }}>Desktop helper is offline</strong>
                File steps will stall until the helper reconnects. Reopen the Agent Max desktop app and grant Desktop permissions so Auto Mode can write locally.
              </div>
            </div>
          )}
          
          {/* Messages */}
          <div className="apple-messages" ref={messagesRef}>
            {executionMode === 'chat' && (
              <div className="chat-mode-indicator">
                <span role="img" aria-label="chat">💬</span>
                <span>Answering directly — no desktop actions required</span>
              </div>
            )}
            {thoughts.map((thought, idx) => {
              if (thought.type === 'thought') {
                const isExpanded = thought.expanded !== false;
                return (
                  <div key={thought.id || idx} className="apple-message apple-message-thought">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <Lightbulb size={14} />
                      <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Thought</span>
                      <button
                        onClick={() => {
                          setThoughts(prev => {
                            const copy = [...prev];
                            const i = copy.findIndex(m => m?.id === thought.id);
                            if (i === -1) return prev;
                            copy[i] = { ...copy[i], expanded: !isExpanded };
                            return copy;
                          });
                        }}
                        style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.75)', cursor: 'pointer' }}
                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    </div>
                    {isExpanded ? (
                      <div className="apple-message-content">
                        <div style={{ whiteSpace: 'pre-wrap' }}>{thought.message || ''}</div>
                      </div>
                    ) : (
                      <div onClick={() => {
                        setThoughts(prev => {
                          const copy = [...prev];
                          const i = copy.findIndex(m => m?.id === thought.id);
                          if (i === -1) return prev;
                          copy[i] = { ...copy[i], expanded: true };
                          return copy;
                        });
                      }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.06)', fontSize: 12, cursor: 'pointer' }}>
                        <span>💭</span>
                        <span>{thought.wordCount || (String(thought.message || '').trim().split(/\s+/).filter(Boolean).length) || 0} words</span>
                        <ChevronRight size={12} />
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <div key={idx} className={`apple-message apple-message-${thought.role}`}>
                  <div className={`apple-message-content ${thought.type === 'plan' ? 'plan-message' : ''}`}>
                    {thought.role === 'assistant' || thought.role === 'system' ? (
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
              );
            })}
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
      
      {/* Offline/Reconnecting pill (hidden during onboarding) */}
      {!apiConnected && !showWelcome && (
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
