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
  Scale
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { healthAPI, googleAPI, creditsAPI, subscriptionAPI } from '../../services/api';
import { generateOAuthState, hashOAuthState, storeOAuthStateHash } from '../../services/oauth';
import { GoogleConnect } from '../../components/GoogleConnect';
import apiConfigManager from '../../config/apiConfig';
import LogoPng from '../../assets/AgentMaxLogo.png';
import { setName as setProfileName, setPreference as setUserPreference, updateProfile as updateUserProfile, flushPreAuthQueue } from '../../services/supabaseMemory';
import { emailPasswordSignInOrCreate, ensureUsersRow, supabase } from '../../services/supabase.js';
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
  AnalyticsEvents
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
// STEP 2: NAME
// ============================================================================
function NameStep({ userData, onNext }) {
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

        <button
          onClick={handleContinue}
          disabled={!name.trim() || saving}
          style={{
            ...styles.primaryButton,
            opacity: !name.trim() || saving ? 0.5 : 1,
            cursor: !name.trim() || saving ? 'not-allowed' : 'pointer',
            marginTop: 'auto',
          }}
        >
          {saving ? 'Saving...' : 'Continue'}
          {!saving && <ArrowRight style={{ width: 18, height: 18 }} />}
        </button>
      </motion.div>
    </div>
  );
}

// ============================================================================
// STEP 2: USE CASE (Rich Cards with Icons)
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
      maxHeight: 'calc(100vh - 60px)',
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

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingBottom: 4 }}>
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
// STEP 3: EMAIL/ACCOUNT (Sign Up or Sign In)
// ============================================================================
function AccountStep({ onNext, onBack, userData }) {
  const [mode, setMode] = useState('signin'); // 'signin' or 'signup' - default to signin for returning users
  const [email, setEmail] = useState(userData?.email || '');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [error, setError] = useState(null);

  const validEmail = (v) => /.+@.+\..+/.test(v);
  const strongPw = (v) => v.length >= 8;
  const canSubmit = validEmail(email) && strongPw(password) && !saving;

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
          {mode === 'signin'
            ? 'Welcome back!'
            : userData?.name
              ? `Almost there, ${userData.name}!`
              : 'Create your account'}
        </h2>
        <p style={styles.subheading}>
          {mode === 'signin'
            ? 'Sign in to access your Agent Max account.'
            : 'New here? Create an account to get started.'}
        </p>
      </motion.div>

      {/* Mode Toggle */}
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
      maxHeight: 'calc(100vh - 40px)',
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
const QUICK_START_PROMPTS = [
  {
    icon: Mail,
    text: '"Check my emails for anything important"',
  },
  {
    icon: FileText,
    text: '"Help me write a professional email"',
  },
  {
    icon: Search,
    text: '"Research the latest news on AI"',
  },
];

function CompleteStep({ userData, onNext }) {
  const confettiRef = useRef(null);
  const [confettiTriggered, setConfettiTriggered] = useState(false);

  useEffect(() => {
    if (!confettiTriggered && confettiRef.current) {
      setConfettiTriggered(true);
      setTimeout(() => {
        createConfetti(confettiRef.current);
      }, 400);
    }
  }, [confettiTriggered]);

  return (
    <div 
      ref={confettiRef}
      style={{ 
        maxWidth: 360, 
        margin: '0 auto', 
        padding: '12px 16px',
        textAlign: 'center',
        height: '100%',
        maxHeight: 'calc(100vh - 40px)',
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

      {/* Quick Start Section */}
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
          Try saying:
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {QUICK_START_PROMPTS.map((prompt, index) => {
            const Icon = prompt.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
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
                <Icon style={{ width: 14, height: 14, color: 'rgba(255, 255, 255, 0.4)', flexShrink: 0 }} />
                {prompt.text}
              </motion.div>
            );
          })}
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

  // Step order: Account (sign in/up) comes before Legal so returning users can sign in first
  const steps = [
    { id: 'welcome', component: WelcomeStep },
    { id: 'account', component: AccountStep },      // Sign in/up FIRST
    { id: 'legal', component: LegalStep },          // Then legal consent
    { id: 'name', component: NameStep },
    { id: 'usecase', component: UseCaseStep },
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
        <div className="flex-1 w-full mx-auto" style={{ maxWidth: 480 }}>
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
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
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
