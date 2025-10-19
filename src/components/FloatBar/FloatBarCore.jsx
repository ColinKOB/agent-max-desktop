/**
 * FloatBar Core Component
 * Refactored main component - Part 1 of modularization
 * This handles the core window states and layout
 */
import { useState, useCallback, useMemo } from 'react';
import { Camera, Send, Minimize2, ChevronRight, Settings as SettingsIcon } from 'lucide-react';
import useStore from '../../store/useStore';
import { LiquidGlassCard } from '../ui/LiquidGlassCard';
import FloatBarInput from './FloatBarInput';
import FloatBarMessages from './FloatBarMessages';
import FloatBarHeader from './FloatBarHeader';
import FloatBarActions from './FloatBarActions';
import { useFloatBarState } from './useFloatBarState';
import { useMessageHandler } from './useMessageHandler';
import './FloatBar.css';

export default function FloatBarCore({
  showWelcome,
  onWelcomeComplete,
  isLoading,
  windowMode = 'single',
  autoSend = true,
}) {
  const { greeting, apiConnected } = useStore();
  const {
    isOpen,
    isMini,
    isBar,
    setIsOpen,
    setIsMini,
    setIsBar,
    isTransitioning,
    handleExpand,
    handleCollapse,
    handleMinimize
  } = useFloatBarState(windowMode);
  
  const {
    message,
    setMessage,
    thoughts,
    isThinking,
    thinkingStatus,
    handleSendMessage,
    handleClearConversation,
    handleStop,
    handleContinue
  } = useMessageHandler();

  // Compute window classes
  const windowClasses = useMemo(() => {
    const classes = ['amx-root'];
    if (isMini) classes.push('amx-mini');
    if (isBar) classes.push('amx-bar');
    if (isOpen) classes.push('amx-card');
    if (isTransitioning) classes.push('amx-transitioning');
    return classes.join(' ');
  }, [isMini, isBar, isOpen, isTransitioning]);

  // Handle input submission
  const handleSubmit = useCallback((e) => {
    e?.preventDefault();
    if (message.trim() && !isThinking) {
      handleSendMessage(message);
      setMessage('');
    }
  }, [message, isThinking, handleSendMessage, setMessage]);

  // Render mini pill state
  if (isMini) {
    return (
      <div className={windowClasses}>
        <div className="amx-mini-content" onClick={handleExpand}>
          <img
            src="/logo.svg"
            alt="Agent Max"
            className="amx-mini-logo"
            draggable={false}
          />
        </div>
        <div className="amx-drag-handle-mini">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="amx-dot" />
          ))}
        </div>
      </div>
    );
  }

  // Render bar state
  if (isBar) {
    return (
      <div className={windowClasses}>
        <FloatBarInput
          value={message}
          onChange={setMessage}
          onSubmit={handleSubmit}
          disabled={isThinking || !apiConnected}
          placeholder={apiConnected ? "What can I help you with?" : "Connecting to API..."}
        />
        <button
          className="amx-bar-minimize-btn"
          onClick={handleMinimize}
          aria-label="Minimize"
        >
          <Minimize2 size={16} />
        </button>
      </div>
    );
  }

  // Render full card state
  return (
    <div className={windowClasses}>
      <LiquidGlassCard variant="elevated" glow animate className="h-full">
        <div className="amx-panel">
          <FloatBarHeader
            greeting={greeting}
            onMinimize={handleCollapse}
            onSettings={() => {/* TODO: Open settings */}}
            onClear={handleClearConversation}
          />
          
          <FloatBarMessages
            thoughts={thoughts}
            isThinking={isThinking}
            thinkingStatus={thinkingStatus}
          />
          
          <FloatBarActions
            message={message}
            onMessageChange={setMessage}
            onSubmit={handleSubmit}
            onScreenshot={() => {/* TODO: Handle screenshot */}}
            onQuickAction={() => {/* TODO: Handle quick action */}}
            isThinking={isThinking}
            apiConnected={apiConnected}
            onStop={handleStop}
            onContinue={handleContinue}
          />
        </div>
      </LiquidGlassCard>
    </div>
  );
}
