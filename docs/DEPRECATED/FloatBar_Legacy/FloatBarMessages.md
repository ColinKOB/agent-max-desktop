# DEPRECATED: src/components/FloatBar/FloatBarMessages.jsx

Do NOT use. Archived on 2025-11-06. Reason: Part of legacy FloatBar stack.

## Original Source

```jsx
/* BEGIN ORIGINAL FILE: src/components/FloatBar/FloatBarMessages.jsx */
/**
 * FloatBar Messages Component
 * Displays conversation messages with liquid glass styling
 */
import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, RotateCcw, Trash2 } from 'lucide-react';
import { LiquidGlassCard } from '../ui/LiquidGlassCard';
import { formatDuration } from '../../utils/formatters';

export default function FloatBarMessages({
  thoughts = [],
  isThinking = false,
  thinkingStatus = '',
  onDeleteMessage,
  onRegenerateMessage,
  onCopyMessage
}) {
  const [collapsedMessages, setCollapsedMessages] = useState(new Set());
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const toggleCollapse = (index) => {
    const newCollapsed = new Set(collapsedMessages);
    if (newCollapsed.has(index)) {
      newCollapsed.delete(index);
    } else {
      newCollapsed.add(index);
    }
    setCollapsedMessages(newCollapsed);
  };

  if (thoughts.length === 0 && !isThinking) {
    return (
      <div className="amx-thoughts amx-empty-state">
        <div className="amx-empty-icon">💭</div>
        <div className="amx-empty-text">Start a conversation to see messages here</div>
      </div>
    );
  }

  return (
    <div className="amx-thoughts">
      {thoughts.map((thought, index) => {
        const isCollapsed = collapsedMessages.has(index);
        const isHovered = hoveredIndex === index;
        const isThought = thought.label?.toLowerCase() === 'thinking';
        
        return (
          <div
            key={thought.id || index}
            className={`amx-message ${thought.type ? `amx-message-${thought.type}` : ''}`}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {/* Message Header */}
            {thought.label && (
              <div className="amx-message-header">
                <span className={isThought ? 'amx-thought-label' : 'amx-message-label'}>
                  {thought.label}
                </span>
                {thought.duration && (
                  <span className="amx-message-duration">
                    {formatDuration(thought.duration)}
                  </span>
                )}
                {isThought && (
                  <button
                    className="amx-collapse-btn"
                    onClick={() => toggleCollapse(index)}
                    aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                  >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </button>
                )}
              </div>
            )}

            {/* Message Content */}
            {(!isThought || !isCollapsed) && (
              <LiquidGlassCard variant="nested" className="amx-message-content">
                {thought.message}
                
                {/* Message Actions */}
                {isHovered && !isThinking && (
                  <div className="amx-message-actions">
                    <button
                      onClick={() => onCopyMessage?.(thought.message)}
                      className="amx-action-btn"
                      aria-label="Copy"
                    >
                      <Copy size={14} />
                    </button>
                    {thought.type === 'agent' && (
                      <button
                        onClick={() => onRegenerateMessage?.(index)}
                        className="amx-action-btn"
                        aria-label="Regenerate"
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => onDeleteMessage?.(index)}
                      className="amx-action-btn amx-action-danger"
                      aria-label="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </LiquidGlassCard>
            )}

            {/* Collapsed Thought Indicator */}
            {isThought && isCollapsed && (
              <div className="amx-thought-collapsed" onClick={() => toggleCollapse(index)}>
                <span>💭</span>
                <span>{thought.wordCount || 0} words</span>
                <ChevronRight size={14} />
              </div>
            )}
          </div>
        );
      })}

      {/* Thinking Indicator */}
      {isThinking && (
        <div className="amx-message amx-message-thinking">
          <div className="amx-thinking-indicator">
            <div className="amx-thinking-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span className="amx-thinking-status">{thinkingStatus || 'Thinking...'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
/* END ORIGINAL FILE */
```
