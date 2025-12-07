import React, { useState, useEffect } from 'react';
import { Loader2, ChevronRight, ChevronDown } from 'lucide-react';
import './LiveActivityFeed.css';

/**
 * LiveActivityFeed - Progressive, real-time step display
 *
 * Shows steps as they execute, not as pre-planned checklist.
 * Steps appear one-by-one as the AI works through them.
 *
 * Props:
 * - activitySteps: Array of step objects with {id, status, description, technicalDetails, error, timestamp}
 *   - status: 'running' | 'completed' | 'failed'
 *   - description: User-friendly description (e.g., "Opened happyfolder")
 *   - technicalDetails: Technical info (e.g., "cd /happyfolder", tool output, etc.)
 *   - error: Error message if failed
 * - initialMessage: Conversational upbeat initial response from AI
 */
export default function LiveActivityFeed({ activitySteps = [], initialMessage }) {
  const [expandedSteps, setExpandedSteps] = useState({});

  const toggleStepDetails = (stepId) => {
    setExpandedSteps((prev) => ({
      ...prev,
      [stepId]: !prev[stepId],
    }));
  };

  if (!activitySteps || activitySteps.length === 0) {
    return null;
  }

  const renderStep = (step, index) => {
    const { id, status, description, technicalDetails, error } = step;
    const isExpanded = expandedSteps[id] || false;
    const hasTechnicalDetails = technicalDetails && technicalDetails.trim().length > 0;

    return (
      <div key={id || index} className={`activity-step activity-step--${status}`}>
        <div className="activity-step__main">
          {/* Status Indicator */}
          <div className="activity-step__indicator">
            {status === 'running' && (
              <Loader2 size={14} className="activity-step__spinner" />
            )}
            {status === 'completed' && (
              <span className="activity-step__checkmark">✓</span>
            )}
            {status === 'failed' && (
              <span className="activity-step__failed-indicator" />
            )}
          </div>

          {/* Description */}
          <div className="activity-step__description">{description}</div>

          {/* Expandable Arrow (only if technical details exist) */}
          {hasTechnicalDetails && (
            <button
              className="activity-step__expand-btn"
              onClick={() => toggleStepDetails(id)}
              aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
            >
              {isExpanded ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
            </button>
          )}
        </div>

        {/* Error Details (indented, always visible for failed steps) */}
        {status === 'failed' && error && (
          <div className="activity-step__error">{error}</div>
        )}

        {/* Technical Details (expandable) */}
        {hasTechnicalDetails && isExpanded && (
          <div className="activity-step__technical">
            <pre>{technicalDetails}</pre>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="live-activity-feed">
      {/* Initial AI Response */}
      {initialMessage && (
        <div className="live-activity-feed__intro">{initialMessage}</div>
      )}

      {/* Progressive Step List */}
      <div className="live-activity-feed__steps">
        {activitySteps.map((step, index) => renderStep(step, index))}
      </div>
    </div>
  );
}
