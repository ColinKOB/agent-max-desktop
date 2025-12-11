import React, { useState, useEffect, useRef } from 'react';
import { Check, Loader2, X, Circle, RefreshCw, ChevronDown, ChevronRight, Clock, Zap, Activity } from 'lucide-react';
import './ExecutionProgress.css';

/**
 * ExecutionProgress - Enhanced visual checklist showing step-by-step progress
 * 
 * Props:
 * - steps: Array of step objects with {id, description, goal, tool_name}
 * - stepStatuses: Object mapping step index to status ('pending'|'running'|'done'|'failed'|'recovering')
 * - currentStep: Current step index
 * - summary: Final summary object when execution completes
 * - currentAction: String describing what's happening right now
 * - startTime: Timestamp when execution started
 */
export default function ExecutionProgress({ 
  steps, 
  stepStatuses, 
  currentStep, 
  summary,
  currentAction,
  startTime 
}) {
  const [expandedSteps, setExpandedSteps] = useState({});
  const [showPreviousGroup, setShowPreviousGroup] = useState(false);
  const [showNextGroup, setShowNextGroup] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [stepStartTimes, setStepStartTimes] = useState({});
  const [stepDurations, setStepDurations] = useState({});
  const lastCurrentStepRef = useRef(-1);

  // Track elapsed time
  useEffect(() => {
    if (summary) return; // Stop timer when complete
    
    const actualStartTime = startTime || Date.now();
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - actualStartTime) / 1000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [startTime, summary]);

  // Track step timing
  useEffect(() => {
    if (currentStep !== lastCurrentStepRef.current) {
      const now = Date.now();
      
      // Record duration for previous step
      if (lastCurrentStepRef.current >= 0 && stepStartTimes[lastCurrentStepRef.current]) {
        setStepDurations(prev => ({
          ...prev,
          [lastCurrentStepRef.current]: Math.floor((now - stepStartTimes[lastCurrentStepRef.current]) / 1000)
        }));
      }
      
      // Record start time for current step
      setStepStartTimes(prev => ({
        ...prev,
        [currentStep]: now
      }));
      
      lastCurrentStepRef.current = currentStep;
    }
  }, [currentStep, stepStartTimes]);

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

  // Format time as mm:ss or hh:mm:ss
  const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}m ${secs}s`;
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  // Calculate progress percentage
  const completedSteps = Object.values(stepStatuses).filter(s => s === 'done').length;
  const progressPercent = Math.round((completedSteps / steps.length) * 100);

  // Generate status message based on current state
  const getStatusMessage = () => {
    if (summary) {
      if (summary.status === 'complete') return 'All tasks completed!';
      if (summary.status === 'cancelled') return 'Execution stopped by user';
      return 'Execution stopped';
    }
    const currentStepData = steps[safeCurrentIndex];
    if (!currentStepData) return 'Preparing...';

    const status = stepStatuses[safeCurrentIndex];
    if (status === 'running') {
      return currentAction || `Working on: ${currentStepData.description}`;
    }
    if (status === 'recovering') {
      return `Recovering: ${currentStepData.description}`;
    }
    return `Next: ${currentStepData.description}`;
  };

  const renderStep = (step, index) => {
    const status = stepStatuses[index] || 'pending';
    const isCurrent = index === safeCurrentIndex;
    const isExpanded = expandedSteps[index] !== undefined ? expandedSteps[index] : isCurrent;
    const duration = stepDurations[index];

    return (
      <div
        key={step.id || index}
        className={`execution-step ${status} ${isCurrent ? 'current' : ''} ${isExpanded ? 'expanded' : 'collapsed'}`}
      >
        <div className="step-indicator">
          {status === 'done' && (
            <div className="step-icon done">
              <Check size={14} />
            </div>
          )}
          {status === 'running' && (
            <div className="step-icon running">
              <Loader2 size={14} className="spinner" />
            </div>
          )}
          {status === 'recovering' && (
            <div className="step-icon recovering">
              <RefreshCw size={14} className="spinner" />
            </div>
          )}
          {status === 'failed' && (
            <div className="step-icon failed">
              <X size={14} />
            </div>
          )}
          {status === 'pending' && (
            <div className="step-icon pending">
              <Circle size={14} />
            </div>
          )}
        </div>

        <div className="step-content">
          <div className="step-header" onClick={() => toggleStep(index)}>
            <div className="step-header-left">
              <div className={`step-number ${status}`}>
                {status === 'done' ? '✓' : index + 1}
              </div>
              <div className="step-description">{step.description}</div>
            </div>
            <div className="step-header-right">
              {duration !== undefined && (
                <span className="step-duration">{formatTime(duration)}</span>
              )}
              {status === 'running' && (
                <span className="step-duration live">
                  <Activity size={10} className="pulse" />
                  Live
                </span>
              )}
              <button
                className="step-expand-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleStep(index);
                }}
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            </div>
          </div>
          {isExpanded && (
            <div className="step-details">
              {status === 'recovering' && (
                <div className="step-recovery-notice">🔄 Attempting recovery...</div>
              )}
              {status === 'running' && currentAction && (
                <div className="step-current-action">
                  <Zap size={12} />
                  <span>{currentAction}</span>
                </div>
              )}
              {step.tool_name && <div className="step-tool">🛠 {step.tool_name}</div>}
              {step.goal && <div className="step-goal">🎯 {step.goal}</div>}
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
  const visibleNext = showNextGroup ? nextIndices : nextIndices.slice(0, 2);

  const hasHiddenPrevious = previousIndices.length > visiblePrevious.length;
  const hiddenPreviousCount = previousIndices.length - visiblePrevious.length;
  const hasHiddenNext = nextIndices.length > visibleNext.length;
  const hiddenNextCount = nextIndices.length - visibleNext.length;

  return (
    <div className={`execution-progress ${summary ? 'completed' : 'active'}`}>
      {/* Header with progress bar */}
      <div className="execution-progress-header">
        <div className="header-top">
          <div className="header-title">
            <Activity size={14} className={summary ? '' : 'pulse'} />
            <h3>{summary ? 'Execution Complete' : 'Working on your task...'}</h3>
          </div>
          <div className="header-stats">
            <span className="elapsed-time">
              <Clock size={12} />
              {formatTime(elapsedTime)}
            </span>
            <span className="step-count">{completedSteps}/{steps.length}</span>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="progress-bar-container">
          <div
            className={`progress-bar-fill ${summary?.status === 'complete' ? 'complete' : ''} ${summary?.status === 'failed' ? 'failed' : ''} ${summary?.status === 'cancelled' ? 'cancelled' : ''}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        
        {/* Current status message */}
        {!summary && (
          <div className="current-status">
            <span className="status-indicator" />
            <span className="status-text">{getStatusMessage()}</span>
          </div>
        )}
      </div>

      {/* Steps checklist */}
      <div className="execution-steps">
        {hasHiddenPrevious && (
          <button
            type="button"
            className="execution-aggregate previous"
            onClick={() => setShowPreviousGroup((v) => !v)}
          >
            {showPreviousGroup
              ? '↑ Hide completed steps'
              : `✓ ${hiddenPreviousCount} step${hiddenPreviousCount > 1 ? 's' : ''} completed`}
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
              ? '↓ Hide upcoming steps'
              : `${hiddenNextCount} more step${hiddenNextCount > 1 ? 's' : ''} remaining`}
          </button>
        )}
      </div>

      {/* Summary when complete */}
      {summary && (
        <div className={`execution-summary ${summary.status}`}>
          <div className="summary-icon">
            {summary.status === 'complete' ? '🎉' : summary.status === 'cancelled' ? '⏹️' : '⚠️'}
          </div>
          <div className="summary-content">
            <div className="summary-message">{summary.message}</div>
            <div className="summary-stats">
              <span className="stat success">✓ {summary.successCount} completed</span>
              {summary.failedCount > 0 && (
                <span className="stat failed">✗ {summary.failedCount} failed</span>
              )}
              {summary.status === 'cancelled' && (
                <span className="stat cancelled">⏹ Stopped by user</span>
              )}
              <span className="stat time">⏱ {formatTime(elapsedTime)} total</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
