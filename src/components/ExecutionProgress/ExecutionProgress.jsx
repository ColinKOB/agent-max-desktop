import React, { useState } from 'react';
import { Check, Loader2, X, Circle, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import './ExecutionProgress.css';

/**
 * ExecutionProgress - Visual checklist showing step-by-step progress
 * 
 * Props:
 * - steps: Array of step objects with {id, description, goal, tool_name}
 * - stepStatuses: Object mapping step index to status ('pending'|'running'|'done'|'failed'|'recovering')
 * - currentStep: Current step index
 * - summary: Final summary object when execution completes
 */
export default function ExecutionProgress({ steps, stepStatuses, currentStep, summary }) {
  const [expandedSteps, setExpandedSteps] = useState({});
  const [showPreviousGroup, setShowPreviousGroup] = useState(false);
  const [showNextGroup, setShowNextGroup] = useState(false);

  if (!steps || steps.length === 0) {
    return null;
  }

  const safeCurrentIndex =
    typeof currentStep === 'number' && currentStep >= 0 && currentStep < steps.length
      ? currentStep
      : 0;

  const toggleStep = (index) => {
    setExpandedSteps((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const renderStep = (step, index) => {
    const status = stepStatuses[index] || 'pending';
    const isCurrent = index === safeCurrentIndex;
    const isExpanded = expandedSteps[index] !== undefined ? expandedSteps[index] : isCurrent;

    return (
      <div
        key={step.id || index}
        className={`execution-step ${status} ${isCurrent ? 'current' : ''} ${isExpanded ? 'expanded' : 'collapsed'}`}
      >
        <div className="step-indicator">
          {status === 'done' && (
            <div className="step-icon done">
              <Check size={16} />
            </div>
          )}
          {status === 'running' && (
            <div className="step-icon running">
              <Loader2 size={16} className="spinner" />
            </div>
          )}
          {status === 'recovering' && (
            <div className="step-icon recovering">
              <RefreshCw size={16} className="spinner" />
            </div>
          )}
          {status === 'failed' && (
            <div className="step-icon failed">
              <X size={16} />
            </div>
          )}
          {status === 'pending' && (
            <div className="step-icon pending">
              <Circle size={16} />
            </div>
          )}
        </div>

        <div className="step-content">
          <div className="step-header" onClick={() => toggleStep(index)}>
            <div className="step-header-left">
              <div className="step-number">Step {index + 1}</div>
              <div className="step-description">{step.description}</div>
            </div>
            <button
              className="step-expand-btn"
              onClick={(e) => {
                e.stopPropagation();
                toggleStep(index);
              }}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>
          {isExpanded && (
            <div className="step-details">
              {status === 'recovering' && (
                <div className="step-recovery-notice">🔄 Attempting recovery...</div>
              )}
              {step.tool_name && <div className="step-tool">{step.tool_name}</div>}
              {step.goal && <div className="step-goal">{step.goal}</div>}
            </div>
          )}
        </div>
      </div>
    );
  };

  const previousIndices = [];
  const nextIndices = [];
  steps.forEach((_, idx) => {
    if (idx < safeCurrentIndex) {
      previousIndices.push(idx);
    } else if (idx > safeCurrentIndex) {
      nextIndices.push(idx);
    }
  });

  const visiblePrevious = showPreviousGroup ? previousIndices : previousIndices.slice(-1);
  const visibleNext = showNextGroup ? nextIndices : nextIndices.slice(0, 1);

  const hasHiddenPrevious = previousIndices.length > visiblePrevious.length;
  const hiddenPreviousCount = previousIndices.length - visiblePrevious.length;
  const hasHiddenNext = nextIndices.length > visibleNext.length;
  const hiddenNextCount = nextIndices.length - visibleNext.length;

  return (
    <div className="execution-progress">
      <div className="execution-progress-header">
        <h3>Execution Progress</h3>
        {summary && (
          <span className={`execution-status ${summary.status}`}>
            {summary.status === 'complete' ? '✅ Complete' : '❌ Failed'}
          </span>
        )}
      </div>

      <div className="execution-steps">
        {hasHiddenPrevious && (
          <button
            type="button"
            className="execution-aggregate previous"
            onClick={() => setShowPreviousGroup((v) => !v)}
          >
            {showPreviousGroup
              ? 'Hide earlier steps'
              : `Show ${hiddenPreviousCount} earlier step${hiddenPreviousCount > 1 ? 's' : ''}`}
          </button>
        )}

        {visiblePrevious.map((index) => renderStep(steps[index], index))}

        {steps[safeCurrentIndex] && renderStep(steps[safeCurrentIndex], safeCurrentIndex)}

        {visibleNext.map((index) => renderStep(steps[index], index))}

        {hasHiddenNext && (
          <button
            type="button"
            className="execution-aggregate next"
            onClick={() => setShowNextGroup((v) => !v)}
          >
            {showNextGroup
              ? 'Hide upcoming steps'
              : `Show ${hiddenNextCount} more step${hiddenNextCount > 1 ? 's' : ''}`}
          </button>
        )}
      </div>

      {summary && (
        <div className={`execution-summary ${summary.status}`}>
          <div className="summary-message">{summary.message}</div>
          {summary.goalAchieved !== undefined && (
            <div className="summary-stats">
              <span className="stat">✅ {summary.successCount} succeeded</span>
              {summary.failedCount > 0 && (
                <span className="stat">❌ {summary.failedCount} failed</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
