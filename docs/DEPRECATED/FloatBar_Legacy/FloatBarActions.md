# DEPRECATED: src/components/FloatBar/FloatBarActions.jsx

Do NOT use. Archived on 2025-11-06. Reason: Part of legacy FloatBar stack.

## Original Source

```jsx
/* BEGIN ORIGINAL FILE: src/components/FloatBar/FloatBarActions.jsx */
/**
 * FloatBar Actions Component
 * Bottom action bar with input and buttons
 */
import React from 'react';
import { Send, Camera, Zap, Square, Play, Loader2 } from 'lucide-react';
import { LiquidGlassButton, LiquidGlassInput } from '../ui/LiquidGlassCard';
import { CostIndicator } from '../billing/CostFeedback';

export default function FloatBarActions({
  message = '',
  onMessageChange,
  onSubmit,
  onScreenshot,
  onQuickAction,
  isThinking = false,
  isStopped = false,
  apiConnected = true,
  onStop,
  onContinue,
  currentCost = 0
}) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e);
    }
  };

  return (
    <div className="amx-actions">
      <div className="amx-input-group">
        <LiquidGlassInput
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={apiConnected ? "Type a message..." : "Connecting to API..."}
          disabled={isThinking || !apiConnected}
          className="amx-input flex-1"
        />
        
        <div className="amx-action-buttons">
          {/* Screenshot button */}
          {onScreenshot && (
            <LiquidGlassButton
              variant="secondary"
              size="sm"
              onClick={onScreenshot}
              icon={Camera}
              disabled={isThinking}
              aria-label="Take screenshot"
            />
          )}
          
          {/* Quick action button */}
          {onQuickAction && (
            <LiquidGlassButton
              variant="secondary"
              size="sm"
              onClick={onQuickAction}
              icon={Zap}
              disabled={isThinking}
              aria-label="Quick action"
            />
          )}
          
          {/* Stop/Continue button */}
          {isThinking && (
            isStopped ? (
              <LiquidGlassButton
                variant="primary"
                size="sm"
                onClick={onContinue}
                icon={Play}
                aria-label="Continue"
              >
                Continue
              </LiquidGlassButton>
            ) : (
              <LiquidGlassButton
                variant="danger"
                size="sm"
                onClick={onStop}
                icon={Square}
                aria-label="Stop"
              >
                Stop
              </LiquidGlassButton>
            )
          )}
          
          {/* Send button */}
          <LiquidGlassButton
            variant="primary"
            size="sm"
            onClick={onSubmit}
            disabled={!message.trim() || isThinking || !apiConnected}
            loading={isThinking && !isStopped}
            icon={isThinking ? Loader2 : Send}
            aria-label="Send message"
          >
            {isThinking ? 'Processing...' : 'Send'}
          </LiquidGlassButton>
        </div>
      </div>
      
      {/* Cost indicator */}
      {currentCost > 0 && (
        <div className="amx-cost-indicator">
          <CostIndicator currentCost={currentCost} isActive={isThinking} />
        </div>
      )}
    </div>
  );
}
/* END ORIGINAL FILE */
```
