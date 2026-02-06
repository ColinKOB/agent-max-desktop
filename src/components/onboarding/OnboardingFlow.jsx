/**
 * Premium Onboarding Flow Component
 * 
 * A polished, premium onboarding experience for new users
 * Features: Progress indicator, personalized copy, rich cards, confetti celebration
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import useStore from '../../store/useStore';
import {
  ChevronRight,
  Check,
  Sparkles,
  ArrowRight,
  Star,
  Crown,
  Zap,
  GraduationCap,
  Code2,
  Briefcase,
  PenTool,
  Calendar,
  Mail,
  FileText,
  Search,
  Shield,
  Clock,
  Cpu,
  MessageSquare,
  Bot,
  AlertCircle,
  FileWarning,
  Scale,
  Gift,
  Heart,
  Plane,
  FolderOpen,
  Play,
  // Additional icons for personalized onboarding
  Loader2,
  Users,
  Video,
  MessageCircle,
  Send,
  Image,
  Layout,
  Palette,
  Film,
  Music,
  Mic,
  Box,
  Terminal,
  GitBranch,
  FileCode,
  Database,
  Compass,
  Globe,
  DollarSign,
  Table,
  Lock,
  CheckSquare,
  Tv,
  PlayCircle,
  Gamepad2,
  Folder,
  Trash2,
  HardDrive,
  Cloud,
  Feather,
  Type,
  BookOpen,
  Settings
} from 'lucide-react';

// App capabilities data for personalized onboarding
import appCapabilitiesData from '../../data/app-capabilities.json';
import { motion, AnimatePresence } from 'framer-motion';
import { healthAPI, googleAPI, creditsAPI, subscriptionAPI } from '../../services/api';
import { generateOAuthState, hashOAuthState, storeOAuthStateHash } from '../../services/oauth';
import { GoogleConnect } from '../../components/GoogleConnect';
import apiConfigManager from '../../config/apiConfig';
import LogoPng from '../../assets/AgentMaxLogo.png';
import { setName as setProfileName, setPreference as setUserPreference, updateProfile as updateUserProfile, flushPreAuthQueue } from '../../services/supabaseMemory';
import { emailPasswordSignInOrCreate, ensureUsersRow, supabase, resetPassword } from '../../services/supabase.js';
import { isGoogleComingSoon } from '../../config/featureGates';
import {
  trackOnboardingStarted,
  trackOnboardingStepCompleted,
  trackOnboardingCompleted,
  trackSignInAttempted,
  trackSignInSucceeded,
  trackSignInFailed,
  trackCheckoutStarted,
  trackCheckoutCompleted,
  capture,
  AnalyticsEvents,
  getFeatureFlag
} from '../../services/analytics';

// Brand orange color from logo (no gradients)
const BRAND_ORANGE = '#f59e0b';
const BRAND_ORANGE_LIGHT = 'rgba(245, 158, 11, 0.15)';
const BRAND_ORANGE_SHADOW = 'rgba(245, 158, 11, 0.35)';
const BRAND_ORANGE_GLOW = 'rgba(245, 158, 11, 0.5)';

// ============================================================================
// CONFETTI UTILITY
// ============================================================================
function createConfetti(container) {
  const colors = [BRAND_ORANGE, '#22c55e', '#ef4444', '#ec4899', '#8b5cf6', '#ffffff'];
  const confettiCount = 150;
  
  for (let i = 0; i < confettiCount; i++) {
    const confetti = document.createElement('div');
    confetti.style.cssText = `
      position: absolute;
      width: ${Math.random() * 10 + 5}px;
      height: ${Math.random() * 10 + 5}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      left: ${Math.random() * 100}%;
      top: -20px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      pointer-events: none;
      opacity: 0;
    `;
    container.appendChild(confetti);
    
    const duration = Math.random() * 2 + 2;
    const delay = Math.random() * 0.5;
    const rotation = Math.random() * 720 - 360;
    const drift = Math.random() * 200 - 100;
    
    confetti.animate([
      { 
        transform: `translateY(0) translateX(0) rotate(0deg)`, 
        opacity: 1 
      },
      { 
        transform: `translateY(${container.offsetHeight + 50}px) translateX(${drift}px) rotate(${rotation}deg)`, 
        opacity: 0 
      }
    ], {
      duration: duration * 1000,
      delay: delay * 1000,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      fill: 'forwards'
    }).onfinish = () => confetti.remove();
  }
}

// ============================================================================
// PROGRESS INDICATOR
// ============================================================================
function ProgressIndicator({ currentStep, totalSteps }) {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      gap: 8, 
      paddingTop: 16,
      paddingBottom: 8
    }}>
      {Array.from({ length: totalSteps }).map((_, index) => {
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;
        
        return (
          <motion.div
            key={index}
            initial={false}
            animate={{
              width: isActive ? 24 : 8,
              backgroundColor: isCompleted 
                ? BRAND_ORANGE 
                : isActive 
                  ? BRAND_ORANGE 
                  : 'rgba(255, 255, 255, 0.2)',
            }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{
              height: 8,
              borderRadius: 4,
              boxShadow: isActive ? `0 0 12px ${BRAND_ORANGE_GLOW}` : 'none',
            }}
          />
        );
      })}
    </div>
  );
}

// ============================================================================
// SHARED STYLES
// ============================================================================
const styles = {
  heading: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
    marginBottom: 8,
  },
  subheading: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 15,
    lineHeight: 1.5,
    marginBottom: 24,
  },
  primaryButton: {
    width: '100%',
    height: 48,
    padding: '0 24px',
    color: '#ffffff',
    background: BRAND_ORANGE,
    border: 'none',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'all 0.2s ease',
    boxShadow: `0 4px 14px ${BRAND_ORANGE_SHADOW}`,
  },
  secondaryButton: {
    height: 48,
    padding: '0 20px',
    color: 'rgba(255, 255, 255, 0.8)',
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  input: {
    width: '100%',
    height: 52,
    padding: '0 16px',
    color: '#ffffff',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    fontSize: 15,
    outline: 'none',
    transition: 'all 0.2s ease',
  },
};

// ============================================================================
// STEP 0: WELCOME
// ============================================================================
function WelcomeStep({ onNext }) {
  const [logoAnimated, setLogoAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLogoAnimated(true), 100);
    // Track onboarding started when welcome step mounts
    trackOnboardingStarted(0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      height: '100%',
      padding: '20px',
      textAlign: 'center',
    }}>
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ 
          type: 'spring', 
          stiffness: 200, 
          damping: 15,
          delay: 0.1 
        }}
        style={{ marginBottom: 24 }}
      >
        <div style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          background: BRAND_ORANGE_LIGHT,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 8px 32px ${BRAND_ORANGE_SHADOW}`,
        }}>
          <img 
            src={LogoPng} 
            alt="Agent Max" 
            style={{ width: 50, height: 50, objectFit: 'contain' }} 
          />
        </div>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        style={{
          ...styles.heading,
          fontSize: 32,
          marginBottom: 12,
        }}
      >
        Welcome to Agent Max
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        style={{
          ...styles.subheading,
          maxWidth: 300,
          marginBottom: 32,
        }}
      >
        Your AI assistant that actually gets things done. Let's set you up in just a minute.
      </motion.p>

      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        onClick={() => onNext()}
        style={{
          ...styles.primaryButton,
          maxWidth: 280,
        }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        Get Started
        <ArrowRight style={{ width: 18, height: 18 }} />
      </motion.button>
    </div>
  );
}

// ============================================================================
// STEP: SEE MAX IN ACTION (Demo of Capabilities) - Personalized
// ============================================================================

// Fallback examples if no apps are detected or IPC fails
const DEMO_EXAMPLES = [
  {
    icon: Mail,
    text: '"Draft an email to reschedule my meeting"',
    color: '#3b82f6', // blue
  },
  {
    icon: Plane,
    text: '"Find flights to Tokyo for next week"',
    color: '#22c55e', // green
  },
  {
    icon: FolderOpen,
    text: '"Organize my downloads folder"',
    color: '#a855f7', // purple
  },
];

// Map icon string names to actual Lucide components
const ICON_MAP = {
  FileText,
  CheckSquare,
  Calendar,
  Lock,
  Search,
  MessageSquare,
  Users,
  Video,
  MessageCircle,
  Send,
  Shield,
  PenTool,
  Image,
  Layout,
  Palette,
  Film,
  Music,
  Mic,
  Box,
  Code2,
  Terminal,
  GitBranch,
  FileCode,
  Database,
  Compass,
  Globe,
  DollarSign,
  Table,
  Tv,
  PlayCircle,
  Gamepad2,
  Folder,
  Trash2,
  HardDrive,
  Cloud,
  Feather,
  Type,
  BookOpen,
  Mail,
  Briefcase,
  Settings,
};

/**
 * Generate personalized examples based on user's installed apps
 * @param {Array} installedApps - Array of app objects with name property
 * @returns {Array} Array of example objects with icon, text, color, and appName
 */
function generatePersonalizedExamples(installedApps) {
  if (!installedApps || installedApps.length === 0) {
    return [];
  }

  const matchedExamples = [];
  const usedCategories = new Set();
  const { apps: capabilityApps, categories } = appCapabilitiesData;

  // PRIORITY APPS: These have REAL deep integrations in Max (not just "open")
  // ONLY include apps where Max can do impressive actions, not just open them
  // Order matters - these will be shown first if installed
  const priorityApps = [
    // Apple native apps with AppleScript/automation support
    'Mail',           // Full email: send, read, search, reply
    'Calendar',       // Full calendar: create events, show schedule, search
    'Notes',          // Full notes: create, search, append, organize
    'Reminders',      // Full reminders: create with due dates, mark complete
    'Finder',         // File management: list, move, copy, search files
    'Messages',       // Send iMessages
    'Safari',         // Web automation: search, navigate, fill forms
    'Contacts',       // Search and manage contacts
    // Browsers (web automation)
    'Google Chrome',  // Web automation: search, navigate, compare prices
    'Firefox',        // Web automation
    'Arc',            // Web automation
    // Productivity with APIs
    'Notion',         // Create pages, search workspace
    'Slack',          // Send messages, read channels
    'Google Docs',    // Create, read, list documents
    'Todoist',        // Task management
    'Things',         // Task management
    'Fantastical',    // Calendar management
    'Obsidian',       // Note creation and search
    'Bear',           // Note creation
    // Communication
    'Discord',        // Send messages
    'Telegram',       // Send messages
    'WhatsApp',       // Send messages
    'Zoom',           // Start/join meetings
    'Microsoft Teams',// Start meetings, send messages
    // Entertainment
    'Spotify',        // Play music, search, control playback
    'Apple Music',    // Play music, control playback
    // Development
    'Terminal',       // Run commands
    'iTerm2',         // Run commands
    'Visual Studio Code', // Open files, search code
    'GitHub Desktop', // Commit, push, pull
  ];

  // Apps to EXCLUDE - we can only open these, which isn't impressive
  // These apps don't have AppleScript support or APIs we can use
  const excludeApps = [
    // Password managers (security-sensitive, no API access)
    '1Password',
    'Bitwarden',
    'LastPass',
    // Microsoft Office (no deep integration)
    'Microsoft Word',
    'Microsoft Excel',
    'Microsoft PowerPoint',
    // Adobe Creative Suite (complex apps, no API)
    'Adobe Photoshop',
    'Adobe Illustrator',
    'Adobe Premiere Pro',
    'Adobe XD',
    'Adobe Acrobat',
    // Video/Audio production (complex, no API)
    'Final Cut Pro',
    'Logic Pro',
    'GarageBand',
    'DaVinci Resolve',
    'iMovie',
    'Audacity',
    'Blender',
    // Cloud storage (just file sync, no API)
    'Google Drive',
    'Dropbox',
    'OneDrive',
    // Launcher apps (meta-apps)
    'Alfred',
    'Raycast',
    // Design tools (complex, no API)
    'Figma',
    'Sketch',
    'Canva',
    'Affinity Designer',
    'Affinity Photo',
    // System utilities
    'CleanMyMac',
    'DaisyDisk',
    'Rectangle',
    'Magnet',
    // Apps with icon extraction issues
    'Books',
  ];

  // Normalize app names for matching (handle variations like "Visual Studio Code" vs "Code")
  const normalizeAppName = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Create a lookup map for faster matching
  const capabilityAppNames = Object.keys(capabilityApps);
  const capabilityLookup = {};
  capabilityAppNames.forEach(appName => {
    capabilityLookup[normalizeAppName(appName)] = appName;
  });

  // Try to match each installed app against our capability map
  for (const installedApp of installedApps) {
    const normalizedInstalled = normalizeAppName(installedApp.name);

    // Try exact match first
    let matchedAppName = capabilityLookup[normalizedInstalled];

    // If no exact match, try partial matching for common apps
    if (!matchedAppName) {
      // Handle common variations
      const variations = [
        // VS Code variations
        { patterns: ['visualstudiocode', 'vscode', 'code'], target: 'Visual Studio Code' },
        // Chrome variations
        { patterns: ['googlechrome', 'chrome'], target: 'Google Chrome' },
        // Teams variations
        { patterns: ['microsoftteams', 'teams'], target: 'Microsoft Teams' },
        // Word variations
        { patterns: ['microsoftword', 'word'], target: 'Microsoft Word' },
        // Excel variations
        { patterns: ['microsoftexcel', 'excel'], target: 'Microsoft Excel' },
        // Outlook variations
        { patterns: ['microsoftoutlook', 'outlook'], target: 'Outlook' },
        // Adobe apps
        { patterns: ['adobephotoshop', 'photoshop'], target: 'Adobe Photoshop' },
        { patterns: ['adobeillustrator', 'illustrator'], target: 'Adobe Illustrator' },
        { patterns: ['adobepremierepro', 'premierepro', 'premiere'], target: 'Adobe Premiere Pro' },
        { patterns: ['adobexd', 'xd'], target: 'Adobe XD' },
        { patterns: ['adobeacrobat', 'acrobat', 'acrobatreader'], target: 'Adobe Acrobat' },
        // JetBrains
        { patterns: ['intellijidea', 'intellij'], target: 'IntelliJ IDEA' },
        // Apple apps
        { patterns: ['applemusic', 'music'], target: 'Apple Music' },
        { patterns: ['applenotes', 'notes'], target: 'Notes' },
        { patterns: ['applemail', 'mail'], target: 'Mail' },
        { patterns: ['applecalendar', 'calendar', 'ical'], target: 'Calendar' },
        { patterns: ['applereminders', 'reminders'], target: 'Reminders' },
        // Other
        { patterns: ['iterm2', 'iterm'], target: 'iTerm2' },
        { patterns: ['finalcutpro', 'finalcut'], target: 'Final Cut Pro' },
        { patterns: ['logicpro', 'logic'], target: 'Logic Pro' },
        { patterns: ['garageband'], target: 'GarageBand' },
        { patterns: ['davinciresolvefree', 'davinciresolve', 'davinci'], target: 'DaVinci Resolve' },
      ];

      for (const variation of variations) {
        if (variation.patterns.some(p => normalizedInstalled.includes(p))) {
          if (capabilityApps[variation.target]) {
            matchedAppName = variation.target;
            break;
          }
        }
      }
    }

    if (matchedAppName && capabilityApps[matchedAppName]) {
      // Skip apps that we can only "open" - not impressive
      if (excludeApps.includes(matchedAppName)) continue;

      const appCapability = capabilityApps[matchedAppName];
      const category = appCapability.category;

      // Prioritize diversity - try not to repeat categories too much
      const categoryCount = Array.from(usedCategories).filter(c => c === category).length;
      if (categoryCount >= 2) continue;

      // Check if this is a priority app (has real deep integration)
      const isPriority = priorityApps.includes(matchedAppName);

      // Pick the most compelling prompt (prefer action prompts over "open" commands)
      const prompts = appCapability.prompts || [];
      const actionPrompt = prompts.find(p =>
        !p.toLowerCase().startsWith('open ') &&
        !p.toLowerCase().startsWith('launch ') &&
        !p.toLowerCase().startsWith('switch ') &&
        p.toLowerCase().includes(' ')
      ) || prompts[0];

      if (actionPrompt) {
        const IconComponent = ICON_MAP[appCapability.icon] || Sparkles;
        const categoryInfo = categories[category] || {};

        // Debug: Log icon availability
        console.log(`[DemoStep] App: ${matchedAppName}, hasIcon: ${!!installedApp.iconDataUrl}, iconLength: ${installedApp.iconDataUrl?.length || 0}`);

        matchedExamples.push({
          icon: IconComponent,
          text: `"${actionPrompt}"`,
          color: appCapability.color || categoryInfo.color || '#64748b',
          appName: matchedAppName,
          category: category,
          isPersonalized: true,
          isPriority: isPriority, // Mark priority apps
          // Include real app icon if available (extracted by Electron main process)
          appIconUrl: installedApp.iconDataUrl || null,
        });

        usedCategories.add(category);
      }
    }

    // Limit to 5 personalized examples
    if (matchedExamples.length >= 5) break;
  }

  // Shuffle function for variety
  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Separate priority and non-priority apps
  const priorityExamples = matchedExamples.filter(e => e.isPriority);
  const nonPriorityExamples = matchedExamples.filter(e => !e.isPriority);

  // Shuffle non-priority apps for variety each time
  const shuffledNonPriority = shuffleArray(nonPriorityExamples);

  // Combine: priority first, then shuffled non-priority
  const combinedExamples = [...priorityExamples, ...shuffledNonPriority];

  return combinedExamples.slice(0, 5);
}

function DemoStep({ onNext, onBack }) {
  const [showExamples, setShowExamples] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [personalizedExamples, setPersonalizedExamples] = useState([]);
  const [detectedAppsCount, setDetectedAppsCount] = useState(0);
  const [isPersonalized, setIsPersonalized] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [allApps, setAllApps] = useState([]);
  const [selectedDebugApp, setSelectedDebugApp] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchAndMatchApps() {
      try {
        // Check if electron API is available
        const electronAPI = window.electron?.appDiscovery || window.electronAPI?.appDiscovery;

        if (electronAPI?.getUserContext) {
          console.log('[DemoStep] Fetching user apps via IPC...');
          const context = await electronAPI.getUserContext();

          if (!isMounted) return;

          if (context?.success !== false && context?.installedApps?.length > 0) {
            console.log(`[DemoStep] Found ${context.installedApps.length} installed apps`);
            // Debug: Check if icons are being received
            const appsWithIcons = context.installedApps.filter(a => a.iconDataUrl);
            console.log(`[DemoStep] Apps with icons: ${appsWithIcons.length}`);
            if (appsWithIcons.length > 0) {
              console.log(`[DemoStep] First app with icon:`, appsWithIcons[0].name, appsWithIcons[0].iconDataUrl?.substring(0, 50));
            }
            setDetectedAppsCount(context.installedApps.length);
            // Store all apps for debug mode
            setAllApps(context.installedApps);

            // Generate personalized examples
            const examples = generatePersonalizedExamples(context.installedApps);
            console.log(`[DemoStep] Generated ${examples.length} personalized examples`);
            // Debug: Check if examples have icons
            examples.forEach((ex, i) => {
              console.log(`[DemoStep] Example ${i}: ${ex.appName}, hasIconUrl: ${!!ex.appIconUrl}, iconStart: ${ex.appIconUrl?.substring(0, 30) || 'none'}`);
            });

            if (examples.length >= 3) {
              setPersonalizedExamples(examples);
              setIsPersonalized(true);
            } else {
              // Not enough matches, use fallback
              console.log('[DemoStep] Not enough matches, using fallback examples');
              setPersonalizedExamples(DEMO_EXAMPLES);
              setIsPersonalized(false);
            }
          } else {
            console.log('[DemoStep] No apps found or IPC failed, using fallback');
            setPersonalizedExamples(DEMO_EXAMPLES);
            setIsPersonalized(false);
          }
        } else {
          // No IPC available (web context or preload not loaded)
          console.log('[DemoStep] IPC not available, using fallback examples');
          setPersonalizedExamples(DEMO_EXAMPLES);
          setIsPersonalized(false);
        }
      } catch (error) {
        console.error('[DemoStep] Error fetching user apps:', error);
        if (isMounted) {
          setPersonalizedExamples(DEMO_EXAMPLES);
          setIsPersonalized(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          // Trigger example animations after a short delay
          setTimeout(() => {
            if (isMounted) setShowExamples(true);
          }, 200);
        }
      }
    }

    fetchAndMatchApps();

    return () => {
      isMounted = false;
    };
  }, []);

  const displayExamples = personalizedExamples.length > 0 ? personalizedExamples : DEMO_EXAMPLES;

  // Get prompts for an app from capabilities
  const getAppPrompts = (appName) => {
    const { apps: capabilityApps } = appCapabilitiesData;
    // Try exact match first
    if (capabilityApps[appName]) {
      return capabilityApps[appName].prompts || [];
    }
    // Try case-insensitive match
    const matchedKey = Object.keys(capabilityApps).find(
      key => key.toLowerCase() === appName.toLowerCase()
    );
    if (matchedKey) {
      return capabilityApps[matchedKey].prompts || [];
    }
    return [];
  };

  if (debugMode) {
    const prompts = selectedDebugApp ? getAppPrompts(selectedDebugApp.name) : [];

    return (
      <div style={{
        maxWidth: 400,
        margin: '0 auto',
        padding: '16px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ color: '#fff', margin: 0, fontSize: 14 }}>
            {selectedDebugApp ? `${selectedDebugApp.name} Prompts` : `All Apps (${allApps.length})`}
          </h3>
          <button
            onClick={() => selectedDebugApp ? setSelectedDebugApp(null) : setDebugMode(false)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#fff',
              padding: '6px 12px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            {selectedDebugApp ? '← Back to Apps' : 'Close'}
          </button>
        </div>

        {selectedDebugApp ? (
          // Show prompts for selected app
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
              {selectedDebugApp.iconDataUrl ? (
                <img src={selectedDebugApp.iconDataUrl} alt={selectedDebugApp.name} style={{ width: 48, height: 48, borderRadius: 10 }} />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: 10, background: 'rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>❌</div>
              )}
              <div>
                <div style={{ color: '#fff', fontWeight: 600 }}>{selectedDebugApp.name}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
                  {selectedDebugApp.iconDataUrl ? '✓ Has icon' : '✗ No icon'} • {prompts.length} prompts
                </div>
              </div>
            </div>
            {prompts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {prompts.map((prompt, i) => (
                  <div key={i} style={{
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    color: 'rgba(255,255,255,0.8)',
                    fontSize: 13,
                  }}>
                    "{prompt}"
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: 20 }}>
                No prompts available for this app
              </div>
            )}
          </div>
        ) : (
          // Show all apps grid
          <div style={{
            flex: 1,
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
            padding: 4,
          }}>
            {allApps.map((app, index) => {
              const hasPrompts = getAppPrompts(app.name).length > 0;
              return (
                <div
                  key={`${app.name}-${index}`}
                  onClick={() => setSelectedDebugApp(app)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: 8,
                    background: hasPrompts ? 'rgba(34, 197, 94, 0.1)' : 'rgba(100, 100, 100, 0.1)',
                    border: `1px solid ${hasPrompts ? 'rgba(34, 197, 94, 0.3)' : 'rgba(100, 100, 100, 0.2)'}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'transform 0.1s',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 4,
                    overflow: 'hidden',
                  }}>
                    {app.iconDataUrl ? (
                      <img
                        src={app.iconDataUrl}
                        alt={app.name}
                        style={{ width: 36, height: 36, objectFit: 'contain' }}
                      />
                    ) : (
                      <span style={{ fontSize: 16, opacity: 0.5 }}>?</span>
                    )}
                  </div>
                  <span style={{
                    color: hasPrompts ? '#fff' : 'rgba(255,255,255,0.4)',
                    fontSize: 9,
                    textAlign: 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    width: '100%',
                  }}>
                    {app.name}
                  </span>
                  {hasPrompts && (
                    <span style={{ fontSize: 8, color: 'rgba(34, 197, 94, 0.8)', marginTop: 2 }}>
                      {getAppPrompts(app.name).length} prompts
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: 380,
      margin: '0 auto',
      padding: '20px 16px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ textAlign: 'center', marginBottom: 20, flexShrink: 0 }}
      >
        <h2 style={{ ...styles.heading, fontSize: 24, marginBottom: 8 }}>
          What can Max do for you?
        </h2>
        <p
          style={{ ...styles.subheading, marginBottom: 0, fontSize: 14 }}
        >
          {isLoading
            ? 'Scanning your installed apps...'
            : isPersonalized
              ? `Max works with your ${detectedAppsCount > 50 ? '50+' : detectedAppsCount} installed apps`
              : 'Max is your AI assistant that can help with everyday tasks'
          }
        </p>
        {!isLoading && (
          <button
            onClick={() => setDebugMode(true)}
            style={{
              marginTop: 8,
              background: 'rgba(255, 165, 0, 0.2)',
              border: '1px solid rgba(255, 165, 0, 0.5)',
              color: '#ffa500',
              padding: '4px 10px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            🔍 Debug: View All App Icons
          </button>
        )}
      </motion.div>

      {/* Demo Animation Placeholder */}
      {/* Example prompts */}
      <div style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        marginBottom: 16,
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}>
          <div style={{
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            {isLoading ? 'Discovering...' : isPersonalized ? 'Based on your apps' : 'Examples'}
          </div>
          {isLoading && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            >
              <Loader2 style={{ width: 14, height: 14, color: 'rgba(255, 255, 255, 0.4)' }} />
            </motion.div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: 10,
                  }}
                >
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: 'rgba(255, 255, 255, 0.05)',
                  }} />
                  <div style={{
                    flex: 1,
                    height: 16,
                    borderRadius: 4,
                    background: 'rgba(255, 255, 255, 0.05)',
                  }} />
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="examples"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                paddingRight: 4,
              }}
            >
              {displayExamples.slice(0, 5).map((example, index) => {
                const Icon = example.icon;
                const hasRealIcon = example.appIconUrl && example.appIconUrl.startsWith('data:');

                // Debug logging
                if (index === 0) {
                  console.log('[DemoStep] First example:', {
                    appName: example.appName,
                    hasRealIcon,
                    iconUrlStart: example.appIconUrl?.substring(0, 50),
                    icon: example.icon?.name
                  });
                }

                return (
                  <motion.div
                    key={`${example.appName}-${index}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={showExamples ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: index * 0.1, duration: 0.3 }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 14px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 10,
                    }}
                  >
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: hasRealIcon ? 'transparent' : `${example.color}20`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      overflow: 'hidden',
                    }}>
                      {hasRealIcon ? (
                        <img
                          src={example.appIconUrl}
                          alt={example.appName || 'App icon'}
                          style={{
                            width: 28,
                            height: 28,
                            objectFit: 'contain',
                            imageRendering: 'auto',
                          }}
                          onError={(e) => {
                            console.error('[DemoStep] Image load error for', example.appName);
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : (
                        Icon ? <Icon style={{ width: 18, height: 18, color: example.color }} /> : null
                      )}
                    </div>
                    <span style={{
                      color: 'rgba(255, 255, 255, 0.85)',
                      fontSize: 13,
                      lineHeight: 1.4,
                      fontStyle: 'italic',
                    }}>
                      {example.text}
                    </span>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Buttons */}
      <div style={{
        display: 'flex',
        gap: 10,
        flexShrink: 0,
        marginTop: 'auto',
      }}>
        <button onClick={onBack} style={styles.secondaryButton}>
          Back
        </button>
        <motion.button
          onClick={() => onNext()}
          style={{
            ...styles.primaryButton,
            flex: 1,
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Get Started
          <ArrowRight style={{ width: 18, height: 18 }} />
        </motion.button>
      </div>
    </div>
  );
}

// ============================================================================
// STEP 1: LEGAL DISCLAIMER
// ============================================================================
function LegalStep({ onNext, onBack }) {
  const [agreed, setAgreed] = useState(false);

  const handleContinue = () => {
    if (!agreed) return;
    // Save agreement to localStorage
    try {
      localStorage.setItem('legal_agreement_accepted', 'true');
      localStorage.setItem('legal_agreement_date', new Date().toISOString());
    } catch (e) {
      console.warn('[Onboarding] Failed to save legal agreement:', e);
    }
    onNext({ legalAccepted: true });
  };

  return (
    <div style={{
      maxWidth: 380,
      margin: '0 auto',
      padding: '12px 16px 16px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ textAlign: 'center', marginBottom: 12, flexShrink: 0 }}
      >
        <h2 style={styles.heading}>Before We Begin</h2>
        <p style={styles.subheading}>
          We want to keep you safe. For your safety and ours, please review the terms and conditions below
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          textAlign: 'left',
          minHeight: 0,
        }}
      >
        {/* Legal Content Box */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12,
          padding: 16,
          maxHeight: 100,
          overflowY: 'auto',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
            color: BRAND_ORANGE,
            fontSize: 13,
            fontWeight: 600,
          }}>
            <FileWarning style={{ width: 16, height: 16 }} />
            Experimental Software Disclaimer
          </div>

          <div style={{
            fontSize: 12,
            lineHeight: 1.6,
            color: 'rgba(255, 255, 255, 0.7)',
          }}>
            <p style={{ marginBottom: 12 }}>
              <strong style={{ color: '#fff' }}>Agent Max is experimental software in active development.</strong> By using this application, you acknowledge and agree to the following:
            </p>

            <ul style={{
              margin: 0,
              paddingLeft: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              <li>
                <strong style={{ color: '#fff' }}>No Warranty:</strong> This software is provided "as is" without any warranties of any kind, express or implied.
              </li>
              <li>
                <strong style={{ color: '#fff' }}>Use at Your Own Risk:</strong> You assume all risks associated with using Agent Max, including but not limited to data loss, system issues, or unintended actions.
              </li>
              <li>
                <strong style={{ color: '#fff' }}>Limitation of Liability:</strong> The developers shall not be held liable for any damages, direct or indirect, arising from your use of this software.
              </li>
              <li>
                <strong style={{ color: '#fff' }}>AI Actions:</strong> Agent Max can perform actions on your computer. Always review suggested actions before approval.
              </li>
              <li>
                <strong style={{ color: '#fff' }}>Beta Features:</strong> Features may change, break, or be removed without notice.
              </li>
            </ul>

            <p style={{ marginTop: 12, marginBottom: 0, fontStyle: 'italic', color: 'rgba(255, 255, 255, 0.5)' }}>
              By continuing, you release Agent Max and its developers from any claims, damages, or liability.
            </p>
          </div>
        </div>

        {/* Agreement Checkbox */}
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            cursor: 'pointer',
            padding: 12,
            background: agreed ? BRAND_ORANGE_LIGHT : 'rgba(255, 255, 255, 0.03)',
            border: agreed ? `1px solid ${BRAND_ORANGE_GLOW}` : '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 10,
            transition: 'all 0.2s',
            flexShrink: 0,
          }}
        >
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            style={{ display: 'none' }}
          />
          <div style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            border: agreed ? 'none' : '2px solid rgba(255, 255, 255, 0.3)',
            background: agreed ? BRAND_ORANGE : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.2s',
          }}>
            {agreed && <Check style={{ width: 14, height: 14, color: '#fff' }} />}
          </div>
          <span style={{
            fontSize: 10,
            color: agreed ? '#fff' : 'rgba(255, 255, 255, 0.7)',
            lineHeight: 1.4,
          }}>
            I understand this is experimental software and I accept full responsibility for its use on my computer.
          </span>
        </label>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10, flexShrink: 0, marginTop: 'auto', paddingTop: 8 }}>
          <button onClick={onBack} style={styles.secondaryButton}>
            Back
          </button>
          <button
            onClick={handleContinue}
            disabled={!agreed}
            style={{
              ...styles.primaryButton,
              flex: 1,
              opacity: !agreed ? 0.4 : 1,
              cursor: !agreed ? 'not-allowed' : 'pointer',
            }}
          >
            I Agree & Continue
            <ArrowRight style={{ width: 18, height: 18 }} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================================
// STEP: NAME
// ============================================================================
function NameStep({ userData, onNext, onBack }) {
  const [name, setName] = useState(userData.name || '');
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleContinue = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const trimmedName = name.trim();
      
      // CONSOLIDATED: Only save to localStorage here
      // All Supabase saves happen in handleComplete() after account creation
      // This eliminates duplicate/redundant API calls (Issue 7)
      try { 
        localStorage.setItem('user_name', trimmedName); 
        console.log('[Onboarding] Name saved to localStorage:', trimmedName);
      } catch (e) {
        console.warn('[Onboarding] Failed to save name to localStorage:', e);
      }
      
      console.log('[Onboarding] Name step complete:', trimmedName);
      onNext({ name: trimmedName });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      maxWidth: 340,
      margin: '0 auto',
      padding: '12px 16px 16px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ textAlign: 'center', marginBottom: 16, flexShrink: 0 }}
      >
        <h2 style={styles.heading}>What should I call you?</h2>
        <p style={styles.subheading}>
          I'll use this to personalize your experience.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && handleContinue()}
          placeholder="Enter your name"
          autoFocus
          style={{
            ...styles.input,
            borderColor: focused ? BRAND_ORANGE_GLOW : 'rgba(255, 255, 255, 0.12)',
            boxShadow: focused ? `0 0 0 3px ${BRAND_ORANGE_LIGHT}` : 'none',
            marginBottom: 12,
          }}
        />

        <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
          <button onClick={onBack} style={styles.secondaryButton}>
            Back
          </button>
          <button
            onClick={handleContinue}
            disabled={!name.trim() || saving}
            style={{
              ...styles.primaryButton,
              flex: 1,
              opacity: !name.trim() || saving ? 0.5 : 1,
              cursor: !name.trim() || saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving...' : 'Continue'}
            {!saving && <ArrowRight style={{ width: 18, height: 18 }} />}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================================
// STEP: USE CASE (Rich Cards with Icons)
// ============================================================================
const USE_CASE_OPTIONS = [
  {
    id: 'school',
    icon: GraduationCap,
    title: 'School & Learning',
    description: 'Essays, research, study guides, homework help',
  },
  {
    id: 'coding',
    icon: Code2,
    title: 'Coding & Development',
    description: 'Debug code, write scripts, explain concepts',
  },
  {
    id: 'work',
    icon: Briefcase,
    title: 'Work & Business',
    description: 'Emails, reports, presentations, analysis',
  },
  {
    id: 'writing',
    icon: PenTool,
    title: 'Writing & Content',
    description: 'Articles, blogs, creative writing, editing',
  },
  {
    id: 'life',
    icon: Calendar,
    title: 'Daily Life',
    description: 'Planning, organization, reminders, research',
  },
];

function UseCaseStep({ userData, onNext, onBack }) {
  const [selected, setSelected] = useState(userData.helpCategory || '');

  const handleContinue = async () => {
    const option = USE_CASE_OPTIONS.find(o => o.id === selected);
    const helpCategory = option?.title || selected;
    
    // CONSOLIDATED: Only save to localStorage here
    // All Supabase saves happen in handleComplete() after account creation
    // This eliminates duplicate/redundant API calls (Issue 7)
    try { 
      localStorage.setItem('help_category', helpCategory); 
      console.log('[Onboarding] Help category saved to localStorage:', helpCategory);
    } catch (e) {
      console.warn('[Onboarding] Failed to save help_category to localStorage:', e);
    }
    
    console.log('[Onboarding] UseCase step complete:', helpCategory);
    onNext({ helpCategory });
  };

  return (
    <div style={{
      maxWidth: 380,
      margin: '0 auto',
      padding: '12px 16px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ textAlign: 'center', marginBottom: 8, flexShrink: 0 }}
      >
        <h2 style={{ ...styles.heading, fontSize: 20, marginBottom: 4 }}>
          {userData.name ? `Hey ${userData.name}!` : 'Hey there!'} What brings you here?
        </h2>
        <p style={{ ...styles.subheading, marginBottom: 4, fontSize: 12 }}>
          This helps me give you better suggestions.
        </p>
      </motion.div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingBottom: 4, paddingRight: 4 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {USE_CASE_OPTIONS.map((option, index) => {
            const Icon = option.icon;
            const isSelected = selected === option.id;
            
            return (
              <motion.button
                key={option.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => setSelected(option.id)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: isSelected 
                    ? BRAND_ORANGE_LIGHT
                    : 'rgba(255, 255, 255, 0.04)',
                  border: isSelected 
                    ? `1.5px solid ${BRAND_ORANGE_GLOW}` 
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: isSelected 
                    ? BRAND_ORANGE
                    : 'rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.2s ease',
                }}>
                  <Icon style={{ 
                    width: 18, 
                    height: 18, 
                    color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.6)' 
                  }} />
                </div>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    color: '#ffffff',
                    fontSize: 14, 
                    fontWeight: 600,
                  }}>
                    {option.title}
                  </div>
                  <div style={{ 
                    color: 'rgba(255, 255, 255, 0.5)', 
                    fontSize: 11,
                    lineHeight: 1.2,
                  }}>
                    {option.description}
                  </div>
                </div>

                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: BRAND_ORANGE,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Check style={{ width: 12, height: 12, color: '#ffffff' }} />
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div style={{ 
        display: 'flex', 
        gap: 8, 
        paddingTop: 10,
        flexShrink: 0,
        marginTop: 'auto',
      }}>
        <button onClick={onBack} style={styles.secondaryButton}>
          Back
        </button>
        <button
          onClick={handleContinue}
          disabled={!selected}
          style={{
            ...styles.primaryButton,
            flex: 1,
            opacity: !selected ? 0.5 : 1,
            cursor: !selected ? 'not-allowed' : 'pointer',
          }}
        >
          Continue
          <ArrowRight style={{ width: 18, height: 18 }} />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// STEP: MODE EXPLAINER (Chatty vs Autonomous)
// ============================================================================
const MODE_OPTIONS = [
  {
    id: 'chatty',
    icon: MessageSquare,
    title: 'Chatty Mode',
    description: 'Have a conversation with Max. Ask questions, get answers, brainstorm ideas.',
    features: ['Quick answers & explanations', 'Brainstorming & ideation', 'Writing assistance'],
    recommended: true,
  },
  {
    id: 'autonomous',  // NOTE: id must stay 'autonomous' - only display title changes
    icon: Bot,
    title: 'Auto Mode',
    description: 'Let Max take control of your computer to complete tasks for you.',
    features: ['Controls mouse & keyboard', 'Opens apps & websites', 'Completes multi-step tasks'],
    recommended: false,
  },
];

function ModeExplainerStep({ onNext, onBack }) {
  return (
    <div style={{
      maxWidth: 380,
      margin: '0 auto',
      padding: '12px 16px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ textAlign: 'center', marginBottom: 12, flexShrink: 0 }}
      >
        <h2 style={{ ...styles.heading, fontSize: 20, marginBottom: 4 }}>
          Two Ways to Use Max
        </h2>
        <p style={{ ...styles.subheading, marginBottom: 4, fontSize: 12 }}>
          Switch between modes anytime using the toggle in the chat bar.
        </p>
      </motion.div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingBottom: 4 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {MODE_OPTIONS.map((option, index) => {
            const Icon = option.icon;

            return (
              <motion.div
                key={option.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                style={{
                  width: '100%',
                  padding: '14px 14px',
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: option.id === 'chatty'
                      ? BRAND_ORANGE
                      : 'rgba(139, 92, 246, 0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon style={{
                      width: 20,
                      height: 20,
                      color: '#ffffff',
                    }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 4,
                    }}>
                      <span style={{
                        color: '#ffffff',
                        fontSize: 15,
                        fontWeight: 600,
                      }}>
                        {option.title}
                      </span>
                      {option.recommended && (
                        <span style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: BRAND_ORANGE,
                          background: BRAND_ORANGE_LIGHT,
                          padding: '2px 6px',
                          borderRadius: 4,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}>
                          Default
                        </span>
                      )}
                    </div>
                    <div style={{
                      color: 'rgba(255, 255, 255, 0.6)',
                      fontSize: 12,
                      lineHeight: 1.4,
                      marginBottom: 8,
                    }}>
                      {option.description}
                    </div>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}>
                      {option.features.map((feature, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 11,
                            color: 'rgba(255, 255, 255, 0.5)',
                          }}
                        >
                          <Check style={{
                            width: 12,
                            height: 12,
                            color: option.id === 'chatty' ? BRAND_ORANGE : 'rgba(139, 92, 246, 0.8)',
                          }} />
                          {feature}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: 8,
        paddingTop: 10,
        flexShrink: 0,
        marginTop: 'auto',
      }}>
        <button onClick={onBack} style={styles.secondaryButton}>
          Back
        </button>
        <button
          onClick={() => onNext()}
          style={{
            ...styles.primaryButton,
            flex: 1,
          }}
        >
          Got it
          <ArrowRight style={{ width: 18, height: 18 }} />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// STEP 3: EMAIL/ACCOUNT (Sign Up or Sign In)
// ============================================================================
function AccountStep({ onNext, onBack, userData }) {
  const [mode, setMode] = useState('signin'); // 'signin', 'signup', or 'forgot-password'
  const [email, setEmail] = useState(userData?.email || '');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [error, setError] = useState(null);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const validEmail = (v) => /.+@.+\..+/.test(v);
  const strongPw = (v) => v.length >= 8;
  const canSubmit = validEmail(email) && strongPw(password) && !saving;
  const canSubmitReset = validEmail(email) && !saving;

  const handleSignUp = async () => {
    console.log('[Onboarding] ========== SIGN UP HANDLER CALLED ==========');
    console.log('[Onboarding] Mode:', mode, '| Email:', email);
    if (!canSubmit) return;
    setSaving(true);
    setError(null);

    // Track sign-up attempt
    trackSignInAttempted('email_signup');

    try {
      const trimmedEmail = email.trim();

      // First check if user already exists
      const { data: existingUser, error: checkError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: password,
      });

      if (existingUser?.user) {
        // User exists and password is correct - they're signing in, not signing up
        console.log('[Onboarding] Existing user signed in via sign-up form:', trimmedEmail);
        try { localStorage.setItem('user_email', trimmedEmail); } catch {}

        // Check if email is verified
        const isVerified = existingUser.user.email_confirmed_at != null;

        // Ensure user row exists
        await ensureUsersRow(trimmedEmail);

        // CRITICAL: Check if user already has subscription/credits - skip to complete if so
        let hasActiveSubscription = false;
        let hasExistingProfile = false;
        let hasSignificantCredits = false;
        try {
          const { data: userRecords } = await supabase
            .from('users')
            .select('id, subscription_status, subscription_tier, credits, metadata, created_at')
            .ilike('email', trimmedEmail.toLowerCase())
            .order('created_at', { ascending: false });

          if (userRecords && userRecords.length > 0) {
            const activeUser = userRecords.find(u => u.subscription_status === 'active');
            const creditsUser = userRecords.find(u => (u.credits || 0) > 50);
            const profileUser = userRecords.find(u => u.metadata?.profile?.name);
            const existingUserRecord = activeUser || creditsUser || profileUser || userRecords[0];

            hasActiveSubscription = existingUserRecord.subscription_status === 'active';
            hasExistingProfile = !!existingUserRecord.metadata?.profile?.name;
            hasSignificantCredits = (existingUserRecord.credits || 0) > 50;

            try { localStorage.setItem('user_id', existingUserRecord.id); } catch {}

            console.log('[Onboarding] Sign-up form - existing user check:', {
              email: trimmedEmail,
              hasActiveSubscription,
              hasExistingProfile,
              hasSignificantCredits,
              credits: existingUserRecord.credits
            });
          }
        } catch (subErr) {
          console.warn('[Onboarding] Failed to check user status:', subErr);
        }

        // Determine skip destination
        let skipToStep = null;
        if (hasActiveSubscription || hasExistingProfile || hasSignificantCredits) {
          skipToStep = 'complete';
          console.log('[Onboarding] Returning user (via sign-up form) - skipping to complete');
        } else if (isVerified) {
          skipToStep = 'google';
        }

        onNext?.({
          amxAccount: true,
          email: trimmedEmail,
          isExistingUser: true,
          emailVerified: isVerified,
          hasActiveSubscription,
          skipToStep
        });
        return;
      }

      // If we get invalid_credentials error, user might exist with different password
      // or might not exist at all - try to create account
      if (checkError?.message?.includes('Invalid login credentials')) {
        // Could be wrong password OR new user - try to sign up
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password: password,
        });

        if (signUpError) {
          // If user already exists, show error
          if (signUpError.message?.includes('already registered') ||
              signUpError.message?.includes('User already registered')) {
            setError('An account with this email already exists. Try signing in instead.');
            setSaving(false);
            return;
          }
          throw signUpError;
        }

        // New user created successfully
        try { localStorage.setItem('user_email', trimmedEmail); } catch {}

        // Ensure user row exists before writing preferences
        const userRowCreated = await ensureUsersRow(trimmedEmail);

        if (userRowCreated) {
          try { await setUserPreference('email', trimmedEmail); } catch (e) {
            console.warn('[Onboarding] Failed to save email preference:', e);
          }
          try { await setUserPreference('has_password', 'true'); } catch (e) {
            console.warn('[Onboarding] Failed to save password preference:', e);
          }
        }

        console.log('[Onboarding] Account created for:', trimmedEmail);
        // Track successful sign-up
        trackSignInSucceeded(trimmedEmail, 'email_signup');
        trackOnboardingStepCompleted('account', { method: 'signup', isNewUser: true });
        onNext?.({ amxAccount: true, email: trimmedEmail, isExistingUser: false });
        return;
      }

      // Other errors
      if (checkError) throw checkError;

    } catch (err) {
      console.error('[Onboarding] Account operation failed:', err);
      // Track sign-up failure
      trackSignInFailed('email_signup', err);
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignIn = async () => {
    console.log('[Onboarding] ========== SIGN IN HANDLER CALLED ==========');
    console.log('[Onboarding] Mode:', mode, '| Email:', email);
    if (!canSubmit) return;
    setSaving(true);
    setError(null);

    // Track sign-in attempt
    trackSignInAttempted('email_signin');

    try {
      const trimmedEmail = email.trim();

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: password,
      });

      if (signInError) {
        // Track sign-in failure
        trackSignInFailed('email_signin', signInError);
        if (signInError.message?.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please try again.');
        } else if (signInError.message?.includes('Email not confirmed')) {
          setError('Please verify your email first. Check your inbox.');
        } else {
          setError(signInError.message || 'Sign in failed. Please try again.');
        }
        setSaving(false);
        return;
      }

      if (data?.user) {
        console.log('[Onboarding] User signed in:', trimmedEmail);
        try { localStorage.setItem('user_email', trimmedEmail); } catch {}

        // Check if email is verified
        const isVerified = data.user.email_confirmed_at != null;

        // Ensure user row exists
        await ensureUsersRow(trimmedEmail);

        // CRITICAL: Check if user already exists and has profile/subscription
        // Returning users should skip onboarding entirely
        let hasActiveSubscription = false;
        let hasExistingProfile = false;
        let hasSignificantCredits = false;
        let existingUserId = null;
        try {
          // Get ALL user records for this email (handles duplicates)
          // Prioritize: active subscription > has credits > has profile > newest
          // Use case-insensitive match for email
          const { data: userRecords } = await supabase
            .from('users')
            .select('id, subscription_status, subscription_tier, credits, metadata, created_at')
            .ilike('email', trimmedEmail.toLowerCase())
            .order('created_at', { ascending: false });

          if (userRecords && userRecords.length > 0) {
            // Find best record: prefer active subscription, then credits, then profile
            const activeUser = userRecords.find(u => u.subscription_status === 'active');
            const creditsUser = userRecords.find(u => (u.credits || 0) > 50); // More than free trial
            const profileUser = userRecords.find(u => u.metadata?.profile?.name);
            const existingUser = activeUser || creditsUser || profileUser || userRecords[0];

            hasActiveSubscription = existingUser.subscription_status === 'active';
            hasExistingProfile = !!existingUser.metadata?.profile?.name;
            hasSignificantCredits = (existingUser.credits || 0) > 50; // More than free trial amount
            existingUserId = existingUser.id;

            // Store the user_id so profile loading works
            try { localStorage.setItem('user_id', existingUser.id); } catch {}

            // Also restore the user's name from metadata if available
            const existingName = existingUser.metadata?.profile?.name;
            if (existingName) {
              try { localStorage.setItem('user_name', existingName); } catch {}
              // Update userData with the name
              userData.name = existingName;
            }

            console.log('[Onboarding] Existing user check:', {
              email: trimmedEmail,
              userId: existingUser.id,
              subscriptionStatus: existingUser.subscription_status,
              tier: existingUser.subscription_tier,
              credits: existingUser.credits,
              name: existingName,
              hasActiveSubscription,
              hasExistingProfile,
              hasSignificantCredits,
              totalRecords: userRecords.length
            });
          }
        } catch (subErr) {
          console.warn('[Onboarding] Failed to check user status:', subErr);
        }

        // For returning users (have profile OR active subscription OR significant credits), skip to complete
        // This is a returning user on a new device - no need to re-onboard
        let skipToStep = null;
        if (hasActiveSubscription || hasExistingProfile || hasSignificantCredits) {
          skipToStep = 'complete'; // Skip everything, go to finish
          console.log('[Onboarding] Returning user detected - skipping to complete', {
            reason: hasActiveSubscription ? 'active subscription' : hasSignificantCredits ? 'has credits (>50)' : 'has profile'
          });
        } else if (isVerified) {
          skipToStep = 'google'; // Skip email verification, continue normal flow
        }

        console.log('[Onboarding] ========== CALLING onNext ==========');
        console.log('[Onboarding] Final skipToStep value:', skipToStep);
        console.log('[Onboarding] Full data:', {
          amxAccount: true,
          email: trimmedEmail,
          isExistingUser: true,
          emailVerified: isVerified,
          hasActiveSubscription,
          skipToStep
        });

        // Track successful sign-in
        trackSignInSucceeded(existingUserId || trimmedEmail, 'email_signin');
        trackOnboardingStepCompleted('account', {
          method: 'signin',
          isReturningUser: hasExistingProfile || hasActiveSubscription,
          hasSubscription: hasActiveSubscription
        });

        onNext?.({
          amxAccount: true,
          email: trimmedEmail,
          isExistingUser: true,
          emailVerified: isVerified,
          hasActiveSubscription,
          skipToStep
        });
      }
    } catch (err) {
      console.error('[Onboarding] Sign in failed:', err);
      // Track sign-in failure
      trackSignInFailed('email_signin', err);
      setError(err.message || 'Sign in failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleForgotPassword = async () => {
    console.log('[Onboarding] ========== FORGOT PASSWORD HANDLER CALLED ==========');
    console.log('[Onboarding] Email:', email);
    if (!canSubmitReset) return;
    setSaving(true);
    setError(null);
    setResetEmailSent(false);

    try {
      const trimmedEmail = email.trim();
      const result = await resetPassword(trimmedEmail);

      if (!result.success) {
        setError(result.error || 'Failed to send reset email. Please try again.');
        return;
      }

      console.log('[Onboarding] Password reset email sent to:', trimmedEmail);
      setResetEmailSent(true);
    } catch (err) {
      console.error('[Onboarding] Forgot password failed:', err);
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = mode === 'signin' ? handleSignIn : handleSignUp;

  return (
    <div style={{
      maxWidth: 340,
      margin: '0 auto',
      padding: '20px',
      textAlign: 'center',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 style={styles.heading}>
          {mode === 'forgot-password'
            ? 'Reset your password'
            : mode === 'signin'
              ? 'Welcome back!'
              : userData?.name
                ? `Almost there, ${userData.name}!`
                : 'Create your account'}
        </h2>
        <p style={styles.subheading}>
          {mode === 'forgot-password'
            ? "Enter your email and we'll send you a reset link."
            : mode === 'signin'
              ? 'Sign in to access your Agent Max account.'
              : 'New here? Create an account to get started.'}
        </p>
      </motion.div>

      {/* Mode Toggle - Hide when in forgot-password mode */}
      {mode !== 'forgot-password' && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.05 }}
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <div style={{
          display: 'inline-flex',
          background: 'rgba(255, 255, 255, 0.06)',
          borderRadius: 8,
          padding: 3,
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}>
          <button
            onClick={() => { setMode('signin'); setError(null); }}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              color: mode === 'signin' ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
              background: mode === 'signin' ? BRAND_ORANGE : 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode('signup'); setError(null); }}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              color: mode === 'signup' ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
              background: mode === 'signup' ? BRAND_ORANGE : 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Sign Up
          </button>
        </div>
      </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <input
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(null); }}
          onFocus={() => setEmailFocused(true)}
          onBlur={() => setEmailFocused(false)}
          placeholder="Email address"
          type="email"
          style={{
            ...styles.input,
            borderColor: emailFocused ? BRAND_ORANGE_GLOW : 'rgba(255, 255, 255, 0.12)',
            boxShadow: emailFocused ? `0 0 0 3px ${BRAND_ORANGE_LIGHT}` : 'none',
          }}
        />

        {/* Password input - hidden in forgot-password mode */}
        {mode !== 'forgot-password' && (
          <input
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            onKeyDown={(e) => e.key === 'Enter' && canSubmit && handleSubmit()}
            placeholder={mode === 'signin' ? 'Password' : 'Create password (8+ characters)'}
            type="password"
            style={{
              ...styles.input,
              borderColor: passwordFocused ? BRAND_ORANGE_GLOW : 'rgba(255, 255, 255, 0.12)',
              boxShadow: passwordFocused ? `0 0 0 3px ${BRAND_ORANGE_LIGHT}` : 'none',
            }}
          />
        )}

        {/* Forgot Password link - only show in signin mode */}
        {mode === 'signin' && (
          <button
            onClick={() => { setMode('forgot-password'); setError(null); setResetEmailSent(false); }}
            style={{
              background: 'none',
              border: 'none',
              color: BRAND_ORANGE,
              fontSize: 13,
              cursor: 'pointer',
              textAlign: 'right',
              padding: 0,
              marginTop: -4,
            }}
          >
            Forgot password?
          </button>
        )}

        {/* Success Message for password reset */}
        {mode === 'forgot-password' && resetEmailSent && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              padding: 12,
              background: 'rgba(34, 197, 94, 0.1)',
              borderRadius: 8,
              border: '1px solid rgba(34, 197, 94, 0.2)',
              color: '#22c55e',
              fontSize: 13,
              textAlign: 'left',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <Check style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }} />
            Check your email for a password reset link.
          </motion.div>
        )}

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              padding: 12,
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: 8,
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#ef4444',
              fontSize: 13,
              textAlign: 'left',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <AlertCircle style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }} />
            {error}
          </motion.div>
        )}

        {/* Buttons - different layout for forgot-password mode */}
        {mode === 'forgot-password' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            <button
              onClick={handleForgotPassword}
              disabled={!canSubmitReset || resetEmailSent}
              style={{
                ...styles.primaryButton,
                opacity: (!canSubmitReset || resetEmailSent) ? 0.5 : 1,
                cursor: (!canSubmitReset || resetEmailSent) ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Sending...' : resetEmailSent ? 'Email Sent!' : 'Send Reset Link'}
            </button>
            <button
              onClick={() => { setMode('signin'); setError(null); setResetEmailSent(false); }}
              style={{
                ...styles.secondaryButton,
                width: '100%',
              }}
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button onClick={onBack} style={styles.secondaryButton}>
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                ...styles.primaryButton,
                flex: 1,
                opacity: !canSubmit ? 0.5 : 1,
                cursor: !canSubmit ? 'not-allowed' : 'pointer',
              }}
            >
              {saving
                ? (mode === 'signin' ? 'Signing in...' : 'Creating...')
                : (mode === 'signin' ? 'Sign In' : 'Create Account')}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ============================================================================
// STEP 4: EMAIL VERIFICATION
// ============================================================================
function EmailVerificationStep({ userData, onNext, onBack }) {
  const [checking, setChecking] = useState(false);
  const [verified, setVerified] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState(null);
  const pollIntervalRef = useRef(null);

  // Start polling for email verification
  useEffect(() => {
    let mounted = true;

    const checkVerification = async () => {
      if (!supabase) return false;

      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
          console.log('[EmailVerification] Error getting user:', error.message);
          return false;
        }

        // Check if email is confirmed
        if (user?.email_confirmed_at) {
          console.log('[EmailVerification] Email verified!');
          return true;
        }

        return false;
      } catch (err) {
        console.log('[EmailVerification] Check failed:', err.message);
        return false;
      }
    };

    // Poll every 3 seconds
    pollIntervalRef.current = setInterval(async () => {
      const isVerified = await checkVerification();
      if (mounted && isVerified) {
        setVerified(true);
        clearInterval(pollIntervalRef.current);
        // Auto-proceed after brief delay
        setTimeout(() => {
          if (mounted) onNext({ emailVerified: true });
        }, 1500);
      }
    }, 3000);

    // Initial check
    checkVerification().then(isVerified => {
      if (mounted && isVerified) {
        setVerified(true);
        clearInterval(pollIntervalRef.current);
        setTimeout(() => {
          if (mounted) onNext({ emailVerified: true });
        }, 1500);
      }
    });

    return () => {
      mounted = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [onNext]);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleResendEmail = async () => {
    if (resending || resendCooldown > 0) return;

    setResending(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: userData?.email,
      });

      if (error) throw error;

      setResendCooldown(60); // 60 second cooldown
      console.log('[EmailVerification] Resent verification email');
    } catch (err) {
      console.error('[EmailVerification] Resend failed:', err);
      setError('Failed to resend email. Please try again.');
    } finally {
      setResending(false);
    }
  };

  // Email verification is required - no skip option

  return (
    <div style={{
      maxWidth: 340,
      margin: '0 auto',
      padding: '20px',
      textAlign: 'center',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div style={{
          width: 64,
          height: 64,
          margin: '0 auto 20px',
          borderRadius: 16,
          background: verified
            ? 'rgba(34, 197, 94, 0.15)'
            : 'rgba(245, 158, 11, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
        }}>
          {verified ? (
            <Check style={{ width: 32, height: 32, color: '#22c55e' }} />
          ) : (
            <Mail style={{ width: 32, height: 32, color: BRAND_ORANGE }} />
          )}
        </div>

        <h2 style={{ ...styles.heading, marginBottom: 8 }}>
          {verified ? 'Email Verified!' : 'Verify Your Email'}
        </h2>
        <p style={{ ...styles.subheading, marginBottom: 24 }}>
          {verified
            ? 'Your account is confirmed. Continuing...'
            : `We sent a verification link to ${userData?.email || 'your email'}. Please check your inbox and click the link to continue.`
          }
        </p>
      </motion.div>

      {!verified && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          {/* Checking indicator */}
          <div style={{
            padding: 16,
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: 12,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}>
            <div style={{
              width: 20,
              height: 20,
              border: '2px solid rgba(245, 158, 11, 0.3)',
              borderTopColor: BRAND_ORANGE,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 14 }}>
              Waiting for verification...
            </span>
          </div>

          {error && (
            <div style={{
              padding: 12,
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: 8,
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#ef4444',
              fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {/* Resend button */}
          <button
            onClick={handleResendEmail}
            disabled={resending || resendCooldown > 0}
            style={{
              ...styles.secondaryButton,
              width: '100%',
              opacity: (resending || resendCooldown > 0) ? 0.5 : 1,
              cursor: (resending || resendCooldown > 0) ? 'not-allowed' : 'pointer',
            }}
          >
            {resending
              ? 'Sending...'
              : resendCooldown > 0
                ? `Resend in ${resendCooldown}s`
                : 'Resend Verification Email'
            }
          </button>

          {/* Back button */}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button onClick={onBack} style={{ ...styles.secondaryButton, width: '100%' }}>
              Back
            </button>
          </div>

          <p style={{
            color: 'rgba(255, 255, 255, 0.4)',
            fontSize: 11,
            marginTop: 8,
            lineHeight: 1.4,
          }}>
            Check your spam folder if you don't see the email.
          </p>
        </motion.div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// STEP 5: GOOGLE CONNECT
// ============================================================================
function GoogleStep({ userData, onNext, onBack }) {
  const handleSkip = () => onNext?.({ googleConnected: false });
  const comingSoon = isGoogleComingSoon(userData?.email);

  // Coming Soon view for non-beta users
  if (comingSoon) {
    return (
      <div style={{
        maxWidth: 340,
        margin: '0 auto',
        padding: '16px 20px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
      }}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div style={{
            width: 56,
            height: 56,
            margin: '0 auto 16px',
            borderRadius: 14,
            background: 'rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}>
            <svg viewBox="0 0 48 48" style={{ width: 32, height: 32, opacity: 0.5 }}>
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
          </div>

          <h2 style={{ ...styles.heading, marginBottom: 8 }}>Google Integration</h2>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(234, 88, 12, 0.15) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 20,
            padding: '6px 14px',
            marginBottom: 16,
          }}>
            <Clock style={{ width: 14, height: 14, color: BRAND_ORANGE }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: BRAND_ORANGE }}>Coming Soon</span>
          </div>
          <p style={{ ...styles.subheading, marginBottom: 16, fontSize: 14 }}>
            Gmail and Calendar integration is coming soon! We're working hard to bring you seamless email and calendar management.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <p style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.6)', lineHeight: 1.5 }}>
            <strong style={{ color: 'rgba(255, 255, 255, 0.8)' }}>What's coming:</strong><br/>
            • Read and send emails hands-free<br/>
            • Check your calendar and create events<br/>
            • Smart email summaries and drafts
          </p>
        </motion.div>

        <div style={{
          display: 'flex',
          gap: 10,
          paddingTop: 10,
          flexShrink: 0,
          marginTop: 'auto',
        }}>
          <button onClick={onBack} style={styles.secondaryButton}>
            Back
          </button>
          <button
            onClick={handleSkip}
            style={{
              ...styles.primaryButton,
              flex: 1,
              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
              boxShadow: '0 4px 14px rgba(34, 197, 94, 0.35)',
            }}
          >
            Continue
            <ArrowRight style={{ width: 18, height: 18 }} />
          </button>
        </div>
      </div>
    );
  }

  // Full access view for beta users
  return (
    <div style={{
      maxWidth: 340,
      margin: '0 auto',
      padding: '16px 20px',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100%',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div style={{
          width: 56,
          height: 56,
          margin: '0 auto 16px',
          borderRadius: 14,
          background: 'rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg viewBox="0 0 48 48" style={{ width: 32, height: 32 }}>
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
        </div>

        <h2 style={{ ...styles.heading, marginBottom: 8 }}>Connect Google</h2>
        <p style={{ ...styles.subheading, marginBottom: 16, fontSize: 14 }}>
          Enable Gmail and Calendar integration for hands-free email management.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ marginBottom: 16 }}
      >
        <GoogleConnect compact />
      </motion.div>

      <div style={{
        display: 'flex',
        gap: 10,
        paddingTop: 10,
        flexShrink: 0,
        marginTop: 'auto',
      }}>
        <button onClick={onBack} style={styles.secondaryButton}>
          Back
        </button>
        <button
          onClick={handleSkip}
          style={{
            ...styles.primaryButton,
            flex: 1,
            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
            boxShadow: '0 4px 14px rgba(34, 197, 94, 0.35)',
          }}
        >
          Continue
          <ArrowRight style={{ width: 18, height: 18 }} />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// STEP 6: SUBSCRIPTION (Enhanced with Feature Comparison)
// ============================================================================
const STRIPE_PAYMENT_LINKS = {
  starter_monthly: 'https://buy.stripe.com/eVqbIU2nN1uue2o2Q11Nu06',
  starter_annual: 'https://buy.stripe.com/00w5kwe6v8WW8I44Y91Nu05',
  premium_monthly: 'https://buy.stripe.com/fZueV66E32yy3nKgGR1Nu03',
  premium_annual: 'https://buy.stripe.com/00w00c0fF8WWbUg9ep1Nu04',
  pro_monthly: 'https://buy.stripe.com/bJe14g8Mb4GG1fCcqB1Nu02',
  pro_annual: 'https://buy.stripe.com/fZubIU8Mb8WW8I4fCN1Nu01',
};

const SUBSCRIPTION_TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    icon: Zap,
    monthlyPrice: 10,
    yearlyPrice: 100,
    creditsPerWeek: 150,
    features: [
      { text: '150 credits per week', included: true },
      { text: 'Email support', included: true },
      { text: 'Core AI features', included: true },
      { text: 'Priority responses', included: false },
      { text: 'Advanced integrations', included: false },
    ]
  },
  {
    id: 'premium',
    name: 'Premium',
    icon: Star,
    monthlyPrice: 18,
    yearlyPrice: 180,
    creditsPerWeek: 400,
    popular: true,
    features: [
      { text: '400 credits per week', included: true },
      { text: 'Priority support', included: true },
      { text: 'All AI features', included: true },
      { text: 'Priority responses', included: true },
      { text: 'Google integration', included: true },
    ]
  },
  {
    id: 'pro',
    name: 'Pro',
    icon: Crown,
    monthlyPrice: 30,
    yearlyPrice: 300,
    creditsPerWeek: 600,
    features: [
      { text: '600 credits per week', included: true },
      { text: 'Dedicated support', included: true },
      { text: 'All AI features', included: true },
      { text: 'Fastest responses', included: true },
      { text: 'Custom workflows', included: true },
    ]
  }
];

// Beta tester feature flag name
const BETA_TESTER_FLAG = 'beta-free-credits';
const BETA_CREDITS_AMOUNT = 250;

function SubscriptionStep({ userData, onNext, onBack }) {
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [selectedTier, setSelectedTier] = useState('premium');
  const [opening, setOpening] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [waitingForPayment, setWaitingForPayment] = useState(false);
  const [pendingPlan, setPendingPlan] = useState(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [verificationFailed, setVerificationFailed] = useState(false);
  const pollIntervalRef = useRef(null);

  // Beta tester state
  const [isBetaTester, setIsBetaTester] = useState(null); // null = loading, true/false = resolved
  const [grantingCredits, setGrantingCredits] = useState(false);
  const [creditsGranted, setCreditsGranted] = useState(false);

  // Check beta tester flag on mount
  useEffect(() => {
    async function checkBetaFlag() {
      try {
        const isBeta = await getFeatureFlag(BETA_TESTER_FLAG, false);
        console.log('[Onboarding] Beta tester flag:', isBeta);
        setIsBetaTester(isBeta);
      } catch (err) {
        console.error('[Onboarding] Failed to check beta flag:', err);
        setIsBetaTester(false);
      }
    }
    checkBetaFlag();
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const checkSubscriptionStatus = async (email) => {
    try {
      // Try subscription API first
      const response = await subscriptionAPI.getStatus(email);
      console.log('[Onboarding] Subscription status:', response?.data);
      if (response?.data?.status === 'active') return true;
      
      // Also check if credits increased (webhook might have added credits)
      const userId = localStorage.getItem('user_id');
      if (userId) {
        const creditsResponse = await creditsAPI.getBalance(userId);
        const credits = creditsResponse?.data?.credits || creditsResponse?.data?.balance || 0;
        console.log('[Onboarding] Credits balance:', credits);
        // If user has more than free trial credits, they probably paid
        if (credits > 50) return true;
      }
      
      return false;
    } catch (err) {
      console.log('[Onboarding] Status check failed:', err.message);
      // Don't fail silently - log but return false
      return false;
    }
  };

  const handleSubscribe = async (tierId) => {
    setOpening(true);
    const planId = `${tierId}_${billingCycle === 'yearly' ? 'annual' : 'monthly'}`;
    const paymentLink = STRIPE_PAYMENT_LINKS[planId];
    
    if (paymentLink) {
      try {
        // CRITICAL FIX: Append client_reference_id so webhook can identify the user
        // Without this, Stripe can't link the payment to the correct user account
        const userId = localStorage.getItem('user_id');
        const userEmail = userData?.email || localStorage.getItem('user_email');
        
        // Build payment link with user identification
        let fullPaymentLink = paymentLink;
        if (userId) {
          fullPaymentLink += `?client_reference_id=${encodeURIComponent(userId)}`;
          // Also prefill email if available for better UX
          if (userEmail) {
            fullPaymentLink += `&prefilled_email=${encodeURIComponent(userEmail)}`;
          }
          console.log('[Onboarding] Payment link with user ID:', fullPaymentLink);
        } else {
          console.warn('[Onboarding] No user_id found - payment may not link correctly!');
        }
        
        // Open payment link in browser
        if (window.electron?.openExternal) {
          await window.electron.openExternal(fullPaymentLink);
        } else {
          window.open(fullPaymentLink, '_blank');
        }
        
        // Save pending plan
        try { await setUserPreference('selected_plan', planId); } catch {}
        try { localStorage.setItem('selected_plan', planId); } catch {}
        console.log('[Onboarding] Subscription checkout opened:', planId);

        // Track checkout started
        const tierData = SUBSCRIPTION_TIERS.find(t => t.id === tierId);
        const amount = billingCycle === 'yearly' ? tierData?.yearlyPrice : tierData?.monthlyPrice;
        trackCheckoutStarted(planId, amount);
        
        // Show waiting state
        setOpening(false);
        setWaitingForPayment(true);
        setPendingPlan(planId);
        
        // Start polling for payment confirmation (reuse userEmail from above)
        if (userEmail) {
          let pollCount = 0;
          const maxPolls = 60; // Poll for up to 2 minutes (2s intervals)
          
          pollIntervalRef.current = setInterval(async () => {
            pollCount++;
            console.log(`[Onboarding] Checking payment status (${pollCount}/${maxPolls})...`);
            
            const isActive = await checkSubscriptionStatus(userEmail);
            if (isActive) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
              setWaitingForPayment(false);
              console.log('[Onboarding] ✅ Payment confirmed!');
              // Track checkout completed
              trackCheckoutCompleted(planId, amount, null);
              onNext({ selectedPlan: planId, paymentConfirmed: true });
            }
            
            if (pollCount >= maxPolls) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
              // Don't auto-proceed - let user manually confirm or skip
              console.log('[Onboarding] Payment polling timeout');
            }
          }, 2000);
        }
      } catch (err) {
        console.error('[Onboarding] Failed to open payment link:', err);
        setOpening(false);
      }
    }
  };

  const handleConfirmPayment = async () => {
    // User manually confirms they completed payment
    setVerifyingPayment(true);
    setVerificationFailed(false);
    
    const userEmail = userData?.email || localStorage.getItem('user_email');
    
    // Try to verify payment
    const isActive = userEmail ? await checkSubscriptionStatus(userEmail) : false;
    
    if (isActive) {
      // Payment verified!
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setVerifyingPayment(false);
      setWaitingForPayment(false);
      // Track checkout completed
      trackCheckoutCompleted(pendingPlan, null, null);
      onNext({ selectedPlan: pendingPlan, paymentConfirmed: true });
      return;
    }
    
    // Payment not verified - show option to proceed anyway or retry
    setVerifyingPayment(false);
    setVerificationFailed(true);
  };
  
  const handleProceedWithoutVerification = () => {
    // User insists they paid - trust them and proceed
    // The webhook will eventually update their credits
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    try { localStorage.setItem('payment_pending_verification', pendingPlan); } catch {}
    setWaitingForPayment(false);
    setVerificationFailed(false);
    onNext({ selectedPlan: pendingPlan, paymentConfirmed: false, pendingVerification: true });
  };

  const handleCancelWaiting = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setWaitingForPayment(false);
    setPendingPlan(null);
    setVerificationFailed(false); // Reset verification state
  };

  const handleFreeTrial = async () => {
    // Stop any polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    
    // Save to localStorage
    try { localStorage.setItem('selected_plan', 'free_trial'); } catch {}
    try { setUserPreference('selected_plan', 'free_trial'); } catch {}
    console.log('[Onboarding] Free trial selected');
    
    // Add 50 free credits to user account
    try {
      const userId = localStorage.getItem('user_id');
      if (userId) {
        const response = await creditsAPI.addCredits(userId, 50, 'free_trial');
        console.log('[Onboarding] Added 50 free credits:', response?.data);
      } else {
        console.warn('[Onboarding] No user_id found, skipping credit addition');
      }
    } catch (err) {
      console.error('[Onboarding] Failed to add free credits:', err);
      // Continue anyway - user can still use the app
    }
    
    setWaitingForPayment(false);
    onNext({ selectedPlan: 'free_trial' });
  };

  const selectedTierData = SUBSCRIPTION_TIERS.find(t => t.id === selectedTier);
  const yearlySavings = selectedTierData
    ? Math.round((1 - selectedTierData.yearlyPrice / (selectedTierData.monthlyPrice * 12)) * 100)
    : 17;

  // Handle beta tester credit grant
  const handleBetaClaim = async () => {
    setGrantingCredits(true);
    try {
      const userId = localStorage.getItem('user_id');
      if (userId) {
        // Grant beta credits
        const response = await creditsAPI.addCredits(userId, BETA_CREDITS_AMOUNT, 'beta_tester');
        console.log('[Onboarding] Beta credits granted:', response?.data);

        // Track the beta claim
        capture('beta_credits_claimed', {
          credits: BETA_CREDITS_AMOUNT,
          userId,
        });
      }

      // Save beta tester status
      try { localStorage.setItem('selected_plan', 'beta_tester'); } catch {}
      try { localStorage.setItem('is_beta_tester', 'true'); } catch {}
      try { await setUserPreference('selected_plan', 'beta_tester'); } catch {}
      try { await setUserPreference('is_beta_tester', 'true'); } catch {}

      setCreditsGranted(true);
      setGrantingCredits(false);

      // Short delay for confetti effect, then proceed
      setTimeout(() => {
        onNext({ selectedPlan: 'beta_tester', isBetaTester: true, creditsGranted: BETA_CREDITS_AMOUNT });
      }, 1500);
    } catch (err) {
      console.error('[Onboarding] Failed to grant beta credits:', err);
      setGrantingCredits(false);
      // Proceed anyway - credits can be added later
      onNext({ selectedPlan: 'beta_tester', isBetaTester: true, creditsGranted: 0 });
    }
  };

  // Show loading while checking beta flag
  if (isBetaTester === null) {
    return (
      <div style={{
        maxWidth: 380,
        margin: '0 auto',
        padding: '24px 20px',
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
      }}>
        <div style={{
          width: 32,
          height: 32,
          border: '3px solid rgba(245, 158, 11, 0.3)',
          borderTopColor: BRAND_ORANGE,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
      </div>
    );
  }

  // Show beta tester thank you card
  if (isBetaTester) {
    return (
      <div style={{
        maxWidth: 380,
        margin: '0 auto',
        padding: '24px 20px',
        textAlign: 'center',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          {/* Gift icon with glow */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
            style={{
              width: 80,
              height: 80,
              margin: '0 auto 24px',
              borderRadius: 20,
              background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(34, 197, 94, 0.25)',
            }}
          >
            {creditsGranted ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400 }}
              >
                <Check style={{ width: 40, height: 40, color: '#22c55e' }} />
              </motion.div>
            ) : (
              <Gift style={{ width: 40, height: 40, color: '#22c55e' }} />
            )}
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={{
              ...styles.heading,
              fontSize: 24,
              marginBottom: 12,
            }}
          >
            {creditsGranted ? 'You\'re All Set!' : 'Thank You, Beta Tester!'}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            style={{
              ...styles.subheading,
              marginBottom: 24,
              fontSize: 14,
            }}
          >
            {creditsGranted
              ? `${BETA_CREDITS_AMOUNT} credits have been added to your account.`
              : 'Your feedback helps shape the future of Agent Max. As a thank you, here are some free credits on us!'}
          </motion.p>

          {/* Credits box */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            style={{
              padding: 20,
              background: 'rgba(34, 197, 94, 0.1)',
              borderRadius: 16,
              border: '1px solid rgba(34, 197, 94, 0.2)',
              marginBottom: 24,
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 8,
            }}>
              <Sparkles style={{ width: 20, height: 20, color: '#22c55e' }} />
              <span style={{
                fontSize: 32,
                fontWeight: 700,
                color: '#22c55e',
              }}>
                {BETA_CREDITS_AMOUNT}
              </span>
              <span style={{
                fontSize: 16,
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.7)',
              }}>
                credits
              </span>
            </div>
            <p style={{
              fontSize: 12,
              color: 'rgba(255, 255, 255, 0.5)',
              margin: 0,
            }}>
              Free credits for beta testers
            </p>
          </motion.div>

          {/* What you get section */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            style={{
              textAlign: 'left',
              padding: 16,
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 12,
              marginBottom: 24,
            }}
          >
            <p style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: 10,
              marginTop: 0,
            }}>
              What you get:
            </p>
            {[
              'Full access to all features',
              'Both Chatty and Autonomous modes',
              'Early access to new features',
            ].map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 6,
                  fontSize: 13,
                  color: 'rgba(255, 255, 255, 0.6)',
                }}
              >
                <Check style={{ width: 14, height: 14, color: '#22c55e', flexShrink: 0 }} />
                {item}
              </div>
            ))}
          </motion.div>

          {/* Claim button */}
          {!creditsGranted && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              onClick={handleBetaClaim}
              disabled={grantingCredits}
              whileHover={{ scale: grantingCredits ? 1 : 1.02 }}
              whileTap={{ scale: grantingCredits ? 1 : 0.98 }}
              style={{
                ...styles.primaryButton,
                background: grantingCredits
                  ? 'rgba(34, 197, 94, 0.5)'
                  : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                boxShadow: '0 4px 14px rgba(34, 197, 94, 0.35)',
                cursor: grantingCredits ? 'wait' : 'pointer',
              }}
            >
              {grantingCredits ? (
                <>
                  <div style={{
                    width: 18,
                    height: 18,
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }} />
                  Claiming Credits...
                </>
              ) : (
                <>
                  <Gift style={{ width: 18, height: 18 }} />
                  Claim My Free Credits
                </>
              )}
            </motion.button>
          )}

          {/* Small note */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            style={{
              fontSize: 11,
              color: 'rgba(255, 255, 255, 0.4)',
              marginTop: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}
          >
            <Heart style={{ width: 12, height: 12, color: '#ef4444' }} />
            We appreciate your help making Agent Max better
          </motion.p>
        </motion.div>
      </div>
    );
  }

  // Show waiting for payment UI
  if (waitingForPayment) {
    return (
      <div style={{ 
        maxWidth: 380, 
        margin: '0 auto', 
        padding: '24px 20px',
        textAlign: 'center',
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div style={{
            width: 64,
            height: 64,
            margin: '0 auto 20px',
            borderRadius: 16,
            background: verificationFailed ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {verifyingPayment ? (
              <div style={{ 
                width: 32, 
                height: 32, 
                border: '3px solid rgba(245, 158, 11, 0.3)',
                borderTopColor: BRAND_ORANGE,
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
            ) : verificationFailed ? (
              <AlertCircle style={{ width: 32, height: 32, color: '#ef4444' }} />
            ) : (
              <Clock style={{ width: 32, height: 32, color: BRAND_ORANGE }} className="animate-pulse" />
            )}
          </div>
          
          <h2 style={{ ...styles.heading, marginBottom: 12 }}>
            {verifyingPayment ? 'Verifying Payment...' : 
             verificationFailed ? 'Payment Not Detected' : 
             'Waiting for Payment'}
          </h2>
          <p style={{ ...styles.subheading, marginBottom: 24 }}>
            {verifyingPayment ? 'Please wait while we confirm your payment...' :
             verificationFailed ? 
               'We couldn\'t verify your payment yet. This can take a few minutes. You can wait, proceed anyway, or start a free trial.' :
               'Complete your purchase in the browser window that just opened. We\'ll automatically detect when you\'re done.'}
          </p>
          
          <div style={{
            padding: 16,
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: 12,
            marginBottom: 20,
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}>
            <p style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.7)', margin: 0 }}>
              Selected plan: <strong style={{ color: '#fff' }}>{pendingPlan?.replace(/_/g, ' ')}</strong>
            </p>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {verificationFailed ? (
              <>
                <button
                  onClick={handleConfirmPayment}
                  disabled={verifyingPayment}
                  style={{
                    ...styles.secondaryButton,
                    width: '100%',
                  }}
                >
                  Try Again
                </button>
                <button
                  onClick={handleProceedWithoutVerification}
                  style={{
                    ...styles.primaryButton,
                    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  }}
                >
                  I Paid - Proceed Anyway
                  <ArrowRight style={{ width: 18, height: 18 }} />
                </button>
              </>
            ) : (
              <button
                onClick={handleConfirmPayment}
                disabled={verifyingPayment}
                style={{
                  ...styles.primaryButton,
                  background: verifyingPayment ? 'rgba(34, 197, 94, 0.5)' : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  cursor: verifyingPayment ? 'wait' : 'pointer',
                }}
              >
                {verifyingPayment ? 'Verifying...' : 'I\'ve Completed Payment'}
                {!verifyingPayment && <Check style={{ width: 18, height: 18 }} />}
              </button>
            )}
            
            <button
              onClick={handleFreeTrial}
              disabled={verifyingPayment}
              style={{
                ...styles.secondaryButton,
                width: '100%',
                opacity: verifyingPayment ? 0.5 : 1,
              }}
            >
              Start Free Trial Instead
            </button>
            
            <button
              onClick={handleCancelWaiting}
              disabled={verifyingPayment}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: 13,
                cursor: verifyingPayment ? 'wait' : 'pointer',
                padding: 8,
                opacity: verifyingPayment ? 0.5 : 1,
              }}
            >
              Cancel & Choose Different Plan
            </button>
          </div>
        </motion.div>
        
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: 380,
      margin: '0 auto',
      padding: '8px 12px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ textAlign: 'center', marginBottom: 6, flexShrink: 0 }}
      >
        <h2 style={{ ...styles.heading, fontSize: 18, marginBottom: 2 }}>Choose Your Plan</h2>
        <p style={{ ...styles.subheading, fontSize: 12, marginBottom: 6 }}>
          Cancel anytime. Start free or subscribe.
        </p>
      </motion.div>

      {/* Billing Toggle */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        marginBottom: 8,
        flexShrink: 0,
      }}>
        <div style={{ 
          display: 'inline-flex', 
          background: 'rgba(255, 255, 255, 0.06)', 
          borderRadius: 8, 
          padding: 3,
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}>
          <button
            onClick={() => setBillingCycle('monthly')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              color: billingCycle === 'monthly' ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
              background: billingCycle === 'monthly' ? BRAND_ORANGE : 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              color: billingCycle === 'yearly' ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
              background: billingCycle === 'yearly' ? BRAND_ORANGE : 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            Yearly
            <span style={{ 
              fontSize: 10, 
              color: '#86efac',
              fontWeight: 700,
              background: 'rgba(34, 197, 94, 0.2)',
              padding: '1px 4px',
              borderRadius: 3,
            }}>
              -{yearlySavings}%
            </span>
          </button>
        </div>
      </div>

      {/* Plan Cards */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingBottom: 4 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SUBSCRIPTION_TIERS.map((tier, index) => {
            const Icon = tier.icon;
            const price = billingCycle === 'yearly' ? tier.yearlyPrice : tier.monthlyPrice;
            const isSelected = selectedTier === tier.id;
            
            return (
              <motion.button
                key={tier.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => setSelectedTier(tier.id)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: isSelected 
                    ? BRAND_ORANGE_LIGHT
                    : 'rgba(255, 255, 255, 0.03)',
                  border: isSelected 
                    ? `2px solid ${BRAND_ORANGE_GLOW}` 
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  position: 'relative',
                  transition: 'all 0.2s',
                }}
              >
                {tier.popular && (
                  <span style={{
                    position: 'absolute',
                    top: -8,
                    right: 10,
                    background: BRAND_ORANGE,
                    color: '#ffffff',
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 10,
                    textTransform: 'uppercase',
                  }}>
                    Popular
                  </span>
                )}
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: isSelected 
                      ? BRAND_ORANGE
                      : 'rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.2s',
                  }}>
                    <Icon style={{ width: 18, height: 18, color: '#ffffff' }} />
                  </div>
                  
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      color: '#ffffff',
                      fontSize: 14, 
                      fontWeight: 700,
                    }}>
                      {tier.name}
                    </div>
                    <div style={{ 
                      color: 'rgba(255, 255, 255, 0.5)', 
                      fontSize: 11,
                    }}>
                      {tier.creditsPerWeek} credits/week
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ 
                      color: '#ffffff',
                      fontSize: 20, 
                      fontWeight: 800,
                      lineHeight: 1,
                    }}>
                      ${price}
                    </div>
                    <div style={{ 
                      color: 'rgba(255, 255, 255, 0.4)', 
                      fontSize: 10,
                    }}>
                      /{billingCycle === 'yearly' ? 'yr' : 'mo'}
                    </div>
                  </div>
                </div>

                {/* Show only 3 key features inline when selected */}
                {isSelected && (
                  <div style={{ 
                    marginTop: 8, 
                    paddingTop: 8, 
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 4,
                  }}>
                    {tier.features.slice(0, 3).map((feature, i) => (
                      <span 
                        key={i}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          fontSize: 10,
                          color: feature.included ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.3)',
                          background: 'rgba(255,255,255,0.05)',
                          padding: '2px 6px',
                          borderRadius: 4,
                        }}
                      >
                        <Check style={{ 
                          width: 10, 
                          height: 10, 
                          color: feature.included ? '#22c55e' : 'rgba(255, 255, 255, 0.2)',
                        }} />
                        {feature.text.replace(' per week', '/wk')}
                      </span>
                    ))}
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ paddingTop: 8, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onBack} style={{ ...styles.secondaryButton, padding: '10px 14px', fontSize: 13 }}>
            Back
          </button>
          <button
            onClick={() => handleSubscribe(selectedTier)}
            disabled={opening}
            style={{
              ...styles.primaryButton,
              flex: 1,
              padding: '10px 14px',
              fontSize: 13,
              opacity: opening ? 0.7 : 1,
              cursor: opening ? 'wait' : 'pointer',
            }}
          >
            {opening ? 'Opening...' : 'Subscribe'}
            {!opening && <ArrowRight style={{ width: 16, height: 16 }} />}
          </button>
        </div>
        
        <button
          onClick={handleFreeTrial}
          style={{
            width: '100%',
            marginTop: 8,
            padding: '8px',
            color: 'rgba(255, 255, 255, 0.6)',
            background: 'transparent',
            border: '1px dashed rgba(255, 255, 255, 0.15)',
            borderRadius: 8,
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'all 0.2s',
          }}
        >
          <Sparkles style={{ width: 14, height: 14 }} />
          Start free with 50 credits
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// STEP 6: COMPLETE (with Confetti & Quick Start)
// ============================================================================

// Related prompts grouped by category for drill-down
const RELATED_PROMPTS = {
  email: {
    label: 'Email & Communication',
    icon: Mail,
    prompts: [
      'Send an email to my team about the project update',
      'Reply to all unread emails from today',
      'Find emails from Amazon about my orders',
      'Draft a thank you email to the interviewer',
      'Check if I have any urgent emails',
    ]
  },
  calendar: {
    label: 'Calendar & Scheduling',
    icon: Calendar,
    prompts: [
      'Schedule a meeting for tomorrow at 2pm',
      'What meetings do I have today?',
      'Find a free slot next week for a 1-hour call',
      'Reschedule my 3pm meeting to Friday',
      'Block 2 hours for deep work this afternoon',
    ]
  },
  notes: {
    label: 'Notes & Documents',
    icon: FileText,
    prompts: [
      'Create a note for my meeting with Sarah',
      'Search my notes for project ideas',
      'Add a shopping list to my notes',
      'Summarize my notes from last week',
      'Create a new Google Doc for the proposal',
    ]
  },
  tasks: {
    label: 'Tasks & Reminders',
    icon: CheckSquare,
    prompts: [
      'Remind me to call mom tomorrow at 5pm',
      'Add "buy groceries" to my todo list',
      'Show my overdue tasks',
      'Mark the report task as complete',
      'Create a task for following up with clients',
    ]
  },
  files: {
    label: 'Files & Finder',
    icon: Folder,
    prompts: [
      'Find all PDFs in my Downloads folder',
      'Move the report.docx to Documents',
      'What files did I download today?',
      'Clean up my Desktop folder',
      'Find files related to the Q4 budget',
    ]
  },
  web: {
    label: 'Web & Research',
    icon: Globe,
    prompts: [
      'Search for the best restaurants near me',
      'Research competitors in my industry',
      'Find reviews for the iPhone 15',
      'Compare prices for AirPods Pro',
      'Look up flight prices to New York',
    ]
  },
  messaging: {
    label: 'Messaging',
    icon: MessageSquare,
    prompts: [
      'Send a message to the team on Slack',
      'Check my Discord notifications',
      'Message John that I\'ll be late',
      'Post an update in #general',
      'Reply to the thread about the launch',
    ]
  },
  music: {
    label: 'Music & Media',
    icon: Music,
    prompts: [
      'Play some focus music',
      'What song is this?',
      'Add this to my liked songs',
      'Play my workout playlist',
      'Skip to the next track',
    ]
  },
};

// Map app categories to related prompt groups
const CATEGORY_TO_RELATED = {
  'email': 'email',
  'productivity': 'notes',
  'communication': 'messaging',
  'browsers': 'web',
  'entertainment': 'music',
  'utilities': 'files',
};

function CompleteStep({ userData, onNext }) {
  const confettiRef = useRef(null);
  const [confettiTriggered, setConfettiTriggered] = useState(false);
  const [personalizedExamples, setPersonalizedExamples] = useState([]);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!confettiTriggered && confettiRef.current) {
      setConfettiTriggered(true);
      setTimeout(() => {
        createConfetti(confettiRef.current);
      }, 400);
    }
  }, [confettiTriggered]);

  // Fetch personalized examples (same as DemoStep)
  useEffect(() => {
    async function fetchApps() {
      try {
        const electronAPI = window.electron?.appDiscovery || window.electronAPI?.appDiscovery;
        if (electronAPI?.getUserContext) {
          const context = await electronAPI.getUserContext();
          if (context?.success !== false && context?.installedApps?.length > 0) {
            const examples = generatePersonalizedExamples(context.installedApps);
            if (examples.length >= 2) {
              setPersonalizedExamples(examples.slice(0, 4)); // Show up to 4
            }
          }
        }
      } catch (error) {
        console.error('[CompleteStep] Error fetching apps:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchApps();
  }, []);

  // Handle clicking on a prompt to show related prompts
  const handlePromptClick = (example) => {
    const relatedKey = CATEGORY_TO_RELATED[example.category] || 'web';
    setExpandedCategory(expandedCategory === relatedKey ? null : relatedKey);
  };

  return (
    <div
      ref={confettiRef}
      style={{
        maxWidth: 360,
        margin: '0 auto',
        padding: '12px 16px',
        textAlign: 'center',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
        style={{ marginBottom: 12, flexShrink: 0 }}
      >
        <div style={{
          width: 60,
          height: 60,
          margin: '0 auto',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 6px 24px rgba(34, 197, 94, 0.4)',
        }}>
          <Check style={{ width: 30, height: 30, color: '#ffffff' }} />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        style={{ flexShrink: 0 }}
      >
        <h2 style={{ ...styles.heading, fontSize: 20, marginBottom: 4 }}>
          You're all set{userData?.name ? `, ${userData.name}` : ''}!
        </h2>
        <p style={{ ...styles.subheading, fontSize: 13, marginBottom: 12 }}>
          Agent Max is ready to help you get things done.
        </p>
      </motion.div>

      {/* Quick Start Section - Personalized */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        style={{
          flex: 1,
          minHeight: 0,
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12,
          padding: 12,
          marginBottom: 12,
          textAlign: 'left',
          overflowY: 'auto',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 8,
          color: '#ffffff',
          fontSize: 13,
          fontWeight: 600,
        }}>
          <Bot style={{ width: 16, height: 16, color: BRAND_ORANGE }} />
          {personalizedExamples.length > 0 ? 'Based on your apps:' : 'Try saying:'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Show personalized examples if available */}
          {personalizedExamples.length > 0 ? (
            <>
              {personalizedExamples.map((example, index) => {
                const hasRealIcon = example.appIconUrl && example.appIconUrl.startsWith('data:');
                const relatedKey = CATEGORY_TO_RELATED[example.category] || 'web';
                const isExpanded = expandedCategory === relatedKey;
                const Icon = example.icon;

                return (
                  <div key={`${example.appName}-${index}`}>
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + index * 0.1 }}
                      onClick={() => handlePromptClick(example)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 10px',
                        background: isExpanded ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.04)',
                        borderRadius: 8,
                        fontSize: 12,
                        color: 'rgba(255, 255, 255, 0.85)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        border: isExpanded ? `1px solid ${example.color}40` : '1px solid transparent',
                      }}
                    >
                      <div style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: hasRealIcon ? 'transparent' : `${example.color}20`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        overflow: 'hidden',
                      }}>
                        {hasRealIcon ? (
                          <img
                            src={example.appIconUrl}
                            alt={example.appName}
                            style={{ width: 20, height: 20, objectFit: 'contain' }}
                          />
                        ) : (
                          Icon && <Icon style={{ width: 14, height: 14, color: example.color }} />
                        )}
                      </div>
                      <span style={{ flex: 1 }}>{example.text}</span>
                      <ChevronRight style={{
                        width: 14,
                        height: 14,
                        color: 'rgba(255, 255, 255, 0.3)',
                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                      }} />
                    </motion.div>

                    {/* Expanded related prompts */}
                    <AnimatePresence>
                      {isExpanded && RELATED_PROMPTS[relatedKey] && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          style={{
                            marginLeft: 16,
                            marginTop: 4,
                            paddingLeft: 12,
                            borderLeft: `2px solid ${example.color}40`,
                          }}
                        >
                          <div style={{
                            fontSize: 10,
                            color: 'rgba(255, 255, 255, 0.5)',
                            marginBottom: 4,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}>
                            More {RELATED_PROMPTS[relatedKey].label}
                          </div>
                          {RELATED_PROMPTS[relatedKey].prompts.slice(0, 3).map((prompt, pIndex) => (
                            <div
                              key={pIndex}
                              style={{
                                fontSize: 11,
                                color: 'rgba(255, 255, 255, 0.6)',
                                padding: '4px 0',
                                fontStyle: 'italic',
                              }}
                            >
                              "{prompt}"
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </>
          ) : (
            /* Fallback prompts if no personalized ones */
            <>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: 'rgba(255, 255, 255, 0.7)',
                }}
              >
                <Mail style={{ width: 14, height: 14, color: 'rgba(255, 255, 255, 0.4)', flexShrink: 0 }} />
                "Check my emails for anything important"
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: 'rgba(255, 255, 255, 0.7)',
                }}
              >
                <Calendar style={{ width: 14, height: 14, color: 'rgba(255, 255, 255, 0.4)', flexShrink: 0 }} />
                "What meetings do I have today?"
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: 'rgba(255, 255, 255, 0.7)',
                }}
              >
                <Search style={{ width: 14, height: 14, color: 'rgba(255, 255, 255, 0.4)', flexShrink: 0 }} />
                "Search the web for Python tutorials"
              </motion.div>
            </>
          )}
        </div>
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        onClick={() => onNext()}
        style={{
          ...styles.primaryButton,
          flexShrink: 0,
          padding: '12px 20px',
          fontSize: 14,
        }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        Launch Agent Max
        <Sparkles style={{ width: 16, height: 16 }} />
      </motion.button>
    </div>
  );
}

// ============================================================================
// MAIN ONBOARDING FLOW
// ============================================================================
export function OnboardingFlow({ onComplete, onSkip, startStep = 0 }) {
  const [currentStep, setCurrentStep] = useState(startStep);
  const { setApiConnected } = useStore();
  const [userData, setUserData] = useState({
    name: '',
    email: '',
    hasPaymentMethod: false,
    helpCategory: '',
  });
  const [serverConnected, setServerConnected] = useState(false);
  const [checkingServer, setCheckingServer] = useState(true);

  useEffect(() => {
    try {
      window.localStorage?.removeItem?.('amx:floatbar:lastHeight');
      window.electron?.resizeWindow?.(380, 580);
    } catch (error) {
      console.warn('[Onboarding] Failed to expand window', error);
    }
    setApiConnected(true);

    try {
      const config = apiConfigManager.getConfig();
      const prodUrl = import.meta.env.VITE_API_URL || 'https://agentmax-production.up.railway.app';
      if (!config.baseURL || config.baseURL.includes('localhost')) {
        apiConfigManager.updateConfig(prodUrl);
      }
    } catch (error) {
      console.warn('[Onboarding] Failed to ensure production API config', error);
    }
  }, [setApiConnected]);

  useEffect(() => {
    let mounted = true;
    const attemptOnce = async () => {
      try {
        await healthAPI.check();
        if (mounted) setServerConnected(true);
      } catch (_) {
        if (mounted) setServerConnected(false);
      } finally {
        if (mounted) setCheckingServer(false);
      }
    };
    attemptOnce();
    const id = setInterval(attemptOnce, 4000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  // Step order: Show value first, then account, then collect info
  // Progressive onboarding: Demo before account to reduce friction
  const steps = [
    { id: 'welcome', component: WelcomeStep },
    { id: 'demo', component: DemoStep },            // Show what Max can do first
    { id: 'account', component: AccountStep },      // Sign in/up - before name so we can personalize
    { id: 'name', component: NameStep },            // Collect name for personalization
    { id: 'legal', component: LegalStep },          // Legal consent
    { id: 'usecase', component: UseCaseStep },
    { id: 'modes', component: ModeExplainerStep },  // Explain Chatty vs Autonomous
    { id: 'verify-email', component: EmailVerificationStep },
    { id: 'google', component: GoogleStep },
    { id: 'subscription', component: SubscriptionStep },
    { id: 'complete', component: CompleteStep },
  ];

  const handleNext = (data = {}) => {
    console.log('[Onboarding] ========== handleNext CALLED ==========');
    console.log('[Onboarding] Received data:', JSON.stringify(data, null, 2));
    console.log('[Onboarding] Current step index:', currentStep);
    console.log('[Onboarding] Steps array:', steps.map(s => s.id));

    // Track step completion (unless it's already tracked in the step component)
    const currentStepId = steps[currentStep]?.id;
    if (currentStepId && !['account'].includes(currentStepId)) {
      // account step tracks its own completion with auth details
      trackOnboardingStepCompleted(currentStepId, data);
    }

    setUserData(prev => ({ ...prev, ...data }));

    // Handle skip to specific step for existing users
    if (data.skipToStep) {
      console.log('[Onboarding] skipToStep found:', data.skipToStep);
      const targetIndex = steps.findIndex(s => s.id === data.skipToStep);
      console.log('[Onboarding] Target index for', data.skipToStep, ':', targetIndex);
      if (targetIndex !== -1) {
        console.log(`[Onboarding] SKIPPING to step ${targetIndex}: ${data.skipToStep}`);
        setCurrentStep(targetIndex);
        return;
      } else {
        console.error('[Onboarding] ERROR: Could not find step', data.skipToStep);
      }
    } else {
      console.log('[Onboarding] No skipToStep in data, proceeding normally');
    }

    // For existing users with verified email, skip the verify-email step
    if (data.isExistingUser && data.emailVerified && steps[currentStep + 1]?.id === 'verify-email') {
      console.log('[Onboarding] Existing verified user - skipping email verification');
      setCurrentStep(currentStep + 2); // Skip verify-email step
      return;
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    console.log('[Onboarding] Completing with data:', userData);

    // Track onboarding completed
    trackOnboardingCompleted({
      name: userData.name || '',
      helpCategory: userData.helpCategory || '',
      selectedPlan: userData.selectedPlan || 'free_trial',
      hasGoogleConnected: !!userData.googleConnected,
      paymentConfirmed: !!userData.paymentConfirmed
    });

    // Save all collected data to localStorage as fallback
    try {
      localStorage.setItem('onboarding_completed', 'true');
      localStorage.setItem('user_data', JSON.stringify(userData));
      localStorage.setItem('user_name', userData.name || '');
      localStorage.setItem('user_email', userData.email || '');
      localStorage.setItem('help_category', userData.helpCategory || '');
      localStorage.setItem('selected_plan', userData.selectedPlan || 'free_trial');
    } catch (e) {
      console.warn('[Onboarding] Failed to save to localStorage:', e);
    }
    
    // Save to Supabase preferences (with fallback)
    try {
      await setUserPreference('onboarding_completed', 'true');
      if (userData.name) await setUserPreference('user_name', userData.name);
      if (userData.helpCategory) await setUserPreference('help_category', userData.helpCategory);
      if (userData.selectedPlan) await setUserPreference('selected_plan', userData.selectedPlan);
      
      // Save complete profile object
      const profile = {
        name: userData.name || '',
        help_category: userData.helpCategory || '',
        google_oauth: userData.googleConnected ? 'connected' : 'skipped',
        selected_plan: userData.selectedPlan || 'free_trial',
        onboarding_completed_at: new Date().toISOString(),
      };
      await setUserPreference('prompt_profile', JSON.stringify(profile));
      
      // CRITICAL FIX: Also save to users.metadata.profile so getProfile() finds it
      // This is the source that chat context reads from
      try {
        await updateUserProfile(profile);
        console.log('[Onboarding] Profile saved to users.metadata:', profile);
      } catch (profileErr) {
        console.warn('[Onboarding] Failed to update profile metadata:', profileErr);
      }
    } catch (e) {
      console.warn('[Onboarding] Failed to save to Supabase:', e);
    }
    
    // Flush any pre-auth queued operations now that user_id exists
    try {
      const flushResult = await flushPreAuthQueue();
      console.log('[Onboarding] Pre-auth queue flush result:', flushResult);
    } catch (flushErr) {
      console.warn('[Onboarding] Failed to flush pre-auth queue:', flushErr);
    }
    
    console.log('[Onboarding] Data saved successfully');
    onComplete(userData);
  };

  const CurrentStepComponent = steps[currentStep].component;
  const showProgress = currentStep > 0 && currentStep < steps.length - 1;

  return (
    <div className="absolute inset-0 z-50">
      <div className="h-full w-full flex flex-col px-3 py-3">
        <div className="flex-1 w-full mx-auto" style={{ maxWidth: 480, maxHeight: '100%' }}>
          <div
            className="w-full h-full rounded-2xl overflow-hidden"
            style={{
              position: 'relative',
              background: 'linear-gradient(165deg, rgba(15, 17, 21, 0.95), rgba(10, 12, 16, 0.98))',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '100%',
            }}
          >
            {/* Progress Indicator */}
            {showProgress && (
              <ProgressIndicator 
                currentStep={currentStep - 1} 
                totalSteps={steps.length - 2} 
              />
            )}

            {/* Step Content */}
            <div style={{
              flex: 1,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}
                >
                  <CurrentStepComponent
                    userData={userData}
                    onNext={handleNext}
                    onBack={handleBack}
                    isFirst={currentStep === 0}
                    isLast={currentStep === steps.length - 1}
                    serverConnected={serverConnected}
                    checkingServer={checkingServer}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OnboardingFlow;
