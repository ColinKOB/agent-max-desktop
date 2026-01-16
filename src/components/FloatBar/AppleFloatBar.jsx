/**
 * Apple-style FloatBar Component
 * Clean, expanding bar-only UI with glassmorphism
 * Replaces card mode entirely with a dynamic expanding bar
 */

import React, { useState, useCallback, useEffect, useRef, useMemo, useReducer } from 'react';
import ReactDOM from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Settings,
  Wrench,
  ArrowUp,
  Loader2,
  Minimize2,
  Check,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  Pause,
  Play,
  X,
  Wifi,
  WifiOff,
  Edit3,
  Book,
  Plus,
  Paperclip,
  Image,
  FileText,
  Square,
  Mail,
  Monitor,
  Globe,
  Table2,
  StickyNote,
} from 'lucide-react';
import useStore from '../../store/useStore';
import {
  chatAPI,
  permissionAPI,
  googleAPI,
  ambiguityAPI,
  semanticAPI,
  factsAPI,
  addConnectionListener,
  healthAPI,
  runAPI,
} from '../../services/api';
import { PullAutonomousService } from '../../services/pullAutonomous';
import toast from 'react-hot-toast';
import axios from 'axios';
import { CreditDisplay } from '../CreditDisplay';
import { supabase, checkResponseCache, storeResponseCache } from '../../services/supabase';
import { createLogger } from '../../services/logger';
import apiConfigManager from '../../config/apiConfig';
import LogoPng from '../../assets/AgentMaxLogo.png';
import {
  getProfile,
  getFacts,
  getPreferences,
  setPreference,
  startSession,
  addMessage,
  getRecentMessages,
  getAllSessions,
} from '../../services/supabaseMemory';
import { searchContext as hybridSearchContext } from '../../services/hybridSearch';
import memoryService from '../../services/memory';
import contextSelector from '../../services/contextSelector';
import { FactTileList } from '../FactTileList.jsx';
import PlanCard from '../PlanCard';
import { usePermission } from '../../contexts/PermissionContext';
import ApprovalDialog from '../ApprovalDialog';
import IntentConfirmationModal from '../IntentConfirmationModal';
import { ParallelAgentsPanel } from '../ParallelAgentsPanel';
import './AppleFloatBar.css';
import './FloatBar.css';

// Better Memory integration
import memoryAPI from '../../services/memoryAPI';
import ContextPreview from './ContextPreview';
import MemoryToast from '../MemoryToast';
import { qualifiesAsDeepDive, createDeepDive } from '../../services/deepDiveService';
import { OnboardingFlow } from '../onboarding/OnboardingFlow';
import {
  trackMessageSent,
  trackMessageReceived,
  trackChatError,
  trackExecutionStarted,
  trackExecutionCompleted,
  trackExecutionFailed
} from '../../services/analytics';
import ExecutionProgress from '../ExecutionProgress/ExecutionProgress';
import LiveActivityFeed from '../LiveActivityFeed/LiveActivityFeed';
import TypewriterMessage from '../TypewriterMessage/TypewriterMessage';
import ActivityFeed from '../ActivityFeed/ActivityFeed';
import EmailRenderer from './EmailRenderer';
import ComposerBar from './ComposerBar';
import { processImageFile } from '../../utils/imageCompression';

const logger = createLogger('FloatBar');

// Pre-warm connections when user clicks pill (before typing)
const warmConnections = async () => {
  const startTime = Date.now();
  logger.info('[PreWarm] Starting connection warm-up');

  try {
    // Warm the API connection with a lightweight health check
    const healthPromise = fetch(
      `${import.meta.env.VITE_API_URL || 'https://agentmax-production.up.railway.app'}/health`,
      {
        method: 'GET',
        cache: 'no-store',
      }
    ).catch(() => null);

    // Pre-warm executor IPC if available
    const executorPromise = window.executor?.getSystemContext?.().catch(() => null);

    await Promise.all([healthPromise, executorPromise]);

    logger.info(`[PreWarm] Warm-up complete in ${Date.now() - startTime}ms`);
  } catch (e) {
    logger.debug('[PreWarm] Warm-up failed (non-critical)', e);
  }
};

const MIN_EXPANDED_HEIGHT = 180;
const MAX_EXPANDED_HEIGHT = 600;
const LINE_GROWTH = 18; // grow window roughly one line per new chunk
const HEIGHT_DEBOUNCE_MS = 50; // debounce for height updates (reduced to minimize layout shift)
const HEIGHT_SHRINK_DELAY_MS = 400; // extra delay before shrinking (prevents jumping)
const HEIGHT_CHANGE_THRESHOLD = 20; // minimum px change to trigger resize

/**
 * Pre-flight check for Google service queries.
 * Detects if the user is asking about Gmail, Calendar, etc. and checks if Google is connected.
 * Returns { needsGoogle: boolean, isConnected: boolean, service: string }
 */
const checkGoogleServiceQuery = (message) => {
  if (!message || typeof message !== 'string') {
    return { needsGoogle: false, isConnected: false, service: null };
  }

  const lowerMessage = message.toLowerCase();

  // Gmail-related keywords
  const gmailKeywords = [
    'email',
    'emails',
    'inbox',
    'gmail',
    'mail',
    'message from',
    'send email',
    'read email',
    'check email',
    'my emails',
    'latest email',
    'recent email',
    'unread',
  ];

  // Calendar-related keywords
  const calendarKeywords = [
    'calendar',
    'event',
    'events',
    'meeting',
    'meetings',
    'schedule',
    'appointment',
    'appointments',
    "what's on my calendar",
    'my schedule',
  ];

  // Check for Gmail
  const needsGmail = gmailKeywords.some((kw) => lowerMessage.includes(kw));

  // Check for Calendar
  const needsCalendar = calendarKeywords.some((kw) => lowerMessage.includes(kw));

  if (!needsGmail && !needsCalendar) {
    return { needsGoogle: false, isConnected: false, service: null };
  }

  // Check if Google is connected
  const googleEmail = localStorage.getItem('google_user_email');
  const isConnected = !!googleEmail && googleEmail.length > 0;

  return {
    needsGoogle: true,
    isConnected,
    service: needsGmail ? 'Gmail' : 'Calendar',
    googleEmail: isConnected ? googleEmail : null,
  };
};

const truncateText = (value, limit = 160) => {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit)}…`;
};

// Validate permission level - only two modes supported
const validateModeValue = (level) => {
  const key = (level || '').toLowerCase();
  if (key === 'autonomous') return 'autonomous';
  if (key === 'chatty') return 'chatty';
  console.error(`[Mode] Invalid mode '${level}' - must be 'chatty' or 'autonomous'`);
  return 'chatty';
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

// EmailRenderer is now imported from ./EmailRenderer.jsx (wrapped in React.memo)

// ═══════════════════════════════════════════════════════════════════════════════
// Execution State Reducer - consolidates 14 related useState hooks for atomic updates
// ═══════════════════════════════════════════════════════════════════════════════
const initialExecutionState = {
  plan: null,
  actionPlanMetadata: null,
  clarifyStats: null,
  confirmStats: null,
  currentStep: 0,
  totalSteps: 0,
  mode: null,
  desktopActionsRequired: false,
  desktopBridgeStatus: null,
  stepStatuses: {},
  summary: null,
  startTime: null,
  runStatus: null,
  activeRunId: null,
};

function executionReducer(state, action) {
  switch (action.type) {
    case 'RESET':
      // Full reset for new conversation
      return initialExecutionState;

    case 'PARTIAL_RESET':
      // Reset for new message (preserves some state)
      return {
        ...state,
        plan: null,
        actionPlanMetadata: null,
        clarifyStats: null,
        confirmStats: null,
        currentStep: 0,
        totalSteps: 0,
        mode: null,
        desktopActionsRequired: action.desktopActionsRequired ?? false,
      };

    case 'START_EXECUTION':
      // Initialize execution with plan
      return {
        ...state,
        plan: action.plan,
        totalSteps: action.totalSteps || action.plan?.steps?.length || 0,
        currentStep: 0,
        stepStatuses: action.stepStatuses || {},
        startTime: Date.now(),
        summary: null,
      };

    case 'SET_ERROR_PLAN':
      // Error during planning
      return {
        ...state,
        plan: action.plan,
        stepStatuses: { 0: 'failed' },
        summary: action.summary,
      };

    case 'STEP_UPDATE':
      // Update step progress
      return {
        ...state,
        currentStep: action.currentStep ?? state.currentStep,
        totalSteps: action.totalSteps ?? state.totalSteps,
        stepStatuses: action.stepStatuses
          ? { ...state.stepStatuses, ...action.stepStatuses }
          : state.stepStatuses,
      };

    case 'SET_STEP_STATUSES':
      // Bulk update step statuses (functional update pattern)
      return {
        ...state,
        stepStatuses:
          typeof action.updater === 'function'
            ? action.updater(state.stepStatuses)
            : action.stepStatuses,
      };

    case 'EXECUTION_COMPLETE':
      // Mark execution as complete
      return {
        ...state,
        summary: action.summary,
        stepStatuses: action.stepStatuses ?? state.stepStatuses,
      };

    case 'CANCELLED':
      // User cancelled execution
      return {
        ...state,
        runStatus: 'cancelled',
        summary: {
          status: 'cancelled',
          message: 'Stopped by user',
          successCount: action.successCount ?? 0,
          failedCount: 0,
          goalAchieved: false,
        },
      };

    case 'SET_METADATA':
      // Update action plan metadata
      return {
        ...state,
        actionPlanMetadata: action.metadata,
        plan: state.plan
          ? { ...state.plan, actionPlanMetadata: action.metadata }
          : state.plan,
      };

    case 'SET_STATS':
      // Update clarify/confirm stats
      return {
        ...state,
        clarifyStats: action.clarifyStats ?? state.clarifyStats,
        confirmStats: action.confirmStats ?? state.confirmStats,
      };

    case 'SET_RUN_STATUS':
      return { ...state, runStatus: action.status };

    case 'SET_ACTIVE_RUN':
      return { ...state, activeRunId: action.runId };

    case 'SET_MODE':
      return {
        ...state,
        mode: action.mode,
        desktopActionsRequired: action.desktopActionsRequired ?? state.desktopActionsRequired,
      };

    case 'SET_DESKTOP_ACTIONS_REQUIRED':
      return { ...state, desktopActionsRequired: action.required };

    case 'SET_DESKTOP_BRIDGE_STATUS':
      return { ...state, desktopBridgeStatus: action.status };

    case 'SET_PLAN':
      return { ...state, plan: action.plan };

    case 'SET_SUMMARY':
      return { ...state, summary: action.summary };

    default:
      return state;
  }
}

export default function AppleFloatBar({
  showWelcome,
  onWelcomeComplete,
  isLoading,
  windowMode = 'single',
  autoSend = true,
}) {
  // Feature flags
  const usePullExecution = import.meta.env.VITE_ENABLE_PULL_EXECUTION === 'true';

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
  const [parallelAgents, setParallelAgents] = useState(null); // Parallel web agents state
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [factTiles, setFactTiles] = useState([]);
  // Autonomous mode state - consolidated via useReducer for atomic updates
  const [executionState, dispatchExecution] = useReducer(executionReducer, initialExecutionState);
  // Destructure for backward compatibility with existing code
  const {
    plan: executionPlan,
    actionPlanMetadata,
    clarifyStats,
    confirmStats,
    currentStep,
    totalSteps,
    mode: executionMode,
    desktopActionsRequired,
    desktopBridgeStatus,
    stepStatuses,
    summary: executionSummary,
    startTime: executionStartTime,
    runStatus,
    activeRunId,
  } = executionState;
  const [backgroundProcesses, setBackgroundProcesses] = useState([]); // Track active background processes
  // Activity feed state for live progress display
  const [activityLog, setActivityLog] = useState([]); // [{id, text, status: 'done'|'running', timestamp, duration}]
  const [activityStartTime, setActivityStartTime] = useState(null); // When current activity started
  const activityIdCounter = useRef(0);
  // LiveActivityFeed state
  const [liveActivitySteps, setLiveActivitySteps] = useState([]); // [{id, status, description, technicalDetails, error, timestamp}]
  const [initialAIMessage, setInitialAIMessage] = useState(null); // Conversational initial response
  const initialAIMessageSetRef = useRef(false); // Track if initial message has been set (avoids stale closure)
  // Track which message timestamps should animate (only new messages)
  const animatedMessagesRef = useRef(new Set());
  const lastUserPromptRef = useRef('');
  const lastAssistantTsRef = useRef(null);
  const accumulatedResponseRef = useRef(''); // For fs_command extraction
  const executedCommandsRef = useRef(new Set()); // Track executed commands to avoid duplicates
  const planIdRef = useRef(null);
  // Approval dialog state
  const [approvalOpen, setApprovalOpen] = useState(false);
  // Hover state for send button controls
  const [showSendControls, setShowSendControls] = useState(false);

  // AI-triggered option buttons state
  // When AI calls show_options tool, these get populated and displayed
  const [aiOptions, setAiOptions] = useState(null); // {options: [{id, label}], prompt: string, runId: string}

  const [approvalDetails, setApprovalDetails] = useState({
    action: '',
    markers: [],
    reason: '',
    isHighRisk: false,
    onApprove: null,
  });

  // Intent confirmation state (UX improvement - show AI understanding before execution)
  const [intentConfirmationOpen, setIntentConfirmationOpen] = useState(false);
  const [pendingIntentData, setPendingIntentData] = useState(null);
  const [pendingRunTracker, setPendingRunTracker] = useState(null);
  const pullServiceRef = useRef(null);

  // Screenshot permission state
  const [screenshotPermissionOpen, setScreenshotPermissionOpen] = useState(false);
  const [pendingMessageForScreenshot, setPendingMessageForScreenshot] = useState(null);

  const [attachments, setAttachments] = useState([]); // [{file, preview, type}]
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  // Max's Monitor workspace state
  const [workspaceActive, setWorkspaceActive] = useState(false);
  const [spreadsheetActive, setSpreadsheetActive] = useState(false);
  const [notesActive, setNotesActive] = useState(false);
  const [monitorMenuOpen, setMonitorMenuOpen] = useState(false);
  const [monitorMenuPosition, setMonitorMenuPosition] = useState({ top: 0, right: 0 });
  const monitorBtnRef = useRef(null);
  const monitorMenuRef = useRef(null);
  const [monitorMenuReady, setMonitorMenuReady] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false); // Track drag-and-drop state
  const dragCounterRef = useRef(0); // Counter to handle nested drag events
  const fileInputRef = useRef(null);

  // ask_user inline question state (for AI to ask user questions during execution)
  const [pendingAskUser, setPendingAskUser] = useState(null); // { question, context, options, timestamp }
  const [isEditingContext, setIsEditingContext] = useState(false); // When user wants to edit the draft
  const [editedContext, setEditedContext] = useState(''); // The edited content
  const contextTextareaRef = useRef(null); // Ref for focusing the textarea

  // Refs
  const barRef = useRef(null);
  const inputRef = useRef(null);
  const lastHeightRef = useRef(70);
  const lastWidthRef = useRef(360);
  const lastMessagesHeightRef = useRef(0);
  const resizeDebounceRef = useRef(null);
  const shrinkTimeoutRef = useRef(null); // Delays shrinking to prevent UI jumping
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
  const hoverTimeoutRef = useRef(null);
  const pendingOptimisticMsgRef = useRef(null); // Track optimistic message for rollback
  const [showReconnected, setShowReconnected] = useState(false);
  const [showDisconnectedBanner, setShowDisconnectedBanner] = useState(false); // Delayed display of disconnected banner
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
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  // User input state - for when AI needs user response during execution
  const [userInputRequest, setUserInputRequest] = useState(null); // {requestId, prompt, defaultValue}
  // Handle user input response submission
  const handleUserInputSubmit = useCallback(() => {
    if (!userInputRequest || !message.trim()) return;

    logger.info('[FloatBar] Sending user input response', {
      requestId: userInputRequest.requestId,
      response: message,
    });

    // Send response back to executor via IPC
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.send('user-input-response', {
        requestId: userInputRequest.requestId,
        response: message,
      });
    }

    // Add to chat history
    setThoughts((prev) => [...prev, { role: 'user', content: message, timestamp: Date.now() }]);

    // Clear state
    setMessage('');
    setUserInputRequest(null);

    toast.success('Response sent', { icon: '✅', duration: 2000 });
  }, [userInputRequest, message]);

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

  // Drag-and-drop handlers for files/images
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;

    // Check if dragging files
    if (e.dataTransfer?.types?.includes('Files')) {
      setIsDraggingFile(true);
      // Auto-expand if in mini mode
      if (isMini) {
        setIsMini(false);
        isMiniRef.current = false;
      }
    }
  }, [isMini]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;

    if (dragCounterRef.current === 0) {
      setIsDraggingFile(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Reset drag state
    dragCounterRef.current = 0;
    setIsDraggingFile(false);

    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length === 0) return;

    // Process dropped files with compression for images
    const processPromises = files.map(async (file) => {
      const isImage = file.type.startsWith('image/');
      const isAllowedDocument = /\.(pdf|txt|md|json|csv)$/i.test(file.name);

      if (!isImage && !isAllowedDocument) {
        toast.error(`Unsupported file type: ${file.name}`, { duration: 3000 });
        return null;
      }

      try {
        // Use compression utility for all files (handles both images and text)
        const processed = await processImageFile(file, {
          maxWidth: 1920,
          maxHeight: 1080,
          quality: 0.8,
        });
        return processed;
      } catch (err) {
        console.error('[handleDrop] Error processing file:', err);
        toast.error(`Failed to process: ${file.name}`, { duration: 3000 });
        return null;
      }
    });

    const results = await Promise.all(processPromises);
    const validResults = results.filter(Boolean);

    if (validResults.length > 0) {
      setAttachments((prev) => [...prev, ...validResults]);
      toast.success(`${validResults.length} file${validResults.length > 1 ? 's' : ''} added`, {
        icon: '📎',
        duration: 2000
      });
    }
  }, [setAttachments]);

  // Intent confirmation handlers
  const handleIntentConfirm = useCallback(async () => {
    const tracker = pendingRunTracker;
    const pullService = pullServiceRef.current;

    if (!tracker || !pullService) {
      console.error('[FloatBar] No pending tracker for intent confirmation');
      return;
    }

    console.log('[FloatBar] Intent confirmed, starting execution:', tracker.runId);

    // Close modal
    setIntentConfirmationOpen(false);
    setPendingIntentData(null);
    setPendingRunTracker(null);

    try {
      // Confirm intent via API and start execution
      await pullService.confirmIntent(tracker.runId);

      // Intent is now shown in the task list (ExecutionProgress/LiveActivityFeed)
      // so we don't need to add it as a separate assistant message

      setThinkingStatus('Working...');

      // Initialize activity feed
      clearActivityLog();
      addActivity(tracker.intent || 'Starting task...');

      // Clear live activity feed for new task
      setLiveActivitySteps([]);
      setInitialAIMessage(null);
      initialAIMessageSetRef.current = false; // Reset the ref for new task

      // Start polling for updates
      pullService.pollRunStatus(tracker.runId, (status) => {
        console.log('[FloatBar] Status update after confirmation:', status);

        // Capture initial message on first action (if present)
        // Use ref to avoid stale closure issue with initialAIMessage state
        if (status.initial_message && !initialAIMessageSetRef.current) {
          setInitialAIMessage(status.initial_message);
          initialAIMessageSetRef.current = true;
        }

        // Use current_status_summary, or fall back to action description
        // Avoid showing "Working on step X" as it's not user-friendly
        const currentSummary =
          status.current_status_summary ||
          status.action?.status_summary ||
          status.action?.description ||
          null; // Let the fallback "Getting started..." handle initial state

        // Check for 'running' or 'executing' (desktop state uses 'executing')
        const isRunning = status.status === 'running' || status.status === 'executing';

        // Update LiveActivityFeed using functional update to avoid stale closure issues
        const stepId = `poll-step-${status.currentStep ?? status.currentStepIndex ?? 'current'}`;
        setLiveActivitySteps((prev) => {
          // Get the last step's description to compare (avoids stale closure)
          const lastStep = prev.length > 0 ? prev[prev.length - 1] : null;
          const lastDescription = lastStep?.description;

          if (currentSummary && isRunning) {
            // Check if this is a new/different activity
            if (currentSummary !== lastDescription) {
              // Check if this step already exists
              const existingIndex = prev.findIndex((s) => s.id === stepId);
              if (existingIndex >= 0) {
                // Update existing step description
                const updated = [...prev];
                updated[existingIndex] = {
                  ...updated[existingIndex],
                  description: currentSummary,
                };
                return updated;
              } else {
                // Mark previous running steps as completed, then add new
                const updated = prev.map((s) =>
                  s.status === 'running' ? { ...s, status: 'completed' } : s
                );
                return [
                  ...updated,
                  {
                    id: stepId,
                    status: 'running',
                    description: currentSummary,
                    technicalDetails: '',
                    timestamp: Date.now(),
                  },
                ];
              }
            }
          } else if (isRunning && prev.length === 0) {
            // If no summary but we're running and no steps yet, add a generic step
            return [
              {
                id: `poll-step-initial`,
                status: 'running',
                description: 'Getting started...',
                technicalDetails: '',
                timestamp: Date.now(),
              },
            ];
          }
          return prev; // No change
        });

        // Also update thinkingStatus for ActivityFeed (legacy)
        if (currentSummary && currentSummary !== thinkingStatus) {
          completeCurrentActivity();
          addActivity(currentSummary);
          setThinkingStatus(currentSummary);
        }

        if (status.status === 'complete' || status.status === 'done') {
          completeCurrentActivity();
          clearActivityLog();
          setIsThinking(false);
          setThinkingStatus('');

          // Mark all running steps as completed
          setLiveActivitySteps((prev) =>
            prev.map((s) => (s.status === 'running' ? { ...s, status: 'completed' } : s))
          );

          const finalMessage = status.final_summary || status.final_response;
          if (finalMessage) {
            const msgTimestamp = Date.now();
            animatedMessagesRef.current.add(msgTimestamp);
            setThoughts((prev) => [
              ...prev,
              {
                role: 'assistant',
                content: finalMessage,
                type: 'completion',
                timestamp: msgTimestamp,
              },
            ]);
          }

          toast.success('Task completed', { duration: 3000 });
        } else if (status.status === 'failed' || status.status === 'error') {
          setIsThinking(false);
          setThinkingStatus('');

          // Mark last running step as failed
          setLiveActivitySteps((prev) =>
            prev.map((s) =>
              s.status === 'running'
                ? { ...s, status: 'failed', error: status.error || 'Task failed' }
                : s
            )
          );

          toast.error('Task failed', { duration: 4000 });
        }
      });

    } catch (err) {
      console.error('[FloatBar] Failed to confirm intent:', err);
      toast.error('Failed to start execution');
      setIsThinking(false);
      setThinkingStatus('');
    }
  }, [pendingRunTracker, thinkingStatus]);

  const handleIntentReject = useCallback(async (reason) => {
    const tracker = pendingRunTracker;
    const pullService = pullServiceRef.current;

    console.log('[FloatBar] Intent rejected:', reason);

    // Close modal
    setIntentConfirmationOpen(false);
    setPendingIntentData(null);
    setPendingRunTracker(null);

    if (tracker && pullService) {
      try {
        await pullService.rejectIntent(tracker.runId, reason);
      } catch (err) {
        console.warn('[FloatBar] Failed to reject intent on backend:', err);
      }
    }

    // Reset state
    setIsThinking(false);
    setThinkingStatus('');

    if (reason === 'timeout') {
      toast('Request timed out - please try again', { icon: '⏰', duration: 3000 });
    } else {
      toast('Request cancelled - feel free to refine your request', { icon: '✏️', duration: 3000 });
    }
  }, [pendingRunTracker]);

  // Stop all AI activity - cancels runs and resets thinking state
  const handleStopAll = useCallback(async () => {
    logger.info('[Stop] User requested full stop');

    // IMMEDIATELY reset UI state - don't wait for async operations
    // This ensures the UI always responds to stop, even if backend calls hang
    setIsThinking(false);
    setThinkingStatus('');
    clearActivityLog(); // Clear activity feed
    setLiveActivitySteps([]); // Clear live activity feed
    dispatchExecution({
      type: 'CANCELLED',
      successCount: Object.values(stepStatuses).filter((s) => s === 'done').length,
    });
    toast('AI stopped', { icon: '🛑', duration: 2000 });

    // Stop polling in pullService (sync operation)
    const pullService = pullServiceRef.current;
    if (pullService?.stopPolling) {
      pullService.stopPolling();
      logger.info('[Stop] Polling stopped');
    }

    // Now do async cleanup in background - these shouldn't block UI
    // CRITICAL: Stop local executor to terminate any running processes
    if (window.executor?.stopAll) {
      try {
        await Promise.race([
          window.executor.stopAll(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
        ]);
        logger.info('[Stop] Local executor stopped');
      } catch (err) {
        logger.warn('[Stop] Local executor stop failed:', err?.message || err);
      }
    }

    // Abort any in-flight chat/run creation request
    if (window.executor?.abortRequest) {
      try {
        const result = await Promise.race([
          window.executor.abortRequest(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
        ]);
        if (result?.aborted) {
          logger.info('[Stop] In-flight request aborted');
        }
      } catch (err) {
        logger.warn('[Stop] Abort request failed:', err?.message || err);
      }
    }

    // Cancel any active run on the backend
    // Use activeRunId (for iterative execution) OR planId (for planned execution)
    const runId = activeRunId || planIdRef.current || executionPlan?.plan_id || executionPlan?.planId;
    if (runId) {
      try {
        await Promise.race([
          runAPI.cancel(runId),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
        ]);
        logger.info('[Stop] Run cancelled:', runId);
      } catch (err) {
        logger.warn('[Stop] Run cancel failed:', err?.message || err);
      }
    } else {
      logger.warn('[Stop] No active run ID found to cancel');
    }
  }, [executionPlan, stepStatuses, activeRunId]);

  const copyToClipboard = useCallback(async (text, note = 'Copied') => {
    try {
      await navigator.clipboard.writeText(String(text || ''));
      toast.success(note);
    } catch (_) {
      toast.error('Copy failed');
    }
  }, []);

  // Extracted inline handlers for stable references (enables child component memoization)
  const handleToggleThoughtExpand = useCallback((thoughtId, currentExpanded) => {
    setThoughts((prev) => {
      const idx = prev.findIndex((m) => m?.id === thoughtId);
      if (idx === -1) return prev;
      const copy = [...prev];
      copy[idx] = { ...copy[idx], expanded: !currentExpanded };
      return copy;
    });
  }, []);

  const handleExpandThought = useCallback((thoughtId) => {
    setThoughts((prev) => {
      const idx = prev.findIndex((m) => m?.id === thoughtId);
      if (idx === -1) return prev;
      const copy = [...prev];
      copy[idx] = { ...copy[idx], expanded: true };
      return copy;
    });
  }, []);

  const handleRemoveAttachment = useCallback((index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
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
  const validatedPermissionMode = useMemo(
    () => validateModeValue(permissionLevel),
    [permissionLevel]
  );
  const permissionModeRef = useRef(validateModeValue(permissionLevel));
  useEffect(() => {
    permissionModeRef.current = validatedPermissionMode;
  }, [validatedPermissionMode]);

  // Listen for ask_user questions from AI (inline in chat, not modal)
  useEffect(() => {
    if (!window.askUser?.onQuestion) return;

    const handleAskUserQuestion = (data) => {
      console.log('[AppleFloatBar] Received ask_user question:', data);
      setPendingAskUser({
        question: data.question,
        context: data.context || '',
        options: data.options || [],
        allowCustomResponse: data.allowCustomResponse || false,
        timestamp: data.timestamp || Date.now()
      });
    };

    window.askUser.onQuestion(handleAskUserQuestion);

    return () => {
      if (window.askUser?.removeListener) {
        window.askUser.removeListener();
      }
    };
  }, []);

  // Handle ask_user response
  const handleAskUserResponse = useCallback((option) => {
    console.log('[AppleFloatBar] User selected:', option);

    // Check if this is an edit option (id contains 'edit' or label contains 'edit')
    const isEditOption = option.id?.toLowerCase().includes('edit') ||
                         option.label?.toLowerCase().includes('edit');

    if (isEditOption && pendingAskUser?.context) {
      // Enable editing mode instead of sending response
      console.log('[AppleFloatBar] Edit option selected - enabling inline editing');
      setEditedContext(pendingAskUser.context);
      setIsEditingContext(true);
      // Focus will be set by useEffect when isEditingContext changes
      return;
    }

    if (window.askUser?.respond) {
      window.askUser.respond({
        cancelled: false,
        answer: null,
        selectedOption: option.label,
        selectedOptionId: option.id
      });
    }
    setPendingAskUser(null);
    setIsEditingContext(false);
    setEditedContext('');
  }, [pendingAskUser]);

  // Handle sending the edited content
  const handleSendEditedContent = useCallback(() => {
    console.log('[AppleFloatBar] Sending edited content');
    if (window.askUser?.respond) {
      window.askUser.respond({
        cancelled: false,
        answer: editedContext, // Send the edited text as a custom answer
        selectedOption: 'Edited by user',
        selectedOptionId: 'user_edited',
        editedContent: editedContext
      });
    }
    setPendingAskUser(null);
    setIsEditingContext(false);
    setEditedContext('');
  }, [editedContext]);

  // Focus textarea when editing mode is enabled
  useEffect(() => {
    if (isEditingContext && contextTextareaRef.current) {
      contextTextareaRef.current.focus();
      // Place cursor at the end
      const len = contextTextareaRef.current.value.length;
      contextTextareaRef.current.setSelectionRange(len, len);
    }
  }, [isEditingContext]);

  const handleAskUserCancel = useCallback(() => {
    console.log('[AppleFloatBar] User cancelled ask_user');
    if (window.askUser?.respond) {
      window.askUser.respond({ cancelled: true });
    }
    setPendingAskUser(null);
  }, []);

  // Listen for parallel web agents updates (worktree-style display)
  useEffect(() => {
    if (!window.parallelAgents?.onUpdate) return;

    const handleParallelAgentsUpdate = (data) => {
      console.log('[AppleFloatBar] Parallel agents update:', data);
      if (data.agents && data.agents.length > 0) {
        setParallelAgents(data.agents);
      } else if (data.status === 'complete') {
        // Clear after a short delay so user can see completion
        setTimeout(() => setParallelAgents(null), 2000);
      }
    };

    window.parallelAgents.onUpdate(handleParallelAgentsUpdate);

    return () => {
      if (window.parallelAgents?.removeListener) {
        window.parallelAgents.removeListener();
      }
    };
  }, []);

  const permissionKey = validatedPermissionMode;
  const effectiveMode = permissionKey;
  const planCardAllowed = false; // Plan cards not used
  const shouldDisplayPlanCard = useCallback(() => {
    return false; // Plan cards not used
  }, []);

  const showTopExecutionCard = false;

  const planCardData = useMemo(() => {
    if (!executionPlan || !executionPlan.steps) return null;
    const steps = Array.isArray(executionPlan.steps) ? executionPlan.steps : [];
    const metadataList = executionPlan.actionPlanMetadata || [];

    const tasks = steps.map((step, idx) => {
      const meta = metadataList[idx] || {};
      const rawArgs =
        step.args && Object.keys(step.args).length > 0 ? step.args : meta.args_preview || {};
      const dependencies = Array.isArray(step.dependencies)
        ? step.dependencies
        : meta.dependencies || [];
      const rawBranches = Array.isArray(step.branches)
        ? step.branches
        : meta.branches
          ? [].concat(meta.branches)
          : [];
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
        parallel_safe:
          typeof step.parallel_safe === 'boolean'
            ? step.parallel_safe
            : Boolean(meta.parallel_safe),
        verification: step.verification || meta.verification,
        branches: rawBranches,
        loop: loopInfo,
      };
    });

    const derivedMetadata = {
      ...(executionPlan.metadata || {}),
      reasoning: executionPlan.reasoning || executionPlan.metadata?.reasoning,
    };
    if (!derivedMetadata.risk_level) {
      if (tasks.some((t) => t.risk_level === 'high')) {
        derivedMetadata.risk_level = 'high';
      } else if (tasks.some((t) => t.risk_level === 'medium')) {
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
      requires_approval: tasks.some((t) => t.requires_approval),
      total_estimated_duration_ms:
        executionPlan.total_estimated_duration_ms || tasks.length * 45000,
      reasoning: executionPlan.reasoning,
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
  const { clearMessages, apiConnected, currentUser, profile, setApiConnected } = useStore();

  const userFirstName = useMemo(() => {
    // Prefer the saved profile name from onboarding/settings
    const profileName = profile?.name && String(profile.name).trim();
    if (profileName) {
      const first = profileName.split(' ')[0];
      return first || profileName;
    }

    // Fallback to Supabase currentUser fields
    if (currentUser) {
      const raw = currentUser.name || currentUser.fullName || currentUser.email || '';
      if (raw) {
        const base = String(raw).split('@')[0];
        const first = base.split(' ')[0];
        return first || base;
      }
    }

    return 'there';
  }, [profile, currentUser]);

  // Connection status wiring (graceful offline UX)
  useEffect(() => {
    // Subscribe to API connection changes
    const unsub = addConnectionListener((isConnected) => {
      setApiConnected(!!isConnected);
      offlineRef.current = !isConnected;
    });
    // Initial quick ping to set state on mount
    healthAPI
      .check()
      .then(() => {
        setApiConnected(true);
        offlineRef.current = false;
      })
      .catch(() => {
        setApiConnected(false);
        offlineRef.current = true;
      });
    return () => {
      try {
        unsub && unsub();
      } catch {}
    };
  }, [setApiConnected]);

  // Keep pill in mini state by default; onboarding no longer forces auto-expand
  useEffect(() => {
    if (showWelcome !== true) return;
    // If we ever want to auto-expand for onboarding, handle via explicit user action
    // leaving mini state intact ensures the pill is always present
  }, [showWelcome]);

  // While offline, ping every 2s to auto-reconnect without spamming UI
  useEffect(() => {
    if (apiConnected) return;
    let timer = setInterval(() => {
      healthAPI
        .check()
        .then(() => setApiConnected(true))
        .catch(() => {});
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

  // Delay showing disconnected banner by 3 seconds to avoid flash on startup
  useEffect(() => {
    if (apiConnected) {
      // Connected - immediately hide the banner
      setShowDisconnectedBanner(false);
      return;
    }
    // Disconnected - wait 3 seconds before showing banner
    const timer = setTimeout(() => {
      setShowDisconnectedBanner(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, [apiConnected]);

  // Helper to map UI level to backend mode
  const resolveMode = useCallback(() => validatedPermissionMode, [validatedPermissionMode]);

  // Hard route guard: the FloatBar window should never navigate to /settings
  useEffect(() => {
    const keepRoot = () => {
      try {
        const h = window.location?.hash || '#/';

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
      const cfg = apiConfigManager.getConfig
        ? apiConfigManager.getConfig()
        : { baseURL: apiConfigManager.getBaseURL?.() };
      const base = (cfg?.baseURL || '').replace(/\/$/, '');
      if (!base) return;
      const headers = {
        'Content-Type': 'application/json',
      };
      const key =
        (cfg && cfg.apiKey) || (apiConfigManager.getApiKey && apiConfigManager.getApiKey());
      if (key) headers['X-API-Key'] = key;
      try {
        const uid = localStorage.getItem('user_id');
        if (uid) headers['X-User-Id'] = uid;
      } catch {}
      const payload = { plan_id: planId, step_id: stepId, action_type: actionType, result };
      await fetch(`${base}/api/v2/agent/action-result`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      }).catch(() => {});
    } catch {}
  }, []);

  // Start new session on mount
  useEffect(() => {
    if (localStorage.getItem('user_id')) {
      startSession()
        .then(() => console.log('[Session] New session started on mount'))
        .catch((err) => console.warn('[Session] Failed to start session:', err));
    }
    // Sync Google email to executor for autonomous Gmail access
    const googleEmail = localStorage.getItem('google_user_email');
    if (googleEmail && window.executor?.setUserContext) {
      window.executor.setUserContext({ google_user_email: googleEmail });
      console.log('[FloatBar] Synced google_user_email to executor');
    }
    // Sync browser_mode preference to executor for tool filtering
    const browserMode = localStorage.getItem('pref_browser_mode') || 'both';
    if (window.executor?.setUserContext) {
      window.executor.setUserContext({ browser_mode: browserMode });
      console.log('[FloatBar] Synced browser_mode to executor:', browserMode);
    }
  }, []);

  // Load conversation from history when user clicks "Load Conversation"
  useEffect(() => {
    const checkForLoadedConversation = () => {
      try {
        const savedConv = localStorage.getItem('loaded_conversation');
        if (savedConv) {
          const conv = JSON.parse(savedConv);
          if (conv && Array.isArray(conv.messages) && conv.messages.length > 0) {
            // Map messages to the thoughts format
            const loadedThoughts = conv.messages.map((msg, idx) => ({
              role: msg.role || 'user',
              content: msg.content || '',
              timestamp:
                msg.timestamp || msg.created_at || Date.now() - (conv.messages.length - idx) * 1000,
            }));
            setThoughts(loadedThoughts);

            // Restore the original session ID so new messages append to the same conversation
            const originalSessionId = conv.sessionId || conv.id;
            if (originalSessionId) {
              localStorage.setItem('session_id', originalSessionId);
              logger.info('[FloatBar] Restored session ID for conversation continuity', {
                sessionId: originalSessionId,
              });
            }

            // Expand the floatbar to show the conversation
            setIsMini(false);
            isMiniRef.current = false;
            logger.info('[FloatBar] Loaded conversation from history', {
              messageCount: loadedThoughts.length,
              convId: conv.id,
              sessionId: originalSessionId,
            });
            toast.success(`Continuing conversation (${loadedThoughts.length} messages)`);
          }
          // Clear the localStorage key so we don't reload on next mount
          localStorage.removeItem('loaded_conversation');
        }
      } catch (err) {
        logger.warn('[FloatBar] Failed to load conversation from history:', err);
        localStorage.removeItem('loaded_conversation');
      }
    };

    // Check on mount
    checkForLoadedConversation();

    // Also listen for storage events (in case user loads from settings window)
    const handleStorageChange = (e) => {
      if (e.key === 'loaded_conversation' && e.newValue) {
        checkForLoadedConversation();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Preference: show memory preview UI (default off)
  const memoryPreviewEnabled = useMemo(() => {
    try {
      return localStorage.getItem('pref_memory_preview') === '1';
    } catch {
      return false;
    }
  }, []);
  const memoryAutoApply = useMemo(() => {
    try {
      return localStorage.getItem('pref_memory_auto_apply') !== '0';
    } catch {
      return true;
    }
  }, []);
  const memoryReviewEnabled = useMemo(() => {
    try {
      return localStorage.getItem('pref_memory_review') === '1';
    } catch {
      return false;
    }
  }, []);
  const memoryDebugEnabled = useMemo(() => {
    try {
      return localStorage.getItem('pref_memory_debug') === '1';
    } catch {
      return false;
    }
  }, []);
  // Safety preference: disable PII warnings for local-only reads (default ON)
  const safetyDisablePII = useMemo(() => {
    try {
      const v = localStorage.getItem('pref_safety_disable_pii');
      return v !== '0';
    } catch {
      return true;
    }
  }, []);

  // Retrieve Better Memory context pack for a message
  const doRetrieveContext = useCallback(
    async (text) => {
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
    },
    [memoryPreviewEnabled]
  );

  const mkActionFP = useCallback((type, args) => {
    try {
      return `fp:${JSON.stringify({ t: type || '', a: args || {} })}`;
    } catch {
      return `fp:${type || ''}`;
    }
  }, []);

  const logTelemetry = useCallback((eventType, data) => {
    try {
      if (window.telemetry && typeof window.telemetry.record === 'function') {
        window.telemetry.record(eventType, { source: 'renderer', ...(data || {}) });
      }
    } catch {}
  }, []);

  // ==========================================
  // OPTIMISTIC UI HELPERS
  // Add message immediately for instant feedback, rollback if checks fail
  // ==========================================

  // Add user message optimistically (before checks complete)
  const addOptimisticMessage = useCallback((text, attached = []) => {
    const timestamp = Date.now();
    const normalizedAttachments = (attached || []).map((att, idx) => ({
      key: `${timestamp}-${idx}`,
      type: att.type,
      name: att.file?.name || 'Attachment',
      preview: att.preview || null,
      size: att.file?.size,
    }));
    pendingOptimisticMsgRef.current = { text, timestamp };
    setThoughts((prev) => [
      ...prev,
      { role: 'user', content: text, timestamp, attachments: normalizedAttachments },
    ]);
    // Message and attachments cleared by caller for smooth animation
    setIsThinking(true);
    setThinkingStatus('Checking...');
    logger.info('[OptimisticUI] Added user message immediately');
    return timestamp;
  }, []);

  // Rollback an optimistic message if a check fails
  const rollbackOptimisticMessage = useCallback((originalText) => {
    const pending = pendingOptimisticMsgRef.current;
    if (pending && pending.text === originalText) {
      // Remove the message we optimistically added
      setThoughts((prev) =>
        prev.filter(
          (t) =>
            !(t.role === 'user' && t.content === pending.text && t.timestamp === pending.timestamp)
        )
      );
      // Restore the input text so user doesn't lose their work
      setMessage(originalText);
      setIsThinking(false);
      setThinkingStatus('');
      pendingOptimisticMsgRef.current = null;
      logger.info('[OptimisticUI] Rolled back message after check failure');
    }
  }, []);

  // Clear the pending optimistic message tracking (message is now committed)
  const commitOptimisticMessage = useCallback(() => {
    pendingOptimisticMsgRef.current = null;
    logger.info('[OptimisticUI] Message committed (checks passed)');
  }, []);

  // ==========================================
  // Activity Feed Helpers - For live progress display
  // ==========================================

  // Add a new activity to the log (starts as 'running')
  const addActivity = useCallback((text) => {
    const id = `activity-${++activityIdCounter.current}`;
    const timestamp = Date.now();
    setActivityLog((prev) => [...prev, { id, text, status: 'running', timestamp }]);
    setActivityStartTime(timestamp);
    return id;
  }, []);

  // Mark an activity as done and optionally add duration
  const completeActivity = useCallback((id, duration = null) => {
    setActivityLog((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              status: 'done',
              duration: duration || Math.floor((Date.now() - a.timestamp) / 1000),
            }
          : a
      )
    );
    setActivityStartTime(null);
  }, []);

  // Mark the most recent running activity as done
  const completeCurrentActivity = useCallback(() => {
    setActivityLog((prev) => {
      const lastRunning = [...prev].reverse().find((a) => a.status === 'running');
      if (lastRunning) {
        return prev.map((a) =>
          a.id === lastRunning.id
            ? { ...a, status: 'done', duration: Math.floor((Date.now() - a.timestamp) / 1000) }
            : a
        );
      }
      return prev;
    });
    setActivityStartTime(null);
  }, []);

  // Clear all activities (for new conversation)
  const clearActivityLog = useCallback(() => {
    setActivityLog([]);
    setActivityStartTime(null);
    activityIdCounter.current = 0;
  }, []);

  // Reset textarea height and window size when message is cleared
  useEffect(() => {
    if (message === '' && inputRef.current) {
      inputRef.current.style.height = '24px';
      inputRef.current.classList.remove('has-overflow');
    }
  }, [message, isMini]);

  // Helper: retrieve context then proceed to send (optionally auto-send)
  // messageAlreadyAdded: true if optimistic UI already added the message to chat
  const continueAfterPreview = useCallback(
    async (text, messageAlreadyAdded = false) => {
      // Update status to show we're retrieving context
      if (messageAlreadyAdded) {
        setThinkingStatus('Searching memory...');
      }

      const pack = await doRetrieveContext(text);
      if (autoSend) {
        // Call immediately for instant UI feedback (memory is automatic now)
        // Pass pack directly to avoid stale state
        // IMPORTANT: Also pass any user-attached images/files
        let imageData = null;
        if (attachments.length > 0) {
          // Convert first image attachment to base64 for the API
          const imgAttachment = attachments.find((a) => a.type === 'image');
          if (imgAttachment && imgAttachment.preview) {
            imageData = imgAttachment.preview; // Already base64 data URL
            console.log('[Attachments] Sending image with message:', imgAttachment.file?.name);
          }
          // For text files, append content to the message
          const textAttachments = attachments.filter((a) => a.type === 'file' && a.content);
          if (textAttachments.length > 0) {
            const fileContents = textAttachments
              .map((a) => `\n\n--- File: ${a.file.name} ---\n${a.content}`)
              .join('');
            text = text + fileContents;
            console.log('[Attachments] Appending file contents to message');
          }
          // Attachments already cleared immediately after optimistic message
        }
        try {
          if (continueSendMessageRef.current) {
            // Pass the messageAlreadyAdded flag to avoid duplicate UI updates
            continueSendMessageRef.current(text, imageData, pack, messageAlreadyAdded);
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
    },
    [autoSend, doRetrieveContext, memoryPreviewEnabled, attachments]
  );

  // Handle expand/collapse
  const handleExpand = useCallback(() => {
    setIsTransitioning(true);
    setIsMini(false);
    isMiniRef.current = false;

    // Pre-warm connections while UI is transitioning (non-blocking)
    warmConnections();

    // Restore last height immediately to avoid visible shrink
    (async () => {
      try {
        const hasMessages = thoughts.length > 0;
        const onboarding = showWelcome === true;
        const base = onboarding ? 520 : MIN_EXPANDED_HEIGHT;
        let limit = MAX_EXPANDED_HEIGHT;
        try {
          const size = await window.electron?.getScreenSize?.();
          if (size?.height) {
            // Allow expansion to 85% of screen height, capped by the hard max
            limit = Math.min(
              MAX_EXPANDED_HEIGHT,
              Math.max(MIN_EXPANDED_HEIGHT, Math.floor(size.height * 0.85))
            );
          }
        } catch {}

        // Only restore saved height if there are messages; otherwise start compact
        if (hasMessages) {
          const key = 'amx:floatbar:lastHeight';
          let saved = Number(localStorage.getItem(key));
          if (!Number.isFinite(saved) || saved < base) saved = base;
          const target = Math.min(limit, Math.max(base, saved, MIN_EXPANDED_HEIGHT));
          if (window.electron?.resizeWindow) {
            lastWidthRef.current = 360;
            await window.electron.resizeWindow(360, target);
            lastHeightRef.current = target;
          }
        } else {
          if (window.electron?.resizeWindow) {
            lastWidthRef.current = 360;
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

    setThoughts((prev) => {
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
      const idx = prev.findIndex((m) => m?.id === thoughtIdRef.current && m?.type === 'thought');
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
    setThoughts((prev) => {
      const idx = prev.findIndex((m) => m?.id === id && m?.type === 'thought');
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
      console.log(
        '[FSCommand] Skipping inline fs_command execution; Hands-on Desktop will handle actions'
      );
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
            backdropFilter: 'blur(10px)',
          },
        });

        // Execute via IPC
        if (window.electron && window.electron.memory && window.electron.memory.autonomous) {
          const normalized =
            command && !command.type && command.action
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
              command: actType === 'sh.run' ? normalized?.args?.command || '' : '',
              status: 'running',
            });
            setExecPanelOpen(true);
          } catch {}

          const result = await window.electron.memory.autonomous
            .execute('fs_command', normalized, { allowAll: true })
            .catch((err) => ({ success: false, error: { message: err?.message } }));
          const actType = command.action || normalized?.type || '';

          if (result && result.success) {
            // Success toast
            const labelMap = {
              'fs.write': 'File created',
              'fs.read': 'File read',
              'fs.append': 'File updated',
              'fs.list': 'Directory listed',
              'fs.delete': 'File deleted',
              'sh.run': 'Command executed',
            };
            const label = labelMap[actType] || 'Action completed';
            toast.success(`✅ ${label}`, {
              duration: 3000,
              style: {
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
                backdropFilter: 'blur(10px)',
              },
            });
            // Previews
            if (actType === 'fs.read' && result.result?.content) {
              const content = result.result.content;
              const preview = content.length > 500 ? content.substring(0, 500) + '...' : content;
              toast(`📄 File contents (preview)\n${preview}`, {
                duration: 4000,
                style: {
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  whiteSpace: 'pre-wrap',
                },
              });
            }
            if (actType === 'fs.list' && result.result?.files) {
              const files = result.result.files;
              const fileList = files
                .map((f) => `- ${f.type === 'directory' ? '📁' : '📄'} ${f.name} (${f.size} bytes)`)
                .join('\n');
              toast(`📂 Directory contents:\n${fileList}`, {
                duration: 4000,
                style: {
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  whiteSpace: 'pre-wrap',
                },
              });
            }
            try {
              setExecutionDetails({
                when: Date.now(),
                actionType: normalized?.type || '',
                args: normalized?.args || {},
                command: normalized?.type === 'sh.run' ? normalized?.args?.command || '' : '',
                status: result?.result?.status || 'completed',
                duration_ms: result?.result?.duration_ms,
                exit_code: result?.result?.exit_code ?? 0,
                stdout: result?.result?.stdout || '',
                stderr: result?.result?.stderr || '',
              });
              setExecPanelOpen(true);
            } catch {}
          } else {
            // Failure toast
            const stderr = result?.error?.stderr || result?.result?.stderr || '';
            const stdout = result?.error?.stdout || result?.result?.stdout || '';
            const detail = (
              stderr ||
              stdout ||
              result?.error?.message ||
              'Unknown error'
            ).toString();
            const preview = detail.length > 240 ? detail.slice(0, 240) + '…' : detail;
            const label = actType === 'sh.run' ? 'Command failed' : 'Action failed';
            logTelemetry('desktop.fs_execute.fail', {
              action_type: normalized?.type,
              origin: 'fs_command',
              error: result?.error,
            });
            toast.error(`❌ ${label}: ${preview}`, {
              duration: 5000,
              style: {
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                backdropFilter: 'blur(10px)',
                whiteSpace: 'pre-wrap',
              },
            });
            try {
              setExecutionDetails({
                when: Date.now(),
                actionType: normalized?.type || '',
                args: normalized?.args || {},
                command: normalized?.type === 'sh.run' ? normalized?.args?.command || '' : '',
                status: result?.result?.status || 'failed',
                duration_ms: result?.result?.duration_ms,
                exit_code:
                  typeof result?.error?.code === 'number'
                    ? result.error.code
                    : (result?.result?.exit_code ?? 1),
                stdout,
                stderr,
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
          duration: 4000,
        });
      }
    }
  }, []);

  // Main streaming chat logic (extracted for reuse)
  const sendChat = useCallback((text, userContext, screenshotData) => {
    // Track token usage for credit calculation
    let totalOutputTokens = 0;
    const messageSentAt = Date.now();

    // Track message sent
    trackMessageSent(text?.length || 0, !!screenshotData);

    // FIX: Ensure session_id exists before sending chat message
    let sessionId = localStorage.getItem('session_id');
    if (!sessionId) {
      sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem('session_id', sessionId);
      logger.info('[Session] Generated initial session_id', { sessionId });
    }

    chatAPI
      .sendMessageStream(text, userContext, screenshotData, async (event) => {
        console.log('[Chat] Received SSE event:', event);

        // Handle SSE events - backend sends {type: string, data: {...}}
        if (event.type === 'ack') {
          // Stream started - clear buffer and prepare for real-time tokens
          streamBufferRef.current = '';
          accumulatedResponseRef.current = ''; // Clear fs_command accumulator
          executedCommandsRef.current.clear(); // Clear executed commands tracking
          enrichTileIdRef.current = null;
          clearActivityLog(); // Start fresh activity feed for new task
          // Reset thought ref (bubble will be created lazily on first thinking event)
          thoughtIdRef.current = null;
          // Clear any pending AI option buttons from previous request
          setAiOptions(null);
          // Only require desktop actions in autonomous mode (not chatty)
          const currentMode = permissionModeRef.current;
          const isAutoMode = currentMode === 'autonomous';
          const isChattyMode = currentMode === 'chatty';
          console.log(
            `[Chat] Mode check: currentMode='${currentMode}', isAutoMode=${isAutoMode}, isChattyMode=${isChattyMode}`
          );
          // Atomic reset of execution state
          dispatchExecution({
            type: 'PARTIAL_RESET',
            desktopActionsRequired: isAutoMode && !isChattyMode,
          });
          setPlanCardDismissed(!shouldDisplayPlanCard());
          executionModeRef.current = null;
          desktopActionsRef.current = isAutoMode && !isChattyMode;
          chatModeAnnouncementRef.current = false;
          // Set initial thinking status based on query type for better UX
          const lowerText = (text || '').toLowerCase();
          if (
            lowerText.includes('check') &&
            (lowerText.includes('app') || lowerText.includes('install'))
          ) {
            setThinkingStatus('Checking installed apps...');
          } else if (lowerText.includes('email') || lowerText.includes('gmail')) {
            setThinkingStatus('Preparing email...');
          } else if (
            lowerText.includes('calendar') ||
            lowerText.includes('event') ||
            lowerText.includes('meeting')
          ) {
            setThinkingStatus('Checking calendar...');
          } else if (
            lowerText.includes('file') ||
            lowerText.includes('folder') ||
            lowerText.includes('directory')
          ) {
            setThinkingStatus('Scanning files...');
          } else if (lowerText.includes('search') || lowerText.includes('find')) {
            setThinkingStatus('Searching...');
          } else if (lowerText.includes('open') || lowerText.includes('launch')) {
            setThinkingStatus('Opening...');
          } else {
            setThinkingStatus('Thinking...');
          }
        } else if (event.type === 'metadata') {
          const meta = event.data || event;
          const key = meta.key || meta.metadata_key || meta.name;
          const value = meta.value ?? meta.data ?? null;
          if (!key) {
            console.warn('[Chat] metadata event missing key', meta);
          } else if (key === 'action_plan') {
            dispatchExecution({ type: 'SET_METADATA', metadata: value });
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
            } else if (runState?.status === 'completed' || runState?.status === 'success') {
              setThinkingStatus('Completed');
            }

            dispatchExecution({ type: 'SET_RUN_STATUS', status: runState?.status || null });
          } else if (key === 'desktop_actions_required') {
            const normalized = Boolean(value);
            desktopActionsRef.current = normalized;
            dispatchExecution({ type: 'SET_DESKTOP_ACTIONS_REQUIRED', required: normalized });
          }
        } else if (event.type === 'exec_log' && event.data?.source === 'run_stream') {
          // Mirror run stream exec logs into the Thoughts area and progress UI
          const log = event.data;
          // Prefer status_summary (user-friendly) over message (technical)
          const statusSummary = log.status_summary || log.message || log.stdout || log.error || '';
          const msg = log.message || log.stdout || log.error || '';
          const status = log.status || 'info';
          const stepId = log.step_id || `step-${Date.now()}`;

          if (statusSummary) {
            setThinkingStatus(statusSummary);
          }
          if (msg) {
            appendThought(msg);
          }
          if (status === 'replanning') {
            toast(`🔄 ${msg || 'Replanning...'}`, { duration: 3000 });
          }
          setRunExecLogs((prev) => {
            const next = [{ ...log, ts: Date.now() }, ...prev];
            return next.slice(0, 10);
          });

          // Build technical details from available data
          const buildTechnicalDetails = () => {
            const parts = [];
            if (log.action_type) parts.push(`Action: ${log.action_type}`);
            if (log.stdout) parts.push(`Output:\n${log.stdout}`);
            if (log.stderr) parts.push(`Error:\n${log.stderr}`);
            if (log.exit_code !== undefined) parts.push(`Exit Code: ${log.exit_code}`);
            if (log.message && log.message !== statusSummary) parts.push(`Details: ${log.message}`);
            return parts.join('\n\n');
          };

          // Update LiveActivityFeed based on status
          if (status === 'running' && statusSummary) {
            // Add new running step to LiveActivityFeed (with duplicate check)
            setLiveActivitySteps((prev) => {
              // Check if this step already exists or if description is same as last step
              const existingIndex = prev.findIndex((s) => s.id === stepId);
              const lastStep = prev.length > 0 ? prev[prev.length - 1] : null;

              if (existingIndex >= 0) {
                // Update existing step
                const updated = [...prev];
                updated[existingIndex] = {
                  ...updated[existingIndex],
                  description: statusSummary,
                  technicalDetails: buildTechnicalDetails(),
                };
                return updated;
              } else if (lastStep?.description === statusSummary) {
                // Same description as last step - don't add duplicate
                return prev;
              } else {
                // Mark previous running steps as completed, add new
                const updated = prev.map((s) =>
                  s.status === 'running' ? { ...s, status: 'completed' } : s
                );
                return [
                  ...updated,
                  {
                    id: stepId,
                    status: 'running',
                    description: statusSummary,
                    technicalDetails: buildTechnicalDetails(),
                    timestamp: Date.now(),
                  },
                ];
              }
            });
          } else if (status === 'completed') {
            // Mark step as completed in LiveActivityFeed
            setLiveActivitySteps((prev) =>
              prev.map((step) =>
                step.id === stepId
                  ? { ...step, status: 'completed', technicalDetails: buildTechnicalDetails() }
                  : step
              )
            );
          } else if (status === 'failed') {
            // Mark step as failed in LiveActivityFeed
            setLiveActivitySteps((prev) =>
              prev.map((step) =>
                step.id === stepId
                  ? {
                      ...step,
                      status: 'failed',
                      error: log.error || log.stderr || msg,
                      technicalDetails: buildTechnicalDetails(),
                    }
                  : step
              )
            );
          }

          // Track background processes
          if (log.tool_name === 'start_background_process' && log.stdout) {
            try {
              const processIdMatch = log.stdout.match(/Process started with ID: (proc-[a-f0-9]+)/);
              const nameMatch = log.message?.match(/Starting (.+)/);
              if (processIdMatch) {
                const processId = processIdMatch[1];
                const name = nameMatch ? nameMatch[1] : 'Background Process';
                setBackgroundProcesses((prev) => [
                  ...prev,
                  { id: processId, name, startedAt: Date.now() },
                ]);
              }
            } catch (e) {
              console.error('[FloatBar] Error parsing background process start:', e);
            }
          } else if (log.tool_name === 'stop_process' && log.stdout?.includes('stopped')) {
            try {
              const processIdMatch = log.message?.match(/proc-[a-f0-9]+/);
              if (processIdMatch) {
                const processId = processIdMatch[0];
                setBackgroundProcesses((prev) => prev.filter((p) => p.id !== processId));
              }
            } catch (e) {
              console.error('[FloatBar] Error parsing background process stop:', e);
            }
          }
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
            weather: 'Weather',
          };

          const tile = {
            id: crypto.randomUUID(),
            title: titleMap[toolName] || toolName,
            primary: displayText,
            meta: {
              latencyMs,
              confidence,
              timestamp: new Date().toISOString(),
            },
            raw: result,
            enrichment: event.enrichment || '',
          };

          // Scope subsequent token events to this tile for enrichment
          enrichTileIdRef.current = tile.id;

          setFactTiles((prev) => [tile, ...prev]);
          logger.info(`[FactTile] Rendered ${toolName} tile in ${Math.round(latencyMs)}ms`);
        } else if (event.type === 'token') {
          const content = event.content || event.data?.content || '';
          const channel = event.channel || event.data?.channel || 'final';
          if (!content) return;

          // Skip thinking channel tokens - they shouldn't appear in the main message
          // These are internal status updates like "Analyzing your query..."
          if (channel === 'thinking' || channel === 'narration') {
            // Update thinking status for the indicator instead
            setThinkingStatus(content);
            return;
          }

          // Hide thinking indicator as soon as content starts arriving
          // This prevents the dots from lingering after content is visible
          if (isThinking) {
            setIsThinking(false);
            setThinkingStatus('');
          }

          // Track tokens for credit calculation (approximate: ~4 chars per token)
          totalOutputTokens += Math.ceil(content.length / 4);

          // Accumulate response for fs_command extraction
          accumulatedResponseRef.current += content;

          // Check for complete fs_command blocks (periodically)
          if (
            accumulatedResponseRef.current.includes('```fs_command') &&
            accumulatedResponseRef.current.includes('```')
          ) {
            extractAndExecuteCommands(accumulatedResponseRef.current);
          }

          if (enrichTileIdRef.current) {
            // Stream into the most recent fact tile enrichment
            setFactTiles((prev) => {
              if (prev.length === 0) return prev;
              const idx = prev.findIndex((t) => t.id === enrichTileIdRef.current);
              if (idx === -1) return prev;
              const updated = [...prev];
              const tile = updated[idx];
              updated[idx] = {
                ...tile,
                enrichment: (tile.enrichment || '') + content,
              };
              return updated;
            });
          } else {
            // No tile enrichment active: show tokens in real-time
            streamBufferRef.current = (streamBufferRef.current || '') + content;

            // Update or create assistant message in real-time
            setThoughts((prev) => {
              // Check if last message is an in-progress assistant message
              if (
                prev.length > 0 &&
                prev[prev.length - 1].role === 'assistant' &&
                prev[prev.length - 1].streaming
              ) {
                // Update existing streaming message
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: streamBufferRef.current,
                };
                return updated;
              } else {
                // Create new streaming assistant message
                return [
                  ...prev,
                  {
                    role: 'assistant',
                    content: streamBufferRef.current,
                    timestamp: Date.now(),
                    streaming: true,
                  },
                ];
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
          dispatchExecution({
            type: 'START_EXECUTION',
            plan: planData,
            totalSteps: planData.total_steps || planData.steps?.length || 0,
          });
          setPlanCardDismissed(!shouldDisplayPlanCard());
          setThinkingStatus(`📋 Plan ready: ${planData.total_steps || 0} steps`);

          // Show plan as a special message (annotated with metadata when available)
          const planSteps = (planData.steps || [])
            .map((step, idx) => {
              const detail = mergedMetadata && mergedMetadata[idx];
              const suffix = detail
                ? ` _(risk: ${detail.risk_level || 'unknown'}${detail.parallel_safe ? ', parallel' : ''})_`
                : '';
              return `${idx + 1}. ${step.description || step.command || 'Processing...'}${suffix}`;
            })
            .join('\n');
          // Previously we rendered a detailed "Execution Plan" bubble here.
          // To reduce UI noise, we now only record a brief summary in the inline thought bubble.
          const summary = `Plan ready: ${planData.total_steps || planData.steps?.length || 0} steps`;
          appendThought(summary);
        } else if (event.type === 'exec_log') {
          const log = event.data || event;
          const status = log.status || 'info';
          const msg = log.message || 'Processing...';
          // Prefer status_summary for user-friendly display
          const statusSummary = log.status_summary || msg;
          const stepId = log.step_id || `step-${Date.now()}`;

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
                'sh.run': 'Command executed',
              };
              return friendlyNames[action] || action;
            }
            return 'Action';
          };

          // Build technical details from available data
          const buildTechnicalDetails = () => {
            const parts = [];
            if (log.action_type) parts.push(`Action: ${log.action_type}`);
            if (log.stdout) parts.push(`Output:\n${log.stdout}`);
            if (log.stderr) parts.push(`Error:\n${log.stderr}`);
            if (log.exit_code !== undefined) parts.push(`Exit Code: ${log.exit_code}`);
            if (log.message && log.message !== statusSummary) parts.push(`Details: ${log.message}`);
            return parts.join('\n\n');
          };

          // Handle different exec_log statuses
          switch (status) {
            case 'running':
              // AI is actively working - show the status_summary
              setThinkingStatus(statusSummary);
              // Add to activity feed - complete any previous running activity first
              completeCurrentActivity();
              addActivity(statusSummary || msg || 'Processing...');

              // Add new running step to LiveActivityFeed (with duplicate check)
              setLiveActivitySteps((prev) => {
                const existingIndex = prev.findIndex((s) => s.id === stepId);
                const lastStep = prev.length > 0 ? prev[prev.length - 1] : null;

                if (existingIndex >= 0) {
                  // Update existing step
                  const updated = [...prev];
                  updated[existingIndex] = {
                    ...updated[existingIndex],
                    description: statusSummary,
                    technicalDetails: buildTechnicalDetails(),
                  };
                  return updated;
                } else if (lastStep?.description === statusSummary) {
                  // Same description - don't add duplicate
                  return prev;
                } else {
                  // Mark previous running steps as completed, add new
                  const updated = prev.map((s) =>
                    s.status === 'running' ? { ...s, status: 'completed' } : s
                  );
                  return [
                    ...updated,
                    {
                      id: stepId,
                      status: 'running',
                      description: statusSummary,
                      technicalDetails: buildTechnicalDetails(),
                      timestamp: Date.now(),
                    },
                  ];
                }
              });
              break;

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
                      backdropFilter: 'blur(10px)',
                    },
                  });
                  setThinkingStatus(statusSummary);
                }
              }
              break;

            case 'completed':
              // Action succeeded - complete current activity in feed
              completeCurrentActivity();
              const actionName = extractActionName(msg);
              toast.success(`✅ ${actionName}`, {
                duration: 3000,
                style: {
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                  backdropFilter: 'blur(10px)',
                },
              });
              setThinkingStatus(actionName);

              // Mark step as completed in LiveActivityFeed
              setLiveActivitySteps((prev) =>
                prev.map((step) =>
                  step.id === stepId
                    ? { ...step, status: 'completed', technicalDetails: buildTechnicalDetails() }
                    : step
                )
              );
              break;

            case 'failed':
              // Action failed - show error notification
              // Extract minimal reason
              const reason = (
                typeof msg === 'string' ? msg : log.error || 'Action failed'
              ).toString();
              toast.error(`❌ ${reason}`, {
                duration: 5000,
                style: {
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  backdropFilter: 'blur(10px)',
                },
              });
              setThinkingStatus('Action failed');

              // Mark step as failed in LiveActivityFeed
              setLiveActivitySteps((prev) =>
                prev.map((step) =>
                  step.id === stepId
                    ? {
                        ...step,
                        status: 'failed',
                        error: log.error || log.stderr || reason,
                        technicalDetails: buildTechnicalDetails(),
                      }
                    : step
                )
              );
              break;

            case 'replanning':
              // v2.1: Pivot guidance - AI is replanning after failure
              toast(`🔄 ${msg}`, {
                duration: 5000,
                icon: '🔄',
                style: {
                  background: 'rgba(251, 191, 36, 0.1)',
                  border: '1px solid rgba(251, 191, 36, 0.2)',
                  backdropFilter: 'blur(10px)',
                },
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
                  backdropFilter: 'blur(10px)',
                },
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
                  backdropFilter: 'blur(10px)',
                },
              });
              setThinkingStatus('Waiting for desktop helper…');
              try {
                if (desktopActionsRef.current) {
                  console.log(
                    '[Exec] Hands-on Desktop handling queued action; skipping legacy LocalExecutor path'
                  );
                  break;
                }
                if (
                  window.electron &&
                  window.electron.memory &&
                  window.electron.memory.autonomous
                ) {
                  const at =
                    log.action_type ||
                    (typeof msg === 'string'
                      ? msg.match(/Action requested:\s*([A-Za-z0-9_.-]+)/)?.[1] || null
                      : null);
                  const aa = log.action_args || log.args || {};
                  if (at) {
                    const planId = log.plan_id || log.planId || null;
                    const stepId = log.step_id || log.stepId || null;
                    const execKey = JSON.stringify({ pid: planId, sid: stepId, at, aa });
                    const actionFP = mkActionFP(at, aa);
                    // Strengthened dedup: check both per-step key and action fingerprint
                    if (
                      !executedCommandsRef.current.has(execKey) &&
                      !executedCommandsRef.current.has(actionFP)
                    ) {
                      executedCommandsRef.current.add(execKey);
                      executedCommandsRef.current.add(actionFP);
                      toast(`🔧 Executing ${at}...`, {
                        duration: 2000,
                        icon: '⚡',
                        style: {
                          background: 'rgba(59, 130, 246, 0.1)',
                          border: '1px solid rgba(59, 130, 246, 0.2)',
                          backdropFilter: 'blur(10px)',
                        },
                      });
                      const normalized = { type: at, args: aa || {} };
                      const execResult = await window.electron.memory.autonomous.execute(
                        stepId,
                        normalized,
                        { allowAll: true }
                      );
                      if (execResult?.success) {
                        const an = (at || '').split('.')[1] || at;
                        const fn = {
                          write: 'File created',
                          read: 'File read',
                          append: 'File updated',
                          list: 'Directory listed',
                          delete: 'File deleted',
                        };
                        const label = fn[an] || 'Action completed';
                        toast.success(`✅ ${label}`, {
                          duration: 3000,
                          style: {
                            background: 'rgba(34, 197, 94, 0.1)',
                            border: '1px solid rgba(34, 197, 94, 0.2)',
                            backdropFilter: 'blur(10px)',
                          },
                        });
                        await sendActionResult(planId, stepId, at, execResult.result).catch(
                          () => {}
                        );
                        try {
                          setExecutionDetails({
                            when: Date.now(),
                            planId,
                            stepId,
                            actionType: at,
                            args: aa || {},
                            command: at === 'sh.run' ? aa?.command || '' : '',
                            exit_code: execResult?.result?.exit_code ?? 0,
                            stdout: execResult?.result?.stdout || '',
                            stderr: execResult?.result?.stderr || '',
                          });
                          setExecPanelOpen(true);
                        } catch {}
                      } else if (execResult && execResult.error) {
                        const stderr = execResult.error?.stderr || execResult.result?.stderr || '';
                        const stdout = execResult.error?.stdout || execResult.result?.stdout || '';
                        const detail = (
                          stderr ||
                          stdout ||
                          execResult.error?.message ||
                          'Action failed'
                        ).toString();
                        const preview = detail.length > 240 ? detail.slice(0, 240) + '…' : detail;
                        toast.error(`❌ ${preview}`, {
                          duration: 5000,
                          style: {
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            backdropFilter: 'blur(10px)',
                            whiteSpace: 'pre-wrap',
                          },
                        });
                        try {
                          setExecutionDetails({
                            when: Date.now(),
                            planId,
                            stepId,
                            actionType: at,
                            args: aa || {},
                            command: at === 'sh.run' ? aa?.command || '' : '',
                            exit_code:
                              typeof execResult?.error?.code === 'number'
                                ? execResult.error.code
                                : (execResult?.result?.exit_code ?? 1),
                            stdout,
                            stderr,
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

          if (typeof log.step === 'number') {
            dispatchExecution({ type: 'STEP_UPDATE', currentStep: log.step });
          }
        } else if (event.type === 'final') {
          const finalData = event.data || event;
          const text = finalData.rationale || finalData.summary || '';
          if (text && typeof text === 'string') {
            setThoughts((prev) => [
              ...prev,
              { role: 'assistant', content: text, timestamp: Date.now(), type: 'final' },
            ]);
          }
          const artifacts = finalData?.outputs?.artifacts;
          if (Array.isArray(artifacts) && artifacts.length) {
            const artifactLines = artifacts.map((art) => formatArtifactSummary(art)).join('\n');
            setThoughts((prev) => [
              ...prev,
              {
                role: 'assistant',
                content: `📁 **Artifacts Created**\n${artifactLines}`,
                timestamp: Date.now(),
                type: 'artifacts',
              },
            ]);
            setArtifactSummary(artifactLines);
          }
          if (
            (clarifyStats && clarifyStats.requested) ||
            (confirmStats && confirmStats.requested)
          ) {
            const parts = [];
            if (clarifyStats && clarifyStats.requested) {
              parts.push(
                `Clarified ${clarifyStats.answered || 0}/${clarifyStats.requested} prompts`
              );
            }
            if (confirmStats && confirmStats.requested) {
              const approved = confirmStats.approved || 0;
              const total = confirmStats.requested;
              parts.push(`Confirmed ${approved}/${total} high-risk actions`);
            }
            if (parts.length) {
              setThoughts((prev) => [
                ...prev,
                {
                  role: 'assistant',
                  content: `📊 ${parts.join(' • ')}`,
                  timestamp: Date.now(),
                  type: 'metrics',
                },
              ]);
            }
          }
        } else if (event.type === 'thinking') {
          const message = event.data?.message || event.message || 'Processing...';
          const step = event.data?.step || 0;
          const totalSteps = event.data?.total_steps || 0;

          // Update current step for progress tracking
          if (step > 0) {
            dispatchExecution({ type: 'STEP_UPDATE', currentStep: step, totalSteps });
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

          // Track message received with response time
          const responseTimeMs = Date.now() - messageSentAt;
          trackMessageReceived(responseTimeMs, totalOutputTokens);

          // Check for execution_steps in the response (from non-streaming chat endpoint)
          // This provides user-friendly progress display like "✅ Getting started", "✅ Checked your calendar"
          if (d.execution_steps && Array.isArray(d.execution_steps) && d.execution_steps.length > 0) {
            console.log('[Chat] Found execution_steps in response:', d.execution_steps);
            // Convert execution_steps to LiveActivityFeed format
            const steps = d.execution_steps.map((step, idx) => ({
              id: step.id || `step-${idx}`,
              status: step.status === 'completed' ? 'completed' : step.status === 'failed' ? 'failed' : 'completed',
              description: step.description || 'Processing...',
              timestamp: step.timestamp ? step.timestamp * 1000 : Date.now(), // Convert to ms if needed
            }));
            setLiveActivitySteps(steps);
          }

          // Try common keys first
          const primaryKeys = [
            'final_response',
            'final',
            'response',
            'text',
            'content',
            'message',
            'result',
            'answer',
            'output',
          ];
          let finalResponse = null;
          for (const k of primaryKeys) {
            const v = d?.[k];
            if (typeof v === 'string' && v.trim()) {
              finalResponse = v;
              break;
            }
          }
          // Model-runner style structures
          if (!finalResponse) {
            const nested =
              d?.choices?.[0]?.message?.content ||
              d?.choices?.[0]?.delta?.content ||
              d?.data?.text ||
              d?.data?.content;
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
                if (typeof val === 'string' && val.trim()) {
                  finalResponse = val;
                  break;
                }
                if (val && typeof val === 'object') stack.push(val);
              }
            }
          }
          const buffered = streamBufferRef.current || '';
          const responseText =
            typeof finalResponse === 'string' && finalResponse.trim() ? finalResponse : buffered;
          if (!responseText) {
            try {
              console.warn(
                '[Chat] Done event had no response text. data keys:',
                Object.keys(d || {})
              );
            } catch {}
          }
          // Final catch-up: extract any trailing fs_command blocks in final buffer
          try {
            if (responseText && responseText.includes('```fs_command')) {
              await extractAndExecuteCommands(responseText);
            }
          } catch {}

          // Check if response qualifies as a Deep Dive (>150 words)
          let deepDiveEntry = null;
          const wordCount = responseText
            ? responseText
                .trim()
                .split(/\s+/)
                .filter((w) => w.length > 0).length
            : 0;
          console.log(`[Chat] Response word count: ${wordCount} (threshold: 150)`);

          if (responseText && qualifiesAsDeepDive(responseText)) {
            try {
              const userPrompt = lastUserPromptRef.current || '';
              // IMPORTANT: createDeepDive is async - must await to get the actual entry
              deepDiveEntry = await createDeepDive(userPrompt, responseText);
              console.log(`[Chat] Created Deep Dive:`, deepDiveEntry);
              logger.info(
                `[Chat] Created Deep Dive: ${deepDiveEntry.id} (${deepDiveEntry.wordCount} words)`
              );
              // Dispatch event for settings tab to update
              window.dispatchEvent(new Event('deep-dive-updated'));
            } catch (err) {
              console.error('[Chat] Failed to create Deep Dive:', err);
              logger.warn('[Chat] Failed to create Deep Dive:', err);
            }
          } else {
            console.log(
              `[Chat] Response does not qualify for Deep Dive (${wordCount} < 150 words)`
            );
          }

          setThoughts((prev) => {
            // Check if last message is a streaming assistant message
            if (
              prev.length > 0 &&
              prev[prev.length - 1].role === 'assistant' &&
              prev[prev.length - 1].streaming
            ) {
              // Mark the streaming message as complete
              const updated = [...prev];

              // If this is a Deep Dive, show summary + link instead of full response
              if (deepDiveEntry) {
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: deepDiveEntry.summary,
                  streaming: false,
                  isDeepDive: true,
                  deepDiveId: deepDiveEntry.id,
                  fullContent: responseText, // Keep full content for reference
                };
              } else {
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: responseText || updated[updated.length - 1].content,
                  streaming: false,
                };
              }
              return updated;
            } else if (responseText) {
              // No streaming message exists, create a final one
              const messageData = {
                role: 'assistant',
                content: deepDiveEntry ? deepDiveEntry.summary : responseText,
                timestamp: Date.now(),
              };

              if (deepDiveEntry) {
                messageData.isDeepDive = true;
                messageData.deepDiveId = deepDiveEntry.id;
                messageData.fullContent = responseText;
              }

              return [...prev, messageData];
            }
            return prev;
          });

          // Save conversation to memory system
          if (responseText && localStorage.getItem('user_id')) {
            addMessage('assistant', responseText).catch((err) =>
              console.warn('[Chat] Failed to save message to memory:', err)
            );
          }

          // Option A: Automatic memory extraction and apply (no user prompts)
          try {
            const userPrompt = (lastUserPromptRef.current || '').trim();
            const assistantText = (responseText || '').trim();
            const extractMessage = [
              userPrompt && `User: ${userPrompt}`,
              assistantText && `Assistant: ${assistantText}`,
            ]
              .filter(Boolean)
              .join('\n');
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
                    toast.error(
                      'Gmail not connected. Please connect your Gmail account in settings.'
                    );
                  } else {
                    // First, check Gmail API health
                    logger.info('[Email] Checking Gmail API health...');
                    toast.loading('Verifying Gmail connection...', { id: 'gmail-health' });

                    (async () => {
                      try {
                        const cfg = apiConfigManager.getConfig
                          ? apiConfigManager.getConfig()
                          : { baseURL: apiConfigManager.getBaseURL?.() };
                        const base = (cfg?.baseURL || '').replace(/\/$/, '');
                        const headers = {};
                        const key =
                          (cfg && cfg.apiKey) ||
                          (apiConfigManager.getApiKey && apiConfigManager.getApiKey());
                        if (key) headers['X-API-Key'] = key;
                        try {
                          const uid = localStorage.getItem('user_id');
                          if (uid) headers['X-User-Id'] = uid;
                        } catch {}
                        const url = `${base}/api/v2/google/gmail/health`;
                        const healthResponse = await axios.get(url, {
                          params: { email: userEmail },
                          headers,
                        });
                        toast.dismiss('gmail-health');
                        if (!healthResponse?.data?.healthy) {
                          logger.error('[Email] Gmail health check failed:', healthResponse?.data);
                          toast.error(`Gmail error: ${healthResponse?.data?.message}`);
                          return;
                        }
                        logger.info('[Email] Gmail healthy, sending email...', healthResponse.data);
                        googleAPI
                          .sendEmail(
                            command.to,
                            command.subject,
                            command.body,
                            command.cc,
                            command.bcc,
                            command.attachments
                          )
                          .then(() => {
                            toast.success('Email sent successfully!');
                          })
                          .catch((error) => {
                            logger.error('[Email] Failed to send', error);
                            toast.error(`Failed to send email: ${error.message}`);
                          });
                      } catch (healthError) {
                        toast.dismiss('gmail-health');
                        logger.error('[Email] Health check failed:', healthError);
                        toast.error(
                          'Failed to verify Gmail connection. Please check your connection in settings.'
                        );
                      }
                    })();
                  }
                }
              }

              // Browser command - Open URLs in user's native browser
              const browserCommandMatch = responseText.match(
                /```browser_command\s*\n([\s\S]*?)\n```/
              );
              if (browserCommandMatch) {
                const commandJson = browserCommandMatch[1].trim();
                const command = JSON.parse(commandJson);

                if (command.action === 'open_url') {
                  logger.info('[Browser] Executing browser command', command);

                  // Open URL in user's default browser (native UX)
                  if (window.electron?.openExternal) {
                    window.electron
                      .openExternal(command.url)
                      .then(() => {
                        logger.info('[Browser] Opened URL successfully', command.url);
                        toast.success('Opened in your browser!');
                      })
                      .catch((error) => {
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

              // macOS native tool actions - detect JSON action blocks like {"action": "notes.list", "args": {}}
              // These are returned by the AI when using macOS-specific tools
              const macosActionMatch = responseText.match(
                /\{"action":\s*"([^"]+)"(?:,\s*"args":\s*(\{[^}]*\}))?\}/
              );
              if (macosActionMatch && window.macos?.executeTool) {
                const actionName = macosActionMatch[1];
                let args = {};
                try {
                  if (macosActionMatch[2]) {
                    args = JSON.parse(macosActionMatch[2]);
                  }
                } catch (e) {
                  logger.warn('[macOS] Failed to parse args:', e);
                }

                // Check if this is a macOS AppleScript tool (notes.*, safari.*, etc.)
                const macosApps = ['notes', 'safari', 'mail', 'calendar', 'finder', 'reminders'];
                const [appName] = actionName.split('.');
                if (macosApps.includes(appName)) {
                  logger.info('[macOS] Executing native tool:', actionName, args);

                  // Show user-friendly feedback
                  const friendlyMessages = {
                    'notes.list': 'Opening Notes...',
                    'notes.create': 'Creating note...',
                    'notes.read': 'Reading note...',
                    'notes.search': 'Searching notes...',
                    'notes.activate': 'Opening Notes...',
                    'safari.navigate': 'Opening Safari...',
                    'safari.activate': 'Opening Safari...',
                    'mail.get_unread': 'Checking unread emails...',
                    'mail.send': 'Sending email...',
                    'mail.draft': 'Creating email draft...',
                    'mail.activate': 'Opening Mail...',
                    'calendar.get_today': 'Checking today\'s events...',
                    'calendar.get_upcoming': 'Getting upcoming events...',
                    'calendar.create_event': 'Creating calendar event...',
                    'calendar.activate': 'Opening Calendar...',
                    'finder.list_folder': 'Listing folder contents...',
                    'finder.open_file': 'Opening file...',
                    'finder.reveal': 'Revealing in Finder...',
                    'finder.activate': 'Opening Finder...',
                    'reminders.get_incomplete': 'Getting reminders...',
                    'reminders.create': 'Creating reminder...',
                    'reminders.complete': 'Completing reminder...',
                    'reminders.activate': 'Opening Reminders...',
                  };
                  const friendlyMsg = friendlyMessages[actionName] || `Executing ${actionName}...`;
                  toast.loading(friendlyMsg, { id: 'macos-action' });

                  window.macos
                    .executeTool(actionName, args)
                    .then((result) => {
                      toast.dismiss('macos-action');
                      if (result.success) {
                        logger.info('[macOS] Tool executed successfully:', result);
                        // Show success message based on action
                        const successMessages = {
                          'notes.list': 'Notes opened!',
                          'notes.activate': 'Notes opened!',
                          'safari.navigate': 'Safari opened!',
                          'safari.activate': 'Safari opened!',
                          'mail.activate': 'Mail opened!',
                          'calendar.activate': 'Calendar opened!',
                          'finder.activate': 'Finder opened!',
                          'reminders.activate': 'Reminders opened!',
                        };
                        toast.success(successMessages[actionName] || 'Done!');
                      } else {
                        logger.error('[macOS] Tool execution failed:', result);
                        toast.error(result.error || 'Failed to execute action');
                      }
                    })
                    .catch((error) => {
                      toast.dismiss('macos-action');
                      logger.error('[macOS] Tool execution error:', error);
                      toast.error(`Failed: ${error.message}`);
                    });
                }
              }
            } catch (err) {
              logger.error('[Command] Failed to parse command', err);
            }
          }

          // Token accrual billing is now handled by the backend
          // The backend accrues tokens and deducts credits when the 500-token threshold is crossed
          // No client-side credit deduction needed - just log for visibility
          if (totalOutputTokens > 0) {
            logger.info(
              `[TokenAccrual] Output tokens: ${totalOutputTokens} (backend handles billing)`
            );
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
          const errorData = event.data || {};
          const errorMsg =
            errorData?.error || errorData?.message || event.error || 'Failed to get response';
          const isTerminal = errorData?.terminal || false;
          const errorCode = errorData?.code || errorData?.error || 'UNKNOWN';

          // Track chat error
          trackChatError({ message: errorMsg, code: errorCode, name: 'ChatError' });
          const isInsufficientCredits =
            errorCode === 'insufficient_credits' ||
            errorMsg.toLowerCase().includes('insufficient credit');

          // Handle insufficient credits specially - navigate to billing
          if (isInsufficientCredits) {
            console.log('[Chat] Insufficient credits error - prompting user to purchase');
            const creditsRemaining = errorData?.credits_remaining ?? 0;
            toast.error(`💳 ${errorMsg}\n\nClick to purchase credits.`, {
              duration: 10000,
              style: {
                cursor: 'pointer',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                backdropFilter: 'blur(10px)',
              },
            });
            // Navigate to credits page
            setTimeout(() => {
              window.location.hash = '#/settings?section=credits';
            }, 1500);
            // Add message to thoughts
            setThoughts((prev) => [
              ...prev,
              {
                role: 'system',
                content: `💳 **Credits Required**\n\nYou have ${creditsRemaining} credits remaining. Please purchase more credits to continue using Agent Max.`,
                timestamp: Date.now(),
                type: 'billing',
              },
            ]);
          } else if (isTerminal) {
            // v2.1: terminal errors stop execution permanently
            console.log('[Chat] Terminal error received, stopping execution:', errorCode);
            toast.error(`❌ ${errorMsg}`, {
              duration: 7000,
              style: {
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                backdropFilter: 'blur(10px)',
              },
            });
            // Add terminal error to thoughts
            setThoughts((prev) => [
              ...prev,
              {
                role: 'system',
                content: `⛔ Terminal Error (${errorCode}): ${errorMsg}`,
                timestamp: Date.now(),
                type: 'error',
                terminal: true,
              },
            ]);
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
        } else if (event.type === 'show_options') {
          // AI wants to show option buttons for user selection
          const optionsData = event.data || event;
          console.log('[Chat] Show options received:', optionsData);
          setAiOptions({
            prompt: optionsData.prompt || 'Choose an option:',
            options: optionsData.options || [],
            runId: optionsData.run_id || planIdRef.current
          });
        }
      })
      .catch((error) => {
        console.error('Chat error:', error);
        // Track network/connection errors
        trackChatError({ message: error?.message || 'Network error', code: 'NETWORK_ERROR', name: 'NetworkError' });
        // Network/connection errors should flip to offline state without spamming toasts
        setApiConnected(false);
        offlineRef.current = true;
        setIsThinking(false);
        setThinkingStatus('');
      });
  }, []);

  // Helper to run the full send flow (screenshots, streaming, memory)
  const continueSend = useCallback(
    async (text) => {
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
          .select('credits, subscription_tier')
          .eq('id', userId)
          .single();
        // Credits are stored directly in users.credits column (not metadata)
        const currentCredits = userData?.credits || 0;
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
            message_cached: false,
          },
        });
      } catch (error) {
        logger.error('Credit check failed', error);
        toast.error('Failed to check credits. Please try again.');
        return;
      }
      // Add user message
      setThoughts((prev) => [...prev, { role: 'user', content: text, timestamp: Date.now() }]);
      setMessage('');
      setIsThinking(true);
      setThinkingStatus('Thinking...');
      // Remember last user prompt for extraction
      try {
        lastUserPromptRef.current = text;
      } catch {}
      if (localStorage.getItem('user_id')) {
        addMessage('user', text).catch((err) =>
          console.warn('[Chat] Failed to save user message to memory:', err)
        );
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
          latency: ambiguityResult.latency_ms
            ? `${ambiguityResult.latency_ms.toFixed(1)}ms`
            : 'N/A',
          word_count: ambiguityResult.word_count || 0,
          confidence: ambiguityResult.confidence || 0,
        });

        // If explicit screen request, take screenshot immediately without asking
        if (ambiguityResult.reason === 'explicit_request') {
          if (window.electron?.takeScreenshot) {
            try {
              setThinkingStatus('Capturing screenshot...');
              const result = await window.electron.takeScreenshot();
              screenshotData = result.base64;
              logger.info(
                '[Screenshot] Captured for explicit request:',
                Math.round(result.size / 1024),
                'KB'
              );
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
        recent_messages: thoughts.map((t) => ({ role: t.role, content: t.content })),
        profile: null,
        facts: null,
        preferences: null,
        google_user_email: localStorage.getItem('google_user_email') || null,
        __mode:
          typeof resolveMode === 'function'
            ? resolveMode()
            : localStorage.getItem('permission_level') || 'chatty',
      };
      // NEW: include current mode so backend can enable tools appropriately
      try {
        userContext.__mode = resolveMode();
      } catch {}
      if (localStorage.getItem('user_id')) {
        try {
          const [profile, facts, preferences] = await Promise.all([
            getProfile().catch(() => null),
            getFacts().catch(() => null),
            getPreferences().catch(() => null),
          ]);
          userContext.profile = profile;
          userContext.facts = facts;
          userContext.preferences = preferences;

          // Parse prompt_profile if it exists (it's stored as JSON string)
          let parsedPromptProfile = null;
          try {
            const promptProfileStr = preferences?.prompt_profile;
            if (promptProfileStr && typeof promptProfileStr === 'string') {
              parsedPromptProfile = JSON.parse(promptProfileStr);
            }
          } catch (e) {
            console.warn('[Chat] Failed to parse prompt_profile:', e);
          }

          // CRITICAL FIX: Extract user name from ALL sources (priority order)
          // Issue: Onboarding saves to preferences, but getProfile reads from users.metadata.profile
          // This bridges the gap by checking all possible sources
          const userName =
            preferences?.user_name || // Saved in onboarding completion
            parsedPromptProfile?.name || // From prompt_profile JSON
            profile?.name || // users.metadata.profile (if set)
            facts?.personal?.name?.value || // facts table
            facts?.personal?.name || // facts table (alt format)
            (() => {
              try {
                return localStorage.getItem('user_name');
              } catch {
                return null;
              }
            })() ||
            null;

          // If we found a user name that's not the default, inject it everywhere
          if (userName && userName !== 'User' && userName.trim()) {
            // Update profile in context
            userContext.profile = { ...(profile || {}), name: userName };
            console.log('[Chat] User name resolved from sources:', userName);
          }

          // Also extract help_category if available
          const helpCategory =
            preferences?.help_category ||
            parsedPromptProfile?.help_category || // From prompt_profile JSON
            (() => {
              try {
                return localStorage.getItem('help_category');
              } catch {
                return null;
              }
            })() ||
            null;

          if (helpCategory) {
            userContext.profile = { ...(userContext.profile || {}), help_category: helpCategory };
          }

          // Inject Known Facts directly into semantic_context so the model can use them without extra retrieval
          try {
            const f = facts || {};
            const school = f?.education?.school?.value ?? f?.education?.school ?? null;
            const city = f?.location?.city?.value ?? f?.location?.city ?? null;
            // Use the resolved userName instead of just facts
            const name = userName || (f?.personal?.name?.value ?? f?.personal?.name ?? null);
            const favoriteFood =
              f?.preferences?.favorite_food?.value ?? f?.preferences?.favorite_food ?? null;
            const likes = f?.preferences?.likes?.value ?? f?.preferences?.likes ?? null;
            let known = '';
            if (name && name !== 'User') known += `- Name: ${name}\n`;
            if (school) known += `- School: ${school}\n`;
            if (city) known += `- Location: ${city}\n`;
            if (helpCategory) known += `- Interested in: ${helpCategory}\n`;
            if (favoriteFood) known += `- Favorite food: ${favoriteFood}\n`;
            if (likes) known += `- Likes: ${likes}\n`;
            if (known) {
              userContext.semantic_context =
                (userContext.semantic_context || '') + `\n\n**Known Facts:**\n${known}`;
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
    },
    [thoughts]
  );
  // Handle message submit with safety check and potential approval
  // Handle screenshot permission response
  const handleScreenshotPermission = useCallback(
    async (approved) => {
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
    },
    [pendingMessageForScreenshot]
  );

  // Continue sending message after screenshot decision
  // messageAlreadyAdded: true if optimistic UI already added the message (skip duplicate add)
  const continueSendMessage = useCallback(
    async (text, screenshotData, memoryPack = null, messageAlreadyAdded = false) => {
      // Only update UI if message wasn't already added optimistically
      if (!messageAlreadyAdded) {
        // Add user message to chat immediately
        setThoughts((prev) => [...prev, { role: 'user', content: text, timestamp: Date.now() }]);
        setMessage('');
        setIsThinking(true);
        setThinkingStatus('Thinking...');
      } else {
        // Message already in UI, just update status
        setThinkingStatus('Building context...');
      }
      // Reset autonomous progress state
      try {
        dispatchExecution({ type: 'SET_PLAN', plan: null });
        dispatchExecution({ type: 'STEP_UPDATE', currentStep: 0, totalSteps: 0 });
        setPlanCardDismissed(!shouldDisplayPlanCard());
      } catch {}
      // Remember the last user prompt for memory extraction
      lastUserPromptRef.current = text;

      // Save user message to memory
      if (localStorage.getItem('user_id')) {
        addMessage('user', text).catch((err) =>
          console.warn('[Chat] Failed to save user message to memory:', err)
        );
      }

      // Build user context
      let userContext = {
        recent_messages: thoughts.map((t) => ({ role: t.role, content: t.content })),
        profile: null,
        facts: null,
        preferences: null,
        google_user_email: localStorage.getItem('google_user_email') || null, // Add Google connection status
      };

      const userId = localStorage.getItem('user_id');
      const sessionId = localStorage.getItem('session_id');

      if (userId) {
        try {
          // ==========================================
          // OPTIMIZED: Fetch ALL context in parallel for maximum speed
          // Previously these were sequential, adding ~400-800ms latency
          // ==========================================
          setThinkingStatus('Fetching context...');

          const deepMemory = localStorage.getItem('pref_deep_memory_search') === '1';
          const useHybridSearch = localStorage.getItem('use_hybrid_search') !== '0';

          // Start ALL async operations in parallel
          const [profile, facts, preferences, recentMsgs, hybridResults] = await Promise.all([
            getProfile().catch(() => null),
            getFacts().catch(() => null),
            getPreferences().catch(() => null),
            sessionId ? getRecentMessages(20, sessionId).catch(() => []) : Promise.resolve([]),
            // Pre-fetch hybrid search in parallel (this is the slow one - embedding generation)
            useHybridSearch
              ? hybridSearchContext(text, userId, {
                  includeMessages: true,
                  includeFacts: true,
                  messageLimit: deepMemory ? 10 : 6,
                  factLimit: deepMemory ? 5 : 3,
                }).catch(() => ({ messages: [], facts: [], stats: {} }))
              : Promise.resolve(null),
          ]);

          logger.info('[Parallel] All context fetched in parallel');

          userContext.profile = profile;
          userContext.facts = facts;
          userContext.preferences = preferences;

          // Parse prompt_profile if it exists (it's stored as JSON string)
          let parsedPromptProfile = null;
          try {
            const promptProfileStr = preferences?.prompt_profile;
            if (promptProfileStr && typeof promptProfileStr === 'string') {
              parsedPromptProfile = JSON.parse(promptProfileStr);
            }
          } catch (e) {
            console.warn('[Chat] Failed to parse prompt_profile:', e);
          }

          // CRITICAL FIX: Extract user name from ALL sources (priority order)
          // Issue: Onboarding saves to preferences, but getProfile reads from users.metadata.profile
          // This bridges the gap by checking all possible sources
          const userName =
            preferences?.user_name || // Saved in onboarding completion
            parsedPromptProfile?.name || // From prompt_profile JSON
            profile?.name || // users.metadata.profile (if set)
            facts?.personal?.name?.value || // facts table
            facts?.personal?.name || // facts table (alt format)
            (() => {
              try {
                return localStorage.getItem('user_name');
              } catch {
                return null;
              }
            })() ||
            null;

          // If we found a user name that's not the default, inject it everywhere
          if (userName && userName !== 'User' && userName.trim()) {
            userContext.profile = { ...(profile || {}), name: userName };
            console.log('[Chat] User name resolved from sources:', userName);
          }

          // Also extract help_category if available
          const helpCategory =
            preferences?.help_category ||
            parsedPromptProfile?.help_category || // From prompt_profile JSON
            (() => {
              try {
                return localStorage.getItem('help_category');
              } catch {
                return null;
              }
            })() ||
            null;

          if (helpCategory) {
            userContext.profile = { ...(userContext.profile || {}), help_category: helpCategory };
          }

          // Semantic retrieval: build a minimal, relevant context for the current goal
          // NOTE: recentMsgs already fetched in parallel Promise.all above
          try {
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
                logger.info(
                  '[Semantic][Selector] slices',
                  (selection.slices || []).map((s) => ({
                    id: s.id,
                    kind: s.kind,
                    score: s.score,
                    tokens: s.tokens,
                    text: (s.text || '').slice(0, 80),
                  }))
                );
              } catch {}
            }

            // Query local Electron memory for cross-session recall
            try {
              const deepMemory = localStorage.getItem('pref_deep_memory_search') === '1';
              // For local keyword search, use more permissive thresholds
              const threshold = deepMemory ? 0.3 : 0.4;
              const limit = deepMemory ? 10 : 6;
              console.log(
                `[Semantic] Searching local memory with threshold=${threshold}, limit=${limit}, deepMemory=${deepMemory}`
              );

              // Utilities: normalize text and expand synonyms
              const normalize = (s) =>
                (s || '')
                  .toLowerCase()
                  .replace(/[^a-z0-9\s]/g, ' ') // strip punctuation
                  .replace(/\s+/g, ' ') // collapse spaces
                  .trim();
              const STOP = new Set([
                'the',
                'a',
                'an',
                'to',
                'of',
                'is',
                'are',
                'am',
                'and',
                'or',
                'for',
                'in',
                'on',
                'at',
                'with',
                'my',
                'your',
                'our',
                'their',
                'what',
                'where',
                'when',
                'how',
                'who',
                'do',
                'does',
                'did',
                'go',
                'went',
                'you',
                'i',
              ]);
              const expandSynonyms = (word) => {
                if (['school', 'college', 'university'].includes(word))
                  return ['school', 'college', 'university'];
                if (['city', 'town', 'location'].includes(word))
                  return ['city', 'town', 'location'];
                if (['name', 'called'].includes(word)) return ['name', 'called'];
                if (['favorite', 'favourite', 'fav'].includes(word))
                  return ['favorite', 'favourite', 'fav', 'like', 'love', 'prefer'];
                if (['food', 'cuisine', 'dish', 'meal', 'snack'].includes(word))
                  return ['food', 'cuisine', 'dish', 'meal', 'snack'];
                return [word];
              };
              const tokens = normalize(text)
                .split(' ')
                .filter((w) => w && !STOP.has(w));
              const queryTerms = Array.from(new Set(tokens.flatMap(expandSynonyms)));
              if (memoryDebugEnabled) {
                logger.info('[Semantic][Local] queryTerms', queryTerms);
              }

              let items = [];
              if (window.electron?.memory?.getAllSessions) {
                try {
                  // 1) Direct facts recall with high confidence
                  // NOTE: Using `facts` already fetched in parallel Promise.all above
                  // This eliminates duplicate Electron IPC call that was adding ~50-100ms latency
                  let factsBlock = '';
                  if (facts) {
                    const school =
                      facts?.education?.school?.value ?? facts?.education?.school ?? null;
                    if (
                      school &&
                      queryTerms.some((t) => ['school', 'college', 'university'].includes(t))
                    ) {
                      items.push({ text: `You go to ${school}`, score: 1.0, fact: true });
                      factsBlock += `- School: ${school}\n`;
                    }
                    const city = facts?.location?.city?.value ?? facts?.location?.city ?? null;
                    if (city && queryTerms.some((t) => ['city', 'town', 'location'].includes(t))) {
                      items.push({ text: `You are in ${city}`, score: 0.9, fact: true });
                      factsBlock += `- Location: ${city}\n`;
                    }
                    const name = facts?.personal?.name?.value ?? facts?.personal?.name ?? null;
                    if (name && queryTerms.includes('name')) {
                      items.push({ text: `Your name is ${name}`, score: 0.9, fact: true });
                      factsBlock += `- Name: ${name}\n`;
                    }
                    const favoriteFood =
                      facts?.preferences?.favorite_food?.value ??
                      facts?.preferences?.favorite_food ??
                      null;
                    if (
                      favoriteFood &&
                      (queryTerms.some((t) => ['favorite', 'favourite', 'fav'].includes(t)) ||
                        queryTerms.some((t) => ['food', 'cuisine', 'dish', 'meal'].includes(t)))
                    ) {
                      items.push({
                        text: `Your favorite food is ${favoriteFood}`,
                        score: 1.0,
                        fact: true,
                      });
                      factsBlock += `- Favorite food: ${favoriteFood}\n`;
                    }
                    const likes =
                      facts?.preferences?.likes?.value ?? facts?.preferences?.likes ?? null;
                    if (
                      likes &&
                      queryTerms.some((t) =>
                        ['favorite', 'favourite', 'fav', 'like', 'love', 'prefer'].includes(t)
                      )
                    ) {
                      items.push({ text: `You like ${likes}`, score: 0.85, fact: true });
                      factsBlock += `- Likes: ${likes}\n`;
                    }
                    if (factsBlock) {
                      userContext.semantic_context =
                        (userContext.semantic_context || '') +
                        `\n\n**Known Facts:**\n${factsBlock}`;
                      if (memoryDebugEnabled) {
                        logger.info('[Semantic][Facts] appended', factsBlock);
                      }
                    }
                  }

                  // 2) Search conversation history using hybrid search (semantic + keyword)
                  // NOTE: hybridResults already fetched in parallel Promise.all above
                  if (
                    hybridResults &&
                    (hybridResults.messages?.length > 0 || hybridResults.facts?.length > 0)
                  ) {
                    console.log('[Semantic] Using pre-fetched hybrid search results:', {
                      messages: hybridResults.messages?.length || 0,
                      facts: hybridResults.facts?.length || 0,
                      source: hybridResults.stats?.source || 'parallel-prefetch',
                    });

                    // Convert hybrid search results to items format
                    const messageItems = (hybridResults.messages || []).map((m) => ({
                      text: m.content?.slice(0, 200) || '',
                      score: m.score || 0,
                      timestamp: m.created_at,
                      session: m.session_id,
                      source: m.source || 'hybrid',
                    }));

                    const factItems = (hybridResults.facts || []).map((f) => ({
                      text: `${f.key}: ${f.value}`,
                      score: f.score || 0,
                      category: f.category,
                      source: 'fact-hybrid',
                    }));

                    // Merge and sort all items
                    items = [...items, ...messageItems, ...factItems]
                      .filter(Boolean)
                      .sort((a, b) => (b.score || 0) - (a.score || 0))
                      .slice(0, limit);

                    if (memoryDebugEnabled) {
                      logger.info('[Semantic][Hybrid] pre-fetched results', {
                        total: items.length,
                        sources: items.reduce((acc, it) => {
                          acc[it.source] = (acc[it.source] || 0) + 1;
                          return acc;
                        }, {}),
                      });
                    }
                  }

                  // Fallback to keyword-based search if hybrid disabled or failed
                  if (!useHybridSearch || items.length === 0) {
                    const sessions = await getAllSessions();
                    console.log(
                      `[Semantic] Using keyword search on ${sessions.length} local sessions`
                    );
                    const matches = [];
                    sessions.forEach((session) => {
                      (session.messages || []).forEach((msg) => {
                        if (!msg?.content) return;
                        const contentNorm = normalize(msg.content);
                        const hits = queryTerms.filter((k) => contentNorm.includes(k));
                        if (hits.length > 0) {
                          const score = hits.length / Math.max(queryTerms.length, 1);
                          if (score >= threshold) {
                            matches.push({
                              text: msg.content.slice(0, 200),
                              score,
                              timestamp: msg.timestamp || session.started_at,
                              session: session.sessionId,
                              source: 'keyword-fallback',
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
                    logger.info('[Semantic][Local] top', items.slice(0, 5));
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
                  const txt = (it.text || it.content || it.snippet || '')
                    .toLowerCase()
                    .slice(0, 50);
                  if (seen.has(txt)) return false;
                  seen.add(txt);
                  return true;
                });

                // If >3 items, summarize to 2-3 bullets
                let lines;
                const hasHybridResults = items.some(
                  (it) => it.source && it.source.includes('hybrid')
                );

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
                      const sourceBadge = memoryDebugEnabled && it.source ? ` [${it.source}]` : '';
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
                  source: it.source || 'unknown',
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
            facts: (packToUse.facts || []).map((f) => ({
              category: f.category,
              key: f.key,
              value: f.value,
              confidence: f.confidence,
              pinned: !!f.pinned,
            })),
            semantic_hits: (packToUse.semantic_hits || []).map((h) => ({
              snippet: h.snippet,
              score: h.score,
            })),
            recent_messages: (packToUse.recent_messages || []).map((m) => ({
              role: m.role,
              content: m.content,
            })),
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
              userContext.facts[cat][f.key] = {
                value: f.value,
                confidence: f.confidence,
                pinned: !!f.pinned,
              };
            }

            // 2) Merge recent messages (cap at 10, dedup by role+content)
            const packMsgs = userContext.memory_pack.recent_messages || [];
            if (Array.isArray(packMsgs) && packMsgs.length) {
              const existing = Array.isArray(userContext.recent_messages)
                ? userContext.recent_messages
                : [];
              const merged = [...existing, ...packMsgs].filter(Boolean);
              const seen = new Set();
              userContext.recent_messages = merged
                .filter((m) => {
                  const key = `${m.role}:${(m.content || '').slice(0, 120)}`;
                  if (seen.has(key)) return false;
                  seen.add(key);
                  return true;
                })
                .slice(-10);
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
              const hasSchool = !!userContext.facts?.education?.school;
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
                    if (m && m[1]) {
                      school = m[1].trim();
                      break;
                    }
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
          dispatchExecution({ type: 'SET_METADATA', metadata: null });
          dispatchExecution({ type: 'SET_STATS', clarifyStats: null, confirmStats: null });
        }
      } catch (e) {
        console.warn('[Memory] Failed to attach memory_pack', e);
      } finally {
        if (packToUse) {
          setShowContextPreview(false);
          setContextPack(null);
        }
      }

      // Execute using pull-based OR streaming approach
      const currentMode = permissionModeRef.current || validatedPermissionMode;
      const isAutonomous = currentMode === 'autonomous';

      if (usePullExecution && isAutonomous) {
        // NEW: Pull-based execution
        console.log('[FloatBar] Using PULL execution (Phase 2)', { hasUserImage: !!screenshotData });

        try {
          const pullService = new PullAutonomousService();
          // Pass user-attached image (from drag-drop) to the executor
          // This will take priority over auto-captured screenshots
          const runTracker = await pullService.execute(text, userContext, screenshotData);

          // NEW: Handle direct responses (questions, conversations, clarifications)
          // These don't require tool execution - the AI answered directly
          if (runTracker.isDirectResponse) {
            console.log('[FloatBar] Direct response received:', {
              type: runTracker.type,
              responsePreview: runTracker.response?.substring(0, 100),
            });

            // Display the response as an assistant message
            setIsThinking(false);
            setThinkingStatus('');

            // Clear any old live activity steps (from previous executions)
            setLiveActivitySteps([]);
            setInitialAIMessage(null);
            initialAIMessageSetRef.current = false;

            // Add the AI's response to thoughts with typewriter animation
            const directMsgTimestamp = Date.now();
            animatedMessagesRef.current.add(directMsgTimestamp);
            setThoughts((prev) => [
              ...prev,
              {
                role: 'assistant',
                content: runTracker.response,
                type: runTracker.type, // 'question', 'conversation', or 'clarify'
                timestamp: directMsgTimestamp,
              },
            ]);

            return; // Done - no need to poll or track execution
          }

          // Store run ID for polling (only for tasks)
          dispatchExecution({ type: 'SET_ACTIVE_RUN', runId: runTracker.runId });

          // NEW: Check if intent confirmation is required
          if (runTracker.requiresConfirmation && runTracker.intentConfirmation) {
            console.log('[FloatBar] Intent confirmation required:', {
              runId: runTracker.runId,
              intent: runTracker.intentConfirmation.detected_intent,
            });

            // Store the tracker and service for later use
            pullServiceRef.current = pullService;
            setPendingRunTracker(runTracker);
            setPendingIntentData(runTracker.intentConfirmation);
            setIntentConfirmationOpen(true);

            // Show thinking status while waiting for confirmation
            setThinkingStatus('Waiting for confirmation...');

            return; // Don't proceed until user confirms
          }

          // NEW: Handle iterative execution (new style - no upfront plan)
          if (runTracker.intent && !runTracker.plan) {
            console.log('[FloatBar] Iterative execution started:', {
              runId: runTracker.runId,
              intent: runTracker.intent,
            });

            // Intent is now shown in the task list (LiveActivityFeed)
            // so we don't need to add it as a separate assistant message

            setThinkingStatus('Working...');

            // Initialize activity feed with the intent
            clearActivityLog();
            addActivity(runTracker.intent || 'Starting task...');

            // Clear live activity feed for new task
            setLiveActivitySteps([]);
            setInitialAIMessage(null);
            initialAIMessageSetRef.current = false; // Reset the ref for new task

            // Start polling for updates - iterative execution will provide status_summary
            pullService.pollRunStatus(runTracker.runId, (status) => {
              console.log('[FloatBar] Iterative status update:', status);
              console.log('[FloatBar] Status keys:', Object.keys(status));
              console.log('[FloatBar] Has final_summary:', !!status.final_summary);
              console.log('[FloatBar] Has final_response:', !!status.final_response);

              // Capture initial message on first action (if present)
              // Use ref to avoid stale closure issue with initialAIMessage state
              if (status.initial_message && !initialAIMessageSetRef.current) {
                setInitialAIMessage(status.initial_message);
                initialAIMessageSetRef.current = true;
              }

              // Update activity feed with current status
              // Use current_status_summary, or fall back to action description
              // Avoid showing "Working on step X" as it's not user-friendly
              const currentSummary =
                status.current_status_summary ||
                status.action?.status_summary ||
                status.action?.description ||
                null; // Let the fallback "Getting started..." handle initial state

              // Check for 'running' or 'executing' (desktop state uses 'executing')
              const isRunning = status.status === 'running' || status.status === 'executing';

              // Update LiveActivityFeed using functional update to avoid stale closure issues
              const stepId = `poll-step-${status.currentStep ?? status.currentStepIndex ?? 'current'}`;
              setLiveActivitySteps((prev) => {
                // Get the last step's description to compare (avoids stale closure)
                const lastStep = prev.length > 0 ? prev[prev.length - 1] : null;
                const lastDescription = lastStep?.description;

                if (currentSummary && isRunning) {
                  // Check if this is a new/different activity
                  if (currentSummary !== lastDescription) {
                    // Check if this step already exists
                    const existingIndex = prev.findIndex((s) => s.id === stepId);
                    if (existingIndex >= 0) {
                      // Update existing step description
                      const updated = [...prev];
                      updated[existingIndex] = {
                        ...updated[existingIndex],
                        description: currentSummary,
                      };
                      return updated;
                    } else {
                      // Mark previous running steps as completed, then add new
                      const updated = prev.map((s) =>
                        s.status === 'running' ? { ...s, status: 'completed' } : s
                      );
                      return [
                        ...updated,
                        {
                          id: stepId,
                          status: 'running',
                          description: currentSummary,
                          technicalDetails: '',
                          timestamp: Date.now(),
                        },
                      ];
                    }
                  }
                } else if (isRunning && prev.length === 0) {
                  // If no summary but we're running and no steps yet, add a generic step
                  return [
                    {
                      id: `poll-step-initial`,
                      status: 'running',
                      description: 'Getting started...',
                      technicalDetails: '',
                      timestamp: Date.now(),
                    },
                  ];
                }
                return prev; // No change
              });

              // Also update thinkingStatus for ActivityFeed (legacy)
              if (currentSummary && currentSummary !== thinkingStatus) {
                completeCurrentActivity();
                addActivity(currentSummary);
                setThinkingStatus(currentSummary);
              }

              if (status.status === 'complete' || status.status === 'done') {
                completeCurrentActivity(); // Mark last activity as done
                clearActivityLog(); // Clear for next task
                setIsThinking(false);
                setThinkingStatus('');

                // Mark all running steps as completed in LiveActivityFeed
                setLiveActivitySteps((prev) =>
                  prev.map((s) => (s.status === 'running' ? { ...s, status: 'completed' } : s))
                );

                // Add final summary as message (check both final_summary and final_response)
                const finalMessage = status.final_summary || status.final_response;
                console.log(
                  '[FloatBar] Final message to display:',
                  finalMessage?.substring(0, 100)
                );

                if (finalMessage) {
                  const msgTimestamp = Date.now();
                  // Mark this message for typewriter animation
                  animatedMessagesRef.current.add(msgTimestamp);
                  setThoughts((prev) => [
                    ...prev,
                    {
                      role: 'assistant',
                      content: finalMessage,
                      type: 'completion',
                      timestamp: msgTimestamp,
                    },
                  ]);
                } else {
                  console.warn('[FloatBar] No final message found in status!');
                }

                toast.success('Task completed', { duration: 3000 });
              } else if (status.status === 'failed' || status.status === 'error') {
                setIsThinking(false);
                setThinkingStatus('');

                // Mark last running step as failed in LiveActivityFeed
                setLiveActivitySteps((prev) =>
                  prev.map((s, i) =>
                    s.status === 'running'
                      ? { ...s, status: 'failed', error: status.error || 'Task failed' }
                      : s
                  )
                );

                toast.error('Task failed', { duration: 4000 });
              }
            });

            return; // Don't fall through to old plan-based display
          }

          // Display the AI-generated plan (old style - for backwards compatibility)
          if (runTracker.plan && runTracker.steps) {
            console.log('[FloatBar] Plan received:', {
              steps: runTracker.steps.length,
              goal: runTracker.goalSummary,
            });

            // Initialize all steps as pending
            const initialStatuses = {};
            runTracker.steps.forEach((_, i) => {
              initialStatuses[i] = 'pending';
            });

            // Atomic execution state update
            dispatchExecution({
              type: 'START_EXECUTION',
              plan: {
                steps: runTracker.steps.map((step, i) => ({
                  id: step.step_id || `step-${i + 1}`,
                  description: step.description,
                  goal: step.goal,
                  tool_name: step.tool_name,
                })),
                goal: runTracker.goalSummary,
                definition_of_done: runTracker.definitionOfDone,
              },
              totalSteps: runTracker.totalSteps,
              stepStatuses: initialStatuses,
            });
            setPlanCardDismissed(false);

            // Do not render a separate "Execution Plan" message; rely on ExecutionProgress + final summary.
            setThinkingStatus('Executing locally...');
            toast.success(`Plan generated: ${runTracker.totalSteps} steps`, { duration: 3000 });

            // Start polling for progress
            pullService.pollRunStatus(runTracker.runId, (status) => {
              console.log('[FloatBar] Status update:', status);

              // Check for 'running' or 'executing' (desktop state uses 'executing')
              const isRunning = status.status === 'running' || status.status === 'executing';

              // Update activity feed with current status
              if (status.current_status_summary && isRunning) {
                const currentSummary = status.current_status_summary;
                completeCurrentActivity();
                addActivity(currentSummary);
                setThinkingStatus(currentSummary);
              }

              // Update current step
              if (status.currentStep !== undefined) {
                // Mark previous steps as done, current step as running
                dispatchExecution({
                  type: 'SET_STEP_STATUSES',
                  updater: (prev) => {
                    const updated = { ...prev };
                    for (let i = 0; i < status.currentStep; i++) {
                      if (updated[i] === 'running' || updated[i] === 'pending') {
                        updated[i] = 'done';
                      }
                    }
                    // Mark current step as running
                    if (isRunning && updated[status.currentStep] !== 'failed') {
                      updated[status.currentStep] = 'running';
                    }
                    return updated;
                  },
                });
                dispatchExecution({ type: 'STEP_UPDATE', currentStep: status.currentStep });
              }

              // Handle completion
              if (status.status === 'complete' || status.status === 'failed') {
                setIsThinking(false);
                setThinkingStatus('');

                // Calculate summary values
                const totalStepsCount = runTracker.totalSteps || runTracker.steps?.length || 0;

                // Calculate final step statuses and summary atomically
                dispatchExecution({
                  type: 'SET_STEP_STATUSES',
                  updater: (prev) => {
                    const updated = { ...prev };
                    Object.keys(updated).forEach((key) => {
                      if (updated[key] !== 'failed') {
                        updated[key] = status.status === 'complete' ? 'done' : 'failed';
                      }
                    });
                    return updated;
                  },
                });

                // Calculate counts from current state (will be consistent due to batching)
                const successCount = Object.values(stepStatuses).filter((s) => s === 'done' || (status.status === 'complete' && s !== 'failed')).length;
                const failedCount = Object.values(stepStatuses).filter((s) => s === 'failed' || (status.status === 'failed' && s !== 'done')).length;

                // Determine message based on status
                let summaryMessage, thoughtsContent, toastMessage;
                if (status.status === 'complete') {
                  summaryMessage = `✅ Successfully completed all ${totalStepsCount} steps`;
                  thoughtsContent = `**Execution Complete!**\n\nSuccessfully completed all ${totalStepsCount} steps.\n\n${runTracker.definitionOfDone}`;
                  toastMessage = '✅ Execution complete!';
                } else if (status.status === 'cancelled') {
                  summaryMessage = `⏹ Execution stopped by user after ${successCount} steps`;
                  thoughtsContent = `**Execution Stopped**\n\nYou manually stopped the execution after completing ${successCount} of ${totalStepsCount} steps.`;
                  toastMessage = '⏹ Execution stopped';
                } else {
                  summaryMessage = `❌ Execution failed`;
                  thoughtsContent = `❌ **Execution Failed**\n\nExecution encountered an error.`;
                  toastMessage = '❌ Execution failed';
                }

                dispatchExecution({
                  type: 'EXECUTION_COMPLETE',
                  summary: {
                    status: status.status,
                    totalSteps: totalStepsCount,
                    successCount: status.status === 'complete' ? totalStepsCount : successCount,
                    failedCount: status.status === 'failed' ? totalStepsCount - successCount : failedCount,
                    cancelledCount: status.status === 'cancelled' ? 1 : 0,
                    goalAchieved: status.status === 'complete',
                    message: summaryMessage,
                  },
                });

                // Add summary to thoughts
                setThoughts((prev) => [
                  ...prev,
                  {
                    role: 'assistant',
                    content: thoughtsContent,
                    timestamp: Date.now(),
                    metadata: { summary: true },
                  },
                ]);

                toast(toastMessage, {
                  duration: 4000,
                });
              }
            });
          }
        } catch (error) {
          console.error('[FloatBar] Pull execution failed:', error);

          // Show error in toast
          toast.error(`❌ ${error.message}`, { duration: 6000 });

          // Display error in UI
          setIsThinking(false);
          setThinkingStatus('');

          // Show error state in execution panel (atomic update)
          dispatchExecution({
            type: 'SET_ERROR_PLAN',
            plan: {
              steps: [
                {
                  id: 'error-step',
                  description: 'Planning failed',
                  goal: error.message,
                  tool_name: 'error',
                },
              ],
              goal: text,
              definition_of_done: 'Fix the error and try again',
            },
            summary: {
              status: 'failed',
              totalSteps: 0,
              successCount: 0,
              failedCount: 1,
              goalAchieved: false,
              message: `❌ Planning failed: ${error.message}`,
            },
          });
          setPlanCardDismissed(false);

          // Add error to thoughts
          setThoughts((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: `❌ **Planning Failed**\n\n${error.message}\n\nPlease try again with a simpler request or break your task into smaller steps.`,
              timestamp: Date.now(),
              metadata: { error: true },
            },
          ]);
        }
      } else {
        // OLD: SSE streaming execution
        console.log('[FloatBar] Using SSE streaming execution (legacy)');
        sendChat(text, userContext, screenshotData);
      }
    },
    [thoughts, contextPack, permissionLevel, usePullExecution, sendChat]
  );

  // Keep dispatcher ref in sync
  useEffect(() => {
    continueSendMessageRef.current = continueSendMessage;
  }, [continueSendMessage]);

  // Memory Toast handlers
  const handleMemoryApply = useCallback(
    async (confirmedIds) => {
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
    },
    [memoryProposals]
  );

  const handleMemoryDismiss = useCallback(() => {
    setShowMemoryToast(false);
  }, []);

  // (moved above)

  const handleSubmit = useCallback(
    async (e) => {
      e?.preventDefault();
      const text = message.trim();
      const hasAttachments = attachments.length > 0;
      if ((!text && !hasAttachments) || isThinking || !apiConnected) return;
      const outboundText = text || (hasAttachments ? ' ' : '');

      // ==========================================
      // OPTIMISTIC UI: Add message IMMEDIATELY for instant feedback
      // Rollback if any blocking check fails
      // ==========================================
      addOptimisticMessage(text, attachments);

      // Clear attachments and input immediately for smooth UX
      setAttachments([]);
      setMessage('');

      // Clear previous run's steps immediately to avoid showing stale steps
      setLiveActivitySteps([]);

      const userId = localStorage.getItem('user_id');

      // CREDIT GATE: Check if user has credits before allowing any message
      if (userId) {
        try {
          setThinkingStatus('Checking credits...');
          const { data: userData, error } = await supabase
            .from('users')
            .select('credits, subscription_tier')
            .eq('id', userId)
            .single();

          if (!error && userData) {
            const currentCredits = userData?.credits || 0;
            if (currentCredits <= 0) {
              // Rollback optimistic message and show error
              rollbackOptimisticMessage(text);
              toast.error('No credits remaining! Please purchase more to continue.');
              const openSettings =
                window.electron?.openSettings || window.electronAPI?.openSettings;
              if (openSettings) {
                await openSettings({ route: '#/settings?section=credits' });
              }
              return; // Block the message
            }
          }
        } catch (err) {
          console.warn('[CreditGate] Failed to check credits:', err);
          // Don't block on error - let backend handle it
        }
      }

      // GOOGLE PRE-FLIGHT CHECK: Warn user if asking about Gmail/Calendar without Google connected
      // This provides immediate feedback instead of waiting for AI to respond with an error
      const googleCheck = checkGoogleServiceQuery(outboundText);
      if (googleCheck.needsGoogle && !googleCheck.isConnected) {
        logger.info(
          `[GoogleCheck] User asking about ${googleCheck.service} but Google not connected`
        );
        // Don't block - just show a helpful toast and let the AI handle it gracefully
        toast(
          (t) => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span>
                <strong>Google not connected</strong>
              </span>
              <span style={{ fontSize: '13px', opacity: 0.9 }}>
                To access your {googleCheck.service}, connect your Google account in Settings.
              </span>
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  const openSettings =
                    window.electron?.openSettings || window.electronAPI?.openSettings;
                  if (openSettings) {
                    openSettings({ route: '#/settings?section=google' });
                  }
                }}
                style={{
                  background: 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  marginTop: '4px',
                }}
              >
                Connect Google
              </button>
            </div>
          ),
          {
            duration: 8000,
            icon: '📧',
            style: {
              background: 'rgba(30, 30, 30, 0.95)',
              color: 'white',
              borderRadius: '12px',
              padding: '16px',
            },
          }
        );
        // Continue anyway - let AI respond with guidance
      } else if (googleCheck.needsGoogle && googleCheck.isConnected) {
        logger.info(
          `[GoogleCheck] User asking about ${googleCheck.service}, Google connected as ${googleCheck.googleEmail}`
        );
      }

      // Email approval is now handled by the AI's ask_user tool
      // The AI will compose the draft, show it to user, and ask for confirmation before sending

      // Cache check (cheap local operation)
      setThinkingStatus('Checking cache...');
      try {
        const cached = await checkResponseCache(text);
        if (cached) {
          // Cache hit! Add the cached response (user message already visible)
          setThoughts((prev) => [
            ...prev,
            { role: 'assistant', content: cached.response, timestamp: Date.now(), cached: true },
          ]);
          setIsThinking(false);
          setThinkingStatus('');
          pendingOptimisticMsgRef.current = null; // Clear tracking
          toast.success('Answer from cache (no credit used)', { icon: '💰' });
          logger.info('Used cached response, no credit deducted');
          if (userId) {
            await supabase.from('telemetry_events').insert({
              user_id: userId,
              event_type: 'cache_hit',
              metadata: { cached_response: true, no_credit_charge: true },
            });
          }
          return;
        }
      } catch (err) {
        logger.warn('Cache check failed', err);
      }

      // Safety check based on permission level
      setThinkingStatus('Checking permissions...');
      try {
        const currentMode = permissionModeRef.current || validatedPermissionMode;
        const res = await permissionAPI.check(text, { permission_level: currentMode });
        const data = res.data || res;
        if (!data.allowed) {
          // Not allowed - rollback and show error
          rollbackOptimisticMessage(text);
          toast.error(data.reason || 'Operation not allowed at current permission level');
          return;
        }
        if (data.requires_approval) {
          // In autonomous mode, auto-approve ALL actions (user explicitly chose this mode)
          const currentMode = permissionModeRef.current;
          const isAutoMode = currentMode === 'autonomous';

          if (isAutoMode) {
            // Auto-approve in autonomous mode - user trusts the AI
            logger.info('[Safety] Auto-approving in autonomous mode', { markers: data.markers });
            try {
              await permissionAPI.logActivity({
                action: text,
                required_approval: false, // Auto-approved due to autonomous mode
                approved: true,
                markers: [...(data.markers || []), 'auto_approved_autonomous_mode'],
                is_high_risk: !!data.is_high_risk,
              });
            } catch {}
            commitOptimisticMessage();
            await continueAfterPreview(text, true); // messageAlreadyAdded = true
            return;
          }

          // Auto-approve PII-only self queries if enabled
          try {
            const markersSet = new Set(data.markers || []);
            const piiMarkers = new Set([
              'pii',
              'high_risk_context',
              'location',
              'address',
              'geo',
              'coordinates',
              'name',
              'email',
              'phone',
              'dob',
              'ssn',
              'profile',
              'contact',
            ]);
            const actionMarkers = new Set([
              'email',
              'communication',
              'network',
              'http',
              'web',
              'browser',
              'filesystem',
              'file',
              'process',
              'shell',
              'exec',
              'payment',
              'purchase',
              'sms',
              'call',
              'external',
              'upload',
              'download',
            ]);
            const hasAction = [...markersSet].some((m) => actionMarkers.has(m));
            const isPIIOnly =
              [...markersSet].length > 0 && [...markersSet].every((m) => piiMarkers.has(m));
            if (safetyDisablePII && isPIIOnly && !hasAction) {
              try {
                await permissionAPI.logActivity({
                  action: text,
                  required_approval: false,
                  approved: true,
                  markers: [...markersSet, 'auto_approved_pii_only'],
                  is_high_risk: false,
                });
              } catch {}
              commitOptimisticMessage();
              await continueAfterPreview(text, true); // messageAlreadyAdded = true
              return;
            }
          } catch {}

          // Check if this is an email operation and user opted out
          const isEmail =
            data.markers?.includes('email') || data.markers?.includes('communication');
          const skipEmailApproval =
            isEmail && localStorage.getItem('approval_skip_email_send') === 'true';

          if (skipEmailApproval) {
            // Skip approval - user previously opted out
            try {
              await permissionAPI.logActivity({
                action: text,
                required_approval: false, // Auto-approved
                approved: true,
                markers: [...(data.markers || []), 'auto_approved'],
                is_high_risk: !!data.is_high_risk,
              });
            } catch {}
            commitOptimisticMessage();
            await continueAfterPreview(text, true); // messageAlreadyAdded = true
            return;
          }

          // Show approval dialog - message stays visible
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
                  is_high_risk: !!data.is_high_risk,
                });
              } catch {}
              commitOptimisticMessage();
              await continueAfterPreview(text, true); // messageAlreadyAdded = true
            },
            onReject: () => {
              // User closed dialog without approving - rollback the message
              rollbackOptimisticMessage(text);
            },
          });
          setApprovalOpen(true);
          return;
        }
      } catch (err) {
        logger.warn('Safety check failed; proceeding cautiously', err);
      }

      // All checks passed → commit and continue
      commitOptimisticMessage();
      await continueAfterPreview(outboundText, true); // messageAlreadyAdded = true
    },
    [
      message,
      isThinking,
      apiConnected,
      addOptimisticMessage,
      rollbackOptimisticMessage,
      commitOptimisticMessage,
      continueAfterPreview,
      safetyDisablePII,
    ]
  );

  // Handle clear conversation
  const handleClear = useCallback(() => {
    // Clear chat transcript and tiles
    setThoughts([]);
    setFactTiles([]);
    enrichTileIdRef.current = null;
    clearMessages();

    // Clear multi-step execution state so progress UI resets (atomic)
    dispatchExecution({ type: 'RESET' });
    setExecutionDetails(null);
    setRunExecLogs([]);
    setArtifactSummary(null);
    planIdRef.current = null;

    // FIX: Generate new session_id for conversation isolation
    const newSessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem('session_id', newSessionId);
    logger.info('[Session] Generated new session_id for new conversation', { sessionId: newSessionId });

    // Start new session in memory manager
    if (localStorage.getItem('user_id')) {
      startSession()
        .then(() => {
          console.log('[Session] New session started after clear');
          toast.success('New conversation started');
        })
        .catch((err) => {
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

  // Handle launching Max's Monitor workspace for user to pre-navigate
  const handleLaunchWorkspace = useCallback(async () => {
    try {
      // Check if workspace is already active
      const status = await window.workspace?.getStatus?.();
      if (status?.active) {
        // Already active - just notify user
        toast.success("Max's Monitor is already open!");
        return;
      }

      // Launch the workspace
      const result = await window.workspace?.create?.();
      if (result?.success) {
        setWorkspaceActive(true);
        toast.success("Max's Monitor launched! Navigate to where you want Max to work, then ask Max to help.");
      } else {
        toast.error("Failed to launch Max's Monitor");
      }
    } catch (err) {
      console.error('[Workspace] Launch error:', err);
      toast.error("Failed to launch Max's Monitor");
    }
  }, []);

  // Check workspace status periodically
  useEffect(() => {
    const checkWorkspace = async () => {
      try {
        const status = await window.workspace?.getStatus?.();
        setWorkspaceActive(status?.active ?? false);
      } catch {
        setWorkspaceActive(false);
      }
    };
    checkWorkspace();
    const interval = setInterval(checkWorkspace, 2000);
    return () => clearInterval(interval);
  }, []);

  // Check spreadsheet status periodically
  useEffect(() => {
    const checkSpreadsheet = async () => {
      try {
        const status = await window.spreadsheet?.getStatus?.();
        setSpreadsheetActive(status?.active ?? false);
      } catch {
        setSpreadsheetActive(false);
      }
    };
    checkSpreadsheet();
    const interval = setInterval(checkSpreadsheet, 2000);
    return () => clearInterval(interval);
  }, []);

  // Handle launching spreadsheet
  const handleLaunchSpreadsheet = useCallback(async () => {
    try {
      // Check if spreadsheet is already active
      const status = await window.spreadsheet?.getStatus?.();
      if (status?.active) {
        toast.success("Max's Spreadsheet is already open!");
        setMonitorMenuOpen(false);
        return;
      }

      // Launch the spreadsheet
      const result = await window.spreadsheet?.create?.();
      if (result?.success) {
        setSpreadsheetActive(true);
        toast.success("Max's Spreadsheet launched! Ask Max to help with your data.");
        setMonitorMenuOpen(false);
      } else {
        toast.error("Failed to launch Max's Spreadsheet");
      }
    } catch (err) {
      console.error('[Spreadsheet] Launch error:', err);
      toast.error("Failed to launch Max's Spreadsheet");
    }
  }, []);

  // Check notes status periodically
  useEffect(() => {
    const checkNotes = async () => {
      try {
        const status = await window.notes?.getStatus?.();
        setNotesActive(status?.active ?? false);
      } catch {
        setNotesActive(false);
      }
    };
    checkNotes();
    const interval = setInterval(checkNotes, 2000);
    return () => clearInterval(interval);
  }, []);

  // Handle launching notes
  const handleLaunchNotes = useCallback(async () => {
    try {
      // Check if notes is already active
      const status = await window.notes?.getStatus?.();
      if (status?.active) {
        toast.success("Max's Notes is already open!");
        setMonitorMenuOpen(false);
        return;
      }

      // Launch the notes app
      const result = await window.notes?.create?.();
      if (result?.success) {
        setNotesActive(true);
        toast.success("Max's Notes launched! Your AI-powered knowledge base is ready.");
        setMonitorMenuOpen(false);
      } else {
        toast.error("Failed to launch Max's Notes");
      }
    } catch (err) {
      console.error('[Notes] Launch error:', err);
      toast.error("Failed to launch Max's Notes");
    }
  }, []);

  // Toggle monitor tools overlay
  const handleMonitorMenu = useCallback(() => {
    setMonitorMenuOpen((prev) => !prev);
  }, []);

  // Animate monitor menu open/close
  useEffect(() => {
    if (monitorMenuOpen) {
      const id = requestAnimationFrame(() => setMonitorMenuReady(true));
      return () => cancelAnimationFrame(id);
    } else {
      setMonitorMenuReady(false);
    }
  }, [monitorMenuOpen]);

  // Click outside to close monitor menu
  useEffect(() => {
    if (!monitorMenuOpen) return;
    const onDown = (e) => {
      if (monitorMenuRef.current?.contains(e.target) || monitorBtnRef.current?.contains(e.target)) return;
      setMonitorMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [monitorMenuOpen]);

  // Handle launching workspace from menu
  const handleLaunchWorkspaceFromMenu = useCallback(async () => {
    setMonitorMenuOpen(false);
    await handleLaunchWorkspace();
  }, [handleLaunchWorkspace]);

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
  const handleSelectLevel = useCallback(
    async (level) => {
      const resolvedMode = validateModeValue(level);
      // Display label only - internal value stays 'autonomous'
      const label = resolvedMode === 'autonomous' ? 'Auto' : 'Chatty';
      try {
        await updateLevel(resolvedMode);
        toast.success(`Permission level set to ${label}`);
        try {
          // Persist selection so API client can fall back if userContext not present
          localStorage.setItem('permission_level', resolvedMode);
        } catch {}
      } catch (e) {
        toast.error('Failed to update permission level');
      } finally {
        setToolMenuOpen(false);
      }
    },
    [updateLevel]
  );

  // Dynamically resize window based on content (no arbitrary caps)
  const updateWindowHeight = useCallback(() => {
    if (!barRef.current || isMiniRef.current) return;
    if (approvalOpen) return;

    if (resizeDebounceRef.current) {
      clearTimeout(resizeDebounceRef.current);
    }

    resizeDebounceRef.current = setTimeout(async () => {
      if (isMiniRef.current) return;

      // Measure actual content height from the glass element's children
      const containerEl = barRef.current;
      const glassEl = containerEl?.querySelector?.('.apple-bar-glass');
      if (!glassEl) return;

      // Get all heights from the DOM
      const dragStrip = containerEl?.querySelector?.('.apple-drag-strip')?.offsetHeight || 6;
      const th = toolbarRef.current?.offsetHeight || 0;
      const fh = tilesRef.current?.offsetHeight || 0;
      const mhEl = messagesRef.current;
      // Cap messages height at 360px (the CSS max-height) so window isn't sized
      // for content that will be scrolled anyway
      const MESSAGES_MAX_HEIGHT = 360;
      const mhScroll = mhEl?.scrollHeight || 0;
      const mh = Math.min(mhScroll, MESSAGES_MAX_HEIGHT);
      const ah = containerEl?.querySelector?.('.attachment-preview-row')?.offsetHeight || 0;
      // Cap input area height so large text input doesn't push toolbar out of view
      const INPUT_MAX_HEIGHT = 140;
      const ihRaw = composerRef.current?.offsetHeight || 0;
      const ih = Math.min(ihRaw, INPUT_MAX_HEIGHT);

      // Get glass padding
      const style = getComputedStyle(glassEl);
      const padTop = parseInt(style.paddingTop || '0', 10);
      const padBottom = parseInt(style.paddingBottom || '0', 10);

      // Get container border
      const containerStyle = getComputedStyle(containerEl);
      const borderTop = parseInt(containerStyle.borderTopWidth || '0', 10);
      const borderBottom = parseInt(containerStyle.borderBottomWidth || '0', 10);

      // Gap between elements (from CSS gap: 4px on .apple-bar-glass)
      const glassGap = parseInt(style.gap || '4', 10);
      // Count the gaps: dragStrip, toolbar, messages, [attachment], input = 4-5 gaps
      const numGaps = ah > 0 ? 5 : 4;
      const totalGaps = glassGap * numGaps;

      // Sum everything
      const naturalHeight =
        borderTop +
        padTop +
        dragStrip +
        th +
        fh +
        mh +
        ah +
        ih +
        padBottom +
        borderBottom +
        totalGaps;

      // Add a small buffer and step the window by roughly one line when content grows
      const prevMh = lastMessagesHeightRef.current || 0;
      const incrementalBuffer = mh > prevMh ? LINE_GROWTH : 0;
      lastMessagesHeightRef.current = mh;

      const bufferedHeight = naturalHeight + incrementalBuffer + 8;

      const minHeight = MIN_EXPANDED_HEIGHT;

      const hasAttachments = ah > 0;

      // If this is the true empty state (no messages, no thinking, no
      // attachments, no fact tiles), keep the expanded window at the
      // compact base height so the composer isn't pushed far down.
      const isEmptySurface =
        thoughts.length === 0 &&
        !isThinking &&
        !hasAttachments &&
        (!factTiles || factTiles.length === 0);

      if (isEmptySurface) {
        // Fixed height for empty state - keep at 180px
        // The input area will scroll internally if user types a lot of text
        const targetEmptyHeight = 180;

        if (window.electron?.resizeWindow && lastHeightRef.current !== targetEmptyHeight) {
          try {
            await window.electron.resizeWindow(360, targetEmptyHeight);
            lastHeightRef.current = targetEmptyHeight;
          } catch {}
        }
        naturalHeightRef.current = naturalHeight;
        return;
      }

      // Debug logging to understand height calculation
      console.log('[FloatBar Height]', {
        dragStrip,
        toolbar: th,
        factTiles: fh,
        messages: mh,
        attachments: ah,
        input: ih,
        padTop,
        padBottom,
        borderTop,
        borderBottom,
        totalGaps,
        naturalHeight,
        bufferedHeight,
      });

      // Limit by available screen height (minus margin for dock/menubar)
      let screenLimit = MAX_EXPANDED_HEIGHT;
      try {
        const screenSize = await window.electron?.getScreenSize?.();
        if (screenSize?.height) {
          // Use 85% of screen height or screen minus 150px, capped by the hard max
          const dynamicCap = Math.max(
            MIN_EXPANDED_HEIGHT,
            Math.floor(screenSize.height * 0.85),
            screenSize.height - 150
          );
          screenLimit = Math.min(MAX_EXPANDED_HEIGHT, dynamicCap);
        }
      } catch {}

      // Check if there are Deep Dive messages - they need minimum height for summary + button
      const hasDeepDive = thoughts.some((t) => t.isDeepDive);
      const effectiveMinHeight = hasDeepDive ? Math.max(minHeight, 280) : minHeight;

      // Use bufferedHeight to ensure no clipping; cap by hard max height
      const targetHeight = Math.max(
        effectiveMinHeight,
        Math.min(screenLimit, bufferedHeight, MAX_EXPANDED_HEIGHT)
      );

      console.log('[FloatBar Height] Target:', targetHeight, 'Last:', lastHeightRef.current);

      // Only resize if height changed meaningfully
      const heightDelta = targetHeight - (lastHeightRef.current || 0);
      const shouldGrow = heightDelta > HEIGHT_CHANGE_THRESHOLD;
      const shouldShrink = heightDelta < -HEIGHT_CHANGE_THRESHOLD;

      if (shouldGrow || shouldShrink) {
        // Growing happens immediately, shrinking is delayed to prevent jumping
        const doResize = async () => {
          lastHeightRef.current = targetHeight;
          if (window.electron?.resizeWindow) {
            try {
              const bounds = await window.electron.getBounds?.();
              const width = bounds?.width || lastWidthRef.current || 360;
              if (bounds?.width) lastWidthRef.current = bounds.width;
              await window.electron.resizeWindow(width, targetHeight);
              try {
                localStorage.setItem('amx:floatbar:lastHeight', String(targetHeight));
              } catch {}
            } catch {}
          }
        };

        if (shouldGrow) {
          // Grow immediately, cancel any pending shrink
          if (shrinkTimeoutRef.current) clearTimeout(shrinkTimeoutRef.current);
          doResize();
        } else if (shouldShrink) {
          // Delay shrinking to prevent UI jumping during rapid content changes
          if (shrinkTimeoutRef.current) clearTimeout(shrinkTimeoutRef.current);
          shrinkTimeoutRef.current = setTimeout(doResize, HEIGHT_SHRINK_DELAY_MS);
        }
      }
      // Update baseline after any attempted resize
      naturalHeightRef.current = bufferedHeight;
    }, HEIGHT_DEBOUNCE_MS);
  }, [isMini, approvalOpen, thoughts, isThinking, factTiles]);

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
          lastWidthRef.current = 360;
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

  // Bump window height slightly when attachments are present so the
  // attachment preview row has room without hiding the composer controls.
  useEffect(() => {
    updateWindowHeight();
  }, [attachments.length, updateWindowHeight]);

  // Recalculate when the composer itself grows/shrinks (multi-line input)
  useEffect(() => {
    const el = composerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => updateWindowHeight());
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateWindowHeight]);

  // Recalculate when messages mutate (streaming, images load) even if state isn't replaced
  useEffect(() => {
    const el = messagesRef.current;
    if (!el || typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(() => updateWindowHeight());
    observer.observe(el, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [updateWindowHeight]);


  // PERF: Memoize message-derived computations to avoid recalculating on every render
  // These are used for auto-scroll behavior and progress display

  // Last thought for scroll key generation
  const lastThought = useMemo(() => thoughts[thoughts.length - 1], [thoughts]);

  // Key for detecting when we need to scroll (content changes, streaming state, deep dive)
  const lastThoughtKey = useMemo(
    () =>
      lastThought
        ? `${lastThought.streaming}-${lastThought.isDeepDive || false}-${(lastThought.content || '').length}`
        : '',
    [lastThought]
  );

  // Index of last user message - for showing execution progress under the right message
  const lastUserMessageIdx = useMemo(
    () => thoughts.reduce((lastIdx, t, i) => (t.role === 'user' ? i : lastIdx), -1),
    [thoughts]
  );

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;

    // If user manually scrolled up, don't force auto-scroll
    if (userScrolledUp) return;

    if (thoughts.length === 0 && !isThinking) {
      // Empty-state: make sure the greeting is visible at the top
      el.scrollTop = 0;
      return;
    }

    // With messages or thinking indicator, stick to bottom
    // Small delay to ensure DOM has updated (especially for Deep Dive buttons)
    setTimeout(() => {
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }, [thoughts.length, isThinking, lastThoughtKey, userScrolledUp]);

  // Track manual scroll to allow user to scroll up without being yanked down
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollHeight - (el.scrollTop + el.clientHeight) < 8;
      setUserScrolledUp(!atBottom);
    };
    const onWheel = (e) => {
      el.scrollTop += e.deltaY;
      onScroll();
      e.preventDefault();
      e.stopPropagation();
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  // Touch handler to keep scroll events within the messages pane
  const handleMessagesTouchMove = useCallback((e) => {
    // Prevent ancestor scroll interference; allow native scrolling inside
    e.stopPropagation();
  }, []);

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
          if (!cancelled && !desktopBridgeStatus) {
            dispatchExecution({ type: 'SET_DESKTOP_BRIDGE_STATUS', status: { connected: false, enabled: false } });
          }
        } else {
          const status = await window.electron.handsOnDesktop.status();
          if (!cancelled) {
            dispatchExecution({ type: 'SET_DESKTOP_BRIDGE_STATUS', status: status || { connected: false, enabled: false } });
          }
        }
      } catch (err) {
        if (!cancelled) {
          dispatchExecution({ type: 'SET_DESKTOP_BRIDGE_STATUS', status: { connected: false, enabled: false, error: err?.message } });
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

  // PERF: Memoize connection status derivations
  const desktopBridgeConnected = useMemo(
    () => Boolean(desktopBridgeStatus?.connected),
    [desktopBridgeStatus?.connected]
  );
  const backendConnected = apiConnected;
  useEffect(() => {
    if (!desktopActionsRequired) {
      offlineDesktopToastRef.current = false;
      return;
    }
    if (!desktopBridgeConnected && !offlineDesktopToastRef.current) {
      offlineDesktopToastRef.current = true;
      const message =
        'Desktop helper is offline. Reopen the Agent Max desktop app so local steps can finish.';
      setThoughts((prev) => [
        ...prev,
        {
          role: 'system',
          content: `⚠️ ${message}`,
          timestamp: Date.now(),
          type: 'status',
        },
      ]);
      toast.error(message);
    } else if (desktopBridgeConnected) {
      offlineDesktopToastRef.current = false;
    }
  }, [desktopActionsRequired, desktopBridgeConnected, setThoughts]);

  // Listen for user input requests from executor
  useEffect(() => {
    if (!window.electron?.ipcRenderer) return;

    const handleUserInputRequest = (event, data) => {
      logger.info('[FloatBar] User input requested', data);

      // Show the prompt in the UI
      setUserInputRequest({
        requestId: data.requestId,
        prompt: data.prompt,
        defaultValue: data.defaultValue || '',
      });

      // Pre-fill with default if provided
      if (data.defaultValue) {
        setMessage(data.defaultValue);
      }

      // Add AI message showing the question
      setThoughts((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.prompt,
          timestamp: Date.now(),
          type: 'user_input_request',
        },
      ]);

      // Focus input
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    };

    window.electron.ipcRenderer.on('user-input-request', handleUserInputRequest);

    return () => {
      window.electron.ipcRenderer.removeListener('user-input-request', handleUserInputRequest);
    };
  }, []);

  // Track pending testing message for submission
  const pendingTestingMessageRef = useRef(null);

  // Listen for testing API messages (allows Claude to send messages programmatically)
  useEffect(() => {
    if (!window.testing?.onSendMessage) return;

    const handleTestingMessage = (data) => {
      logger.info('[FloatBar] Testing API message received', data);

      // Expand from mini if needed
      if (isMini) {
        setIsMini(false);
      }

      // Set the message
      if (data.message) {
        pendingTestingMessageRef.current = data.message;
        setMessage(data.message);
      }
    };

    window.testing.onSendMessage(handleTestingMessage);

    return () => {
      window.testing?.removeListeners?.();
    };
  }, [isMini]);

  // Effect to submit the testing message once it's set
  useEffect(() => {
    if (pendingTestingMessageRef.current && message === pendingTestingMessageRef.current) {
      // Clear the pending ref
      const msgToSubmit = pendingTestingMessageRef.current;
      pendingTestingMessageRef.current = null;

      // Focus input and submit after a brief delay
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
        logger.info('[FloatBar] Testing API auto-submitting message:', msgToSubmit);
        handleSubmit();
      }, 150);
    }
  }, [message, handleSubmit]);

  // Expose state globally for testing API to access
  useEffect(() => {
    window.__AGENT_MAX_STATE__ = {
      messages: thoughts,
      isThinking,
      runStatus,
      isMini,
      apiConnected,
      executionPlan: !!executionPlan,
      lastUpdated: Date.now()
    };
  }, [thoughts, isThinking, runStatus, isMini, apiConnected, executionPlan]);

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
        className="apple-floatbar-root mini"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div
          className={`amx-root amx-mini amx-mini-draggable ${isTransitioning ? 'amx-transitioning' : ''}`}
          onClick={handleExpand}
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
      </div>
    );
  }

  // Render expanded bar
  return (
    <div
      className={windowClasses}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="apple-bar-container" ref={barRef}>
        <div className="apple-bar-glass" style={{ position: 'relative' }}>
          {/* Drop Zone Overlay */}
          {isDraggingFile && (
            <div className="drop-zone-overlay">
              <div className="drop-zone-content">
                <div className="drop-zone-icon">
                  <Paperclip size={48} />
                </div>
                <div className="drop-zone-text">Drop Here!</div>
                <div className="drop-zone-hint">Images, PDFs, and text files</div>
              </div>
            </div>
          )}

          {/* Parallel Web Agents Panel - Worktree style */}
          {parallelAgents && parallelAgents.length > 0 && (
            <ParallelAgentsPanel
              agents={parallelAgents}
              onClose={() => setParallelAgents(null)}
            />
          )}

          {/* Tools Overlay - inside apple-bar-glass for proper click handling */}
          {monitorMenuOpen && (
            <div
              id="tools-overlay-root"
              ref={monitorMenuRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 999999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(26, 26, 31, 0.98)',
                pointerEvents: 'auto',
                WebkitAppRegion: 'no-drag',
                borderRadius: 16,
              }}
              onClick={(e) => { e.stopPropagation(); setMonitorMenuOpen(false); }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                  pointerEvents: 'auto',
                  WebkitAppRegion: 'no-drag',
                }}
                onClick={(e) => { e.stopPropagation(); }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>Max's Tools</div>
                <div style={{ display: 'flex', gap: 12 }}>
                  {/* Web Browser */}
                  <button
                    type="button"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      padding: '12px 16px',
                      background: workspaceActive ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                      border: `1px solid ${workspaceActive ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                      borderRadius: 12,
                      cursor: 'pointer',
                      minWidth: 72,
                      position: 'relative',
                      pointerEvents: 'auto',
                      WebkitAppRegion: 'no-drag',
                    }}
                    onClick={(e) => { e.stopPropagation(); handleLaunchWorkspaceFromMenu(); }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, rgba(172, 116, 51, 0.2) 0%, rgba(138, 90, 40, 0.1) 100%)',
                      border: '1px solid rgba(172, 116, 51, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: workspaceActive ? '#f59e0b' : 'rgba(255, 200, 120, 0.9)',
                      pointerEvents: 'none',
                    }}>
                      <Globe size={24} />
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 500, color: workspaceActive ? '#f59e0b' : 'rgba(255,255,255,0.85)', pointerEvents: 'none' }}>Web</span>
                    {workspaceActive && <span style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px rgba(34, 197, 94, 0.6)' }} />}
                  </button>
                  {/* Spreadsheet */}
                  <button
                    type="button"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      padding: '12px 16px',
                      background: spreadsheetActive ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                      border: `1px solid ${spreadsheetActive ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                      borderRadius: 12,
                      cursor: 'pointer',
                      minWidth: 72,
                      position: 'relative',
                      pointerEvents: 'auto',
                      WebkitAppRegion: 'no-drag',
                    }}
                    onClick={(e) => { e.stopPropagation(); handleLaunchSpreadsheet(); }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, rgba(172, 116, 51, 0.2) 0%, rgba(138, 90, 40, 0.1) 100%)',
                      border: '1px solid rgba(172, 116, 51, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: spreadsheetActive ? '#f59e0b' : 'rgba(255, 200, 120, 0.9)',
                      pointerEvents: 'none',
                    }}>
                      <Table2 size={24} />
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 500, color: spreadsheetActive ? '#f59e0b' : 'rgba(255,255,255,0.85)', pointerEvents: 'none' }}>GridFlow</span>
                    {spreadsheetActive && <span style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px rgba(34, 197, 94, 0.6)' }} />}
                  </button>
                  {/* Notes */}
                  <button
                    type="button"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      padding: '12px 16px',
                      background: notesActive ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                      border: `1px solid ${notesActive ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                      borderRadius: 12,
                      cursor: 'pointer',
                      minWidth: 72,
                      position: 'relative',
                      pointerEvents: 'auto',
                      WebkitAppRegion: 'no-drag',
                    }}
                    onClick={(e) => { e.stopPropagation(); handleLaunchNotes(); }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, rgba(172, 116, 51, 0.2) 0%, rgba(138, 90, 40, 0.1) 100%)',
                      border: '1px solid rgba(172, 116, 51, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: notesActive ? '#f59e0b' : 'rgba(255, 200, 120, 0.9)',
                      pointerEvents: 'none',
                    }}>
                      <StickyNote size={24} />
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 500, color: notesActive ? '#f59e0b' : 'rgba(255,255,255,0.85)', pointerEvents: 'none' }}>Notes</span>
                    {notesActive && <span style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px rgba(34, 197, 94, 0.6)' }} />}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="apple-logo-drag-hit" />
          <div className="apple-bar-logo" style={{ backgroundImage: `url(${LogoPng})` }} />
          <div className="apple-drag-strip" />
          <div
            className="apple-toolbar"
            ref={toolbarRef}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <div style={{ flexGrow: 1 }} />
            {/* Mode Badge - now also opens Tools menu */}
            <div
              ref={toolBtnRef}
              onClick={handleTools}
              title={`Mode: ${resolveMode()}`}
              style={{
                fontSize: '0.78rem',
                color: 'rgba(255,255,255,0.8)',
                background:
                  resolveMode() === 'autonomous'
                    ? 'rgba(255,165,0,0.18)'
                    : resolveMode() === 'chatty'
                      ? 'rgba(147,197,253,0.18)'
                      : 'rgba(34,197,94,0.18)',
                border: '1px solid rgba(255,255,255,0.14)',
                padding: '4px 8px',
                borderRadius: 8,
                textTransform: 'capitalize',
                cursor: 'pointer',
              }}
            >
              {resolveMode() === 'autonomous' ? 'Auto' : 'Chatty'}
            </div>
            <div
              onClick={
                !backendConnected
                  ? () => {
                      healthAPI
                        .check()
                        .then(() => setApiConnected(true))
                        .catch(() => setApiConnected(false));
                    }
                  : undefined
              }
              title={
                backendConnected
                  ? 'Connected to Agent Max backend'
                  : 'Backend offline. Click to retry connection.'
              }
              style={{
                fontSize: '0.74rem',
                color: backendConnected ? 'rgba(34,197,94,0.95)' : 'rgba(248,113,113,0.95)',
                background: backendConnected ? 'rgba(34,197,94,0.12)' : 'rgba(248,113,113,0.12)',
                border: `1px solid ${backendConnected ? 'rgba(34,197,94,0.25)' : 'rgba(248,113,113,0.25)'}`,
                width: 32,
                height: 32,
                borderRadius: 8,
                cursor: backendConnected ? 'default' : 'pointer',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {backendConnected ? <Wifi size={16} /> : <WifiOff size={16} />}
            </div>
            <CreditDisplay
              userId={currentUser?.id || localStorage.getItem('user_id')}
              variant="tool"
            />
            <div style={{ position: 'relative' }}>
              <button
                ref={monitorBtnRef}
                className="apple-tool-btn"
                onClick={handleMonitorMenu}
                title="Max's Tools"
                style={{
                  background: (workspaceActive || spreadsheetActive || notesActive || monitorMenuOpen) ? 'rgba(245, 158, 11, 0.2)' : undefined,
                  borderColor: (workspaceActive || spreadsheetActive || notesActive || monitorMenuOpen) ? 'rgba(245, 158, 11, 0.4)' : undefined,
                }}
              >
                <Monitor size={16} style={{ color: (workspaceActive || spreadsheetActive || notesActive || monitorMenuOpen) ? '#f59e0b' : undefined }} />
              </button>
{/* Tools menu is now an overlay - see tools-overlay below */}
            </div>
            <button className="apple-tool-btn" onClick={handleSettings} title="Settings">
              <Settings size={16} />
            </button>
            <button className="apple-tool-btn" onClick={handleClear} title="Clear">
              <Edit3 size={16} />
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
            <div
              style={{
                marginTop: 8,
                marginBottom: 8,
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'linear-gradient(180deg, rgba(20,22,26,0.9), rgba(16,18,22,0.9))',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <span
                  style={{ fontSize: '0.9rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}
                >
                  Execution Details
                </span>
                <span
                  style={{ marginLeft: 8, fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}
                >
                  {new Date(executionDetails.when || Date.now()).toLocaleTimeString()}
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => setExecPanelOpen((v) => !v)}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.14)',
                      color: 'rgba(255,255,255,0.85)',
                      padding: '4px 8px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                    }}
                  >
                    {execPanelOpen ? 'Hide' : 'Show'}
                  </button>
                  <button
                    onClick={() => setExecutionDetails(null)}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.14)',
                      color: 'rgba(255,255,255,0.85)',
                      padding: '4px 8px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
              {execPanelOpen && (
                <div style={{ padding: '8px 10px', display: 'grid', rowGap: 8 }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '110px 1fr',
                      columnGap: 8,
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>Action</div>
                    <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.86rem' }}>
                      {executionDetails.actionType || ''}
                    </div>
                  </div>
                  {executionDetails.command && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '110px 1fr auto',
                        columnGap: 8,
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>
                        Command
                      </div>
                      <code
                        style={{
                          color: 'rgba(255,255,255,0.95)',
                          fontSize: '0.82rem',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {executionDetails.command}
                      </code>
                      <button
                        onClick={() => copyToClipboard(executionDetails.command, 'Command copied')}
                        style={{
                          background: 'transparent',
                          border: '1px solid rgba(255,255,255,0.14)',
                          color: 'rgba(255,255,255,0.85)',
                          padding: '4px 8px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  )}
                  {typeof executionDetails.exit_code === 'number' && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '110px 1fr',
                        columnGap: 8,
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>
                        Exit code
                      </div>
                      <div
                        style={{
                          color: executionDetails.exit_code === 0 ? '#34d399' : '#f87171',
                          fontWeight: 600,
                        }}
                      >
                        {executionDetails.exit_code}
                      </div>
                    </div>
                  )}
                  {executionDetails.stdout && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '110px 1fr auto',
                        columnGap: 8,
                      }}
                    >
                      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>
                        Stdout
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          maxHeight: 120,
                          overflow: 'auto',
                          padding: 8,
                          borderRadius: 8,
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: 'rgba(255,255,255,0.92)',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {executionDetails.stdout}
                      </pre>
                      <button
                        onClick={() => copyToClipboard(executionDetails.stdout, 'Stdout copied')}
                        style={{
                          alignSelf: 'start',
                          background: 'transparent',
                          border: '1px solid rgba(255,255,255,0.14)',
                          color: 'rgba(255,255,255,0.85)',
                          padding: '4px 8px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  )}
                  {executionDetails.stderr && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '110px 1fr auto',
                        columnGap: 8,
                      }}
                    >
                      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>
                        Stderr
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          maxHeight: 120,
                          overflow: 'auto',
                          padding: 8,
                          borderRadius: 8,
                          background: 'rgba(239,68,68,0.08)',
                          border: '1px solid rgba(239,68,68,0.2)',
                          color: 'rgba(255,235,235,0.92)',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {executionDetails.stderr}
                      </pre>
                      <button
                        onClick={() => copyToClipboard(executionDetails.stderr, 'Stderr copied')}
                        style={{
                          alignSelf: 'start',
                          background: 'transparent',
                          border: '1px solid rgba(255,255,255,0.14)',
                          color: 'rgba(255,255,255,0.85)',
                          padding: '4px 8px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                        }}
                      >
                        Copy
                      </button>
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
                transform: toolMenuReady
                  ? 'translateY(0px) scale(1)'
                  : 'translateY(-6px) scale(0.98)',
                opacity: toolMenuReady ? 1 : 0,
                transition: 'opacity 160ms ease-out, transform 220ms cubic-bezier(.22,.61,.36,1)',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100%' }}>
                {/* NOTE: value must stay 'autonomous' - only title changes for display */}
                {[
                  { value: 'chatty', title: 'Chatty' },
                  { value: 'autonomous', title: 'Auto' },
                ].map((opt, idx) => {
                  const optionMode = validateModeValue(opt.value);
                  const isSelected = validatedPermissionMode === optionMode;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleSelectLevel(opt.value)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: 'none',
                        background: isSelected ? 'rgba(255,255,255,0.08)' : 'transparent',
                        color: 'rgba(255,255,255,0.55)',
                        cursor: 'pointer',
                        borderRight: idx < 1 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                        boxShadow: isSelected ? 'inset 0 -2px 8px rgba(255,255,255,0.15)' : 'none',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                          e.currentTarget.style.color = 'rgba(255,255,255,0.75)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isSelected
                          ? 'rgba(255,255,255,0.08)'
                          : 'transparent';
                        e.currentTarget.style.color = 'rgba(255,255,255,0.55)';
                      }}
                    >
                      <span style={{ fontSize: '0.86rem', fontWeight: 600, letterSpacing: 0.2 }}>
                        {opt.title}
                      </span>
                    </button>
                  );
                })}
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

          {/* Autonomous Execution Progress (top card) - currently disabled via showTopExecutionCard flag */}
          {showTopExecutionCard && (executionPlan || currentStep > 0) && (
            <div className="amx-progress-card">
              <div className="amx-progress-head">
                <span className="label">
                  {currentStep >= 0 && totalSteps > 0
                    ? `Step ${currentStep + 1}/${totalSteps}`
                    : 'Planning...'}
                  {backgroundProcesses.length > 0 && (
                    <span
                      style={{ marginLeft: 8, color: '#a855f7', fontSize: 11, fontWeight: 500 }}
                    >
                      🔄 {backgroundProcesses.length} process
                      {backgroundProcesses.length > 1 ? 'es' : ''} running
                    </span>
                  )}
                </span>
                <span className="percent">
                  {totalSteps > 0 ? `${Math.round(((currentStep + 1) / totalSteps) * 100)}%` : '0%'}
                </span>
              </div>
              <div className="amx-progress-bar">
                <div
                  className="amx-progress-fill"
                  style={{
                    width: totalSteps > 0 ? `${((currentStep + 1) / totalSteps) * 100}%` : '0%',
                  }}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  marginTop: 6,
                  alignItems: 'center',
                  fontSize: 12,
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    color: heartbeatStatus.stale ? '#f87171' : '#10b981',
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 9999,
                      background: heartbeatStatus.stale ? '#f87171' : '#10b981',
                      display: 'inline-block',
                    }}
                  />
                  {heartbeatStatus.stale ? 'Desktop heartbeat stale' : 'Desktop live'}
                </span>
                {heartbeatStatus.last && (
                  <span style={{ color: '#94a3b8' }}>
                    {`Last beat: ${new Date(heartbeatStatus.last).toLocaleTimeString()}`}
                  </span>
                )}
              </div>
              {backgroundProcesses.length > 0 && (
                <div
                  style={{
                    marginTop: 8,
                    background: 'rgba(168,85,247,0.08)',
                    border: '1px solid rgba(168,85,247,0.2)',
                    borderRadius: 8,
                    padding: '8px 10px',
                  }}
                >
                  <div style={{ fontSize: 12, color: '#e9d5ff', marginBottom: 4, fontWeight: 600 }}>
                    🔄 Background Processes
                  </div>
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      fontSize: 12,
                      color: '#e9d5ff',
                    }}
                  >
                    {backgroundProcesses.map((proc) => {
                      const uptimeSeconds = Math.floor((Date.now() - proc.startedAt) / 1000);
                      const uptimeStr =
                        uptimeSeconds < 60
                          ? `${uptimeSeconds}s`
                          : `${Math.floor(uptimeSeconds / 60)}m ${uptimeSeconds % 60}s`;
                      return (
                        <li
                          key={proc.id}
                          style={{
                            marginBottom: 4,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <span style={{ flex: 1 }}>
                            <span style={{ color: '#c084fc', fontWeight: 500 }}>{proc.name}</span>
                            <span style={{ color: '#a78bfa', fontSize: 10, marginLeft: 6 }}>
                              ({proc.id})
                            </span>
                          </span>
                          <span style={{ color: '#d8b4fe', fontSize: 11 }}>{uptimeStr}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {runExecLogs.length > 0 && (
                <div
                  style={{
                    marginTop: 8,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 8,
                    padding: '8px 10px',
                  }}
                >
                  <div style={{ fontSize: 12, color: '#cbd5e1', marginBottom: 4 }}>
                    Recent activity
                  </div>
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      maxHeight: 120,
                      overflow: 'auto',
                      fontSize: 12,
                      color: '#e2e8f0',
                    }}
                  >
                    {runExecLogs.map((log, idx) => (
                      <li key={log.ts + idx} style={{ marginBottom: 4 }}>
                        <span style={{ color: '#94a3b8' }}>
                          {log.step ? `Step ${log.step}: ` : ''}
                        </span>
                        {log.message || log.stdout || log.error || ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {artifactSummary && (
                <div
                  style={{
                    marginTop: 8,
                    background: 'rgba(59,130,246,0.06)',
                    border: '1px solid rgba(59,130,246,0.2)',
                    borderRadius: 8,
                    padding: '8px 10px',
                    color: '#dbeafe',
                    fontSize: 12,
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Artifacts</div>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{artifactSummary}</pre>
                </div>
              )}
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
                gap: 8,
                alignItems: 'center',
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid rgba(248,113,113,0.3)',
                background: 'rgba(248,113,113,0.08)',
                color: '#fecaca',
                marginBottom: 8,
                fontSize: '0.8rem',
              }}
            >
              <WifiOff size={14} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>
                <strong>Offline</strong> — Reopen desktop app for local steps
              </span>
            </div>
          )}

          {/* Messages - scrollable container */}
          <div
            className={`apple-messages${thoughts.length === 0 && !isThinking ? ' apple-messages-empty' : ''}`}
            ref={messagesRef}
            onTouchMove={handleMessagesTouchMove}
          >
            {executionMode === 'chat' && thoughts.length > 0 && (
              <div className="chat-mode-indicator">
                <span role="img" aria-label="chat">
                  💬
                </span>
                <span>Answering directly — no desktop actions required</span>
              </div>
            )}

            {thoughts.length === 0 && !isThinking && (
              <div className="apple-empty-greeting">
                <div className="apple-empty-greeting-main">{`Hi ${userFirstName}, how can I help?`}</div>
              </div>
            )}

            {thoughts.map((thought, idx) => {
              // Render user message first, then execution progress checklist
              const isUserMessage = thought.role === 'user';
              // Use memoized lastUserMessageIdx (computed once above, not per message)
              const isLastUserMessage = isUserMessage && idx === lastUserMessageIdx;
              const shouldShowProgress =
                isLastUserMessage && (
                  (!usePullExecution && executionPlan && executionPlan.steps) || // Old planned execution (only when NOT using pull)
                  (liveActivitySteps.length > 0) // New iterative execution (pull mode)
                );
              if (thought.type === 'thought') {
                const isExpanded = thought.expanded !== false;
                return (
                  <div key={thought.id || idx} className="apple-message apple-message-thought">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <Lightbulb size={14} />
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                        }}
                      >
                        Thought
                      </span>
                      <button
                        onClick={() => handleToggleThoughtExpand(thought.id, isExpanded)}
                        style={{
                          marginLeft: 'auto',
                          background: 'transparent',
                          border: 'none',
                          color: 'rgba(255,255,255,0.75)',
                          cursor: 'pointer',
                        }}
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
                      <div
                        onClick={() => handleExpandThought(thought.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 10px',
                          borderRadius: 999,
                          border: '1px solid rgba(255,255,255,0.18)',
                          background: 'rgba(255,255,255,0.06)',
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        <span>💭</span>
                        <span>
                          {thought.wordCount ||
                            String(thought.message || '')
                              .trim()
                              .split(/\s+/)
                              .filter(Boolean).length ||
                            0}{' '}
                          words
                        </span>
                        <ChevronRight size={12} />
                      </div>
                    )}
                  </div>
                );
              }
              // Check if this message should animate (new messages only)
              const shouldAnimate =
                thought.role === 'assistant' &&
                thought.timestamp &&
                animatedMessagesRef.current.has(thought.timestamp);

              // Mark as animated after first render
              if (shouldAnimate) {
                setTimeout(() => {
                  animatedMessagesRef.current.delete(thought.timestamp);
                }, 100);
              }

              return (
                <React.Fragment key={idx}>
                  <div className={`apple-message apple-message-${thought.role}`}>
                    <div
                      className={`apple-message-content ${thought.type === 'plan' ? 'plan-message' : ''}`}
                    >
                      {thought.role === 'user' &&
                        Array.isArray(thought.attachments) &&
                        thought.attachments.length > 0 && (
                          <div className="apple-message-attachments">
                            {thought.attachments.map((att) => (
                              <div key={att.key || att.name} className="apple-message-attachment">
                                {att.type === 'image' && att.preview ? (
                                  <img src={att.preview} alt={att.name || 'attachment'} />
                                ) : (
                                  <div className="apple-message-attachment-file">
                                    <FileText size={14} />
                                  </div>
                                )}
                                <span className="apple-message-attachment-name" title={att.name}>
                                  {att.name || 'Attachment'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      {thought.role === 'assistant' || thought.role === 'system' ? (
                        shouldAnimate ? (
                          <TypewriterMessage
                            content={(thought.content || '').trim()}
                            speed={120}
                            enabled={true}
                          />
                        ) : (
                          <EmailRenderer content={(thought.content || '').trim()} />
                        )
                      ) : (
                        thought.content
                      )}
                      {thought.role === 'assistant' && thought.memoryLabel && (
                        <div
                          style={{
                            marginTop: 6,
                            fontSize: '0.75rem',
                            color: '#065f46',
                            background: '#ecfdf5',
                            border: '1px solid #a7f3d0',
                            borderRadius: 8,
                            padding: '6px 8px',
                          }}
                        >
                          {thought.memoryLabel}
                        </div>
                      )}
                      {/* Deep Dive link for long responses */}
                      {thought.role === 'assistant' && thought.isDeepDive && thought.deepDiveId && (
                        <div
                          style={{
                            marginTop: 12,
                            paddingTop: 10,
                            paddingBottom: 4,
                            borderTop: '1px solid rgba(255,255,255,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <button
                            onClick={() => {
                              // Open settings with Deep Dive tab
                              if (window.electronAPI?.openSettings) {
                                window.electronAPI.openSettings({
                                  route: `/settings?deepdive=${thought.deepDiveId}`,
                                });
                              } else {
                                // Fallback: navigate in same window
                                window.location.hash = `/settings?deepdive=${thought.deepDiveId}`;
                              }
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '6px 12px',
                              background:
                                'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15))',
                              border: '1px solid rgba(139, 92, 246, 0.3)',
                              borderRadius: 8,
                              color: '#c4b5fd',
                              fontSize: 12,
                              fontWeight: 500,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background =
                                'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(139, 92, 246, 0.25))';
                              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background =
                                'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15))';
                              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
                            }}
                          >
                            <span>📖</span>
                            <span>See full response in Deep Dive</span>
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Show execution progress checklist after user message */}
                  {shouldShowProgress && (
                    liveActivitySteps.length > 0 ? (
                      <LiveActivityFeed
                        activitySteps={liveActivitySteps}
                        initialMessage={initialAIMessage}
                      />
                    ) : !usePullExecution && executionPlan && executionPlan.steps ? (
                      /* Old ExecutionProgress only shown when NOT using pull execution */
                      <ExecutionProgress
                        steps={executionPlan.steps}
                        stepStatuses={stepStatuses}
                        currentStep={currentStep}
                        summary={executionSummary}
                        currentAction={thinkingStatus}
                        startTime={executionStartTime}
                      />
                    ) : null
                  )}
                </React.Fragment>
              );
            })}

            {/* Inline ask_user question from AI */}
            {pendingAskUser && (
              <div className="apple-message apple-message-assistant" style={{ marginBottom: 12 }}>
                <div className="apple-message-content">
                  {/* Show context (e.g., email draft) - either static or editable */}
                  {pendingAskUser.context && (
                    isEditingContext ? (
                      /* Editable textarea mode */
                      <div style={{ marginBottom: 14, marginLeft: -12, marginRight: -12 }}>
                        <textarea
                          ref={contextTextareaRef}
                          value={editedContext}
                          onChange={(e) => setEditedContext(e.target.value)}
                          style={{
                            width: '100%',
                            minHeight: 220,
                            padding: '12px 14px',
                            background: 'rgba(255, 255, 255, 0.08)',
                            borderRadius: 10,
                            border: '2px solid rgba(59, 130, 246, 0.5)',
                            fontSize: 13,
                            lineHeight: 1.6,
                            color: '#fff',
                            resize: 'vertical',
                            fontFamily: 'inherit',
                            outline: 'none',
                            boxSizing: 'border-box',
                          }}
                          onKeyDown={(e) => {
                            // Cmd/Ctrl + Enter to send
                            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                              e.preventDefault();
                              handleSendEditedContent();
                            }
                          }}
                        />
                        <div style={{
                          display: 'flex',
                          gap: 8,
                          marginTop: 10,
                          justifyContent: 'flex-end'
                        }}>
                          <button
                            onClick={() => {
                              setIsEditingContext(false);
                              setEditedContext('');
                            }}
                            style={{
                              padding: '8px 16px',
                              background: 'rgba(255, 255, 255, 0.06)',
                              border: '1px solid rgba(255, 255, 255, 0.12)',
                              borderRadius: 8,
                              color: 'rgba(255, 255, 255, 0.7)',
                              fontSize: 13,
                              cursor: 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSendEditedContent}
                            style={{
                              padding: '8px 16px',
                              background: 'rgba(59, 130, 246, 0.8)',
                              border: 'none',
                              borderRadius: 8,
                              color: '#fff',
                              fontSize: 13,
                              fontWeight: 500,
                              cursor: 'pointer',
                            }}
                          >
                            Send edited message
                          </button>
                        </div>
                        <div style={{
                          fontSize: 11,
                          color: 'rgba(255, 255, 255, 0.4)',
                          marginTop: 6,
                          textAlign: 'right'
                        }}>
                          Press ⌘+Enter to send
                        </div>
                      </div>
                    ) : (
                      /* Static display mode */
                      <div style={{
                        marginBottom: 14,
                        padding: '12px 14px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        borderRadius: 10,
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: 'rgba(255, 255, 255, 0.85)',
                        whiteSpace: 'pre-wrap',
                        maxHeight: 200,
                        overflowY: 'auto',
                      }}>
                        {pendingAskUser.context}
                      </div>
                    )
                  )}
                  {/* Only show question and options when not in editing mode */}
                  {!isEditingContext && (
                    <>
                      <div style={{ marginBottom: 12, fontWeight: 500 }}>{pendingAskUser.question}</div>
                      {/* Show options if available */}
                      {pendingAskUser.options && pendingAskUser.options.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {pendingAskUser.options.map((option) => {
                            // Rename edit-related options to "Edit message"
                            const isEditOption = option.id?.toLowerCase().includes('edit') ||
                                                option.label?.toLowerCase().includes('edit');
                            const displayLabel = isEditOption ? 'Edit message' : option.label;

                            return (
                              <button
                                key={option.id}
                                onClick={() => handleAskUserResponse(option)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 10,
                                  padding: '10px 14px',
                                  background: 'rgba(255, 255, 255, 0.06)',
                                  border: '1px solid rgba(255, 255, 255, 0.12)',
                                  borderRadius: 10,
                                  color: '#fff',
                                  fontSize: 13,
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                                }}
                              >
                                <div style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: '50%',
                                  border: '2px solid rgba(255, 255, 255, 0.3)',
                                  flexShrink: 0,
                                }} />
                                <div>
                                  <div style={{ fontWeight: 500 }}>{displayLabel}</div>
                                  {option.description && (
                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                                      {option.description}
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        /* No options - show text input for free-form response */
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                          <textarea
                            ref={contextTextareaRef}
                            value={editedContext}
                            onChange={(e) => setEditedContext(e.target.value)}
                            placeholder="Type your response..."
                            style={{
                              flex: 1,
                              minHeight: 40,
                              maxHeight: 120,
                              padding: '10px 12px',
                              background: 'rgba(255, 255, 255, 0.08)',
                              borderRadius: 10,
                              border: '1px solid rgba(255, 255, 255, 0.15)',
                              fontSize: 13,
                              lineHeight: 1.5,
                              color: '#fff',
                              resize: 'none',
                              fontFamily: 'inherit',
                              outline: 'none',
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                if (editedContext.trim()) {
                                  handleSendEditedContent();
                                }
                              }
                            }}
                            onFocus={(e) => {
                              e.target.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                            }}
                          />
                          <button
                            onClick={handleSendEditedContent}
                            disabled={!editedContext.trim()}
                            style={{
                              padding: '10px 16px',
                              background: editedContext.trim() ? 'rgba(59, 130, 246, 0.8)' : 'rgba(59, 130, 246, 0.3)',
                              border: 'none',
                              borderRadius: 10,
                              color: '#fff',
                              fontSize: 13,
                              fontWeight: 500,
                              cursor: editedContext.trim() ? 'pointer' : 'not-allowed',
                              opacity: editedContext.trim() ? 1 : 0.6,
                            }}
                          >
                            Send
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {isThinking && !liveActivitySteps.length && (
              <div className="apple-message apple-message-thinking">
                {/* Show ActivityFeed when in autonomous mode (but not when using LiveActivityFeed) */}
                {executionPlan || activityLog.length > 0 || runStatus === 'running' ? (
                  <ActivityFeed
                    activities={activityLog}
                    currentAction={thinkingStatus}
                    startTime={activityStartTime}
                    compact={true}
                  />
                ) : (
                  <>
                    <div className="typing-indicator">
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                    </div>
                    <span className="typing-text">{thinkingStatus || 'Thinking...'}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Attachment Preview Row */}
          {attachments.length > 0 && (
            <div className="attachment-preview-row">
              {attachments.map((att, idx) => (
                <div key={idx} className="attachment-preview-item">
                  {att.type === 'image' ? (
                    <img src={att.preview} alt="attachment" className="attachment-thumb" />
                  ) : (
                    <div className="attachment-file-icon">
                      <FileText size={16} />
                    </div>
                  )}
                  <span className="attachment-name">
                    {att.file.name.length > 16 ? `${att.file.name.slice(0, 13)}...` : att.file.name}
                  </span>
                  <button
                    className="attachment-remove-btn"
                    onClick={() => handleRemoveAttachment(idx)}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input Area - Extracted to ComposerBar for performance */}
          <ComposerBar
            composerRef={composerRef}
            fileInputRef={fileInputRef}
            inputRef={inputRef}
            hoverTimeoutRef={hoverTimeoutRef}
            planIdRef={planIdRef}
            message={message}
            attachments={attachments}
            userInputRequest={userInputRequest}
            apiConnected={apiConnected}
            isThinking={isThinking}
            executionPlan={executionPlan}
            executionSummary={executionSummary}
            runStatus={runStatus}
            showSendControls={showSendControls}
            setMessage={setMessage}
            setAttachments={setAttachments}
            setShowSendControls={setShowSendControls}
            handleUserInputSubmit={handleUserInputSubmit}
            handleSubmit={handleSubmit}
            handleStopAll={handleStopAll}
            handleResumeRun={handleResumeRun}
            handlePauseRun={handlePauseRun}
            handleCancelRun={handleCancelRun}
            aiOptions={aiOptions}
            setAiOptions={setAiOptions}
          />

        </div>
      </div>

      {/* Approval Dialog */}
      <ApprovalDialog
        open={approvalOpen}
        onClose={() => {
          // Call onReject to rollback optimistic message if user closes without approving
          const rejectFn = approvalDetails.onReject;
          setApprovalOpen(false);
          if (typeof rejectFn === 'function') {
            try {
              rejectFn();
            } catch {}
          }
        }}
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

      {/* Intent Confirmation Modal - UX improvement */}
      <IntentConfirmationModal
        open={intentConfirmationOpen}
        onClose={() => handleIntentReject('user')}
        intentData={pendingIntentData}
        onConfirm={handleIntentConfirm}
        onReject={handleIntentReject}
        timeoutSeconds={pendingIntentData?.timeout_s || 60}
      />

      {/* Offline/Reconnecting pill (hidden during onboarding, loading, or first 3 seconds) */}
      {showDisconnectedBanner && showWelcome === false && (
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
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <Loader2 size={14} className="spin" />
          <span style={{ fontSize: '0.82rem' }}>Disconnected — retrying…</span>
          <button
            onClick={() =>
              healthAPI
                .check()
                .then(() => setApiConnected(true))
                .catch(() => {})
            }
            style={{
              marginLeft: 8,
              padding: '4px 8px',
              fontSize: '0.78rem',
              color: '#fff',
              background: 'linear-gradient(180deg, #2a2a2e 0%, #1a1a1d 100%)',
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: 8,
              cursor: 'pointer',
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
            WebkitBackdropFilter: 'blur(12px)',
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
            animation: 'slideUp 0.2s ease-out',
          }}
        >
          <span
            style={{ color: '#ffffff', fontSize: '0.95rem', fontWeight: 500, marginRight: '4px' }}
          >
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
              transition: 'all 0.15s ease',
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
              boxShadow: '0 2px 8px rgba(0,122,255,0.3)',
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
