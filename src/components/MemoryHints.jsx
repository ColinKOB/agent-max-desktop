/**
 * Memory Hints Component
 * 
 * Displays memory candidates while user is typing.
 * Shows which past conversations are relevant to the current draft.
 */

import { memo } from 'react';
import { Lightbulb, Clock, Sparkles } from 'lucide-react';
import './MemoryHints.css';

/**
 * Format timestamp to relative time
 */
function formatRelativeTime(timestamp) {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return '';
  }
}

/**
 * Get source type icon and label
 */
function getSourceInfo(sourceType) {
  switch (sourceType) {
    case 'chat':
      return { icon: '💬', label: 'Chat' };
    case 'upload':
      return { icon: '📎', label: 'Upload' };
    case 'system':
      return { icon: '⚙️', label: 'System' };
    default:
      return { icon: '📝', label: 'Note' };
  }
}

/**
 * Individual memory hint card
 */
const MemoryHintCard = memo(({ candidate, index }) => {
  const sourceInfo = getSourceInfo(candidate.source_type);
  const similarity = Math.round((candidate.similarity || 0) * 100);
  const relativeTime = formatRelativeTime(candidate.created_at);

  return (
    <div 
      className="memory-hint-card"
      style={{
        animationDelay: `${index * 50}ms`
      }}
    >
      <div className="memory-hint-header">
        <span className="memory-hint-source" title={sourceInfo.label}>
          {sourceInfo.icon}
        </span>
        <span className="memory-hint-similarity" title="Relevance score">
          {similarity}%
        </span>
        {relativeTime && (
          <span className="memory-hint-time" title={candidate.created_at}>
            <Clock size={12} />
            {relativeTime}
          </span>
        )}
      </div>
    </div>
  );
});

MemoryHintCard.displayName = 'MemoryHintCard';

/**
 * Main memory hints component
 */
function MemoryHints({ candidates, isLoading, cacheHit, onDismiss }) {
  if (!candidates || candidates.length === 0) {
    return null;
  }

  return (
    <div className="memory-hints-container">
      <div className="memory-hints-panel">
        <div className="memory-hints-header">
          <div className="memory-hints-title">
            <Lightbulb size={16} className="memory-hints-icon" />
            <span>
              I remember <strong>{candidates.length}</strong> related{' '}
              {candidates.length === 1 ? 'conversation' : 'conversations'}
            </span>
          </div>
          <div className="memory-hints-badges">
            {cacheHit && (
              <span className="memory-hints-badge cache-badge" title="Loaded from cache">
                <Sparkles size={12} />
                Fast
              </span>
            )}
            {isLoading && (
              <span className="memory-hints-badge loading-badge">
                Loading...
              </span>
            )}
          </div>
          {onDismiss && (
            <button
              className="memory-hints-dismiss"
              onClick={onDismiss}
              aria-label="Dismiss hints"
            >
              ×
            </button>
          )}
        </div>

        {candidates.length > 0 && (
          <div className="memory-hints-list">
            {candidates.slice(0, 3).map((candidate, index) => (
              <MemoryHintCard
                key={candidate.id}
                candidate={candidate}
                index={index}
              />
            ))}
            {candidates.length > 3 && (
              <div className="memory-hints-more">
                +{candidates.length - 3} more
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(MemoryHints);
